import re
import html as html_module
import requests as http_requests
from rest_framework import status, generics, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from django.http import HttpResponse
from django.db import transaction
import json
import csv
import io
import datetime
import dns.resolver
from django.core.mail import get_connection, EmailMessage

from .models import Template, Identity, Campaign, CampaignContact, Log, TrackedOpen
from .serializers import (
    TemplateSerializer,
    IdentitySerializer,
    CampaignSerializer,
    CampaignListSerializer,
    CampaignContactSerializer,
    LogSerializer,
)


class TemplateViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TemplateSerializer

    def get_queryset(self):
        queryset = Template.objects.filter(user=self.request.user)
        template_type = self.request.query_params.get("type")
        if template_type:
            queryset = queryset.filter(type=template_type)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        if Campaign.objects.filter(template=instance).exists():
            from rest_framework import serializers
            raise serializers.ValidationError(
                "This template is used by campaigns and cannot be deleted."
            )
        instance.delete()


class IdentityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = IdentitySerializer

    def get_queryset(self):
        return Identity.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        if Campaign.objects.filter(identity=instance).exists():
            from rest_framework import serializers
            raise serializers.ValidationError("This identity is used by campaigns and cannot be deleted.")
        instance.delete()

    @action(detail=True, methods=["post"])
    def test_connection(self, request, pk=None):
        instance = self.get_object()
        host = request.data.get("host") or instance.host
        port = request.data.get("port") or instance.port
        username = request.data.get("smtp_user") or instance.smtp_user
        password = request.data.get("smtp_pass")
        if not password:
            password = instance.get_decrypted_password()

        use_tls = request.data.get("use_tls", instance.use_tls)
        use_ssl = request.data.get("use_ssl", instance.use_ssl)

        try:
            connection = get_connection(
                backend="django.core.mail.backends.smtp.EmailBackend",
                host=host,
                port=port,
                username=username,
                password=password,
                use_tls=use_tls,
                use_ssl=use_ssl,
                timeout=10,
            )
            connection.open()
            connection.close()

            from django.utils import timezone

            instance.last_verified_at = timezone.now()
            instance.save()
            return Response({"success": True, "message": "Connection successful"})
        except Exception as e:
            return Response(
                {"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=["post"], url_path="test-new")
    def test_new_connection(self, request):
        host = request.data.get("host")
        port = int(request.data.get("port", 587))
        username = request.data.get("smtp_user")
        password = request.data.get("smtp_pass")
        use_tls = request.data.get("use_tls", True)
        use_ssl = request.data.get("use_ssl", False)

        try:
            connection = get_connection(
                backend="django.core.mail.backends.smtp.EmailBackend",
                host=host,
                port=port,
                username=username,
                password=password,
                use_tls=use_tls,
                use_ssl=use_ssl,
                timeout=10,
            )
            connection.open()
            connection.close()
            return Response({"success": True, "message": "Connection successful"})
        except Exception as e:
            return Response(
                {"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST
            )


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(req):
    return Response({"status": "ok"})


class CampaignViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CampaignSerializer

    def get_queryset(self):
        return Campaign.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == "list":
            return CampaignListSerializer
        return CampaignSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["get"])
    def logs(self, request, pk=None):
        campaign = self.get_object()
        logs = campaign.logs.all()
        serializer = LogSerializer(logs, many=True)
        total_sent = campaign.logs.filter(status="success").count()
        total_opens = campaign.opens.count()
        return Response({
            "logs": serializer.data,
            "stats": {
                "sent": total_sent,
                "failed": campaign.contacts.filter(status="failed").count(),
                "opens": total_opens,
                "open_rate": round(total_opens / total_sent * 100, 1) if total_sent > 0 else 0,
            },
        })

    @action(
        detail=False, methods=["post"], parser_classes=[MultiPartParser, FormParser]
    )
    def send(self, request):
        name = request.data.get("name")
        template_id = request.data.get("templateId")
        identity_id = request.data.get("identityId")
        campaign_type = request.data.get("type", "email")
        delay_ms = request.data.get("delayMs", 45000)
        use_gemini = request.data.get("useGemini") == "true"
        schedule_days = request.data.get("scheduleDays")
        start_time = request.data.get("startTime")
        end_time = request.data.get("endTime")

        csv_file = request.FILES.get("csv")
        if not csv_file:
            return Response(
                {"error": "CSV file is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        
        if not template_id:
            return Response(
                {"error": "Template is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        if campaign_type == "email" and not identity_id:
            return Response(
                {"error": "Identity is required for email campaigns"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if schedule_days and isinstance(schedule_days, str):
            try:
                schedule_days = json.loads(schedule_days)
            except:
                pass

        parsed_start = None
        parsed_end = None
        if start_time:
            try:
                parsed_start = datetime.datetime.strptime(start_time, "%H:%M").time()
            except:
                pass
        if end_time:
            try:
                parsed_end = datetime.datetime.strptime(end_time, "%H:%M").time()
            except:
                pass

        campaign = Campaign.objects.create(
            user=request.user,
            name=name,
            template_id=template_id,
            identity_id=identity_id if identity_id else None,
            type=campaign_type,
            delay_ms=int(delay_ms) if delay_ms else 45000,
            use_gemini=use_gemini,
            status="scheduled",
            schedule_days=schedule_days,
            schedule_start_time=parsed_start,
            schedule_end_time=parsed_end,
        )

        raw_data = csv_file.read()
        try:
            decoded = raw_data.decode("utf-8-sig")
        except UnicodeDecodeError:
            decoded = raw_data.decode("latin-1")
        reader = csv.DictReader(io.StringIO(decoded))

        # Normalize column names: strip whitespace, lowercase
        normalized = []
        for row in reader:
            cleaned = {k.strip().lower(): v.strip() if v else v for k, v in row.items()}
            normalized.append(cleaned)

        contacts_to_create = []
        for row in normalized:
            email = None
            # Try common email column patterns
            for col in ("email", "e-mail", "email_address", "emailaddress", "mail", "recipient"):
                if col in row:
                    email = row[col]
                    break
            # Fallback: find first column containing "email" or look for phone columns
            if not email:
                for col in row:
                    if "email" in col:
                        email = row[col]
                        break
            if not email:
                for col in ("phone", "mobile", "phone_number", "phonenumber"):
                    if col in row:
                        email = row[col]
                        break
            if email:
                contacts_to_create.append(
                    CampaignContact(
                        campaign=campaign, recipient=email, data=json.dumps(row)
                    )
                )

        CampaignContact.objects.bulk_create(contacts_to_create, batch_size=500)

        return Response({"message": "Campaign scheduled", "campaignId": campaign.id})

    @action(detail=True, methods=["get"])
    def progress(self, request, pk=None):
        campaign = self.get_object()
        contacts = CampaignContact.objects.filter(campaign=campaign)
        total = contacts.count()
        sent = contacts.filter(status="sent").count()
        failed = contacts.filter(status="failed").count()
        pending = contacts.filter(status="pending").count()
        recent_logs = Log.objects.filter(campaign=campaign).order_by("-created_at")[:20]
        from .serializers import LogSerializer as LogSer
        log_data = LogSer(recent_logs, many=True).data
        return Response({
            "total": total,
            "sent": sent,
            "failed": failed,
            "pending": pending,
            "status": campaign.status,
            "delay_ms": campaign.delay_ms,
            "logs": log_data,
        })

    @action(detail=True, methods=["post"])
    def rerun(self, request, pk=None):
        original = self.get_object()
        new_campaign = Campaign.objects.create(
            user=request.user,
            name=f"{original.name} (2)",
            template=original.template,
            identity=original.identity,
            type=original.type,
            delay_ms=original.delay_ms,
            use_gemini=original.use_gemini,
            status="scheduled",
        )
        contacts = CampaignContact.objects.filter(campaign=original)
        new_contacts = [
            CampaignContact(campaign=new_campaign, recipient=c.recipient, data=c.data)
            for c in contacts
        ]
        CampaignContact.objects.bulk_create(new_contacts, batch_size=500)
        return Response({"message": "Campaign re-scheduled", "campaignId": new_campaign.id})

    @action(detail=True, methods=["post"])
    def retry_failed(self, request, pk=None):
        original = self.get_object()
        failed_contacts = CampaignContact.objects.filter(campaign=original, status='failed')
        count = failed_contacts.count()
        if count == 0:
            return Response({"error": "No failed contacts to retry"}, status=status.HTTP_400_BAD_REQUEST)
        new_campaign = Campaign.objects.create(
            user=request.user,
            name=f"{original.name} (Retry Failed)",
            template=original.template,
            identity=original.identity,
            type=original.type,
            delay_ms=original.delay_ms,
            use_gemini=original.use_gemini,
            status="scheduled",
        )
        new_contacts = [
            CampaignContact(campaign=new_campaign, recipient=c.recipient, data=c.data)
            for c in failed_contacts
        ]
        CampaignContact.objects.bulk_create(new_contacts, batch_size=500)
        return Response({"message": f"{count} failed contacts re-scheduled", "campaignId": new_campaign.id, "count": count})

    @action(detail=True, methods=["get", "put"])
    def contacts(self, request, pk=None):
        campaign = self.get_object()
        if request.method == "GET":
            qs = CampaignContact.objects.filter(campaign=campaign)
            serializer = CampaignContactSerializer(qs, many=True)
            return Response(serializer.data)
        else:
            data = request.data
            if isinstance(data, str):
                data = json.loads(data)
            if not isinstance(data, list):
                return Response({"error": "Expected a list of contacts"}, status=status.HTTP_400_BAD_REQUEST)
            CampaignContact.objects.filter(campaign=campaign).delete()
            contacts = []
            for item in data:
                recipient = item.get("recipient") or item.get("email") or ""
                contacts.append(
                    CampaignContact(campaign=campaign, recipient=recipient, data=json.dumps(item))
                )
            CampaignContact.objects.bulk_create(contacts, batch_size=500)
            campaign.status = "scheduled"
            campaign.save()
            return Response({"message": f"{len(contacts)} contacts updated", "campaignId": campaign.id})


class LogViewSet(viewsets.ModelViewSet):
    serializer_class = LogSerializer

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return Log.objects.filter(campaign__user=self.request.user)

    def create(self, request, *args, **kwargs):
        api_key = request.headers.get("authorization", "").replace("Bearer ", "")
        if api_key == getattr(settings, "WHATSAPP_API_KEY", ""):
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        if request.user.is_authenticated:
            return super().create(request, *args, **kwargs)
        return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)


POSTMARK_SPAMCHECK_URL = "https://spamcheck.postmarkapp.com/filter"


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def check_spam_score(request):
    template_id = request.data.get("template_id")
    identity_id = request.data.get("identity_id")

    if not template_id:
        return Response({"error": "template_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        template = Template.objects.get(id=template_id, user=request.user)
    except Template.DoesNotExist:
        return Response({"error": "Template not found"}, status=status.HTTP_404_NOT_FOUND)

    identity = None
    sender = request.user.email
    if identity_id:
        try:
            identity = Identity.objects.get(id=identity_id, user=request.user)
            sender = identity.smtp_user
            if identity.smtp_from_name:
                sender = f"{identity.smtp_from_name} <{identity.smtp_user}>"
        except Identity.DoesNotExist:
            pass

    # Build email body (same as process_campaigns does)
    body = template.body or ""
    subject = template.subject or ""

    # Generate plain text version
    plain_text = re.sub(r"<[^>]+>", "", body)
    plain_text = html_module.unescape(plain_text)
    plain_text = re.sub(r"\n\s*\n", "\n\n", plain_text.strip())
    plain_text = plain_text.replace("&nbsp;", " ").replace("&amp;", "&")

    # Construct raw email
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S %z")
    msg_id = f"<check.{int(datetime.datetime.now().timestamp())}@bemailsender>"
    boundary = "boundary_123456789"
    raw_email = (
        f"From: {sender}\n"
        f"To: test@example.com\n"
        f"Subject: {subject}\n"
        f"Date: {now_str}\n"
        f"Message-ID: {msg_id}\n"
        f"MIME-Version: 1.0\n"
        f'Content-Type: multipart/alternative; boundary="{boundary}"\n'
        f"List-Unsubscribe: <mailto:test@example.com?subject=unsubscribe>\n"
        f"Reply-To: test@example.com\n"
        f"\n"
        f"--{boundary}\n"
        f"Content-Type: text/plain; charset=utf-8\n"
        f"Content-Transfer-Encoding: 7bit\n"
        f"\n"
        f"{plain_text}\n"
        f"\n"
        f"--{boundary}\n"
        f"Content-Type: text/html; charset=utf-8\n"
        f"Content-Transfer-Encoding: 7bit\n"
        f"\n"
        f"{body}\n"
        f"\n"
        f"--{boundary}--"
    )

    try:
        response = http_requests.post(
            POSTMARK_SPAMCHECK_URL,
            json={"email": raw_email, "options": "long"},
            timeout=30,
        )

        if response.status_code == 200:
            data = response.json()
            score = data.get("score", 0)
            report = data.get("report", "")
            return Response({"score": score, "report": report})
        else:
            return Response(
                {"error": "Spam check service unavailable", "detail": response.text},
                status=status.HTTP_502_BAD_GATEWAY,
            )
    except Exception as e:
        return Response(
            {"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY
        )


# Common disposable email domains
DISPOSABLE_DOMAINS = {
    "10minutemail.com", "10minutemail.net", "10minutemail.org",
    "mailinator.com", "mailinator.net",
    "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
    "tempmail.com", "tempmail.net", "tempmail.org",
    "throwaway.email", "throwawaymail.com",
    "yopmail.com", "yopmail.net",
    "sharklasers.com", "spam4.me",
    "trashmail.com", "trashmail.net",
    "temp-mail.org", "temp-mail.net",
    "fakeinbox.com", "fake-mail.com",
    "mailnator.com", "mailexpire.com",
    "getnada.com", "dropmail.me",
    "dispostable.com", "maildrop.cc",
    "emailondeck.com", "spambox.us",
    "mailmetrash.com", "thankyou2010.com",
    "trash2009.com", "mt2009.com",
    "trashymail.com", "trash2009.com",
    "tempinbox.com", "tempemail.net",
    "sogetthis.com", "pookmail.com",
}


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_emails(request):
    csv_file = request.FILES.get("csv")
    if not csv_file:
        return Response({"error": "CSV file is required"}, status=status.HTTP_400_BAD_REQUEST)

    raw_data = csv_file.read()
    try:
        decoded = raw_data.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = raw_data.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    emails = []
    for row in reader:
        cleaned = {k.strip().lower(): v.strip() if v else v for k, v in row.items()}
        email = None
        for col in ("email", "e-mail", "email_address", "emailaddress", "mail", "recipient"):
            if col in cleaned:
                email = cleaned[col]
                break
        if not email:
            for col in cleaned:
                if "email" in col:
                    email = cleaned[col]
                    break
        if email:
            emails.append(email)

    if not emails:
        return Response({"error": "No email addresses found in CSV"}, status=status.HTTP_400_BAD_REQUEST)

    results = []
    email_regex = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')
    for email in emails:
        result = {"email": email, "valid": False, "reason": None}

        if not email_regex.match(email):
            result["reason"] = "Invalid email format"
            results.append(result)
            continue

        domain = email.split("@")[1].lower()

        if domain in DISPOSABLE_DOMAINS:
            result["valid"] = True
            result["warning"] = "Disposable email address"
            results.append(result)
            continue

        try:
            resolver = dns.resolver.Resolver()
            resolver.timeout = 3
            resolver.lifetime = 3
            resolver.resolve(domain, "MX")
            result["valid"] = True
            result["reason"] = "Domain verified"
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.LifetimeTimeout):
            result["reason"] = "Domain does not accept email"
        except Exception:
            result["reason"] = "Could not verify domain"

        results.append(result)

    valid_count = sum(1 for r in results if r["valid"])
    invalid_count = sum(1 for r in results if not r["valid"])
    warning_count = sum(1 for r in results if r.get("warning"))

    return Response({
        "results": results,
        "stats": {
            "total": len(results),
            "valid": valid_count,
            "invalid": invalid_count,
            "warnings": warning_count,
        }
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def check_bounces(request):
    csv_file = request.FILES.get("csv")
    if not csv_file:
        return Response({"error": "CSV file is required"}, status=status.HTTP_400_BAD_REQUEST)

    raw_data = csv_file.read()
    try:
        decoded = raw_data.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = raw_data.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    csv_emails = []
    for row in reader:
        cleaned = {k.strip().lower(): v.strip() if v else v for k, v in row.items()}
        email = None
        for col in ("email", "e-mail", "email_address", "emailaddress", "mail", "recipient"):
            if col in cleaned:
                email = cleaned[col]
                break
        if not email:
            for col in cleaned:
                if "email" in col:
                    email = cleaned[col]
                    break
        if email:
            csv_emails.append(email)

    if not csv_emails:
        return Response({"error": "No email addresses found in CSV"}, status=status.HTTP_400_BAD_REQUEST)

    # Find previously failed emails from this user's campaigns
    failed_emails = set()
    user_campaigns = Campaign.objects.filter(user=request.user)
    failed_logs = Log.objects.filter(
        campaign__in=user_campaigns,
        status="error"
    ).values_list("recipient", flat=True).distinct().order_by()
    all_failed = set(failed_logs)

    # Count how many times each bounced and find which are in the CSV
    bounce_details = []
    for email in csv_emails:
        email_lower = email.lower().strip()
        if email_lower in {e.lower().strip() for e in all_failed}:
            bounce_count = Log.objects.filter(
                campaign__in=user_campaigns,
                status="error",
                recipient__iexact=email
            ).count()
            bounce_details.append({"email": email, "bounce_count": bounce_count})

    return Response({
        "bounced": bounce_details,
        "stats": {
            "total_in_csv": len(csv_emails),
            "previously_bounced": len(bounce_details),
        }
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def scan_csv(request):
    csv_file = request.FILES.get("csv")
    if not csv_file:
        return Response({"error": "CSV file is required"}, status=status.HTTP_400_BAD_REQUEST)

    raw_data = csv_file.read()
    try:
        decoded = raw_data.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = raw_data.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    csv_emails = []
    for row in reader:
        cleaned = {k.strip().lower(): v.strip() if v else v for k, v in row.items()}
        email = None
        for col in ("email", "e-mail", "email_address", "emailaddress", "mail", "recipient"):
            if col in cleaned:
                email = cleaned[col]
                break
        if not email:
            for col in cleaned:
                if "email" in col:
                    email = cleaned[col]
                    break
        if email:
            csv_emails.append(email)

    if not csv_emails:
        return Response({"error": "No email addresses found in CSV"}, status=status.HTTP_400_BAD_REQUEST)

    # Get all previously failed emails for this user
    user_campaigns = Campaign.objects.filter(user=request.user)
    failed_logs = Log.objects.filter(
        campaign__in=user_campaigns,
        status="error"
    ).values_list("recipient", flat=True).distinct().order_by()
    all_failed = set(failed_logs)
    failed_lower = {e.lower().strip() for e in all_failed}

    # Scan each email
    email_regex = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')
    results = []
    for email in csv_emails:
        entry = {"email": email, "valid": True, "flags": []}

        # Check syntax
        if not email_regex.match(email):
            entry["valid"] = False
            entry["flags"].append("invalid_format")
            entry["reason"] = "Invalid format"
            results.append(entry)
            continue

        domain = email.split("@")[1].lower()

        # Check bounce history
        email_lower = email.lower().strip()
        if email_lower in failed_lower:
            bounce_count = Log.objects.filter(
                campaign__in=user_campaigns,
                status="error",
                recipient__iexact=email
            ).count()
            entry["flags"].append("bounced")
            entry["bounce_count"] = bounce_count

        # Check disposable
        if domain in DISPOSABLE_DOMAINS:
            entry["flags"].append("disposable")
            entry["warning"] = "Disposable email"

        # Check MX record with timeout
        try:
            resolver = dns.resolver.Resolver()
            resolver.timeout = 3
            resolver.lifetime = 3
            resolver.resolve(domain, "MX")
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.LifetimeTimeout):
            entry["valid"] = False
            entry["flags"].append("invalid_domain")
            entry["reason"] = "Domain does not accept email"
        except Exception:
            entry["valid"] = False
            entry["flags"].append("invalid_domain")
            entry["reason"] = "Could not verify domain"

        if entry["valid"] and not entry["flags"]:
            entry["reason"] = "OK"

        results.append(entry)

    stats = {
        "total": len(results),
        "valid": sum(1 for r in results if r["valid"] and not r["flags"]),
        "disposable": sum(1 for r in results if "disposable" in r["flags"]),
        "bounced": sum(1 for r in results if "bounced" in r["flags"]),
        "invalid": sum(1 for r in results if not r["valid"]),
    }

    return Response({"results": results, "stats": stats})


@api_view(["GET"])
@permission_classes([AllowAny])
def track_open(request, campaign_id, recipient):
    try:
        recipient = recipient.replace("%40", "@")
        campaign = Campaign.objects.get(id=campaign_id)
        TrackedOpen.objects.create(
            campaign=campaign,
            recipient=recipient,
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )
    except Exception:
        pass

    return HttpResponse(TRANSPARENT_GIF, content_type="image/gif")
