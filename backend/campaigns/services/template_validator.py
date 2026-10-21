"""Pre-send checks for email templates.

This module is intentionally dependency-free (besides the stdlib) so it can be
used from API views, management commands and tests without side effects.

The goal is to catch the issues that make providers (especially Gmail) silently
drop or spam-filter a campaign email *before* the user sends it.
"""

from __future__ import annotations

import html as html_module
import re
from urllib.parse import urlparse

# Merge tags that the campaign sender can actually replace. CSV columns are
# normalised to lowercase before sending, so tags must be lowercase too.
ALLOWED_MERGE_TAGS = {
    "name",
    "first_name",
    "last_name",
    "email",
    "company",
    "website",
    "city",
    "country",
    "phone",
    "title",
    "position",
    "address",
    "industry",
    "linkedin",
    "source",
}

# Tags that look plausible but are NOT replaced by the current sender.
UNSUPPORTED_MERGE_TAGS = {
    "sender_email",
    "sender_name",
    "senderemail",
    "sendername",
    "unsubscribe_url",
    "unsubscribeurl",
}

# AI/editor placeholders that should never reach a real recipient.
PLACEHOLDER_DOMAINS = (
    "yourwebsite.com",
    "your-domain.com",
    "yourdomain.com",
    "yourcompany.com",
    "example.com",
    "your-booking-link",
    "yourbookinglink",
    "yourwebsite",
    "yoursite.com",
    "lorem ipsum",
)

URL_SHORTENERS = {
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "goo.gl",
    "ow.ly",
    "is.gd",
    "buff.ly",
    "rebrand.ly",
    "cutt.ly",
    "shorturl.at",
}

SPAM_PHRASES = (
    "act now",
    "apply now",
    "buy now",
    "call now",
    "click here",
    "click below",
    "limited time",
    "only today",
    "urgent",
    "risk-free",
    "risk free",
    "100% free",
    "100% satisfied",
    "guaranteed",
    "no obligation",
    "no risk",
    "special promotion",
    "you have won",
    "winner",
    "congratulations",
    "earn money",
    "make money",
    "work from home",
    "lowest price",
    "best price",
    "free gift",
    "order now",
    "dear friend",
    "don't delete",
    "this is not spam",
)

MERGE_TAG_RE = re.compile(r"\{\{\s*([^{}]*?)\s*\}\}")
HREF_RE = re.compile(r"href\s*=\s*(['\"])(.*?)\1", re.IGNORECASE | re.DOTALL)
PRIVATE_HOST_RE = re.compile(
    r"^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|"
    r"192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$"
)


def _issue(level: str, code: str, field: str, message: str, snippet: str | None = None,
           fix: str | None = None) -> dict:
    item = {
        "level": level,
        "code": code,
        "field": field,
        "message": message,
    }
    if snippet:
        item["snippet"] = " ".join(snippet.split())[:180]
    if fix:
        item["fix"] = fix
    return item


def _dedupe(issues: list[dict]) -> list[dict]:
    seen = set()
    out = []
    for issue in issues:
        key = (issue["level"], issue["code"], issue["field"], issue["message"])
        if key in seen:
            continue
        seen.add(key)
        out.append(issue)
    return out


def _visible_text(value: str) -> str:
    """Very small HTML-to-text helper (used only for heuristics)."""
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", value or "", flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html_module.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _check_merge_tags(value: str, field: str, issues: list[dict]) -> None:
    if not value:
        return

    opens = value.count("{{")
    closes = value.count("}}")
    if opens != closes:
        issues.append(_issue(
            "error",
            "merge_tag_unbalanced",
            field,
            f"Unbalanced merge tags: {opens} '{{{{' vs {closes} '}}}}'.",
            fix="Make sure every {{tag}} has a matching closing }}.",
        ))

    for match in MERGE_TAG_RE.finditer(value):
        raw = match.group(0)
        tag = match.group(1)

        # The sender replaces '{{key}}' exactly (lowercase, no spaces).
        if tag != tag.strip() or " " in tag or "\t" in tag:
            issues.append(_issue(
                "error",
                "merge_tag_spaces",
                field,
                f"Merge tag {raw} contains spaces and will not be replaced.",
                raw,
                "Use the compact form, e.g. {{first_name}}.",
            ))
            continue

        if tag != tag.lower():
            issues.append(_issue(
                "error",
                "merge_tag_case",
                field,
                f"Merge tag {raw} has uppercase letters and will be left as-is.",
                raw,
                "Use lowercase, e.g. {{company}} instead of {{CompanyName}}.",
            ))
            continue

        if tag in UNSUPPORTED_MERGE_TAGS:
            issues.append(_issue(
                "error",
                "merge_tag_unsupported",
                field,
                f"Merge tag {raw} is not supported by the sender.",
                raw,
                "Remove it or set the value through the sender identity.",
            ))
            continue

        if tag not in ALLOWED_MERGE_TAGS:
            issues.append(_issue(
                "warning",
                "merge_tag_unknown",
                field,
                f"Merge tag {raw} is not a built-in tag. It only works if your CSV has a '{tag}' column.",
                raw,
                f"Keep it only if your CSV contains a '{tag}' column.",
            ))


def _check_placeholders(text: str, field: str, issues: list[dict]) -> None:
    lower = (text or "").lower()
    for placeholder in PLACEHOLDER_DOMAINS:
        count = lower.count(placeholder)
        if count:
            issues.append(_issue(
                "error",
                "placeholder_content",
                field,
                f"Placeholder '{placeholder}' found {count} time(s).",
                placeholder,
                "Replace it with your real website / booking URL before sending.",
            ))

    if "lorem ipsum" in lower:
        issues.append(_issue(
            "warning", "lorem_ipsum", field,
            "Lorem ipsum placeholder text found.",
            "lorem ipsum",
            "Replace it with real copy.",
        ))

    if "todo" in lower:
        issues.append(_issue(
            "warning", "todo_placeholder", field,
            "TODO marker found in the template.",
            "TODO",
            "Finish or remove the TODO section.",
        ))


def _check_links(body: str, issues: list[dict]) -> None:
    hrefs = [m.group(2).strip() for m in HREF_RE.finditer(body or "")]
    real_links = [h for h in hrefs if h and h != "#"]

    hash_links = sum(1 for h in hrefs if h == "#")
    if hash_links:
        issues.append(_issue(
            "error",
            "empty_anchor_link",
            "body",
            f"{hash_links} link(s) use href=\"#\", which points nowhere.",
            'href="#"',
            "Use a real URL or turn it into plain text.",
        ))

    if len(real_links) > 15:
        issues.append(_issue(
            "error",
            "too_many_links",
            "body",
            f"{len(real_links)} links found. Gmail treats link-heavy emails as promotional/spam.",
            fix="Keep the most important 5-8 links.",
        ))
    elif len(real_links) > 8:
        issues.append(_issue(
            "warning",
            "many_links",
            "body",
            f"{len(real_links)} links found (recommended: 8 or fewer).",
            fix="Remove secondary links to improve inbox placement.",
        ))

    seen = set()
    for link in real_links:
        if link in seen:
            continue
        seen.add(link)

        if "{{" in link or "}}" in link:
            issues.append(_issue(
                "error",
                "merge_tag_in_url",
                "body",
                "A merge tag appears inside a URL and may not resolve correctly.",
                link,
                "Move the tag to the link text or use a static URL.",
            ))
            continue

        if link.startswith("javascript:"):
            issues.append(_issue(
                "error", "javascript_link", "body",
                "javascript: links are blocked by email clients.",
                link,
                "Use a normal https:// link.",
            ))
            continue

        if link.startswith("http://"):
            issues.append(_issue(
                "warning", "non_https_link", "body",
                "Non-HTTPS (http://) link found.",
                link,
                "Use https:// instead.",
            ))

        try:
            host = (urlparse(link).hostname or "").lower()
        except Exception:
            host = ""

        if host in URL_SHORTENERS:
            issues.append(_issue(
                "warning", "shortener_link", "body",
                f"URL shortener link found ({host}).",
                link,
                "Use the full destination URL.",
            ))

        if host and PRIVATE_HOST_RE.match(host):
            issues.append(_issue(
                "error", "private_link", "body",
                f"Link points to a private/local address ({host}).",
                link,
                "Use a public URL.",
            ))


def _check_subject(subject: str, issues: list[dict]) -> None:
    value = subject or ""
    if not value.strip():
        issues.append(_issue(
            "error", "empty_subject", "subject",
            "Subject is empty.",
            fix="Add a clear, specific subject line.",
        ))
        return

    if "\n" in value or "\r" in value:
        issues.append(_issue(
            "error", "subject_newline", "subject",
            "Subject contains a line break.",
            fix="Keep the subject on a single line.",
        ))

    if len(value) > 100:
        issues.append(_issue(
            "error", "subject_too_long", "subject",
            f"Subject is {len(value)} characters (max recommended: 60-70).",
            value[:80],
            "Shorten the subject so it is not truncated on mobile.",
        ))
    elif len(value) > 70:
        issues.append(_issue(
            "warning", "subject_long", "subject",
            f"Subject is {len(value)} characters (recommended: 60-70).",
            value,
            "Shorten the subject.",
        ))

    letters = [c for c in value if c.isalpha()]
    if len(letters) >= 8 and sum(1 for c in letters if c.isupper()) / len(letters) > 0.7:
        issues.append(_issue(
            "warning", "subject_all_caps", "subject",
            "Subject is mostly uppercase.",
            value,
            "Use normal sentence case.",
        ))

    if re.search(r"[!?$]{2,}", value):
        issues.append(_issue(
            "warning", "subject_punctuation", "subject",
            "Subject contains repeated !!!, ??? or $$$ punctuation.",
            value,
            "Use at most one exclamation mark.",
        ))

    lower = value.lower()
    found = [p for p in SPAM_PHRASES if p in lower]
    if found:
        issues.append(_issue(
            "warning", "subject_spam_words", "subject",
            "Spam trigger words in subject: " + ", ".join(found[:6]) + ".",
            value,
            "Rewrite the subject with neutral wording.",
        ))


def _check_body(body: str, issues: list[dict]) -> None:
    value = body or ""
    if not value.strip():
        issues.append(_issue(
            "error", "empty_body", "body",
            "Email body is empty.",
            fix="Add your email content.",
        ))
        return

    if len(value) > 250_000:
        issues.append(_issue(
            "error", "body_too_large", "body",
            f"HTML body is very large ({len(value):,} characters).",
            fix="Reduce embedded CSS/images; large emails are often clipped or blocked.",
        ))
    elif len(value) > 100_000:
        issues.append(_issue(
            "warning", "body_large", "body",
            f"HTML body is large ({len(value):,} characters).",
            fix="Consider trimming embedded CSS or images.",
        ))

    if re.search(r"<script\b", value, re.I):
        issues.append(_issue(
            "error", "script_tag", "body",
            "Template contains a <script> tag.",
            fix="Remove JavaScript; email clients block it and spam filters penalise it.",
        ))

    if re.search(r"\bon(click|error|load|mouseover|submit)\s*=", value, re.I) or "javascript:" in value.lower():
        issues.append(_issue(
            "error", "inline_javascript", "body",
            "Template contains inline JavaScript handlers.",
            fix="Remove all JavaScript from the email HTML.",
        ))

    if re.search(r"<form\b", value, re.I):
        issues.append(_issue(
            "warning", "form_tag", "body",
            "Template contains a <form> tag.",
            fix="Most email clients strip forms; use links instead.",
        ))

    if re.search(r"<style\b", value, re.I):
        issues.append(_issue(
            "info", "inline_css_plain_text", "body",
            "Template contains a <style> block. The generated plain-text part may include CSS.",
            fix="Inline critical CSS or keep the <style> block short.",
        ))

    images = len(re.findall(r"<img\b", value, re.I))
    visible = _visible_text(value)
    if images >= 3 and len(visible) < 40:
        issues.append(_issue(
            "warning", "image_only", "body",
            f"Email is mostly images ({images} images, {len(visible)} characters of text).",
            fix="Add meaningful text; image-only emails are filtered heavily.",
        ))

    lower = value.lower()
    if "unsubscribe" not in lower:
        issues.append(_issue(
            "info", "no_unsubscribe", "body",
            "No unsubscribe link found in the template (the sender appends one automatically for campaigns).",
            fix="Optional: add your own unsubscribe link or {{unsubscribe_url}} placeholder is not supported.",
        ))

    found = [p for p in SPAM_PHRASES if p in lower]
    if found:
        issues.append(_issue(
            "warning", "body_spam_words", "body",
            "Spam trigger phrases found: " + ", ".join(found[:8]) + ".",
            fix="Use more natural, less promotional wording.",
        ))


def validate_template_content(subject: str | None, body: str | None) -> dict:
    """Return a dict with errors/warnings/info for a template.

    The response shape is intentionally stable so the frontend can render it:
        {
          "ok": bool,
          "score": int,
          "errors": [...],
          "warnings": [...],
          "info": [...],
          "summary": {"errors": n, "warnings": n, "info": n},
        }
    """
    issues: list[dict] = []
    subject = subject or ""
    body = body or ""

    _check_subject(subject, issues)
    _check_body(body, issues)
    _check_merge_tags(subject, "subject", issues)
    _check_merge_tags(body, "body", issues)
    _check_placeholders(subject, "subject", issues)
    _check_placeholders(body, "body", issues)
    _check_links(body, issues)

    issues = _dedupe(issues)
    errors = [i for i in issues if i["level"] == "error"]
    warnings = [i for i in issues if i["level"] == "warning"]
    info = [i for i in issues if i["level"] == "info"]

    score = max(0, 100 - (len(errors) * 18) - (len(warnings) * 5))

    return {
        "ok": len(errors) == 0,
        "score": score,
        "errors": errors,
        "warnings": warnings,
        "info": info,
        "summary": {
            "errors": len(errors),
            "warnings": len(warnings),
            "info": len(info),
        },
    }
