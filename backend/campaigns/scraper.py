import asyncio
import base64
import re
import urllib.parse
import httpx
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

EMAIL_REGEX = re.compile(
    r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", re.IGNORECASE
)

PHONE_REGEX = re.compile(
    r"(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?",
    re.IGNORECASE,
)

# Comprehensive list of directories, social media, aggregator and listing sites to skip
SKIP_DOMAINS = {
    # Search & Tech Giants
    "bing.com", "microsoft.com", "google.com", "yahoo.com", "duckduckgo.com", "apple.com",
    # Government & Encyclopedias
    "gov.in", "nic.in", ".gov", "wikipedia.org", "wikimedia.org",
    # Social Networks & Media
    "facebook.com", "fb.com", "instagram.com", "linkedin.com", "twitter.com", "x.com",
    "youtube.com", "pinterest.com", "reddit.com", "tiktok.com", "quora.com",
    # Health & Medical Aggregators (Indian & Global)
    "practo.com", "lybrate.com", "sehat.com", "bajajfinservhealth.in", "1mg.com",
    "medifee.com", "clinicspots.com", "vaidam.com", "credihealth.com", "healthgrades.com",
    "zocdoc.com", "vitals.com", "smartdentaldesk.com", "dentalhospitalnearme.com",
    # Local Directories & Yellow Pages (Global & India)
    "justdial.com", "sulekha.com", "indiamart.com", "threebestrated.in", "threebestrated.com",
    "yellowpages.com", "yelp.com", "tripadvisor.com", "mapquest.com", "bbb.org",
    "angieslist.com", "thumbtack.com", "clutch.co", "upwork.com", "fiverr.com",
    "mouthshut.com", "quikr.com", "olx.in", "tradeindia.com", "dial4trade.com",
    "ourguwahati.com", "ourdelhi.co", "citysearch.com", "locanto.net", "asklaila.com",
    "jdmagicbox.com", "pagefinancials.com", "tofler.in", "zaubacorp.com",
    # Review & Job Portals
    "trustpilot.com", "glassdoor.com", "indeed.com", "naukri.com", "zoominfo.com",
    "apollo.io", "dnb.com", "kompass.com", "goodfirms.co", "capterra.com", "g2.com",
    # Real Estate & Property Portals (Indian & Global)
    "realestateindia.com", "magicbricks.com", "99acres.com", "housing.com", "nobroker.in",
    "commonfloor.com", "makaan.com", "squareyards.com", "realtor.com", "zillow.com",
    "redfin.com", "trulia.com", "rightmove.co.uk", "zoopla.co.uk", "propertyfinder.ae",
    # News, Articles, Ranking Portals & General Encyclopedias (NOT local businesses)
    "usnews.com", "moneytalksnews.com", "forbes.com", "nytimes.com", "washingtonpost.com",
    "cnn.com", "bbc.com", "healthline.com", "webmd.com", "medicalnewstoday.com",
    "verywellhealth.com", "mayoclinic.org", "clevelandclinic.org", "hopkinsmedicine.org",
    "nih.gov", "who.int", "ahd.com", "nychealthandhospitals.org", "health.gov",
    # Educational, Tutorials, Tech Blogs & Documentation (NOT local shops/businesses)
    "geeksforgeeks.org", "tutorialspoint.com", "computerhope.com", "w3schools.com",
    "javatpoint.com", "ibm.com", "invgate.com", "educatecomputer.com", "thecoreitech.com",
    "techtarget.com", "lifewire.com", "howtogeek.com", "britannica.com", "coursera.org",
    "udemy.com", "medium.com", "quora.com", "reddit.com", "dev.to", "simplilearn.com",
    "investopedia.com", "hubspot.com", "salesforce.com", "cisco.com", "oracle.com",
    # Developer & Code Repositories, AI Hubs, and Software Download Sites (NOT local businesses)
    "github.com", "gitlab.com", "huggingface.co", "techspot.com", "gizmodo.com",
    "developer.amd.com", "amd.com", "lmstudio.ai", "sourceforge.net", "stackoverflow.com",
    "pypi.org", "npmjs.com", "download.cnet.com", "softpedia.com",
    # Asian / Chinese / Russian Forum & Content Farms (Spam when searching in English)
    "zhihu.com", "baidu.com", "weibo.com", "csdn.net", "qq.com", "163.com", "sohu.com",
    "sina.com.cn", "douban.com", "tieba.baidu.com", "bilibili.com", "toutiao.com",
    "yandex.ru", "mail.ru", "vk.com",
}

def contains_cjk_characters(text: str) -> bool:
    """Checks if text contains Chinese, Japanese, or Korean characters."""
    if not text:
        return False
    return bool(re.search(r"[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]", text))

def is_informational_article(title: str, snippet: str = "") -> bool:
    """Detects if a search result is an informational article, tourist attraction, or blog rather than a commercial business."""
    text = f"{title} {snippet}".lower()
    bad_indicators = [
        "what is ", "what are ", "definition", "tutorial", "meaning of ",
        "types of ", "guide to ", "explained", "difference between ",
        "how to ", "introduction to ", "components of ", "examples of ",
        "overview of ", "meaning, ", "meaning -", "guide:", "course ",
        # Tourism, parks, attractions, blogs
        "national park", "nacionalni park", "wildlife sanctuary", "tourist attraction",
        "places to visit", "things to do", "travel guide", "travel blog", "sightseeing",
        "monument", "flora and fauna", "unesco heritage", "waterfall", "lakes national",
        "travel advice", "tourism board", "tourism in ", "visit "
    ]
    return any(bs in text for bs in bad_indicators)

def clean_business_name(raw_name: str) -> str:
    """Cleans up messy SEO titles, directory suffixes, and concatenated text."""
    if not raw_name:
        return ""

    name = raw_name.strip()

    # Split by common title separators (e.g. "Dental Clinic in Guwahati | Best Dentist - Justdial")
    for sep in [" - ", " – ", " — ", " | ", " : ", " » ", " • "]:
        if sep in name:
            parts = name.split(sep)
            # Pick the part that looks most like an actual business name (not containing directory names or "Top 10")
            valid_parts = [
                p.strip() for p in parts
                if not any(skip in p.lower() for skip in ["justdial", "practo", "top 10", "top 15", "top 5", "top 20", "best", "near me", "reviews", "ratings", "rankings"])
            ]
            if valid_parts:
                name = valid_parts[0]
            else:
                name = parts[0].strip()

    # Insert spaces between lowercase followed immediately by uppercase (e.g. "inGuwahati" -> "in Guwahati")
    name = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)

    # Remove trailing/leading junk like "Best ", "Top 10 ", " near me"
    name = re.sub(r"^(?:Top \d+|Best|The Best|Nationally Ranked)\s+", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\s+(?:Near Me|Online|Reviews|Book Appointment).*$", "", name, flags=re.IGNORECASE)

    return name.strip()


def decode_bing_url(url: str) -> str:
    """Decodes Bing click-tracking URL /ck/a?!...&u=a1<base64> into direct destination URL."""
    if not url:
        return ""
    if "/ck/a?!" in url:
        parsed = urllib.parse.urlparse(url)
        params = urllib.parse.parse_qs(parsed.query)
        u_val = params.get("u", [""])[0]
        if u_val and u_val.startswith("a1"):
            try:
                b64 = u_val[2:]
                padding = len(b64) % 4
                if padding:
                    b64 += "=" * (4 - padding)
                decoded = base64.urlsafe_b64decode(b64).decode("utf-8", errors="ignore")
                return decoded
            except Exception:
                pass
    return url


OBFUSCATED_EMAIL_REGEX = re.compile(
    r'([a-zA-Z0-9_.+-]+)\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|\bat\b|&#64;|&#x40;)\s*([a-zA-Z0-9-]+\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\bdot\b|\.)\s*[a-zA-Z0-9-.]+)',
    re.IGNORECASE
)

def extract_all_emails_from_html(html: str) -> set[str]:
    """Extracts standard mailto, plain regex emails, and obfuscated (contact [at] domain [dot] com) emails."""
    found = set()
    if not html:
        return found

    # 1. Check mailto: links (highest accuracy)
    for m in re.findall(r'href=[\'"]mailto:([^\'"?]+)', html, re.I):
        m_clean = m.strip()
        if "@" in m_clean:
            found.add(m_clean)

    # 2. Standard regex matches
    for em in EMAIL_REGEX.findall(html):
        found.add(em)

    # 3. Obfuscated emails (e.g. contact [at] domain [dot] com or info at domain dot com)
    for user_part, host_part in OBFUSCATED_EMAIL_REGEX.findall(html):
        clean_user = re.sub(r'\s+', '', user_part)
        clean_host = re.sub(r'\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\bdot\b)\s*', '.', host_part, flags=re.I)
        clean_host = re.sub(r'\s+', '', clean_host)
        if clean_user and clean_host and "." in clean_host:
            cand = f"{clean_user}@{clean_host}".lower()
            if EMAIL_REGEX.match(cand):
                found.add(cand)

    return found


def extract_about_team_snippet(soup: BeautifulSoup) -> str:
    """Extracts text sections likely describing the doctor, owner, founder, or leadership team."""
    team_snippets = []
    keywords = ["dr.", "doctor", "founder", "owner", "director", "ceo", "team", "dentist", "principal", "partner", "leadership"]
    
    # Priority elements: headings, bio cards, and paragraphs
    for el in soup.find_all(["h1", "h2", "h3", "h4", "p", "div", "section"]):
        txt = el.get_text(separator=" ", strip=True)
        txt_low = txt.lower()
        if any(kw in txt_low for kw in keywords) and 20 <= len(txt) <= 450:
            team_snippets.append(txt)
            if len(team_snippets) >= 4:
                break

    if team_snippets:
        return " | ".join(team_snippets)[:1200]

    # Fallback to general introductory paragraphs
    paras = [p.get_text(separator=" ", strip=True) for p in soup.find_all("p") if len(p.get_text(strip=True)) > 30]
    return " ".join(paras[:3])[:800]


def clean_emails(emails: set[str], domain: str) -> list[str]:
    """Filters out image extensions, common fake emails, and prioritizes domain-matching emails."""
    filtered = []
    invalid_exts = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js", ".woff", ".ttf"}
    for email in emails:
        em = email.lower().strip(".,;:()<>[]'\"")
        if any(em.endswith(ext) for ext in invalid_exts):
            continue
        if any(bad in em for bad in ["example.com", "yourdomain.com", "sentry.io", "wixpress.com", "domain.com", "test.com", "noreply"]):
            continue
        filtered.append(em)

    # Prioritize non-generic emails matching the target company domain over info@/support@
    domain_clean = domain.replace("www.", "").lower() if domain else ""
    def email_score(e: str):
        is_generic = any(e.startswith(prefix) for prefix in ["info@", "support@", "admin@", "contact@", "help@"])
        matches_domain = domain_clean and domain_clean in e
        # 0 = personal matching domain, 1 = generic matching domain, 2 = personal other, 3 = generic other
        if matches_domain:
            return 1 if is_generic else 0
        return 3 if is_generic else 2

    filtered.sort(key=lambda e: (email_score(e), e))
    return list(dict.fromkeys(filtered))


async def fetch_website_emails(client: httpx.AsyncClient, website_url: str):
    """
    Fast website crawler:
    Checks homepage first (where 85%+ contact info is located).
    Only checks /contact if no email is found on the homepage.
    Uses strict 3.0s timeout to never hang on dead/slow third-party servers.
    """
    if not website_url:
        return {"emails": [], "about_text": ""}

    parsed = urllib.parse.urlparse(website_url)
    domain = parsed.netloc or ""
    found_emails = set()
    about_text = ""

    # Step 1: Fast homepage check
    try:
        r = await client.get(website_url, timeout=3.0)
        if r.status_code == 200:
            html = r.text
            soup = BeautifulSoup(html, "html.parser")
            found_emails.update(extract_all_emails_from_html(html))
            about_text = extract_about_team_snippet(soup)
    except Exception:
        pass

    # Step 2: If no email found on homepage, try one contact page quickly
    if not found_emails and parsed.scheme and parsed.netloc:
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        try:
            r = await client.get(f"{base_url}/contact", timeout=2.5)
            if r.status_code == 200:
                html = r.text
                found_emails.update(extract_all_emails_from_html(html))
                if not about_text:
                    soup = BeautifulSoup(html, "html.parser")
                    about_text = extract_about_team_snippet(soup)
        except Exception:
            pass

    return {
        "emails": clean_emails(found_emails, domain),
        "about_text": about_text
    }


async def scrape_bing_leads(query: str, location: str = "", limit: int = 50, offset: int = 0, exclude_domains: list = None):
    """
    Finds direct business websites matching query and location.
    Extracts Bing Local entity cards & organic local businesses, then crawls websites for emails.
    Supports pagination via offset and domain deduplication.
    """
    if location:
        search_terms = f"{query} in {location}"
    else:
        search_terms = query.strip()

    if not search_terms:
        return []

    is_query_cjk = contains_cjk_characters(search_terms)
    loc_clean = location.lower().strip() if location else ""

    is_india = any(c in loc_clean for c in [
        "surat", "mumbai", "ahmedabad", "vadodara", "baroda", "delhi", "bangalore",
        "bengaluru", "pune", "hyderabad", "chennai", "kolkata", "jaipur", "india",
        "gujarat", "maharashtra", "rajasthan", "karnataka", "punjab", "haryana",
        "chandigarh", "lucknow", "kanpur", "indore", "bhopal", "nagpur", "noida", "gurgaon"
    ])
    mkt_param = "&cc=IN&setmkt=en-IN" if is_india else "&setlang=en"

    FOREIGN_CCTLDS = (
        ".hr", ".ru", ".cn", ".jp", ".kr", ".de", ".fr", ".it", ".es", ".pl",
        ".nl", ".cz", ".ro", ".ua", ".by", ".kz", ".ir", ".vn", ".th", ".id",
        ".my", ".ph", ".br", ".ar", ".cl", ".mx"
    )

    raw_leads = []
    seen_domains = set(d.replace("www.", "").lower() for d in (exclude_domains or []))

    # Bing uses 1-based indexing for 'first' parameter
    current_first = max(1, offset + 1)
    max_pages = 2

    async with httpx.AsyncClient(headers=HEADERS, timeout=6.0, follow_redirects=True) as client:
        for page_idx in range(max_pages):
            if len(raw_leads) >= limit or (page_idx > 0 and len(raw_leads) >= 15):
                break

            bing_url = f"https://www.bing.com/search?q={urllib.parse.quote(search_terms)}&first={current_first}&count=50{mkt_param}"
            current_first += 50

            try:
                resp = await client.get(bing_url)
                if resp.status_code != 200:
                    continue

                soup = BeautifulSoup(resp.text, "html.parser")

                # Step 1: Check Bing Local Cards / Places carousel (.b_ans, .b_localCard, .b_entityTitle)
                local_cards = soup.select(".b_localCard, .b_entityTitle a, .b_mapList li, li.b_ans a[href^='http']")
                for card in local_cards:
                    card_a = card if card.name == "a" else card.find("a")
                    if not card_a:
                        continue
                    card_title = card_a.get_text(strip=True)
                    card_url = decode_bing_url(card_a.get("href", ""))
                    if not card_url or not card_url.startswith("http") or "bing.com" in card_url:
                        continue

                    parsed_c = urllib.parse.urlparse(card_url)
                    d_c = parsed_c.netloc.replace("www.", "").lower()
                    if d_c in seen_domains or any(skip in d_c for skip in SKIP_DOMAINS):
                        continue

                    if is_india and any(d_c.endswith(tld) for tld in FOREIGN_CCTLDS):
                        continue

                    seen_domains.add(d_c)
                    clean_name = clean_business_name(card_title)
                    raw_leads.append({
                        "name": clean_name or card_title,
                        "website": card_url,
                        "domain": d_c,
                        "snippet": "",
                        "snippet_emails": [],
                    })
                    if len(raw_leads) >= limit:
                        break

                # Step 2: Parse organic algorithm results (li.b_algo)
                algo_elements = soup.select("li.b_algo")

                for el in algo_elements:
                    if len(raw_leads) >= limit:
                        break

                    h2 = el.find("h2")
                    if not h2:
                        continue
                    a_tag = h2.find("a")
                    if not a_tag:
                        continue

                    raw_title = a_tag.get_text(strip=True)
                    raw_url = a_tag.get("href", "")
                    dest_url = decode_bing_url(raw_url)

                    snippet_el = el.find("p") or el.find(".b_caption")
                    snippet = snippet_el.get_text(separator=" ", strip=True) if snippet_el else ""

                    if not dest_url or not dest_url.startswith("http"):
                        continue

                    parsed = urllib.parse.urlparse(dest_url)
                    domain = parsed.netloc.replace("www.", "").lower()

                    if domain in seen_domains:
                        continue

                    # Strictly skip directories, magazines, tutorials and national rankers
                    if any(skip in domain for skip in SKIP_DOMAINS):
                        continue

                    # Skip foreign ccTLDs when querying Indian locations
                    if is_india and any(domain.endswith(tld) for tld in FOREIGN_CCTLDS):
                        continue

                    # Reject educational tutorials, definitions, and tourism/parks
                    if is_informational_article(raw_title, snippet):
                        continue

                    # Discard any Chinese/Asian character spam if query is English
                    if not is_query_cjk and (contains_cjk_characters(raw_title) or contains_cjk_characters(snippet)):
                        continue

                    combined_text = f"{raw_title} {snippet} {dest_url}".lower()

                    # LOCATION CHECK: If location is given, check for location or ensure it's not a different country/state article
                    if loc_clean and len(loc_clean) >= 3:
                        if loc_clean in ["surat"]:
                            aliases = ["surat", "gujarat"]
                        elif loc_clean in ["vadodara", "baroda"]:
                            aliases = ["vadodara", "baroda", "gujarat"]
                        elif loc_clean in ["ahmedabad", "amdavad"]:
                            aliases = ["ahmedabad", "amdavad", "gujarat"]
                        elif loc_clean in ["mumbai", "bombay"]:
                            aliases = ["mumbai", "bombay", "maharashtra"]
                        elif loc_clean in ["pune"]:
                            aliases = ["pune", "maharashtra"]
                        elif loc_clean in ["bengaluru", "bangalore"]:
                            aliases = ["bengaluru", "bangalore", "karnataka"]
                        elif loc_clean in ["delhi", "new delhi"]:
                            aliases = ["delhi", "ncr"]
                        elif loc_clean in ["hyderabad"]:
                            aliases = ["hyderabad", "telangana"]
                        elif loc_clean in ["chennai"]:
                            aliases = ["chennai", "tamil nadu"]
                        elif loc_clean in ["jaipur"]:
                            aliases = ["jaipur", "rajasthan"]
                        else:
                            aliases = [loc_clean]

                        # If result has foreign country markers, skip
                        if any(bad_loc in combined_text for bad_loc in ["in america", "united states", "cleveland, oh", "croatia", "plitvice"]) and not any(a in combined_text for a in aliases):
                            continue

                    seen_domains.add(domain)
                    clean_name = clean_business_name(raw_title)
                    snippet_emails = EMAIL_REGEX.findall(snippet)

                    raw_leads.append({
                        "name": clean_name or raw_title,
                        "website": dest_url,
                        "domain": domain,
                        "snippet": snippet,
                        "snippet_emails": snippet_emails,
                    })

                    if len(raw_leads) >= limit:
                        break

            except Exception as e:
                print("Bing search page error:", e)

    # Step 2: Concurrently crawl actual company websites to extract contact emails
    results = []
    limits = httpx.Limits(max_connections=60, max_keepalive_connections=30)
    async with httpx.AsyncClient(headers=HEADERS, timeout=4.0, follow_redirects=True, limits=limits) as client:
        async def safe_fetch(lead_obj):
            try:
                return await asyncio.wait_for(fetch_website_emails(client, lead_obj["website"]), timeout=3.5)
            except Exception:
                return {"emails": [], "about_text": ""}

        tasks = [safe_fetch(lead) for lead in raw_leads]
        enrichments = await asyncio.gather(*tasks, return_exceptions=True)

        for i, lead in enumerate(raw_leads):
            enrichment = enrichments[i]
            emails = []
            about_text = ""

            if isinstance(enrichment, dict):
                emails = enrichment.get("emails", [])
                about_text = enrichment.get("about_text", "")
            elif isinstance(enrichment, list):
                emails = enrichment

            # Add any emails matched in Bing snippet
            if lead["snippet_emails"]:
                emails.extend(clean_emails(set(lead["snippet_emails"]), lead["domain"]))
                emails = list(dict.fromkeys(emails))

            results.append({
                "name": lead["name"],
                "website": lead["website"],
                "domain": lead["domain"],
                "email": emails[0] if emails else "",
                "all_emails": emails,
                "description": lead["snippet"][:200] if lead["snippet"] else "",
                "about_text": about_text,
            })

    return results
