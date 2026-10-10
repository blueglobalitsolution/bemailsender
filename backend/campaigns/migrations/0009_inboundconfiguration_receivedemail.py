from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("campaigns", "0008_identity_smtp_from_email"),
    ]

    operations = [
        migrations.CreateModel(
            name="InboundConfiguration",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                (
                    "provider",
                    models.CharField(
                        choices=[
                            ("sendgrid", "SendGrid Inbound Parse"),
                            ("mailgun", "Mailgun Inbound Routing"),
                            ("ses", "Amazon SES Inbound"),
                            ("postmark", "Postmark Inbound"),
                            ("generic", "Generic Webhook (Custom JSON/Form)"),
                        ],
                        default="generic",
                        max_length=30,
                    ),
                ),
                ("domain", models.CharField(blank=True, max_length=255, null=True)),
                ("webhook_token", models.CharField(db_index=True, max_length=64, unique=True)),
                ("secret_key", models.CharField(blank=True, max_length=255, null=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="inbound_configs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "inbound_configurations",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="ReceivedEmail",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sender", models.CharField(max_length=255)),
                ("recipient", models.CharField(max_length=255)),
                ("subject", models.CharField(blank=True, max_length=500, null=True)),
                ("body_text", models.TextField(blank=True, null=True)),
                ("body_html", models.TextField(blank=True, null=True)),
                ("headers", models.JSONField(blank=True, null=True)),
                ("raw_payload", models.JSONField(blank=True, null=True)),
                ("is_read", models.BooleanField(default=False)),
                ("is_starred", models.BooleanField(default=False)),
                ("is_reply", models.BooleanField(default=False)),
                ("received_at", models.DateTimeField(auto_now_add=True)),
                (
                    "campaign",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="received_replies",
                        to="campaigns.campaign",
                    ),
                ),
                (
                    "config",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="emails",
                        to="campaigns.inboundconfiguration",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="received_emails",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "received_emails",
                "ordering": ["-received_at"],
            },
        ),
        migrations.AddIndex(
            model_name="receivedemail",
            index=models.Index(fields=["user", "-received_at"], name="received_em_user_id_0109ae_idx"),
        ),
        migrations.AddIndex(
            model_name="receivedemail",
            index=models.Index(fields=["sender"], name="received_em_sender_552723_idx"),
        ),
        migrations.AddIndex(
            model_name="receivedemail",
            index=models.Index(fields=["recipient"], name="received_em_recipie_aa71a5_idx"),
        ),
    ]
