import asyncio
import json
import logging
import re
import urllib.parse
from bs4 import BeautifulSoup
import httpx
from .laya_service import LayaAIService

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Signatures for free technology detection
TECH_SIGNATURES = {
    # CMS / Platforms
    "WordPress": [r"wp-content", r"wp-includes", r"xmlrpc\.php", r'name="generator" content="WordPress'],
    "Shopify": [r"cdn\.shopify\.com", r"Shopify\.theme", r"myshopify\.com"],
    "WooCommerce": [r"woocommerce", r"wc-ajax="],
    "Webflow": [r"assets\.website-files\.com", r"w-nav", r'data-wf-page'],
    "Wix": [r"static\.parastorage\.com", r"wix\.com", r"_wix_"],
    "Squarespace": [r"static1\.squarespace\.com", r"squarespace-headers"],
    "Ghost": [r"ghost\.org", r'name="generator" content="Ghost'],
    "HubSpot": [r"js\.hs-scripts\.com", r"hs-banner", r"hubspot\.com"],
    "Magento": [r"mage/cookies", r"static/_requirejs"],

    # Frontend Frameworks & Libraries
    "React": [r"react(?:\.production|\.min)?\.js", r'data-reactroot', r"_reactListening", r"__reactFiber"],
    "Next.js": [r"/_next/static", r"__NEXT_DATA__", r"/_next/"],
    "Vue.js": [r"vue(?:\.runtime|\.min)?\.js", r'data-v-[a-f0-9]+', r"__vue__"],
    "Nuxt.js": [r"/_nuxt/", r"__NUXT__"],
    "Angular": [r"ng-version=", r"ng-binding", r"angular(?:\.min)?\.js"],
    "Tailwind CSS": [r"tailwindcss", r"(?:flex|grid|hidden|text-sm|p-\d|m-\d|rounded-).*(?:flex|grid|hidden)"],
    "Bootstrap": [r"bootstrap(?:\.bundle|\.min)?\.js", r"bootstrap(?:\.min)?\.css"],
    "jQuery": [r"jquery(?:\.min)?\.js", r"\$j\("],

    # Analytics & Tracking
    "Google Analytics": [r"google-analytics\.com/(?:ga|analytics)\.js", r"googletagmanager\.com/gtag/js", r"gtag\("],
    "Google Tag Manager": [r"googletagmanager\.com/gtm\.js", r"dataLayer"],
    "Meta Pixel": [r"connect\.facebook\.net/[a-zA-Z_]+/fbevents\.js", r"fbq\("],
    "Hotjar": [r"static\.hotjar\.com", r"_hjSettings"],
    "Segment": [r"cdn\.segment\.com/analytics\.js", r"analytics\.page\("],
    "Clarity": [r"clarity\.ms/tag/"],

    # Payments & Conversions
    "Stripe": [r"js\.stripe\.com/v3", r"stripe\.com"],
    "Razorpay": [r"checkout\.razorpay\.com", r"Razorpay\("],
    "PayPal": [r"paypal\.com/sdk/js"],

    # Customer Support & Chat
    "Intercom": [r"widget\.intercom\.io", r"window\.Intercom"],
    "Crisp": [r"client\.crisp\.chat"],
    "Tawk.to": [r"embed\.tawk\.to"],
    "Zendesk": [r"static\.zdassets\.com", r"zE\("],

    # Infrastructure & CDN
    "Cloudflare": [r"cdnjs\.cloudflare\.com", r"__cfduid", r"cf-beacon"],
}


def detect_technologies_from_html(html: str, headers: dict = None) -> list:
    """
    Free built-in Technology Stack detector (Wappalyzer alternative).
    Inspects HTML tags, script URLs, headers, and meta tags.
    """
    if not html:
        return []

    detected = set()

    # Check response headers if present
    if headers:
        header_str = " ".join(f"{k}: {v}" for k, v in headers.items()).lower()
        if "cloudflare" in header_str:
            detected.add("Cloudflare")
        if "nginx" in header_str:
            detected.add("Nginx")
        if "apache" in header_str:
            detected.add("Apache")
        if "next" in header_str:
            detected.add("Next.js")
        if "phpsessid" in header_str or "x-powered-by: php" in header_str:
            detected.add("PHP")

    # Check regex signatures in HTML
    for tech_name, patterns in TECH_SIGNATURES.items():
        for pat in patterns:
            if re.search(pat, html, re.IGNORECASE):
                detected.add(tech_name)
                break

    return sorted(list(detected))


def extract_social_links_from_soup(soup: BeautifulSoup) -> dict:
    """
    Extracts direct social media links (LinkedIn, Twitter/X, GitHub, Facebook, Instagram)
    from website HTML.
    """
    socials = {
        "linkedin": "",
        "twitter": "",
        "github": "",
        "facebook": "",
        "instagram": "",
        "youtube": "",
    }

    if not soup:
        return socials

    for a in soup.find_all("a", href=True):
        href = a.get("href", "").strip()
        h_low = href.lower()

        if "linkedin.com/company/" in h_low or "linkedin.com/in/" in h_low:
            if not socials["linkedin"]:
                socials["linkedin"] = href
        elif "twitter.com/" in h_low or "x.com/" in h_low:
            if not socials["twitter"] and not any(skip in h_low for skip in ["intent/tweet", "share?"]):
                socials["twitter"] = href
        elif "github.com/" in h_low:
            if not socials["github"] and not any(skip in h_low for skip in ["github.com/login", "github.com/features"]):
                socials["github"] = href
        elif "facebook.com/" in h_low:
            if not socials["facebook"] and not any(skip in h_low for skip in ["sharer.php", "share"]):
                socials["facebook"] = href
        elif "instagram.com/" in h_low:
            if not socials["instagram"]:
                socials["instagram"] = href
        elif "youtube.com/" in h_low:
            if not socials["youtube"]:
                socials["youtube"] = href

    return socials


async def search_duckduckgo_free(query: str, client: httpx.AsyncClient, max_results: int = 3) -> list:
    """
    Free Search Layer using DuckDuckGo HTML endpoint (Zero API Keys / Free Forever).
    Dorks for LinkedIn profiles, corporate directories, or company news.
    """
    results = []
    try:
        url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
        resp = await client.get(
            url,
            headers={
                **HEADERS,
                "Referer": "https://duckduckgo.com/",
            },
            timeout=4.5,
        )

        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            # Result links on DDG HTML version
            result_links = soup.select(".result__body")
            for item in result_links[:max_results]:
                title_el = item.select_one(".result__title a")
                snippet_el = item.select_one(".result__snippet")
                if not title_el:
                    continue

                raw_href = title_el.get("href", "")
                # DDG uses redirect links like //duckduckgo.com/l/?uddg=https%3A%2F%2Flinkedin.com...
                actual_url = raw_href
                if "uddg=" in raw_href:
                    match = re.search(r"uddg=([^&]+)", raw_href)
                    if match:
                        actual_url = urllib.parse.unquote(match.group(1))

                title = title_el.get_text(strip=True)
                snippet = snippet_el.get_text(separator=" ", strip=True) if snippet_el else ""

                results.append({
                    "title": title,
                    "url": actual_url,
                    "snippet": snippet,
                })
    except Exception as e:
        logger.debug("DuckDuckGo free search error for '%s': %s", query, e)

    return results


async def find_linkedin_profile_free(company_name: str, domain: str, client: httpx.AsyncClient) -> dict:
    """
    Free Dorking: Searches DuckDuckGo for:
    site:linkedin.com/in ("Founder" OR "CEO" OR "Director" OR "Owner") "Company Name"
    Extracts person's name, title, and LinkedIn URL without paying for LinkedIn APIs.
    """
    info = {
        "linkedin_url": "",
        "person_name": "",
        "person_title": "",
    }

    if not company_name:
        return info

    # Clean company name
    clean_company = re.sub(r"\b(pvt|ltd|limited|inc|llc|corp)\b\.?", "", company_name, flags=re.I).strip()
    query = f'site:linkedin.com/in ("Founder" OR "CEO" OR "Managing Director" OR "Director" OR "Owner") "{clean_company}"'

    results = await search_duckduckgo_free(query, client, max_results=3)

    for res in results:
        url = res["url"]
        title = res["title"]
        snippet = res["snippet"]

        if "linkedin.com/in/" in url:
            info["linkedin_url"] = url

            # Parse person name and title from LinkedIn title format: "First Last - Founder & CEO - Company | LinkedIn"
            name_part = title.split("-")[0].split("|")[0].strip()
            # Clean off LinkedIn prefix/suffix if present
            name_part = re.sub(r"\b(on\s+LinkedIn|LinkedIn)\b", "", name_part, flags=re.I).strip()

            if name_part and len(name_part.split()) in [2, 3, 4]:
                info["person_name"] = name_part

            # Extract title (Founder, CEO, Director)
            combined = f"{title} {snippet}"
            title_match = re.search(
                r"\b(Founder\s*(?:&\s*CEO)?|Co-Founder|Chief Executive Officer|CEO|Managing Director|Director|Owner|President|Partner)\b",
                combined,
                re.I,
            )
            if title_match:
                info["person_title"] = title_match.group(1).strip()
            break

    return info


def generate_email_patterns(first_name: str, last_name: str, domain: str, existing_emails: list = None) -> dict:
    """
    Free Smart Email Pattern Engine:
    Generates standard corporate email formats for decision makers and checks if any
    already matches scraped website emails.
    """
    domain_clean = domain.replace("www.", "").lower().strip()
    f = re.sub(r"[^a-z0-9]", "", first_name.lower()) if first_name else ""
    l = re.sub(r"[^a-z0-9]", "", last_name.lower()) if last_name else ""

    patterns = []
    if f and l:
        patterns = [
            f"{f}@{domain_clean}",
            f"{f}.{l}@{domain_clean}",
            f"{f}{l}@{domain_clean}",
            f"{f[0]}.{l}@{domain_clean}",
            f"{f[0]}{l}@{domain_clean}",
            f"{f}_{l}@{domain_clean}",
        ]
    elif f:
        patterns = [f"{f}@{domain_clean}"]

    matched_email = ""
    is_verified = False

    # Check if any scraped email directly matches one of our patterns
    if existing_emails and patterns:
        existing_lower = [e.lower() for e in existing_emails]
        for p in patterns:
            if p in existing_lower:
                matched_email = p
                is_verified = True
                break

    # If no exact match, pick the top pattern as predicted
    predicted_email = matched_email or (patterns[1] if len(patterns) > 1 else (patterns[0] if patterns else ""))
    detected_pattern = "{first}.{last}@" + domain_clean if (f and l) else ("{first}@" + domain_clean if f else "")

    return {
        "email_pattern": detected_pattern,
        "predicted_email": predicted_email,
        "is_verified_match": is_verified,
        "all_candidate_patterns": patterns[:4],
    }


def estimate_company_size_and_industry(text: str, tech_list: list = None) -> dict:
    """
    Estimates company employee size range and primary industry from website text.
    """
    t_low = text.lower() if text else ""

    # Employee count estimation
    size = "1-10"
    if any(k in t_low for k in ["500+", "1000+", "enterprise", "global presence in 20+", "offices worldwide"]):
        size = "500+"
    elif any(k in t_low for k in ["200+", "100-500", "250+", "over 200 employees", "team of 150"]):
        size = "100-500"
    elif any(k in t_low for k in ["50+", "50-100", "over 50 professionals", "team of 60", "team of 70"]):
        size = "51-100"
    elif any(k in t_low for k in ["11-50", "team of 25", "team of 20", "team of 15", "over 20"]):
        size = "11-50"

    # Industry detection
    industry = "General Business"
    if any(k in t_low for k in ["dental", "dentist", "teeth", "oral care", "orthodontic"]):
        industry = "Healthcare & Dental"
    elif any(k in t_low for k in ["hospital", "clinic", "patient", "doctor", "medical", "physician"]):
        industry = "Medical & Healthcare"
    elif any(k in t_low for k in ["real estate", "property", "realtor", "apartments", "builders", "commercial property"]):
        industry = "Real Estate & Construction"
    elif any(k in t_low for k in ["software", "saas", "app development", "cloud", "ai", "machine learning", "fintech"]):
        industry = "Software & IT"
    elif any(k in t_low for k in ["marketing", "seo", "branding", "digital agency", "advertising"]):
        industry = "Digital Marketing & Advertising"
    elif any(k in t_low for k in ["law", "legal", "advocate", "attorney", "court"]):
        industry = "Legal Services"
    elif any(k in t_low for k in ["chartered accountant", "ca firm", "tax", "audit", "gst", "accounting"]):
        industry = "Financial & Accounting"
    elif any(k in t_low for k in ["manufactur", "industrial", "fabrication", "supplier", "factory"]):
        industry = "Manufacturing & Industrial"

    return {
        "company_size": size,
        "industry": industry,
    }


async def enrich_single_lead(lead_dict: dict) -> dict:
    """
    Core Free Lead Enrichment Pipeline for a single company:
    1. Deep Website Crawling (/about, /team, /contact)
    2. Wappalyzer-grade Tech Detection
    3. Social Profile Extraction (LinkedIn, Twitter, GitHub)
    4. DuckDuckGo Free Dorking for Executive LinkedIn URL
    5. Smart Email Pattern Generation
    6. LLaMA / Laya AI Synthesis for Decision Maker & Summary
    """
    company_name = lead_dict.get("name", "").strip()
    website = lead_dict.get("website", "").strip()
    domain = lead_dict.get("domain", "").strip()
    existing_email = lead_dict.get("email", "").strip()
    existing_all_emails = lead_dict.get("all_emails", []) or ([existing_email] if existing_email else [])

    if not domain and website:
        parsed = urllib.parse.urlparse(website)
        domain = parsed.netloc.replace("www.", "").lower()

    enriched = {
        **lead_dict,
        "is_enriched": True,
        "technologies": [],
        "social_links": {},
        "linkedin_url": "",
        "twitter_url": "",
        "github_url": "",
        "decision_maker_name": lead_dict.get("decision_maker_name", ""),
        "decision_maker_title": lead_dict.get("decision_maker_title", ""),
        "decision_maker_email": lead_dict.get("decision_maker_email", ""),
        "company_size": "1-10",
        "industry": lead_dict.get("industry", "Business Services"),
        "email_pattern": "",
        "predicted_email": "",
        "summary": "",
    }

    async with httpx.AsyncClient(headers=HEADERS, timeout=4.0, follow_redirects=True) as client:
        # Step 1: Deep website crawl (Homepage + /about, /team, /contact)
        html_corpus = ""
        team_text = lead_dict.get("about_text", "")
        social_links = {}
        headers_dict = {}

        if website:
            try:
                base_parsed = urllib.parse.urlparse(website)
                base_url = f"{base_parsed.scheme}://{base_parsed.netloc}"

                # Concurrently check homepage and /about
                async def fetch_page(url):
                    try:
                        r = await client.get(url, timeout=3.5)
                        if r.status_code == 200:
                            return r.text, dict(r.headers)
                    except Exception:
                        pass
                    return "", {}

                urls_to_try = [
                    website,
                    f"{base_url}/about",
                    f"{base_url}/about-us",
                    f"{base_url}/team",
                ]

                # Run first 2 pages in parallel
                resps = await asyncio.gather(*(fetch_page(u) for u in urls_to_try[:2]))
                for html_chunk, h_dict in resps:
                    if html_chunk:
                        html_corpus += " " + html_chunk
                        if not headers_dict:
                            headers_dict = h_dict
                        soup = BeautifulSoup(html_chunk, "html.parser")
                        links = extract_social_links_from_soup(soup)
                        for k, v in links.items():
                            if v and not social_links.get(k):
                                social_links[k] = v

                        # Extract team snippet if not already present
                        if not team_text:
                            paras = [p.get_text(separator=" ", strip=True) for p in soup.find_all(["p", "div", "h2", "h3"]) if len(p.get_text(strip=True)) > 25]
                            team_text = " ".join(paras[:5])[:900]
            except Exception as e:
                logger.debug("Website deep crawl error: %s", e)

        # Step 2: Tech Detection
        tech_list = detect_technologies_from_html(html_corpus, headers_dict)
        enriched["technologies"] = tech_list

        # Step 3: Social Links
        enriched["social_links"] = social_links
        enriched["linkedin_url"] = social_links.get("linkedin", "")
        enriched["twitter_url"] = social_links.get("twitter", "")
        enriched["github_url"] = social_links.get("github", "")

        # Step 4: DuckDuckGo Dorking if no direct LinkedIn found
        if not enriched["linkedin_url"]:
            ddg_info = await find_linkedin_profile_free(company_name, domain, client)
            if ddg_info.get("linkedin_url"):
                enriched["linkedin_url"] = ddg_info["linkedin_url"]
                if not enriched["decision_maker_name"] and ddg_info.get("person_name"):
                    enriched["decision_maker_name"] = ddg_info["person_name"]
                if not enriched["decision_maker_title"] and ddg_info.get("person_title"):
                    enriched["decision_maker_title"] = ddg_info["person_title"]

        # Step 5: Decision Maker & AI extraction via Laya / LLaMA
        if not enriched["decision_maker_name"] or not enriched["decision_maker_title"]:
            dm_res = LayaAIService.extract_decision_maker_and_contact(
                title=company_name,
                domain=domain,
                snippet=lead_dict.get("description", "") or lead_dict.get("snippet", ""),
                about_text=team_text,
                emails=existing_all_emails,
                target_category=lead_dict.get("target_category", "")
            )
            if dm_res.get("decision_maker_name"):
                enriched["decision_maker_name"] = dm_res["decision_maker_name"]
            if dm_res.get("decision_maker_title"):
                enriched["decision_maker_title"] = dm_res["decision_maker_title"]
            if dm_res.get("decision_maker_email"):
                enriched["decision_maker_email"] = dm_res["decision_maker_email"]

        # Step 6: Smart Email Pattern Generation
        dm_name = enriched.get("decision_maker_name", "")
        name_parts = dm_name.split()
        first_name = name_parts[0] if name_parts else ""
        last_name = name_parts[-1] if len(name_parts) > 1 else ""

        # Clean doctor/mr/ms prefixes
        if first_name.lower() in ["dr.", "dr", "mr.", "mr", "ms.", "ms", "adv.", "ca"]:
            first_name = name_parts[1] if len(name_parts) > 1 else ""
            last_name = name_parts[-1] if len(name_parts) > 2 else ""

        pattern_res = generate_email_patterns(
            first_name=first_name,
            last_name=last_name,
            domain=domain,
            existing_emails=existing_all_emails
        )

        enriched["email_pattern"] = pattern_res.get("email_pattern", "")
        enriched["predicted_email"] = pattern_res.get("predicted_email", "")

        # If decision_maker_email was empty, use the predicted verified/candidate email
        if not enriched["decision_maker_email"] and enriched["predicted_email"]:
            enriched["decision_maker_email"] = enriched["predicted_email"]

        # Step 7: Company Size & Industry Estimation
        size_ind = estimate_company_size_and_industry(f"{team_text} {lead_dict.get('description', '')}", tech_list)
        enriched["company_size"] = size_ind["company_size"]
        enriched["industry"] = size_ind["industry"]

        # Short summary
        enriched["summary"] = team_text[:280] if team_text else f"{company_name} is a leading commercial provider in {domain}."

    return enriched


async def enrich_batch_leads(leads: list, max_concurrent: int = 4) -> list:
    """
    Enriches multiple leads concurrently with a controlled semaphore for high speed.
    """
    semaphore = asyncio.Semaphore(max_concurrent)

    async def sem_enrich(lead):
        async with semaphore:
            return await enrich_single_lead(lead)

    tasks = [sem_enrich(lead) for lead in leads]
    return await asyncio.gather(*tasks)
