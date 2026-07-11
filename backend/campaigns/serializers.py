import csv, io
from rest_framework import serializers
from .models import Template, Identity, IdentityGroup, Campaign, CampaignContact, SavedCsv, Log


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
