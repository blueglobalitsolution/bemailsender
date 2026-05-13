from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TemplateViewSet, IdentityViewSet, CampaignViewSet, LogViewSet, health_check

router = DefaultRouter()
router.register(r"templates", TemplateViewSet, basename="template")
router.register(r"identities", IdentityViewSet, basename="identity")
router.register(r"campaigns", CampaignViewSet, basename="campaign")
router.register(r"logs", LogViewSet, basename="log")

urlpatterns = [
    path("health/", health_check, name="health_check"),
    path("", include(router.urls)),
]
