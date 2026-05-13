import time
import json
import datetime
import requests
from django.core.management.base import BaseCommand
from django.conf import settings
from django.core.mail import get_connection, EmailMessage
from django.utils import timezone
from django.db import models
from campaigns.models import Campaign, CampaignContact, Log, Identity, Template

class Command(BaseCommand):
    help = 'Processes scheduled and running campaigns'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('BEmailSender Campaign Processor Started...'))
        
        while True:
            try:
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

    def process_next_contact(self, campaign):
        # Query for pending contacts or failed contacts that were last tried more than 1 hour ago
        one_hour_ago = timezone.now() - datetime.timedelta(hours=1)
        
        contact = CampaignContact.objects.filter(campaign=campaign).filter(
            models.Q(status='pending') | 
            models.Q(status='failed', updated_at__lt=one_hour_ago)
        ).first()
        
        if not contact:
            # Check if all contacts are done
            if not CampaignContact.objects.filter(campaign=campaign, status='pending').exists():
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

            # Send Message
            if campaign.type == 'email':
                self.send_email(campaign, contact, subject, body)
            else:
                self.send_whatsapp(campaign, contact, body)

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

        # Apply delay if specified
        if campaign.delay_ms > 0:
            time.sleep(campaign.delay_ms / 1000.0)

    def send_email(self, campaign, contact, subject, body):
        identity = campaign.identity
        if not identity:
            raise Exception("Sender identity missing for email campaign")

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

        sender = identity.smtp_user
        if identity.smtp_from_name:
            sender = f"{identity.smtp_from_name} <{identity.smtp_user}>"

        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=sender,
            to=[contact.recipient],
            connection=connection,
        )
        email.content_subtype = "html"
        email.send()
        
        contact.status = 'sent'
        contact.save()
        Log.objects.create(campaign=campaign, recipient=contact.recipient, status='success', message="Email sent successfully")

    def send_whatsapp(self, campaign, contact, body):
        whatsapp_url = getattr(settings, 'WHATSAPP_SERVICE_URL', 'http://localhost:3001')
        api_key = getattr(settings, 'WHATSAPP_API_KEY', '')

        # Construct recipient chatId
        # Usually contact.recipient stores the phone number in WhatsApp campaigns
        phone = contact.recipient.strip().replace(' ', '').replace('+', '')
        
        response = requests.post(
            f"{whatsapp_url}/api/whatsapp/send",
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key
            },
            json={
                "campaignId": campaign.id,
                "recipient": phone,
                "message": body,
                "userId": campaign.user.id
            },
            timeout=30
        )

        if response.status_code == 200:
            contact.status = 'sent'
            contact.save()
            # Note: WhatsApp microservice might also log to Django, but we log here for consistency
            Log.objects.create(campaign=campaign, recipient=contact.email, status='success', message="WhatsApp message sent successfully")
        else:
            error_data = response.json()
            raise Exception(f"WhatsApp API Error: {error_data.get('error', 'Unknown error')}")
