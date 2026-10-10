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
