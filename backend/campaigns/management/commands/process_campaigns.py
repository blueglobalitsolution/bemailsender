import time
import json
import datetime
import re
import html as html_module
import requests
from django.core.management.base import BaseCommand
from django.conf import settings
from django.core.mail import get_connection, EmailMultiAlternatives
from django.utils import timezone
from django.db import models, close_old_connections
from django.db.models import Q
from campaigns.models import Campaign, CampaignContact, Log, Identity, IdentityGroup, Template

class Command(BaseCommand):
    help = 'Processes scheduled and running campaigns'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('BEmailSender Campaign Processor Started...'))
        
        while True:
            try:
                close_old_connections()
                self.reset_daily_counters()
                now = timezone.now()
                # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
                python_day = now.weekday()
                # Map to match frontend: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
                current_day = (python_day + 1) % 7
                current_time = now.strftime('%H:%M')

                # Find campaigns that are scheduled or running
                campaigns = Campaign.objects.filter(status__in=['scheduled', 'running'])
                
                any_work_done = False

                for campaign in campaigns:
                    # Auto batch: wait 2 hours after every 100 successful sends
                    if campaign.total_sent > 0 and campaign.total_sent % 100 == 0:
                        gap_seconds = 2 * 60 * 60
                        elapsed = (timezone.now() - campaign.updated_at).total_seconds()
                        if elapsed < gap_seconds:
                            continue

                    is_within_window = True
                    
                    # Check schedule if days are specified
                    if campaign.schedule_days and campaign.schedule_start_time and campaign.schedule_end_time:
                        try:
                            days = json.loads(campaign.schedule_days) if isinstance(campaign.schedule_days, str) else campaign.schedule_days
                            start_time = campaign.schedule_start_time.strftime('%H:%M')
                            end_time = campaign.schedule_end_time.strftime('%H:%M')
                            
                            is_day_match = current_day in days
                            is_time_match = False
                            
                            if start_time <= end_time:
                                is_time_match = start_time <= current_time <= end_time
                            else:
                                # Over-night schedule
                                is_time_match = current_time >= start_time or current_time <= end_time
                                
                            is_within_window = is_day_match and is_time_match
                        except Exception as e:
                            self.stderr.write(f"Scheduling error for campaign {campaign.id}: {str(e)}")
                    
                    if is_within_window:
                        if campaign.status == 'scheduled':
                            self.stdout.write(self.style.SUCCESS(f"Starting campaign: {campaign.name}"))
                            campaign.status = 'running'
                            campaign.save()
                        
                        # Process up to 10 contacts per campaign per cycle to improve throughput
                        # but still allow other campaigns to get a turn
                        for _ in range(10):
                            if self.process_next_contact(campaign):
                                any_work_done = True
                            else:
                                break
                    else:
                        if campaign.status == 'running':
                            self.stdout.write(self.style.WARNING(f"Suspending campaign (out of window): {campaign.name}"))
                            campaign.status = 'scheduled'
                            campaign.save()

            except Exception as e:
                self.stderr.write(f"Cycle error: {str(e)}")
            
            # If we did work, don't wait long. If idle, sleep longer.
            time.sleep(1 if any_work_done else 5)

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
        # Query for pending contacts or failed contacts that were last tried more than 1 hour ago
        one_hour_ago = timezone.now() - datetime.timedelta(hours=1)
        
        contact = CampaignContact.objects.filter(campaign=campaign).filter(
            models.Q(status='pending') | 
            models.Q(status='failed', updated_at__lt=one_hour_ago)
        ).first()
        
        if not contact:
            # Check if all contacts are done (no pending and no failed)
            remaining = CampaignContact.objects.filter(
                campaign=campaign,
                status__in=['pending', 'failed']
            ).count()
            if remaining == 0:
                campaign.status = 'completed'
                campaign.save()
                self.stdout.write(self.style.SUCCESS(f"Campaign completed: {campaign.name}"))
            return False

        try:
            template = campaign.template
            if not template:
                raise Exception("Template missing")

            # Parse contact data for merge tags
            data = json.loads(contact.data) if isinstance(contact.data, str) else contact.data
            body = template.body
            subject = template.subject or ""

            # Replace merge tags
            for key, value in data.items():
                body = body.replace(f"{{{{{key}}}}}", str(value))
                if subject:
                    subject = subject.replace(f"{{{{{key}}}}}", str(value))

            # Send Email
            self.send_email(campaign, contact, subject, body)

            # Update counters
            campaign.total_sent += 1
            campaign.save()

        except Exception as e:
            self.stderr.write(f"Failed to send to {contact.recipient}: {str(e)}")
            contact.status = 'failed'
            contact.save()
            Log.objects.create(campaign=campaign, recipient=contact.recipient, status='error', message=str(e))
            campaign.total_failed += 1
            campaign.save()
            # Don't sleep on failure, try next contact immediately
            return True

        # Apply delay if specified (only after successful send)
        if campaign.delay_ms > 0:
            time.sleep(campaign.delay_ms / 1000.0)

        return True

    def send_email(self, campaign, contact, subject, body):
        identity = self.get_identity_for_send(campaign)

        connection = get_connection(
            backend="django.core.mail.backends.smtp.EmailBackend",
            host=identity.host,
            port=identity.port,
            username=identity.smtp_user,
            password=identity.get_decrypted_password(),
            use_tls=identity.use_tls,
            use_ssl=identity.use_ssl,
            timeout=30,
        )

        from_email = identity.smtp_from_email or identity.smtp_user
        sender = from_email
        if identity.smtp_from_name:
            sender = f"{identity.smtp_from_name} <{from_email}>"

        # Generate plain text version from HTML
        plain_text = re.sub(r"<[^>]+>", "", body)
        plain_text = html_module.unescape(plain_text)
        plain_text = re.sub(r"\n\s*\n", "\n\n", plain_text.strip())
        # Decode common HTML entities for plain text
        plain_text = plain_text.replace("&nbsp;", " ").replace("&amp;", "&")

        from django.utils import timezone as tz_util
        email = EmailMultiAlternatives(
            subject=subject,
            body=plain_text,
            from_email=sender,
            to=[contact.recipient],
            connection=connection,
            headers={
                "Date": tz_util.now().strftime("%a, %d %b %Y %H:%M:%S %z"),
                "Message-ID": f"<{campaign.id}.{contact.id}.{int(time.time())}@bemailsender>",
                "List-Unsubscribe": f"<mailto:{identity.smtp_user}?subject=unsubscribe>",
                "Reply-To": identity.smtp_user,
            },
        )
        # Append unsubscribe link and tracking pixel
        base_url = settings.FRONTEND_URL
        pixel_url = f"{base_url}/api/track/open/{campaign.id}/{contact.recipient}/"
        pixel_tag = f'<img src="{pixel_url}" width="1" height="1" alt="" style="display:none"/>'
        unsubscribe_html = (
            '<p style="font-size:12px;color:#999;text-align:center;margin-top:20px;">'
            f'<a href="mailto:{identity.smtp_user}?subject=unsubscribe" style="color:#999;">Unsubscribe</a>'
            '</p>'
        )
        footer_html = unsubscribe_html + "\n" + pixel_tag
        if "</body>" in body:
            body = body.replace("</body>", footer_html + "\n</body>")
        else:
            body += footer_html
        email.attach_alternative(body, "text/html")
        email.send()

        identity.daily_sent = models.F("daily_sent") + 1
        identity.save(update_fields=["daily_sent"])
        
        contact.status = 'sent'
        contact.save()
        Log.objects.create(campaign=campaign, recipient=contact.recipient, status='success', message="Email sent successfully")
