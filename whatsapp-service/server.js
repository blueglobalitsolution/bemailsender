const express = require("express");
const cors = require("cors");
const { Client, LocalAuth } = require("whatsapp-web.js");
const QRCode = require("qrcode");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.WHATSAPP_API_KEY || "whatsapp-secret-key-change-in-production";
const DJANGO_URL = process.env.DJANGO_URL || "http://backend:3435";
const SECRET_KEY = process.env.SECRET_KEY;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "WhatsApp Service is running", status: "online" });
});

const authenticateRequest = (req, res, next) => {
  const apiKey = req.headers["x-api-key"] || req.headers["X-API-KEY"];
  const authHeader = req.headers["authorization"];

  if (apiKey === API_KEY) {
    return next();
  }

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      const requestedUserId = parseInt(req.query.userId || req.body.userId);
      const tokenUserId = decoded.user_id || decoded.id;

      if (requestedUserId && requestedUserId !== tokenUserId) {
        return res.status(403).json({ error: "Access denied: User ID mismatch" });
      }
      return next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  }

  return res.status(401).json({ error: "Unauthorized" });
};

const whatsappClients = new Map();
const whatsappQRs = new Map();
const whatsappStatuses = new Map();
const messageQueues = new Map();

async function processQueue(userId) {
  if (!messageQueues.has(userId)) return;
  const queue = messageQueues.get(userId);
  if (queue.processing) return;

  queue.processing = true;
  while (queue.items.length > 0) {
    const { campaignId, recipient, message, resolve, reject } = queue.items.shift();
    const client = whatsappClients.get(userId);
    const status = whatsappStatuses.get(userId);

    if (!client || status !== "ready") {
      const err = new Error("WhatsApp disconnected during processing");
      await logToDjango(campaignId, recipient, "error", err.message);
      reject(err);
      continue;
    }

    try {
      let chatId = recipient.replace(/\D/g, "");
      if (!chatId.endsWith("@c.us")) chatId += "@c.us";
      await client.sendMessage(chatId, message);
      await logToDjango(campaignId, recipient, "success");
      resolve({ success: true });
    } catch (error) {
      await logToDjango(campaignId, recipient, "error", error.message);
      reject(error);
    }
    // Rate limit: 1-2 seconds between messages
    await new Promise(r => setTimeout(r, 1500));
  }
  queue.processing = false;
}

async function getWhatsAppClient(userId) {
  if (whatsappClients.has(userId)) {
    const status = whatsappStatuses.get(userId);
    if (status === "ready") return whatsappClients.get(userId);
  }

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: `user-${userId}` }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process"
      ]
    }
  });

  client.on("qr", async (qr) => {
    try {
      const qrDataUri = await QRCode.toDataURL(qr);
      whatsappQRs.set(userId, qrDataUri);
      whatsappStatuses.set(userId, "qr");
    } catch (err) {
      console.error("QR error:", err);
    }
  });

  client.on("ready", () => {
    whatsappQRs.delete(userId);
    whatsappStatuses.set(userId, "ready");
    processQueue(userId); // Start queue if items were waiting
    console.log(`WhatsApp ready for user ${userId}`);
  });

  client.on("authenticated", () => whatsappStatuses.set(userId, "authenticated"));
  client.on("auth_failure", () => whatsappStatuses.set(userId, "auth_failure"));
  client.on("disconnected", () => {
    whatsappStatuses.set(userId, "disconnected");
    whatsappClients.delete(userId);
    messageQueues.delete(userId);
  });

  whatsappClients.set(userId, client);
  whatsappStatuses.set(userId, "initializing");

  if (!messageQueues.has(userId)) {
    messageQueues.set(userId, { items: [], processing: false });
  }

  try {
    // Timeout initialization after 45s
    const initPromise = client.initialize();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Initialization timeout")), 45000)
    );
    await Promise.race([initPromise, timeoutPromise]);
  } catch (err) {
    console.error("Init error:", err);
    whatsappStatuses.set(userId, "error");
    whatsappClients.delete(userId);
  }
  return client;
}

async function logToDjango(campaignId, recipient, status, message) {
  try {
    await fetch(`${DJANGO_URL}/api/logs/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ campaign: campaignId, recipient, status, message: message || "" })
    });
  } catch (err) {
    console.error("Log error:", err);
  }
}

app.get("/api/whatsapp/status", authenticateRequest, async (req, res) => {
  const userId = parseInt(req.query.userId);
  if (!userId) return res.status(400).json({ error: "userId required" });
  res.json({
    status: whatsappStatuses.get(userId) || "not_initialized",
    qr: whatsappQRs.get(userId),
    queueLength: messageQueues.get(userId)?.items.length || 0
  });
});

app.post("/api/whatsapp/initialize", authenticateRequest, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });
  getWhatsAppClient(parseInt(userId));
  res.json({ message: "Initializing" });
});

app.post("/api/whatsapp/logout", authenticateRequest, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });
  const client = whatsappClients.get(parseInt(userId));
  if (client) {
    try { await client.logout(); await client.destroy(); } catch (e) { }
    whatsappClients.delete(parseInt(userId));
    whatsappStatuses.set(parseInt(userId), "logged_out");
    messageQueues.delete(parseInt(userId));
  }
  res.json({ message: "Logged out" });
});

app.post("/api/whatsapp/send", authenticateRequest, async (req, res) => {
  const { campaignId, recipient, message, userId } = req.body;
  if (!campaignId || !recipient || !message || !userId) {
    return res.status(400).json({ error: "Missing fields" });
  }

  if (!messageQueues.has(userId)) {
    messageQueues.set(userId, { items: [], processing: false });
  }

  // Use a promise to resolve when the message is actually sent via queue
  // If user wants immediate response, we could just return {queued: true}
  // But for now, let's wait to keep the worker logic simple
  new Promise((resolve, reject) => {
    messageQueues.get(userId).items.push({ campaignId, recipient, message, resolve, reject });
    processQueue(userId);
  }).then(result => {
    if (!res.headersSent) res.json(result);
  }).catch(error => {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  });
});

async function recoverSessions() {
  const sessionsPath = ".whatsapp-web-jssdk";
  if (!fs.existsSync(sessionsPath)) return;

  const folders = fs.readdirSync(sessionsPath);
  for (const folder of folders) {
    if (folder.startsWith("session-user-")) {
      const userId = parseInt(folder.replace("session-user-", ""));
      if (userId) {
        console.log(`Recovering session for user ${userId}`);
        getWhatsAppClient(userId);
      }
    }
  }
}

recoverSessions();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`WhatsApp service running on http://localhost:${PORT}`);
});