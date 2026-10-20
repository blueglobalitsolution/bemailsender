from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TemplateViewSet,
    IdentityViewSet,
    IdentityGroupViewSet,
    SavedCsvViewSet,
    CampaignViewSet,
    LogViewSet,
    InboundConfigurationViewSet,
    ReceivedEmailViewSet,
    CustomFormViewSet,
    LandingPageViewSet,
    ChatbotScriptViewSet,
    SuppressionViewSet,
    public_landing_page_data,
    public_landing_page_html,
    public_landing_chat,
    public_form_submit,
    public_unsubscribe,
    inbound_webhook,
    health_check,
    check_spam_score,
    ai_generate_email,
    track_open,
    verify_emails,
    check_bounces,
    scan_csv,
    get_analytics,
    scrape_leads,
    qualify_scraped_leads,
    enrich_scraped_leads,
    save_scraped_leads_to_csv,
)

router = DefaultRouter()
router.register(r"templates", TemplateViewSet, basename="template")
router.register(r"identities", IdentityViewSet, basename="identity")
router.register(r"identity-groups", IdentityGroupViewSet, basename="identitygroup")
router.register(r"saved-csvs", SavedCsvViewSet, basename="savedcsv")
router.register(r"campaigns", CampaignViewSet, basename="campaign")
router.register(r"suppressions", SuppressionViewSet, basename="suppression")
router.register(r"logs", LogViewSet, basename="log")
router.register(r"inbound/configs", InboundConfigurationViewSet, basename="inboundconfig")
router.register(r"inbound/emails", ReceivedEmailViewSet, basename="receivedemail")
router.register(r"forms", CustomFormViewSet, basename="customform")
router.register(r"landing-pages", LandingPageViewSet, basename="landingpage")
router.register(r"chatbot-scripts", ChatbotScriptViewSet, basename="chatbotscript")

urlpatterns = [
    path("health/", health_check, name="health_check"),
    path("analytics/", get_analytics, name="analytics"),
    path("templates/check-spam/", check_spam_score, name="check-spam"),
    path("ai/generate-email/", ai_generate_email, name="ai-generate-email"),
    path("track/open/<int:campaign_id>/<str:recipient>/", track_open, name="track-open"),
    path("unsubscribe/<int:campaign_id>/<str:recipient>/", public_unsubscribe, name="public-unsubscribe"),
    path("campaigns/verify-emails/", verify_emails, name="verify-emails"),
    path("campaigns/check-bounces/", check_bounces, name="check-bounces"),
    path("campaigns/scan-csv/", scan_csv, name="scan-csv"),
    path("scraper/search/", scrape_leads, name="scrape-leads"),
    path("scraper/qualify/", qualify_scraped_leads, name="qualify-scraped-leads"),
    path("scraper/enrich/", enrich_scraped_leads, name="enrich-scraped-leads"),
    path("scraper/save-csv/", save_scraped_leads_to_csv, name="save-scraped-leads-csv"),
    path("inbound/webhook/<str:token>/", inbound_webhook, name="inbound-webhook"),
    path("public/page/<slug:slug>/", public_landing_page_data, name="public-landing-page"),
    path("public/html/<slug:slug>/", public_landing_page_html, name="public-landing-page-html"),
    path("public/chat/<slug:slug>/", public_landing_chat, name="public-landing-chat"),
    path("public/form-submit/<str:shortcode>/", public_form_submit, name="public-form-submit"),
    path("", include(router.urls)),
]

