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
    smtp_from_email = models.EmailField(max_length=255, blank=True, null=True)
    use_tls = models.BooleanField(default=True)
    use_ssl = models.BooleanField(default=False)
    last_verified_at = models.DateTimeField(null=True, blank=True)
    daily_limit = models.IntegerField(default=295)
    daily_sent = models.IntegerField(default=0)
    daily_date = models.DateField(null=True, blank=True)
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


class IdentityGroup(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="identity_groups"
    )
    name = models.CharField(max_length=255)
    identities = models.ManyToManyField(Identity)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "identity_groups"
        unique_together = ("user", "name")
        ordering = ["-created_at"]


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
    identity_group = models.ForeignKey(
        IdentityGroup, on_delete=models.SET_NULL, null=True, blank=True
    )
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="email")
    delay_ms = models.IntegerField(default=45000)
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


class TrackedOpen(models.Model):
    campaign = models.ForeignKey(
        Campaign, on_delete=models.CASCADE, related_name="opens"
    )
    recipient = models.CharField(max_length=255)
    opened_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "tracked_opens"
        indexes = [
            models.Index(fields=["campaign", "recipient"]),
        ]


class SavedCsv(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_csvs"
    )
    name = models.CharField(max_length=255)
    csv_content = models.TextField()
    columns = models.JSONField(default=list)
    row_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "saved_csvs"
        unique_together = ("user", "name")
        ordering = ["-created_at"]


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


class InboundConfiguration(models.Model):
    PROVIDER_CHOICES = [
        ("sendgrid", "SendGrid Inbound Parse"),
        ("mailgun", "Mailgun Inbound Routing"),
        ("ses", "Amazon SES Inbound"),
        ("postmark", "Postmark Inbound"),
        ("generic", "Generic Webhook (Custom JSON/Form)"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="inbound_configs"
    )
    name = models.CharField(max_length=255)
    provider = models.CharField(max_length=30, choices=PROVIDER_CHOICES, default="generic")
    domain = models.CharField(max_length=255, blank=True, null=True)
    webhook_token = models.CharField(max_length=64, unique=True, db_index=True)
    secret_key = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inbound_configurations"
        ordering = ["-created_at"]


class ReceivedEmail(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_emails"
    )
    config = models.ForeignKey(
        InboundConfiguration, on_delete=models.SET_NULL, null=True, blank=True, related_name="emails"
    )
    campaign = models.ForeignKey(
        Campaign, on_delete=models.SET_NULL, null=True, blank=True, related_name="received_replies"
    )
    sender = models.CharField(max_length=255)
    recipient = models.CharField(max_length=255)
    subject = models.CharField(max_length=500, blank=True, null=True)
    body_text = models.TextField(blank=True, null=True)
    body_html = models.TextField(blank=True, null=True)
    headers = models.JSONField(blank=True, null=True)
    raw_payload = models.JSONField(blank=True, null=True)
    is_read = models.BooleanField(default=False)
    is_starred = models.BooleanField(default=False)
    is_reply = models.BooleanField(default=False)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "received_emails"
        ordering = ["-received_at"]
        indexes = [
            models.Index(fields=["user", "-received_at"]),
            models.Index(fields=["sender"]),
            models.Index(fields=["recipient"]),
        ]


class CustomForm(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="custom_forms")
    name = models.CharField(max_length=255)
    shortcode = models.CharField(max_length=100, unique=True)
    # schema defines form fields e.g.: [{"id": "name", "label": "Full Name", "type": "text", "required": True}, ...]
    fields_schema = models.JSONField(default=list)
    button_text = models.CharField(max_length=100, default="Submit")
    success_message = models.CharField(max_length=255, default="Thank you! Your submission has been received.")
    redirect_url = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "custom_forms"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.shortcode})"


class LandingPage(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="landing_pages")
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=150, unique=True)
    html_content = models.TextField(help_text="Custom HTML containing form shortcode like {{form_xxx}}")
    views_count = models.PositiveIntegerField(default=0)
    # Interactive Chatbot Settings
    chatbot_enabled = models.BooleanField(default=True, help_text="Enable floating AI chatbot widget")
    chatbot_name = models.CharField(max_length=100, default="AI Sales Assistant")
    chatbot_welcome_message = models.TextField(default="Hi there! 👋 How can I help you today?")
    chatbot_script = models.TextField(blank=True, default="", help_text="Product information, pricing, and FAQ for Laya to answer visitor questions")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "landing_pages"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class FormSubmission(models.Model):
    landing_page = models.ForeignKey(
        LandingPage, on_delete=models.CASCADE, null=True, blank=True, related_name="submissions"
    )
    form = models.ForeignKey(
        CustomForm, on_delete=models.CASCADE, null=True, blank=True, related_name="submissions"
    )
    data = models.JSONField(help_text="Key-value pairs of submitted field values")
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    # AI Lead Qualification fields
    is_qualified = models.BooleanField(null=True, blank=True, help_text="True if qualified, False if disqualified, null if pending")
    qualification_score = models.IntegerField(default=0, help_text="Lead score between 0 and 100")
    qualification_status = models.CharField(max_length=50, default="unprocessed", choices=[
        ("qualified", "Qualified"),
        ("review", "Needs Review"),
        ("disqualified", "Disqualified"),
        ("unprocessed", "Unprocessed"),
    ])
    qualification_reason = models.TextField(blank=True, null=True, help_text="AI evaluation rationale from Laya + Llama")
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "form_submissions"
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"Submission for {self.form.name} at {self.submitted_at}"

