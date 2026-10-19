import csv, io
from rest_framework import serializers
from .models import (
    Template,
    Identity,
    IdentityGroup,
    Campaign,
    CampaignContact,
    SavedCsv,
    Log,
    InboundConfiguration,
    ReceivedEmail,
    CustomForm,
    LandingPage,
    FormSubmission,
)


class TemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = [
            "id",
            "user",
            "name",
            "subject",
            "body",
            "type",
            "design",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user", "created_at", "updated_at"]

    def validate_design(self, value):
        if value is not None:
            if not isinstance(value, dict):
                raise serializers.ValidationError("Design must be a valid JSON object.")

            t_type = self.initial_data.get("type", getattr(self.instance, "type", None))
            if t_type == "email":
                if "body" not in value and "pages" not in value:
                    raise serializers.ValidationError("Invalid email design structure.")
        return value

    def validate(self, data):
        t_type = data.get("type", getattr(self.instance, "type", None))
        if t_type == "email":
            subject = data.get("subject", getattr(self.instance, "subject", None))
            if not subject:
                raise serializers.ValidationError(
                    {"subject": "Subject is required for email templates."}
                )

        if self.instance and "type" in data and data["type"] != self.instance.type:
            raise serializers.ValidationError(
                {"type": "Template type cannot be changed after creation."}
            )

        return data

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.design:
            data["design"] = instance.design
        return data


class IdentitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Identity
        fields = [
            "id",
            "name",
            "host",
            "port",
            "smtp_user",
            "smtp_pass",
            "smtp_from_name",
            "smtp_from_email",
            "use_tls",
            "use_ssl",
            "daily_limit",
            "daily_sent",
            "daily_date",
            "last_verified_at",
            "created_at",
        ]
        read_only_fields = ["id", "daily_sent", "daily_date", "last_verified_at", "created_at"]
        extra_kwargs = {"smtp_pass": {"write_only": True}}


class IdentityGroupSerializer(serializers.ModelSerializer):
    identities = IdentitySerializer(many=True, read_only=True)
    identity_ids = serializers.ListField(write_only=True, child=serializers.IntegerField())

    class Meta:
        model = IdentityGroup
        fields = ["id", "name", "identities", "identity_ids", "created_at"]
        read_only_fields = ["id", "identities", "created_at"]

    def create(self, validated_data):
        identity_ids = validated_data.pop("identity_ids")
        group = IdentityGroup.objects.create(**validated_data)
        group.identities.set(Identity.objects.filter(id__in=identity_ids))
        return group

    def update(self, instance, validated_data):
        identity_ids = validated_data.pop("identity_ids", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if identity_ids is not None:
            instance.identities.set(Identity.objects.filter(id__in=identity_ids))
        return instance

    def validate_port(self, value):
        if not (1 <= value <= 65535):
            raise serializers.ValidationError("Port must be between 1 and 65535.")
        return value


class CampaignContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignContact
        fields = ["id", "campaign", "recipient", "data", "status", "created_at"]
        read_only_fields = ["id", "created_at"]


class LogSerializer(serializers.ModelSerializer):
    class Meta:
        model = Log
        fields = ["id", "campaign", "recipient", "status", "message", "created_at"]
        read_only_fields = ["id", "created_at"]


class SavedCsvSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedCsv
        fields = ["id", "name", "csv_content", "columns", "row_count", "created_at"]
        read_only_fields = ["id", "columns", "row_count", "created_at"]
        extra_kwargs = {"csv_content": {"write_only": True}}

    def validate_csv_content(self, value):
        try:
            reader = csv.DictReader(io.StringIO(value))
            rows = list(reader)
            if not rows:
                raise serializers.ValidationError("CSV is empty")
            if len(rows) < 1:
                raise serializers.ValidationError("CSV must have at least one data row")
            columns = [k.strip().lower() for k in reader.fieldnames or rows[0].keys()]
            if not any(c in columns for c in ("email", "e-mail", "email_address", "emailaddress", "mail", "recipient", "phone")):
                raise serializers.ValidationError("CSV must contain an 'email' or 'phone' column")
        except Exception as e:
            if isinstance(e, serializers.ValidationError):
                raise
            raise serializers.ValidationError(f"Invalid CSV: {str(e)}")
        return value

    def create(self, validated_data):
        csv_content = validated_data["csv_content"]
        reader = csv.DictReader(io.StringIO(csv_content))
        rows = list(reader)
        columns = [k.strip().lower() for k in reader.fieldnames or rows[0].keys()]
        validated_data["columns"] = columns
        validated_data["row_count"] = len(rows)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        csv_content = validated_data.get("csv_content", instance.csv_content)
        reader = csv.DictReader(io.StringIO(csv_content))
        rows = list(reader)
        columns = [k.strip().lower() for k in reader.fieldnames or rows[0].keys()]
        validated_data["columns"] = columns
        validated_data["row_count"] = len(rows)
        return super().update(instance, validated_data)


class CampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = [
            "id",
            "user",
            "template",
            "identity",
            "identity_group",
            "name",
            "status",
            "type",
            "delay_ms",
            "use_gemini",
            "schedule_days",
            "schedule_start_time",
            "schedule_end_time",
            "total_sent",
            "total_failed",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "status",
            "identity_group",
            "total_sent",
            "total_failed",
            "created_at",
            "updated_at",
        ]


class CampaignListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = [
            "id",
            "name",
            "status",
            "type",
            "total_sent",
            "total_failed",
            "created_at",
        ]


class InboundConfigurationSerializer(serializers.ModelSerializer):
    webhook_url = serializers.SerializerMethodField()
    emails_count = serializers.SerializerMethodField()

    class Meta:
        model = InboundConfiguration
        fields = [
            "id",
            "name",
            "provider",
            "domain",
            "webhook_token",
            "secret_key",
            "is_active",
            "webhook_url",
            "emails_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "webhook_token", "webhook_url", "emails_count", "created_at", "updated_at"]

    def get_webhook_url(self, obj):
        request = self.context.get("request")
        path = f"/api/inbound/webhook/{obj.webhook_token}/"
        if request:
            return request.build_absolute_uri(path)
        return path

    def get_emails_count(self, obj):
        return obj.emails.count()


class ReceivedEmailSerializer(serializers.ModelSerializer):
    campaign_name = serializers.CharField(source="campaign.name", read_only=True, default=None)
    config_name = serializers.CharField(source="config.name", read_only=True, default=None)
    provider = serializers.CharField(source="config.provider", read_only=True, default=None)

    class Meta:
        model = ReceivedEmail
        fields = [
            "id",
            "sender",
            "recipient",
            "subject",
            "body_text",
            "body_html",
            "headers",
            "is_read",
            "is_starred",
            "is_reply",
            "campaign",
            "campaign_name",
            "config",
            "config_name",
            "provider",
            "received_at",
        ]
        read_only_fields = ["id", "sender", "recipient", "subject", "body_text", "body_html", "headers", "campaign_name", "config_name", "provider", "received_at"]


class CustomFormSerializer(serializers.ModelSerializer):
    submissions_count = serializers.SerializerMethodField()

    class Meta:
        model = CustomForm
        fields = [
            "id",
            "name",
            "shortcode",
            "fields_schema",
            "button_text",
            "success_message",
            "redirect_url",
            "submissions_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "shortcode", "submissions_count", "created_at", "updated_at"]

    def get_submissions_count(self, obj):
        return obj.submissions.count()


class FormSubmissionSerializer(serializers.ModelSerializer):
    form_name = serializers.CharField(source="form.name", read_only=True)
    page_title = serializers.CharField(source="landing_page.title", read_only=True, default=None)

    class Meta:
        model = FormSubmission
        fields = [
            "id",
            "landing_page",
            "page_title",
            "form",
            "form_name",
            "data",
            "ip_address",
            "user_agent",
            "is_qualified",
            "qualification_score",
            "qualification_status",
            "qualification_reason",
            "submitted_at",
        ]
        read_only_fields = ["id", "is_qualified", "qualification_score", "qualification_status", "qualification_reason", "submitted_at"]


class LandingPageSerializer(serializers.ModelSerializer):
    public_url = serializers.SerializerMethodField()
    submissions_count = serializers.SerializerMethodField()

    class Meta:
        model = LandingPage
        fields = [
            "id",
            "title",
            "slug",
            "html_content",
            "views_count",
            "chatbot_enabled",
            "chatbot_name",
            "chatbot_welcome_message",
            "chatbot_script",
            "public_url",
            "submissions_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "views_count", "public_url", "submissions_count", "created_at", "updated_at"]

    def get_public_url(self, obj):
        request = self.context.get("request")
        path = f"/p/{obj.slug}"
        if request:
            # build frontend URL or relative path
            return request.build_absolute_uri(path)
        return path

    def get_submissions_count(self, obj):
        return obj.submissions.count()

