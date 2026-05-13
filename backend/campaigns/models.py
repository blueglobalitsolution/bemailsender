import base64
import hashlib
from django.db import models
from django.conf import settings
from cryptography.fernet import Fernet


class Template(models.Model):
    TEMPLATE_TYPE_CHOICES = [
        ("email", "Email"),
        ("whatsapp", "WhatsApp"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="templates"
    )
    name = models.CharField(max_length=255)
    subject = models.CharField(max_length=500, blank=True, null=True)
    body = models.TextField()
    type = models.CharField(
        max_length=20, choices=TEMPLATE_TYPE_CHOICES, default="email"
    )
    design = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "templates"
        unique_together = ("user", "name")
        ordering = ["-created_at"]


class Identity(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="identities"
    )
    name = models.CharField(max_length=100)
    host = models.CharField(max_length=255)
    port = models.IntegerField(default=587)
    smtp_user = models.EmailField(max_length=255)
    smtp_pass = models.CharField(max_length=500)  # Stores encrypted password
    smtp_from_name = models.CharField(max_length=255, blank=True, null=True)
    use_tls = models.BooleanField(default=True)
    use_ssl = models.BooleanField(default=False)
    last_verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def get_decrypted_password(self):
        if not self.smtp_pass:
            return ""
        try:
            key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
            f = Fernet(base64.urlsafe_b64encode(key))
            return f.decrypt(self.smtp_pass.encode()).decode()
        except:
            return self.smtp_pass

    def save(self, *args, **kwargs):
        if self.smtp_pass and not self.smtp_pass.startswith("gAAAA"):
            key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
            f = Fernet(base64.urlsafe_b64encode(key))
            self.smtp_pass = f.encrypt(self.smtp_pass.encode()).decode()
        super().save(*args, **kwargs)

    class Meta:
        db_table = "identities"
        unique_together = ("user", "name")


class Campaign(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("scheduled", "Scheduled"),
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]
    TYPE_CHOICES = [
        ("email", "Email"),
        ("whatsapp", "WhatsApp"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="campaigns"
    )
    template = models.ForeignKey(
        Template, on_delete=models.SET_NULL, null=True, blank=True
    )
    identity = models.ForeignKey(
        Identity, on_delete=models.SET_NULL, null=True, blank=True
    )
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="email")
    delay_ms = models.IntegerField(default=1000)
    use_gemini = models.BooleanField(default=False)
    schedule_days = models.JSONField(blank=True, null=True)
    schedule_start_time = models.TimeField(blank=True, null=True)
    schedule_end_time = models.TimeField(blank=True, null=True)
    total_sent = models.IntegerField(default=0)
    total_failed = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "campaigns"
        ordering = ["-created_at"]


class CampaignContact(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("sent", "Sent"),
        ("failed", "Failed"),
    ]

    campaign = models.ForeignKey(
        Campaign, on_delete=models.CASCADE, related_name="contacts"
    )
    recipient = models.CharField(max_length=255)
    data = models.JSONField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "campaign_contacts"
        indexes = [
            models.Index(fields=["campaign", "status"]),
        ]


class Log(models.Model):
    STATUS_CHOICES = [
        ("success", "Success"),
        ("error", "Error"),
    ]

    campaign = models.ForeignKey(
        Campaign, on_delete=models.CASCADE, related_name="logs"
    )
    recipient = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
        ]
