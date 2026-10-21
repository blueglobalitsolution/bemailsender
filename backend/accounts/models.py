from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(unique=True)
    company_name = models.CharField(max_length=255, blank=True, default="")
    
    # Global Sending & Deliverability Safeguards
    # Recipient Cooldown Period (Days): Set to 0 to disable
    recipient_cooldown_days = models.PositiveIntegerField(default=30)
    # Business Hours / Sending Windows
    # List of active day indices [0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat]
    schedule_days = models.JSONField(default=list, blank=True)
    schedule_start_time = models.TimeField(null=True, blank=True)
    schedule_end_time = models.TimeField(null=True, blank=True)

    # Compliance & Default Unsubscribe Footer
    global_unsubscribe_text = models.TextField(
        blank=True,
        default="If you'd rather not hear from us, click here to unsubscribe.",
    )
    company_address = models.TextField(blank=True, default="")
    enforce_one_click_unsub = models.BooleanField(default=True)

    # Notifications & Alerts
    bounce_alert_threshold = models.FloatField(default=5.0)
    bounce_auto_pause = models.BooleanField(default=True)

    # Session & Security
    jwt_token_version = models.PositiveIntegerField(default=1)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        db_table = "users"

