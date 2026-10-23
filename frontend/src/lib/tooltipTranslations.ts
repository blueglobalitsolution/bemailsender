export interface LocalizedTooltipContent {
  title: string;
  description: string;
  whyItMatters?: string;
  titleHi: string;
  descriptionHi: string;
  whyItMattersHi?: string;
}

export const TOOLTIP_TRANSLATIONS: Record<string, LocalizedTooltipContent> = {
  // --- Step 2: Audience Scan ---
  gravatar: {
    title: "Gravatar Profile Verification",
    description: "Checks the public Gravatar hash database for each contact email to detect registered profile avatars and active web identities.",
    whyItMatters: "Emails associated with active profiles are significantly more likely to belong to real, engaged humans rather than abandoned inboxes or spam traps.",
    titleHi: "Gravatar Profile Verification (प्रोफ़ाइल चेक)",
    descriptionHi: "Har lead ke email ko public Gravatar database mein check karta hai taaki pata chale ki unka registered avatar ya active online identity hai ya nahi.",
    whyItMattersHi: "Active profile wale emails real logo ke hote hain, jisse fake mailboxes aur spam traps se bachav hota hai.",
  },
  csvScan: {
    title: "Pre-Send Safety & Hygiene Scan",
    description: "Scans your list against syntax errors, disposable email domains, active cooldown records, duplicate entries, and unsubscribe lists.",
    whyItMatters: "Prevents severe sender reputation damage by filtering out toxic addresses and spam traps before any email is dispatched.",
    titleHi: "Pre-Send Safety & Hygiene Scan (सफाई व सुरक्षा)",
    descriptionHi: "Email bhejne se pehle aapki list ko scan karta hai—galat format, temporary/disposable emails, duplicate rows aur unsubscribe kiye hue logo ko pehle hi bahar nikal deta hai.",
    whyItMattersHi: "Kharaab ya fake emails hatne se domain block hone se bachta hai aur sender score strong rehta hai.",
  },

  // --- Step 4: Governance & Traffic Control ---
  trafficControl: {
    title: "Email Delivery Delay",
    description: "Adds a mandatory gap between consecutive email dispatches instead of blasting all emails at once.",
    whyItMatters: "Prevents spam filters (Google & Outlook) from detecting automated bulk bursts, ensuring emails land in the primary inbox.",
    titleHi: "Traffic Control Delay (ईमेल भेजने का गैप)",
    descriptionHi: "Har email bhejne ke baad mandatory delay (gap) rakhta hai taaki saari emails ek sath rocket ki tarah blast na hon.",
    whyItMattersHi: "Google aur Outlook continuous burst emails ko spam bot maante hain. Gap rakhne se mails seedha primary inbox mein deliver hoti hain.",
  },
  schedule: {
    title: "Sending Windows & Schedule",
    description: "Restricts email delivery to specific days of the week and designated business hours (e.g. 9 AM to 5 PM).",
    whyItMatters: "B2B prospects are 3x more likely to read and reply when emails arrive during their active work day.",
    titleHi: "Campaign Schedule (ऑफिस टाइमिंग्स व दिन)",
    descriptionHi: "Campaign ko set kiye hue din (jaise Mon-Fri) aur working hours (jaise 9 AM - 5 PM) ke beech hi email bhejne deta hai.",
    whyItMattersHi: "Raat ko ya weekends par bheji gayi mails aksar miss ho jaati hain; working hours mein bhejne se 3x zyada replies aate hain.",
  },
  jitter: {
    title: "Humanized Variance (Jitter)",
    description: "Randomly adds ±5 to 15 seconds to your base delay between outgoing emails.",
    whyItMatters: "Fixed robotic delays (e.g. exactly 15.00s every time) trigger spam bot alarms. Random delays mimic authentic human behavior.",
    titleHi: "Humanized Delivery Variance (नेचुरल इंसानी टाइमिंग)",
    descriptionHi: "Base delay ke sath natural random time (±5 se 15 second) joodta hai taaki har email alag-alag gap par jaye.",
    whyItMattersHi: "Ekdam exact time (jaise clockwork 15 sec) robot/bot ka sign hota hai. Random variation se filters ko lagta hai koi insaan manually bhej raha hai.",
  },
  dailyCap: {
    title: "Daily Send Quota (Cap)",
    description: "Caps the number of emails this campaign can send in a single 24-hour window.",
    whyItMatters: "Prevents account burning and keeps sending volumes within mailbox provider warm-up limits. Automatically resumes next morning.",
    titleHi: "Daily Sending Quota (रोजाना भेजने की लिमिट)",
    descriptionHi: "Ek din (24 ghante) mein is campaign se bheji jaane wali emails ki maximum limit tay karta hai.",
    whyItMattersHi: "Account ko burn hone se bachata hai aur SMTP warmup quota safe rakhta hai. Limit khatam hote hi campaign pause hokar agle din auto-resume ho jaati hai.",
  },
  cooldownWizard: {
    title: "Recipient Cooldown Guardrail",
    description: "Checks your past sending ledger and automatically skips recipients who were already emailed within your configured cooldown window.",
    whyItMatters: "Prevents awkward double-messaging, protects your sender domain from spam complaints, and keeps brand trust intact.",
    titleHi: "Recipient Cooldown Guardrail (दोबारा मेल भेजने से रोक)",
    descriptionHi: "Purana history ledger check karke un logo ko automatically skip kar deta hai jinhe hal hi mein (cooldown days ke andar) mail bhej chuke hain.",
    whyItMattersHi: "Ek hi lead ko baar-baar email bhejkar irritate hone se bachata hai, jisse unsubscribe aur spam report nahi aati.",
  },
  intentFollowup: {
    title: "High-Intent Fast Retargeting",
    description: "Automates immediate discount or follow-up outreach when a lead signals high interest (clicks a product link or opens the email 2+ times).",
    whyItMatters: "Capitalizes on warm lead momentum within 30 minutes, dramatically improving conversion rates (abandoned-cart style).",
    titleHi: "High-Intent Fast Retargeting (गर्म लीड्स को तुरंत फॉलोअप)",
    descriptionHi: "Jab koi lead email ke link par click kare ya 2 se zyada baar open kare, toh system use turant special discount ya follow-up bhej deta hai.",
    whyItMattersHi: "Client ka interest peak par rehte waqt 30 minute mein follow-up karne se deals aur sales conversion bohot jaldi close hoti hain.",
  },

  // --- Settings Page ---
  settingsCooldown: {
    title: "Recipient Cooldown Guardrail",
    description: "Skips any contact who received an email from any of your campaigns within the specified number of days.",
    whyItMatters: "Protects you from spam complaints and unsubscribes by preventing lead over-saturation and fatigue across multiple outreach lists.",
    titleHi: "Global Cooldown Guardrail (ग्लोबल कूलडाउन नियम)",
    descriptionHi: "Kisi bhi aisi lead ko email bhejne se skip kar deta hai jise aapke kisi bhi campaign se pichle N dino mein mail gayi thi.",
    whyItMattersHi: "Multiple campaigns chalne par bhi ek bande ko spam nahi hota, jisse email deliverability hamesha green rehti hai.",
  },
  settingsSchedule: {
    title: "Sending Windows & Business Hours",
    description: "Restricts email broadcasting to specific days of the week and local working hours.",
    whyItMatters: "Cold emails delivered during business hours (9 AM - 6 PM) get up to 3x higher open rates and avoid waking recipients with midnight pings.",
    titleHi: "Sending Windows & Business Hours (कामकाजी घंटे)",
    descriptionHi: "Email broadcast ko tay shuda dino aur time slot tak limit karta hai.",
    whyItMattersHi: "Subah ya working hours mein aane wale emails log pehle check karte hain; raat ko aane wale emails spam folder ya delete ho jaate hain.",
  },
  settingsRfc8058: {
    title: "RFC 8058 One-Click Unsubscribe",
    description: "Injects List-Unsubscribe and List-Unsubscribe-Post email headers required by Google and Yahoo.",
    whyItMatters: "Mandatory since Feb 2024 for sending bulk cold emails; without this, Gmail and Yahoo throttle deliverability or flag emails as spam.",
    titleHi: "RFC 8058 One-Click Unsubscribe (अनसब्सक्राइब हेडर)",
    descriptionHi: "Emails mein official List-Unsubscribe headers lagata hai jo Google aur Yahoo ke naye rules ke hisab se zaroori hain.",
    whyItMattersHi: "2024 se Gmail aur Yahoo ne ise zaroori kar diya hai; agar ye na ho toh emails ko direct spam ya throttle kar diya jata hai.",
  },
  settingsBounceAutoPause: {
    title: "Automated High-Bounce Auto-Pause",
    description: "Automatically freezes active campaigns if the hard bounce rate exceeds your configured threshold.",
    whyItMatters: "High bounce rates (>5%) burn sender reputation fast. Auto-pausing immediately stops damage to your SMTP/domain health.",
    titleHi: "High-Bounce Auto Pause (बाउंस होने पर तुरंत रोक)",
    descriptionHi: "Agar kisi campaign mein 5% se zyada emails bounce (invalid) hoti hain, toh ye campaign ko turant pause kar deta hai.",
    whyItMattersHi: "Lagataar bounce hone se domain turant blacklist ho jaata hai. Auto-pause aapke domain reputation ko permanent damage se bacha leta hai.",
  },
};
