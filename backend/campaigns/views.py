from rest_framework import status, generics, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from django.db import transaction
import json
import csv
import io
import datetime
from django.core.mail import get_connection, EmailMessage

from .models import Template, Identity, Campaign, CampaignContact, Log
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
        return Response(serializer.data)

    @action(
        detail=False, methods=["post"], parser_classes=[MultiPartParser, FormParser]
    )
    def send(self, request):
        name = request.data.get("name")
        template_id = request.data.get("templateId")
        identity_id = request.data.get("identityId")
        campaign_type = request.data.get("type", "email")
        delay_ms = request.data.get("delayMs", 1000)
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
            delay_ms=int(delay_ms) if delay_ms else 1000,
            use_gemini=use_gemini,
            status="scheduled",
            schedule_days=schedule_days,
            schedule_start_time=parsed_start,
            schedule_end_time=parsed_end,
        )

        raw_data = csv_file.read()
        try:
            decoded = raw_data.decode("utf-8")
        except UnicodeDecodeError:
            decoded = raw_data.decode("latin-1")
        reader = csv.DictReader(io.StringIO(decoded))

        contacts_to_create = []
        for row in reader:
            email = (
                row.get("email")
                or row.get("Email")
                or row.get("phone")
                or row.get("Phone")
                or row.get("recipient")
            )
            if email:
                contacts_to_create.append(
                    CampaignContact(
                        campaign=campaign, recipient=email, data=json.dumps(row)
                    )
                )

        CampaignContact.objects.bulk_create(contacts_to_create, batch_size=500)

        return Response({"message": "Campaign scheduled", "campaignId": campaign.id})


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
