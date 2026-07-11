from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TemplateViewSet, IdentityViewSet, IdentityGroupViewSet, SavedCsvViewSet, CampaignViewSet, LogViewSet, health_check, check_spam_score, track_open, verify_emails, check_bounces, scan_csv

router = DefaultRouter()
router.register(r"templates", TemplateViewSet, basename="template")
router.register(r"identities", IdentityViewSet, basename="identity")
router.register(r"identity-groups", IdentityGroupViewSet, basename="identitygroup")
router.register(r"saved-csvs", SavedCsvViewSet, basename="savedcsv")
router.register(r"campaigns", CampaignViewSet, basename="campaign")
router.register(r"logs", LogViewSet, basename="log")

urlpatterns = [
    path("health/", health_check, name="health_check"),
    path("templates/check-spam/", check_spam_score, name="check-spam"),
    path("track/open/<int:campaign_id>/<str:recipient>/", track_open, name="track-open"),
    path("campaigns/verify-emails/", verify_emails, name="verify-emails"),
    path("campaigns/check-bounces/", check_bounces, name="check-bounces"),
    path("campaigns/scan-csv/", scan_csv, name="scan-csv"),
    path("", include(router.urls)),
]
