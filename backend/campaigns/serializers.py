from rest_framework import serializers
from .models import Template, Identity, Campaign, CampaignContact, Log


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
            "use_tls",
            "use_ssl",
            "last_verified_at",
            "created_at",
        ]
        read_only_fields = ["id", "last_verified_at", "created_at"]
        extra_kwargs = {"smtp_pass": {"write_only": True}}

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


class CampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = [
            "id",
            "user",
            "template",
            "identity",
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
