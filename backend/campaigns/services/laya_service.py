import requests
import json
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

class LayaAIService:
    @staticmethod
    def predict_decision(state: str, question: str, options: list, fallback: str = None) -> str:
        """
        Sends structured classification request to Laya (/predict).
        Tries local endpoint first, then remote endpoint, with a fast fallback.
        """
        api_key = getattr(settings, "LAYA_API_KEY", "5e32cdb0b828536dcabf517d42f63865")
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "state": state[:500],
            "question": question,
            "options": options
        }

        endpoints = [
            getattr(settings, "LAYA_BASE_URL", "http://127.0.0.1:8081/predict"),
            getattr(settings, "LAYA_REMOTE_URL", "https://blueglobal.qzz.io/laya/predict")
        ]
        for url in endpoints:
            try:
                response = requests.post(url, headers=headers, json=payload, timeout=4)
                if response.status_code == 200:
                    data = response.json()
                    choice = data.get("choice")
                    if choice in options:
                        return choice
            except Exception as e:
                logger.debug("Laya endpoint %s failed: %s", url, e)

        return fallback or (options[0] if options else "unknown")

    @staticmethod
    def generate_email_completion(prompt: str, model: str = "lfm2.5-1.2b", max_tokens: int = 400) -> str:
        """
        Calls Llama endpoint (/v1/chat/completions) to generate email copy.
        """
        api_key = getattr(settings, "LAYA_API_KEY", "5e32cdb0b828536dcabf517d42f63865")
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a world-class cold email and copywriting expert. Always generate high-converting, concise emails with placeholders like {{name}}, {{company}}."
                },
                {"role": "user", "content": prompt}
            ],
            "max_tokens": max_tokens,
            "temperature": 0.7
        }

        endpoints = [
            getattr(settings, "LLAMA_BASE_URL", "http://127.0.0.1:8080/v1/chat/completions"),
            getattr(settings, "LLAMA_REMOTE_URL", "https://blueglobal.qzz.io/v1/chat/completions")
        ]
        for url in endpoints:
            try:
                response = requests.post(url, headers=headers, json=payload, timeout=8)
                if response.status_code == 200:
                    data = response.json()
                    choices = data.get("choices", [])
                    if choices and "message" in choices[0]:
                        return choices[0]["message"].get("content", "").strip()
            except Exception as e:
                logger.debug("Llama endpoint %s failed: %s", url, e)

        return ""

    @classmethod
    def generate_email_from_reference(cls, reference: str, requested_tone: str = "auto", custom_instruction: str = "") -> dict:
        """
        Two-stage AI workflow:
        Stage 1: Laya classifies target style, audience, and intent.
        Stage 2: Llama generates high-converting Subject Line & Body.
        Includes a resilient template synthesis fallback if models are offline.
        """
        # 1. Decision via Laya
        intent_options = ["cold_outreach", "follow_up", "promotional_offer", "newsletter", "re_engagement"]
        detected_intent = cls.predict_decision(
            state=reference,
            question="Determine primary email type and objective",
            options=intent_options,
            fallback="cold_outreach"
        )

        tone_options = ["conversational", "professional", "urgent", "friendly"]
        detected_tone = requested_tone if requested_tone != "auto" else cls.predict_decision(
            state=f"{reference}\nInstruction: {custom_instruction}",
            question="Select best tone of voice",
            options=tone_options,
            fallback="conversational"
        )

        # 2. Generation via Llama
        gen_prompt = (
            f"REFERENCE MATERIAL / NOTES:\n{reference}\n\n"
            f"EMAIL TYPE: {detected_intent}\n"
            f"TONE: {detected_tone}\n"
            f"EXTRA INSTRUCTION: {custom_instruction or 'None'}\n\n"
            "Generate:\n"
            "1. Two subject lines (Subject Option 1, Subject Option 2)\n"
            "2. Complete email body ready to send with placeholders {{name}}, {{company}}.\n"
            "Format your answer cleanly with SUBJECT: and BODY: tags."
        )

        ai_generated_text = cls.generate_email_completion(gen_prompt, max_tokens=450)

        if ai_generated_text and "BODY:" in ai_generated_text:
            # Parse AI output
            lines = ai_generated_text.splitlines()
            subject = ""
            body_lines = []
            capture_body = False

            for line in lines:
                if "SUBJECT:" in line.upper():
                    subject = line.replace("SUBJECT:", "").replace("Subject:", "").strip()
                elif "BODY:" in line.upper():
                    capture_body = True
                elif capture_body:
                    body_lines.append(line)

            final_body = "\n".join(body_lines).strip() or ai_generated_text
            final_subject = subject or "Quick question regarding {{company}}"
            return {
                "detected_intent": detected_intent,
                "tone": detected_tone,
                "subject": final_subject,
                "body": final_body,
                "engine": "laya+llama"
            }

        # 3. Intelligent fallback generator (if server is booting/timing out)
        fallback_data = cls._generate_smart_fallback(reference, detected_intent, detected_tone, custom_instruction)
        fallback_data["detected_intent"] = detected_intent
        fallback_data["tone"] = detected_tone
        fallback_data["engine"] = "laya_heuristic"
        return fallback_data

    @staticmethod
    def _generate_smart_fallback(reference: str, intent: str, tone: str, instruction: str) -> dict:
        """
        Creates a well-crafted structured email from reference text even if external LLM times out.
        """
        clean_ref = reference.strip()
        preview = clean_ref[:120]

        if intent == "follow_up":
            subject = "Following up on my previous note - {{company}}"
            body = (
                "Hi {{name}},\n\n"
                "I wanted to quickly follow up regarding my earlier note.\n\n"
                f"As mentioned: {preview}...\n\n"
                "Would you be open to a 5-minute chat this week to see if this aligns with your current priorities?\n\n"
                "Best regards,\n{{sender_name}}"
            )
        elif intent == "promotional_offer":
            subject = "Exclusive opportunity for {{company}}"
            body = (
                "Hi {{name}},\n\n"
                f"We are currently rolling out an exclusive update: {preview}\n\n"
                "I thought this would be directly relevant to what you are doing at {{company}}.\n\n"
                "Feel free to reply here if you'd like me to share more details.\n\n"
                "Cheers,\n{{sender_name}}"
            )
        else: # cold_outreach or default
            subject = "Idea for {{company}} regarding " + (preview[:30] if len(preview) > 10 else "growth")
            body = (
                "Hi {{name}},\n\n"
                f"I came across {{company}} and noticed your focus on {preview[:50]}.\n\n"
                f"{clean_ref}\n\n"
                "Are you available for a brief 10-minute introductory call this Tuesday or Thursday?\n\n"
                "Best,\n{{sender_name}}"
            )

        return {
            "subject": subject,
            "body": body
        }

    @classmethod
    def evaluate_lead_qualification(cls, lead_data: dict, icp_rules: dict = None) -> dict:
        """
        Two-stage AI Lead Qualification Pipeline using Laya + Llama:
        Stage 1: Laya predicts decision: ['qualified', 'review', 'disqualified'].
        Stage 2: Llama provides executive qualification scoring (0-100) and actionable reasoning.
        """
        lead_summary = ", ".join([f"{k}: {v}" for k, v in lead_data.items() if v])
        
        # Heuristic scoring boost
        email_str = ""
        for k, v in lead_data.items():
            if "email" in k.lower():
                email_str = str(v).lower()
                break

        is_free_email = any(email_str.endswith(dom) for dom in ["@gmail.com", "@yahoo.com", "@hotmail.com", "@outlook.com", "@icloud.com"])
        
        # Stage 1: Decision via Laya
        decision_options = ["qualified", "review", "disqualified"]
        question = "Classify this lead's business purchasing intent and enterprise qualification based on submitted contact data."
        predicted_status = cls.predict_decision(
            state=lead_summary,
            question=question,
            options=decision_options,
            fallback="review" if is_free_email else "qualified"
        )

        # Stage 2: Detailed assessment via Llama
        score = 85
        reason = "Lead demonstrates high potential purchase intent and valid commercial profile."

        prompt = (
            f"Evaluate this lead for a B2B sales pipeline:\n{lead_summary}\n\n"
            "Return JSON in this exact format: {\"score\": 85, \"status\": \"qualified\", \"reason\": \"Executive decision maker with valid business domain\"}. "
            "Score must be 0 to 100. Status must be one of: qualified, review, disqualified."
        )

        llm_response = cls.generate_email_completion(prompt, max_tokens=150)
        if llm_response:
            try:
                # Find JSON block in output
                import re
                json_match = re.search(r"\{[\s\S]*\}", llm_response)
                if json_match:
                    parsed = json.loads(json_match.group(0))
                    score = int(parsed.get("score", 75))
                    status_val = str(parsed.get("status", predicted_status)).lower()
                    if status_val in decision_options:
                        predicted_status = status_val
                    reason = str(parsed.get("reason", reason)).strip()
            except Exception as e:
                logger.debug("Could not parse LLM lead qualification JSON: %s", e)

        # If free email, cap score unless strong company info
        if is_free_email and score > 70:
            score = max(50, score - 20)
            if predicted_status == "qualified":
                predicted_status = "review"
            reason += " (Note: Personal/generic email domain detected)"

        return {
            "score": score,
            "status": predicted_status,
            "is_qualified": predicted_status == "qualified",
            "reason": reason
        }

    @classmethod
    def extract_decision_maker_and_contact(cls, title: str, domain: str, snippet: str, about_text: str, emails: list, target_category: str) -> dict:
        """
        Intelligent Contact & Decision Maker Extraction:
        Parses About Us, Team bio, snippet, and company info to extract:
        - Owner / Doctor / Founder / CEO Full Name (e.g. Dr. Ashish Patel)
        - Exact Designation / Title (e.g. Chief Dentist, Founder & CEO)
        - Specific decision maker direct email (resolving obfuscated emails)
        Combines pattern heuristics with LLaMA executive extraction.
        """
        combined_text = f"{title}. {snippet}. {about_text}"
        
        dm_name = ""
        dm_title = ""
        dm_email = ""

        # 1. Heuristic Pattern Matches (Fast, high precision)
        import re

        # Doctor pattern (e.g. "Dr. Ashish Patel", "Dr. Rajesh Sharma")
        doc_match = re.search(r"\b(Dr\.\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b", combined_text)
        if doc_match:
            dm_name = doc_match.group(1).strip()
            # Look for dental / medical title
            if re.search(r"\b(Chief Dentist|Dentist|Orthodontist|Implantologist|Surgeon|Director|Founder|Owner)\b", combined_text, re.I):
                t_match = re.search(r"\b(Chief Dentist|Orthodontist|Implantologist|Surgeon|Founder & Director|Director|Dentist)\b", combined_text, re.I)
                dm_title = t_match.group(1) if t_match else "Doctor / Specialist"
            else:
                dm_title = "Doctor / Specialist"

        # Founder / CEO pattern if no doctor found
        if not dm_name:
            exec_match = re.search(
                r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*(?:[-–,|]\s*|\s+is\s+the\s+|\s+as\s+)?(Founder\s*(?:&\s*CEO)?|Co-Founder|Chief Executive Officer|CEO|Managing Director|Director|Owner|Principal)\b",
                combined_text,
                re.I
            )
            if exec_match:
                dm_name = exec_match.group(1).strip()
                dm_title = exec_match.group(2).strip()

        # 2. De-obfuscate or map specific personal email
        if emails:
            # Check for email matching decision maker's name
            first_name = dm_name.split()[1].lower() if ("Dr." in dm_name and len(dm_name.split()) > 1) else (dm_name.split()[0].lower() if dm_name else "")
            for em in emails:
                em_user = em.split("@")[0].lower()
                if first_name and first_name in em_user:
                    dm_email = em
                    break
            if not dm_email:
                non_generic = [e for e in emails if not any(e.startswith(p) for p in ["info@", "support@", "admin@", "contact@", "help@"])]
                dm_email = non_generic[0] if non_generic else emails[0]

        # 3. LLaMA Semantic Extraction for enhanced accuracy
        if about_text and len(about_text) > 40:
            prompt = (
                f"Extract the primary decision maker (Owner, Founder, Doctor, CEO, Managing Director) from this business profile:\n"
                f"Business: {title}\n"
                f"Domain: {domain}\n"
                f"Industry: {target_category}\n"
                f"About/Team Info: {about_text[:800]}\n"
                f"Emails: {', '.join(emails[:3])}\n\n"
                "Return JSON in this exact format:\n"
                "{\n"
                '  "decision_maker_name": "Full Name or null",\n'
                '  "decision_maker_title": "Designation or null",\n'
                '  "decision_maker_email": "direct email or null"\n'
                "}\n"
                "Only return actual person names mentioned in the text. Do not invent names."
            )
            try:
                llm_res = cls.generate_email_completion(prompt, max_tokens=120)
                if llm_res:
                    match = re.search(r"\{[\s\S]*\}", llm_res)
                    if match:
                        data = json.loads(match.group(0))
                        llm_name = (data.get("decision_maker_name") or "").strip()
                        llm_title = (data.get("decision_maker_title") or "").strip()
                        llm_em = (data.get("decision_maker_email") or "").strip()
                        if llm_name and llm_name.lower() not in ["null", "none", "n/a", ""]:
                            dm_name = llm_name
                        if llm_title and llm_title.lower() not in ["null", "none", "n/a", ""]:
                            dm_title = llm_title
                        if llm_em and "@" in llm_em and llm_em.lower() not in ["null", "none", "n/a", ""]:
                            dm_email = llm_em
            except Exception as e:
                logger.debug("LLaMA decision maker extraction error: %s", e)

        return {
            "decision_maker_name": dm_name,
            "decision_maker_title": dm_title,
            "decision_maker_email": dm_email,
        }

    @classmethod
    def qualify_scraped_business(cls, title: str, domain: str, snippet: str, target_category: str, location: str, about_text: str = "", emails: list = None) -> dict:
        """
        AI Lead Qualification for Scraped Candidates:
        Uses Laya decision model + heuristic validation to filter out blogs, articles, and directory junk,
        and extracts Decision Maker & intelligent contact details for qualified companies.
        """
        summary = f"Business: {title} | Domain: {domain} | Snippet: {snippet[:250]} | Target: {target_category} in {location}"

        # Fast heuristic checks first
        t_low = title.lower()
        s_low = snippet.lower()
        d_low = domain.lower()

        # Obvious junk/tutorials and listicle directories
        junk_indicators = [
            "what is ", "definition", "tutorial", "meaning of", "types of",
            "wikipedia", "geeksforgeeks", "tutorialspoint", "computerhope",
            "w3schools", "how to ", "difference between", "guide:",
            # Aggregator / Directory listicles
            "top 10", "top 20", "top 30", "top 50", "top 100", "top 101", "100 top", "101 ",
            "best startup", "the manifest", "themanifest.com", "techbehemoths", "f6s.com", "clutch.co",
            "goodfirms", "directory", "list of top", "ranking", "rankings", "rankexdigital",
            "lexifo.com", "justdial", "sulekha", "indiamart", "yellowpages", "crunchbase",
            "glassdoor", "ambitionbox", "indeed.com", "naukri.com", "trustpilot"
        ]
        
        import re
        is_listicle_pattern = bool(re.search(r"^(?:\d+\s+top|\d+\s+best|top\s+\d+|\d+\s*[a-z]*\s*based)", t_low))

        if is_listicle_pattern or any(j in t_low or j in s_low or j in d_low for j in junk_indicators):
            return {
                "is_qualified": False,
                "status": "disqualified",
                "score": 25,
                "reason": "Aggregator directory / listicle ranking, not a direct business",
                "decision_maker_name": "",
                "decision_maker_title": "",
                "decision_maker_email": "",
            }

        # Ask Laya AI
        question = f"Is this a legitimate commercial business / service matching '{target_category}' in '{location}' or is it an article/junk?"
        options = ["qualified_business", "junk_or_article"]

        is_valid = True
        try:
            choice = cls.predict_decision(
                state=summary,
                question=question,
                options=options,
                fallback="qualified_business"
            )
            is_valid = (choice == "qualified_business")
        except Exception as e:
            logger.debug("Laya lead qualification error: %s", e)

        if not is_valid:
            return {
                "is_qualified": False,
                "status": "disqualified",
                "score": 35,
                "reason": "Filtered as non-direct business",
                "decision_maker_name": "",
                "decision_maker_title": "",
                "decision_maker_email": "",
            }

        # For qualified businesses, extract Decision Maker & direct contact
        dm_info = cls.extract_decision_maker_and_contact(
            title=title,
            domain=domain,
            snippet=snippet,
            about_text=about_text,
            emails=emails or [],
            target_category=target_category
        )

        return {
            "is_qualified": True,
            "status": "qualified",
            "score": 90,
            "reason": f"Direct commercial entity with verified profile",
            "decision_maker_name": dm_info.get("decision_maker_name", ""),
            "decision_maker_title": dm_info.get("decision_maker_title", ""),
            "decision_maker_email": dm_info.get("decision_maker_email", ""),
        }
