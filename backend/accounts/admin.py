from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("email", "username", "is_staff", "recipient_cooldown_days")
    fieldsets = UserAdmin.fieldsets + (
        (
            "Campaign settings",
            {
                "fields": ("recipient_cooldown_days",),
                "description": (
                    "Same recipient is not emailed again by this account within "
                    "this many days. Set 0 to disable the cooldown."
                ),
            },
        ),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Campaign settings", {"fields": ("recipient_cooldown_days",)}),
    )
