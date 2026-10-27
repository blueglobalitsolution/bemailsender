from django.urls import path
from .views import (
    GmapsStartSessionView,
    GmapsCollectView,
    GmapsStreamView,
    GmapsEnrichView,
    GmapsStopSessionView,
)

urlpatterns = [
    path("start/", GmapsStartSessionView.as_view(), name="gmaps-start-session"),
    path("collect/", GmapsCollectView.as_view(), name="gmaps-collect"),
    path("stream/<str:session_id>/", GmapsStreamView.as_view(), name="gmaps-stream"),
    path("enrich/", GmapsEnrichView.as_view(), name="gmaps-enrich"),
    path("stop/<str:session_id>/", GmapsStopSessionView.as_view(), name="gmaps-stop-session"),
]
