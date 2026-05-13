import express from "express";
import cors from "cors";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import QRCode from "qrcode";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.WHATSAPP_API_KEY || "whatsapp-secret-key-change-in-production";
const DJANGO_URL = process.env.DJANGO_URL || "http://localhost:8000";

app.use(cors());
app.use(express.json());

const authenticateApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== API_KEY) {
    return res.status(403).json({ error: "Invalid API key" });
  }
  next();
};

const whatsappClients = new Map<number, any>();
const whatsappQRs = new Map<number, string>();
const whatsappStatuses = new Map<number, string>();

async function getWhatsAppClient(userId: number) {
  if (whatsappClients.has(userId)) {
    const client = whatsappClients.get(userId);
    const status = whatsappStatuses.get(userId);
    if (status === "ready") {
      return client;
    }
    if (status === "qr" || status === "authenticated" || status === "initializing") {
      return client;
    }
  }

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: `user-${userId}` }),
    puppeteer: {
      executablePath: "/usr/bin/google-chrome-stable" || "/usr/bin/chromium-browser" || "/usr/bin/chromium",
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    },
  });

  client.on("qr", async (qr) => {
    try {
      const qrDataUri = await QRCode.toDataURL(qr);
      whatsappQRs.set(userId, qrDataUri);
      whatsappStatuses.set(userId, "qr");
      console.log(`QR generated for user ${userId}`);
    } catch (err) {
      console.error("QR Generation error:", err);
    }
  });

  client.on("ready", () => {
    whatsappQRs.delete(userId);
    whatsappStatuses.set(userId, "ready");
    console.log(`WhatsApp client ready for user ${userId}`);
  });

  client.on("authenticated", () => {
    whatsappStatuses.set(userId, "authenticated");
    console.log(`WhatsApp authenticated for user ${userId}`);
  });

  client.on("auth_failure", () => {
    whatsappStatuses.set(userId, "auth_failure");
    console.error(`WhatsApp auth failure for user ${userId}`);
  });

  client.on("disconnected", () => {
    whatsappStatuses.set(userId, "disconnected");
    whatsappClients.delete(userId);
    console.log(`WhatsApp disconnected for user ${userId}`);
  });

  whatsappClients.set(userId, client);
  whatsappStatuses.set(userId, "initializing");

  try {
    await client.initialize();
  } catch (err) {
    console.error("WhatsApp initialization error:", err);
    whatsappStatuses.set(userId, "error");
  }

  return client;
}

async function logToDjango(campaignId: number, recipient: string, status: string, message?: string) {
  try {
    await fetch(`${DJANGO_URL}/api/logs/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        campaign: campaignId,
        recipient,
        status,
        message: message || "",
      }),
    });
  } catch (err) {
    console.error("Failed to log to Django:", err);
  }
}

app.get("/api/whatsapp/status", authenticateApiKey, async (req, res) => {
  const userId = parseInt(req.query.userId as string);
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const status = whatsappStatuses.get(userId) || "not_initialized";
  const qr = whatsappQRs.get(userId);

  res.json({ status, qr });
});

app.post("/api/whatsapp/initialize", authenticateApiKey, async (req, res) => {
  const userId = parseInt(req.body.userId);
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  getWhatsAppClient(userId);
  res.json({ message: "Initializing WhatsApp client" });
});

app.post("/api/whatsapp/logout", authenticateApiKey, async (req, res) => {
  const userId = parseInt(req.body.userId);
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const client = whatsappClients.get(userId);
  if (client) {
    try {
      await client.logout();
      await client.destroy();
    } catch (e) {
      console.error("Logout error:", e);
    }
    whatsappClients.delete(userId);
    whatsappStatuses.set(userId, "logged_out");
    whatsappQRs.delete(userId);
  }

  res.json({ message: "Logged out from WhatsApp" });
});

app.post("/api/whatsapp/send", authenticateApiKey, async (req, res) => {
  const { campaignId, recipient, message, userId } = req.body;

  if (!campaignId || !recipient || !message || !userId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const client = whatsappClients.get(userId);
  const status = whatsappStatuses.get(userId);

  if (!client || status !== "ready") {
    await logToDjango(campaignId, recipient, "error", "WhatsApp not connected");
    return res.status(400).json({ error: "WhatsApp not connected" });
  }

  try {
    let chatId = recipient.replace(/\D/g, "");
    if (!chatId.endsWith("@c.us")) chatId += "@c.us";

    await client.sendMessage(chatId, message);
    await logToDjango(campaignId, recipient, "success");

    res.json({ success: true, message: "Message sent" });
  } catch (error: any) {
    await logToDjango(campaignId, recipient, "error", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`WhatsApp service running on http://localhost:${PORT}`);
});