import re
import html as html_module
import hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests as http_requests
from rest_framework import status, generics, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.clickjacking import xframe_options_exempt
from django.db import models, transaction
import json
import csv
import io
import datetime
import dns.resolver
from django.core.mail import get_connection, EmailMessage

from .services.laya_service import LayaAIService

from .models import (
    Template,
    Identity,
    IdentityGroup,
    Campaign,
    CampaignContact,
    SavedCsv,
    Log,
    TrackedOpen,
    InboundConfiguration,
    ReceivedEmail,
    CustomForm,
    LandingPage,
    FormSubmission,
)
from .serializers import (
    TemplateSerializer,
    IdentitySerializer,
    IdentityGroupSerializer,
    SavedCsvSerializer,
    CampaignSerializer,
    CampaignListSerializer,
    CampaignContactSerializer,
    LogSerializer,
    InboundConfigurationSerializer,
    ReceivedEmailSerializer,
    CustomFormSerializer,
    LandingPageSerializer,
    FormSubmissionSerializer,
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
        if Campaign.objects.filter(
            models.Q(identity=instance) | models.Q(identity_group__identities=instance),
            status__in=["scheduled", "running"]
        ).exists():
            from rest_framework import serializers
            raise serializers.ValidationError("This identity is used by active campaigns and cannot be deleted.")
        instance.identitygroup_set.clear()
        instance.delete()

    @action(detail=True, methods=["post"], url_path="test")
    def test_connection(self, request, pk=None):
        instance = self.get_object()
        host = request.data.get("host") or instance.host
        port = request.data.get("port") or instance.port
        username = request.data.get("smtp_user") or instance.smtp_user
        password = request.data.get("smtp_pass")
        if not password:
            password = instance.get_decrypted_password()

        from_name = request.data.get("smtp_from_name") or instance.smtp_from_name or ""
        from_email = request.data.get("smtp_from_email") or instance.smtp_from_email or username

        recipient_email = request.data.get("recipient_email", "").strip()
        recipient_name = request.data.get("recipient_name", "").strip()

        use_tls = request.data.get("use_tls", instance.use_tls)
        use_ssl = request.data.get("use_ssl", instance.use_ssl)

        is_brevo_api = (host in ["api.brevo.com", "brevo", "brevo_api"]) or (password and str(password).strip().startswith("xkeysib-"))
        if is_brevo_api:
            if not password:
                return Response(
                    {"success": False, "message": "Brevo API key is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                # If recipient email provided, send real test email
                if recipient_email:
                    sender_payload = {"email": from_email}
                    if from_name:
                        sender_payload["name"] = from_name

                    html_body = f"""
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; color: #1e293b;">
                      <div style="text-align: center; margin-bottom: 20px;">
                        <div style="display: inline-block; padding: 8px 18px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9999px; color: #065f46; font-weight: bold; font-size: 13px; margin-bottom: 12px;">
                          ✅ Brevo API Test Email
                        </div>
                        <h2 style="margin: 0; color: #0f172a; font-size: 20px;">Connection Verified!</h2>
                        <p style="margin: 6px 0 0 0; color: #64748b; font-size: 13px;">Hi {recipient_name or 'there'}, your Brevo provider is connected and sending emails properly.</p>
                      </div>
                      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; font-size: 13px; line-height: 1.6; margin-bottom: 20px;">
                        <div><strong>Provider:</strong> Brevo REST API v3</div>
                        <div><strong>Sender:</strong> {from_name} &lt;{from_email}&gt;</div>
                        <div><strong>Recipient:</strong> {recipient_email}</div>
                      </div>
                      <p style="text-align: center; font-size: 11px; color: #94a3b8; margin: 0;">Sent via BEmailSender</p>
                    </div>
                    """
                    payload = {
                        "sender": sender_payload,
                        "to": [{"email": recipient_email, "name": recipient_name or "Test Recipient"}],
                        "subject": "✅ Test Email: Brevo Connection Verified",
                        "htmlContent": html_body,
                        "textContent": f"Hi {recipient_name or 'there'}, your Brevo provider is connected and sending emails properly!",
                    }
                    resp = http_requests.post(
                        "https://api.brevo.com/v3/smtp/email",
                        headers={"api-key": str(password).strip(), "accept": "application/json", "content-type": "application/json"},
                        json=payload,
                        timeout=15,
                    )
                    if resp.status_code in [200, 201, 202]:
                        from django.utils import timezone
                        instance.last_verified_at = timezone.now()
                        instance.save(update_fields=["last_verified_at"])
                        return Response({
                            "success": True,
                            "message": f"Test email sent successfully to {recipient_email} via Brevo API!",
                        })
                    else:
                        err_msg = resp.text
                        try:
                            err_msg = resp.json().get("message", resp.text)
                        except Exception:
                            pass
                        return Response(
                            {"success": False, "message": f"Brevo API error: {err_msg}"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                # Otherwise check account
                resp = http_requests.get(
                    "https://api.brevo.com/v3/account",
                    headers={"api-key": str(password).strip(), "accept": "application/json"},
                    timeout=10,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    email = data.get("email", "")
                    plan_info = ""
                    if data.get("plan"):
                        p = data["plan"][0]
                        plan_info = f" (Plan: {p.get('type', 'Standard')} | Credits: {p.get('credits', 0)})"

                    from django.utils import timezone
                    instance.last_verified_at = timezone.now()
                    instance.save(update_fields=["last_verified_at"])
                    return Response({
                        "success": True,
                        "message": f"Brevo API Connected! Account: {email}{plan_info}",
                        "account": email,
                        "data": data,
                    })
                else:
                    err_msg = "Invalid Brevo API Key"
                    try:
                        err_msg = resp.json().get("message", resp.text)
                    except Exception:
                        err_msg = resp.text
                    return Response(
                        {"success": False, "message": f"Brevo API Error: {err_msg}"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            except Exception as e:
                return Response(
                    {"success": False, "message": f"Brevo API Connection Failed: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            connection = get_connection(
                backend="django.core.mail.backends.smtp.EmailBackend",
                host=host,
                port=int(port),
                username=username,
                password=password,
                use_tls=use_tls,
                use_ssl=use_ssl,
                timeout=15,
            )

            if recipient_email:
                sender_header = f"{from_name} <{from_email}>" if from_name else from_email
                html_body = f"""
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; color: #1e293b;">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <div style="display: inline-block; padding: 8px 18px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9999px; color: #065f46; font-weight: bold; font-size: 13px; margin-bottom: 12px;">
                      ✅ SMTP Connection Verified
                    </div>
                    <h2 style="margin: 0; color: #0f172a; font-size: 20px;">Connection Verified!</h2>
                    <p style="margin: 6px 0 0 0; color: #64748b; font-size: 13px;">Hi {recipient_name or 'there'}, your SMTP server ({host}) is connected and sending emails properly.</p>
                  </div>
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; font-size: 13px; line-height: 1.6; margin-bottom: 20px;">
                    <div><strong>SMTP Server:</strong> {host}:{port}</div>
                    <div><strong>Sender:</strong> {sender_header}</div>
                    <div><strong>Recipient:</strong> {recipient_email}</div>
                  </div>
                  <p style="text-align: center; font-size: 11px; color: #94a3b8; margin: 0;">Sent via BEmailSender</p>
                </div>
                """
                from django.core.mail import EmailMultiAlternatives
                msg = EmailMultiAlternatives(
                    subject=f"✅ Test Email: SMTP Connection Verified ({host})",
                    body=f"Hi {recipient_name or 'there'}, your SMTP server ({host}) is connected and working!",
                    from_email=sender_header,
                    to=[recipient_email],
                    connection=connection,
                )
                msg.attach_alternative(html_body, "text/html")
                msg.send()

                from django.utils import timezone
                instance.last_verified_at = timezone.now()
                instance.save(update_fields=["last_verified_at"])
                return Response({"success": True, "message": f"Test email sent successfully to {recipient_email}!"})

            connection.open()
            connection.close()

            from django.utils import timezone

            instance.last_verified_at = timezone.now()
            instance.save(update_fields=["last_verified_at"])
            return Response({"success": True, "message": "SMTP Connection successful"})
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

        from_name = request.data.get("smtp_from_name", "")
        from_email = request.data.get("smtp_from_email", "") or username

        recipient_email = request.data.get("recipient_email", "").strip()
        recipient_name = request.data.get("recipient_name", "").strip()

        is_brevo_api = (host in ["api.brevo.com", "brevo", "brevo_api"]) or (password and str(password).strip().startswith("xkeysib-"))
        if is_brevo_api:
            if not password:
                return Response(
                    {"success": False, "message": "Brevo API key is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                # If recipient email provided, send real test email
                if recipient_email:
                    sender_payload = {"email": from_email}
                    if from_name:
                        sender_payload["name"] = from_name

                    html_body = f"""
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; color: #1e293b;">
                      <div style="text-align: center; margin-bottom: 20px;">
                        <div style="display: inline-block; padding: 8px 18px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9999px; color: #065f46; font-weight: bold; font-size: 13px; margin-bottom: 12px;">
                          ✅ Brevo API Test Email
                        </div>
                        <h2 style="margin: 0; color: #0f172a; font-size: 20px;">Connection Verified!</h2>
                        <p style="margin: 6px 0 0 0; color: #64748b; font-size: 13px;">Hi {recipient_name or 'there'}, your Brevo provider is connected and sending emails properly.</p>
                      </div>
                      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; font-size: 13px; line-height: 1.6; margin-bottom: 20px;">
                        <div><strong>Provider:</strong> Brevo REST API v3</div>
                        <div><strong>Sender:</strong> {from_name} &lt;{from_email}&gt;</div>
                        <div><strong>Recipient:</strong> {recipient_email}</div>
                      </div>
                      <p style="text-align: center; font-size: 11px; color: #94a3b8; margin: 0;">Sent via BEmailSender</p>
                    </div>
                    """
                    payload = {
                        "sender": sender_payload,
                        "to": [{"email": recipient_email, "name": recipient_name or "Test Recipient"}],
                        "subject": "✅ Test Email: Brevo Connection Verified",
                        "htmlContent": html_body,
                        "textContent": f"Hi {recipient_name or 'there'}, your Brevo provider is connected and sending emails properly!",
                    }
                    resp = http_requests.post(
                        "https://api.brevo.com/v3/smtp/email",
                        headers={"api-key": str(password).strip(), "accept": "application/json", "content-type": "application/json"},
                        json=payload,
                        timeout=15,
                    )
                    if resp.status_code in [200, 201, 202]:
                        return Response({
                            "success": True,
                            "message": f"Test email sent successfully to {recipient_email} via Brevo API!",
                        })
                    else:
                        err_msg = resp.text
                        try:
                            err_msg = resp.json().get("message", resp.text)
                        except Exception:
                            pass
                        return Response(
                            {"success": False, "message": f"Brevo API error: {err_msg}"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                resp = http_requests.get(
                    "https://api.brevo.com/v3/account",
                    headers={"api-key": str(password).strip(), "accept": "application/json"},
                    timeout=10,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    email = data.get("email", "")
                    plan_info = ""
                    if data.get("plan"):
                        p = data["plan"][0]
                        plan_info = f" (Plan: {p.get('type', 'Standard')} | Credits: {p.get('credits', 0)})"
                    return Response({
                        "success": True,
                        "message": f"Brevo API Connected! Account: {email}{plan_info}",
                        "account": email,
                        "data": data,
                    })
                else:
                    err_msg = "Invalid Brevo API Key"
                    try:
                        err_msg = resp.json().get("message", resp.text)
                    except Exception:
                        err_msg = resp.text
                    return Response(
                        {"success": False, "message": f"Brevo API Error: {err_msg}"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            except Exception as e:
                return Response(
                    {"success": False, "message": f"Brevo API Connection Failed: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            connection = get_connection(
                backend="django.core.mail.backends.smtp.EmailBackend",
                host=host,
                port=port,
                username=username,
                password=password,
                use_tls=use_tls,
                use_ssl=use_ssl,
                timeout=15,
            )

            if recipient_email:
                sender_header = f"{from_name} <{from_email}>" if from_name else from_email
                html_body = f"""
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; color: #1e293b;">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <div style="display: inline-block; padding: 8px 18px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9999px; color: #065f46; font-weight: bold; font-size: 13px; margin-bottom: 12px;">
                      ✅ SMTP Connection Verified
                    </div>
                    <h2 style="margin: 0; color: #0f172a; font-size: 20px;">Connection Verified!</h2>
                    <p style="margin: 6px 0 0 0; color: #64748b; font-size: 13px;">Hi {recipient_name or 'there'}, your SMTP server ({host}) is connected and sending emails properly.</p>
                  </div>
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; font-size: 13px; line-height: 1.6; margin-bottom: 20px;">
                    <div><strong>SMTP Server:</strong> {host}:{port}</div>
                    <div><strong>Sender:</strong> {sender_header}</div>
                    <div><strong>Recipient:</strong> {recipient_email}</div>
                  </div>
                  <p style="text-align: center; font-size: 11px; color: #94a3b8; margin: 0;">Sent via BEmailSender</p>
                </div>
                """
                from django.core.mail import EmailMultiAlternatives
                msg = EmailMultiAlternatives(
                    subject=f"✅ Test Email: SMTP Connection Verified ({host})",
                    body=f"Hi {recipient_name or 'there'}, your SMTP server ({host}) is connected and working!",
                    from_email=sender_header,
                    to=[recipient_email],
                    connection=connection,
                )
                msg.attach_alternative(html_body, "text/html")
                msg.send()
                return Response({"success": True, "message": f"Test email sent successfully to {recipient_email}!"})

            connection.open()
            connection.close()
            return Response({"success": True, "message": "SMTP Connection successful"})
        except Exception as e:
            return Response(
                {"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST
            )


class IdentityGroupViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = IdentityGroupSerializer

    def get_queryset(self):
        return IdentityGroup.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SavedCsvViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SavedCsvSerializer

    def get_queryset(self):
        return SavedCsv.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["get"])
    def content(self, request, pk=None):
        saved_csv = self.get_object()
        return Response({
            "id": saved_csv.id,
            "name": saved_csv.name,
            "columns": saved_csv.columns,
            "row_count": saved_csv.row_count,
            "csv_content": saved_csv.csv_content,
        })

    @action(detail=True, methods=["post"])
    def clean(self, request, pk=None):
        saved_csv = self.get_object()
        remove_emails = request.data.get("remove_emails", [])
        remove_set = {e.strip().lower() for e in remove_emails}

        reader = csv.DictReader(io.StringIO(saved_csv.csv_content))
        fieldnames = reader.fieldnames
        if not fieldnames:
            return Response({"error": "CSV has no columns"}, status=400)

        email_col = None
        for col in fieldnames:
            if col.strip().lower() in ("email", "e-mail", "email_address", "emailaddress", "mail", "recipient"):
                email_col = col
                break
        if not email_col:
            for col in fieldnames:
                if "email" in col.lower():
                    email_col = col
                    break
        if not email_col:
            return Response({"error": "No email column found"}, status=400)

        kept = []
        removed = 0
        for row in reader:
            val = row.get(email_col, "").strip().lower()
            if val in remove_set:
                removed += 1
            else:
                kept.append(row)

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(kept)

        saved_csv.csv_content = output.getvalue()
        saved_csv.row_count = len(kept)
        saved_csv.save()

        return Response({"removed": removed, "remaining": len(kept)})


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
        identity_group_id = request.data.get("identityGroupId")
        saved_csv_id = request.data.get("savedCsvId")
        campaign_type = request.data.get("type", "email")
        delay_ms = request.data.get("delayMs", 45000)
        use_gemini = request.data.get("useGemini") == "true"
        schedule_days = request.data.get("scheduleDays")
        start_time = request.data.get("startTime")
        end_time = request.data.get("endTime")

        csv_file = request.FILES.get("csv")
        if not csv_file and not saved_csv_id:
            return Response(
                {"error": "CSV file or saved CSV is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        
        if not template_id:
            return Response(
                {"error": "Template is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        if campaign_type == "email" and not identity_id and not identity_group_id:
            return Response(
                {"error": "Identity or Identity Group is required for email campaigns"},
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
            identity_group_id=identity_group_id if identity_group_id else None,
            type=campaign_type,
            delay_ms=int(delay_ms) if delay_ms else 45000,
            use_gemini=use_gemini,
            status="scheduled",
            schedule_days=schedule_days,
            schedule_start_time=parsed_start,
            schedule_end_time=parsed_end,
        )

        if saved_csv_id:
            saved_csv = SavedCsv.objects.get(id=saved_csv_id, user=request.user)
            decoded = saved_csv.csv_content
        else:
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
        return [IsAuthenticated()]

    def get_queryset(self):
        return Log.objects.filter(campaign__user=self.request.user)


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
    try:
        return _scan_csv(request)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": f"Scan failed: {str(e)}"}, status=500)


def _scan_csv(request):
    saved_csv_id = request.data.get("savedCsvId") or request.POST.get("savedCsvId")
    csv_file = request.FILES.get("csv")
    check_gravatar_flag = request.data.get("gravatar") in ("true", "True", True, "1")

    if not csv_file and not saved_csv_id:
        return Response({"error": "CSV file or saved CSV is required"}, status=status.HTTP_400_BAD_REQUEST)

    if saved_csv_id:
        saved_csv = SavedCsv.objects.get(id=saved_csv_id, user=request.user)
        decoded = saved_csv.csv_content
    else:
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
    mx_cache = {}
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

        # Check MX record (cached per domain)
        if domain not in mx_cache:
            try:
                resolver = dns.resolver.Resolver()
                resolver.timeout = 3
                resolver.lifetime = 3
                resolver.resolve(domain, "MX")
                mx_cache[domain] = "ok"
            except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.LifetimeTimeout):
                mx_cache[domain] = "invalid"
            except Exception:
                mx_cache[domain] = "error"
        if mx_cache[domain] != "ok":
            entry["valid"] = False
            entry["flags"].append("invalid_domain")
            entry["reason"] = "Domain does not accept email" if mx_cache[domain] == "invalid" else "Could not verify domain"

        if entry["valid"] and not entry["flags"]:
            entry["reason"] = "OK"

        results.append(entry)

    # Gravatar check (parallel)
    if check_gravatar_flag:
        valid_entries = [e for e in results if e["valid"]]
        with ThreadPoolExecutor(max_workers=20) as executor:
            fut_map = {executor.submit(_check_gravatar, e["email"]): e for e in valid_entries}
            for fut in as_completed(fut_map):
                entry = fut_map[fut]
                try:
                    if fut.result():
                        entry["flags"].append("has_gravatar")
                        entry["reason"] = "Has Gravatar profile"
                except:
                    pass

    stats = {
        "total": len(results),
        "valid": sum(1 for r in results if r["valid"] and not r["flags"]),
        "disposable": sum(1 for r in results if "disposable" in r["flags"]),
        "bounced": sum(1 for r in results if "bounced" in r["flags"]),
        "invalid": sum(1 for r in results if not r["valid"]),
        "gravatar": sum(1 for r in results if "has_gravatar" in r["flags"]),
    }

    return Response({"results": results, "stats": stats})


def _check_gravatar(email):
    email_hash = hashlib.md5(email.lower().strip().encode()).hexdigest()
    url = f"https://www.gravatar.com/avatar/{email_hash}?d=404&s=1"
    try:
        resp = http_requests.get(url, timeout=5)
        return resp.status_code == 200
    except:
        return False


# 1x1 transparent GIF pixel
TRANSPARENT_GIF = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00"
    b"!\xf9\x04\x00\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00"
    b"\x00\x02\x02D\x01\x00;"
)


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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_analytics(request):
    user = request.user
    user_campaigns = Campaign.objects.filter(user=user)
    
    total_campaigns = user_campaigns.count()
    completed_campaigns = user_campaigns.filter(status="completed").count()
    running_campaigns = user_campaigns.filter(status="running").count()

    total_sent = Log.objects.filter(campaign__in=user_campaigns, status="success").count()
    total_failed = Log.objects.filter(campaign__in=user_campaigns, status="error").count()
    total_opened = TrackedOpen.objects.filter(campaign__in=user_campaigns).count()

    total_attempts = total_sent + total_failed
    delivery_rate = round((total_sent / total_attempts * 100), 1) if total_attempts > 0 else 100.0
    open_rate = round((total_opened / total_sent * 100), 1) if total_sent > 0 else 0.0

    # Recent 7 Days Send History
    from django.utils import timezone
    from datetime import timedelta
    now = timezone.now()
    daily_stats = []
    for i in range(6, -1, -1):
        day_date = (now - timedelta(days=i)).date()
        day_start = timezone.make_aware(timezone.datetime.combine(day_date, timezone.datetime.min.time()))
        day_end = timezone.make_aware(timezone.datetime.combine(day_date, timezone.datetime.max.time()))
        
        sent_count = Log.objects.filter(
            campaign__in=user_campaigns,
            status="success",
            created_at__range=(day_start, day_end)
        ).count()
        failed_count = Log.objects.filter(
            campaign__in=user_campaigns,
            status="error",
            created_at__range=(day_start, day_end)
        ).count()
        opened_count = TrackedOpen.objects.filter(
            campaign__in=user_campaigns,
            opened_at__range=(day_start, day_end)
        ).count()

        daily_stats.append({
            "date": day_date.strftime("%b %d"),
            "sent": sent_count,
            "failed": failed_count,
            "opened": opened_count,
        })

    # Top Performing Templates
    top_templates = []
    templates = Template.objects.filter(user=user)
    for tmpl in templates:
        t_campaigns = user_campaigns.filter(template=tmpl)
        if t_campaigns.exists():
            t_sent = Log.objects.filter(campaign__in=t_campaigns, status="success").count()
            t_opened = TrackedOpen.objects.filter(campaign__in=t_campaigns).count()
            t_rate = round((t_opened / t_sent * 100), 1) if t_sent > 0 else 0.0
            top_templates.append({
                "id": tmpl.id,
                "name": tmpl.name,
                "subject": tmpl.subject,
                "sent": t_sent,
                "opened": t_opened,
                "open_rate": t_rate,
            })
    top_templates.sort(key=lambda x: x["open_rate"], reverse=True)

    # Identities & Quota Usage
    identities_stat = []
    identities = Identity.objects.filter(user=user)
    for idn in identities:
        identities_stat.append({
            "id": idn.id,
            "name": idn.name,
            "email": idn.smtp_user,
            "host": idn.host,
            "daily_limit": idn.daily_limit,
            "daily_sent": idn.daily_sent,
            "remaining": max(0, idn.daily_limit - idn.daily_sent),
            "usage_percent": round((idn.daily_sent / idn.daily_limit * 100), 1) if idn.daily_limit > 0 else 0,
        })

    return Response({
        "summary": {
            "total_campaigns": total_campaigns,
            "completed_campaigns": completed_campaigns,
            "running_campaigns": running_campaigns,
            "total_sent": total_sent,
            "total_failed": total_failed,
            "total_opened": total_opened,
            "delivery_rate": delivery_rate,
            "open_rate": open_rate,
        },
        "daily_stats": daily_stats,
        "top_templates": top_templates[:5],
        "identities": identities_stat,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ai_generate_email(request):
    """
    Generate cold/marketing email subject & body from reference using Laya + Llama
    """
    reference = request.data.get("reference", "").strip()
    if not reference:
        return Response({"error": "Reference text or rough notes are required."}, status=status.HTTP_400_BAD_REQUEST)

    tone = request.data.get("tone", "auto")
    instruction = request.data.get("instruction", "").strip()

    from .services.laya_service import LayaAIService
    result = LayaAIService.generate_email_from_reference(
        reference=reference,
        requested_tone=tone,
        custom_instruction=instruction
    )
    return Response(result, status=status.HTTP_200_OK)


class InboundConfigurationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InboundConfigurationSerializer

    def get_queryset(self):
        return InboundConfiguration.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        import secrets
        token = secrets.token_hex(20)
        serializer.save(user=self.request.user, webhook_token=token)


class ReceivedEmailViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReceivedEmailSerializer
    http_method_names = ["get", "patch", "delete"]

    def get_queryset(self):
        queryset = ReceivedEmail.objects.filter(user=self.request.user)
        config_id = self.request.query_params.get("config_id")
        campaign_id = self.request.query_params.get("campaign_id")
        is_read = self.request.query_params.get("is_read")
        search = self.request.query_params.get("search")

        if config_id:
            queryset = queryset.filter(config_id=config_id)
        if campaign_id:
            queryset = queryset.filter(campaign_id=campaign_id)
        if is_read is not None:
            queryset = queryset.filter(is_read=(is_read.lower() == "true"))
        if search:
            queryset = queryset.filter(
                models.Q(subject__icontains=search)
                | models.Q(sender__icontains=search)
                | models.Q(body_text__icontains=search)
            )
        return queryset

    @action(detail=True, methods=["post"])
    def toggle_star(self, request, pk=None):
        email_obj = self.get_object()
        email_obj.is_starred = not email_obj.is_starred
        email_obj.save()
        return Response({"is_starred": email_obj.is_starred})

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        email_obj = self.get_object()
        email_obj.is_read = True
        email_obj.save()
        return Response({"is_read": True})


@api_view(["POST", "GET"])
@permission_classes([AllowAny])
def inbound_webhook(request, token):
    """
    Universal Inbound Webhook endpoint for receiving emails from
    SendGrid, Mailgun, Amazon SES, Postmark, or Generic HTTP POST.
    """
    try:
        config = InboundConfiguration.objects.get(webhook_token=token, is_active=True)
    except InboundConfiguration.DoesNotExist:
        return Response({"error": "Invalid or inactive webhook token"}, status=status.HTTP_404_NOT_FOUND)

    # Some providers like SendGrid or SES may send verification GET / HEAD requests
    if request.method == "GET":
        return Response({"status": "active", "provider": config.provider, "domain": config.domain})

    sender = ""
    recipient = ""
    subject = ""
    body_text = ""
    body_html = ""
    headers = {}
    raw_payload = {}

    provider = config.provider.lower()

    try:
        if provider == "sendgrid":
            # SendGrid Inbound Parse posts multipart/form-data
            sender = request.data.get("from", "")
            recipient = request.data.get("to", "")
            subject = request.data.get("subject", "")
            body_text = request.data.get("text", "")
            body_html = request.data.get("html", "")
            raw_headers = request.data.get("headers", "")
            if isinstance(raw_headers, str):
                headers = {"raw": raw_headers[:1000]}
            raw_payload = {"sender": sender, "recipient": recipient, "subject": subject}

        elif provider == "mailgun":
            # Mailgun Inbound Routes
            sender = request.data.get("sender") or request.data.get("From", "")
            recipient = request.data.get("recipient") or request.data.get("To", "")
            subject = request.data.get("subject", "")
            body_text = request.data.get("body-plain", "")
            body_html = request.data.get("body-html", "")
            raw_payload = {"sender": sender, "recipient": recipient, "subject": subject}

        elif provider == "ses":
            # Amazon SES SNS notification (JSON)
            payload = request.data
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except:
                    payload = {}
            # Handle SNS subscription confirmation
            if payload.get("Type") == "SubscriptionConfirmation":
                subscribe_url = payload.get("SubscribeURL")
                if subscribe_url:
                    http_requests.get(subscribe_url, timeout=5)
                return Response({"message": "SNS subscription confirmed"})

            mail = payload.get("mail", {})
            sender = mail.get("source", "")
            destinations = mail.get("destination", [])
            recipient = destinations[0] if destinations else ""
            common_headers = mail.get("commonHeaders", {})
            subject = common_headers.get("subject", "")
            content = payload.get("content", "")
            body_text = content or payload.get("Message", "")
            raw_payload = mail

        elif provider == "postmark":
            # Postmark Inbound Webhook JSON
            sender = request.data.get("From", "")
            recipient = request.data.get("To", "")
            subject = request.data.get("Subject", "")
            body_text = request.data.get("TextBody", "")
            body_html = request.data.get("HtmlBody", "")
            raw_payload = {"From": sender, "To": recipient, "Subject": subject}

        else:
            # Generic / Custom Webhook (JSON or Form)
            sender = request.data.get("from") or request.data.get("sender") or ""
            recipient = request.data.get("to") or request.data.get("recipient") or ""
            subject = request.data.get("subject", "")
            body_text = request.data.get("body_text") or request.data.get("text") or request.data.get("body") or ""
            body_html = request.data.get("body_html") or request.data.get("html") or ""
            raw_payload = request.data if isinstance(request.data, dict) else {}

        # Clean email addresses (e.g., "John Doe <john@example.com>" -> "john@example.com")
        extracted_sender_email = sender
        match = re.search(r"[\w\.-]+@[\w\.-]+", sender)
        if match:
            extracted_sender_email = match.group(0)

        # Check if this email is a reply to an active/sent campaign
        matched_campaign = None
        is_reply = False

        if extracted_sender_email:
            # Check CampaignContacts where recipient matches sender
            recent_contact = CampaignContact.objects.filter(
                campaign__user=config.user,
                recipient__iexact=extracted_sender_email,
                status="sent"
            ).order_by("-updated_at").first()

            if recent_contact:
                matched_campaign = recent_contact.campaign
                is_reply = True

        # Store received email in database
        received_email = ReceivedEmail.objects.create(
            user=config.user,
            config=config,
            campaign=matched_campaign,
            sender=sender,
            recipient=recipient,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            headers=headers,
            raw_payload=raw_payload,
            is_reply=is_reply,
            is_read=False,
        )

        return Response({
            "success": True,
            "message": "Email received and processed successfully",
            "email_id": received_email.id,
            "is_reply": is_reply,
            "campaign_id": matched_campaign.id if matched_campaign else None,
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class CustomFormViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CustomFormSerializer

    def get_queryset(self):
        return CustomForm.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Generate a unique readable shortcode e.g. {{form_xyz}}
        import uuid
        code = f"form_{uuid.uuid4().hex[:6]}"
        serializer.save(user=self.request.user, shortcode=code)


class LandingPageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = LandingPageSerializer

    def get_queryset(self):
        return LandingPage.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        import uuid
        # Generate slug from title or random string
        title = serializer.validated_data.get("title", "page")
        slug_base = re.sub(r"[^\w\s-]", "", title).strip().lower()
        slug_base = re.sub(r"[-\s]+", "-", slug_base)
        if not slug_base:
            slug_base = "landing"
        slug = f"{slug_base}-{uuid.uuid4().hex[:6]}"
        serializer.save(user=self.request.user, slug=slug)

    @action(detail=True, methods=["get"])
    def submissions(self, request, pk=None):
        page = self.get_object()
        submissions = FormSubmission.objects.filter(landing_page=page).order_by("-submitted_at")
        
        status_filter = request.query_params.get("status")
        if status_filter:
            submissions = submissions.filter(qualification_status=status_filter)
        elif request.query_params.get("qualified_only") == "true":
            submissions = submissions.filter(is_qualified=True)
            
        serializer = FormSubmissionSerializer(submissions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def evaluate_leads(self, request, pk=None):
        page = self.get_object()
        submissions = FormSubmission.objects.filter(landing_page=page)
        
        # Optionally re-evaluate all or only unprocessed
        reevaluate_all = request.data.get("all", False)
        if not reevaluate_all:
            submissions = submissions.filter(qualification_status="unprocessed")

        count = 0
        for s in submissions:
            eval_res = LayaAIService.evaluate_lead_qualification(s.data or {})
            s.qualification_status = eval_res.get("status", "review")
            s.qualification_score = eval_res.get("score", 70)
            s.is_qualified = eval_res.get("is_qualified", False)
            s.qualification_reason = eval_res.get("reason", "")
            s.save()
            count += 1

        all_submissions = FormSubmission.objects.filter(landing_page=page).order_by("-submitted_at")
        serializer = FormSubmissionSerializer(all_submissions, many=True)
        return Response({
            "success": True,
            "evaluated_count": count,
            "submissions": serializer.data
        })

    @action(detail=True, methods=["get"])
    def export_csv(self, request, pk=None):
        page = self.get_object()
        submissions = FormSubmission.objects.filter(landing_page=page).order_by("-submitted_at")
        
        qualified_only = request.query_params.get("qualified_only") == "true"
        if qualified_only:
            submissions = submissions.filter(is_qualified=True)

        # Collect all unique field keys across submissions
        field_keys = set()
        for s in submissions:
            if isinstance(s.data, dict):
                field_keys.update(s.data.keys())
        field_keys = sorted(list(field_keys))

        response = HttpResponse(content_type="text/csv")
        filename_prefix = "qualified_leads" if qualified_only else "leads"
        response["Content-Disposition"] = f'attachment; filename="{filename_prefix}_{page.slug}.csv"'

        writer = csv.writer(response)
        writer.writerow(["ID", "Submitted At", "Status", "Score", "Reason", "IP Address"] + field_keys)

        for s in submissions:
            row = [
                s.id,
                s.submitted_at.strftime("%Y-%m-%d %H:%M:%S"),
                s.qualification_status,
                s.qualification_score,
                s.qualification_reason or "",
                s.ip_address or ""
            ]
            for key in field_keys:
                row.append(s.data.get(key, "") if isinstance(s.data, dict) else "")
            writer.writerow(row)

        return response


@api_view(["GET"])
@permission_classes([AllowAny])
def public_landing_page_data(request, slug):
    """
    Public API: Returns the HTML and any embedded form schema for rendering on the public route.
    Increments view count.
    """
    try:
        page = LandingPage.objects.get(slug=slug)
        # Atomically increment views count
        LandingPage.objects.filter(id=page.id).update(views_count=models.F("views_count") + 1)
        page.refresh_from_db()

        # Find shortcodes in HTML like {{form_abc123}}
        shortcodes = re.findall(r"\{\{(form_[a-zA-Z0-9_-]+)\}\}", page.html_content)
        forms_data = []
        if shortcodes:
            forms = CustomForm.objects.filter(shortcode__in=shortcodes)
            forms_data = CustomFormSerializer(forms, many=True).data

        return Response({
            "id": page.id,
            "title": page.title,
            "slug": page.slug,
            "html_content": page.html_content,
            "views_count": page.views_count,
            "forms": forms_data,
        })
    except LandingPage.DoesNotExist:
        return Response({"error": "Landing page not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
@permission_classes([AllowAny])
@xframe_options_exempt
def public_landing_page_html(request, slug):
    """
    Public Endpoint: Directly serves the standalone HTML page with 100% full visual fidelity,
    supporting external stylesheets, inline scripts, tailwind, etc., while dynamically injecting 
    the interactive form in place of shortcodes.
    """
    try:
        page = LandingPage.objects.get(slug=slug)
        # Atomically increment views count
        LandingPage.objects.filter(id=page.id).update(views_count=models.F("views_count") + 1)
        page.refresh_from_db()

        # Find shortcodes in HTML like {{form_abc123}}
        shortcodes = re.findall(r"\{\{(form_[a-zA-Z0-9_-]+)\}\}", page.html_content)
        rendered_html = page.html_content

        for sc in shortcodes:
            form_obj = CustomForm.objects.filter(shortcode=sc).first()
            if form_obj:
                # Generate standalone HTML/JS form
                fields_html = ""
                for idx, f in enumerate(form_obj.fields_schema or []):
                    f_id = f.get("id") or f.get("label") or f"f_{idx}"
                    f_label = f.get("label", "Field")
                    f_req = "required" if f.get("required") else ""
                    f_req_mark = '<span style="color:#ef4444;">*</span>' if f.get("required") else ""
                    f_type = f.get("type", "text")
                    f_ph = f.get("placeholder", "")

                    if f_type == "textarea":
                        input_html = f'<textarea name="{f_id}" placeholder="{f_ph}" {f_req} rows="3" style="width:100%;box-sizing:border-box;padding:10px 14px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#f8fafc;font-size:14px;resize:none;outline:none;margin-top:4px;"></textarea>'
                    elif f_type == "select":
                        opts = "".join([f'<option value="{opt}">{opt}</option>' for opt in (f.get("options") or [])])
                        input_html = f'<select name="{f_id}" {f_req} style="width:100%;box-sizing:border-box;padding:10px 14px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#f8fafc;font-size:14px;outline:none;margin-top:4px;"><option value="">Select option...</option>{opts}</select>'
                    else:
                        input_html = f'<input type="{f_type}" name="{f_id}" placeholder="{f_ph}" {f_req} style="width:100%;box-sizing:border-box;padding:10px 14px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#f8fafc;font-size:14px;outline:none;margin-top:4px;" />'

                    fields_html += f'''
                    <div style="margin-bottom:14px;text-align:left;">
                        <label style="display:block;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;margin-bottom:4px;">
                            {f_label} {f_req_mark}
                        </label>
                        {input_html}
                    </div>
                    '''

                form_markup = f'''
                <div id="embed-form-{sc}" style="max-width:540px;margin:28px auto;padding:28px;background:rgba(15,23,42,0.95);border:1px solid #334155;border-radius:16px;box-shadow:0 20px 40px -15px rgba(0,0,0,0.5);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f8fafc;box-sizing:border-box;">
                    <h3 style="margin:0 0 16px 0;font-size:18px;font-weight:700;color:#ffffff;text-align:left;border-bottom:1px solid #1e293b;padding-bottom:10px;">{form_obj.name}</h3>
                    <form id="form-{sc}" onsubmit="handleEmbedSubmit(event, '{sc}', {page.id});">
                        {fields_html}
                        <button type="submit" id="btn-{sc}" style="width:100%;margin-top:8px;padding:12px 20px;border-radius:8px;border:none;background:#ffffff;color:#0f172a;font-weight:700;font-size:14px;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 12px rgba(255,255,255,0.15);">
                            {form_obj.button_text or "Submit"}
                        </button>
                    </form>
                    <div id="msg-{sc}" style="display:none;padding:16px;margin-top:14px;border-radius:8px;font-size:14px;font-weight:600;text-align:center;"></div>
                </div>
                '''
                rendered_html = rendered_html.replace(f"{{{{{sc}}}}}", form_markup)
            else:
                rendered_html = rendered_html.replace(f"{{{{{sc}}}}}", "")

        # Inject submission script right before </body>
        injection_script = f'''
        <script>
        async function handleEmbedSubmit(event, shortcode, landingPageId) {{
            event.preventDefault();
            const form = event.target;
            const btn = document.getElementById("btn-" + shortcode);
            const msgBox = document.getElementById("msg-" + shortcode);
            
            const formData = new FormData(form);
            const dataObj = {{}};
            formData.forEach((val, key) => {{ dataObj[key] = val; }});

            btn.disabled = true;
            btn.innerText = "Submitting...";

            try {{
                const res = await fetch("/api/public/form-submit/" + shortcode + "/", {{
                    method: "POST",
                    headers: {{ "Content-Type": "application/json" }},
                    body: JSON.stringify({{ landing_page_id: landingPageId, data: dataObj }})
                }});
                const resData = await res.json();
                if (res.ok) {{
                    form.style.display = "none";
                    msgBox.style.display = "block";
                    msgBox.style.background = "rgba(16, 185, 129, 0.15)";
                    msgBox.style.color = "#34d399";
                    msgBox.style.border = "1px solid rgba(16, 185, 129, 0.3)";
                    msgBox.innerText = resData.message || "Thank you! Submission received.";
                    if (resData.redirect_url) {{
                        setTimeout(() => {{ window.location.href = resData.redirect_url; }}, 1500);
                    }}
                }} else {{
                    alert(resData.error || "Submission error. Please try again.");
                    btn.disabled = false;
                    btn.innerText = "Submit";
                }}
            }} catch (err) {{
                alert("Network error submitting form.");
                btn.disabled = false;
                btn.innerText = "Submit";
            }}
        }}
        </script>
        '''

        # Inject floating chatbot widget if enabled
        chatbot_injection = ""
        landing_page = page
        if getattr(landing_page, "chatbot_enabled", True):
            bot_name = (landing_page.chatbot_name or "AI Sales Assistant").replace('"', '&quot;')
            welcome_msg = (landing_page.chatbot_welcome_message or "Hi there! 👋 Before we begin, may I know your name?").replace('"', '&quot;')
            landing_slug = landing_page.slug
            chatbot_injection = f'''
            <!-- ReachEngine Floating Animated Chatbot Widget -->
            <style>
            #re-chatbot-root {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                z-index: 9999999;
                position: fixed;
                bottom: 24px;
                right: 24px;
            }}
            #re-chatbot-launcher {{
                display: inline-flex;
                align-items: center;
                gap: 10px;
                background: #14181C;
                color: #FFFFFF;
                border: 1px solid #2C353D;
                padding: 10px 18px;
                border-radius: 9999px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.06);
                animation: re-chat-float 2.8s ease-in-out infinite;
                transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s, border-color 0.2s, background 0.2s;
                user-select: none;
                outline: none;
            }}
            #re-chatbot-launcher:hover {{
                transform: translateY(-3px) scale(1.03);
                border-color: rgba(255, 255, 255, 0.3);
                box-shadow: 0 14px 36px rgba(0, 0, 0, 0.65), 0 0 20px rgba(16, 185, 129, 0.25);
                background: #1B2127;
            }}
            #re-chatbot-launcher:active {{
                transform: translateY(0) scale(0.98);
            }}
            @keyframes re-chat-float {{
                0%, 100% {{ transform: translateY(0); }}
                50% {{ transform: translateY(-5px); }}
            }}
            .re-live-indicator {{
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 8px;
                height: 8px;
            }}
            .re-live-dot {{
                width: 8px;
                height: 8px;
                background: #10B981;
                border-radius: 50%;
            }}
            .re-live-ring {{
                position: absolute;
                inset: -3px;
                border-radius: 50%;
                border: 2px solid #10B981;
                animation: re-live-pulse 2s infinite ease-out;
            }}
            @keyframes re-live-pulse {{
                0% {{ transform: scale(0.8); opacity: 0.9; }}
                100% {{ transform: scale(2.2); opacity: 0; }}
            }}
            .re-chat-icon {{
                color: #FFFFFF;
                flex-shrink: 0;
            }}
            .re-launcher-text {{
                font-size: 13px;
                font-weight: 600;
                letter-spacing: -0.01em;
                color: #FFFFFF;
                white-space: nowrap;
            }}
            #re-chatbot-window {{
                display: none;
                position: fixed;
                bottom: 90px;
                right: 24px;
                width: 360px;
                max-width: calc(100vw - 32px);
                height: 500px;
                max-height: calc(100vh - 120px);
                background: #161B1F;
                border: 1px solid #2C353D;
                border-radius: 16px;
                box-shadow: 0 24px 48px rgba(0,0,0,0.65);
                flex-direction: column;
                overflow: hidden;
                z-index: 9999999;
            }}
            #re-chatbot-header {{
                padding: 12px 16px;
                background: #1C2227;
                border-bottom: 1px solid #2C353D;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }}
            .re-bot-avatar {{
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: #2A333C;
                color: #FFF;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 13px;
                position: relative;
            }}
            .re-bot-dot {{
                width: 8px;
                height: 8px;
                background: #10B981;
                border: 2px solid #1C2227;
                border-radius: 50%;
                position: absolute;
                bottom: 0;
                right: 0;
            }}
            #re-chatbot-close {{
                background: transparent;
                border: none;
                color: #8E9BA8;
                font-size: 18px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 6px;
            }}
            #re-chatbot-close:hover {{
                color: #FFF;
                background: #2C353D;
            }}
            #re-chatbot-messages {{
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                background: #12161A;
            }}
            .re-msg {{
                max-width: 82%;
                padding: 10px 14px;
                font-size: 13px;
                line-height: 1.45;
                word-wrap: break-word;
            }}
            .re-msg-bot {{
                background: #222930;
                color: #F1F5F9;
                border: 1px solid #2C353D;
                border-radius: 14px 14px 14px 3px;
                align-self: flex-start;
            }}
            .re-msg-user {{
                background: #FFFFFF;
                color: #161B1F;
                font-weight: 500;
                border-radius: 14px 14px 3px 14px;
                align-self: flex-end;
            }}
            #re-chatbot-typing {{
                display: none;
                align-self: flex-start;
                background: #222930;
                border: 1px solid #2C353D;
                border-radius: 14px 14px 14px 3px;
                padding: 8px 12px;
                gap: 4px;
            }}
            .re-dot {{
                width: 5px;
                height: 5px;
                background: #8E9BA8;
                border-radius: 50%;
                animation: re-typing-bounce 1.4s infinite ease-in-out both;
            }}
            .re-dot:nth-child(1) {{ animation-delay: -0.32s; }}
            .re-dot:nth-child(2) {{ animation-delay: -0.16s; }}
            @keyframes re-typing-bounce {{
                0%, 80%, 100% {{ transform: scale(0); }}
                40% {{ transform: scale(1); }}
            }}
            #re-chatbot-footer {{
                padding: 10px 12px;
                background: #1A2026;
                border-top: 1px solid #2C353D;
                display: flex;
                gap: 8px;
            }}
            #re-chatbot-input {{
                flex: 1;
                background: #12161A;
                border: 1px solid #2C353D;
                border-radius: 8px;
                padding: 8px 12px;
                color: #FFF;
                font-size: 13px;
                outline: none;
            }}
            #re-chatbot-input:focus {{
                border-color: #64748B;
            }}
            #re-chatbot-send {{
                background: #FFFFFF;
                color: #161B1F;
                border: none;
                border-radius: 8px;
                padding: 0 12px;
                font-weight: bold;
                font-size: 13px;
                cursor: pointer;
            }}
            #re-chatbot-send:hover {{
                background: #CBD5E1;
            }}
            </style>

            <div id="re-chatbot-root">
                <!-- Single Floating Animated Black Launcher Button -->
                <button id="re-chatbot-launcher" onclick="toggleReChat()" type="button" aria-label="Open Chat">
                    <span class="re-live-indicator">
                        <span class="re-live-dot"></span>
                        <span class="re-live-ring"></span>
                    </span>
                    <svg class="re-chat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span class="re-launcher-text">Chat with us</span>
                </button>

                <!-- Chat Window -->
                <div id="re-chatbot-window">
                    <div id="re-chatbot-header">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <div class="re-bot-avatar">
                                🤖
                                <div class="re-bot-dot"></div>
                            </div>
                            <div>
                                <div style="color:#FFF;font-size:13px;font-weight:bold;">{bot_name}</div>
                                <div style="color:#10B981;font-size:10px;font-weight:500;">Online & Ready</div>
                            </div>
                        </div>
                        <button id="re-chatbot-close" onclick="toggleReChat()">✕</button>
                    </div>

                    <div id="re-chatbot-messages">
                        <div class="re-msg re-msg-bot">{welcome_msg}</div>
                        <div id="re-chatbot-typing">
                            <div class="re-dot"></div>
                            <div class="re-dot"></div>
                            <div class="re-dot"></div>
                        </div>
                    </div>

                    <form id="re-chatbot-footer" onsubmit="handleReChatSend(event)">
                        <input id="re-chatbot-input" type="text" placeholder="Type your response..." autocomplete="off" required />
                        <button id="re-chatbot-send" type="submit">Send</button>
                    </form>
                </div>
            </div>

            <script>
            let reChatOpen = false;
            let reStep = 0; // 0: ask name, 1: ask email, 2: Q&A with Laya
            let reLeadName = "";
            let reLeadEmail = "";
            let reSubmissionId = null;
            let reHistory = [];

            function toggleReChat() {{
                reChatOpen = !reChatOpen;
                const win = document.getElementById("re-chatbot-window");
                const launcher = document.getElementById("re-chatbot-launcher");
                if (reChatOpen) {{
                    win.style.display = "flex";
                    launcher.style.display = "none";
                    document.getElementById("re-chatbot-input").focus();
                }} else {{
                    win.style.display = "none";
                    launcher.style.display = "inline-flex";
                }}
            }}

            function appendReMsg(text, sender) {{
                const box = document.getElementById("re-chatbot-messages");
                const typing = document.getElementById("re-chatbot-typing");
                const div = document.createElement("div");
                div.className = "re-msg " + (sender === "user" ? "re-msg-user" : "re-msg-bot");
                div.innerText = text;
                box.insertBefore(div, typing);
                box.scrollTop = box.scrollHeight;
                reHistory.push({{ role: sender === "user" ? "user" : "assistant", content: text }});
            }}

            function setReTyping(show) {{
                const typing = document.getElementById("re-chatbot-typing");
                const box = document.getElementById("re-chatbot-messages");
                typing.style.display = show ? "flex" : "none";
                box.scrollTop = box.scrollHeight;
            }}

            async function handleReChatSend(e) {{
                e.preventDefault();
                const input = document.getElementById("re-chatbot-input");
                const text = input.value.trim();
                if (!text) return;
                input.value = "";
                appendReMsg(text, "user");

                if (reStep === 0) {{
                    // Visitor provided Name
                    reLeadName = text;
                    reStep = 1;
                    setTimeout(() => {{
                        appendReMsg("Nice to meet you, " + reLeadName + "! What's your email address so our team can follow up with details?", "bot");
                        input.placeholder = "e.g., name@domain.com";
                    }}, 400);
                }} else if (reStep === 1) {{
                    // Visitor provided Email
                    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
                    if (!emailRegex.test(text)) {{
                        setTimeout(() => {{
                            appendReMsg("Please enter a valid email address (e.g. name@domain.com) so we can stay in touch.", "bot");
                        }}, 300);
                        return;
                    }}
                    reLeadEmail = text;
                    reStep = 2;
                    setReTyping(true);
                    input.placeholder = "Ask me anything about our product...";

                    try {{
                        const res = await fetch("/api/public/chat/{landing_slug}/", {{
                            method: "POST",
                            headers: {{ "Content-Type": "application/json" }},
                            body: JSON.stringify({{
                                lead_data: {{ name: reLeadName, email: reLeadEmail }},
                                history: reHistory,
                                message: ""
                            }})
                        }});
                        const data = await res.json();
                        if (data.submission_id) reSubmissionId = data.submission_id;
                        setReTyping(false);
                        appendReMsg("Thanks " + reLeadName + "! Your details are saved. Ask me anything about our product, pricing, or features!", "bot");
                    }} catch (err) {{
                        setReTyping(false);
                        appendReMsg("Thanks " + reLeadName + "! What questions do you have about our product?", "bot");
                    }}
                }} else {{
                    // Q&A via Laya API
                    setReTyping(true);
                    try {{
                        const res = await fetch("/api/public/chat/{landing_slug}/", {{
                            method: "POST",
                            headers: {{ "Content-Type": "application/json" }},
                            body: JSON.stringify({{
                                message: text,
                                lead_data: {{ name: reLeadName, email: reLeadEmail }},
                                submission_id: reSubmissionId,
                                history: reHistory
                            }})
                        }});
                        const data = await res.json();
                        setReTyping(false);
                        if (data.reply) {{
                            appendReMsg(data.reply, "bot");
                        }} else {{
                            appendReMsg("Thanks for your question! A member of our team will follow up via email with complete details.", "bot");
                        }}
                    }} catch (err) {{
                        setReTyping(false);
                        appendReMsg("Our team has noted your question and will follow up with you at " + (reLeadEmail || "your email") + " shortly!", "bot");
                    }}
                }}
            }}
            </script>
            '''

        full_injection = injection_script + "\n" + chatbot_injection
        if "</body>" in rendered_html:
            rendered_html = rendered_html.replace("</body>", f"{full_injection}</body>")
        else:
            rendered_html += full_injection

        return HttpResponse(rendered_html, content_type="text/html; charset=utf-8")

    except LandingPage.DoesNotExist:
        return HttpResponse("<h1>404 - Landing Page Not Found</h1>", status=404, content_type="text/html")
    except Exception as e:
        import traceback
        traceback.print_exc()
        return HttpResponse(f"<h1>500 - Internal Server Error</h1><p>{str(e)}</p>", status=500, content_type="text/html")


@api_view(["POST"])
@permission_classes([AllowAny])
def public_landing_chat(request, slug):
    """
    Public conversational chatbot endpoint for landing pages.
    Handles conversational lead capture (saving Name & Email) and
    answers visitor questions using Laya AI + the product script.
    """
    try:
        landing_page = LandingPage.objects.get(slug=slug)
    except LandingPage.DoesNotExist:
        return Response({"error": "Landing page not found"}, status=status.HTTP_404_NOT_FOUND)

    message = request.data.get("message", "").strip()
    history = request.data.get("history", [])
    lead_data = request.data.get("lead_data", {})
    submission_id = request.data.get("submission_id")
    visitor_name = lead_data.get("name", "")
    visitor_email = lead_data.get("email", "")

    submission = None
    if submission_id:
        try:
            submission = FormSubmission.objects.get(id=submission_id, landing_page=landing_page)
        except FormSubmission.DoesNotExist:
            submission = None

    # If lead email was provided and no submission exists yet, create FormSubmission
    if visitor_email and not submission:
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        ip = x_forwarded_for.split(",")[0] if x_forwarded_for else request.META.get("REMOTE_ADDR")
        user_agent = request.META.get("HTTP_USER_AGENT", "")

        sub_data = {
            "name": visitor_name,
            "email": visitor_email,
            "source": "chatbot",
            "chat_history": history + ([{"role": "user", "text": message}] if message else [])
        }

        # Evaluate qualification via Laya
        eval_res = {}
        try:
            eval_res = LayaAIService.evaluate_lead_qualification(sub_data)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Lead qualification failed for chat lead: %s", e)

        submission = FormSubmission.objects.create(
            landing_page=landing_page,
            form=None,
            data=sub_data,
            ip_address=ip,
            user_agent=user_agent,
            qualification_status=eval_res.get("status", "unprocessed"),
            qualification_score=eval_res.get("score", 0),
            is_qualified=eval_res.get("is_qualified", False),
            qualification_reason=eval_res.get("reason", "Lead captured via interactive AI Chatbot"),
        )
    elif submission:
        sub_data = submission.data or {}
        if visitor_name:
            sub_data["name"] = visitor_name
        if visitor_email:
            sub_data["email"] = visitor_email
        sub_data["chat_history"] = history + ([{"role": "user", "text": message}] if message else [])
        submission.data = sub_data
        submission.save(update_fields=["data"])

    # If message is empty (just saving lead), return confirmation
    if not message:
        name_str = f" {visitor_name}" if visitor_name else ""
        return Response({
            "success": True,
            "reply": f"Thanks{name_str}! Your details have been saved. How can I help you today? Ask me anything about our product or services!",
            "submission_id": submission.id if submission else None,
            "lead_saved": bool(submission)
        })

    # Generate answer via Laya AI using the product script
    product_script = landing_page.chatbot_script or ""
    ai_reply = LayaAIService.answer_landing_page_chat(
        product_script=product_script,
        conversation_history=history,
        user_message=message,
        visitor_name=visitor_name
    )

    return Response({
        "success": True,
        "reply": ai_reply,
        "submission_id": submission.id if submission else None,
        "lead_saved": bool(submission)
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def public_form_submit(request, shortcode):
    """
    Public API: Submits form entries from a public landing page.
    """
    try:
        form = CustomForm.objects.get(shortcode=shortcode)
    except CustomForm.DoesNotExist:
        return Response({"error": "Form not found"}, status=status.HTTP_404_NOT_FOUND)

    landing_page_id = request.data.get("landing_page_id")
    landing_page = None
    if landing_page_id:
        try:
            landing_page = LandingPage.objects.get(id=landing_page_id)
        except LandingPage.DoesNotExist:
            pass

    submitted_data = request.data.get("data", {})
    if not isinstance(submitted_data, dict):
        return Response({"error": "Invalid form payload"}, status=status.HTTP_400_BAD_REQUEST)

    # Get client IP
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0]
    else:
        ip = request.META.get("REMOTE_ADDR")

    user_agent = request.META.get("HTTP_USER_AGENT", "")

    # Run AI Lead Qualification Pipeline (Laya + Llama)
    eval_res = {}
    try:
        eval_res = LayaAIService.evaluate_lead_qualification(submitted_data)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Failed to evaluate lead qualification: %s", e)

    submission = FormSubmission.objects.create(
        landing_page=landing_page,
        form=form,
        data=submitted_data,
        ip_address=ip,
        user_agent=user_agent,
        qualification_status=eval_res.get("status", "unprocessed"),
        qualification_score=eval_res.get("score", 0),
        is_qualified=eval_res.get("is_qualified", False),
        qualification_reason=eval_res.get("reason", ""),
    )

    return Response({
        "success": True,
        "message": form.success_message,
        "redirect_url": form.redirect_url or None,
        "submission_id": submission.id,
    }, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def scrape_leads(request):
    """
    Endpoint to trigger live Bing Local / Maps lead extraction and website contact scraping.
    Accepts: { query: 'Dentists', location: 'Austin, TX', limit: 20 }
    """
    import asyncio
    from .scraper import scrape_bing_leads

    query = request.data.get("query", "").strip()
    location = request.data.get("location", "").strip()
    limit = int(request.data.get("limit", 50))
    offset = int(request.data.get("offset", 0))
    exclude_domains = request.data.get("exclude_domains", [])

    if not query:
        return Response({"error": "Keyword / Query is required."}, status=status.HTTP_400_BAD_REQUEST)

    limit = max(1, min(limit, 100))

    try:
        leads = asyncio.run(scrape_bing_leads(
            query=query,
            location=location,
            limit=limit,
            offset=offset,
            exclude_domains=exclude_domains
        ))
        return Response({
            "success": True,
            "total_found": len(leads),
            "leads": leads,
            "offset": offset,
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": f"Scraping failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def qualify_scraped_leads(request):
    """
    Separate Mechanism: Evaluates and qualifies scraped leads using Laya AI.
    Accepts: { leads: [...], target_category: 'Software & IT Companies', location: 'Mumbai' }
    Returns leads with qualification_status ('qualified' | 'disqualified'), score, and reason.
    """
    from .services.laya_service import LayaAIService

    leads = request.data.get("leads", [])
    target_category = request.data.get("target_category", "").strip()
    location = request.data.get("location", "").strip()

    if not leads or not isinstance(leads, list):
        return Response({"error": "No leads provided to qualify."}, status=status.HTTP_400_BAD_REQUEST)

    qualified_results = []
    qualified_count = 0

    for lead in leads:
        qual = LayaAIService.qualify_scraped_business(
            title=lead.get("name", ""),
            domain=lead.get("domain", ""),
            snippet=lead.get("description", ""),
            target_category=target_category,
            location=location,
            about_text=lead.get("about_text", ""),
            emails=lead.get("all_emails", [])
        )
        is_qual = qual.get("is_qualified", False)
        if is_qual:
            qualified_count += 1

        updated_lead = dict(lead)
        updated_lead["qualification_status"] = qual.get("status", "qualified" if is_qual else "disqualified")
        updated_lead["qualification_score"] = qual.get("score", 85 if is_qual else 30)
        updated_lead["qualification_reason"] = qual.get("reason", "")
        updated_lead["is_qualified"] = is_qual

        # Intelligent Contact & Decision Maker Extraction
        dm_name = qual.get("decision_maker_name", "")
        dm_title = qual.get("decision_maker_title", "")
        dm_email = qual.get("decision_maker_email", "")

        updated_lead["decision_maker_name"] = dm_name
        updated_lead["decision_maker_title"] = dm_title
        updated_lead["decision_maker_email"] = dm_email

        # If a specific personal/decision maker email was found, promote it as primary email
        if dm_email and (not updated_lead.get("email") or any(updated_lead.get("email", "").startswith(p) for p in ["info@", "support@", "admin@", "contact@"])):
            updated_lead["email"] = dm_email

        qualified_results.append(updated_lead)

    return Response({
        "success": True,
        "total": len(qualified_results),
        "qualified_count": qualified_count,
        "disqualified_count": len(qualified_results) - qualified_count,
        "leads": qualified_results,
    }, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_scraped_leads_to_csv(request):
    """
    Saves selected scraped leads directly into ReachEngine's SavedCSV collection.
    Accepts: { name: 'Austin Dentists Leads', leads: [...] }
    """
    name = request.data.get("name", "").strip()
    leads = request.data.get("leads", [])

    if not name:
        name = f"Leads - {datetime.datetime.now().strftime('%b %d, %Y %H:%M')}"

    if not leads or not isinstance(leads, list):
        return Response({"error": "No leads provided to save."}, status=status.HTTP_400_BAD_REQUEST)

    # Prepare standard CSV content with Decision Maker & Enrichment intelligence
    columns = [
        "business_name",
        "decision_maker_name",
        "decision_maker_title",
        "email",
        "linkedin_url",
        "company_size",
        "industry",
        "technologies",
        "email_pattern",
        "website",
        "domain",
        "description",
        "qualification_status",
        "qualification_score"
    ]
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(columns)

    valid_rows = 0
    for lead in leads:
        tech_str = ", ".join(lead.get("technologies", [])) if isinstance(lead.get("technologies"), list) else lead.get("technologies", "")
        writer.writerow([
            lead.get("name", ""),
            lead.get("decision_maker_name", ""),
            lead.get("decision_maker_title", ""),
            lead.get("email", ""),
            lead.get("linkedin_url", ""),
            lead.get("company_size", ""),
            lead.get("industry", ""),
            tech_str,
            lead.get("email_pattern", ""),
            lead.get("website", ""),
            lead.get("domain", ""),
            lead.get("description", "").replace("\n", " "),
            lead.get("qualification_status", ""),
            lead.get("qualification_score", ""),
        ])
        valid_rows += 1

    csv_content = output.getvalue()

    # Handle unique constraint per user & name
    base_name = name
    counter = 1
    while SavedCsv.objects.filter(user=request.user, name=name).exists():
        name = f"{base_name} ({counter})"
        counter += 1

    saved_csv = SavedCsv.objects.create(
        user=request.user,
        name=name,
        csv_content=csv_content,
        columns=columns,
        row_count=valid_rows,
    )

    return Response({
        "success": True,
        "id": saved_csv.id,
        "name": saved_csv.name,
        "row_count": saved_csv.row_count,
        "message": f"Successfully saved {valid_rows} leads into Saved CSVs!",
    }, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def enrich_scraped_leads(request):
    """
    Free Apollo-Style Lead Enrichment Layer:
    Performs deep multi-channel enrichment without any paid APIs:
    - DuckDuckGo LinkedIn dorking
    - Deep website crawl (/about, /team, /contact)
    - Wappalyzer-grade Tech detection (React, Shopify, WordPress, Stripe, etc.)
    - Smart Corporate Email Pattern discovery & verification
    - LLaMA / Laya AI profile synthesis (Decision Maker, Company Size, Industry)
    Accepts: { "lead": {...} } OR { "leads": [...] }
    """
    import asyncio
    from .services.enrichment_service import enrich_single_lead, enrich_batch_leads

    single_lead = request.data.get("lead")
    multiple_leads = request.data.get("leads")

    if single_lead and isinstance(single_lead, dict):
        try:
            enriched = asyncio.run(enrich_single_lead(single_lead))
            return Response({"success": True, "lead": enriched}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"Enrichment failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    if multiple_leads and isinstance(multiple_leads, list):
        if len(multiple_leads) > 50:
            return Response({"error": "Cannot enrich more than 50 leads at once."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            enriched_list = asyncio.run(enrich_batch_leads(multiple_leads, max_concurrent=5))
            return Response({
                "success": True,
                "total": len(enriched_list),
                "leads": enriched_list
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"Batch enrichment failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({"error": "Must provide 'lead' object or 'leads' list to enrich."}, status=status.HTTP_400_BAD_REQUEST)



