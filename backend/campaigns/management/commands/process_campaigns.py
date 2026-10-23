import datetime
import html as html_module
import json
import os
import re
import sys
import time

try:
    import fcntl
except ImportError:
    fcntl = None

try:
    import msvcrt
except ImportError:
    msvcrt = None

import requests
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.core.management.base import BaseCommand
from django.db import close_old_connections, models
from django.db.models import Q
from django.utils import timezone

from campaigns.models import (
    Campaign,
    CampaignContact,
    Identity,
    Log,
    RecipientSend,
    Suppression,
)


class Command(BaseCommand):
    help = "Processes scheduled and running campaigns"

    def handle(self, *args, **options):
        # Only one worker may run at a time. Cross-platform locking for Windows & Unix.
        lock_dir = os.path.join(settings.BASE_DIR, "tmp") if hasattr(settings, "BASE_DIR") else os.getcwd()
        os.makedirs(lock_dir, exist_ok=True)
        lock_path = os.environ.get("BEMAIL_WORKER_LOCK", os.path.join(lock_dir, "bemail_worker.lock"))
        self._lock_handle = open(lock_path, "a+")

        if fcntl:
            try:
                fcntl.flock(self._lock_handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except (BlockingIOError, OSError):
                self.stderr.write("Another campaign worker is already running. Exiting.")
                return
        elif msvcrt:
            try:
                self._lock_handle.seek(0)
                msvcrt.locking(self._lock_handle.fileno(), msvcrt.LK_NBLCK, 1)
            except (BlockingIOError, OSError):
                self.stderr.write("Another campaign worker is already running. Exiting.")
                return

        self.stdout.write(self.style.SUCCESS("BEmailSender Campaign Processor Started..."))

        while True:
            any_work_done = False
            try:
                close_old_connections()
                self.reset_daily_counters()
                now = timezone.now()
                # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
                python_day = now.weekday()
                # Map to match frontend: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
                current_day = (python_day + 1) % 7
                current_time = now.strftime("%H:%M")

                # FIFO: oldest campaign gets the account's send slot first.
                campaigns = Campaign.objects.filter(
                    status__in=["scheduled", "running"]
                ).order_by("created_at", "id")

                for campaign in campaigns:
                    # Account-level concurrency: at most one running campaign per
                    # user. New campaigns stay scheduled (queued) until the
                    # current one finishes.
                    if campaign.status == "running":
                        older_running = (
                            Campaign.objects.filter(
                                user_id=campaign.user_id, status="running"
                            )
                            .exclude(id=campaign.id)
                            .filter(
                                Q(created_at__lt=campaign.created_at)
                                | Q(
                                    created_at=campaign.created_at,
                                    id__lt=campaign.id,
                                )
                            )
                        )
                        if older_running.exists():
                            campaign.status = "scheduled"
                            campaign.save()
                            continue
                    else:
                        if Campaign.objects.filter(
                            user_id=campaign.user_id, status="running"
                        ).exists():
                            continue

                    # Auto batch: wait 2 hours after every 100 successful sends
                    if campaign.total_sent > 0 and campaign.total_sent % 100 == 0:
                        gap_seconds = 2 * 60 * 60
                        elapsed = (timezone.now() - campaign.updated_at).total_seconds()
                        if elapsed < gap_seconds:
                            continue

                    is_within_window = True

                    # Check schedule: campaign-specific schedule overrides user's global safeguard schedule
                    user = campaign.user
                    sched_days = campaign.schedule_days or getattr(user, "schedule_days", None)
                    sched_start = campaign.schedule_start_time or getattr(user, "schedule_start_time", None)
                    sched_end = campaign.schedule_end_time or getattr(user, "schedule_end_time", None)

                    if sched_days and sched_start and sched_end:
                        try:
                            days = (
                                json.loads(sched_days)
                                if isinstance(sched_days, str)
                                else sched_days
                            )
                            day_map = {"sun": 0, "mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5, "sat": 6}
                            normalized_days = []
                            for d in days:
                                if isinstance(d, int):
                                    normalized_days.append(d)
                                elif str(d).lower() in day_map:
                                    normalized_days.append(day_map[str(d).lower()])
                                else:
                                    try:
                                        normalized_days.append(int(d))
                                    except:
                                        pass

                            start_time = (
                                sched_start.strftime("%H:%M")
                                if hasattr(sched_start, "strftime")
                                else str(sched_start)[:5]
                            )
                            end_time = (
                                sched_end.strftime("%H:%M")
                                if hasattr(sched_end, "strftime")
                                else str(sched_end)[:5]
                            )

                            is_day_match = current_day in normalized_days
                            is_time_match = False

                            if start_time <= end_time:
                                is_time_match = start_time <= current_time <= end_time
                            else:
                                # Over-night schedule
                                is_time_match = (
                                    current_time >= start_time
                                    or current_time <= end_time
                                )

                            is_within_window = is_day_match and is_time_match
                        except Exception as e:
                            self.stderr.write(
                                f"Scheduling error for campaign {campaign.id}: {str(e)}"
                            )

                    if is_within_window:
                        if campaign.status == "scheduled":
                            self.stdout.write(
                                self.style.SUCCESS(f"Starting campaign: {campaign.name}")
                            )
                            campaign.status = "running"
                            campaign.save()

                        # Process up to 10 contacts per campaign per cycle to
                        # improve throughput but still allow other accounts a turn.
                        for _ in range(10):
                            if self.process_next_contact(campaign):
                                any_work_done = True
                            else:
                                break
                    else:
                        if campaign.status == "running":
                            self.stdout.write(
                                self.style.WARNING(
                                    f"Suspending campaign (out of window): {campaign.name}"
                                )
                            )
                            campaign.status = "scheduled"
                            campaign.save()

                # Process high-intent retargeting follow-ups due right now
                if self.process_scheduled_intent_followups():
                    any_work_done = True

            except Exception as e:
                self.stderr.write(f"Cycle error: {str(e)}")

            # If we did work, don't wait long. If idle, sleep longer.
            time.sleep(1 if any_work_done else 5)

    def process_scheduled_intent_followups(self):
        due_followups = (
            CampaignContact.objects.filter(
                intent_followup_status="scheduled",
                intent_followup_scheduled_at__lte=timezone.now(),
            )
            .select_related("campaign", "campaign__user", "campaign__identity", "campaign__identity_group")
            .order_by("intent_followup_scheduled_at")[:10]
        )

        work_done = False
        for contact in due_followups:
            campaign = contact.campaign
            recipient = contact.recipient

            # Guardrail 1: Check if lead already replied in the meantime
            from campaigns.models import ReceivedEmail
            if ReceivedEmail.objects.filter(campaign=campaign, sender=recipient).exists():
                contact.intent_followup_status = "cancelled"
                contact.save(update_fields=["intent_followup_status", "updated_at"])
                Log.objects.create(
                    campaign=campaign,
                    recipient=recipient,
                    status="skipped",
                    message="⚡ Intent follow-up cancelled: Recipient already replied to campaign",
                )
                continue

            # Guardrail 2: Check if recipient unsubscribed
            if Suppression.objects.filter(user=campaign.user, email=recipient, is_active=True).exists():
                contact.intent_followup_status = "cancelled"
                contact.save(update_fields=["intent_followup_status", "updated_at"])
                continue

            subject = campaign.intent_followup_subject or "Quick update regarding your interest (Special Discount Inside)"
            body = campaign.intent_followup_body or ""
            data = (
                json.loads(contact.data)
                if isinstance(contact.data, str)
                else (contact.data or {})
            )
            for k, v in data.items():
                body = body.replace(f"{{{{{k}}}}}", str(v))
                subject = subject.replace(f"{{{{{k}}}}}", str(v))

            try:
                outcome = self.send_email(campaign, contact, subject, body, is_intent_followup=True)
                if outcome == "skipped":
                    contact.intent_followup_status = "cancelled"
                    contact.save(update_fields=["intent_followup_status", "updated_at"])
                elif outcome:
                    contact.intent_followup_status = "sent"
                    contact.intent_followup_sent_at = timezone.now()
                    contact.save(update_fields=["intent_followup_status", "intent_followup_sent_at", "updated_at"])
                    Log.objects.create(
                        campaign=campaign,
                        recipient=recipient,
                        status="success",
                        message=f"⚡ High-Intent Retargeting email sent ({campaign.intent_followup_delay_minutes}m delay after lead interest)",
                    )
                    work_done = True
                else:
                    contact.intent_followup_status = "failed"
                    contact.save(update_fields=["intent_followup_status", "updated_at"])
            except Exception as e:
                self.stderr.write(f"Intent followup error for {recipient}: {e}")

        return work_done

    def reset_daily_counters(self):
        today = timezone.localdate()
        Identity.objects.filter(
            Q(daily_date__isnull=True) | ~Q(daily_date=today)
        ).update(daily_sent=0, daily_date=today)

    def get_identity_for_send(self, campaign):
        if campaign.identity_group:
            group = campaign.identity_group
            available = group.identities.filter(
                daily_sent__lt=models.F("daily_limit")
            ).first()
            if not available:
                raise Exception(
                    f"All identities in group '{group.name}' exhausted for today"
                )
            return available
        if campaign.identity:
            return campaign.identity
        raise Exception("No sender identity assigned")

    def process_next_contact(self, campaign):
        # Pending contacts, plus failed contacts with retries left. Hard failures
        # are retried at most 3 times, one hour apart.
        one_hour_ago = timezone.now() - datetime.timedelta(hours=1)

        contact = (
            CampaignContact.objects.filter(campaign=campaign)
            .filter(
                Q(status="pending")
                | Q(
                    status="failed",
                    attempts__lt=3,
                    updated_at__lt=one_hour_ago,
                )
            )
            .order_by("id")
            .first()
        )

        if not contact:
            pending = CampaignContact.objects.filter(
                campaign=campaign, status="pending"
            ).count()
            retryable = CampaignContact.objects.filter(
                campaign=campaign, status="failed", attempts__lt=3
            ).count()
            if pending == 0 and retryable == 0:
                if campaign.status != "completed":
                    campaign.status = "completed"
                    campaign.save()
                    self.stdout.write(
                        self.style.SUCCESS(f"Campaign completed: {campaign.name}")
                    )
            return False

        try:
            template = campaign.template
            if not template:
                raise Exception("Template missing")

            # Parse contact data for merge tags
            data = (
                json.loads(contact.data)
                if isinstance(contact.data, str)
                else contact.data
            )
            body = template.body
            subject = template.subject or ""

            # Replace merge tags
            for key, value in data.items():
                body = body.replace(f"{{{{{key}}}}}", str(value))
                if subject:
                    subject = subject.replace(f"{{{{{key}}}}}", str(value))

            outcome = self.send_email(campaign, contact, subject, body)

            if outcome == "sent":
                campaign.total_sent += 1
                campaign.save()
                # Apply delay only after a real send, not after a skip.
                if campaign.delay_ms > 0:
                    time.sleep(campaign.delay_ms / 1000.0)
            elif outcome == "skipped":
                campaign.total_skipped += 1
                campaign.save()

        except Exception as e:
            err_msg = str(e)
            self.stderr.write(f"Failed to send to {contact.recipient}: {err_msg}")
            contact.attempts = (contact.attempts or 0) + 1
            contact.status = "failed"
            contact.save()
            Log.objects.create(
                campaign=campaign,
                recipient=contact.recipient,
                status="error",
                message=f"Attempt {contact.attempts}: {err_msg}",
            )
            # Auto-suppress on Hard Bounce or invalid recipient errors
            err_lower = err_msg.lower()
            hard_bounce_triggers = [
                "550",
                "user unknown",
                "user not found",
                "mailbox unavailable",
                "mailbox not found",
                "recipient address rejected",
                "no such user",
                "does not exist",
                "invalid recipient",
                "551",
                "552",
                "553",
                "554",
            ]
            if any(trigger in err_lower for trigger in hard_bounce_triggers):
                clean_r = contact.recipient.strip().lower()
                Suppression.objects.update_or_create(
                    user=campaign.user,
                    email=clean_r,
                    defaults={
                        "reason": "bounced",
                        "campaign": campaign,
                        "is_active": True,
                        "feedback_reason": "hard_bounce",
                    },
                )
                # Hard bounce is final; do not retry it.
                contact.attempts = 3
                contact.save(update_fields=["attempts"])
                self.stdout.write(
                    self.style.WARNING(
                        f"Auto-suppressed hard bounced recipient: {clean_r}"
                    )
                )

            # Count only final failures, not every retry attempt.
            if contact.attempts >= 3:
                campaign.total_failed += 1
            campaign.save()

            # Bounce Rate Alert: If failure rate exceeds threshold, notify and auto-pause
            total_attempts = campaign.total_sent + campaign.total_failed
            if total_attempts >= 10:  # Minimum sample size to calculate statistical rate
                bounce_rate = (campaign.total_failed / total_attempts) * 100
                user = campaign.user
                threshold = getattr(user, "bounce_alert_threshold", 5.0) or 5.0
                auto_pause = getattr(user, "bounce_auto_pause", True)
                if auto_pause and bounce_rate > threshold:
                    campaign.status = "paused"
                    campaign.save(update_fields=["status"])
                    alert_msg = (
                        f"🚨 Bounce Rate Alert: Campaign automatically paused! "
                        f"Bounce rate reached {bounce_rate:.1f}% (threshold: {threshold}%)."
                    )
                    Log.objects.create(
                        campaign=campaign,
                        recipient=contact.recipient,
                        status="warning",
                        message=alert_msg,
                    )
                    self.stdout.write(self.style.ERROR(alert_msg))
                    return False

            # Don't sleep on failure, try next contact immediately
            return True

        return True

    def _record_recipient_send(self, campaign, contact):
        """Record a successful send for the per-account cooldown ledger."""
        try:
            RecipientSend.objects.create(
                user=campaign.user,
                recipient=contact.recipient.strip().lower(),
                campaign=campaign,
            )
        except Exception as e:
            # Ledger failure must not turn a successful send into a failure.
            self.stderr.write(f"Could not record recipient ledger entry: {e}")

    def _skip_contact(self, campaign, contact, reason):
        contact.status = "skipped"
        contact.skip_reason = reason
        contact.save()
        Log.objects.create(
            campaign=campaign,
            recipient=contact.recipient,
            status="skipped",
            message=reason,
        )
        return "skipped"

    def send_email(self, campaign, contact, subject, body, is_intent_followup=False):
        recipient_clean = contact.recipient.strip().lower()

        # 1. Suppression check: abort if recipient unsubscribed or suppressed
        if Suppression.objects.filter(
            user=campaign.user, email=recipient_clean, is_active=True
        ).exists():
            return self._skip_contact(
                campaign,
                contact,
                "Skipped: recipient is on suppression list (unsubscribed/bounced)",
            )

        # 2. Per-account recipient cooldown. Bypass for deliberate intent follow-ups
        cooldown_days = getattr(campaign.user, "recipient_cooldown_days", 30) or 0
        if cooldown_days > 0 and not campaign.allow_repeat and not is_intent_followup:
            cutoff = timezone.now() - datetime.timedelta(days=cooldown_days)
            previous = (
                RecipientSend.objects.filter(
                    user=campaign.user,
                    recipient=recipient_clean,
                    sent_at__gte=cutoff,
                )
                .order_by("-sent_at")
                .first()
            )
            if previous:
                reason = (
                    f"Skipped: already emailed by this account within the last "
                    f"{cooldown_days} day(s)"
                )
                if previous.campaign_id:
                    reason += f" (campaign #{previous.campaign_id})"
                return self._skip_contact(campaign, contact, reason)

        identity = self.get_identity_for_send(campaign)
        api_key = identity.get_decrypted_password()
        is_brevo_api = (
            identity.host in ["api.brevo.com", "brevo", "brevo_api"]
        ) or (api_key and api_key.startswith("xkeysib-"))

        from_email = identity.smtp_from_email or identity.smtp_user
        from_name = identity.smtp_from_name
        message_domain = (
            from_email.split("@")[-1] if from_email and "@" in from_email else "bemailsender.local"
        )
        # Deterministic Message-ID: a retry of the same contact keeps the same
        # ID, allowing receiving servers to deduplicate it.
        message_id = (
            f"<campaign-{campaign.id}.contact-{contact.id}@{message_domain}>"
        )

        # Generate plain text version from HTML. Strip style/script contents so
        # CSS does not leak into the text/plain part.
        plain_text = re.sub(
            r"<(script|style)[^>]*>.*?</\1>",
            " ",
            body or "",
            flags=re.IGNORECASE | re.DOTALL,
        )
        plain_text = re.sub(r"<[^>]+>", " ", plain_text)
        plain_text = html_module.unescape(plain_text)
        plain_text = re.sub(r"\n\s*\n", "\n\n", plain_text.strip())
        plain_text = plain_text.replace("&nbsp;", " ").replace("&amp;", "&")

        # Append unsubscribe link, company physical address, and tracking pixel
        # Must be a public live URL so external email providers (Gmail, Outlook, Brevo) can fetch the pixel
        tracking_base = getattr(settings, "TRACKING_BASE_URL", None) or os.environ.get("TRACKING_BASE_URL")
        frontend_base = getattr(settings, "FRONTEND_URL", "https://mailer.blueglobaltechnology.com")
        if tracking_base and not tracking_base.startswith("http://localhost") and not tracking_base.startswith("http://127.0.0.1"):
            base_url = tracking_base
        elif frontend_base and not frontend_base.startswith("http://localhost") and not frontend_base.startswith("http://127.0.0.1"):
            base_url = frontend_base
        else:
            base_url = "https://mailer.blueglobaltechnology.com"

        pixel_url = f"{base_url}/api/track/open/{campaign.id}/{contact.recipient}/"
        unsub_url = f"{base_url}/api/unsubscribe/{campaign.id}/{contact.recipient}/"
        pixel_tag = (
            f'<img src="{pixel_url}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;"/>'
        )

        user = campaign.user
        unsub_text = (
            getattr(user, "global_unsubscribe_text", "")
            or "If you'd rather not hear from us, click here to unsubscribe."
        )
        company_addr = getattr(user, "company_address", "") or ""
        company_name = getattr(user, "company_name", "") or ""

        company_html = ""
        if company_name or company_addr:
            c_lines = []
            if company_name:
                c_lines.append(f"<span style='font-weight:600;'>{html_module.escape(company_name)}</span>")
            if company_addr:
                c_lines.append(html_module.escape(company_addr).replace("\n", "<br/>"))
            company_html = (
                f'<div style="margin-top:6px;font-size:11px;color:#9ca3af;line-height:1.4;">'
                f"{'<br/>'.join(c_lines)}"
                f'</div>'
            )

        unsubscribe_html = (
            '<div style="font-size:12px;color:#9ca3af;text-align:center;margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;">'
            f'<p style="margin:0;"><a href="{unsub_url}" style="color:#6b7280;text-decoration:underline;">{html_module.escape(unsub_text)}</a></p>'
            f'{company_html}'
            "</div>"
        )
        footer_html = unsubscribe_html + "\n" + pixel_tag
        final_body = body
        if "</body>" in final_body:
            final_body = final_body.replace("</body>", footer_html + "\n</body>")
        else:
            final_body = final_body + footer_html

        # Wrap HTML links with click-tracking redirects so interest is tracked
        import urllib.parse
        def _replace_href(match):
            href = match.group(1)
            if href.startswith("mailto:") or "unsubscribe" in href.lower() or "/api/unsubscribe" in href or "/api/track" in href:
                return match.group(0)
            encoded_url = urllib.parse.quote(href, safe="")
            track_url = f"{base_url}/api/track/click/{campaign.id}/{contact.recipient}/?url={encoded_url}"
            return f'href="{track_url}"'

        final_body = re.sub(r'href=["\'](https?://[^"\']+)["\']', _replace_href, final_body)

        enforce_one_click = getattr(user, "enforce_one_click_unsub", True)

        if is_brevo_api:
            sender_payload = {"email": from_email}
            if from_name:
                sender_payload["name"] = from_name

            brevo_headers = {
                "List-Unsubscribe": f"<{unsub_url}>, <mailto:{from_email}?subject=unsubscribe>",
                "Message-ID": message_id,
            }
            if enforce_one_click:
                brevo_headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"

            payload = {
                "sender": sender_payload,
                "to": [{"email": contact.recipient}],
                "subject": subject,
                "htmlContent": final_body,
                "textContent": plain_text,
                "replyTo": {"email": from_email},
                "headers": brevo_headers,
            }

            resp = requests.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "accept": "application/json",
                    "api-key": api_key,
                    "content-type": "application/json",
                },
                json=payload,
                timeout=30,
            )

            if resp.status_code in [200, 201, 202]:
                identity.daily_sent = models.F("daily_sent") + 1
                identity.save(update_fields=["daily_sent"])

                # Write the cooldown ledger immediately after the provider
                # accepts the email. If the contact update below fails, a retry
                # will still be skipped instead of sending a duplicate.
                self._record_recipient_send(campaign, contact)
                contact.status = "sent"
                contact.skip_reason = None
                contact.save()
                Log.objects.create(
                    campaign=campaign,
                    recipient=contact.recipient,
                    status="success",
                    message="Email sent successfully via Brevo API",
                )
                return "sent"

            err_text = resp.text
            try:
                err_json = resp.json()
                err_text = err_json.get("message", resp.text)
            except Exception:
                pass
            raise Exception(f"Brevo API error ({resp.status_code}): {err_text}")

        # Standard SMTP send
        connection = get_connection(
            backend="django.core.mail.backends.smtp.EmailBackend",
            host=identity.host,
            port=identity.port,
            username=identity.smtp_user,
            password=api_key,
            use_tls=identity.use_tls,
            use_ssl=identity.use_ssl,
            timeout=30,
        )

        sender = from_email
        if from_name:
            sender = f"{from_name} <{from_email}>"

        smtp_headers = {
            "Message-ID": message_id,
            "List-Unsubscribe": f"<{unsub_url}>, <mailto:{identity.smtp_user}?subject=unsubscribe>",
            "Reply-To": from_email,
        }
        if enforce_one_click:
            smtp_headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"

        email = EmailMultiAlternatives(
            subject=subject,
            body=plain_text,
            from_email=sender,
            to=[contact.recipient],
            connection=connection,
            headers=smtp_headers,
        )
        email.attach_alternative(final_body, "text/html")
        email.send()

        identity.daily_sent = models.F("daily_sent") + 1
        identity.save(update_fields=["daily_sent"])

        # Ledger first, so a later DB error cannot cause a duplicate send.
        self._record_recipient_send(campaign, contact)
        contact.status = "sent"
        contact.skip_reason = None
        contact.save()
        Log.objects.create(
            campaign=campaign,
            recipient=contact.recipient,
            status="success",
            message="Email sent successfully",
        )
        return "sent"
