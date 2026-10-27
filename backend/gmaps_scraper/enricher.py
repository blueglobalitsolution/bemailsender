"""
Lead Enrichment Engine (Python port of leadEnricher.js).
Asynchronously crawls websites to discover verified emails and social media links.
"""

import asyncio
import re
from typing import Any, Dict, List, Set
from urllib.parse import urljoin, urlparse
import httpx
from bs4 import BeautifulSoup

# In-memory cache to prevent re-scraping the same domain multiple times
_enrichment_cache: Dict[str, Dict[str, Any]] = {}

BOGUS_EMAIL_EXTENSIONS = (
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js", ".woff", ".ttf"
)
IGNORED_EMAIL_DOMAINS = (
    "sentry.io", "wixpress.com", "example.com", "domain.com", "schema.org", "test.com", "noreply"
)

EMAIL_REGEX = re.compile(
    r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", re.IGNORECASE
)


def is_valid_email(email: str) -> bool:
    """Validates email format and filters out static asset and junk emails."""
    if not email or len(email) > 80:
        return False
    lower = email.lower()
    for ext in BOGUS_EMAIL_EXTENSIONS:
        if lower.endswith(ext):
            return False
    for ign in IGNORED_EMAIL_DOMAINS:
        if ign in lower:
            return False
    return bool(EMAIL_REGEX.match(email))


async def crawl_url(client: httpx.AsyncClient, target_url: str) -> Dict[str, Any]:
    """Crawls a single URL and extracts emails and social profiles."""
    result: Dict[str, Any] = {
        "emails": set(),
        "socials": {}
    }

    try:
        res = await client.get(
            target_url,
            timeout=6.0,
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        )
        if res.status_code >= 400:
            return result

        html = res.text
        soup = BeautifulSoup(html, "html.parser")

        # 1. Check mailto: links (highest accuracy)
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if href.lower().startswith("mailto:"):
                clean = href[7:].split("?")[0].strip()
                if is_valid_email(clean):
                    result["emails"].add(clean.lower())

            # 2. Check social links
            lower_href = href.lower()
            if "facebook.com/" in lower_href and "/sharer" not in lower_href and "facebook" not in result["socials"]:
                result["socials"]["facebook"] = href
            elif "instagram.com/" in lower_href and "instagram" not in result["socials"]:
                result["socials"]["instagram"] = href
            elif ("twitter.com/" in lower_href or "x.com/" in lower_href) and "/share" not in lower_href and "twitter" not in result["socials"]:
                result["socials"]["twitter"] = href
            elif "linkedin.com/company/" in lower_href and "linkedin" not in result["socials"]:
                result["socials"]["linkedin"] = href
            elif "youtube.com/" in lower_href and "youtube" not in result["socials"]:
                result["socials"]["youtube"] = href

        # 3. Regex scan for emails in raw HTML body
        for em in EMAIL_REGEX.findall(html):
            if is_valid_email(em):
                result["emails"].add(em.lower())

    except Exception:
        # Non-fatal if target domain fails to load or times out
        pass

    return result


async def enrich_single_lead(client: httpx.AsyncClient, lead: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enriches a single lead dictionary with email, email_list, and social accounts.
    """
    website = lead.get("website") or (f"http://{lead.get('domain')}" if lead.get("domain") else "")
    if not website:
        lead["email"] = ""
        lead["all_emails"] = []
        return lead

    if not (website.startswith("http://") or website.startswith("https://")):
        website = f"https://{website}"

    parsed = urlparse(website)
    cache_key = parsed.netloc.replace("www.", "")

    if cache_key in _enrichment_cache:
        cached = _enrichment_cache[cache_key]
        lead.update(cached)
        return lead

    # 1. Crawl Homepage
    scraped = await crawl_url(client, website)

    # 2. If no email found on homepage, crawl /contact or /about
    if not scraped["emails"]:
        origin = f"{parsed.scheme}://{parsed.netloc}"
        for subpath in ["/contact", "/contact-us", "/about", "/about-us"]:
            contact_url = urljoin(origin, subpath)
            sub_res = await crawl_url(client, contact_url)
            scraped["emails"].update(sub_res["emails"])
            for soc_k, soc_v in sub_res["socials"].items():
                if soc_k not in scraped["socials"]:
                    scraped["socials"][soc_k] = soc_v
            if scraped["emails"]:
                break

    all_emails = sorted(list(scraped["emails"]))
    primary_email = all_emails[0] if all_emails else ""

    enriched_data = {
        "email": primary_email,
        "all_emails": all_emails,
        "facebook": scraped["socials"].get("facebook", ""),
        "instagram": scraped["socials"].get("instagram", ""),
        "twitter": scraped["socials"].get("twitter", ""),
        "linkedin": scraped["socials"].get("linkedin", ""),
        "youtube": scraped["socials"].get("youtube", ""),
        "is_enriched": True,
    }

    _enrichment_cache[cache_key] = enriched_data
    lead.update(enriched_data)
    return lead


async def enrich_leads_batch(leads: List[Dict[str, Any]], concurrency: int = 10) -> List[Dict[str, Any]]:
    """
    Concurrently enriches a batch of leads using an async HTTP client.
    """
    if not leads:
        return []

    limits = httpx.Limits(max_keepalive_connections=20, max_connections=concurrency)
    async with httpx.AsyncClient(limits=limits, verify=False) as client:
        tasks = [enrich_single_lead(client, lead) for lead in leads]
        return await asyncio.gather(*tasks)


def run_enrichment_sync(leads: List[Dict[str, Any]], concurrency: int = 10) -> List[Dict[str, Any]]:
    """Synchronous wrapper for Django views."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_running():
        # If in an already running loop (e.g. Jupyter or ASGI)
        import nest_asyncio
        nest_asyncio.apply()
        return loop.run_until_complete(enrich_leads_batch(leads, concurrency))
    else:
        return loop.run_until_complete(enrich_leads_batch(leads, concurrency))
