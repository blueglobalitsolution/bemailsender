import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import csv from "csv-parser";
import fs from "fs";
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import QRCode from "qrcode";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-for-dev-only";

app.use(express.json());

// Setup SQLite DB
const db = new Database("bemailsender.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT
  );
  
  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    subject TEXT,
    body TEXT,
    type TEXT DEFAULT 'email',
    design TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    status TEXT,
    type TEXT DEFAULT 'email',
    total_sent INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    template_id INTEGER,
    identity_id INTEGER,
    delay_ms INTEGER,
    use_gemini BOOLEAN,
    schedule_days TEXT,
    schedule_start_time TEXT,
    schedule_end_time TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS campaign_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    email TEXT,
    data TEXT,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id)
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    recipient TEXT,
    status TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id)
  );

  CREATE TABLE IF NOT EXISTS identities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    host TEXT,
    port INTEGER,
    user TEXT,
    pass TEXT,
    secure BOOLEAN,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Seed default user
try { db.exec("ALTER TABLE campaigns ADD COLUMN template_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE campaigns ADD COLUMN identity_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE campaigns ADD COLUMN delay_ms INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE campaigns ADD COLUMN use_gemini BOOLEAN"); } catch (e) {}
try { db.exec("ALTER TABLE campaigns ADD COLUMN schedule_days TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE campaigns ADD COLUMN schedule_start_time TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE campaigns ADD COLUMN schedule_end_time TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE templates ADD COLUMN design TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE templates ADD COLUMN type TEXT DEFAULT 'email'"); } catch (e) {}
try { db.exec("ALTER TABLE campaigns ADD COLUMN type TEXT DEFAULT 'email'"); } catch (e) {}

const defaultEmail = "admin@example.com";
const defaultPassword = "password123";
const existingUser = db.prepare("SELECT * FROM users WHERE email = ?").get(defaultEmail);
if (!existingUser) {
  const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
  db.prepare("INSERT INTO users (email, password) VALUES (?, ?)").run(defaultEmail, hashedPassword);
  console.log(`Default user created: ${defaultEmail} / ${defaultPassword}`);
}

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- WhatsApp Client Manager ---
const whatsappClients = new Map<number, any>();
const whatsappQRs = new Map<number, string>();
const whatsappStatuses = new Map<number, string>();

async function getWhatsAppClient(userId: number) {
  if (whatsappClients.has(userId)) {
    return whatsappClients.get(userId);
  }

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: `user-${userId}` }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  client.on('qr', async (qr) => {
    try {
      const qrDataUri = await QRCode.toDataURL(qr);
      whatsappQRs.set(userId, qrDataUri);
      whatsappStatuses.set(userId, 'qr');
    } catch (err) {
      console.error("QR Generation error:", err);
    }
  });

  client.on('ready', () => {
    whatsappQRs.delete(userId);
    whatsappStatuses.set(userId, 'ready');
    console.log(`WhatsApp client ready for user ${userId}`);
  });

  client.on('authenticated', () => {
    whatsappStatuses.set(userId, 'authenticated');
  });

  client.on('auth_failure', () => {
    whatsappStatuses.set(userId, 'auth_failure');
  });

  client.on('disconnected', () => {
    whatsappStatuses.set(userId, 'disconnected');
    whatsappClients.delete(userId);
  });

  whatsappClients.set(userId, client);
  whatsappStatuses.set(userId, 'initializing');
  client.initialize().catch(err => {
    console.error("WhatsApp initialization error:", err);
    whatsappStatuses.set(userId, 'error');
  });
  return client;
}

// --- API Routes ---

// Auth
app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare("INSERT INTO users (email, password) VALUES (?, ?)");
    const info = stmt.run(email, hashedPassword);
    res.json({ id: info.lastInsertRowid, email });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
  if (!user) return res.status(400).json({ error: "User not found" });

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(400).json({ error: "Invalid password" });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
  res.json({ token, user: { id: user.id, email: user.email } });
});

app.post("/api/auth/forgot-password", (req, res) => {
  // Mock forgot password
  res.json({ message: "Password reset link sent to email (mocked)" });
});

// Templates
app.get("/api/templates", authenticateToken, (req: any, res) => {
  const type = req.query.type;
  let sql = "SELECT * FROM templates WHERE user_id = ?";
  const params = [req.user.id];
  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }
  const templates = db.prepare(sql).all(...params);
  res.json(templates.map((t: any) => ({ ...t, design: t.design ? JSON.parse(t.design) : null })));
});

app.post("/api/templates", authenticateToken, (req: any, res) => {
  const { name, subject, body, design, type } = req.body;
  const stmt = db.prepare("INSERT INTO templates (user_id, name, subject, body, design, type) VALUES (?, ?, ?, ?, ?, ?)");
  const info = stmt.run(req.user.id, name, subject || null, body, design ? JSON.stringify(design) : null, type || 'email');
  res.json({ id: info.lastInsertRowid, name, subject, body, design, type });
});

app.put("/api/templates/:id", authenticateToken, (req: any, res) => {
  const { name, subject, body, design, type } = req.body;
  const stmt = db.prepare("UPDATE templates SET name = ?, subject = ?, body = ?, design = ?, type = ? WHERE id = ? AND user_id = ?");
  stmt.run(name, subject || null, body, design ? JSON.stringify(design) : null, type || 'email', req.params.id, req.user.id);
  res.json({ id: req.params.id, name, subject, body, design, type });
});

app.delete("/api/templates/:id", authenticateToken, (req: any, res) => {
  db.prepare("DELETE FROM templates WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
  res.json({ success: true });
});

// Identities
app.get("/api/identities", authenticateToken, (req: any, res) => {
  const identities = db.prepare("SELECT id, name, host, port, user, secure FROM identities WHERE user_id = ?").all(req.user.id);
  res.json(identities);
});

app.post("/api/identities", authenticateToken, (req: any, res) => {
  const { name, host, port, user, pass, secure } = req.body;
  const stmt = db.prepare("INSERT INTO identities (user_id, name, host, port, user, pass, secure) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const info = stmt.run(req.user.id, name, host, parseInt(port), user, pass, secure === 'true' || secure === true ? 1 : 0);
  res.json({ id: info.lastInsertRowid, name, host, port, user, secure });
});

app.delete("/api/identities/:id", authenticateToken, (req: any, res) => {
  db.prepare("DELETE FROM identities WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
  res.json({ success: true });
});

// WhatsApp Status & QR
app.get("/api/whatsapp/status", authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  const status = whatsappStatuses.get(userId) || 'not_initialized';
  const qr = whatsappQRs.get(userId);
  res.json({ status, qr });
});

app.post("/api/whatsapp/initialize", authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  getWhatsAppClient(userId);
  res.json({ message: "Initializing WhatsApp client" });
});

app.post("/api/whatsapp/logout", authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  const client = whatsappClients.get(userId);
  if (client) {
    try {
      await client.logout();
      await client.destroy();
    } catch (e) {}
    whatsappClients.delete(userId);
    whatsappStatuses.set(userId, 'logged_out');
    whatsappQRs.delete(userId);
  }
  res.json({ message: "Logged out from WhatsApp" });
});

// Campaigns & Sending
const upload = multer({ dest: 'uploads/' });

app.post("/api/campaigns/send", authenticateToken, upload.single('csv'), async (req: any, res) => {
  const { name, templateId, identityId, delayMs, useGemini, scheduleDays, startTime, endTime, type } = req.body;
  
  if (!req.file) return res.status(400).json({ error: "CSV file is required" });

  const template = db.prepare("SELECT * FROM templates WHERE id = ? AND user_id = ?").get(templateId, req.user.id) as any;
  if (!template) return res.status(404).json({ error: "Template not found" });

  if (type === 'email') {
    const identity = db.prepare("SELECT * FROM identities WHERE id = ? AND user_id = ?").get(identityId, req.user.id) as any;
    if (!identity) return res.status(404).json({ error: "Identity not found" });
  }

  const campaignStmt = db.prepare(`
    INSERT INTO campaigns (user_id, name, status, template_id, identity_id, delay_ms, use_gemini, schedule_days, schedule_start_time, schedule_end_time, type) 
    VALUES (?, ?, 'scheduled', ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const campaignInfo = campaignStmt.run(
    req.user.id, name, templateId, identityId || null, delayMs, useGemini === 'true' ? 1 : 0, 
    scheduleDays || '[]', startTime || '', endTime || '', type || 'email'
  );
  const campaignId = campaignInfo.lastInsertRowid;

  res.json({ message: "Campaign scheduled", campaignId });

  // Process CSV and insert contacts
  const results: any[] = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      fs.unlinkSync(req.file.path); // cleanup
      
      const insertContact = db.prepare("INSERT INTO campaign_contacts (campaign_id, email, data) VALUES (?, ?, ?)");
      const insertMany = db.transaction((contacts) => {
        for (const contact of contacts) {
          const recipient = contact.email || contact.phone || contact.Phone || contact.Email || contact.recipient;
          if (recipient) {
            insertContact.run(campaignId, recipient, JSON.stringify(contact));
          }
        }
      });
      insertMany(results);
    });
});

app.get("/api/campaigns", authenticateToken, (req: any, res) => {
  const campaigns = db.prepare("SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
  res.json(campaigns);
});

app.get("/api/campaigns/:id/logs", authenticateToken, (req: any, res) => {
  const logs = db.prepare("SELECT * FROM logs WHERE campaign_id = ? ORDER BY created_at DESC").all(req.params.id);
  res.json(logs);
});

app.delete("/api/campaigns/:id", authenticateToken, (req: any, res) => {
  const campaignId = req.params.id;
  const userId = req.user.id;

  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ? AND user_id = ?").get(campaignId, userId);
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  db.prepare("DELETE FROM logs WHERE campaign_id = ?").run(campaignId);
  db.prepare("DELETE FROM campaign_contacts WHERE campaign_id = ?").run(campaignId);
  db.prepare("DELETE FROM campaigns WHERE id = ?").run(campaignId);

  res.json({ success: true });
});

// --- Background Worker ---
const activeCampaignLoops = new Map<number, boolean>();

async function processCampaign(campaign: any) {
  const delayMs = campaign.delay_ms || 1000;
  
  const template = db.prepare("SELECT * FROM templates WHERE id = ?").get(campaign.template_id) as any;
  if (!template) {
    db.prepare("UPDATE campaigns SET status = 'failed' WHERE id = ?").run(campaign.id);
    activeCampaignLoops.delete(campaign.id);
    return;
  }

  let transporter: any = null;
  let whatsappClient: any = null;

  if (campaign.type === 'email') {
    const identity = db.prepare("SELECT * FROM identities WHERE id = ?").get(campaign.identity_id) as any;
    if (!identity) {
      db.prepare("UPDATE campaigns SET status = 'failed' WHERE id = ?").run(campaign.id);
      activeCampaignLoops.delete(campaign.id);
      return;
    }
    transporter = nodemailer.createTransport({
      host: identity.host,
      port: identity.port,
      secure: identity.secure === 1,
      auth: {
        user: identity.user,
        pass: identity.pass,
      },
    });
  } else if (campaign.type === 'whatsapp') {
    whatsappClient = whatsappClients.get(campaign.user_id);
    if (!whatsappClient || whatsappStatuses.get(campaign.user_id) !== 'ready') {
      db.prepare("UPDATE campaigns SET status = 'failed' WHERE id = ?").run(campaign.id);
      activeCampaignLoops.delete(campaign.id);
      return;
    }
  }

  let ai: GoogleGenAI | null = null;
  if (campaign.use_gemini === 1 && process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  while (activeCampaignLoops.get(campaign.id)) {
    const contact = db.prepare("SELECT * FROM campaign_contacts WHERE campaign_id = ? AND status = 'pending' LIMIT 1").get(campaign.id) as any;
    
    if (!contact) {
      db.prepare("UPDATE campaigns SET status = 'completed' WHERE id = ?").run(campaign.id);
      activeCampaignLoops.delete(campaign.id);
      break;
    }

    const row = JSON.parse(contact.data);
    const recipient = contact.email; // For WhatsApp, this is the phone number
    let finalBody = template.body;
    let finalSubject = template.subject;

    for (const [key, value] of Object.entries(row)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      finalBody = finalBody.replace(regex, String(value));
      if (finalSubject) finalSubject = finalSubject.replace(regex, String(value));
    }

    if (ai) {
      try {
        const prompt = `Generate a short, warm, one-sentence introductory greeting for a ${campaign.type} to ${row.first_name || 'a person'} who works at ${row.company || 'a company'}. Make it sound natural and professional.`;
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });
        const intro = response.text || "";
        if (campaign.type === 'email') {
          finalBody = `<p>${intro}</p>` + finalBody;
        } else {
          finalBody = intro + "\n\n" + finalBody;
        }
      } catch (e) {
        console.error("Gemini error:", e);
      }
    }

    try {
      if (campaign.type === 'email') {
        const identity = db.prepare("SELECT * FROM identities WHERE id = ?").get(campaign.identity_id) as any;
        await transporter.sendMail({
          from: identity.user,
          to: recipient,
          subject: finalSubject,
          html: finalBody,
        });
      } else {
        // WhatsApp sending
        let chatId = recipient.replace(/\D/g, '');
        if (!chatId.endsWith('@c.us')) chatId += '@c.us';
        await whatsappClient.sendMessage(chatId, finalBody);
      }

      db.prepare("UPDATE campaign_contacts SET status = 'sent' WHERE id = ?").run(contact.id);
      db.prepare("INSERT INTO logs (campaign_id, recipient, status, message) VALUES (?, ?, 'success', 'Sent successfully')").run(campaign.id, recipient);
      db.prepare("UPDATE campaigns SET total_sent = total_sent + 1 WHERE id = ?").run(campaign.id);
    } catch (error: any) {
      db.prepare("UPDATE campaign_contacts SET status = 'failed' WHERE id = ?").run(contact.id);
      db.prepare("INSERT INTO logs (campaign_id, recipient, status, message) VALUES (?, ?, 'error', ?)").run(campaign.id, recipient, error.message);
      db.prepare("UPDATE campaigns SET total_failed = total_failed + 1 WHERE id = ?").run(campaign.id);
    }

    if (delayMs) {
      await new Promise(resolve => setTimeout(resolve, parseInt(delayMs)));
    }
  }
}

setInterval(() => {
  const now = new Date();
  const currentDay = now.getDay(); // 0-6 (Sun-Sat)
  const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

  const campaigns = db.prepare("SELECT * FROM campaigns WHERE status IN ('scheduled', 'running')").all() as any[];

  for (const campaign of campaigns) {
    let days: number[] = [];
    try { days = JSON.parse(campaign.schedule_days || '[]'); } catch (e) {}
    
    const startTime = campaign.schedule_start_time;
    const endTime = campaign.schedule_end_time;

    let isWithinWindow = true;
    if (days.length > 0 && startTime && endTime) {
      const isDayMatch = days.includes(currentDay);
      let isTimeMatch = false;
      if (startTime <= endTime) {
        isTimeMatch = currentTime >= startTime && currentTime <= endTime;
      } else {
        // Overnight schedule (e.g., 22:00 to 02:00)
        isTimeMatch = currentTime >= startTime || currentTime <= endTime;
      }
      isWithinWindow = isDayMatch && isTimeMatch;
    }

    if (isWithinWindow && !activeCampaignLoops.has(campaign.id)) {
      activeCampaignLoops.set(campaign.id, true);
      db.prepare("UPDATE campaigns SET status = 'running' WHERE id = ?").run(campaign.id);
      processCampaign(campaign);
    } else if (!isWithinWindow && activeCampaignLoops.has(campaign.id)) {
      activeCampaignLoops.set(campaign.id, false);
      db.prepare("UPDATE campaigns SET status = 'scheduled' WHERE id = ?").run(campaign.id);
    }
  }
}, 10000); // Check every 10 seconds

// --- Vite Middleware ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
