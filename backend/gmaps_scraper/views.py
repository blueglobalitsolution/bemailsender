"""
Django REST Framework API views for Google Maps Scraper and Enrichment Engine.
"""

import gzip
import json
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from .enricher import run_enrichment_sync
from .parser import parse_gmaps_response
from .session_manager import create_session, get_session, stop_session


class GmapsStartSessionView(APIView):
    permission_classes = [AllowAny]
    """
    POST /api/gmaps/start/
    Starts a new live scraping session.
    Payload: { "query": "Dentists in Mumbai", "targetCount": 50 }
    """

    def post(self, request):
        query = request.data.get("query", "").strip()
        target_count = int(request.data.get("targetCount", 50))
        session = create_session(query=query, target_count=target_count)
        return Response(
            {
                "success": True,
                "sessionId": session.session_id,
                "query": session.query,
                "targetCount": session.target_count,
            },
            status=status.HTTP_201_CREATED,
        )


class GmapsCollectView(APIView):
    permission_classes = [AllowAny]
    """
    POST /api/gmaps/collect/
    Receives Google Maps raw RPC data or parsed leads from the companion window / extension.
    Payload:
      {
        "sessionId": "abc123",
        "data": [...],        # raw Google Maps array or parsed leads
        "raw": ")]}'...",     # raw string
        "enrich": true        # whether to enrich immediately
      }
    """

    def post(self, request):
        session_id = request.data.get("sessionId")
        session = get_session(session_id) if session_id else None

        raw_payload = request.data.get("data") or request.data.get("raw")
        auto_enrich = request.data.get("enrich", True)

        # 1. Parse payload if raw
        parsed_leads = []
        if isinstance(raw_payload, list) and raw_payload and isinstance(raw_payload[0], dict) and "name" in raw_payload[0]:
            # Already parsed leads
            parsed_leads = raw_payload
        else:
            # Check if payload is gzipped bytes / array of numbers
            if isinstance(raw_payload, list) and raw_payload and isinstance(raw_payload[0], int):
                try:
                    decompressed = gzip.decompress(bytes(raw_payload)).decode("utf-8")
                    parsed_leads = parse_gmaps_response(decompressed)
                except Exception:
                    parsed_leads = parse_gmaps_response(raw_payload)
            else:
                parsed_leads = parse_gmaps_response(raw_payload)

        # 2. Optional immediate enrichment for newly found websites
        if auto_enrich and parsed_leads:
            try:
                parsed_leads = run_enrichment_sync(parsed_leads, concurrency=8)
            except Exception as e:
                # Still keep leads even if enrichment had timeouts
                pass

        # 3. Add to session if active
        added_count = 0
        total_count = len(parsed_leads)
        is_active = False

        if session:
            added_count = session.add_leads(parsed_leads)
            total_count = len(session.leads_map)
            is_active = session.is_active

        return Response(
            {
                "success": True,
                "added": added_count,
                "total": total_count,
                "isActive": is_active,
                "leads": parsed_leads,
            },
            status=status.HTTP_200_OK,
        )


class GmapsStreamView(APIView):
    permission_classes = [AllowAny]
    """
    GET /api/gmaps/stream/<session_id>/
    Polls the real-time status of the current scraping session.
    """

    def get(self, request, session_id):
        session = get_session(session_id)
        if not session:
            return Response(
                {"success": False, "error": f"Session '{session_id}' not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(session.to_dict(), status=status.HTTP_200_OK)


class GmapsEnrichView(APIView):
    permission_classes = [AllowAny]
    """
    POST /api/gmaps/enrich/
    Enriches a list of leads with emails & social media handles on demand.
    Payload: { "leads": [...] }
    """

    def post(self, request):
        leads = request.data.get("leads", [])
        if not leads:
            return Response({"success": True, "leads": []}, status=status.HTTP_200_OK)

        enriched = run_enrichment_sync(leads, concurrency=10)
        return Response({"success": True, "leads": enriched}, status=status.HTTP_200_OK)


class GmapsStopSessionView(APIView):
    permission_classes = [AllowAny]
    """
    POST /api/gmaps/stop/<session_id>/
    Gracefully stops the active scraping session.
    """

    def post(self, request, session_id):
        session = stop_session(session_id)
        if not session:
            return Response(
                {"success": False, "error": f"Session '{session_id}' not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "success": True,
                "message": f"Session '{session_id}' stopped.",
                "totalCollected": len(session.leads_map),
            },
            status=status.HTTP_200_OK,
        )
