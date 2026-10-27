"""
Google Maps Protobuf RPC Response Parser (Python port of gmapsParser.js).
Accurately decodes nested Google Maps search arrays (e.g. from search?tbm=map).
"""

import json
from typing import Any, Dict, List, Optional, Set


def Ur(obj: Any, *indices: int) -> Any:
    """
    Safely navigates deeply nested lists/dicts.
    Matches the Ur() array traversal algorithm from Google Maps RPC decoder.
    """
    curr = obj
    for idx in indices:
        try:
            if curr is not None and isinstance(curr, (list, tuple)):
                if 0 <= idx < len(curr) and curr[idx] is not None:
                    curr = curr[idx]
                else:
                    return None
            elif curr is not None and isinstance(curr, dict):
                if idx in curr and curr[idx] is not None:
                    curr = curr[idx]
                else:
                    return None
            else:
                return None
        except Exception:
            return None
    return curr


def is_place_node(node: Any) -> bool:
    """
    Checks if a given array represents a single Google Maps place entity.
    A valid place node typically has:
      [11] -> string business name
      [78] -> string place_id (e.g. starts with 'ChIJ')
      [9]  -> coordinates array with [2] (lat) and [3] (lng)
    """
    if not isinstance(node, (list, tuple)):
        return False

    name = Ur(node, 11)
    place_id = Ur(node, 78)
    lat = Ur(node, 9, 2)

    if isinstance(name, str) and len(name.strip()) > 0:
        if isinstance(place_id, str) and len(place_id) > 5:
            return True
        if isinstance(lat, (int, float)):
            return True

    return False


def parse_place_node(y: list) -> Dict[str, Any]:
    """
    Parses an individual place node into the standard verified lead dictionary.
    """
    place_id = Ur(y, 78) or ""
    name = (Ur(y, 11) or "").strip()

    website_url = Ur(y, 7, 0) or ""
    domain = Ur(y, 7, 1) or ""
    if not (website_url.startswith("http://") or website_url.startswith("https://")):
        website_url = ""
        domain = ""

    full_address = (Ur(y, 39) or "").strip()
    kgmid = Ur(y, 89) or ""
    categories = Ur(y, 13) or []

    # Extract CID from hex or numeric string (e.g. "0x...:0x...")
    cid = ""
    try:
        cid_raw = Ur(y, 10)
        if cid_raw and isinstance(cid_raw, str) and ":" in cid_raw:
            parts = cid_raw.split(":")
            if len(parts) > 1 and parts[1]:
                cid = str(int(parts[1], 16))
    except Exception:
        cid = ""

    # Feature image
    featured_image = Ur(y, 37, 0, 0, 6, 0) or ""
    if not featured_image.startswith("http"):
        featured_image = ""

    # Phone numbers
    phone = ""
    phones = []
    try:
        raw_phone = Ur(y, 178, 0, 0)
        if isinstance(raw_phone, (list, tuple)) and raw_phone:
            phone = str(raw_phone[0])
        elif isinstance(raw_phone, str):
            phone = raw_phone

        phone_list = Ur(y, 178, 0, 1)
        if isinstance(phone_list, (list, tuple)):
            for item in phone_list:
                if isinstance(item, (list, tuple)) and item and item[0]:
                    phones.append(str(item[0]))
        if not phone and phones:
            phone = phones[0]
    except Exception:
        phone = ""

    # Coordinates
    lat = Ur(y, 9, 2) or 0.0
    lng = Ur(y, 9, 3) or 0.0

    # Ratings & reviews
    reviews = Ur(y, 4, 8)
    if reviews is None or not str(reviews).isdigit():
        reviews = 0
    else:
        reviews = int(reviews)

    rating = Ur(y, 4, 7)
    try:
        rating = float(rating) if rating is not None else 0.0
    except (ValueError, TypeError):
        rating = 0.0

    review_url = Ur(y, 4, 3, 0) or ""
    if not review_url.startswith("https://"):
        review_url = ""

    # Address parts
    street = Ur(y, 183, 0, 0, 1, 1) or ""
    municipality = Ur(y, 183, 0, 0, 1, 2) or ""

    # Opening hours
    opening_hours = []
    try:
        raw_hours = Ur(y, 34, 1)
        if isinstance(raw_hours, (list, tuple)):
            for h in raw_hours:
                if isinstance(h, (list, tuple)) and len(h) >= 2:
                    day = h[0]
                    hours = Ur(h, 1, 0)
                    if hours:
                        opening_hours.append(f"{day}: [{hours}]")
    except Exception:
        pass

    claim_url = Ur(y, 49, 0)
    claimed = not bool(claim_url)

    google_maps_url = (
        f"https://www.google.com/maps/place/?q=place_id:{place_id}"
        if place_id
        else f"https://www.google.com/maps/search/?api=1&query={name}"
    )

    google_knowledge_url = f"https://www.google.com/search?kgmid={kgmid}" if kgmid else ""

    return {
        "placeId": place_id,
        "name": name,
        "fullAddress": full_address,
        "street": street,
        "municipality": municipality,
        "categories": categories,
        "phone": phone,
        "phones": phones,
        "claimed": claimed,
        "reviewCount": reviews,
        "averageRating": rating,
        "reviewUrl": review_url,
        "googleMapsUrl": google_maps_url,
        "latitude": lat,
        "longitude": lng,
        "website": website_url,
        "domain": domain,
        "openingHours": opening_hours,
        "featuredImage": featured_image,
        "cid": cid,
        "googleKnowledgeUrl": google_knowledge_url,
        "kgmid": kgmid,
    }


def find_place_nodes(data: Any, results: Optional[List[Dict[str, Any]]] = None, seen: Optional[Set[str]] = None) -> List[Dict[str, Any]]:
    """
    Recursively navigates arbitrary nested structures to extract all place nodes.
    """
    if results is None:
        results = []
    if seen is None:
        seen = set()

    if isinstance(data, (list, tuple)):
        if is_place_node(data):
            pid = Ur(data, 78) or Ur(data, 11)
            if pid and pid not in seen:
                seen.add(pid)
                results.append(parse_place_node(data))
            return results

        for item in data:
            if isinstance(item, (list, tuple, dict)):
                find_place_nodes(item, results, seen)

    elif isinstance(data, dict):
        for val in data.values():
            if isinstance(val, (list, tuple, dict)):
                find_place_nodes(val, results, seen)

    return results


def parse_gmaps_response(raw_input: Any) -> List[Dict[str, Any]]:
    """
    Main parser entrypoint. Accepts raw text strings, bytes, or parsed Python lists/dicts.
    Strips Google anti-hijacking prefixes like ')]}\'' or '/*-private-token-*/'.
    """
    if not raw_input:
        return []

    if isinstance(raw_input, (list, dict)):
        return find_place_nodes(raw_input)

    if isinstance(raw_input, bytes):
        try:
            raw_input = raw_input.decode("utf-8", errors="ignore")
        except Exception:
            return []

    if isinstance(raw_input, str):
        clean_text = raw_input.strip()
        if clean_text.startswith(")]}'"):
            clean_text = clean_text[4:].strip()
        if clean_text.startswith("/*-private-token-*/"):
            clean_text = clean_text[19:].strip()

        try:
            parsed = json.loads(clean_text)
            return find_place_nodes(parsed)
        except Exception:
            # Sometimes payload is an array of byte numbers
            return []

    return []
