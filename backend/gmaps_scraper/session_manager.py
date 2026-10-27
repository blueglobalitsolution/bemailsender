"""
In-memory Session Manager for real-time live scraping synchronization.
Allows the companion popup / extension to push leads while the frontend streams them live.
"""

import time
import uuid
from typing import Any, Dict, List, Optional


class ScrapingSession:
    def __init__(self, session_id: str, query: str = "", target_count: int = 50):
        self.session_id = session_id
        self.query = query
        self.target_count = target_count
        self.created_at = time.time()
        self.updated_at = time.time()
        self.is_active = True
        self.leads_map: Dict[str, Dict[str, Any]] = {}  # keyed by placeId or clean name
        self.seen_names: set = set()

    def add_leads(self, new_leads: List[Dict[str, Any]]) -> int:
        """Adds new leads to the session, skipping duplicates."""
        added = 0
        for lead in new_leads:
            name = (lead.get("name") or "").strip()
            place_id = lead.get("placeId") or ""
            key = place_id if place_id else name.lower()

            if not key or key in self.leads_map or (name.lower() in self.seen_names):
                continue

            self.leads_map[key] = lead
            if name:
                self.seen_names.add(name.lower())
            added += 1

        self.updated_at = time.time()
        if len(self.leads_map) >= self.target_count:
            self.is_active = False

        return added

    def get_leads(self) -> List[Dict[str, Any]]:
        return list(self.leads_map.values())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sessionId": self.session_id,
            "query": self.query,
            "targetCount": self.target_count,
            "count": len(self.leads_map),
            "isActive": self.is_active,
            "leads": self.get_leads(),
            "updatedAt": self.updated_at,
        }


class SessionManager:
    _sessions: Dict[str, ScrapingSession] = {}

    @classmethod
    def create_session(cls, query: str = "", target_count: int = 50) -> ScrapingSession:
        session_id = str(uuid.uuid4())[:8]
        session = ScrapingSession(session_id, query=query, target_count=target_count)
        cls._sessions[session_id] = session
        cls._cleanup_old_sessions()
        return session

    @classmethod
    def get_session(cls, session_id: str) -> Optional[ScrapingSession]:
        return cls._sessions.get(session_id)

    @classmethod
    def stop_session(cls, session_id: str) -> Optional[ScrapingSession]:
        session = cls.get_session(session_id)
        if session:
            session.is_active = False
            session.updated_at = time.time()
        return session

    @classmethod
    def _cleanup_old_sessions(cls):
        """Removes sessions older than 3 hours."""
        now = time.time()
        expired = [sid for sid, s in cls._sessions.items() if now - s.created_at > 10800]
        for sid in expired:
            del cls._sessions[sid]


# Singleton instance helpers
create_session = SessionManager.create_session
get_session = SessionManager.get_session
stop_session = SessionManager.stop_session
