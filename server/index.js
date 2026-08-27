import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import {
  adjustUserCredits,
  confirmManualRechargeOrder,
  createRechargeOrder,
  getHistory,
  getGenerationFailures,
  getGenerationRequests,
  getOperationLogs,
  getImageStats,
  getUserGenerationStats,
  getCreditLedgerAudit,
  getUserCreditTrace,
  getAnnouncement,
  getAnnouncementHistory,
  getReports,
  getRechargeOrder,
  getRechargeOrderByOutTradeNo,
  getRechargeOrders,
  getRedeemStore,
  getUserStore,
  getApiChannels,
  getEnabledApiChannels,
  initDatabase,
  insertCreditLog,
  insertGenerationFailure,
  insertGenerationRequest,
  insertOperationLog,
  insertReport,
  saveRedeemStore,
  saveUserStore,
  setUserCreditsWithManualLog,
  settleRechargeOrderPaid,
  settleGenerationSuccess,
  updateRechargeOrder,
  updateImageAsset,
  updateImageThumbnailUrl,
  updateApiChannelTestResult,
  updateGenerationRequest,
  upsertAnnouncement,
  upsertApiChannels,
  upsertRedeemCode,
  upsertUser
} from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.resolve(projectRoot, "..", ".env"), quiet: true });
dotenv.config({ path: path.resolve(projectRoot, ".env"), override: true, quiet: true });

validateGptImageApiRouting();

const app = express();
app.set("etag", false);
const port = Number(process.env.PORT || 8787);
const appRuntimeDir = path.resolve(projectRoot, "..", "_runtime", "image-gen-studio");
const jobsDir = path.join(appRuntimeDir, "jobs");
const generatedDir = path.join(appRuntimeDir, "generated");
const thumbnailsDir = path.join(appRuntimeDir, "thumbnails");
const referencesDir = path.join(appRuntimeDir, "references");
const dbPath = path.join(appRuntimeDir, "app.db");
const usersPath = path.join(appRuntimeDir, "users.json");
const redeemCodesPath = path.join(appRuntimeDir, "redeem-codes.json");
const adminSessions = new Set();
const adminPassword = process.env.ADMIN_PASSWORD || "admin123456";

initDatabase(dbPath);

const modelRegistry = {
  forge: {
    id: "forge",
    label: "Forge生图模型",
    provider: "agnes",
    model: "agnes-image-2.1-flash",
    creditCost: 0
  },
  "gpt-image-2": {
    id: "gpt-image-2",
    label: "GPT Image 2",
    provider: "openai",
    model: process.env.OPENAI_IMAGE_MODEL || process.env.GPT_IMAGE_MODEL || process.env.IMAGE_MODEL || "gpt-image-2",
    creditCost: 2,
    qualityOptions: [
      { id: "1k", label: "1K", description: "标准清晰度", creditCost: 2 },
      { id: "2k", label: "2K", description: "高清海报", creditCost: 3 },
      { id: "4k", label: "4K", description: "超清大图", creditCost: 5 }
    ]
  },
  nannabanan: {
    id: "nannabanan",
    label: "🍌 Nannabanan",
    provider: "nannabanan",
    model: process.env.NANNABANAN_MODEL || "gemini-2.5-flash-image-preview",
    creditCost: Number(process.env.NANNABANAN_CREDIT_COST || 2)
  }
};

function validateGptImageApiRouting() {
  const expectedBase = clean(process.env.GPT_IMAGE_EXPECTED_API_BASE_URL || "");
  const checkedKeys = [
    "GPT_IMAGE_API_BASE_URL"
  ];
  const problems = [];

  for (const key of checkedKeys) {
    const value = clean(process.env[key] || "");
    if (!value) continue;
    const normalized = normalizeApiBase(value);
    if (expectedBase && normalized !== normalizeApiBase(expectedBase)) {
      problems.push(`${key} expected ${normalizeApiBase(expectedBase)} but got ${normalized}`);
    }
  }

  if (problems.length) {
    throw new Error(`GPT Image API routing guard failed: ${problems.join("; ")}`);
  }
}

app.use(cors());
app.use(express.json({ limit: "32mb" }));

app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use((req, res, next) => {
  res.on("finish", () => {
    if (!req.path.startsWith("/api") || req.path === "/api/health") return;
    const detail = req.auditDetail || {};
    try {
      insertOperationLog({
        account: req.auditAccount || detail.account || "",
        action: req.auditAction || inferAction(req),
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        ip: getClientIp(req),
        sourcePort: String(req.socket?.remotePort || ""),
        target: `${req.hostname}${req.originalUrl}`,
        userAgent: req.headers["user-agent"] || "",
        detail
      });
    } catch (error) {
      console.warn("operation log failed:", error.message);
    }
  });
  next();
});

const distDir = path.join(projectRoot, "dist");
app.use("/generated", express.static(generatedDir, { maxAge: "30d", immutable: true }));
app.use("/thumbnails", express.static(thumbnailsDir, { maxAge: "30d", immutable: true }));
app.use("/assets", express.static(path.join(distDir, "assets"), { maxAge: "30d", immutable: true }));
app.use("/bg", express.static(path.join(distDir, "bg"), { maxAge: "30d", immutable: true }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    models: publicModels(),
    providers: publicProviderStatus(),
    visionAnalyzer: publicVisionAnalyzer()
  });
});

app.get("/api/announcement", (_req, res) => {
  const announcement = getAnnouncement();
  res.json({ announcement: publicAnnouncement(announcement, { publicOnly: true }) });
});

app.get("/api/announcements", (_req, res) => {
  const announcement = getAnnouncement();
  const history = getAnnouncementHistory({ limit: 50 });
  res.json({
    announcement: publicAnnouncement(announcement),
    history: history.map((item) => publicAnnouncement(item))
  });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    req.auditAction = "register";
    const account = normalizeAccount(req.body.account);
    const password = String(req.body.password || "");
    if (!account) throw new Error("请输入邮箱");
    if (!isValidEmail(account)) throw new Error("请输入正确的邮箱地址");
    if (password.length < 6) throw new Error("密码至少 6 位");

    const users = await loadUsers();
    if (users.accounts[account]) throw new Error("账号已存在，请直接登录");

    // 防薅羊毛：同一IP最多注册3个账号
    const ip = getClientIp(req);
    const database = getDatabase();
    const recentRegistrations = database
      .prepare(
        `SELECT account, created_at FROM users
         WHERE ip = ? AND created_at > datetime('now', '-1 hour')
         ORDER BY created_at DESC LIMIT 10`
      )
      .all(ip);

    // 检查同IP过去1小时内是否已有注册记录
    const sameIpCount = database
      .prepare(
        `SELECT COUNT(*) AS cnt FROM users WHERE ip = ?`
      )
      .get(ip);

    if (sameIpCount.cnt >= 3) {
      throw new Error("该IP地址已注册超过3个账号，请稍后再试或联系客服");
    }

    const now = new Date().toISOString();
    const token = createToken();
    users.accounts[account] = {
      account,
      passwordHash: hashPassword(password),
      credits: 2, // 新用户注册赠送2积分
      token,
      createdAt: now,
      updatedAt: now,
      creditLogs: [],
      ip: ip
    };

    await saveUsers(users);

    // 记录赠送积分账本
    insertCreditLog(account, {
      type: "welcome",
      credits: 2,
      cost: 0,
      code: "new-user-welcome",
      model: "",
      quality: "",
      prompt: "新用户注册赠送积分",
      ip: ip,
      createdAt: now
    });

    req.auditAccount = account;
    req.auditDetail = { ip, sameIpCount: sameIpCount.cnt + 1 };
    res.json({
      token,
      user: publicUser(users.accounts[account]),
      welcomeCredits: 2
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "注册失败" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    req.auditAction = "login";
    const account = normalizeAccount(req.body.account);
    const password = String(req.body.password || "");
    const users = await loadUsers();
    const user = users.accounts[account];
    if (!user || user.passwordHash !== hashPassword(password)) {
      throw new Error("账号或密码不正确");
    }

    user.token = createToken();
    user.updatedAt = new Date().toISOString();
    await saveUsers(users);
    req.auditAccount = account;
    res.json({ token: user.token, user: publicUser(user) });
  } catch (error) {
    res.status(400).json({ error: error.message || "登录失败" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const { user } = await requireUser(req);
    req.auditAccount = user.account;
    res.json({ user: publicUser(user), models: publicModels() });
  } catch (error) {
    res.status(401).json({ error: error.message || "请先登录" });
  }
});

app.post("/api/redeem", async (req, res) => {
  try {
    req.auditAction = "redeem";
    const { user } = await requireUser(req);
    req.auditAccount = user.account;
    const code = String(req.body.code || "").trim().toUpperCase();
    if (!code) throw new Error("请输入兑换码");

    const redeemStore = await loadRedeemCodes();
    const entry = redeemStore.codes[code];
    if (!entry) throw new Error("兑换码不存在");
    if (entry.usedBy) throw new Error("兑换码已被使用");

    const credits = Number(entry.credits || 0);
    if (credits <= 0) throw new Error("兑换码积分无效");

    entry.usedBy = user.account;
    entry.usedAt = new Date().toISOString();
    const log = {
      type: "redeem",
      credits,
      code,
      createdAt: new Date().toISOString()
    };
    await saveRedeemCodes(redeemStore);
    insertCreditLog(user.account, log);
    const settledUser = adjustUserCredits(user.account, credits);
    res.json({ user: publicUser(settledUser), creditsAdded: credits, message: `兑换成功，增加 ${credits} 积分` });
  } catch (error) {
    res.status(400).json({ error: error.message || "兑换失败" });
  }
});

app.post("/api/recharge/wechat/native", async (req, res) => {
  try {
    req.auditAction = "wechat_recharge_create";
    const { user } = await requireUser(req);
    req.auditAccount = user.account;
    const amountYuan = normalizeRechargeAmount(req.body.amountYuan ?? req.body.amount);
    const credits = amountYuan * 10;
    const order = createRechargeOrder({
      id: `rch_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      account: user.account,
      provider: "wechat_manual",
      outTradeNo: makeRechargeTradeNo(),
      amountCents: amountYuan * 100,
      credits,
      status: "pending",
      codeUrl: "manual-wechat-qr",
      qrDataUrl: "/pay/wechat-qr.jpg",
      raw: {
        mode: "manual_wechat_qr",
        rate: "1 CNY = 10 credits",
        notice: "Admin confirms the payment manually after checking personal WeChat receipt."
      }
    });

    req.auditDetail = { orderId: order.id, amountYuan, credits, mode: "manual_wechat_qr" };
    res.json({ order: publicRechargeOrder(order) });
  } catch (error) {
    res.status(400).json({ error: error.message || "微信充值订单创建失败" });
  }
});

app.get("/api/recharge/orders/:id", async (req, res) => {
  try {
    req.auditAction = "recharge_order_status";
    const { user } = await requireUser(req);
    req.auditAccount = user.account;
    let order = getRechargeOrder(clean(req.params.id || ""));
    if (!order || order.account !== user.account) throw new Error("充值订单不存在");

    if (order.provider === "wechat" && ["created", "pending"].includes(order.status)) {
      order = await refreshWeChatRechargeOrder(order);
    }
    const latestUser = (await loadUsers()).accounts[user.account] || user;
    res.json({ order: publicRechargeOrder(order), user: publicUser(latestUser) });
  } catch (error) {
    res.status(400).json({ error: error.message || "充值订单读取失败" });
  }
});

app.post("/api/payment/wechat/notify", async (req, res) => {
  try {
    req.auditAction = "wechat_payment_notify";
    const result = decryptWeChatNotify(req.body || {});
    if (result?.out_trade_no && result.trade_state === "SUCCESS") {
      const order = getRechargeOrderByOutTradeNo(result.out_trade_no);
      if (order) {
        settleRechargeOrderPaid({
          id: order.id,
          outTradeNo: result.out_trade_no,
          transactionId: result.transaction_id || "",
          raw: result,
          paidAt: result.success_time ? new Date(result.success_time).toISOString() : new Date().toISOString()
        });
      }
    }
    req.auditDetail = { outTradeNo: result?.out_trade_no || "", tradeState: result?.trade_state || "" };
    res.json({ code: "SUCCESS", message: "成功" });
  } catch (error) {
    console.warn("wechat notify failed:", error.message);
    res.status(500).json({ code: "FAIL", message: error.message || "失败" });
  }
});

app.get("/api/history", async (req, res) => {
  try {
    const { user } = await requireUser(req);
    req.auditAction = "history";
    req.auditAccount = user.account;
    const limit = normalizeHistoryLimit(req.query.limit);
    const offset = normalizeHistoryOffset(req.query.offset);
    const history = await loadUserHistory(user.account, { limit: limit + 1, offset });
    await ensureHistoryThumbnails(history.slice(0, limit));
    const hasMore = history.length > limit;
    res.json({
      history: history.slice(0, limit).map(publicMemberHistoryItem),
      hasMore,
      nextOffset: offset + Math.min(history.length, limit)
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "读取历史失败" });
  }
});

app.post("/api/admin/login", async (req, res) => {
  try {
    req.auditAction = "admin_login";
    const password = String(req.body.password || "");
    if (!password || password !== adminPassword) throw new Error("管理员密码不正确");
    const token = createToken();
    adminSessions.add(token);
    res.json({ token, admin: { name: "admin" } });
  } catch (error) {
    res.status(401).json({ error: error.message || "后台登录失败" });
  }
});

app.get("/api/admin/overview", async (req, res) => {
  try {
    requireAdmin(req);
    const users = await loadUsers();
    const redeemStore = await loadRedeemCodes();
    const imageStats = getImageStats();
    const ledgerAudit = getCreditLedgerAudit();
    const accounts = Object.values(users.accounts || {});
    res.json({
      stats: {
        users: accounts.length,
        totalCredits: accounts.reduce((sum, user) => sum + Number(user.credits || 0), 0),
        images: imageStats.images,
        jobs: imageStats.jobs,
        todayImages: imageStats.todayImages,
        todayJobs: imageStats.todayJobs,
        todayStartUtc: imageStats.todayStartUtc,
        todayEndUtc: imageStats.todayEndUtc,
        redeemCodes: Object.keys(redeemStore.codes || {}).length,
        unusedRedeemCodes: Object.values(redeemStore.codes || {}).filter((item) => !item.usedBy).length,
        ledgerAudit
      }
    });
  } catch (error) {
    res.status(401).json({ error: error.message || "无权限" });
  }
});

app.get("/api/admin/users", async (req, res) => {
  try {
    requireAdmin(req);
    const users = await loadUsers();
    const generationStats = getUserGenerationStats();
    const list = Object.values(users.accounts || {})
      .map((user) => {
        const logs = user.creditLogs || [];
        const stats = generationStats[user.account] || {};
        const generateCount = logs.filter((item) => item.type === "generate").length;
        return {
          account: user.account,
          credits: Number(user.credits || 0),
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          generateCount,
          generationTaskCount: generateCount,
          imageCount: Number(stats.imageCount || 0),
          jobCount: Number(stats.jobCount || 0),
          redeemCount: logs.filter((item) => item.type === "redeem").length,
          spentCredits: logs
            .filter((item) => item.type === "generate")
            .reduce((sum, item) => sum + Number(item.cost || 0), 0)
        };
      })
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    res.json({ users: list });
  } catch (error) {
    res.status(401).json({ error: error.message || "无权限" });
  }
});

app.get("/api/admin/credit-trace", async (req, res) => {
  try {
    requireAdmin(req);
    const account = normalizeAccount(req.query.account);
    if (!account) throw new Error("Please choose a user account first");
    res.json(getUserCreditTrace(account));
  } catch (error) {
    res.status(400).json({ error: error.message || "Credit trace failed" });
  }
});

app.post("/api/admin/users/:account/credits", async (req, res) => {
  try {
    requireAdmin(req);
    req.auditAction = "admin_adjust_user_credits";
    const account = normalizeAccount(req.params.account);
    const targetCredits = Math.floor(Number(req.body?.targetCredits));
    const note = clean(req.body?.note || "").slice(0, 500);
    if (!account) throw new Error("用户账号无效");
    if (!Number.isInteger(targetCredits) || targetCredits < 0) {
      throw new Error("目标积分必须是大于或等于 0 的整数");
    }
    if (note.length < 2) throw new Error("请填写本次调整原因，方便后续追溯");

    const result = setUserCreditsWithManualLog({
      account,
      targetCredits,
      note,
      admin: "admin"
    });
    req.auditAccount = account;
    req.auditDetail = {
      account,
      previousCredits: result.previousCredits,
      targetCredits: result.targetCredits,
      delta: result.delta,
      note
    };
    res.json({
      result: {
        previousCredits: result.previousCredits,
        targetCredits: result.targetCredits,
        delta: result.delta,
        adjustedAt: result.adjustedAt
      },
      trace: getUserCreditTrace(account)
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "积分调整失败" });
  }
});

app.get("/api/admin/history", async (req, res) => {
  try {
    requireAdmin(req);
    const history = await loadAllHistory(300);
    res.json({ history });
  } catch (error) {
    res.status(401).json({ error: error.message || "无权限" });
  }
});

app.get("/api/admin/jobs/:jobId/references", async (req, res) => {
  try {
    requireAdmin(req);
    const references = await loadJobReferenceImages(req.params.jobId);
    res.json({ references });
  } catch (error) {
    res.status(404).json({ error: error.message || "参考图不存在" });
  }
});

app.get("/api/admin/failures", async (req, res) => {
  try {
    requireAdmin(req);
    res.json({ failures: getGenerationFailures({ limit: 200 }) });
  } catch (error) {
    res.status(401).json({ error: error.message || "Unauthorized" });
  }
});

app.get("/api/admin/generation-requests", async (req, res) => {
  try {
    requireAdmin(req);
    res.json({ requests: getGenerationRequests({ limit: 120 }) });
  } catch (error) {
    res.status(401).json({ error: error.message || "Unauthorized" });
  }
});

app.get("/api/admin/recharge-orders", async (req, res) => {
  try {
    requireAdmin(req);
    res.json({ orders: getRechargeOrders({ limit: 200 }).map(publicRechargeOrder) });
  } catch (error) {
    res.status(401).json({ error: error.message || "Unauthorized" });
  }
});

app.post("/api/admin/recharge-orders/:id/confirm", async (req, res) => {
  try {
    requireAdmin(req);
    req.auditAction = "admin_confirm_manual_recharge";
    const id = clean(req.params.id || "");
    const credits = Math.floor(Number(req.body.credits || 0));
    const note = clean(req.body.note || "").slice(0, 500);
    const result = confirmManualRechargeOrder({
      id,
      credits,
      note,
      admin: req.auditAccount || "admin"
    });
    req.auditDetail = { orderId: id, account: result.order?.account || "", credits, note };
    res.json({ order: publicRechargeOrder(result.order), user: publicUser(result.user) });
  } catch (error) {
    res.status(400).json({ error: error.message || "确认充值失败" });
  }
});

app.patch("/api/admin/images/:id", async (req, res) => {
  try {
    requireAdmin(req);
    req.auditAction = "admin_update_image_asset";
    const id = clean(req.params.id || "");
    if (!id) throw new Error("图片 ID 无效");
    const image = updateImageAsset(id, req.body || {});
    req.auditDetail = { imageId: id, assetStatus: image.assetStatus, qualityScore: image.qualityScore };
    res.json({ image });
  } catch (error) {
    res.status(400).json({ error: error.message || "更新图片资产失败" });
  }
});

app.get("/api/admin/logs", async (req, res) => {
  try {
    requireAdmin(req);
    res.json({ logs: getOperationLogs({ limit: 500 }) });
  } catch (error) {
    res.status(401).json({ error: error.message || "无权限" });
  }
});

app.get("/api/admin/reports", async (req, res) => {
  try {
    requireAdmin(req);
    res.json({ reports: getReports({ limit: 300 }) });
  } catch (error) {
    res.status(401).json({ error: error.message || "无权限" });
  }
});

app.get("/api/admin/redeem-codes", async (req, res) => {
  try {
    requireAdmin(req);
    const redeemStore = await loadRedeemCodes();
    const codes = Object.entries(redeemStore.codes || {})
      .map(([code, entry]) => ({
        code,
        credits: Number(entry.credits || 0),
        note: entry.note || "",
        usedBy: entry.usedBy || "",
        usedAt: entry.usedAt || "",
        createdAt: entry.createdAt || ""
      }))
      .sort((a, b) => Number(Boolean(a.usedBy)) - Number(Boolean(b.usedBy)));
    res.json({ codes });
  } catch (error) {
    res.status(401).json({ error: error.message || "无权限" });
  }
});

app.get("/api/admin/api-channels", async (req, res) => {
  try {
    requireAdmin(req);
    res.json(getApiStudioPayload());
  } catch (error) {
    res.status(401).json({ error: error.message || "Unauthorized" });
  }
});

app.get("/api/admin/announcement", async (req, res) => {
  try {
    requireAdmin(req);
    res.json({ announcement: publicAnnouncement(getAnnouncement()) });
  } catch (error) {
    res.status(401).json({ error: error.message || "Unauthorized" });
  }
});

app.post("/api/admin/announcement", async (req, res) => {
  try {
    requireAdmin(req);
    req.auditAction = "admin_update_announcement";
    const announcement = upsertAnnouncement(req.body?.announcement || req.body || {});
    req.auditDetail = { enabled: announcement.enabled, version: announcement.version };
    res.json({ announcement: publicAnnouncement(announcement) });
  } catch (error) {
    res.status(400).json({ error: error.message || "Announcement update failed" });
  }
});

app.post("/api/admin/api-channels", async (req, res) => {
  try {
    requireAdmin(req);
    req.auditAction = "admin_update_api_channels";
    const saved = upsertApiChannels(Array.isArray(req.body.channels) ? req.body.channels : []);
    req.auditDetail = { count: saved.length };
    res.json(getApiStudioPayload());
  } catch (error) {
    res.status(400).json({ error: error.message || "API channel update failed" });
  }
});

app.post("/api/admin/api-channels/:id/test", async (req, res) => {
  try {
    requireAdmin(req);
    req.auditAction = "admin_test_api_channel";
    const id = clean(req.params.id || "");
    const channel = mergeApiStudioDefaults([
      ...getApiChannels({ provider: "gpt-image-2" })
    ]).find((item) => item.id === id);
    if (!channel) throw new Error("API channel not found");
    const result = await testApiChannel(channel);
    const updated = updateApiChannelTestResult(id, result);
    req.auditDetail = { id, status: result.status, message: result.message };
    res.json({ channel: publicApiChannel(updated), result });
  } catch (error) {
    res.status(400).json({ error: error.message || "API channel test failed" });
  }
});

app.post("/api/admin/redeem-codes", async (req, res) => {
  try {
    requireAdmin(req);
    const credits = Number(req.body.credits || 0);
    const note = clean(req.body.note || "管理员创建");
    if (!Number.isFinite(credits) || credits <= 0) throw new Error("积分必须大于 0");
    const code = String(req.body.code || makeRedeemCode(credits)).trim().toUpperCase();
    if (!code) throw new Error("请输入兑换码");

    const redeemStore = await loadRedeemCodes();
    if (redeemStore.codes[code]) throw new Error("兑换码已存在");
    redeemStore.codes[code] = {
      credits,
      note,
      usedBy: "",
      usedAt: "",
      createdAt: new Date().toISOString()
    };
    await saveRedeemCodes(redeemStore);
    res.json({ code, entry: redeemStore.codes[code] });
  } catch (error) {
    res.status(400).json({ error: error.message || "创建兑换码失败" });
  }
});

app.post("/api/report", async (req, res) => {
  try {
    req.auditAction = "submit_report";
    const contact = clean(req.body.contact || "").slice(0, 120);
    const type = clean(req.body.type || "other").slice(0, 40);
    const content = clean(req.body.content || "").slice(0, 2000);
    if (!content || content.length < 8) throw new Error("请填写至少 8 个字的举报内容");
    const id = insertReport({
      contact,
      type,
      content,
      ip: getClientIp(req),
      userAgent: req.headers["user-agent"] || ""
    });
    req.auditDetail = { reportId: id, type };
    res.json({ ok: true, message: "已收到，我们会尽快处理并留存记录。", reportId: id });
  } catch (error) {
    res.status(400).json({ error: error.message || "提交失败" });
  }
});

app.post("/api/generate", async (req, res) => {
  let failureInput = null;
  let failureUser = "";
  let failureModel = "";
  let failureCost = 0;
  let failureStage = "start";
  let requestId = "";
  try {
    req.auditAction = "generate";
    const { users, user } = await requireUser(req);
    req.auditAccount = user.account;
    failureUser = user.account;
    failureStage = "normalize_input";
    let input = normalizeInput(req.body);
    failureInput = input;
    failureModel = input.model;
    failureStage = "safety_check";
    const risk = checkPromptSafety(input.prompt);
    req.auditDetail = {
      model: input.model,
      ratio: input.ratio,
      count: input.count,
      references: input.references.length,
      promptTemplate: input.promptTemplate
    };
    if (!risk.ok) {
      req.auditDetail.safety = { blocked: true, reason: risk.reason };
      throw new Error(risk.message || `提示词包含不适合生成的内容，请修改后再试。`);
    }
    failureStage = "credit_check";
    const modelConfig = modelRegistry[input.model] || modelRegistry.forge;
    failureModel = modelConfig.id;
    const cost = getCreditCost(input, modelConfig);
    failureCost = cost;

    if (user.credits < cost) {
      throw new Error(`${modelConfig.label} 本次需要 ${cost} 积分，当前剩余 ${user.credits} 积分，请先兑换积分。`);
    }

    requestId = `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    insertGenerationRequest({
      id: requestId,
      account: user.account,
      model: modelConfig.id,
      modelLabel: modelConfig.label,
      quality: input.gptQuality,
      ratio: input.ratio,
      count: input.count,
      referencesCount: input.references.length,
      cost,
      prompt: input.prompt,
      status: "pending",
      stage: "reference_analysis"
    });

    failureStage = "reference_analysis";
    updateGenerationRequest(requestId, { stage: failureStage });
    const referencePlan = await buildReferencePlan(input);
    failureStage = "designer_brain";
    updateGenerationRequest(requestId, { stage: failureStage });
    const designerPlan = await buildDesignerPlan(input, referencePlan);
    input = applyDesignerPlan(input, designerPlan);
    failureInput = input;
    req.auditDetail.ratio = input.ratio;
    req.auditDetail.designerBrain = designerPlan?.source || "fallback";
    failureStage = "prompt_build";
    updateGenerationRequest(requestId, { stage: failureStage, ratio: input.ratio });
    const prompts = buildPrompts(input, referencePlan, modelConfig);
    const jobId = `job_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
    failureStage = "upstream_generation";
    updateGenerationRequest(requestId, { stage: failureStage });
    const rawImages = await generateImages(prompts, input, modelConfig, { requestId });
    const images = await persistGeneratedImages(rawImages, jobId);

    failureStage = "settlement";
    updateGenerationRequest(requestId, { stage: failureStage });
    const storedReferences = await persistJobReferenceImages(input.references, jobId);
    const job = {
      id: jobId,
      createdAt: new Date().toISOString(),
      account: user.account,
      model: modelConfig.id,
      modelLabel: modelConfig.label,
      provider: modelConfig.provider,
      creditCost: cost,
      remainingCredits: user.credits - cost,
      input: {
        ...input,
        references: input.references.map((item, index) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          size: item.size,
          usage: item.usage || "",
          hasImage: Boolean(item.image),
          sentToModel: Boolean(item.image || item.url),
          url: item.url || "",
          storedFile: storedReferences[index]?.storedFile || "",
          storedType: storedReferences[index]?.type || item.type || "image/png"
        }))
      },
      referencePlan,
      designerPlan,
      prompts,
      images
    };

    await fs.mkdir(jobsDir, { recursive: true });
    await fs.writeFile(path.join(jobsDir, `${job.id}.json`), JSON.stringify(job, null, 2), "utf-8");
    failureStage = "settlement";
    const log = {
      type: "generate",
      model: modelConfig.id,
      quality: input.gptQuality,
      cost,
      prompt: input.prompt.slice(0, 120),
      createdAt: new Date().toISOString()
    };
    const settlement = settleGenerationSuccess({
      job,
      account: user.account,
      cost,
      log,
      requestId,
      completedAt: new Date().toISOString()
    });

    req.auditDetail.jobId = job.id;
    req.auditDetail.cost = cost;
    res.json({ ...settlement.job, user: publicUser(settlement.user) });
  } catch (error) {
    if (requestId) {
      try {
        updateGenerationRequest(requestId, {
          status: "failed",
          stage: failureStage,
          error: error.message || String(error),
          completedAt: new Date().toISOString()
        });
      } catch (requestError) {
        console.warn("generation request update failed:", requestError.message);
      }
    }
    if (failureInput) {
      try {
        insertGenerationFailure({
          account: failureUser,
          model: failureModel || failureInput.model,
          quality: failureInput.gptQuality,
          ratio: failureInput.ratio,
          prompt: failureInput.prompt,
          referencesCount: failureInput.references?.length || 0,
          stage: failureStage,
          cost: failureCost,
          error: error.message || String(error),
          input: {
            ...failureInput,
            references: (failureInput.references || []).map((item) => ({
              id: item.id,
              name: item.name,
              type: item.type,
              size: item.size,
              usage: item.usage || "",
              hasImage: Boolean(item.image),
              url: item.url || ""
            }))
          }
        });
      } catch (recordError) {
        console.warn("generation failure record failed:", recordError.message);
      }
    }
    res.status(400).json({ error: error.message || "生成失败" });
  }
});

function publicModels() {
  return Object.values(modelRegistry).map(({ id, label, provider, model, creditCost, qualityOptions }) => ({
    id,
    label,
    provider,
    model,
    creditCost,
    qualityOptions: qualityOptions || []
  }));
}

function publicAnnouncement(announcement, { publicOnly = false } = {}) {
  const item = announcement || {};
  const payload = {
    enabled: Boolean(item.enabled),
    title: clean(item.title || "网站公告").slice(0, 80) || "网站公告",
    content: String(item.content || "").trim().slice(0, 3000),
    buttonLabel: clean(item.buttonLabel || "我知道了").slice(0, 20) || "我知道了",
    titleEn: clean(item.titleEn || "").slice(0, 80),
    contentEn: String(item.contentEn || "").trim().slice(0, 3000),
    buttonLabelEn: clean(item.buttonLabelEn || "").slice(0, 20),
    version: clean(item.version || "1").slice(0, 40) || "1",
    updatedAt: item.updatedAt || ""
  };
  if (publicOnly && (!payload.enabled || (!payload.content && !payload.contentEn))) {
    return { ...payload, enabled: false, content: "" };
  }
  return payload;
}

function publicRechargeOrder(order = {}) {
  return {
    id: order.id || "",
    provider: order.provider || "wechat",
    outTradeNo: order.outTradeNo || "",
    amountCents: Number(order.amountCents || 0),
    amountYuan: order.amountYuan || ((Number(order.amountCents || 0) / 100).toFixed(2).replace(/\.00$/, "")),
    credits: Number(order.credits || 0),
    status: order.status || "created",
    qrDataUrl: order.qrDataUrl || "",
    transactionId: order.transactionId || "",
    error: order.error || "",
    createdAt: order.createdAt || "",
    updatedAt: order.updatedAt || "",
    paidAt: order.paidAt || ""
  };
}

function publicMemberHistoryItem(item) {
  return {
    id: item.id,
    jobId: item.jobId,
    imageIndex: item.imageIndex,
    createdAt: item.createdAt,
    model: item.model,
    modelLabel: item.modelLabel,
    modelId: item.modelId,
    quality: item.quality,
    creditCost: item.creditCost,
    prompt: item.prompt,
    ratio: item.ratio,
    style: item.style,
    promptTemplate: item.promptTemplate,
    promptTemplateLabel: item.promptTemplateLabel,
    thumbnailUrl: item.thumbnailUrl,
    referencesCount: item.referencesCount,
    width: item.width,
    height: item.height,
    url: item.url
  };
}

function publicProviderStatus() {
  return {
    agnes: {
      configured: Boolean(process.env.AGNES_API_KEY || process.env.AGNES_TOKEN)
    },
    gptImage: {
      configured: Boolean(getGptImageConfig("1k").apiKey || getGptImageConfig("2k").apiKey || getGptImageConfig("4k").apiKey),
      fallbackConfigured: Boolean(
        getGptImageFallbackConfig("1k").apiKey ||
          getGptImageFallbackConfig("2k").apiKey ||
          getGptImageFallbackConfig("4k").apiKey
      )
    },
    nannabanan: {
      configured: Boolean(getNannabananConfig().apiKey),
      model: getNannabananConfig().model
    },
    designerBrain: {
      configured: Boolean(getDesignerBrainConfig().apiKey),
      model: getDesignerBrainConfig().model
    }
  };
}

function getApiStudioPayload() {
  const channels = mergeApiStudioDefaults([
    ...getApiChannels({ provider: "gpt-image-2" })
  ]);
  return {
    channels: channels.map(publicApiChannel),
    effective: apiStudioTierDescriptors().map((descriptor) => {
      const { provider, tier } = descriptor;
      const studioChannels = channels.filter(
        (channel) => channel.provider === provider && channel.tier === tier && channel.enabled && channel.apiBase && channel.apiKeySet && channel.model
      );
      const envPrimary = getGptImageConfig(tier);
      const envFallback = getGptImageFallbackConfig(tier);
      return {
        provider,
        tier,
        label: descriptor.label,
        source: studioChannels.length ? "api-studio" : ".env",
        activeCount: studioChannels.length,
        envPrimary: publicEnvGptConfig(envPrimary),
        envFallback: publicEnvGptConfig(envFallback)
      };
    })
  };
}

function apiStudioTierDescriptors() {
  return [
    { provider: "gpt-image-2", tier: "1k", label: "GPT Image 2 1K" },
    { provider: "gpt-image-2", tier: "2k", label: "GPT Image 2 2K" },
    { provider: "gpt-image-2", tier: "4k", label: "GPT Image 2 4K" }
  ];
}

function mergeApiStudioDefaults(existingChannels = []) {
  const existingById = new Map(existingChannels.map((channel) => [channel.id, channel]));
  return defaultApiStudioChannels().map((channel) => ({ ...channel, ...(existingById.get(channel.id) || {}) }));
}

function defaultApiStudioChannels() {
  const roles = [
    { role: "primary", label: "主 API" },
    { role: "fallback1", label: "备用 API 1" },
    { role: "fallback2", label: "备用 API 2" }
  ];
  const gptChannels = ["1k", "2k", "4k"].flatMap((tier) =>
    roles.map(({ role, label }) => ({
      id: `gpt-image-2_${tier}_${role}`,
      provider: "gpt-image-2",
      tier,
      role,
      name: `GPT Image 2 ${tier.toUpperCase()} ${label}`,
      apiBase: "",
      apiKey: "",
      apiKeySet: false,
      apiKeyMasked: "",
      model: tier === "1k" ? "gpt-image-2" : "gpt-image-2",
      responseFormat: "b64_json",
      enabled: false,
      timeoutMs: 600000,
      note: "",
      lastTestStatus: "",
      lastTestMessage: "",
      lastTestAt: ""
    }))
  );
  return gptChannels;
}

function publicApiChannel(channel = {}) {
  return {
    id: channel.id || "",
    provider: channel.provider || "gpt-image-2",
    tier: channel.tier || "1k",
    role: channel.role || "primary",
    name: channel.name || "",
    apiBase: channel.apiBase || "",
    apiKey: "",
    apiKeySet: Boolean(channel.apiKeySet || channel.apiKey),
    apiKeyMasked: channel.apiKeyMasked || maskSecret(channel.apiKey || ""),
    model: channel.model || "",
    responseFormat: channel.responseFormat || "b64_json",
    enabled: Boolean(channel.enabled),
    timeoutMs: Number(channel.timeoutMs || 600000),
    note: channel.note || "",
    lastTestStatus: channel.lastTestStatus || "",
    lastTestMessage: channel.lastTestMessage || "",
    lastTestAt: channel.lastTestAt || ""
  };
}

function publicEnvGptConfig(config = {}) {
  return {
    configured: Boolean(config.apiKey),
    apiBase: maskUrl(config.apiBase || ""),
    model: config.model || "",
    responseFormat: config.responseFormat || "",
    channel: config.channel || ""
  };
}

function maskSecret(value) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 12) return `${text.slice(0, 3)}***`;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function maskUrl(value) {
  try {
    const url = new URL(value);
    return `${url.host}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return value || "";
  }
}

async function testApiChannel(channel) {
  if (!channel.apiBase) throw new Error("API address is empty");
  if (!channel.apiKey) throw new Error("API key is empty");
  if (!channel.model) throw new Error("Model is empty");

  const apiBase = normalizeApiBase(channel.apiBase);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${apiBase}/models`, {
      headers: { Authorization: `Bearer ${channel.apiKey}` },
      signal: controller.signal
    });
    const text = await response.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
    const ids = Array.isArray(data.data) ? data.data.map((item) => item.id).filter(Boolean) : [];
    const hasModel = ids.includes(channel.model);
    const message = response.ok
      ? hasModel
        ? `连接正常，模型 ${channel.model} 可用`
        : `连接正常，但模型列表未包含 ${channel.model}`
      : data.error?.message || data.error || text.slice(0, 160) || `HTTP ${response.status}`;
    return {
      ok: response.ok && hasModel,
      status: response.ok && hasModel ? "ok" : response.ok ? "model-missing" : "failed",
      httpStatus: response.status,
      message,
      modelCount: ids.length
    };
  } catch (error) {
    return {
      ok: false,
      status: error.name === "AbortError" ? "timeout" : "failed",
      httpStatus: 0,
      message: error.name === "AbortError" ? "连接测试超时" : error.message || "连接测试失败",
      modelCount: 0
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function publicVisionAnalyzer() {
  const configs = getVisionAnalyzerConfigs();
  const config = configs[0] || getVisionAnalyzerConfig();
  const fallback = configs[1] || null;
  return {
    provider: config.provider,
    model: config.model,
    configured: Boolean(config.apiKey),
    timeoutSeconds: Math.round(Number(config.timeoutMs || 60_000) / 1000),
    fallback: fallback
      ? {
          provider: fallback.provider,
          model: fallback.model,
          configured: Boolean(fallback.apiKey),
          timeoutSeconds: Math.round(Number(fallback.timeoutMs || 60_000) / 1000)
        }
      : null
  };
}

function inferAction(req) {
  const pathName = req.path.replace(/^\/api\/?/, "") || "api";
  return `${req.method.toLowerCase()}_${pathName.replace(/[^a-zA-Z0-9]+/g, "_")}`;
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "";
}

function checkPromptSafety(prompt) {
  const text = String(prompt || "").toLowerCase();
  const blocked = [
    "习近平",
    "国家领导人",
    "政治敏感",
    "裸照",
    "色情",
    "成人视频",
    "未成年人色情",
    "儿童色情",
    "血腥",
    "虐杀",
    "恐怖袭击",
    "炸弹制作",
    "诈骗",
    "钓鱼网站"
  ];
  const hit = blocked.find((word) => text.includes(word.toLowerCase()));
  if (hit) {
    return {
      ok: false,
      reason: hit,
      message: "提示词包含不适合生成的内容，请修改后再试。"
    };
  }

  return { ok: true };
}

function getVisionAnalyzerConfig() {
  const provider = clean(process.env.VISION_PROVIDER || "").toLowerCase();
  const aliyunKey = process.env.ALIYUN_DASHSCOPE_API_KEY || process.env.DASHSCOPE_API_KEY || process.env.ALIYUN_API_KEY;
  const timeoutMs = clamp(Number(process.env.VISION_TIMEOUT_MS || 60_000), 10_000, 180_000);

  if (provider === "aliyun" || (!provider && aliyunKey)) {
    return {
      provider: "aliyun",
      apiKey: aliyunKey,
      apiBase: normalizeApiBase(process.env.ALIYUN_DASHSCOPE_API_BASE_URL || process.env.DASHSCOPE_API_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1"),
      model: process.env.ALIYUN_VISION_MODEL || process.env.DASHSCOPE_VISION_MODEL || process.env.VISION_MODEL || "qwen-vl-plus",
      timeoutMs
    };
  }

  return {
    provider: "openai-compatible",
    apiKey:
      process.env.VISION_API_KEY ||
      process.env.OPENAI_VISION_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GPT_IMAGE_API_KEY ||
      process.env.IMAGE_API_KEY,
    apiBase: normalizeApiBase(
      process.env.VISION_API_BASE_URL ||
        process.env.OPENAI_VISION_API_BASE_URL ||
        process.env.OPENAI_API_BASE_URL ||
        process.env.GPT_IMAGE_API_BASE_URL ||
        process.env.IMAGE_API_BASE_URL ||
        "https://api.openai.com/v1"
    ),
    model: process.env.VISION_MODEL || process.env.OPENAI_VISION_MODEL || process.env.GPT_VISION_MODEL || "gpt-4o-mini",
    timeoutMs
  };
}

function getVisionAnalyzerConfigs() {
  const configs = [];
  const primary = getVisionAnalyzerConfig();
  if (primary.apiKey) configs.push(primary);

  const fallbackApiKey =
    process.env.VISION_FALLBACK_API_KEY ||
    process.env.AGNES_VISION_API_KEY ||
    process.env.AGNES_API_KEY ||
    process.env.AGNES_TOKEN;
  const fallbackModel = process.env.VISION_FALLBACK_MODEL || process.env.AGNES_VISION_MODEL || "agnes-2.5-flash";
  const fallbackApiBase = normalizeApiBase(
    process.env.VISION_FALLBACK_API_BASE_URL ||
      process.env.AGNES_VISION_API_BASE_URL ||
      "https://apihub.agnes-ai.com/v1"
  );

  if (fallbackApiKey) {
    const duplicate = configs.some(
      (config) => config.apiKey === fallbackApiKey && config.apiBase === fallbackApiBase && config.model === fallbackModel
    );
    if (!duplicate) {
      configs.push({
        provider: clean(process.env.VISION_FALLBACK_PROVIDER || "agnes") || "agnes",
        apiKey: fallbackApiKey,
        apiBase: fallbackApiBase,
        model: fallbackModel,
        timeoutMs: clamp(Number(process.env.VISION_FALLBACK_TIMEOUT_MS || 60_000), 10_000, 180_000)
      });
    }
  }

  return configs;
}

function getDesignerBrainConfig() {
  return {
    provider: "openai-compatible",
    enabled: clean(process.env.DESIGNER_BRAIN_ENABLED || "true") !== "false",
    apiKey: process.env.DESIGNER_BRAIN_API_KEY || process.env.GPT_TEXT_API_KEY || process.env.OPENAI_API_KEY,
    apiBase: normalizeApiBase(
      process.env.DESIGNER_BRAIN_API_BASE_URL ||
        process.env.GPT_TEXT_API_BASE_URL ||
        process.env.OPENAI_API_BASE_URL ||
        "https://api.openai.com/v1"
    ),
    model: process.env.DESIGNER_BRAIN_MODEL || process.env.GPT_TEXT_MODEL || "gpt-5.5"
  };
}

function normalizeInput(body) {
  const requestedModel = clean(body.model || "gpt-image-2");
  if (!modelRegistry[requestedModel]) {
    throw new Error("该生图模型已下架或不可用，请刷新页面后重新选择模型。");
  }
  const model = requestedModel;
  const prompt = clean(body.prompt || body.title);
  const ratioState = resolveInputRatio(body.ratio, body.ratioLocked, prompt);
  const input = {
    prompt,
    category: clean(body.category || "fantasy"),
    style: clean(body.style || "dream-cinematic"),
    ratio: ratioState.ratio,
    ratioLocked: ratioState.ratioLocked,
    promptRatio: ratioState.promptRatio,
    requestedRatio: ratioState.requestedRatio,
    model,
    gptQuality: normalizeModelQuality(model, body.gptQuality),
    count: clamp(Number(body.count || 1), 1, 3),
    references: normalizeReferences(body.references)
  };
  input.promptTemplate = normalizePromptTemplate(body.promptTemplate || body.template);
  input.promptTemplateLabel = clean(body.promptTemplateLabel || "");

  if (!input.prompt) throw new Error("请先描述你想生成的画面");
  return input;
}

function resolveInputRatio(selectedRatioValue, ratioLockedValue, prompt) {
  const selectedRatio = normalizeRatioSuggestion(selectedRatioValue) || "16:9";
  const ratioLocked = ratioLockedValue === true || ratioLockedValue === "true";
  const promptRatio = inferRatioFromPrompt(prompt);
  return {
    ratio: ratioLocked ? selectedRatio : promptRatio || selectedRatio,
    ratioLocked,
    promptRatio,
    requestedRatio: selectedRatio
  };
}

function normalizePromptTemplate(value) {
  const template = clean(value || "custom");
  const allowed = new Set([
    "custom",
    "dream-portrait",
    "hairstyle-change",
    "makeup-change",
    "background-change",
    "sky-change",
    "clean-background",
    "high-tension-poster",
    "magazine-cover",
    "product-visual",
    "product-scene-blend",
    "product-detail-page",
    "product-white-background",
    "clothing-try-on",
    "ootd-flatlay",
    "group-photo",
    "wedding-photo",
    "id-photo",
    "era-portrait",
    "turnaround",
    "pose-control",
    "style-poster-remix",
    "xiaohongshu-card",
    "video-cover",
    "home-design",
    "furniture-placement",
    "old-photo-restore",
    "colorize-sketch",
    "ppt-cover",
    "business-launch-slide",
    "tourism-ppt",
    "product-landing-slide",
    "tech-ppt",
    "guochao-guide",
    "ppt-whitespace-cleanup",
    "ppt-wide-outpaint",
    "ppt-cutout-layout",
    "ppt-background-defocus",
    "ppt-motion-image",
    "ppt-style-unify",
    "ppt-add-elements",
    "ppt-light-color",
    "photo-deblur-upscale",
    "focus-control",
    "age-transform",
    "skin-texture-edit",
    "secondary-lighting",
    "consistent-outfit-change",
    "multi-subject-consistency",
    "roadmap-flow",
    "business-architecture",
    "data-dashboard",
    "comparison-slide",
    "timeline-slide",
    "icon-set",
    "illustration-kit",
    "ppt-background",
    "title-lettering",
    "teaching-knowledge-card",
    "six-grid-tutorial",
    "scientific-diagram",
    "paper-graphical-abstract",
    "product-exploded-view",
    "product-manual-page",
    "industrial-structure-sheet",
    "mobile-ui-showcase",
    "logo-identity-board",
    "brand-system-board",
    "livestream-scene",
    "cinematic-portrait",
    "outdoor-photoshoot",
    "sticker-pack",
    "journal-sticker-page",
    "character-bible",
    "storyboard-sheet",
    "ad-storyboard",
    "cinematic-keyframes",
    "game-ui-concept",
    "gameplay-screenshot",
    "game-boss-scene",
    "narrative-silhouette-poster",
    "event-poster",
    "travel-guide-poster",
    "cultural-product-kit",
    "ecommerce-main-set",
    "ecommerce-long-detail",
    "ecom-studio-main",
    "ecom-lifestyle-ad",
    "ecom-macro-detail",
    "ecom-craft-process",
    "ecom-derived-products",
    "ecom-product-combo",
    "ecom-marketing-pack",
    "ecom-bg-replace-workflow",
    "ecom-white-to-scene-workflow",
    "ecom-jewelry-tryon-workflow",
    "ecom-model-tryon-workflow",
    "ecom-object-transfer-workflow",
    "ecom-material-replace-workflow",
    "ecom-pose-replication-workflow",
    "precise-image-edit",
    "people-selfie-group",
    "expression-action-edit",
    "model-wear-product",
    "furniture-room-staging",
    "product-collab-design",
    "character-figure-toy",
    "sketch-to-finished-art",
    "physics-time-effect",
    "menu-design",
    "invitation-business-card",
    "word-flash-card",
    "book-cover-kit",
    "overseas-ecommerce-poster",
    "ecommerce-data-selling-point",
    "children-science-picturebook",
    "sketch-to-app-ui",
    "app-mockup-showcase",
    "research-analysis-figure",
    "aesthetic-3d-cartoon-portrait",
    "aesthetic-kpop-studio-beauty",
    "aesthetic-fine-brush-lady",
    "aesthetic-wordless-picturebook",
    "aesthetic-riviera-fashion",
    "aesthetic-surreal-sculpture",
    "aesthetic-eco-glass-surreal",
    "aesthetic-retro-healing-picturebook",
    "aesthetic-inflatable-surreal-product",
    "aesthetic-british-linocut",
    "aesthetic-graffiti-pop",
    "knowledge-encyclopedia",
    "life-timeline",
    "event-long-timeline",
    "guofeng-atlas",
    "keyframe"
  ]);
  return allowed.has(template) ? template : "custom";
}

function normalizeGptQuality(value) {
  const quality = String(value || "1k").toLowerCase();
  return ["1k", "2k", "4k"].includes(quality) ? quality : "1k";
}

function normalizeModelQuality(model, value) {
  return normalizeGptQuality(value);
}

function getCreditCost(input, modelConfig) {
  const perImageCost = getPerImageCreditCost(input, modelConfig);
  return perImageCost * input.count;
}

function getPerImageCreditCost(input, modelConfig) {
  const option = (modelConfig.qualityOptions || []).find((item) => item.id === input.gptQuality);
  return option?.creditCost || modelConfig.creditCost;
}

function normalizeReferences(references) {
  if (!Array.isArray(references)) return [];
  return references.slice(0, 5).map((item, index) => ({
    id: clean(item.id || `reference_${index + 1}`),
    name: clean(item.name || `reference_${index + 1}`),
    type: clean(item.type || "image/png"),
    size: Number(item.size || 0),
    usage: clean(item.usage || item.note || ""),
    url: clean(item.url || ""),
    image: cleanImageBase64(item.image || item.preview)
  }));
}

function clean(value) {
  return String(value || "").trim().slice(0, 2400);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function cleanImageBase64(value) {
  return String(value || "")
    .trim()
    .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "")
    .slice(0, 9_000_000);
}

function isCustomWorkflow(input = {}) {
  return !input.promptTemplate || input.promptTemplate === "custom";
}

function hasSelectedWorkflowTemplate(input = {}) {
  return !isCustomWorkflow(input);
}

async function buildDesignerPlan(input, referencePlan = null) {
  const fallbackRatio = input.ratio;
  const customMode = isCustomWorkflow(input);
  if (customMode) {
    return {
      source: "custom-literal",
      intent: "custom",
      finalPrompt: "",
      ratio: fallbackRatio,
      negativePrompt: "",
      notes: fallbackRatio ? `Inferred ratio ${fallbackRatio} from user prompt.` : "",
      error: ""
    };
  }

  const fallbackPrompt = buildRuleDesignerPrompt(input, referencePlan);
  const productionDesignGuide = buildProductionDesignGuide(input, input.prompt);
  const templateProductLocalEditGuide = buildTemplateProductLocalEditGuide(input, referencePlan);
  const designAssetMode = !customMode;
  const fallback = {
    source: "rules",
    intent: "general",
    finalPrompt: fallbackPrompt,
    ratio: fallbackRatio,
    negativePrompt: "",
    notes: fallbackRatio ? `Inferred ratio ${fallbackRatio} from user prompt.` : "",
    error: ""
  };

  const config = getDesignerBrainConfig();
  if (!config.enabled || !config.apiKey) return fallback;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35_000);
  try {
    const response = await fetch(`${config.apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: [
              "You are the invisible design brain for an AI image generation website.",
              "Convert casual Chinese user requests into production-ready image prompts.",
              "Do not ask questions. Do not create multiple textual options unless the user asks for one image containing multiple options.",
              "Never change generation count. The backend resolved aspect ratio is final.",
              "Return strict JSON only."
            ].join(" ")
          },
          {
            role: "user",
            content: [
              `Original user prompt: ${input.prompt}`,
              `Current effective ratio: ${input.ratio}`,
              `User manually locked ratio: ${input.ratioLocked ? "yes" : "no"}`,
              `Prompt-declared ratio after parsing: ${input.promptRatio || "none"}`,
              `Selected category: ${input.category}`,
              `Selected style: ${input.style}`,
              `Selected workflow template: ${input.promptTemplate || "custom"}`,
              customMode
                ? "CUSTOM MODE RULE: no workflow template was selected. Follow the user's prompt literally and let the text model infer the image plan from the user's own words and references. Do not apply any hidden poster, corporate promotion, brochure, PPT, ecommerce main-image, detail-page, book-cover, infographic, or production-design template, even if the user mentions those words in the prompt."
                : "TEMPLATE MODE RULE: the user explicitly selected a workflow template. Apply that template, but still preserve the user's named subjects and protected references.",
              productionDesignGuide,
              templateProductLocalEditGuide,
              `Reference image count: ${input.references.length}`,
              referencePlan?.summary ? `Reference analysis:\n${limitText(referencePlan.summary, 900)}` : "",
              buildReferenceProtectionGuide(input, referencePlan),
              "Do not suggest or override aspect ratio. Keep the current effective ratio exactly.",
              "If the prompt is a task like 'write positive and negative prompts' or 'make a poster', convert it into the final visual image prompt, not a request to write text.",
              designAssetMode
                ? "For explicitly requested posters, enrollment ads, social cards, product ads, covers, and infographics, specify layout, visual hierarchy, title area, content modules, hero image, color palette, and spacing."
                : "",
              designAssetMode
                ? "Make explicitly requested design assets look finished, not like a wireframe. Fill needed modules with short readable headings, concise labels, icons, photos, patterns, or decorative information blocks. Never leave empty boxes, blank cards, empty QR placeholders, or unfinished layout areas. Do not invent fake phone numbers, QR codes, official seals, or legal claims unless the user provides them."
                : "",
              "For reference images, never assume upload order means fixed roles. Use the reference analysis to dynamically decide which image contributes identity, pose, background, product, clothing, layout, lighting, palette, material, typography style, or should be ignored.",
              "If the user says only edit/repair the current image, do not generate a poster, ad, brochure, infographic, slide, or redesigned composition. Preserve the original photo composition and scene; change only the explicitly requested local regions.",
              templateProductLocalEditGuide
                ? "When TEMPLATE PRODUCT LOCAL EDIT MODE is active, do not let the selected ecommerce/template workflow redesign the product. The local product edit must be visible and product state must remain plausible."
                : "",
              "If the user asks to place product from reference image 1 into reference image 2, or says product/cup/bottle/logo/color/size must not change, treat reference image 1 as a locked product source. Do not redesign or replace that product; only integrate it into the target scene and requested model styling.",
              "For ecommerce reference workflows, dynamically detect product source, white-background product, target scene, model/person, clothing source, jewelry/accessory source, material texture source, pose reference, and layout/style reference. Protect only the intended source details and make the requested edit visibly happen.",
              "If the selected workflow template implies an edit, replacement, try-on, product blend, restoration, or style remix task, make the requested change visibly happen while preserving only the named protected elements.",
              "Return JSON with keys: intent, finalPrompt, ratio, negativePrompt, notes. ratio must be null. finalPrompt should be Chinese, concise but rich, suitable for an image model. Keep finalPrompt under 900 Chinese characters."
            ]
              .filter(Boolean)
              .join("\n")
          }
        ],
        temperature: 0.25,
        max_tokens: 900
      }),
      signal: controller.signal
    });

    const text = await response.text();
    if (!response.ok) {
      return { ...fallback, error: parseApiErrorText(text) || `Designer brain failed with ${response.status}` };
    }

    const data = JSON.parse(text);
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = extractJsonObject(content);
    if (!parsed) return fallback;

    const modelPrompt = clean(parsed.finalPrompt || parsed.prompt || "");
    const finalPrompt = isDesignerPromptOnTopic(input.prompt, modelPrompt) ? modelPrompt : fallbackPrompt;

    return {
      source: `${config.provider}:${config.model}`,
      intent: clean(parsed.intent || "general").slice(0, 80),
      finalPrompt: limitText(finalPrompt, 1200),
      ratio: normalizeRatioSuggestion(parsed.ratio) || fallbackRatio,
      negativePrompt: clean(parsed.negativePrompt || "").slice(0, 600),
      notes: clean(parsed.notes || "").slice(0, 1000),
      error: ""
    };
  } catch (error) {
    return { ...fallback, error: error.message || "Designer brain failed" };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildProductionDesignGuide(input, promptOverride = "") {
  const template = input.promptTemplate || "custom";
  const rawPrompt = promptOverride || input.prompt || "";
  if (template === "custom") return "";

  const rawText = `${rawPrompt} ${template}`;
  const text = rawText.replace(/\s+/g, "");
  const guides = [];
  const hasTemplate = (...ids) => ids.includes(template);
  const hasAny = (pattern) => pattern.test(text);

  if (
    hasTemplate("ppt-cover", "business-launch-slide", "product-landing-slide", "tech-ppt", "guochao-guide") ||
    hasAny(/PPT|keynote|幻灯片|汇报|演讲|发布会|封面页|首页|大屏|路演|课程封面|视频封面/i)
  ) {
    guides.push(
      "Presentation/keynote pattern: create one finished 16:9 slide, not a random poster. Use a strong hero visual, clear title/subtitle zone, 2-4 concise selling-point modules, optional parameter strip, balanced negative space, strict grid alignment, and premium typography. Avoid ecommerce-detail-page clutter."
    );
  }

  if (
    hasTemplate("paper-graphical-abstract", "scientific-diagram", "teaching-knowledge-card", "knowledge-encyclopedia", "children-science-picturebook", "research-analysis-figure", "word-flash-card", "aesthetic-wordless-picturebook", "aesthetic-retro-healing-picturebook") ||
    hasAny(/论文|博客总结|图形摘要|graphicalabstract|知识点|教学|教辅|科普|科学|机制|原理|公式|示意图|关系图|流程图|太阳系|数据可视化|信息图|闪卡|单词卡|绘本|医学影像|语义分割|遥感|深度估计/i)
  ) {
    guides.push(
      "Knowledge/infographic pattern: turn the topic into a clear visual explanation with one central mechanism or hero diagram, short labels, arrows/flow, 3-5 key modules, and a concise conclusion. Prioritize accuracy and hierarchy. If exact data is not provided, use generic visual chart shapes instead of inventing authoritative numbers."
    );
  }

  if (
    hasTemplate("data-dashboard", "comparison-slide", "timeline-slide", "roadmap-flow", "business-architecture", "ecommerce-data-selling-point") ||
    hasAny(/数据|KPI|看板|对比|时间线|路线图|架构图|产业链|漏斗|柱状图|折线图|环形图|报告|财经|商业媒体|参数|营养成分|卖点图/i)
  ) {
    guides.push(
      "Business visual pattern: build a polished business-media or report page with KPI cards, one main visual, process/chain modules, clean chart areas, and a strong conclusion block. Keep chart labels short, spacing generous, and modules filled. Do not leave empty cards or fake precise claims."
    );
  }

  if (
    hasTemplate("ecommerce-main-set", "ecommerce-long-detail", "ecom-studio-main", "ecom-lifestyle-ad", "ecom-macro-detail", "ecom-craft-process", "ecom-derived-products", "ecom-product-combo", "ecom-marketing-pack", "ecom-bg-replace-workflow", "ecom-white-to-scene-workflow", "ecom-jewelry-tryon-workflow", "ecom-model-tryon-workflow", "ecom-object-transfer-workflow", "ecom-material-replace-workflow", "ecom-pose-replication-workflow", "model-wear-product", "product-collab-design", "character-figure-toy", "overseas-ecommerce-poster", "ecommerce-data-selling-point", "product-detail-page", "product-visual", "product-white-background", "product-manual-page", "product-exploded-view", "industrial-structure-sheet") ||
    hasAny(/电商|淘宝|天猫|详情页|主图|卖点|成分|质地|产品说明|说明书|爆炸图|分解图|构造|结构拆解|参数|包装|商品|亚马逊|独立站|海外电商|TikTokShop/i)
  ) {
    guides.push(
      "Ecommerce/product pattern: preserve product identity from references. For a detail page, structure the image as hero product, core benefits, ingredient/material or mechanism, texture/detail closeups, usage scene, method/steps, product info, and closing slogan. Use short credible labels. Do not invent certifications, medical effects, exact prices, or legal claims unless the user supplies them."
    );
  }

  if (
    hasTemplate("mobile-ui-showcase", "logo-identity-board", "brand-system-board", "sketch-to-app-ui", "app-mockup-showcase") ||
    hasAny(/UI|App|界面|手机界面|作品集|Logo|标志|品牌|视觉系统|包装设计|品牌提案|Behance|Dribbble|样机|原型|线框图/i)
  ) {
    guides.push(
      "Brand/UI pattern: create a portfolio-ready presentation board with a unified design language. Phone mockups must keep realistic tall mobile ratios and consistent spacing. Logo/brand boards should include main mark, grid/variants, palette, typography, packaging/mockups, and application scenes. Do not copy famous brand logos, real platform chrome, or trademarked assets."
    );
  }

  if (
    hasTemplate("photo-deblur-upscale", "focus-control", "age-transform", "skin-texture-edit", "secondary-lighting", "consistent-outfit-change", "multi-subject-consistency", "precise-image-edit", "people-selfie-group", "expression-action-edit", "sketch-to-finished-art", "physics-time-effect", "aesthetic-3d-cartoon-portrait", "aesthetic-kpop-studio-beauty", "aesthetic-riviera-fashion", "cinematic-portrait", "outdoor-photoshoot", "sticker-pack", "journal-sticker-page") ||
    hasAny(/写真|人像|电影感|户外|室内|表情包|手帐|贴纸|保留脸|保留身份|换表情|换场景/i)
  ) {
    guides.push(
      "Portrait/reference-edit pattern: preserve the referenced person's identity, face proportions, hairstyle, and temperament. Improve expression, pose, lens, lighting, scene, and mood according to the user request. Do not keep a stiff source expression if the user asks for cinematic or lifestyle photos. Avoid plastic skin, influencer filters, and identity drift."
    );
  }

  if (
    hasTemplate("furniture-room-staging", "furniture-placement", "home-design") ||
    hasAny(/家具|空房间|客厅|卧室|餐厅|书房|沙发|椅子|桌子|灯具|家居|室内实景|软装|摆放/i)
  ) {
    guides.push(
      "Interior/furniture staging pattern: preserve room architecture, camera perspective, floor/wall planes, windows, and light direction. Place furniture with believable scale, floor contact, shadows, occlusion, spacing, and coherent style."
    );
  }

  if (
    hasTemplate("precise-image-edit") ||
    hasAny(/改文字|修改文字|改数字|修改数字|去水印|去除水印|局部修改|精准P图|精准改图/i)
  ) {
    guides.push(
      "Precise edit pattern: make only the requested local change and preserve the rest. For text edits, only attempt short words, numbers, labels, or one phrase; do not attempt dense Chinese body text inside the image model."
    );
  }

  if (
    hasTemplate("storyboard-sheet", "ad-storyboard", "cinematic-keyframes", "character-bible") ||
    hasAny(/分镜|九宫格|故事板|剧情创作板|视觉板|角色设定|场景设定|运镜|镜头|MV|短片|广告脚本/i)
  ) {
    guides.push(
      "Storyboard/visual-development pattern: make one coherent board, not unrelated images. Keep recurring characters, props, wardrobe, scene, lighting, and color grading consistent. Vary shot size and camera angle deliberately. Fill each panel with a distinct narrative purpose and avoid blank storyboard cells."
    );
  }

  if (
    hasTemplate("high-tension-poster", "style-poster-remix", "event-poster", "narrative-silhouette-poster", "video-cover", "aesthetic-fine-brush-lady", "aesthetic-surreal-sculpture", "aesthetic-eco-glass-surreal", "aesthetic-inflatable-surreal-product", "aesthetic-british-linocut", "aesthetic-graffiti-pop") ||
    hasAny(/电影海报|美食海报|活动海报|宣传海报|海报设计|主视觉|封面|标题区|字体排版|留白|电影节|餐饮|牛排/i)
  ) {
    guides.push(
      "Poster/key-visual pattern: make it look like a finished published poster with a strong focal image, controlled palette, readable title area, concise supporting copy, premium typography, and intentional negative space. Fill decorative modules safely; avoid empty placeholders and long microtext."
    );
  }

  if (
    hasTemplate("menu-design", "invitation-business-card", "word-flash-card", "book-cover-kit", "overseas-ecommerce-poster", "ecommerce-data-selling-point", "children-science-picturebook", "sketch-to-app-ui", "app-mockup-showcase", "research-analysis-figure") ||
    hasAny(/菜单|价目表|请柬|邀请函|名片|单词闪卡|书籍封面|立体书封|海外电商|亚马逊|独立站|儿童绘本|草图转UI|样机展示|科研图例|医学影像|语义分割|遥感识别/i)
  ) {
    guides.push(
      "Content-design material pattern: make a finished commercial/educational design asset with clear hierarchy, strong visual theme, short readable headings, concise labels, icons, cards, and deliberate spacing. Dense Chinese body text should be represented as clean layout zones or short labels, not generated as long paragraphs inside the image."
    );
  }

  if (
    hasTemplate("aesthetic-3d-cartoon-portrait", "aesthetic-kpop-studio-beauty", "aesthetic-fine-brush-lady", "aesthetic-wordless-picturebook", "aesthetic-riviera-fashion", "aesthetic-surreal-sculpture", "aesthetic-eco-glass-surreal", "aesthetic-retro-healing-picturebook", "aesthetic-inflatable-surreal-product", "aesthetic-british-linocut", "aesthetic-graffiti-pop") ||
    hasAny(/高级风格|风格美学|三维卡通|韩流|工笔|无字绘本|南法|超现实|玻璃|复古绘本|充气|版画|涂鸦波普/i)
  ) {
    guides.push(
      "High-aesthetic style pattern: expand the user's idea through subject, composition, camera/lens, material, lighting, color ratio, texture, negative constraints, and mood. Use safe generic style language instead of named-artist imitation, real brand marks, or exact trademarks."
    );
  }

  if (!guides.length) return "";

  return [
    "Production design guide distilled from high-performing GPT Image V2 examples:",
    ...guides,
    "Universal completion rule: the image should look deliverable on first glance. Complete visual hierarchy, no blank blocks, no wireframes, no empty QR boxes, no random default woman, no unrelated neon/fantasy background, no copied real platform screenshots, no currency/security-document replication."
  ].join("\n");
}

function buildCompactProductionDesignRule(input, promptOverride = "") {
  const guide = buildProductionDesignGuide(input, promptOverride);
  if (!guide) return "";
  return limitText(
    guide
      .replace(/^Production design guide distilled from high-performing GPT Image V2 examples:\n?/, "")
      .replace(/\s+/g, " "),
    520
  );
}

function hasAnyText(text, words) {
  const raw = String(text || "").toLowerCase();
  return words.some((word) => raw.includes(String(word).toLowerCase()));
}

function getPromptAndReferenceNotes(input = {}, referencePlan = null) {
  return [
    input.prompt,
    input.originalPrompt,
    input.designerPrompt,
    input.promptTemplate,
    input.category,
    input.style,
    ...(input.references || []).map((item) => item.usage || ""),
    referencePlan?.summary || ""
  ].filter(Boolean).join(" ");
}

function isStrictProductLockPrompt(input = {}, referencePlan = null) {
  if (!input.references?.length) return false;
  const text = getPromptAndReferenceNotes(input, referencePlan);
  const productIntent = /(产品|商品|包装|瓶|桶|罐|盒|杯|水杯|肥料|主图|电商|详情页|货品|SKU|logo|Logo|品牌|标签|包装图|产品图)/i.test(text);
  const lockIntent = /(产品就是|这是我的产品|这是我.*产品图|我给产品图|放置我给产品图|用参考图.*产品|参考图.*产品|保留.*产品|产品.*保留|不能.*改变.*产品|不能改变我的产品|不要.*改.*产品|产品.*不变|包装.*不变|标签.*不变|logo.*不变|Logo.*不变|不能脱离.*产品|产品原型|原产品|同款产品|源产品|锁定产品)/i.test(text);
  const sourceNote = (input.references || []).some((item) => /(产品|商品|包装|源图|原图|要放在图上|不能改变|保留|不变|不要改|就是这个|以.*参考图)/i.test(item.usage || ""));
  return productIntent && (lockIntent || sourceNote);
}

function buildStrictProductLockPrompt(input, referencePlan, ratio, referenceSummary = "") {
  const productRef = (input.references || []).findIndex((item) => /(产品|商品|包装|源图|原图|要放在图上|不能改变|保留|不变|不要改|就是这个|以.*参考图)/i.test(item.usage || ""));
  const productRefNo = productRef >= 0 ? productRef + 1 : 1;
  return limitText([
    `严格产品锁定电商设计任务。用户原始要求：${input.prompt}`,
    `Reference image ${productRefNo} is the locked source product and is the visual truth for the product itself.`,
    "The source product must be preserved from the reference image, not redesigned from the text prompt. Keep the real bucket/bottle/package shape, lid/cap, proportions, front angle, label color blocks, logo placement, brand mark, product name, parameter text positions, fruit/plant illustrations, net-content area, side label structure, material edges, highlights, shadows, and all recognizable packaging identity as much as the image model allows.",
    "If the written prompt describes product details that differ from the reference image, the reference image wins. Treat written product descriptions only as layout/copy guidance, not permission to invent a new package.",
    "Use the user's prompt only to design the ecommerce layout around the locked product: background, banners, selling-point badges, decorative fruit/flowers, lighting, shadows, spacing, typography zones, and overall commercial composition.",
    "Do not replace the product with a similar bucket, do not simplify the label, do not create a new brand design, do not redraw a generic green package, do not change the logo/name/label layout/product proportions.",
    "This is not local photo repair and not a generic poster template. It is a new ecommerce composition built around the exact referenced product.",
    `Output aspect ratio: ${ratio}.`,
    referenceSummary
  ].filter(Boolean).join("\n"), 1600);
}

function buildStrictProductLockGuide(input, referencePlan = null) {
  const productRef = (input.references || []).findIndex((item) => /(产品|商品|包装|源图|原图|要放在图上|不能改变|保留|不变|不要改|就是这个|以.*参考图)/i.test(item.usage || ""));
  const productRefNo = productRef >= 0 ? productRef + 1 : 1;
  const refNote = input.references?.[productRefNo - 1]?.usage || "";
  return [
    "STRICT PRODUCT LOCK - HIGHEST PRIORITY:",
    `Use reference image ${productRefNo} as the locked product source.${refNote ? ` User note: ${limitText(refNote, 180)}` : ""}`,
    "The generated image must keep the referenced product's real packaging identity. Preserve the bucket/bottle/container silhouette, lid/cap geometry, camera angle, label color-block layout, logo/brand placement, product-name placement, parameter/weight text areas, illustration positions, material, edges, and proportions as much as the image model allows.",
    "Do not redesign the product from the written prompt. Do not replace it with a similar product, a cleaner generic product, another label layout, another logo, or another package shape.",
    "If text prompt details conflict with the reference product, the reference product wins. Use text prompt only for the surrounding ecommerce composition, background, banners, badges, decorative props, lighting, and spacing."
  ].filter(Boolean).join("\n");
}

function isTemplateProductLocalEditPrompt(input = {}, referencePlan = null) {
  if (!hasSelectedWorkflowTemplate(input)) return false;
  if (!input.references?.length) return false;
  const text = getPromptAndReferenceNotes(input, referencePlan).replace(/\s+/g, "");
  const productIntent = /(产品|商品|包装|盒|盒子|纸巾|面巾纸|抽纸|湿巾|瓶|瓶子|罐|袋|袋子|杯|水杯|包装图|产品图|主图|电商|logo|Logo|品牌|商标|标签|贴纸|封面|product|ecom|packaging|package|label)/i.test(text);
  const localEditIntent =
    /(局部|微调|微改|稍微|小改|只改|仅改|只替换|仅替换|修改|更改|改成|改为|换成|替换|换掉|调整|差异化|文字|字样|字体|标题|logo|Logo|品牌名|标签|贴纸|颜色|材质|纹理|图案|花纹|包装文字)/i.test(text) ||
    /把[^，。,.]{1,16}(?:改成|改为|换成|替换成)[^，。,.]{1,16}/i.test(text);
  return productIntent && localEditIntent;
}

function isTemplateProductTextReplacementPrompt(input = {}, referencePlan = null) {
  if (!isTemplateProductLocalEditPrompt(input, referencePlan)) return false;
  const text = getPromptAndReferenceNotes(input, referencePlan).replace(/\s+/g, "");
  return /(文字|字样|字体|标题|品牌名|logo|Logo|商标|标签|贴纸|包装文字|改字|换字|改文案|换文案)/i.test(text) ||
    /把[^，。,.]{1,16}(?:改成|改为|换成|替换成)[^，。,.]{1,16}/i.test(text);
}

function buildTemplateProductLocalEditGuide(input, referencePlan = null) {
  if (!isTemplateProductLocalEditPrompt(input, referencePlan)) return "";
  const textReplacement = isTemplateProductTextReplacementPrompt(input, referencePlan);
  return [
    "TEMPLATE PRODUCT LOCAL EDIT MODE - higher priority than the selected template:",
    "Priority order is mandatory: user's explicit edit instruction first, referenced product/package preservation second, selected template style last.",
    "The selected template is only a helper for background, lighting, polish, camera, spacing, and ecommerce presentation. It must not take over the task or redesign the product.",
    "Treat the uploaded product/package reference as the source truth. Preserve package silhouette, closed/open state, proportions, camera angle, color-block layout, brand/logo placement, label structure, side panel, barcode area, material edges, holes, folds, seams, shadows, and recognizable product identity as much as the image model allows.",
    "Only the user-named local region may change. Do not change product type, package structure, product count, product opening state, contents visibility, usage state, or surrounding product identity unless the user explicitly asks for that exact change.",
    "For packaged tissue, wet wipes, boxed paper, bags, bottles, cans, cups, and similar products: do not open the package, do not pull contents out, do not expose tissue/paper/wipes outside the package, do not create torn packaging, and do not show the product being used unless the user explicitly asks for it.",
    textReplacement
      ? "Local text replacement rule: perform the specified text/logo/label replacement on the package area only. Keep all other printed positions, icons, layout zones, side labels, barcode area, and decorative structures stable. Do not add unrelated random text or rewrite the whole package."
      : "",
    "If the template asks for an ecommerce poster/detail-page/main-image but the user asks for a small product edit, the small product edit wins. The result should look like the same product after the requested local edit, not a newly designed product generated by the template."
  ].filter(Boolean).join("\n");
}

function buildTemplateProductLocalEditPrompt(input, referencePlan, ratio, referenceSummary = "") {
  return limitText([
    `模板辅助的产品局部微改任务。用户原始要求：${input.prompt}`,
    "必须先执行用户明确的局部修改，再保留参考图产品，最后才考虑模板风格。",
    "参考图里的产品/包装是产品真实依据，不能被模板重新设计成另一种产品。保持产品外形、包装结构、开合状态、蓝白/原有配色逻辑、品牌/Logo位置、标签布局、侧面信息、条码区域、挂孔/封口/折角、材质边缘和可识别身份。",
    "只允许改变用户明确点名的局部区域，例如指定文字、Logo、标签、颜色、图案或小范围差异化。没有点名的产品结构和包装状态全部保持。",
    "如果是纸巾、面巾纸、抽纸、湿巾、盒装/袋装/瓶装/罐装产品，禁止打开包装，禁止把内容物露出包装外，禁止新增抽出的纸巾/湿巾/液体/散落物，除非用户明确要求。",
    isTemplateProductTextReplacementPrompt(input, referencePlan)
      ? "文字替换必须按用户原话执行：只替换指定文字/字样/品牌名/标签文字，其他文字位置、图标、侧标、条码和包装版式尽量保持，不要整套重画包装文案。"
      : "",
    "模板只能影响背景、光影、质感、构图、电商氛围和展示排版，不能覆盖用户提示词，不能改变产品主体。",
    `Output aspect ratio: ${ratio}.`,
    referenceSummary
  ].filter(Boolean).join("\n"), 1600);
}

function isProductReferenceCompositionPrompt(text, input = {}) {
  if (!input.references?.length) return false;
  const raw = String(text || "");
  const hasProduct = hasAnyText(raw, ["产品", "商品", "电商", "主图", "水杯", "杯子", "杯", "瓶", "包装", "logo", "LOGO", "商标"]);
  const hasReferenceProduct = /参考图\s*[一1]|图\s*[一1]|ref\s*1|reference\s*1/i.test(raw);
  const hasPlacement = hasAnyText(raw, ["放置", "放到", "放进", "放入", "放在", "拿着", "手持", "融入", "放置这张参考图2", "参考图2", "图2"]);
  const hasPreserve = hasAnyText(raw, ["不改变", "不变", "保持", "保留", "不要改", "不遮挡", "凸显", "主要是", "大小", "颜色"]);
  return hasProduct && (hasReferenceProduct || hasPlacement) && hasPreserve;
}

function buildProductReferenceCompositionPrompt(input, referencePlan, ratio, referenceSummary = "") {
  return limitText([
    `参考图产品合成任务，绝对不是宣传海报模板或重新设计产品。用户原始要求：${input.prompt}`,
    "Reference image 1 is the locked source product. Preserve the exact product identity as much as the image model allows: product type, cup/bottle shape, size impression, color, material, logo/label placement, cap/lid, sleeve, holes/patterns, and all recognizable design features.",
    "Reference image 2 is the target scene/model/style reference. Put the locked product from reference image 1 naturally into reference image 2's scene or hand-held pose.",
    "Do not invent a different cup, different bottle, different brand, different color, different logo, or generic green product. The product must remain recognizably from reference image 1.",
    "Keep fingers or hands from covering the logo. If a hand holds the product, show the logo/brand area clearly facing the camera.",
    "Only change what the user explicitly requested, such as model clothing, hat, pose integration, lighting, ecommerce polish, and background atmosphere. Product identity has higher priority than template style.",
    "Create a clean ecommerce product image focused on the referenced product, not a corporate brochure, school poster, PPT, infographic, or unrelated advertisement layout.",
    `Output aspect ratio: ${ratio}.`,
    referenceSummary
  ].filter(Boolean).join("\n"), 1400);
}
function isStrictReferenceEditPrompt(text, input = {}) {
  const raw = String(text || "");
  if (!input.references?.length) return false;
  if (isStrictProductLockPrompt(input, null)) return false;
  const editIntent = /(修图|当前图片|原图|局部|只改|仅改|改|修改|更改|换|替换|变成|改为|调整|换脸|改脸|衣服|服装|背景|其余|其他)/.test(raw);
  const preservationIntent = /(只修图|不生图|不要生成.*海报|不要.*海报|不是海报|单纯.*改变|当前图片|原图|其余.*不动|其他.*不要动|任何东西都不要动|人物不变|构图不变|背景不动|场景不动|保持|保留|不变|不动)/.test(raw);
  return editIntent && preservationIntent;
}

function buildStrictReferenceEditPrompt(input, referencePlan, ratio, referenceSummary = "") {
  return limitText([
    `参考图局部修图任务，绝对不是海报、宣传图、招生图、信息图或重新设计图片。用户原始要求：${input.prompt}`,
    "必须以用户上传的参考图作为原图基础，保持原照片的构图、会议室/室内场景、桌椅、墙面、窗帘、品牌标识、人物位置、坐姿、光线、透视和画面比例整体不变。",
    "只执行用户明确指定的局部变化：例如更换人物衣服为不统一的夏日大学生服装、修改指定人物的人脸。没有被点名的区域全部保持原图状态。",
    "禁止添加宣传海报排版、标题区、信息卡片、学院/学校模块、二维码、底部蓝色栏、图标、企业宣传文案或任何额外设计版式。",
    "输出应像一张自然修过的真实照片，而不是商业海报、公司宣传图、招生广告或图文排版设计。",
    `Output aspect ratio: ${ratio}.`,
    referenceSummary
  ].filter(Boolean).join("\n"), 1200);
}
function buildRuleDesignerPrompt(input, referencePlan = null) {
  const prompt = input.prompt;
  const text = String(prompt || "");
  const ratio = input.ratio;
  const productionDesignGuide = buildProductionDesignGuide(input, text);
  const referenceSummary = referencePlan?.summary ? `参考图理解：${referencePlan.summary}` : "";
  const templateSelected = hasSelectedWorkflowTemplate(input);
  const allowTemplateLikeLayout = templateSelected;

  if (isTemplateProductLocalEditPrompt(input, referencePlan)) {
    return buildTemplateProductLocalEditPrompt(input, referencePlan, ratio, referenceSummary);
  }

  if (isStrictProductLockPrompt(input, referencePlan)) {
    return buildStrictProductLockPrompt(input, referencePlan, ratio, referenceSummary);
  }

  if (isStrictReferenceEditPrompt(text, input)) {
    return buildStrictReferenceEditPrompt(input, referencePlan, ratio, referenceSummary);
  }

  if (isProductReferenceCompositionPrompt(text, input)) {
    return buildProductReferenceCompositionPrompt(input, referencePlan, ratio, referenceSummary);
  }

  if (allowTemplateLikeLayout && /(海报|宣传|招生|专业|课程|学校|学院|大学|简章|广告|推广|展板|易拉宝|活动|分镜|短片|广告片|游戏|界面|UI|攻略|长图|图鉴|百科|文创|物料|主图|详情页|教学|知识点|教程|说明书|爆炸图|结构图|品牌|Logo|直播间|写真|表情包|手帐|PPT|留白|扩图|横图|虚焦|抠图|扣图|去背景|背景模糊|动态模糊|拖尾|调色|打光|加元素|增加元素|风格统一)/i.test(text)) {
    return limitText([
      `生成一张完整的${ratio}视觉成品，严格围绕用户主题：${prompt}`,
      "只使用用户明确要求的成品类型或用户主动选择的模板，不要把普通自定义需求改写成公司宣传图、招生海报、PPT或电商主图。",
      "版式结构应服务用户原始目标；如果用户没有要求标题、文案模块、二维码或信息卡片，不要强行添加这些元素。",
      "视觉要求：主体明确、层级清晰、色彩协调、构图完整、参考图关系准确。",
      "成品要求：如果用户要求了信息模块，模块里必须有内容，不能出现空白卡片、空白二维码框、空信息块、线框图或半成品占位。可以使用短标题、短标签、图标、小照片、装饰纹样和概括性短文案填充模块；电话、网址、二维码等如果用户没提供，就不要编造真实信息，只做无文字装饰或泛化短标签。",
      "必须保留用户原文里的主体、产品、人物、地点、行业、品牌意图等关键实体，不要改成无关赛博朋克、美女写真、风景插画、公司宣传图或普通旅游拼图。",
      productionDesignGuide,
      referenceSummary
    ]
      .filter(Boolean)
      .join("\n"), 1200);
  }

  return limitText([
    `根据用户原始需求生成一张新图：${prompt}`,
    isCustomWorkflow(input)
      ? "当前是自定义模式：严格按用户提示词和参考图关系执行，不套用任何隐藏模板，不调用后台预设海报、电商主图、公司宣传图、PPT、书籍封面、详情页或信息图规则；只让文本模型根据用户原话自行分析。"
      : "先理解用户真实目的，再组织主体、场景、构图、光线、风格、材质和负面约束。",
    "不要套用默认女人、默认霓虹城市、默认奇幻背景。必须围绕用户原文主题。",
    productionDesignGuide,
    referenceSummary
  ]
    .filter(Boolean)
    .join("\n"), 900);
}

function isDesignerPromptOnTopic(originalPrompt, finalPrompt) {
  const finalText = String(finalPrompt || "");
  if (!finalText.trim()) return false;
  const terms = extractImportantTerms(originalPrompt);
  if (!terms.length) return true;
  const kept = terms.filter((term) => finalText.includes(term));
  return kept.length >= Math.ceil(terms.length * 0.5);
}

function extractImportantTerms(prompt) {
  const text = String(prompt || "");
  const terms = new Set();
  const patterns = [
    /[\u4e00-\u9fa5A-Za-z0-9]{2,}大学/g,
    /[\u4e00-\u9fa5A-Za-z0-9]{2,}学院/g,
    /[\u4e00-\u9fa5A-Za-z0-9]{2,}专业/g,
    /[\u4e00-\u9fa5A-Za-z0-9]{2,}公司/g,
    /[\u4e00-\u9fa5A-Za-z0-9]{2,}品牌/g,
    /[\u4e00-\u9fa5A-Za-z0-9]{2,}产品/g,
    /[\u4e00-\u9fa5A-Za-z0-9]{2,}课程/g
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) terms.add(match[0].slice(0, 24));
  }
  for (const keyword of ["南宁", "越南语", "应用越南语", "国际学院", "东盟", "招生", "宣传海报"]) {
    if (text.includes(keyword)) terms.add(keyword);
  }
  return [...terms].slice(0, 8);
}

function applyDesignerPlan(input, designerPlan) {
  if (!designerPlan) return input;
  const finalPrompt = clean(designerPlan.finalPrompt || "");
  const suggestedRatio = normalizeRatioSuggestion(designerPlan.ratio);
  if (designerPlan.source === "custom-literal") {
    return {
      ...input,
      originalPrompt: input.originalPrompt || input.prompt,
      designerPrompt: "",
      designerIntent: "custom",
      designerNegativePrompt: "",
      ratio: input.ratio
    };
  }
  return {
    ...input,
    originalPrompt: input.originalPrompt || input.prompt,
    designerPrompt: finalPrompt || "",
    designerIntent: designerPlan.intent || "",
    designerNegativePrompt: designerPlan.negativePrompt || "",
    ratio: input.ratio
  };
}

function inferRatioFromPrompt(prompt) {
  const text = String(prompt || "").replace(/\s+/g, "").toLowerCase();
  if (/(9[:：]?16|竖版|竖屏|竖图|手机海报|手机壁纸|短视频封面|小红书封面)/i.test(text)) return "9:16";
  if (/(16[:：]?9|横版|横屏|横图|宽屏|banner|头图|电脑壁纸)/i.test(text)) return "16:9";
  if (/(1[:：]?1|方图|正方形|头像|icon|图标)/i.test(text)) return "1:1";
  if (/(3[:：]?4)/i.test(text)) return "3:4";
  return "";
}

function normalizeRatioSuggestion(value) {
  const text = String(value || "").replace(/\s+/g, "");
  const allowed = new Set(["1:1", "16:9", "9:16", "3:4"]);
  const normalized = text.replace("：", ":");
  return allowed.has(normalized) ? normalized : "";
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || raw.match(/\{[\s\S]*\}/)?.[0] || raw;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function parseApiErrorText(text) {
  try {
    const data = JSON.parse(text);
    return data.error?.message || data.message || "";
  } catch {
    return String(text || "").slice(0, 300);
  }
}

function buildPrompts(input, referencePlan = null, modelConfig = null) {
  const userInstruction = input.originalPrompt || input.prompt;
  const generationInstruction = limitText(input.designerPrompt || input.prompt, 1200);
  const designerGuide = input.designerPrompt
    ? [
        `Designer brain rewritten prompt: ${limitText(input.designerPrompt, 1200)}`,
        input.designerIntent ? `Designer inferred intent: ${input.designerIntent}` : "",
        input.designerNegativePrompt ? `Designer negative constraints: ${limitText(input.designerNegativePrompt, 260)}` : ""
      ].filter(Boolean).join("\n")
    : "";
  const categoryMap = {
    custom: "custom subject direction based on the user prompt",
    fantasy: "fantasy atmosphere, cinematic lighting, refined details",
    future: "futuristic technology, neon lighting, premium sci-fi concept art",
    portrait: "portrait quality, clear emotion, refined facial details, soft rim light",
    anime: "high quality anime illustration, clean linework, rich colors",
    nature: "natural landscape, deep atmosphere, realistic light, wide composition",
    architecture: "architectural design, clear spatial layers, precise structure",
    product: "premium product poster, clean material detail, commercial lighting",
    ecommerceflow: "ecommerce reference-image workflow, precise product preservation, natural scene integration, realistic commercial editing",
    nanocases: "reference-image creative workflow, precise edits, identity preservation, natural integration",
    contentdesign: "commercial content design, short readable text, polished layout, clear hierarchy",
    aesthetic: "high-aesthetic visual style, strong art direction, refined composition, material, lighting, and color system",
    art: "surreal art composition, strong color relationship, gallery quality"
  };
  const styleMap = {
    custom: "custom style based on the user prompt and reference images",
    "dream-cinematic": "cinematic, polished, natural lighting, high detail",
    anime: "high quality anime illustration, clean lines, expressive character design",
    realistic: "realistic photography, accurate materials, professional lighting",
    product: "commercial poster style, clean composition, premium visual quality"
  };
  const templateGuide = buildPromptTemplateGuide(input.promptTemplate, input);
  const productionDesignGuide = buildProductionDesignGuide(input, userInstruction);
  const referenceProtectionGuide = buildReferenceProtectionGuide(input, referencePlan);
  const templateProductLocalEditGuide = buildTemplateProductLocalEditGuide(input, referencePlan);
  const strictProductLock = isStrictProductLockPrompt(input, referencePlan);
  const strictProductLockGuide = strictProductLock
    ? buildStrictProductLockGuide(input, referencePlan)
    : "";

  const hasReferences = input.references.length > 0;
  const referenceGuide = hasReferences
    ? buildReferenceGuide(input, referencePlan)
    : "No reference images are provided. Generate the image from the text prompt.";

  const styleHint = isCustomWorkflow(input) ? styleMap.custom : (styleMap[input.style] || styleMap["dream-cinematic"]);
  const categoryHint = isCustomWorkflow(input) ? categoryMap.custom : (categoryMap[input.category] || categoryMap.fantasy);
  const interactionGuide = hasReferences ? buildInteractionGuide(userInstruction, input.references.length) : "";
  const isAgnes = modelConfig?.provider === "agnes";
  const editIntentGuide = hasReferences && isAgnes ? buildAgnesEditIntentGuide(input) : "";
  const posterCompletenessGuide = isPosterLikePrompt(userInstruction, input)
    ? "Poster completion rule: the result must look like a finished published poster. Fill all modules with short labels, icons, photos, decorative information blocks, and visual dividers. No empty cards, no blank content boxes, no empty QR placeholders, no wireframe panels, no unfinished layout areas."
    : "";
  const agnesNoCopyGuide =
    hasReferences && isAgnes
      ? "Agnes Forge rule: reference images are inputs for editing or guidance. Never return an unchanged copy of the uploaded reference image unless the user explicitly asks for exact restoration only."
      : "";

  const base = hasReferences
    ? [
        templateProductLocalEditGuide,
        strictProductLockGuide,
        `Original user instruction: ${userInstruction}`,
        designerGuide,
        `Final generation instruction: ${generationInstruction}`,
        editIntentGuide,
        interactionGuide,
        referenceGuide,
        referenceProtectionGuide,
        templateGuide,
        productionDesignGuide,
        posterCompletenessGuide,
        `Output aspect ratio: ${input.ratio}`,
        `Style hint, low priority: ${styleHint}.`,
        templateProductLocalEditGuide
          ? "Priority order: user's explicit product edit first, referenced product/package preservation second, selected template style last."
          : strictProductLock
            ? "Priority order: locked reference product first, user's requested ecommerce layout second, style/template hints last."
            : "Priority order: user instruction first, reference image content second, style hint last.",
        agnesNoCopyGuide,
        "Do not invent a fantasy forest, neon city, or unrelated background unless it appears in the references or user instruction.",
        "Quality requirements: clean composition, sharp subject, natural integration, matching perspective and lighting, no watermark, no random text, no duplicated person, no distorted hands."
      ].filter(Boolean).join("\n")
    : [
        `Original user instruction: ${userInstruction}`,
        designerGuide,
        `Final generation instruction: ${generationInstruction}`,
        `Subject direction: ${categoryHint}`,
        `Visual style: ${styleHint}`,
        templateGuide,
        productionDesignGuide,
        posterCompletenessGuide,
        `Output aspect ratio: ${input.ratio}`,
        "Quality requirements: clear subject, stable composition, rich details, polished image, no watermark, no random text, no distorted hands, no duplicated person."
      ].join("\n");

  return Array.from({ length: input.count }).map((_, index) => {
    const prompt = input.count > 1
      ? `${base}\nVariation ${index + 1}: keep the same core instruction, create a distinct but consistent composition.`
      : base;
    return {
      id: `image_${index + 1}`,
      kind: "image",
      prompt: compactPromptForCost(prompt, input, modelConfig),
      negativePrompt:
        limitText(input.designerNegativePrompt, 420) ||
        "low resolution, wrong text, gibberish text, watermark, logo, distorted hands, duplicated person, broken face, unrelated background"
    };
  });
}

function compactPromptForCost(prompt, input, modelConfig) {
  if (modelConfig?.provider !== "openai") return prompt;
  const maxLength = Number(process.env.GPT_IMAGE_MAX_PROMPT_CHARS || 3200);
  const text = String(prompt || "").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length <= maxLength) return text;

  const userInstruction = limitText(input.originalPrompt || input.prompt, 700);
  const designerPrompt = limitText(input.designerPrompt || input.prompt, 1200);
  const referenceNotes = summarizeReferenceInputsForPrompt(input);
  const templateProductLocalEditRule = buildTemplateProductLocalEditGuide(input, null);
  const referenceProtectionRule = buildReferenceProtectionGuide(input, null);
  const strictProductLockRule = isStrictProductLockPrompt(input, null) ? buildStrictProductLockGuide(input, null) : "";
  const productionRule = buildCompactProductionDesignRule(input, userInstruction);
  const rules = [
    isPosterLikePrompt(userInstruction, input)
      ? "Finished poster: complete visual hierarchy, filled modules, no blank cards, no empty QR placeholder, no wireframe, no unfinished layout."
      : "",
    productionRule,
    "Preserve all key entities from the user instruction. Do not replace the subject with a default woman, neon city, fantasy scene, or unrelated background.",
    "High quality: clean composition, sharp subject, coherent lighting, natural perspective, polished colors, no watermark, no random/gibberish text, no distorted hands."
  ].filter(Boolean);

  return [
    templateProductLocalEditRule,
    strictProductLockRule,
    `User: ${userInstruction}`,
    `Optimized image prompt: ${designerPrompt}`,
    referenceNotes,
    referenceProtectionRule,
    `Output aspect ratio: ${input.ratio}`,
    rules.join(" ")
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, maxLength);
}

function summarizeReferenceInputsForPrompt(input) {
  if (!input.references?.length) return "";
  return [
    `Reference images: ${input.references.length}.`,
    input.references
      .map((item, index) => {
        const usage = item.usage ? ` note: ${limitText(item.usage, 80)}` : "";
        return `Ref ${index + 1}: ${item.name || `reference_${index + 1}`}${usage}`;
      })
      .join("; "),
    "Use references only for relevant identity, scene, pose, product, composition, lighting, or style evidence; ignore irrelevant text, watermarks, UI, and accidental details."
  ].join(" ");
}

function limitText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function isPosterLikePrompt(prompt, input = null) {
  const text = String(prompt || "");
  if (input && isCustomWorkflow(input)) return false;
  if (isStrictReferenceEditPrompt(text, { references: [{}] })) return false;
  return /(海报|宣传|招生|专业|课程|学校|学院|大学|简章|广告|推广|展板|易拉宝|小红书|封面|信息图|详情页|PPT|幻灯片|汇报|单页|看板|流程图|路线图|架构图|时间轴|图标|插画|官网首屏|分镜|故事板|角色设定|设定集|关键帧|广告分镜|游戏|游戏UI|实机截图|Boss|活动海报|二维码|旅游攻略|攻略图|长图|图鉴|百科|生平图|时间线长图|文创|物料|套装|主图套图|电商主图|教学图|知识图|知识点|教程图|六宫格|科学示意图|论文图形摘要|说明书|产品说明|爆炸图|分解图|结构拆解|工业结构|移动端UI|App界面|Logo|标志设计|品牌设计|品牌视觉|直播间|写真|电影感写真|户外写真|表情包|贴纸|手帐|PPT配图|留白优化|横图扩图|扩图|虚焦|背景虚焦|抠图|扣图|去背景|主体抠图|动态模糊|拖尾|运镜|调色|打光|加元素|增加元素|风格统一)/i.test(text);
}

function buildPromptTemplateGuide(template, input) {
  const selectedTemplate = template && template !== "custom";
  if (!selectedTemplate) return "";
  const common = selectedTemplate ? [
    "Hidden structured prompt rules:",
    "Start from the user's exact intention. Do not replace the user's subject with a default woman, default neon city, or default fantasy scene.",
    "Template priority rule: the selected template is a helper only. User's explicit prompt outranks protected reference content, and protected reference content outranks template style.",
    "Make the image feel finished. Do not leave empty cards, blank placeholders, empty QR boxes, wireframe panels, or unfinished layout blocks. Use short headings, labels, icons, decorative text blocks, photos, and visual dividers to complete the design. Avoid inventing fake official contact details, prices, legal, medical, or product claims unless provided by the user."
  ] : [
    "Hidden custom-mode prompt rules:",
    "No workflow template is selected. Follow the user's exact prompt and reference-image intent literally.",
    "Do not convert a custom request into a poster, advertisement, corporate promotion, PPT, ecommerce main-image layout, book-cover kit, infographic, or other hidden workflow unless the user explicitly asks for that exact asset type.",
    "When reference images are provided, preserve the user-named subject, product, person, scene, pose, color, size, logo, and protected details. Templates and generic design habits are lower priority than the user's prompt."
  ];

  const map = {
    custom: [
      "Template: custom.",
      "Use only the user's prompt and reference images to infer purpose, subject, scene, composition, visual style, camera, lighting, material, and negative constraints. Do not add an unrequested template category."
    ],
    "dream-portrait": [
      "Template: dream portrait.",
      "Prioritize a clear human subject, emotional expression, natural facial structure, refined hair detail, soft rim light, shallow depth of field, and a dreamy but believable environment.",
      "Use 45-degree or frontal eye-level portrait composition unless the user requests another angle.",
      "Avoid plastic skin, distorted hands, extra people, changed identity, and random decorations."
    ],
    "hairstyle-change": [
      "Template: hairstyle change.",
      "Preserve the reference person's identity, face shape, facial features, expression, age impression, and body pose.",
      "Change only the requested hairstyle or hair color. Hairline, strand direction, scalp volume, occlusion around ears/neck, and lighting must look natural.",
      "Avoid changing the face, making wig-like edges, or leaving the original hairstyle unchanged when the user requested a change."
    ],
    "makeup-change": [
      "Template: makeup change.",
      "Preserve the person's identity, face proportions, expression, and age impression while changing makeup style, skin finish, brows, eyeshadow, eyeliner, lip color, and overall temperament.",
      "Make the makeup professionally applied and coherent with the lighting and clothing.",
      "Avoid identity drift, over-beautification, plastic skin, and random face reshaping."
    ],
    "background-change": [
      "Template: background replacement.",
      "Preserve the protected subject identity, pose, product, or foreground object unless the user says otherwise.",
      "Rebuild the background or scene according to the user's prompt or relevant scene reference. The background must visibly change and naturally match perspective, edges, depth of field, shadows, and color temperature.",
      "Avoid returning the reference image unchanged, cutout edges, mismatched lighting, and pasted-background feeling."
    ],
    "sky-change": [
      "Template: sky replacement.",
      "Preserve the ground, buildings, landscape, foreground subjects, and camera perspective.",
      "Replace the sky with the requested weather, sunset, clouds, birds, stars, or atmosphere. Let the new sky affect ambient light and color on the scene.",
      "Avoid changing architecture, horizon lines, or producing a fake pasted sky."
    ],
    "clean-background": [
      "Template: background cleanup / object removal.",
      "Remove clutter, irrelevant objects, passersby, messy background details, or visual distractions named by the user.",
      "Reconstruct the removed area with matching texture, perspective, lighting, shadows, and depth of field while preserving the main subject.",
      "Avoid blurry smears, visible eraser marks, repeated patterns, and changing the protected subject."
    ],
    "high-tension-poster": [
      "Template: high tension poster.",
      "Formula: clear theme, strong subject, visible visual conflict, controlled color palette, readable short title area, and no clutter.",
      "Make the main subject and visual conflict readable in thumbnail size. Use dramatic light direction and strong foreground/background hierarchy.",
      "If title text is requested, keep it short and readable; otherwise reserve a clean title area for post-production."
    ],
    "magazine-cover": [
      "Template: magazine cover with subject/title layering.",
      "Use three layers: background layer, large title/text layer behind the subject, and subject layer in the foreground.",
      "The subject should naturally occlude part of the title or graphic shapes, forming a clear magazine-cover depth relationship.",
      "Do not place text over the face, do not make the title float in the front, and do not fill the image with small text."
    ],
    "product-visual": [
      "Template: premium product visual.",
      "Preserve product shape, packaging, color, logo position, material edges, reflections, contact shadow, and scale relationship from references.",
      "Use commercial lighting, clean composition, clear selling-point visual space, realistic material texture, and minimal clutter.",
      "Do not alter product structure, invent false certifications, generate unreliable prices, or deform packaging."
    ],
    "product-scene-blend": [
      "Template: product scene blending.",
      "Preserve the product's shape, logo placement, packaging, color, material, edges, and scale cues from reference images.",
      "Place the product into the target background or user-described scene with coherent perspective, contact shadows, reflections, depth of field, and light direction.",
      "Avoid floating products, wrong scale, changed branding, or copied background clutter."
    ],
    "product-detail-page": [
      "Template: ecommerce product detail page visual.",
      "Create a finished commercial detail-page style image with hero product, detail closeups, usage scene, material/feature blocks, and clean visual hierarchy.",
      "Use short readable labels and decorative modules, but do not invent legal claims, prices, certifications, or exact parameters unless provided.",
      "Keep product identity and packaging faithful to references."
    ],
    "product-white-background": [
      "Template: ecommerce white-background product retouch.",
      "Preserve the real product shape, color, structure, logo placement, packaging text position, material edges, and key details from references.",
      "Remove messy backgrounds, keep clean white or very light neutral background, crisp edges, natural contact shadow, and publishable ecommerce main-image quality.",
      "Do not change model, packaging structure, logo, product count, or important visible claims."
    ],
    "clothing-try-on": [
      "Template: clothing try-on / outfit transfer.",
      "Use the person reference for identity, face, body type, pose, skin tone, and proportions. Use clothing references for garment design, color, texture, silhouette, accessories, and visible details.",
      "Dress the person naturally with correct fabric drape, folds, occlusion, body contact, scale, and lighting.",
      "Avoid changing the person's identity, copying the clothes as a flat sticker, wrong sleeve/hem alignment, and impossible anatomy."
    ],
    "ootd-flatlay": [
      "Template: OOTD flat lay.",
      "Extract or infer all visible garments, shoes, bags, and accessories from references, then present them as a clean flat-lay outfit display.",
      "Use tidy spacing, top-down or slight angled product photography, neutral background, and clear separation of items.",
      "Avoid wearing-on-body composition unless requested."
    ],
    "group-photo": [
      "Template: consistent group photo.",
      "Each referenced person must keep identity, age impression, face structure, hairstyle, body type, and clothing cues distinct. Do not merge identities.",
      "Place people in one natural scene with consistent perspective, scale, lighting, eye lines, and plausible interaction.",
      "Avoid collage, cutout edges, missing people, duplicate faces, and pasted-background feeling."
    ],
    "wedding-photo": [
      "Template: wedding / couple photo.",
      "Preserve each referenced person's identity, facial structure, age impression, body type, and relationship scale.",
      "Create a romantic but natural wedding or couple portrait with coherent clothing, environment, pose interaction, lighting, and skin tones.",
      "Avoid merging faces, replacing one person, artificial cutout feeling, and overly fake studio backdrops unless requested."
    ],
    "id-photo": [
      "Template: ID photo / professional headshot.",
      "Preserve the reference person's facial identity, face proportions, hairline, age impression, and overall temperament.",
      "Use clean background, upright shoulder-neck posture, even professional light, tidy hair and clothing, and natural skin texture.",
      "Avoid heavy beautification, face swap feeling, artistic scenery, exaggerated makeup, and identity drift."
    ],
    "era-portrait": [
      "Template: era transformation portrait.",
      "Preserve the person's identity and face while transforming clothing, hairstyle, makeup, color grading, background, props, and photographic process to the requested decade or historical style.",
      "Use era-appropriate details and film texture without changing who the person is.",
      "Avoid generic cosplay, wrong decade mixing, and identity drift."
    ],
    turnaround: [
      "Template: character turnaround / model sheet.",
      "Create a clean character-design sheet with front, side, and back views of the same character, plus optional expression or detail callouts.",
      "Keep face, hairstyle, outfit, silhouette, colors, props, and style consistent across all views.",
      "Avoid making unrelated characters, changing costumes between views, or turning it into a single illustration."
    ],
    "pose-control": [
      "Template: pose and composition control.",
      "Prioritize the pose, body direction, gesture, camera angle, and composition from pose/doodle/mannequin references while preserving identity/style from subject references.",
      "Naturally integrate the pose into a complete scene with correct anatomy, hands, feet, weight distribution, and contact points.",
      "Do not copy rough doodle lines as final art unless the user explicitly asks for a sketch style."
    ],
    "style-poster-remix": [
      "Template: poster style remix.",
      "Analyze the reference poster's composition, visual hierarchy, color palette, typography mood, spacing, and decorative element logic, then create a new poster for the user's theme.",
      "Borrow style principles, not exact text, copyrighted elements, logos, or layout pixels.",
      "Make the output a finished poster with complete modules and no blank placeholders."
    ],
    "xiaohongshu-card": [
      "Template: social media card / infographic.",
      "Build a clean visual hierarchy with hero visual, short title area, small modules or labels, and good mobile readability.",
      "Keep dense Chinese text for later layout. The image model may only attempt short headings, numbers, icons, and labels.",
      "Avoid full-screen tiny text, fake data, cluttered stickers, and unrelated decorative elements."
    ],
    "video-cover": [
      "Template: video thumbnail / cover.",
      "Create a high-click cover with one strong focal subject, large readable title area, expressive emotion or product impact, and clear contrast at mobile size.",
      "Use short headline text only if the user provides or requests it; otherwise reserve a clean title zone.",
      "Avoid tiny dense text, clutter, fake platform UI, and covering important faces."
    ],
    "ppt-cover": [
      "Template: presentation cover slide.",
      "Create a finished 16:9 PPT cover with a strong main title area, subtitle/info zone, one clear hero visual, balanced negative space, and polished business presentation hierarchy.",
      "Use short readable text only. If details are not provided, use decorative text blocks or safe generic labels instead of empty placeholders.",
      "Avoid tiny dense paragraphs, blank boxes, unfinished wireframes, fake QR codes, and poster clutter."
    ],
    "business-launch-slide": [
      "Template: business / technology launch slide.",
      "Make a 16:9 keynote-style product launch slide with the product or core subject as hero, clean dark or minimal background, and 2-3 concise selling-point modules.",
      "Emphasize premium lighting, product material, rim light, elegant typography zones, and less-is-more composition.",
      "Avoid changing the referenced product, inventing certifications/prices, or filling the page with tiny text."
    ],
    "tourism-ppt": [
      "Template: tourism / city promotion PPT slide.",
      "Create a 16:9 high-end tourism slide with scenic hero image, one side reserved as title/info panel, refined line ornaments, small icon information, and cinematic color grading.",
      "Preserve landmark or scenery identity from references and make the layout suitable for travel, culture, school, or city promotion.",
      "Avoid overloading text, random unrelated landmarks, and unfinished blank title areas."
    ],
    "product-landing-slide": [
      "Template: product website hero / landing slide.",
      "Create a 16:9 product landing-page hero with clear product render/photo, concise headline area, parameter cards, icon selling points, and premium ecommerce or SaaS layout.",
      "Keep product identity, shape, material, logo, and color stable when references are provided.",
      "Avoid fake platform UI clutter, changed product structure, and unreadable small copy."
    ],
    "tech-ppt": [
      "Template: dark technology presentation slide.",
      "Create a 16:9 dark tech PPT slide with glassmorphism cards, blue/cyan/purple light accents, clear title, module hierarchy, and futuristic but clean background.",
      "Use data cards, icons, grids, light frames, or scene elements only when they support the user's subject.",
      "Avoid excessive neon clutter, empty panels, and meaningless fake dashboard text."
    ],
    "guochao-guide": [
      "Template: guochao / cultural guide slide.",
      "Create a 16:9 Chinese cultural or city guide slide with multiple scenic or content blocks, bold readable title, restrained traditional colors, texture, and bottom info/icon bar.",
      "Organize landmarks, food, history, or route information into clear visual sections.",
      "Avoid messy collage, unrelated symbols, and tiny unreadable labels."
    ],
    "ppt-whitespace-cleanup": [
      "Template: PPT image whitespace cleanup.",
      "Use the uploaded reference image as the source material. Preserve the main subject, identity, product, landmark, or key action while cleaning clutter and simplifying the background.",
      "Create clear negative space on the left or right for PPT title/body text. Background may become solid color, gradient, darkened, or softly blurred, but the subject must remain sharp.",
      "The result must visibly improve PPT usability. Do not return the original image unchanged or remove the protected subject."
    ],
    "ppt-wide-outpaint": [
      "Template: PPT 16:9 wide outpainting.",
      "Extend the reference image into a natural 16:9 landscape composition while preserving subject scale, camera perspective, lighting direction, horizon, and scene logic.",
      "Add plausible side environment and clean layout space for text. The expansion should feel photographed or designed as one coherent image.",
      "Avoid stretched subjects, repeated patterns, mismatched perspective, and random new focal subjects."
    ],
    "ppt-cutout-layout": [
      "Template: subject cutout for PPT layout.",
      "Extract or visually isolate the protected person/product/object from the reference. Preserve edge detail, hair, hands, product contours, logo, color, and identity.",
      "Place the subject on a clean transparent-feeling, solid, gradient, or subtle stage background with realistic shadow and PPT-friendly spacing.",
      "Avoid jagged cutout edges, changed subject identity, floating subject, and busy new backgrounds."
    ],
    "ppt-background-defocus": [
      "Template: PPT background defocus / subject emphasis.",
      "Keep the subject crisp and readable. Darken, blur, desaturate, or simplify irrelevant background elements to reduce visual noise.",
      "Create a stronger subject-to-background hierarchy and leave clean space for future PPT text or overlays.",
      "Avoid blurring the subject, destroying context, or making the image identical to the reference."
    ],
    "ppt-motion-image": [
      "Template: dynamic PPT hero image.",
      "Add controlled motion energy such as motion blur, trailing light, dust, sand, speed lines, moving crowd/vehicle/animal rhythm, or diagonal camera tension according to the user's subject.",
      "Motion effects must follow a clear direction and preserve the original subject and scene coherence.",
      "Avoid chaotic blur, unreadable subject, impossible movement, and excessive effects that make the slide unusable."
    ],
    "ppt-style-unify": [
      "Template: PPT style unification.",
      "Transform one or more references into a consistent PPT visual style while preserving each subject's recognizable identity and key details.",
      "Unify palette, contrast, lighting, grain, background treatment, and composition language. Suitable styles include black-and-white studio, blue tech, warm business, impressionist, low-saturation premium, or brand-color treatment.",
      "Avoid mixing incompatible styles, over-filtering faces/products, and losing the information purpose of the images."
    ],
    "ppt-add-elements": [
      "Template: add PPT-supporting elements.",
      "Add user-requested foreground, background, prop, architecture, sky, people, animals, flowers, light, or atmospheric elements into the reference image.",
      "New elements must match camera perspective, depth of field, shadows, scale, color temperature, and story logic. They should improve composition or PPT storytelling.",
      "Avoid pasted-on objects, blocked faces/products, random decorations, and changing the protected subject."
    ],
    "ppt-light-color": [
      "Template: PPT lighting and color grading.",
      "Preserve the reference subject and composition while changing lighting or color mood, such as sunset light, backlight, blue hour, warm humanistic tone, cool business tone, cinematic contrast, or premium monochrome.",
      "Make the grade coherent across subject and background, improving presentation quality and text readability.",
      "Avoid overexposure, crushed shadows, unnatural skin/product color, and changing identity."
    ],
    "photo-deblur-upscale": [
      "Template: photo deblur and upscale.",
      "Preserve the original subject identity, composition, lighting mood, product shape, and scene content while improving sharpness, focus, edge clarity, texture detail, and overall resolution.",
      "Make the repair look photographic and natural, not AI-redrawn. Keep faces, logos, packaging, and important text positions stable.",
      "Avoid changing identity, replacing the scene, plastic skin, hallucinated details, and over-sharpened artifacts."
    ],
    "focus-control": [
      "Template: focus control / depth of field edit.",
      "Keep the reference subject and scene, but move visual emphasis to the user-specified focus target. Make the focus target crisp and detailed, especially eyes for portraits or logo/product for products.",
      "Create natural foreground/background bokeh, lens depth, and subject separation consistent with camera optics.",
      "Avoid blurring the protected subject, changing identity, or creating fake cutout edges."
    ],
    "age-transform": [
      "Template: age transformation.",
      "Preserve the person's identity, face proportions, bone structure, hairstyle cues, temperament, and pose while changing only age-related features.",
      "Adapt skin texture, facial fullness, wrinkles, hair density/color, clothing, and atmosphere to the requested age stage.",
      "Avoid making a different person, caricature aging, identity drift, or beauty-filter smoothing."
    ],
    "skin-texture-edit": [
      "Template: skin texture edit.",
      "Preserve identity, facial structure, expression, and natural skin anatomy while changing skin finish according to the user's request.",
      "Keep pores, subtle color variation, highlights, and facial volume believable. Adjust gloss, translucency, grain, or retouch level without changing facial features.",
      "Avoid plastic skin, waxy surface, over-retouching, and face reshaping."
    ],
    "secondary-lighting": [
      "Template: secondary lighting / relighting.",
      "Preserve subject, composition, and important scene content while redesigning light direction, key light, fill light, rim light, backlight, ambient color, and shadow depth.",
      "Lighting must affect both subject and environment coherently, with believable highlights, contact shadows, and color temperature.",
      "Avoid pasted light effects, blown highlights, crushed shadows, and changing the protected subject."
    ],
    "consistent-outfit-change": [
      "Template: consistent outfit change.",
      "Use the person reference for identity, face, hair, body type, pose, and proportions. Change clothing/accessories according to the user prompt or clothing references.",
      "Make fabric drape, folds, seams, occlusion, sleeve/hem alignment, body contact, material texture, and lighting physically believable.",
      "Avoid face drift, body-shape drift, flat sticker clothing, wrong scale, or changing unrequested elements."
    ],
    "multi-subject-consistency": [
      "Template: multi-subject consistency.",
      "Combine multiple referenced people, products, props, or scenes into one coherent new image. Each subject must keep its own identity, scale, color, material, and key details.",
      "Unify camera perspective, light direction, shadows, depth of field, color grading, and scene logic so the result is not a collage.",
      "Avoid merging identities, duplicate faces, missing subjects, pasted edges, and forced use of irrelevant references."
    ],
    "roadmap-flow": [
      "Template: roadmap / process flow infographic.",
      "Turn process content into a 3-5 stage path with cards, nodes, arrows, icons, and concise stage goals.",
      "Keep visual hierarchy clear: title, stage names, short supporting labels, and final direction of flow.",
      "Avoid long paragraph text, disconnected boxes, and fake details not implied by the user."
    ],
    "business-architecture": [
      "Template: business architecture infographic.",
      "Turn abstract structure into modules such as layers, pillars, platforms, matrices, or stacked cards. Show relationships clearly with labels, icons, and grouping.",
      "Use restrained business colors, soft shadows, and balanced spacing so the logic is readable at slide size.",
      "Avoid random 3D objects, unclear relationships, and too many tiny labels."
    ],
    "data-dashboard": [
      "Template: data dashboard slide.",
      "Create a 16:9 dashboard with KPI cards, trend chart, proportion/ranking chart, and conclusion module. Use only user-provided data when exact numbers matter.",
      "If the user provides no data, design placeholders as visual examples with short safe labels, not fake authoritative figures.",
      "Avoid hallucinated claims, over-dense text, broken charts, and empty card blocks."
    ],
    "comparison-slide": [
      "Template: comparison analysis slide.",
      "Organize content into left/right or multi-column comparison cards with key differences, benefits, tradeoffs, and a concise conclusion.",
      "Use consistent card sizes, icons, colored tags, and clear headings.",
      "Avoid mixing unrelated categories, long tiny text, and visual imbalance."
    ],
    "timeline-slide": [
      "Template: timeline slide.",
      "Turn events, plans, or development history into a clean horizontal or vertical timeline with date nodes, short labels, icons, and connectors.",
      "Keep the timeline direction and stage hierarchy easy to understand in 16:9.",
      "Avoid overcrowded nodes, unreadable annotations, and meaningless decorative lines."
    ],
    "icon-set": [
      "Template: unified icon set.",
      "Generate multiple icons with the same visual language: stroke weight, corner radius, perspective, palette, shadow, and texture must be consistent.",
      "Use a clean grid layout and keep each icon distinct, simple, and usable for PPT, posters, or web UI.",
      "Avoid mixed styles, excessive detail, tiny labels, and inconsistent colors."
    ],
    "illustration-kit": [
      "Template: illustration asset kit.",
      "Generate a coordinated set of illustration elements, characters, scenes, or props with consistent style, color palette, line quality, and lighting.",
      "Arrange assets cleanly so they can be reused in PPT, posters, cards, or long images.",
      "Avoid unrelated elements, inconsistent character identity, and cluttered backgrounds."
    ],
    "ppt-background": [
      "Template: PPT background image.",
      "Create a clean 16:9 background with clear atmosphere, subtle depth, and large readable negative space for later text, charts, or titles.",
      "The image should support the theme without stealing attention from future slide content.",
      "Avoid central clutter, high-contrast text-like marks, empty placeholder boxes, and overly busy decorations."
    ],
    "title-lettering": [
      "Template: title lettering / art typography.",
      "Design short readable title lettering with theme-matched material, brush, glow, dimensionality, or cultural style. Keep letters clear enough for a cover or poster.",
      "Use minimal background and leave the title usable as a visual asset.",
      "Avoid long sentences, misspelled text, unreadable glyphs, and extra unrelated words."
    ],
    "teaching-knowledge-card": [
      "Template: teaching knowledge card.",
      "Create a clean educational visual with one clear concept, explanatory diagram, key formula or principle, short labels, example area, and summary note.",
      "Use textbook-like clarity, modern teaching-video aesthetics, readable Chinese text, and uncluttered background.",
      "Avoid excessive decoration, unsupported facts, fake school/exam authority, and tiny dense paragraphs."
    ],
    "six-grid-tutorial": [
      "Template: six-panel tutorial infographic.",
      "Turn the topic into six ordered steps arranged in a 2x3 grid. Each panel should include step number, short heading, one-line explanation, and matching illustration.",
      "Keep all panels consistent in style, spacing, color, border radius, icon language, and lighting.",
      "Avoid uneven panel sizes, long microtext, unrelated steps, and generic collage."
    ],
    "scientific-diagram": [
      "Template: scientific explanatory diagram.",
      "Explain the user's mechanism or structure with arrows, cutaways, labels, layers, magnified details, and cause-effect flow where useful.",
      "Prioritize accuracy, hierarchy, and readability. Use concise labels and do not invent precise scientific values unless provided.",
      "Avoid fantasy embellishment, misleading claims, and overly decorative poster styling."
    ],
    "paper-graphical-abstract": [
      "Template: paper / technical graphical abstract.",
      "Summarize a paper, model, technology, or blog topic as a high-end visual abstract: one strong central mechanism visual plus concise innovation, impact, and flow modules.",
      "Make it feel like a premium technology cover or conference keynote slide, not a dense academic poster.",
      "Avoid hallucinated paper details, too many cards, unreadable microtext, and generic AI circuits unrelated to the topic."
    ],
    "product-exploded-view": [
      "Template: product exploded view.",
      "Create a precise exploded product structure with aligned components, material detail, assembly order, guide lines, short labels, and optional macro detail window.",
      "When references are provided, preserve the product's outer design, logo, color, proportions, and recognizable parts.",
      "Avoid toy-like parts, impossible structure, changed product identity, and unsupported technical claims."
    ],
    "product-manual-page": [
      "Template: product manual page.",
      "Create a clear official-style instruction page with setup steps, feature callouts, usage diagram, caution area, parameter zone, and short clean labels.",
      "Use white or light gray background, crisp line icons, realistic product render, and readable hierarchy.",
      "Avoid advertisement tone, fake certification marks, legal/medical claims, and overly dense tiny text."
    ],
    "industrial-structure-sheet": [
      "Template: industrial structure sheet.",
      "Show engineering structure through cross-section, layered materials, component labels, assembly logic, technical highlights, and precise visual order.",
      "Emphasize restraint, material realism, spacing, alignment, and professional credibility.",
      "Avoid chaotic parts, decorative sci-fi clutter, impossible mechanics, and invented specifications."
    ],
    "mobile-ui-showcase": [
      "Template: mobile UI showcase board.",
      "Design multiple phone UI mockups with consistent tall phone ratio, unified product design language, real app hierarchy, status bars, navigation, and component rhythm.",
      "Make the board look like a polished portfolio or social media UI case study, with consistent spacing and clear Chinese labels.",
      "Avoid distorted phone proportions, copied real app/platform brands, backend dashboard feel, and repeated identical screens."
    ],
    "logo-identity-board": [
      "Template: logo identity presentation board.",
      "Create a professional logo proposal board with main mark, construction grid, variants, reverse color versions, typography, palette, and small application mockups.",
      "Use generous whitespace, geometric precision, restrained palette, and brand-system logic.",
      "Avoid complex clipart, trademark imitation, random gradients, and illegible logo text."
    ],
    "brand-system-board": [
      "Template: complete brand visual system board.",
      "Create a coherent brand identity presentation with logo, typography, color system, packaging, poster, social media, website/mobile UI, product mockups, and scene photography.",
      "All applications must share one visual language and feel like one mature brand proposal.",
      "Avoid unrelated mockups, copied famous brand assets, inconsistent logo marks, and cluttered student-project layout."
    ],
    "livestream-scene": [
      "Template: livestream ecommerce scene.",
      "Create a livestream selling scene with presenter, product display, background campaign board, lighting, comments, product card, and shopping atmosphere.",
      "Keep UI generic and original. Do not copy real platform logos, exact platform chrome, or misleading official interface details.",
      "Avoid clutter, fake medical/financial claims, unreadable comments, and product identity drift."
    ],
    "cinematic-portrait": [
      "Template: cinematic portrait photo.",
      "Preserve the referenced person's identity, face proportions, hairstyle, and temperament while improving expression, pose, lens, lighting, and atmosphere.",
      "Use film still composition, natural skin texture, restrained color grading, and story-like emotion.",
      "Avoid studio glamour cliches, over-retouching, plastic skin, identity drift, and stiff ID-photo poses."
    ],
    "outdoor-photoshoot": [
      "Template: outdoor lifestyle photoshoot.",
      "Create a natural outdoor portrait set or hero shot with relaxed pose, shallow depth of field, soft sunlight, believable environment, and candid emotion.",
      "Preserve the person's identity and avoid copying clothing or face from non-subject references.",
      "Avoid tourist snapshot feeling, harsh influencer filters, overposed expression, and identity changes."
    ],
    "sticker-pack": [
      "Template: expression sticker pack.",
      "Create a consistent sticker pack with multiple emotions or gestures while preserving the same character identity, hairstyle, outfit, palette, and drawing style.",
      "Arrange stickers in a clean grid and make each emotion instantly recognizable.",
      "Avoid changing the character between stickers, mixing styles, cluttered backgrounds, and unreadable text."
    ],
    "journal-sticker-page": [
      "Template: journal sticker page.",
      "Create a coordinated planner/journal sticker sheet with character stickers, tapes, labels, dates, memo areas, icons, and decorative pieces.",
      "Keep printable spacing, consistent palette, paper texture, and clear hierarchy.",
      "Avoid random unrelated stickers, too many tiny words, inconsistent line styles, and muddy backgrounds."
    ],
    "character-bible": [
      "Template: character bible / setting collection.",
      "Create a coherent visual bible with main characters, supporting roles, antagonist, key locations, props, world rules, costume anchors, color anchors, and mood references.",
      "Keep identity, silhouette, wardrobe, palette, props, and visual style consistent across all panels so the assets can be reused for storyboards or video generation.",
      "Avoid unrelated characters, random costume drift, inconsistent era/style, and crowded unreadable descriptions."
    ],
    "storyboard-sheet": [
      "Template: cinematic storyboard sheet.",
      "Turn the user's plot into a multi-panel storyboard with shot number, shot size, camera movement, dialogue/voiceover, duration hint, and visual effect notes.",
      "Keep recurring characters, clothing, locations, lighting, and emotional arc consistent from panel to panel.",
      "Avoid one-off unrelated illustrations, tiny dense text, missing shot logic, and blank storyboard cells."
    ],
    "ad-storyboard": [
      "Template: brand advertising storyboard.",
      "Build a commercial storyboard with hook, product reveal, core selling point, usage scenario, emotional payoff, and closing memory point.",
      "Preserve referenced product identity, packaging, logo position, and brand color cues. Make every frame feel like part of the same campaign.",
      "Avoid changing the product, inventing legal/medical claims, excessive tiny copy, and disconnected shots."
    ],
    "cinematic-keyframes": [
      "Template: continuous cinematic keyframes.",
      "Generate a sequence of coherent keyframes showing beginning, conflict, turn, climax, and ending. Keep characters, costumes, props, world, lighting, and color grading stable.",
      "Each frame should look like a video-ready shot with clear camera angle, subject action, and narrative purpose.",
      "Avoid random style changes, duplicated identities, unclear action, and unrelated scenes."
    ],
    "game-ui-concept": [
      "Template: game UI concept sheet.",
      "Design multiple UI modules for a game concept, such as main menu, inventory, skill tree, HUD, quest log, map, pause menu, and settings.",
      "Keep art direction, materials, icon language, borders, panels, buttons, typography mood, and color palette consistent across the UI.",
      "Avoid real copyrighted game UI copying, unreadable tiny labels, mismatched UI styles, and cluttered decorative frames."
    ],
    "gameplay-screenshot": [
      "Template: gameplay screenshot concept.",
      "Create a believable in-game screenshot with scene, perspective, HUD, dialogue box or interaction choices when requested, and a clear narrative moment.",
      "UI should support immersion without covering the main subject. Use concise readable labels and coherent game art direction.",
      "Avoid fake platform logos, excessive UI clutter, unreadable microtext, and inconsistent perspective."
    ],
    "game-boss-scene": [
      "Template: boss battle / game encounter scene.",
      "Create a dynamic combat or boss encounter with clear enemy/player relationship, arena environment, skill effects, health/status UI, and dramatic composition.",
      "Keep action readable: silhouettes, attack direction, distance, impact, and UI hierarchy should be clear.",
      "Avoid overfilled effects, unclear subject, floating UI, and unrelated characters."
    ],
    "narrative-silhouette-poster": [
      "Template: narrative silhouette poster.",
      "Use a strong outer silhouette of a person, object, creature, or symbol, then fill the silhouette with theme-bound worldbuilding scenes, symbols, architecture, characters, props, and atmosphere.",
      "Make it feel like a premium collectible movie/book poster with double-exposure storytelling, soft transitions, meaningful negative space, and coherent palette.",
      "Avoid cheap collage, random fantasy elements, off-theme symbols, and clutter that breaks the silhouette."
    ],
    "event-poster": [
      "Template: event poster with portrait and QR code.",
      "Create a finished event poster with theme, date, location, organizer, speaker/portrait zone, QR code zone, and call-to-action hierarchy.",
      "If the user uploads a face/photo/QR code/logo, preserve recognizability and place it naturally in the layout. Do not invent official contact details unless provided.",
      "Avoid unreadable QR codes, fake official details, covering faces, and blank placeholder boxes."
    ],
    "travel-guide-poster": [
      "Template: travel guide poster.",
      "Create a vertical travel guide with route logic, landmarks, food, itinerary, small map/route diagram, and practical sections. Keep information concise and visually scannable.",
      "Use city-specific visual cues and organize by day, area, or route when the prompt implies an itinerary.",
      "Avoid hallucinating precise addresses/prices/opening hours unless provided, and avoid over-dense microtext."
    ],
    "cultural-product-kit": [
      "Template: cultural merchandise kit.",
      "Design a coordinated merchandise board with stickers, postcards, packaging, badges, tote bag, cup, fridge magnet, or other requested items.",
      "Keep visual identity, palette, motif, typography mood, and illustration language consistent across all items.",
      "Avoid unrelated products, inconsistent styles, copyrighted logos, and changing uploaded brand marks."
    ],
    "ecommerce-main-set": [
      "Template: ecommerce main image set.",
      "Create a multi-panel ecommerce visual set: white-background main image, scene image, feature image, material/detail image, and before/after or usage image when suitable.",
      "Preserve product shape, packaging, logo, color, material, and key features from references. Use clean commercial lighting and platform-friendly composition.",
      "Avoid changing product identity, inventing unsupported claims, unreadable tiny selling points, and mixing unrelated products."
    ],
    "ecommerce-long-detail": [
      "Template: ecommerce long detail image.",
      "Create a 1:3 or vertical detail-page image with product hero, benefits, feature modules, material closeups, usage scene, parameter area, and buying confidence sections.",
      "Use clear hierarchy and realistic product render. Keep text short and design complete; no empty placeholder blocks.",
      "Avoid fake certifications, medical/legal claims, excessive microtext, and product deformation."
    ],
    "ecom-studio-main": [
      "Template: standard ecommerce studio main image.",
      "Create a clean platform-ready main product image with centered product, white/light gray background, soft studio light, crisp edges, realistic contact shadow, and accurate scale.",
      "Preserve product shape, packaging, logo placement, material, color, label structure, and visible selling features from references.",
      "Avoid changing packaging, inventing badges, cluttered props, fake platform UI, or unreadable text."
    ],
    "ecom-lifestyle-ad": [
      "Template: lifestyle seeding advertisement.",
      "Place the referenced product naturally in a real lifestyle scene with emotional atmosphere, natural light, believable props, and brand-consistent color grading.",
      "The product remains clear and recognizable while the scene supports the usage story and social-media appeal.",
      "Avoid letting the model/person/background steal attention, changing product identity, or making a generic stock image."
    ],
    "ecom-macro-detail": [
      "Template: product macro detail.",
      "Create close-up or macro product detail photography that highlights material texture, opening, label edge, bottle mouth, liquid, powder, fibers, metal, paper, seams, or structural details.",
      "Keep the product identity and material physics consistent with references. Use shallow depth of field and crisp local detail.",
      "Avoid hallucinated mechanisms, changed labels, muddy texture, and unusable crop."
    ],
    "ecom-craft-process": [
      "Template: craft/process advertising image.",
      "Show the product being made, used, poured, assembled, brewed, applied, or experienced at a key cinematic moment.",
      "Use hands, tools, steam, material particles, workshop/cafe/studio context, and dramatic but believable light. Keep the product or packaging as a clear visual anchor.",
      "Avoid unsafe process claims, unrealistic hands, hidden product, and random unrelated props."
    ],
    "ecom-derived-products": [
      "Template: branded derivative products.",
      "Extend the referenced product or brand language onto derivative items such as cups, tote bags, candles, boxes, menus, stickers, gift sets, or packaging.",
      "Keep logo style, palette, typography mood, material language, and brand tone consistent across all derivatives.",
      "Avoid copying famous brands, changing the original brand identity, and mixing unrelated merchandise styles."
    ],
    "ecom-product-combo": [
      "Template: product combination photography.",
      "Arrange multiple products or one brand series into a premium commercial scene using podiums, steps, flat lay, knolling grid, or staged composition.",
      "Hierarchy must be clear: one hero product, supporting products, restrained props, correct scale, contact shadows, and unified lighting.",
      "Avoid clutter, floating products, wrong scale, inconsistent product identity, and props that dominate the hero."
    ],
    "ecom-marketing-pack": [
      "Template: complete ecommerce marketing material board.",
      "Create one presentation board containing a coherent set of marketing visuals: studio main image, lifestyle scene, macro detail, brand poster, social ad, derivative product, or application mockup.",
      "All panels must share one brand system, product identity, color palette, typography mood, and commercial photography direction.",
      "Avoid unrelated panels, repeated identical images, fake platform screenshots, unsupported claims, and empty placeholder modules."
    ],
    "ecom-bg-replace-workflow": [
      "Template: ecommerce product background replacement.",
      "Use the product reference as a protected subject: keep shape, packaging, logo placement, color, material, label structure, edge details, and scale cues stable.",
      "Rebuild only the background or surrounding commercial scene according to the user prompt or the most relevant scene reference. Match perspective, contact shadow, reflection, depth of field, and light direction.",
      "Avoid returning the original background unchanged, floating products, cutout edges, warped packaging, changed branding, and pasted-scene feeling."
    ],
    "ecom-white-to-scene-workflow": [
      "Template: white-background product to lifestyle scene.",
      "Treat a white-background product image as the product source, not as the final composition. Preserve product identity while generating a finished lifestyle, advertising, or ecommerce scene around it.",
      "Add believable props, surface, environment, light, contact shadow, and commercial composition that support the product and user prompt.",
      "Avoid leaving a plain white catalog image unchanged unless the user explicitly asks for white background."
    ],
    "ecom-jewelry-tryon-workflow": [
      "Template: jewelry/accessory try-on.",
      "Use accessory references for design, gemstone/metal material, color, setting, silhouette, and brand details. Use person references for identity, skin tone, pose, facial structure, and body scale.",
      "Place the accessory naturally on the correct body area such as ear, neck, wrist, finger, hair, clothing, or bag, with realistic scale, occlusion, reflection, skin contact, and shadow.",
      "Avoid flat sticker placement, wrong size, changed jewelry design, identity drift, and impossible attachment."
    ],
    "ecom-model-tryon-workflow": [
      "Template: model clothing try-on.",
      "Use clothing references for garment silhouette, color, pattern, fabric, seams, collar, sleeves, hem, texture, and accessories. Use model references for identity, body type, pose, skin tone, and camera view.",
      "Dress the model naturally with correct fabric drape, folds, tension, occlusion, body contact, and consistent lighting.",
      "Avoid changing the model's face/body identity, flattening clothing as a sticker, wrong sleeve/neckline alignment, and impossible anatomy."
    ],
    "ecom-object-transfer-workflow": [
      "Template: object/product transfer into target image.",
      "Dynamically infer which reference contains the source object and which reference contains the target scene. Do not rely on upload order unless the user names image numbers.",
      "Preserve the transferred object's identity, material, color, logo, shape, and key details while adapting its angle, scale, contact shadow, occlusion, and lighting to the target scene.",
      "Avoid copying the whole source image, ignoring the target scene, floating objects, wrong scale, and unchanged target image."
    ],
    "ecom-material-replace-workflow": [
      "Template: material replacement.",
      "Use the base image for object shape, structure, perspective, and lighting. Use the material reference for texture, grain, reflectivity, roughness, pattern scale, and color mood.",
      "Replace only the user-specified object or surface material, wrapping the texture around the object's volume and preserving edges, seams, curves, shadows, and functional shape.",
      "Avoid flat wallpaper texture, changing the object geometry, replacing unrelated areas, and losing realistic highlights."
    ],
    "ecom-pose-replication-workflow": [
      "Template: pose/action replication.",
      "Dynamically infer which references provide target identity and which provide pose/action/camera composition. Pose references control body direction, gesture, limb angles, weight distribution, and camera framing only.",
      "Preserve the target person's identity, face, body type, clothing/product requirements, and style while applying the selected pose naturally with correct anatomy and contact points.",
      "Avoid copying the pose reference person's identity, creating a collage, producing multiple unrelated poses, or generating impossible limbs."
    ],
    "precise-image-edit": [
      "Template: precise local image edit.",
      "Make only the user-specified local change, such as short text, number, expression, action, object, watermark, or small region. Preserve the rest of the reference image as much as possible.",
      "For text editing, only attempt short words, numbers, labels, or one phrase. Do not attempt long Chinese paragraphs; use clean blank layout areas if the user asks for dense body copy.",
      "Avoid changing unrelated objects, overall composition, identity, lighting, or style."
    ],
    "people-selfie-group": [
      "Template: multi-person group photo or selfie.",
      "Use reference images to preserve each person's identity, face structure, age impression, hairstyle, body type, and temperament. Do not merge identities.",
      "Place all people into one coherent real scene with natural smiles, eye lines, body distance, camera perspective, shared lighting, and believable interaction such as selfie, group photo, hug, handshake, or standing together.",
      "Avoid collage, missing people, duplicated faces, pasted cutout edges, and mismatched scale."
    ],
    "expression-action-edit": [
      "Template: expression and action edit.",
      "Preserve the referenced person's or character's identity, outfit, scene, and visual style while changing the requested expression, gesture, body pose, or interaction.",
      "Make the action physically plausible with correct anatomy, weight distribution, hand/foot contact, facial muscles, and scene relationship.",
      "Avoid stiff unchanged poses, identity drift, extra people, broken hands, and impossible body positions."
    ],
    "model-wear-product": [
      "Template: model wearing or carrying product.",
      "Dynamically infer which reference is the model/person and which is the product/accessory. Use product references for shape, material, color, logo, and key details; use model references for identity, body, pose, and scale.",
      "Place the product naturally on the correct body area or in the hand/back/face/neck/wrist/feet with realistic occlusion, contact shadow, reflection, strap tension, and lighting.",
      "Avoid product deformation, wrong scale, sticker-like placement, and changing the model identity."
    ],
    "furniture-room-staging": [
      "Template: furniture staging in an empty room.",
      "Use the room reference for architecture, camera perspective, floor/wall planes, windows, light direction, and spatial constraints. Use furniture references for shape, material, color, and size cues.",
      "Arrange furniture in a believable interior layout with correct scale, floor contact, shadows, occlusion, spacing, and coherent decor style.",
      "Avoid floating furniture, impossible perspective, changed room structure, and overcrowded layout."
    ],
    "product-collab-design": [
      "Template: product collaboration or style transfer design.",
      "Use the main product reference as the protected product structure. Use style references only for color palette, motif, pattern logic, material mood, visual rhythm, or artistic direction.",
      "Create a new collaboration, limited edition, seasonal, or recolor design while preserving the product's recognizable form, function, proportions, and key product details.",
      "Avoid copying famous brand logos, copyrighted characters, exact trademarks, or changing the product into an unrelated object."
    ],
    "character-figure-toy": [
      "Template: character to commercial figure / collectible toy.",
      "Transform the referenced character into a realistic commercial figure or art toy, such as a 1/7 scale figure on a desk, display base, or product photography setup.",
      "Preserve character hair, face impression, clothing, colors, props, silhouette, and personality. Add realistic material, base, package/blind-box, lighting, and optional modeling-process screen.",
      "Avoid losing character identity, toy-like cheap plastic unless requested, malformed small parts, and unreadable packaging text."
    ],
    "sketch-to-finished-art": [
      "Template: sketch or draft to finished image.",
      "Use the sketch/lineart/doodle as the structural source: preserve composition, pose, character design, object placement, and key contours.",
      "Convert it into a polished high-definition illustration, product concept, scene design, or realistic image according to the user's style request, adding color, lighting, materials, background, and clean details.",
      "Avoid ignoring the sketch, changing the main design, overcomplicating the composition, or leaving rough unfinished lines."
    ],
    "physics-time-effect": [
      "Template: realistic physical time/effect simulation.",
      "Show the plausible visual result after heat, sunlight, water, freezing, impact, burning, aging, melting, rusting, or long use based on the user's scenario.",
      "Respect material physics, time duration, environment, gravity, deformation, texture changes, residue, steam, liquid, burn marks, cracks, or aging traces as appropriate.",
      "Avoid magical transformations unless requested, impossible physics, and changing the object identity beyond the described effect."
    ],
    "menu-design": [
      "Template: menu or price-list design.",
      "Create a finished restaurant, cafe, dessert, drink, or service menu with brand visual, category blocks, short item names, price zones, food/product imagery, ornaments, and clear hierarchy.",
      "Use only short readable labels and user-provided prices. Do not generate dense Chinese paragraphs or invent detailed prices if not provided.",
      "Avoid unreadable microtext, fake official claims, and cluttered menu grids."
    ],
    "invitation-business-card": [
      "Template: invitation, business card, or event card.",
      "Design a refined card with title area, name/brand, time/place/contact zones, optional QR placeholder, decorative texture, and polished spacing.",
      "Only use contact details, addresses, dates, names, and QR content supplied by the user. If missing, use clean blank areas or decorative short labels instead of inventing information.",
      "Avoid fake phone numbers, fake QR codes, long body copy, and unreadable small text."
    ],
    "word-flash-card": [
      "Template: word flash card.",
      "Create one educational flash card with one large English word, simple illustration, short definition/phonetic/example areas, and child-friendly layout.",
      "Keep English text short and clear. Chinese should be limited to brief labels or a short meaning.",
      "Avoid dense paragraphs, multiple unrelated words, and messy classroom worksheet clutter."
    ],
    "book-cover-kit": [
      "Template: book cover kit.",
      "Create a coordinated book design presentation with flat front cover, 3D book mockup, spine/back cover when useful, and a tasteful display scene.",
      "Book cover kit with references: if any reference image is a real book, textbook, product cover, package, logo, or the user note says keep/preserve/this is the product, treat that reference as the locked source product. Preserve its cover color blocks, title/logo/label placement, book shape, proportions, product identity, and recognizable front/spine/back design as much as the image model allows.",
      "Use other references only for layout, ecommerce atmosphere, callout style, lighting, background, or composition unless the user explicitly says otherwise.",
      "The template may add a display scene, platform, ribbons, icons, callout cards, floating pages, and commercial lighting around the locked book, but must not redesign it into a different book or unrelated natural-literary cover.",
      "Use short title, author area, series mark, and visual theme. Do not invent ISBN, publisher, endorsements, award badges, or legal claims.",
      "Avoid unreadable typography, unrelated stock imagery, and changing the requested book genre."
    ],
    "overseas-ecommerce-poster": [
      "Template: overseas ecommerce poster.",
      "Create an English-first product ad for Amazon, Shopify, TikTok Shop, or social commerce with hero product, 3-5 short benefit callouts, icon modules, lifestyle scene, and purchase atmosphere.",
      "English copy should be short, readable, and benefit-oriented. Translate Chinese selling points into natural concise English when needed.",
      "Avoid false certifications, medical/legal claims, fake platform UI, and dense Chinese text."
    ],
    "ecommerce-data-selling-point": [
      "Template: ecommerce data selling-point visual.",
      "Create a product detail visual using comparison bars, parameter cards, ingredient/material diagram, benefit icons, and a strong product hero.",
      "Use only user-provided numbers, units, and claims. If data is missing, use generic chart shapes or visual placeholders rather than fabricated statistics.",
      "Keep labels short and readable; avoid dense paragraphs and fake scientific authority."
    ],
    "children-science-picturebook": [
      "Template: children's science picture book page.",
      "Create a warm child-friendly educational page with simple characters, clear scene, one science concept, short title/labels, and gentle colors.",
      "Explain with visual metaphor, icons, arrows, and tiny captions rather than long text.",
      "Avoid scary imagery, dense textbook paragraphs, and inaccurate over-specific claims."
    ],
    "sketch-to-app-ui": [
      "Template: sketch to app UI.",
      "Use the sketch/wireframe as layout control: preserve navigation, card hierarchy, button positions, content blocks, and page purpose.",
      "Convert it into a polished mobile UI screen with coherent design system, realistic phone ratio, icons, typography zones, spacing, color palette, and component states.",
      "Avoid copying real app trademarks, over-dense text, and ignoring the sketch structure."
    ],
    "app-mockup-showcase": [
      "Template: app mockup showcase.",
      "Create a portfolio-ready presentation board with one or more realistic phone mockups, consistent UI screens, brand color, title zone, subtle background, and clean product-design hierarchy.",
      "Keep phone aspect ratios realistic and UI panels aligned. Use decorative short labels instead of dense unreadable copy.",
      "Avoid fake platform chrome, trademarked app logos, and cluttered Behance-style overdecoration."
    ],
    "research-analysis-figure": [
      "Template: research or AI analysis figure.",
      "Create a clear schematic figure for medical image segmentation, image classification, semantic segmentation, instance recognition, depth estimation, remote sensing, or experiment workflow.",
      "Treat it as illustrative/educational unless the user provides real data. Do not fabricate diagnoses, patient conclusions, paper results, or authoritative metrics.",
      "Use short professional labels, clean legends, color masks, arrows, panels, and method diagrams."
    ],
    "aesthetic-3d-cartoon-portrait": [
      "Template: premium 3D cartoon portrait.",
      "Create a polished cinematic 3D character portrait with expressive eyes, refined hair strands, soft skin translucency, rim light, shallow depth of field, and clean studio composition.",
      "Keep the character appealing but not plastic. Preserve referenced identity if provided.",
      "Avoid cheap toy rendering, distorted eyes, over-smoothed skin, and random decorative clutter."
    ],
    "aesthetic-kpop-studio-beauty": [
      "Template: refined K-pop studio beauty portrait.",
      "Use clean studio background, porcelain-like but natural skin, precise hair styling, soft blush, clean makeup, glossy hair highlights, and controlled rim light.",
      "Make it premium editorial rather than influencer filter. Preserve identity if a reference is provided.",
      "Avoid excessive face reshaping, plastic skin, harsh glam retouching, and messy background props."
    ],
    "aesthetic-fine-brush-lady": [
      "Template: traditional fine-brush lady / classical Chinese narrative.",
      "Use elegant posture, delicate linework, restrained mineral-like colors, refined clothing folds, hair ornaments, flowers, screens, pavilions, or classical props.",
      "Keep the image poetic, quiet, and compositionally balanced with tasteful negative space.",
      "Avoid modern influencer faces, cheap costume-drama styling, and overfilled fantasy effects."
    ],
    "aesthetic-wordless-picturebook": [
      "Template: wordless picture book.",
      "Tell the story through shapes, actions, placement, color, and scene rhythm, with no visible words or letters.",
      "Use warm hand-drawn texture, rounded forms, simple readable staging, and child-friendly visual logic.",
      "Avoid captions, labels, dense details, scary tone, and glossy vector sterility."
    ],
    "aesthetic-riviera-fashion": [
      "Template: Southern French Riviera fashion editorial.",
      "Use bright summer sunlight, pale stone architecture or coastal town setting, clear blue sky, relaxed luxury styling, blue/white/red palette, gingham or straw texture cues, and full-body editorial composition.",
      "Make the scene feel effortless, expensive, sunlit, and campaign-ready.",
      "Avoid copying real brand logos, oversexualized poses, chaotic props, and mixed outfit logic."
    ],
    "aesthetic-surreal-sculpture": [
      "Template: surreal sculpture / contemporary installation.",
      "Use minimal space, geometric frames, monochrome or restrained palette, single-source light, sculptural body/object relationship, and strong negative space.",
      "Emphasize boundary, silence, material, and spatial tension.",
      "Avoid poster clutter, random fantasy symbols, and decorative text."
    ],
    "aesthetic-eco-glass-surreal": [
      "Template: eco glass surrealism.",
      "Create a transparent glass or translucent subject form with delicate plant growth, inner light, soft reflections, air, and generous blank space.",
      "Keep the image pure, quiet, lightweight, and material-focused.",
      "Avoid overgrown jungle clutter, opaque plastic, harsh neon, and busy backgrounds."
    ],
    "aesthetic-retro-healing-picturebook": [
      "Template: retro healing picture book.",
      "Use rounded infantile forms, graphite pencil or paper texture, fine hatching, large negative space, black-and-white or low-saturation palette, and quiet gentle humor.",
      "Keep shapes soft, non-aggressive, warm, and emotionally soothing.",
      "Avoid glossy commercial mascot style, sharp edges, and loud saturated clutter."
    ],
    "aesthetic-inflatable-surreal-product": [
      "Template: inflatable surreal fashion/product visual.",
      "Use rubbery highlights, inflated soft volumes, latex-like reflections, minimal display space, and product/fashion installation feeling.",
      "Make materials tactile and premium while keeping the composition clean.",
      "Avoid real brand marks, copied logos, cheap balloon props, and unreadable text."
    ],
    "aesthetic-british-linocut": [
      "Template: retro British linocut-inspired illustration.",
      "Use geometric simplification, hand-carved texture, hatching, paper grain, muted cool palette, architectural/street/landscape subject, and book-cover calm.",
      "Use the visual language generally without imitating a named artist.",
      "Avoid smooth digital gradients, modern vector shine, and over-detailed realism."
    ],
    "aesthetic-graffiti-pop": [
      "Template: graffiti pop art.",
      "Use heavy black outlines, flat high-saturation colors, repeated symbols, motion lines, radiating marks, simple graphic shapes, and playful street energy.",
      "Make it bold and readable as a poster or social image.",
      "Avoid copying specific artist signatures, real trademarks, hate symbols, and dense unreadable text."
    ],
    "knowledge-encyclopedia": [
      "Template: knowledge encyclopedia / illustrated fact sheet.",
      "Create a modular infographic with hero subject, basic profile, classification, feature callouts, habits/mechanism, tips/risks, score cards, and summary modules as appropriate.",
      "Use clean light background, rounded cards, icons, labels, and high information density without crowding.",
      "Avoid making it a sales poster, hallucinating exact facts when not provided, and using long unreadable paragraphs."
    ],
    "life-timeline": [
      "Template: biography timeline.",
      "Create a structured life timeline with stages, places, representative works/events, influence, and emotional/personality tone matched to the subject.",
      "If historical accuracy matters, use only user-provided facts or broadly known non-specific labels; avoid fabricating exact years or works.",
      "Avoid dense tiny text, random portraits, and unrelated decorative history motifs."
    ],
    "event-long-timeline": [
      "Template: event / industry timeline long image.",
      "Create a long-form timeline organized by date, stage, milestone, impact, and conclusion. Use clear vertical or horizontal rhythm and scannable sections.",
      "Prefer user-provided facts for exact dates and names. If missing, use generic visual placeholders rather than invented authoritative details.",
      "Avoid fake news-like claims, overcrowded nodes, and unreadable microtext."
    ],
    "guofeng-atlas": [
      "Template: guofeng illustrated atlas.",
      "Create a Chinese retro atlas or scroll-style infographic with categorized creatures, objects, places, poems, folklore, or cultural items.",
      "Use consistent hand-painted style, antique paper texture, section dividers, short labels, and curated visual taxonomy.",
      "Avoid chaotic collage, modern UI elements unless requested, and off-theme symbols."
    ],
    "home-design": [
      "Template: home interior design.",
      "Preserve the room layout, wall openings, floor plan constraints, and perspective unless the user asks to change them.",
      "Improve furniture, materials, lighting, curtains, rugs, decor, color palette, and spatial atmosphere into a realistic interior design rendering.",
      "Avoid impossible furniture scale, warped architecture, and changing structural elements unintentionally."
    ],
    "furniture-placement": [
      "Template: furniture placement in room.",
      "Use furniture references for exact product shape, material, color, and scale cues. Use room references for spatial layout, camera perspective, lighting, and floor contact.",
      "Place furniture naturally with correct shadows, occlusion, scale, and style fit.",
      "Avoid floating furniture, changed product design, and mismatched perspective."
    ],
    "old-photo-restore": [
      "Template: old photo restoration / colorization.",
      "Preserve original identity, era, composition, clothing, and documentary feeling.",
      "Repair scratches, stains, blur, missing details, and fading; colorize naturally when requested with period-appropriate tones.",
      "Avoid modernizing faces, changing clothing, smoothing away age details, or inventing unrelated background."
    ],
    "colorize-sketch": [
      "Template: sketch / line art colorization.",
      "Preserve the original sketch composition, character design, line relationships, pose, and key shapes.",
      "Add clean color, lighting, materials, depth, and background atmosphere while respecting the sketch.",
      "Avoid changing the design, ignoring line art, or turning it into an unrelated image."
    ],
    keyframe: [
      "Template: short-video keyframe.",
      "Make one cinematic key moment that can later become a video shot. Keep subject, scene layout, lighting direction, clothing, props, and color anchors stable.",
      "Include camera view, shot size, lens feel, lighting direction, action potential, and clean space for subtitles or cover text.",
      "Avoid unstable extreme perspectives unless requested, duplicated characters, inconsistent lighting, and unclear action."
    ]
  };

  const guide = map[template] || map.custom;
  return [...common, ...guide, `Selected template id: ${template || "custom"}.`].join("\n");
}

function buildAgnesEditIntentGuide(input) {
  const rawPrompt = String(input.prompt || "");
  const referenceNotes = (input.references || []).map((item) => item.usage || "").join(" ");
  const text = `${rawPrompt} ${referenceNotes}`.replace(/\s+/g, "");
  const guides = [];

  const editWords = /(改|修改|改成|改为|换|换成|替换|变成|变为|生成成|做成|处理成|调整|局部|只改|仅改|重绘|重做|去掉|去除|删除|移除|擦除|消除|不要|加上|添加|增加|放入|加入|融入|保留|保持|不动|别动|参考|按照|根据)/;
  const localTargets = /(背景|场景|环境|天空|地面|墙面|墙|山|山体|山脉|树|草地|道路|街道|城市|建筑|高楼|房子|室内|房间|家具|沙发|桌子|椅子|灯具|衣服|服装|裙子|外套|鞋子|帽子|背包|墨镜|首饰|珠宝|项链|耳环|戒指|手镯|配饰|发型|头发|妆容|颜色|色调|风格|联名|光线|材质|纹理|质感|姿势|动作|表情|合影|自拍|拥抱|人物|人像|模特|主体|产品|商品|Logo|包装|文字|数字|水印|草稿|线稿|手办|盲盒|杂物|道具|车|动物|物体|局部|区域)/;
  const editTemplates = new Set([
    "photo-deblur-upscale",
    "focus-control",
    "age-transform",
    "skin-texture-edit",
    "secondary-lighting",
    "consistent-outfit-change",
    "multi-subject-consistency",
    "ecom-lifestyle-ad",
    "ecom-macro-detail",
    "ecom-craft-process",
    "ecom-derived-products",
    "ecom-product-combo",
    "ecom-marketing-pack",
    "ecom-bg-replace-workflow",
    "ecom-white-to-scene-workflow",
    "ecom-jewelry-tryon-workflow",
    "ecom-model-tryon-workflow",
    "ecom-object-transfer-workflow",
    "ecom-material-replace-workflow",
    "ecom-pose-replication-workflow",
    "precise-image-edit",
    "people-selfie-group",
    "expression-action-edit",
    "model-wear-product",
    "furniture-room-staging",
    "product-collab-design",
    "character-figure-toy",
    "sketch-to-finished-art",
    "physics-time-effect"
  ]);
  const isEditLike = editTemplates.has(input.promptTemplate) || (editWords.test(text) && (localTargets.test(text) || input.references.length > 0));

  if (!isEditLike) return "";

  guides.push(
    "Agnes edit mode: this is an image editing / guided transformation task. The uploaded reference image is not the final answer.",
    "The final output must be a newly generated result that visibly follows the user's requested change. Returning the reference image unchanged is a failed generation.",
    "Separate the image into protected elements and editable elements. Preserve only the elements the user explicitly says to keep, such as identity, subject, product shape, pose, animal, or foreground relationship.",
    "Modify the requested local region decisively. For edits such as changing background, clothing, hairstyle, color, object, text area, sky, environment, prop, expression, pose, or removing/adding elements, the edited region must be clearly different from the reference.",
    "Keep perspective, lighting direction, scale, shadows, edges, and color temperature coherent so the edited area looks naturally integrated, not pasted on."
  );

  if (/(背景|场景|环境|天空|地面|墙面|墙|山|山体|山脉|树|草地|道路|街道|城市|建筑|高楼|室内|房间)/.test(text)) {
    guides.push(
      "Background/environment edit: preserve protected foreground subjects, but rebuild the requested background or scene. The background must not stay the same if the user asks it to change."
    );
  }

  if (/(衣服|服装|裙子|外套|鞋子|帽子|发型|头发|妆容|穿搭|换装|颜色|色调)/.test(text)) {
    guides.push(
      "Appearance edit: preserve the person's identity and body structure while changing only the requested clothing, hairstyle, makeup, color, or styling details."
    );
  }

  if (/(首饰|珠宝|项链|耳环|耳饰|戒指|手镯|手链|配饰|上身|佩戴|戴上|试戴)/.test(text) || input.promptTemplate === "ecom-jewelry-tryon-workflow") {
    guides.push(
      "Jewelry/accessory try-on: preserve accessory design and the person's identity. Fit the accessory naturally onto the correct body area with realistic scale, occlusion, reflection, skin contact, and shadow."
    );
  }

  if (/(材质|纹理|质感|皮革|金属|木纹|布料|丝绸|玻璃|陶瓷|磨砂|反光|粗糙|光泽)/.test(text) || input.promptTemplate === "ecom-material-replace-workflow") {
    guides.push(
      "Material replacement: keep object geometry and perspective unchanged while replacing only the requested surface material. The texture must wrap around volume, seams, curves, and highlights naturally."
    );
  }

  if (/(产品|商品|包装|Logo|主图|白底|详情页|电商|淘宝|天猫|换背景|生场景)/.test(text) || ["ecom-bg-replace-workflow", "ecom-white-to-scene-workflow", "ecom-object-transfer-workflow"].includes(input.promptTemplate)) {
    guides.push(
      "Product edit: protect product identity, shape, packaging, logo placement, color, material, and label structure. Any new scene must match product scale, perspective, contact shadow, reflection, and lighting."
    );
  }

  if (/(姿势|动作|复刻|站姿|坐姿|手势|肢体|重心|拍照姿势)/.test(text) || input.promptTemplate === "ecom-pose-replication-workflow") {
    guides.push(
      "Pose replication: use pose references only for body direction, limb angles, gesture, weight distribution, camera framing, and composition. Do not copy the pose reference person's identity unless requested."
    );
  }

  if (/(合影|自拍|同框|拥抱|握手|一起拍照|多人)/.test(text) || input.promptTemplate === "people-selfie-group") {
    guides.push(
      "Group photo: preserve each referenced person's identity separately and place them into one shared scene with natural interaction, matching perspective, scale, skin tone, and lighting. Do not merge faces or create a collage."
    );
  }

  if (/(表情|开心|生气|坐下|站起|站起来|蹲下|跑起来|吐舌头|拥抱)/.test(text) || input.promptTemplate === "expression-action-edit") {
    guides.push(
      "Expression/action edit: visibly change the requested expression or action while preserving identity, outfit, scene, and style. Body mechanics, facial muscles, and contact points must be plausible."
    );
  }

  if (/(家具|空房间|客厅|卧室|沙发|桌子|椅子|灯具|摆放|室内)/.test(text) || input.promptTemplate === "furniture-room-staging") {
    guides.push(
      "Furniture staging: preserve room architecture and perspective, place furniture with believable scale, floor contact, shadows, occlusion, spacing, and unified interior style."
    );
  }

  if (/(联名|限定|改色|风格迁移|参考.*风格|潮牌|品牌风格)/.test(text) || input.promptTemplate === "product-collab-design") {
    guides.push(
      "Product style transfer: protect the main product geometry and function. Transfer only style cues such as palette, motifs, material mood, and pattern logic. Do not copy famous logos or trademarks."
    );
  }

  if (/(手办|盲盒|潮玩|模型|建模|1\/7|摆件)/.test(text) || input.promptTemplate === "character-figure-toy") {
    guides.push(
      "Figure/toy conversion: preserve character design and convert it into a physical collectible with realistic material, display base, packaging, desk or studio environment, and product-photography lighting."
    );
  }

  if (/(草稿|线稿|涂鸦|手绘|高清图|成品图|上色)/.test(text) || input.promptTemplate === "sketch-to-finished-art") {
    guides.push(
      "Sketch to finished image: use the sketch as structural control. Preserve composition and contours while adding clean color, lighting, material, background, and polished detail."
    );
  }

  if (/(融化|烤焦|晒|太阳|高温|冷冻|破损|变旧|生锈|腐蚀|时间|物理)/.test(text) || input.promptTemplate === "physics-time-effect") {
    guides.push(
      "Physical effect simulation: show a plausible material change caused by the described time, heat, sunlight, water, impact, freezing, burning, aging, melting, or rusting while preserving object identity."
    );
  }

  if (/(去掉|去除|删除|移除|擦除|消除|不要|水印|文字|杂物|物体|路人)/.test(text)) {
    guides.push(
      "Removal edit: remove the requested object or visual element and naturally fill the area with matching background, texture, light, and perspective."
    );
  }

  if (/(加上|添加|增加|放入|加入|融入|换成|替换|变成|改成|改为)/.test(text)) {
    guides.push(
      "Replacement/addition edit: add or replace the requested element so it becomes visibly present in the final image, with correct scale, contact shadow, perspective, and lighting."
    );
  }

  if (/(不动|保持|保留|不要动|别动|不变)/.test(text)) {
    guides.push(
      "Preservation note: words like keep/unchanged apply only to the named protected elements. They do not mean the whole reference image should stay unchanged."
    );
  }

  guides.push(
    "Self-check before finalizing: compare the result with the reference. If the edited area is almost identical to the reference, regenerate mentally with stronger changes instead of returning the unchanged image."
  );

  return `Agnes Forge edit constraints:\n${guides.join("\n")}`;
}

function buildInteractionGuide(prompt, referenceCount) {
  const text = String(prompt || "").replace(/\s+/g, "");
  const refA = parseRefIndex(text, ["第", "图", "参考图"], 1);
  const refB = parseSecondRefIndex(text);
  const guides = [];

  if (referenceCount >= 2 && /(背着|背起|背负|背上|背到|背著)/.test(text)) {
    guides.push(
      "Important action relationship: create a piggyback scene, not a character sheet.",
      `Use reference image ${refA || 1} as the carrier person: this person is standing or walking and carrying another person on their back.`,
      `Use reference image ${refB || 2} as the carried person: this person is physically on the carrier's back, with arms around the shoulders or body supported naturally.`,
      "The final image should contain one coherent interaction between the two people, with body contact, correct scale, believable weight, matching perspective, and shared lighting.",
      "Do not generate separated full-body turnarounds, multiple independent character poses, lineup views, or a collage."
    );
  }

  if (referenceCount >= 2 && /(抱着|抱起|公主抱|拥抱)/.test(text)) {
    guides.push(
      "Important action relationship: create one person holding the other in a natural pose.",
      "The two referenced people must interact physically in the same scene, not appear as separate character samples."
    );
  }

  if (referenceCount >= 2 && /(牵着|拉着|扶着|搀扶)/.test(text)) {
    guides.push(
      "Important action relationship: create one coherent scene where the referenced people interact through hand contact or support.",
      "Avoid separated characters, lineup views, and duplicated people."
    );
  }

  return guides.length ? `Interaction constraints:\n${guides.join("\n")}` : "";
}

function parseRefIndex(text, _markers, fallback) {
  const match = text.match(/(?:第|参考图|图)([一二三四五12345])(?:张|个|号)?(?:图)?/);
  return match ? chineseNumberToInt(match[1]) : fallback;
}

function parseSecondRefIndex(text) {
  const matches = [...text.matchAll(/(?:第|参考图|图)([一二三四五12345])(?:张|个|号)?(?:图)?/g)];
  if (matches.length >= 2) return chineseNumberToInt(matches[1][1]);
  return 2;
}

function chineseNumberToInt(value) {
  const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5 };
  return map[value] || Number(value) || null;
}

function buildReferenceProtectionGuide(input, referencePlan) {
  if (!input.references?.length) return "";
  const allText = [
    input.prompt,
    input.promptTemplate,
    ...(input.references || []).map((item) => item.usage || ""),
    referencePlan?.summary || ""
  ].join(" ");
  const relevant = /(保留|保持|不动|不变|不要改|别改|照着|就是这个|这个图|这个产品|产品|商品|水杯|杯子|杯|瓶|书本|书籍|教材|封面|包装|logo|商标|标题|大小|颜色|不遮挡|凸显|不用照搬|只参考风格|参考风格|风格参考|电商)/i.test(allText);
  if (!relevant) return "";

  const lockedRefs = (input.references || [])
    .map((item, index) => {
      const note = item.usage || "";
      if (!/(保留|保持|不动|不变|不要改|别改|照着|就是这个|这个图|这个产品|产品|书本|书籍|教材|封面|包装|logo|商标|标题|要设计的|源图|主图)/i.test(note)) return "";
      return `Reference image ${index + 1} user note says it is protected/source: ${limitText(note, 160)}`;
    })
    .filter(Boolean)
    .join("\n");

  return [
    "HIGHEST PRIORITY REFERENCE PRESERVATION RULE:",
    lockedRefs || "The user prompt or reference notes indicate at least one reference contains protected product/book/cover identity.",
    "If a reference is marked as the source product/book/cover, preserve its recognizable product identity: cover/package shape, dominant colors, color-block layout, title/logo/label placement, front/spine/back structure, proportions, and key printed design areas as much as the image model allows.",
    "Do not replace the locked product/book with a different product, different title style, unrelated literary/nature cover, or generic stock book.",
    "Template and style references are lower priority. They may change only the scene, lighting, callout modules, ecommerce decorations, background, composition, and presentation layout around the locked product/book.",
    "If another reference is described as style-only, use it only for visual atmosphere or layout language; do not copy its objects or override the locked product/book."
  ].join("\n");
}
function buildReferenceGuide(input, referencePlan) {
  const planText = referencePlan?.summary ? `Reference analysis:\n${referencePlan.summary}` : "";
  const imageList = input.references
    .map((item, index) => {
      const usage = item.usage ? ` User note: ${item.usage}` : "";
      return `Reference image ${index + 1}: file name "${item.name || `reference_${index + 1}`}".${usage}`;
    })
    .join("\n");

  return [
    `Reference images: ${input.references.length}.`,
    imageList,
    planText,
    "Interpret every reference image according to the user instruction. Do not assume a fixed role based only on upload order.",
    "Automatically decide which reference image is most useful for subject identity, scene/background, pose, clothing, jewelry/accessory, product details, packaging/logo, room/interior, furniture, material texture, target placement area, character design, sketch structure, composition, lighting, color palette, and overall style.",
    "For ecommerce and reference-edit workflows, infer whether each image is a product source, white-background product, target scene, model/person, clothing source, jewelry/accessory source, furniture source, empty room/interior source, material tile, pose reference, style/collaboration reference, sketch/lineart source, character source for figure/toy conversion, layout/style reference, or irrelevant reference.",
    "If the user explicitly says a certain reference number should be used for a certain role, follow that instruction first.",
    "If the user does not specify roles, infer the best role for each reference from the visual content and file name.",
    "Combine the useful visual evidence from the references into one new coherent image. Avoid copying irrelevant elements, watermarks, UI text, or accidental background details.",
    "Preserve important identity and design details from the references while adapting perspective, lighting, scale, and color so the final image feels natural."
  ]
    .filter(Boolean)
    .join("\n");
}

async function buildReferencePlan(input) {
  if (!input.references.length) return null;

  const fallback = {
    source: "prompt-only",
    summary: [
      "No separate vision analysis was available.",
      "The generation model must inspect all attached reference images directly.",
      "Use the user prompt to decide the role of each reference image instead of relying on upload order."
    ].join("\n"),
    error: ""
  };

  const images = input.references
    .map((ref, index) => referenceToVisionContent(ref, index))
    .filter(Boolean);
  if (!images.length) {
    return {
      ...fallback,
      error: "No usable reference image content was sent to vision analyzer"
    };
  }

  const analyzers = getVisionAnalyzerConfigs();
  if (!analyzers.length) {
    return {
      ...fallback,
      error: "No vision analyzer API key configured"
    };
  }

  const referenceNotes = input.references
    .map((ref, index) => {
      const usage = ref.usage ? ` | User note: ${ref.usage}` : "";
      return `Reference ${index + 1}: ${ref.name || `reference_${index + 1}`}${usage}`;
    })
    .join("\n");

  const attempts = [];
  for (const [index, analyzer] of analyzers.entries()) {
    const attemptLabel = `${analyzer.provider}:${analyzer.model}`;
    try {
      const summary = await analyzeReferencesWithVision(input, images, referenceNotes, analyzer);
      if (summary) {
        return {
          source: attemptLabel,
          summary: summary.slice(0, 2400),
          attempts: attempts.length
            ? [...attempts, { source: attemptLabel, ok: true, order: index + 1 }]
            : undefined
        };
      }
      attempts.push({ source: attemptLabel, ok: false, order: index + 1, error: "Vision analysis returned empty content" });
    } catch (error) {
      attempts.push({
        source: attemptLabel,
        ok: false,
        order: index + 1,
        error: formatVisionAnalysisError(error, analyzer)
      });
    }
  }

  return {
    ...fallback,
    error: attempts.map((attempt) => `${attempt.source}: ${attempt.error}`).join(" | "),
    attempts
  };
}

async function analyzeReferencesWithVision(input, images, referenceNotes, analyzer) {
  const controller = new AbortController();
  const timeoutMs = clamp(Number(analyzer.timeoutMs || 60_000), 10_000, 180_000);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(`${analyzer.apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${analyzer.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: analyzer.model,
      messages: [
        {
          role: "system",
          content:
            "You are a smart reference-image director for an AI image generation website. Reference images may be uploaded in random order. Analyze each image independently, then decide how it should or should not influence the new image. Be concise and practical."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                `User prompt: ${input.prompt}`,
                `Number of reference images: ${input.references.length}`,
                `Reference notes:\n${referenceNotes}`,
                "Important: do not force roles by upload order. A reference can have multiple roles or no useful role. Infer roles from image content, user prompt, and optional user notes.",
                "For each reference image, output: visible content, likely useful roles, relevance to user prompt, protected elements to preserve, editable elements, and details to ignore.",
                "Useful roles are open-ended, not fixed: subject identity, face, body/pose, model body, clothing/garment, jewelry/accessory, product/packaging, logo/label, room/interior, furniture source, background/scene, target placement area, spatial layout, camera angle, composition, color palette, lighting, material texture, typography/layout style, character design, sketch/lineart structure, physical object state, mood, or ignore.",
                "For ecommerce and reference-edit tasks, explicitly identify whether each image is a product source, white-background product, target scene, model/person, clothing source, jewelry/accessory source, furniture source, empty room/interior source, material tile/texture source, pose reference, style/collaboration reference, sketch/lineart source, character source for figure/toy conversion, layout/style reference, or irrelevant reference.",
                "Product/book-cover reference rule: if a user note says keep, preserve, this is the product, this is the book, textbook, cover, product source, do not redraw, only use another image for style, or similar, mark that reference as the locked source product. Protected elements include shape, color blocks, logo/title/label placement, packaging/book cover layout, spine/back details, and product identity. Editable elements are only surrounding scene, lighting, callouts, ecommerce decorations, background, and presentation layout unless the user says otherwise.",
                "If references conflict, state which evidence should have priority and why. If a reference is irrelevant, say to ignore it instead of forcing it into the output.",
                "If the user asks to replace, change, remove, add, or keep part of the image unchanged, identify protected elements and editable regions separately.",
                "For local edits, clearly state what must stay unchanged and what must visibly change. Never recommend returning the reference image unchanged.",
                "Then give one final synthesis plan: how to combine useful visual evidence with the user's prompt into a new coherent image.",
                "Return plain text only, no markdown table. Use short numbered bullets."
              ].join("\n")
            },
            ...images
          ]
        }
      ],
      temperature: 0.2,
      max_tokens: 650
    }),
    signal: controller.signal
  }).finally(() => clearTimeout(timeoutId));

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || data.message || `Vision analysis request failed with ${response.status}`);
  }

  return data.choices?.[0]?.message?.content?.trim() || "";
}

function formatVisionAnalysisError(error, analyzer) {
  if (error.name === "AbortError") {
    return `timeout after ${Math.round(Number(analyzer.timeoutMs || 60_000) / 1000)}s`;
  }
  const message = error.message || "Vision analysis failed";
  return String(message).slice(0, 500);
}

function referenceToVisionContent(ref, index) {
  if (ref.image) {
    const mimeType = ref.type && ref.type.startsWith("image/") ? ref.type : "image/png";
    return {
      type: "image_url",
      image_url: {
        url: `data:${mimeType};base64,${ref.image}`,
        detail: "low"
      }
    };
  }

  if (ref.url && /^https?:\/\//i.test(ref.url)) {
    return {
      type: "image_url",
      image_url: {
        url: ref.url,
        detail: "low"
      }
    };
  }

  return null;
}

async function generateImages(prompts, input, modelConfig, context = {}) {
  if (modelConfig.provider === "agnes") return generateWithAgnes(prompts, input, modelConfig);
  if (modelConfig.provider === "openai") return generateWithGptImage(prompts, input, modelConfig, context);
  if (modelConfig.provider === "nannabanan") return generateWithNannabanan(prompts, input, modelConfig, context);
  if (modelConfig.provider === "nanobanana") return generateWithNanoBanana(prompts, input, modelConfig, context);
  return prompts.map((item, index) => makeMockImage(item, input, index, modelConfig));
}

async function generateWithAgnes(prompts, input, modelConfig) {
  const apiKey = process.env.AGNES_API_KEY || process.env.AGNES_TOKEN;
  if (!apiKey) {
    throw new Error("Forge 生图模型尚未配置 AGNES_API_KEY，请联系管理员检查服务器 .env。");
  }

  const referenceImages = input.references.map(toAgnesReferenceImage).filter(Boolean);
  const size = ratioToAgnesSize(input.ratio);
  const agnesEditReminder = buildAgnesEditIntentGuide(input);
  const results = [];

  for (const [index, item] of prompts.entries()) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    const payload = {
      model: modelConfig.model,
      prompt: agnesEditReminder
        ? `${item.prompt}\n\nFinal Agnes instruction: Do not copy the uploaded reference image as-is. Complete the requested edit visibly.`
        : item.prompt,
      size,
      extra_body: { response_format: "url" }
    };

    if (referenceImages.length) payload.extra_body.image = referenceImages;

    let response;
    try {
      response = await fetch("https://apihub.agnes-ai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Forge 生成超时，请稍后重试或缩短提示词。");
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    let data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error?.message || data.message || `Forge 请求失败：${response.status}`;
      const retryResult = shouldRetryAgnesError(message, response.status)
        ? await retryAgnesImageRequest(payload, apiKey)
        : null;
      if (retryResult?.response?.ok) {
        response = retryResult.response;
        data = retryResult.data;
      } else {
        const finalMessage = retryResult?.message || message;
        const finalStatus = retryResult?.response?.status || response.status;
        throw new Error(formatAgnesError(finalMessage, finalStatus));
      }
    }

    const imageUrl = extractImageUrl(data);
    if (!imageUrl) throw new Error("Forge 没有返回可用图片 URL");

    results.push({
      id: item.id,
      promptId: item.id,
      url: imageUrl,
      ...sizeToDimensions(size),
      model: modelConfig.label,
      provider: modelConfig.provider,
      note: referenceImages.length ? `已向 Forge 传入 ${referenceImages.length} 张参考图。` : ""
    });

    if (index < prompts.length - 1) await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return results;
}

function shouldRetryAgnesError(message, status = 0) {
  const text = String(message || "").toLowerCase();
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    text.includes("system memory overloaded") ||
    text.includes("overloaded") ||
    text.includes("temporarily unavailable") ||
    text.includes("queue") ||
    text.includes("busy")
  );
}

async function retryAgnesImageRequest(payload, apiKey) {
  const delays = [1500, 3500];
  let lastResult = null;
  for (const delay of delays) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch("https://apihub.agnes-ai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      const message = data.error?.message || data.message || `Forge request failed: ${response.status}`;
      lastResult = { response, data, message };
      if (response.ok || !shouldRetryAgnesError(message, response.status)) return lastResult;
    } catch (error) {
      if (error.name === "AbortError") {
        lastResult = { response: { ok: false, status: 408 }, data: {}, message: "Forge generation timed out" };
        return lastResult;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return lastResult;
}

async function generateWithNanoBanana(prompts, input, modelConfig, context = {}) {
  const nanoConfigs = getNanoBananaChannelConfigs(input.gptQuality);
  if (!nanoConfigs.length) {
    throw new Error(`${modelConfig.label} ${nanoBananaQualityLabel(input.gptQuality)} 尚未配置 API Key。`);
  }

  const size = ratioToOpenAiSize(input.ratio, "1k");
  const dimensions = sizeToDimensions(size);
  const results = [];
  const channelAttempts = [];

  const persistChannelAttempts = () => {
    if (!context.requestId) return;
    try {
      updateGenerationRequest(context.requestId, { channelAttempts });
    } catch (error) {
      console.warn("nanobanana channel attempt update failed:", error.message);
    }
  };

  for (const [index, item] of prompts.entries()) {
    let generated = null;
    let lastError = null;

    for (const [channelIndex, nanoConfig] of nanoConfigs.entries()) {
      const attempt = createGptImageChannelAttempt({
        promptIndex: index,
        promptId: item.id,
        gptConfig: nanoConfig
      });
      channelAttempts.push(attempt);
      persistChannelAttempts();

      try {
        generated = await generateNanoBananaSinglePrompt({
          item,
          input,
          modelConfig,
          nanoConfig,
          size,
          dimensions
        });
        finishGptImageChannelAttempt(attempt, { status: "success" });
        persistChannelAttempts();
        break;
      } catch (error) {
        lastError = error;
        const retryable = shouldFallbackNanoBananaError(error);
        finishGptImageChannelAttempt(attempt, {
          status: "failed",
          retryable,
          statusCode: Number(error.gptStatus || 0),
          error: error.message || String(error)
        });
        persistChannelAttempts();
        const hasNextChannel = channelIndex < nanoConfigs.length - 1;
        if (!hasNextChannel || !retryable) throw error;
        console.warn(
          `Nanobanana ${input.gptQuality || "standard"} primary channel failed, switching to fallback: ${
            error.gptStatus || error.message || "unknown error"
          }`
        );
      }
    }

    if (!generated) throw lastError || new Error("香蕉 Nanobanana 没有返回可用图片");

    results.push({
      id: item.id,
      promptId: item.id,
      url: generated.imageUrl,
      width: dimensions.width,
      height: dimensions.height,
      model: modelConfig.label,
      provider: modelConfig.provider,
      note: generated.note
    });

    if (index < prompts.length - 1) await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return results;
}

async function generateNanoBananaSinglePrompt({ item, input, modelConfig, nanoConfig, size }) {
  const apiBase = normalizeApiBase(nanoConfig.apiBase);
  const apiKey = nanoConfig.apiKey;
  const activeModel = nanoConfig.model || modelConfig.model;
  const timeoutMs = 600_000;
  const routeLabel = nanoConfig.channel === "primary" ? "主通道" : "备用通道";
  const referenceContent = input.references.map(referenceToVisionContent).filter(Boolean);
  const content = [
    {
      type: "text",
      text: buildNanoBananaPrompt(item, input, size)
    },
    ...referenceContent
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
        temperature: 0.2
      }),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw markGptImageError(new Error("香蕉 Nanobanana 生成超时，请稍后重试。"), {
        timeout: true,
        apiBase,
        channel: nanoConfig.channel
      });
    }
    throw markGptImageError(new Error(formatNanoBananaNetworkError(error, apiBase)), {
      network: true,
      apiBase,
      channel: nanoConfig.channel
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || data.message || `Nanobanana request failed: ${response.status}`;
    throw markGptImageError(new Error(formatNanoBananaError(message, response.status)), {
      status: response.status,
      rawMessage: message,
      apiBase,
      channel: nanoConfig.channel
    });
  }

  const imageUrl = extractImageUrl(data);
  if (!imageUrl) {
    throw markGptImageError(new Error("香蕉 Nanobanana 没有返回可用图片"), {
      emptyImage: true,
      apiBase,
      channel: nanoConfig.channel
    });
  }
  await assertProviderImageUrlUsable(imageUrl, apiBase, nanoConfig.channel, "香蕉 Nanobanana");

  return {
    imageUrl,
    note: `香蕉 Nanobanana ${routeLabel}，${nanoBananaQualityLabel(nanoConfig.tier)}，${referenceContent.length} reference image(s).`
  };
}

function buildNanoBananaPrompt(item, input, size) {
  return [
    item.prompt,
    `Output aspect ratio: ${input.ratio}. Target canvas size: ${size}.`,
    "If reference images are provided, follow the user's prompt first, preserve explicitly named products/people/scenes from references, and use template/style hints only as low-priority guidance.",
    "Return one finished image. Do not return only text. No watermark, no random text, no duplicated subject, no distorted hands."
  ].join("\n\n");
}

async function generateWithNannabanan(prompts, input, modelConfig, context = {}) {
  const config = getNannabananConfig();
  if (!config.apiKey) throw new Error("🍌 Nannabanan 尚未配置 API Key，请联系管理员检查服务器配置。");

  const dimensions = nannabananDimensions(input);
  const results = [];
  const channelAttempts = [];

  const persistChannelAttempts = () => {
    if (!context.requestId) return;
    try {
      updateGenerationRequest(context.requestId, { channelAttempts });
    } catch (error) {
      console.warn("nannabanan channel attempt update failed:", error.message);
    }
  };

  for (const [index, item] of prompts.entries()) {
    const attempt = createGptImageChannelAttempt({
      promptIndex: index,
      promptId: item.id,
      gptConfig: config
    });
    channelAttempts.push(attempt);
    persistChannelAttempts();

    try {
      const generated = await generateNannabananSinglePrompt({
        item,
        input,
        modelConfig,
        config,
        dimensions
      });
      finishGptImageChannelAttempt(attempt, { status: "success" });
      persistChannelAttempts();
      results.push({
        id: item.id,
        promptId: item.id,
        url: generated.imageUrl,
        width: dimensions.width,
        height: dimensions.height,
        model: modelConfig.label,
        provider: modelConfig.provider,
        note: generated.note
      });
    } catch (error) {
      finishGptImageChannelAttempt(attempt, {
        status: "failed",
        retryable: shouldFallbackNanoBananaError(error),
        statusCode: Number(error.gptStatus || 0),
        error: error.message || String(error)
      });
      persistChannelAttempts();
      throw error;
    }

    if (index < prompts.length - 1) await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return results;
}

async function generateNannabananSinglePrompt({ item, input, modelConfig, config, dimensions }) {
  const apiBase = normalizeGeminiApiBase(config.apiBase);
  const aspectRatio = nannabananAspectRatio(input);
  const parts = [
    { text: buildNannabananPrompt(item, input, aspectRatio) },
    ...input.references.map(referenceToGeminiPart).filter(Boolean)
  ];
  const body = {
    contents: [
      {
        role: "user",
        parts
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio
      }
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Number(config.timeoutMs || 600_000));
  let response;
  try {
    response = await fetch(`${apiBase}/models/${normalizeGeminiModelPath(config.model || modelConfig.model)}:generateContent`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw markGptImageError(new Error("🍌 Nannabanan 生成超时，请稍后重试。"), {
        timeout: true,
        apiBase,
        channel: config.channel
      });
    }
    throw markGptImageError(new Error(formatNannabananNetworkError(error, apiBase)), {
      network: true,
      apiBase,
      channel: config.channel
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || data.message || `Nannabanan request failed: ${response.status}`;
    throw markGptImageError(new Error(formatNannabananError(message, response.status)), {
      status: response.status,
      rawMessage: message,
      apiBase,
      channel: config.channel
    });
  }

  const imageUrl = extractImageUrl(data);
  if (!imageUrl) {
    throw markGptImageError(new Error("🍌 Nannabanan 没有返回可用图片"), {
      emptyImage: true,
      apiBase,
      channel: config.channel
    });
  }

  return {
    imageUrl,
    note: `🍌 Nannabanan Gemini 原生接口，aspectRatio=${aspectRatio}，${parts.length - 1} reference image(s).`
  };
}

function buildNannabananPrompt(item, input, aspectRatio) {
  return [
    item.prompt,
    `Output aspect ratio: ${aspectRatio === "auto" ? "auto, follow uploaded reference image ratio" : aspectRatio}.`,
    "Follow the user's prompt first. If reference images are provided, preserve explicitly named products, people, scenes, structure, and visual identity from the references.",
    "Template/style hints are only low-priority guidance. Do not invent a different product when the user asks to use the reference product.",
    "Return one finished image. Do not return only text. No watermark, no random unreadable text, no duplicated subject, no distorted hands."
  ].join("\n\n");
}

function referenceToGeminiPart(ref) {
  if (ref.image) {
    return {
      inlineData: {
        mimeType: ref.type && ref.type.startsWith("image/") ? ref.type : "image/png",
        data: ref.image
      }
    };
  }
  return null;
}

function nannabananAspectRatio(input) {
  const allowed = new Set(["1:1", "4:3", "3:4", "3:2", "2:3", "16:9", "9:16", "21:9"]);
  if (input.promptRatio && allowed.has(input.promptRatio)) return input.promptRatio;
  if (input.ratioLocked && allowed.has(input.ratio)) return input.ratio;
  if (input.references.some((ref) => ref.image || ref.url)) return "auto";
  return allowed.has(input.ratio) ? input.ratio : "1:1";
}

function nannabananDimensions(input) {
  const aspectRatio = nannabananAspectRatio(input);
  if (aspectRatio === "auto") return sizeToDimensions(ratioToOpenAiSize(input.ratio || "1:1", "1k"));
  return sizeToDimensions(ratioToOpenAiSize(aspectRatio, "1k"));
}

async function generateWithGptImage(prompts, input, modelConfig, context = {}) {
  const gptConfigs = getGptImageChannelConfigs(input.gptQuality);
  if (!gptConfigs.length) {
    throw new Error(`${modelConfig.label} ${String(input.gptQuality || "1k").toUpperCase()} 尚未配置 API Key。`);
  }

  const size = ratioToOpenAiSize(input.ratio, input.gptQuality);
  const dimensions = sizeToDimensions(size);
  const quality = "low";
  const hasReferences = input.references.some((ref) => ref.image || /^https?:\/\//i.test(ref.url || ""));
  const results = [];
  const channelAttempts = [];

  const persistChannelAttempts = () => {
    if (!context.requestId) return;
    try {
      updateGenerationRequest(context.requestId, { channelAttempts });
    } catch (error) {
      console.warn("generation channel attempt update failed:", error.message);
    }
  };

  for (const [index, item] of prompts.entries()) {
    let generated = null;
    let lastError = null;

    for (const [channelIndex, gptConfig] of gptConfigs.entries()) {
      const attempt = createGptImageChannelAttempt({
        promptIndex: index,
        promptId: item.id,
        gptConfig
      });
      channelAttempts.push(attempt);
      persistChannelAttempts();
      try {
        generated = await generateGptImageSinglePrompt({
          item,
          input,
          modelConfig,
          gptConfig,
          size,
          dimensions,
          quality,
          hasReferences
        });
        finishGptImageChannelAttempt(attempt, { status: "success" });
        persistChannelAttempts();
        break;
      } catch (error) {
        lastError = error;
        const retryable = shouldFallbackGptImageError(error);
        finishGptImageChannelAttempt(attempt, {
          status: "failed",
          retryable,
          statusCode: Number(error.gptStatus || 0),
          error: error.message || String(error)
        });
        persistChannelAttempts();
        const hasNextChannel = channelIndex < gptConfigs.length - 1;
        if (!hasNextChannel || !retryable) {
          throw error;
        }
        console.warn(
          `GPT Image 2 ${input.gptQuality || "1k"} primary channel failed, switching to fallback: ${
            error.gptStatus || error.message || "unknown error"
          }`
        );
      }
    }

    if (!generated) throw lastError || new Error("GPT Image 2 没有返回可用图片");

    results.push({
      id: item.id,
      promptId: item.id,
      url: generated.imageUrl,
      width: dimensions.width,
      height: dimensions.height,
      model: modelConfig.label,
      provider: modelConfig.provider,
      note: generated.note
    });

    if (index < prompts.length - 1) await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return results;
}

function createGptImageChannelAttempt({ promptIndex, promptId, gptConfig }) {
  const startedAt = new Date().toISOString();
  return {
    promptIndex,
    promptId,
    tier: gptConfig.tier || "",
    role: gptConfig.channel || "",
    channelName: gptConfig.channelName || gptConfig.channel || "",
    source: gptConfig.source || "",
    apiBase: safeApiBaseForLog(gptConfig.apiBase),
    model: gptConfig.model || "",
    responseFormat: normalizeGptImageResponseFormat(gptConfig.responseFormat),
    status: "running",
    retryable: false,
    statusCode: 0,
    error: "",
    startedAt,
    completedAt: "",
    durationMs: 0
  };
}

function finishGptImageChannelAttempt(attempt, patch = {}) {
  const completedAt = new Date().toISOString();
  attempt.status = patch.status || attempt.status;
  attempt.retryable = Boolean(patch.retryable);
  attempt.statusCode = Number(patch.statusCode || 0);
  attempt.error = String(patch.error || "").slice(0, 600);
  attempt.completedAt = completedAt;
  const started = new Date(attempt.startedAt).getTime();
  const completed = new Date(completedAt).getTime();
  attempt.durationMs = Number.isFinite(started) && Number.isFinite(completed) && completed >= started ? completed - started : 0;
  return attempt;
}

function safeApiBaseForLog(apiBase) {
  try {
    return new URL(normalizeApiBase(apiBase)).origin;
  } catch {
    return String(apiBase || "").replace(/\/+$/, "").slice(0, 120);
  }
}

async function generateGptImageSinglePrompt({ item, input, modelConfig, gptConfig, size, dimensions, quality, hasReferences }) {
  const apiBase = normalizeApiBase(gptConfig.apiBase);
  const apiKey = gptConfig.apiKey;
  const activeModelConfig = { ...modelConfig, model: gptConfig.model || modelConfig.model };
  const routeLabel = gptConfig.channel === "fallback" ? "备用通道" : "主通道";
  const timeoutMs = getGptImageTimeoutMs(input.gptQuality);
  const responseFormat = normalizeGptImageResponseFormat(gptConfig.responseFormat);

  if (hasReferences) {
    const data = await generateGptImageViaEdits(item, input, activeModelConfig, apiBase, apiKey, size, quality, responseFormat);
    const imageUrl = extractImageUrl(data);
    if (!imageUrl) {
      throw markGptImageError(new Error("GPT Image 2 没有返回可用图片"), {
        emptyImage: true,
        apiBase,
        channel: gptConfig.channel
      });
    }
    await assertGeneratedImageUrlUsable(imageUrl, apiBase, gptConfig.channel);
    return {
      imageUrl,
      note: `GPT Image 2 ${routeLabel} image edit route, ${input.references.length} reference image(s), quality ${quality}.`
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${apiBase}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: activeModelConfig.model,
        prompt: item.prompt,
        n: 1,
        size,
        quality,
        response_format: responseFormat,
        output_format: "png"
      }),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw markGptImageError(new Error("GPT Image 2 生成超时，请稍后重试。"), {
        timeout: true,
        apiBase,
        channel: gptConfig.channel
      });
    }
    throw markGptImageError(new Error(formatNetworkError(error, apiBase)), {
      network: true,
      apiBase,
      channel: gptConfig.channel
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || data.message || `GPT Image 2 请求失败：${response.status}`;
    throw markGptImageError(new Error(formatGptImageError(message, response.status, hasReferences)), {
      status: response.status,
      rawMessage: message,
      apiBase,
      channel: gptConfig.channel
    });
  }

  const imageUrl = extractImageUrl(data);
  if (!imageUrl) {
    throw markGptImageError(new Error("GPT Image 2 没有返回可用图片"), {
      emptyImage: true,
      apiBase,
      channel: gptConfig.channel
    });
  }
  await assertGeneratedImageUrlUsable(imageUrl, apiBase, gptConfig.channel);

  return {
    imageUrl,
    note: `GPT Image 2 ${routeLabel}，质量参数为 ${quality}，返回格式 ${responseFormat}。`
  };
}

async function assertGeneratedImageUrlUsable(imageUrl, apiBase, channel = "") {
  const url = String(imageUrl || "");
  if (!/^https?:\/\//i.test(url)) return;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8"
      },
      signal: controller.signal
    });
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase() || "";
    if (!response.ok || !mimeType.startsWith("image/")) {
      throw markGptImageError(new Error(`GPT Image 2 返回的图片链接不可读取：${response.status || "invalid image"}`), {
        status: response.status,
        emptyImage: true,
        apiBase,
        channel
      });
    }
  } catch (error) {
    if (error.gptEmptyImage) throw error;
    throw markGptImageError(new Error("GPT Image 2 返回的图片链接读取失败。"), {
      network: error.name !== "AbortError",
      timeout: error.name === "AbortError",
      emptyImage: true,
      apiBase,
      channel
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function assertProviderImageUrlUsable(imageUrl, apiBase, channel = "", providerLabel = "上游模型") {
  const url = String(imageUrl || "");
  if (!/^https?:\/\//i.test(url)) return;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8"
      },
      signal: controller.signal
    });
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase() || "";
    if (!response.ok || !mimeType.startsWith("image/")) {
      throw markGptImageError(new Error(`${providerLabel} 返回的图片链接不可读取：${response.status || "invalid image"}`), {
        status: response.status,
        emptyImage: true,
        apiBase,
        channel
      });
    }
  } catch (error) {
    if (error.gptEmptyImage) throw error;
    throw markGptImageError(new Error(`${providerLabel} 返回的图片链接读取失败。`), {
      network: error.name !== "AbortError",
      timeout: error.name === "AbortError",
      emptyImage: true,
      apiBase,
      channel
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function getGptImageTimeoutMs() {
  return 600_000;
}

function userFacingError(message, options = {}) {
  const error = new Error(message);
  error.userFacing = true;
  return markGptImageError(error, options);
}

function markGptImageError(error, options = {}) {
  if (options.status) error.gptStatus = Number(options.status || 0);
  if (options.rawMessage) error.gptRawMessage = String(options.rawMessage || "");
  if (options.apiBase) error.gptApiBase = String(options.apiBase || "");
  if (options.channel) error.gptChannel = String(options.channel || "");
  if (options.network) error.gptNetwork = true;
  if (options.timeout) error.gptTimeout = true;
  if (options.emptyImage) error.gptEmptyImage = true;
  if (options.allowFallback === false) error.allowGptFallback = false;
  return error;
}

function shouldFallbackGptImageError(error) {
  if (!error || error.allowGptFallback === false) return false;
  const status = Number(error.gptStatus || 0);
  const text = `${error.gptRawMessage || ""} ${error.message || ""}`.toLowerCase();

  if (
    text.includes("safety_violations") ||
    text.includes("safety violation") ||
    text.includes("rejected by the safety system") ||
    text.includes("sexual") ||
    text.includes("未成年") ||
    text.includes("色情") ||
    text.includes("敏感描述")
  ) {
    return false;
  }

  if (
    text.includes("没有拿到可用参考图") ||
    text.includes("不是有效图片") ||
    text.includes("请重新上传参考图") ||
    text.includes("invalid image") ||
    text.includes("invalid_image")
  ) {
    return false;
  }

  return (
    error.gptNetwork ||
    error.gptTimeout ||
    error.gptEmptyImage ||
    [401, 403, 404, 408, 409, 429, 500, 502, 503, 504].includes(status) ||
    text.includes("quota") ||
    text.includes("balance") ||
    text.includes("insufficient") ||
    text.includes("rate limit") ||
    text.includes("too many requests") ||
    text.includes("temporarily unavailable") ||
    text.includes("upstream request failed") ||
    text.includes("没有返回可用图片")
  );
}

function shouldFallbackNanoBananaError(error) {
  if (!error || error.allowGptFallback === false) return false;
  const status = Number(error.gptStatus || 0);
  const text = `${error.gptRawMessage || ""} ${error.message || ""}`.toLowerCase();

  if (text.includes("safety") || text.includes("policy") || text.includes("blocked")) return false;
  if (text.includes("invalid image") || text.includes("invalid_image")) return false;

  return (
    error.gptNetwork ||
    error.gptTimeout ||
    error.gptEmptyImage ||
    [401, 403, 404, 408, 409, 429, 500, 502, 503, 504].includes(status) ||
    text.includes("quota") ||
    text.includes("balance") ||
    text.includes("insufficient") ||
    text.includes("rate limit") ||
    text.includes("too many requests") ||
    text.includes("temporarily unavailable") ||
    text.includes("upstream request failed") ||
    text.includes("没有返回可用图片")
  );
}

async function generateGptImageViaEdits(item, input, modelConfig, apiBase, apiKey, size, quality, responseFormat = "url") {
  const editEndpoint = `${apiBase}/images/edits`;
  const form = new FormData();
  form.append("model", modelConfig.model);
  form.append("prompt", buildGptImageEditPrompt(item, input, size));
  form.append("size", size);
  form.append("quality", quality);
  form.append("response_format", normalizeGptImageResponseFormat(responseFormat));
  form.append("output_format", "png");
  form.append("stream", "false");
  const imageCount = await appendGptEditReferenceImages(form, input.references);
  if (!imageCount) {
    throw userFacingError("GPT Image 2 没有拿到可用参考图，请重新上传参考图后再试。你的积分没有被扣除。", {
      allowFallback: false
    });
  }

  const controller = new AbortController();
  const timeoutMs = getGptImageTimeoutMs(input.gptQuality);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(editEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: form,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw markGptImageError(new Error("GPT Image 2 参考图编辑超时，请稍后重试。你的积分没有被扣除。"), {
        timeout: true,
        apiBase
      });
    }
    throw userFacingError(formatNetworkError(error, apiBase), {
      network: true,
      apiBase
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || data.message || `GPT Image 2 图片编辑接口请求失败：${response.status}`;
    throw userFacingError(formatGptImageError(message, response.status, true), {
      status: response.status,
      rawMessage: message,
      apiBase
    });
  }
  return data;
}

function buildGptImageEditPrompt(item, input, size) {
  const referenceNotes = (input.references || [])
    .map((ref, index) => {
      const note = ref.usage ? ` User note: ${limitText(ref.usage, 120)}` : "";
      return `Reference ${index + 1}: ${ref.name || `reference_${index + 1}`}.${note}`;
    })
    .join("\n");
  const customGuard = isCustomWorkflow(input)
    ? [
        "Custom mode: no website template is selected.",
        "Do not apply hidden poster, corporate promotion, ecommerce main image, PPT, brochure, infographic, book-cover kit, thriller, horror, or unrelated advertisement rules.",
        "Follow the user's prompt and reference images literally. Preserve user-named products, people, scenes, style, colors, logos, composition, and protected details as much as the model allows."
      ].join(" ")
    : "Template mode: the user explicitly selected a template. Apply that template only as a helper while preserving the user's named subjects and protected reference details.";

  return [
    item.prompt,
    customGuard,
    referenceNotes,
    `Output size/aspect: ${size}. Return one generated image URL.`
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function appendGptEditReferenceImages(form, references = []) {
  let count = 0;
  for (const [index, ref] of references.entries()) {
    const file = await getGptReferenceFile(ref, index);
    if (!file) continue;
    form.append("image", new Blob([file.buffer], { type: file.mimeType }), file.fileName);
    count += 1;
  }
  return count;
}

async function getGptReferenceFile(ref, index) {
  const fallbackType = ref?.type && String(ref.type).startsWith("image/") ? ref.type : "image/png";
  if (ref?.image) {
    const buffer = Buffer.from(String(ref.image).replace(/\s+/g, ""), "base64");
    if (!buffer.length) return null;
    return {
      buffer,
      mimeType: fallbackType,
      fileName: `${safeFileName(ref.name || `reference_${index + 1}`)}.${mimeToExtension(fallbackType)}`
    };
  }

  if (ref?.url && /^https?:\/\//i.test(ref.url)) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(ref.url, { signal: controller.signal });
      if (!response.ok) {
        throw userFacingError(`GPT Image 2 无法读取第 ${index + 1} 张参考图链接，请重新上传图片。你的积分没有被扣除。`);
      }
      const mimeType = response.headers.get("content-type")?.split(";")[0] || fallbackType;
      if (!mimeType.startsWith("image/")) {
        throw userFacingError(`第 ${index + 1} 张参考图不是有效图片，请重新上传。你的积分没有被扣除。`);
      }
      return {
        buffer: Buffer.from(await response.arrayBuffer()),
        mimeType,
        fileName: `${safeFileName(ref.name || `reference_${index + 1}`)}.${mimeToExtension(mimeType)}`
      };
    } catch (error) {
      if (error.userFacing) throw error;
      throw userFacingError(`GPT Image 2 读取第 ${index + 1} 张参考图失败，请重新上传图片。你的积分没有被扣除。`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
}

function mimeToExtension(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "png";
}

function toAgnesReferenceImage(item) {
  if (item.url) return item.url;
  if (!item.image) return "";
  const mimeType = item.type && item.type.startsWith("image/") ? item.type : "image/png";
  return `data:${mimeType};base64,${item.image}`;
}

function getGptImageConfig(quality = "1k") {
  const tier = normalizeGptQuality(quality);
  const tierApiKey = tier === "1k" ? process.env.GPT_IMAGE_1K_API_KEY : tier === "4k" ? process.env.GPT_IMAGE_4K_API_KEY : "";
  const tierApiBase = tier === "1k" ? process.env.GPT_IMAGE_1K_API_BASE_URL : tier === "4k" ? process.env.GPT_IMAGE_4K_API_BASE_URL : "";
  const tierModel = tier === "1k" ? process.env.GPT_IMAGE_1K_MODEL : tier === "4k" ? process.env.GPT_IMAGE_4K_MODEL : "";
  const tierResponseFormat = tier === "1k" ? process.env.GPT_IMAGE_1K_RESPONSE_FORMAT : tier === "4k" ? process.env.GPT_IMAGE_4K_RESPONSE_FORMAT : "";
  return {
    tier,
    apiKey:
      tierApiKey ||
      process.env.GPT_IMAGE_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.IMAGE_API_KEY,
    apiBase:
      tierApiBase ||
      process.env.GPT_IMAGE_API_BASE_URL ||
      process.env.OPENAI_API_BASE_URL ||
      process.env.IMAGE_API_BASE_URL ||
      "https://api.openai.com/v1",
    model:
      tierModel ||
      process.env.GPT_IMAGE_MODEL ||
      process.env.OPENAI_IMAGE_MODEL ||
      process.env.IMAGE_MODEL ||
      "gpt-image-2",
    responseFormat:
      tierResponseFormat ||
      process.env.GPT_IMAGE_RESPONSE_FORMAT ||
      process.env.IMAGE_RESPONSE_FORMAT ||
      "url"
  };
}

function getGptImageFallbackConfig(quality = "1k") {
  const tier = normalizeGptQuality(quality);
  const tierPrimaryModel = tier === "1k" ? process.env.GPT_IMAGE_1K_MODEL : tier === "4k" ? process.env.GPT_IMAGE_4K_MODEL : "";
  const tierPrimaryResponseFormat =
    tier === "1k" ? process.env.GPT_IMAGE_1K_RESPONSE_FORMAT : tier === "4k" ? process.env.GPT_IMAGE_4K_RESPONSE_FORMAT : "";
  const tierFallbackKeys = {
    "1k": {
      apiKey: "GPT_IMAGE_1K_FALLBACK_API_KEY",
      apiBase: "GPT_IMAGE_1K_FALLBACK_API_BASE_URL",
      model: "GPT_IMAGE_1K_FALLBACK_MODEL",
      responseFormat: "GPT_IMAGE_1K_FALLBACK_RESPONSE_FORMAT"
    },
    "2k": {
      apiKey: "GPT_IMAGE_2K_FALLBACK_API_KEY",
      apiBase: "GPT_IMAGE_2K_FALLBACK_API_BASE_URL",
      model: "GPT_IMAGE_2K_FALLBACK_MODEL",
      responseFormat: "GPT_IMAGE_2K_FALLBACK_RESPONSE_FORMAT"
    },
    "4k": {
      apiKey: "GPT_IMAGE_4K_FALLBACK_API_KEY",
      apiBase: "GPT_IMAGE_4K_FALLBACK_API_BASE_URL",
      model: "GPT_IMAGE_4K_FALLBACK_MODEL",
      responseFormat: "GPT_IMAGE_4K_FALLBACK_RESPONSE_FORMAT"
    }
  };
  const keys = tierFallbackKeys[tier] || tierFallbackKeys["1k"];
  return {
    tier,
    channel: "fallback",
    apiKey:
      process.env[keys.apiKey] ||
      process.env.GPT_IMAGE_FALLBACK_API_KEY ||
      process.env.IMAGE_FALLBACK_API_KEY,
    apiBase:
      process.env[keys.apiBase] ||
      process.env.GPT_IMAGE_FALLBACK_API_BASE_URL ||
      process.env.IMAGE_FALLBACK_API_BASE_URL ||
      "",
    model:
      process.env[keys.model] ||
      tierPrimaryModel ||
      process.env.GPT_IMAGE_FALLBACK_MODEL ||
      process.env.IMAGE_FALLBACK_MODEL ||
      "",
    responseFormat:
      process.env[keys.responseFormat] ||
      tierPrimaryResponseFormat ||
      process.env.GPT_IMAGE_FALLBACK_RESPONSE_FORMAT ||
      process.env.IMAGE_FALLBACK_RESPONSE_FORMAT ||
      ""
  };
}

function getGptImageChannelConfigs(quality = "1k") {
  const tier = normalizeGptQuality(quality);
  const studioChannels = getEnabledApiChannels({ provider: "gpt-image-2", tier });
  if (studioChannels.length) {
    return dedupeGptImageChannels(
      studioChannels.map((channel) => ({
        tier,
        channel: channel.role,
        source: "api-studio",
        channelName: channel.name || channel.role,
        apiKey: channel.apiKey,
        apiBase: channel.apiBase,
        model: channel.model,
        responseFormat: channel.responseFormat || "b64_json"
      }))
    );
  }

  const primary = { ...getGptImageConfig(quality), channel: "primary" };
  const fallback = getGptImageFallbackConfig(quality);
  const channels = [];
  if (primary.apiKey) channels.push({ ...primary, source: ".env", channelName: "ENV primary" });
  if (fallback.apiKey) {
    channels.push({
      ...fallback,
      source: ".env",
      channelName: "ENV fallback",
      apiBase: fallback.apiBase || primary.apiBase,
      model: fallback.model || primary.model,
      responseFormat: fallback.responseFormat || primary.responseFormat
    });
  }
  return dedupeGptImageChannels(channels);
}

function normalizeGptImageResponseFormat(value = "url") {
  const format = String(value || "url").trim().toLowerCase();
  return format === "b64_json" ? "b64_json" : "url";
}

function dedupeGptImageChannels(channels = []) {
  const seen = new Set();
  const result = [];
  for (const channel of channels) {
    const key = [
      channel.apiKey || "",
      normalizeApiBase(channel.apiBase || ""),
      channel.model || ""
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(channel);
  }
  return result;
}

function getNanoBananaConfig(quality = "standard") {
  const tier = normalizeModelQuality("nanobanana", quality);
  if (tier === "high") {
    return {
      tier,
      channel: "primary",
      source: ".env",
      channelName: "Nanobanana high primary",
      apiKey: process.env.NANO_BANANA_HIGH_API_KEY || process.env.NANOBANANA_HIGH_API_KEY || "",
      apiBase: process.env.NANO_BANANA_HIGH_API_BASE_URL || process.env.NANOBANANA_HIGH_API_BASE_URL || "",
      model:
        process.env.NANO_BANANA_HIGH_MODEL ||
        process.env.NANOBANANA_HIGH_MODEL ||
        process.env.NANO_BANANA_MODEL ||
        process.env.NANOBANANA_MODEL ||
        "gemini-3-pro-image-preview"
    };
  }

  return {
    tier,
    channel: "primary",
    source: ".env",
    channelName: "Nanobanana standard primary",
    apiKey: process.env.NANO_BANANA_API_KEY || process.env.NANOBANANA_API_KEY || "",
    apiBase: process.env.NANO_BANANA_API_BASE_URL || process.env.NANOBANANA_API_BASE_URL || "",
    model: process.env.NANO_BANANA_MODEL || process.env.NANOBANANA_MODEL || "gemini-3.1-flash-image-preview"
  };
}

function getNannabananConfig() {
  return {
    tier: "standard",
    channel: "primary",
    channelName: "Nannabanan primary",
    source: ".env",
    apiKey: process.env.NANNABANAN_API_KEY || "",
    apiBase: process.env.NANNABANAN_API_BASE_URL || "https://sub.g-aisc.com/v1beta",
    model: process.env.NANNABANAN_MODEL || "gemini-2.5-flash-image-preview",
    responseFormat: "inlineData",
    timeoutMs: Number(process.env.NANNABANAN_TIMEOUT_MS || 600_000)
  };
}

function getNanoBananaFallbackConfig(quality = "standard") {
  const tier = normalizeModelQuality("nanobanana", quality);
  if (tier !== "high") return { tier, channel: "fallback1", apiKey: "", apiBase: "", model: "" };
  const primary = getNanoBananaConfig(tier);
  return {
    tier,
    channel: "fallback1",
    source: ".env",
    channelName: "Nanobanana high fallback 1",
    apiKey: process.env.NANO_BANANA_HIGH_FALLBACK_API_KEY || process.env.NANOBANANA_HIGH_FALLBACK_API_KEY || "",
    apiBase: process.env.NANO_BANANA_HIGH_FALLBACK_API_BASE_URL || process.env.NANOBANANA_HIGH_FALLBACK_API_BASE_URL || primary.apiBase,
    model:
      process.env.NANO_BANANA_HIGH_FALLBACK_MODEL ||
      process.env.NANOBANANA_HIGH_FALLBACK_MODEL ||
      primary.model ||
      "gemini-3-pro-image-preview"
  };
}

function getNanoBananaChannelConfigs(quality = "standard") {
  const tier = normalizeModelQuality("nanobanana", quality);
  const studioChannels = getEnabledApiChannels({ provider: "nanobanana", tier });
  if (studioChannels.length) {
    return dedupeGptImageChannels(
      studioChannels.map((channel) => ({
        tier,
        channel: channel.role,
        source: "api-studio",
        channelName: channel.name || channel.role,
        apiKey: channel.apiKey,
        apiBase: channel.apiBase,
        model: channel.model,
        responseFormat: channel.responseFormat || "b64_json"
      }))
    );
  }

  const primary = getNanoBananaConfig(quality);
  const fallback = getNanoBananaFallbackConfig(quality);
  const channels = [];
  if (primary.apiKey) channels.push(primary);
  if (fallback.apiKey) channels.push(fallback);
  return dedupeGptImageChannels(channels);
}

function nanoBananaQualityLabel(quality = "standard") {
  return normalizeModelQuality("nanobanana", quality) === "high" ? "高质" : "标准";
}

function formatAgnesError(message, status = 0) {
  const raw = String(message || "").trim();
  const lower = raw.toLowerCase();

  if (lower.includes("queue") && (lower.includes("full") || lower.includes("busy"))) {
    return "Forge 生图模型当前排队已满，请稍后再试。你的积分没有被扣除。";
  }

  if (lower.includes("rate limit") || lower.includes("too many requests") || status === 429) {
    return "Forge 生图模型当前请求过多，请等 30-60 秒后再试。你的积分没有被扣除。";
  }

  if (lower.includes("insufficient") || lower.includes("quota") || lower.includes("balance")) {
    return "Forge 生图模型额度不足或上游额度受限，请联系管理员检查 Agnes 账户额度。你的积分没有被扣除。";
  }

  if (lower.includes("api key") || lower.includes("unauthorized") || lower.includes("invalid key") || status === 401) {
    return "Forge 生图模型 API Key 配置异常，请联系管理员检查服务器配置。你的积分没有被扣除。";
  }

  if (status >= 500) {
    return `Forge 生图模型上游服务暂时异常，请稍后重试。你的积分没有被扣除。原始信息：${raw || status}`;
  }

  return raw || `Forge 请求失败：${status}`;
}

function normalizeApiBase(value) {
  const base = String(value || "https://api.openai.com/v1").trim().replace(/\/+$/, "");
  return /\/v1$/i.test(base) ? base : `${base}/v1`;
}

function normalizeGeminiApiBase(value) {
  const base = String(value || "https://sub.g-aisc.com/v1beta").trim().replace(/\/+$/, "");
  return /\/v1beta$/i.test(base) ? base : `${base}/v1beta`;
}

function normalizeGeminiModelPath(model) {
  return String(model || "gemini-2.5-flash-image-preview").trim().replace(/^models\//i, "");
}

function formatNetworkError(error, apiBase) {
  const cause = error.cause;
  const code = cause?.code || error.code || "";
  if (code === "UND_ERR_CONNECT_TIMEOUT" || /timeout/i.test(cause?.message || "")) {
    return `GPT Image 2 连接接口超时：${apiBase}。请检查后台 API Base URL 或本机网络/代理。`;
  }
  return `GPT Image 2 连接接口失败：${error.message || "网络错误"}。当前接口：${apiBase}`;
}

function formatNanoBananaNetworkError(error, apiBase) {
  const cause = error.cause;
  const code = cause?.code || error.code || "";
  if (code === "UND_ERR_CONNECT_TIMEOUT" || /timeout/i.test(cause?.message || "")) {
    return `香蕉 Nanobanana 连接接口超时：${apiBase}。请检查服务器网络或 API Base URL。`;
  }
  return `香蕉 Nanobanana 连接接口失败：${error.message || "网络错误"}。当前接口：${apiBase}`;
}

function formatNannabananNetworkError(error, apiBase) {
  const cause = error.cause;
  const code = cause?.code || error.code || "";
  if (code === "UND_ERR_CONNECT_TIMEOUT" || /timeout/i.test(cause?.message || "")) {
    return `🍌 Nannabanan 连接接口超时：${apiBase}。请检查服务器网络或 API Base URL。`;
  }
  return `🍌 Nannabanan 连接接口失败：${error.message || "网络错误"}。当前接口：${apiBase}`;
}

function formatNanoBananaError(message, status = 0) {
  const raw = String(message || "").trim();
  const lower = raw.toLowerCase();

  if (lower.includes("safety") || lower.includes("policy") || lower.includes("blocked")) {
    return "香蕉 Nanobanana 上游安全系统拒绝了这次请求，请调整提示词后重试。你的积分没有被扣除。";
  }
  if (status === 404 || lower.includes("not found")) {
    return "香蕉 Nanobanana 上游接口地址或模型名不可用，请联系管理员检查模型配置。你的积分没有被扣除。";
  }
  if (status === 401 || status === 403 || lower.includes("unauthorized") || lower.includes("api key") || lower.includes("invalid key")) {
    return "香蕉 Nanobanana API Key 配置异常，请联系管理员检查服务器配置。你的积分没有被扣除。";
  }
  if (status === 429 || lower.includes("rate limit") || lower.includes("too many requests")) {
    return "香蕉 Nanobanana 当前请求过多，请稍后再试。你的积分没有被扣除。";
  }
  if (lower.includes("quota") || lower.includes("balance") || lower.includes("insufficient")) {
    return "香蕉 Nanobanana 上游额度不足，请联系管理员检查账户额度。你的积分没有被扣除。";
  }
  if (status >= 500) {
    return `香蕉 Nanobanana 上游服务暂时异常，请稍后重试。你的积分没有被扣除。原始信息：${raw || status}`;
  }
  return raw || `香蕉 Nanobanana 请求失败：${status}`;
}

function formatNannabananError(message, status = 0) {
  const raw = String(message || "").trim();
  const text = raw.toLowerCase();
  if (status === 400) return `🍌 Nannabanan 请求参数不兼容，请联系管理员检查接口配置。你的积分没有被扣除。原始信息：${raw || status}`;
  if (status === 401 || status === 403 || text.includes("api key") || text.includes("unauthorized")) {
    return "🍌 Nannabanan API Key 配置异常，请联系管理员检查服务器配置。你的积分没有被扣除。";
  }
  if (status === 429 || text.includes("rate limit") || text.includes("too many")) {
    return "🍌 Nannabanan 当前请求过多，请稍后再试。你的积分没有被扣除。";
  }
  if (status === 402 || text.includes("quota") || text.includes("balance") || text.includes("insufficient")) {
    return "🍌 Nannabanan 上游额度不足，请联系管理员检查账户额度。你的积分没有被扣除。";
  }
  if (status >= 500 || text.includes("temporarily unavailable") || text.includes("overloaded")) {
    return `🍌 Nannabanan 上游服务暂时异常，请稍后重试。你的积分没有被扣除。原始信息：${raw || status}`;
  }
  return raw || `🍌 Nannabanan 请求失败：${status}`;
}

function formatGptImageError(message, status = 0, hasReferences = false) {
  const raw = String(message || "").trim();
  const lower = raw.toLowerCase();

  if (
    lower.includes("safety_violations") ||
    lower.includes("safety violation") ||
    lower.includes("rejected by the safety system") ||
    lower.includes("sexual")
  ) {
    return "GPT Image 2 上游安全系统拒绝了这次请求，可能包含未成年、幼态角色、裸露、性感服装或其他敏感描述。请改成明确成年角色，并删除敏感身体/服装词后再试。你的积分没有被扣除。";
  }

  if (status === 404 || lower.includes("status 404") || lower.includes("not found")) {
    return "GPT Image 2 上游接口地址或模型名不可用，请联系管理员检查模型配置。你的积分没有被扣除。";
  }

  if (status === 401 || lower.includes("unauthorized") || lower.includes("api key") || lower.includes("invalid key")) {
    return "GPT Image 2 API Key 配置异常，请联系管理员检查服务器配置。你的积分没有被扣除。";
  }

  if (status === 429 || lower.includes("rate limit") || lower.includes("too many requests")) {
    return "GPT Image 2 当前请求过多，请稍后重试。你的积分没有被扣除。";
  }

  if (lower.includes("quota") || lower.includes("balance") || lower.includes("insufficient")) {
    return "GPT Image 2 上游额度不足或额度受限，请联系管理员检查账户额度。你的积分没有被扣除。";
  }

  if (status >= 500 || lower.includes("upstream request failed")) {
    return `GPT Image 2 上游服务暂时异常，请稍后重试。你的积分没有被扣除。原始信息：${raw || status}`;
  }

  return raw || `GPT Image 2 请求失败：${status}`;
}

async function persistGeneratedImages(images, jobId) {
  await fs.mkdir(generatedDir, { recursive: true });
  const stored = [];
  for (const [index, image] of (images || []).entries()) {
    stored.push(await persistGeneratedImage(image, jobId, index));
  }
  return stored;
}

async function persistJobReferenceImages(references = [], jobId) {
  await fs.mkdir(referencesDir, { recursive: true });
  const stored = [];
  for (const [index, ref] of references.entries()) {
    if (!ref?.image) {
      stored.push(null);
      continue;
    }
    const mimeType = ref.type && ref.type.startsWith("image/") ? ref.type : "image/png";
    const extension = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : mimeType.includes("webp") ? "webp" : "png";
    const fileName = `${safeFileName(jobId)}_ref_${index + 1}.${extension}`;
    const filePath = path.join(referencesDir, fileName);
    await fs.writeFile(filePath, Buffer.from(ref.image, "base64"));
    stored.push({ storedFile: fileName, type: mimeType });
  }
  return stored;
}

async function loadJobReferenceImages(jobId) {
  const safeJobId = safeFileName(jobId);
  const jobPath = path.join(jobsDir, `${safeJobId}.json`);
  const text = await fs.readFile(jobPath, "utf-8");
  const job = JSON.parse(text);
  const refs = Array.isArray(job?.input?.references) ? job.input.references : [];
  const result = [];
  for (const [index, ref] of refs.entries()) {
    const item = {
      id: ref.id || `reference_${index + 1}`,
      name: ref.name || `参考图 ${index + 1}`,
      usage: ref.usage || "",
      type: ref.storedType || ref.type || "image/png",
      url: ref.url || ""
    };
    if (ref.storedFile) {
      const fileName = path.basename(ref.storedFile);
      const filePath = path.join(referencesDir, fileName);
      const buffer = await fs.readFile(filePath);
      item.url = `data:${item.type};base64,${buffer.toString("base64")}`;
    }
    if (item.url) result.push(item);
  }
  return result;
}

async function persistGeneratedImage(image, jobId, index) {
  const url = String(image?.url || "");
  const parsed = parseDataImage(url);
  const remoteParsed = !parsed && /^https?:\/\//i.test(url)
    ? await fetchRemoteGeneratedImage(url)
    : null;
  const imageAsset = parsed || remoteParsed;
  if (!imageAsset) {
    if (/^https?:\/\//i.test(url)) {
      throw userFacingError("上游返回的图片链接不可读取，未能保存到本地。请稍后重试或等待系统自动切换其他通道。你的积分没有被扣除。");
    }
    return { ...image, thumbnailUrl: image?.thumbnailUrl || url };
  }

  const fileBase = `${safeFileName(jobId)}_${index + 1}`;
  const fileName = `${fileBase}.${imageAsset.extension}`;
  const filePath = path.join(generatedDir, fileName);
  await fs.writeFile(filePath, imageAsset.buffer);
  const publicUrl = `/generated/${fileName}`;
  const thumbnailUrl = await createGeneratedThumbnail(imageAsset.buffer, jobId, index);
  return {
    ...image,
    url: publicUrl,
    thumbnailUrl: thumbnailUrl || publicUrl,
    originalUrl: url,
    originalBytes: imageAsset.buffer.length
  };
}

async function createGeneratedThumbnail(buffer, jobId, index) {
  try {
    await fs.mkdir(thumbnailsDir, { recursive: true });
    const fileName = `${safeFileName(jobId)}_${index + 1}.webp`;
    const filePath = path.join(thumbnailsDir, fileName);
    await sharp(buffer)
      .rotate()
      .resize({ width: 360, height: 360, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(filePath);
    return `/thumbnails/${fileName}`;
  } catch (error) {
    console.warn("thumbnail generation failed:", error.message);
    return "";
  }
}

async function ensureHistoryThumbnails(history = []) {
  for (const item of history) {
    if (!item?.id || !item.url?.startsWith("/generated/")) continue;
    if (item.thumbnailUrl?.startsWith("/thumbnails/")) continue;
    const fileName = path.basename(item.url);
    const sourcePath = path.join(generatedDir, fileName);
    try {
      const buffer = await fs.readFile(sourcePath);
      const thumbnailUrl = await createGeneratedThumbnail(buffer, item.jobId || item.id, Number(item.imageIndex || 0));
      if (thumbnailUrl) {
        item.thumbnailUrl = thumbnailUrl;
        updateImageThumbnailUrl(item.id, thumbnailUrl);
      }
    } catch (error) {
      console.warn("history thumbnail backfill failed:", item.id, error.message);
    }
  }
}

async function fetchRemoteGeneratedImage(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8"
      },
      signal: controller.signal
    });
    if (!response.ok) return null;
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase() || "";
    if (!mimeType.startsWith("image/")) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) return null;
    return {
      mimeType,
      extension: mimeToExtension(mimeType),
      buffer
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseDataImage(value) {
  const match = String(value || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const extension = mimeType.includes("jpeg") || mimeType.includes("jpg")
    ? "jpg"
    : mimeType.includes("webp")
      ? "webp"
      : mimeType.includes("gif")
        ? "gif"
        : "png";
  return {
    mimeType,
    extension,
    buffer: Buffer.from(match[2].replace(/\s+/g, ""), "base64")
  };
}

function extractImageUrl(data, seen = new Set()) {
  if (!data) return "";

  if (typeof data === "string") {
    const text = data.trim();
    if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(text)) return text;
    const embeddedDataUrl = text.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/);
    if (embeddedDataUrl?.[0]) return embeddedDataUrl[0].replace(/\s+/g, "");
    if (/^(iVBORw0KGgo|\/9j\/|UklGR)[A-Za-z0-9+/=\r\n]+$/.test(text) && text.length > 1000) {
      return `data:image/png;base64,${text.replace(/\s+/g, "")}`;
    }
    const markdownImage = text.match(/!\[[^\]]*\]\(((?:https?:\/\/|data:image\/)[^)\s]+)\)/);
    if (markdownImage?.[1]) return markdownImage[1];
    const urlMatch = text.match(/https?:\/\/[^\s"'<>)]*\.(?:png|jpe?g|webp|gif)(?:\?[^\s"'<>)]*)?/i);
    if (urlMatch?.[0]) return urlMatch[0];
    const anyUrlMatch = text.match(/https?:\/\/[^\s"'<>)]{20,}/i);
    if (anyUrlMatch?.[0]) return anyUrlMatch[0];
    try {
      return extractImageUrl(JSON.parse(text), seen);
    } catch {
      return "";
    }
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = extractImageUrl(item, seen);
      if (found) return found;
    }
    return "";
  }

  if (typeof data !== "object") return "";
  if (seen.has(data)) return "";
  seen.add(data);

  const first = Array.isArray(data.data) ? data.data[0] : null;
  const inline = data.inline_data || data.inlineData || data.inlineDataPart || null;
  const mimeType =
    data.mime_type ||
    data.mimeType ||
    data.media_type ||
    data.mediaType ||
    inline?.mime_type ||
    inline?.mimeType ||
    first?.mime_type ||
    first?.mimeType ||
    "image/png";
  const b64 =
    first?.b64_json ||
    first?.base64 ||
    first?.data ||
    data.b64_json ||
    data.image_base64 ||
    data.base64 ||
    (typeof data.data === "string" ? data.data : "") ||
    inline?.data ||
    inline?.base64;
  if (b64 && String(b64).length > 1000 && String(mimeType).startsWith("image/")) {
    return `data:${mimeType};base64,${String(b64).replace(/\s+/g, "")}`;
  }
  if (typeof data.url === "string") return data.url;
  if (typeof data.imageUrl === "string") return data.imageUrl;
  if (typeof data.image_url === "string") return data.image_url;
  if (data.image_url?.url) return data.image_url.url;
  if (data.imageUrl?.url) return data.imageUrl.url;
  if (first?.url) return first.url;
  if (first?.image_url?.url) return first.image_url.url;
  if (first?.imageUrl?.url) return first.imageUrl.url;
  if (Array.isArray(data.images) && data.images[0]?.url) return data.images[0].url;
  if (Array.isArray(data.images) && data.images[0]?.image_url?.url) return data.images[0].image_url.url;
  if (data.output?.[0]?.url) return data.output[0].url;
  if (data.image_url) return extractImageUrl(data.image_url, seen);
  if (data.content) return extractImageUrl(data.content, seen);
  if (data.message) return extractImageUrl(data.message, seen);
  if (data.choices) return extractImageUrl(data.choices, seen);
  for (const [key, value] of Object.entries(data)) {
    if (!/(image|url|data|content|message|choice|output|result|file|base64|b64|part|inline|source)/i.test(key)) continue;
    const found = extractImageUrl(value, seen);
    if (found) return found;
  }
  for (const value of Object.values(data)) {
    const found = extractImageUrl(value, seen);
    if (found) return found;
  }
  return "";
}

function ratioToAgnesSize(ratio) {
  const map = {
    "1:1": "1024x1024",
    "9:16": "768x1365",
    "16:9": "1365x768",
    "3:4": "900x1200"
  };
  return map[ratio] || "1024x1024";
}

function ratioToOpenAiSize(ratio, quality) {
  if (quality === "4k") {
    const map = {
      "1:1": "2880x2880",
      "4:3": "3264x2448",
      "3:4": "2448x3264",
      "3:2": "3504x2336",
      "2:3": "2336x3504",
      "16:9": "3840x2160",
      "9:16": "2160x3840",
      "21:9": "3808x1632"
    };
    return map[ratio] || "2880x2880";
  }

  if (quality === "2k") {
    const map = {
      "1:1": "2048x2048",
      "4:3": "2304x1728",
      "3:4": "1728x2304",
      "3:2": "2496x1664",
      "2:3": "1664x2496",
      "16:9": "2560x1440",
      "9:16": "1440x2560",
      "21:9": "3024x1296"
    };
    return map[ratio] || "2048x2048";
  }

  const map = {
    "1:1": "1024x1024",
    "4:3": "1024x768",
    "3:4": "768x1024",
    "3:2": "1008x672",
    "2:3": "672x1008",
    "16:9": "1024x640",
    "9:16": "640x1024",
    "21:9": "1024x439"
  };
  return map[ratio] || "1024x1024";
}

function sizeToDimensions(size) {
  const [width, height] = size.split("x").map((value) => Number(value));
  return { width: width || 1024, height: height || 1024 };
}

function makeMockImage(item, input, index, modelConfig, note = "") {
  const dimensions = sizeToDimensions(ratioToAgnesSize(input.ratio));
  return {
    id: item.id,
    promptId: item.id,
    url: makeMockSvgDataUrl(item, input, index, modelConfig, note),
    width: dimensions.width,
    height: dimensions.height,
    model: modelConfig.label,
    provider: modelConfig.provider,
    note
  };
}

function makeMockSvgDataUrl(item, input, index, modelConfig, note) {
  const dimensions = sizeToDimensions(ratioToAgnesSize(input.ratio));
  const palette = [
    ["#070918", "#6f4dff", "#35c9ff", "#f5f7ff"],
    ["#0b0d19", "#ff4fd8", "#46d6ff", "#fff4fb"],
    ["#080b18", "#ff9b54", "#7b61ff", "#fff7e8"]
  ][index % 3];
  const title = escapeXml(input.prompt.slice(0, 22));
  const refText = escapeXml(`${input.references.length} reference image${input.references.length === 1 ? "" : "s"}`);
  const modelText = escapeXml(note ? `${modelConfig.label} preview` : modelConfig.label);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="glow" cx="50%" cy="38%" r="62%">
          <stop offset="0%" stop-color="${palette[2]}" stop-opacity="0.55"/>
          <stop offset="48%" stop-color="${palette[1]}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${palette[0]}" stop-opacity="1"/>
        </radialGradient>
        <linearGradient id="title" x1="0%" x2="100%">
          <stop offset="0%" stop-color="${palette[3]}"/>
          <stop offset="45%" stop-color="${palette[1]}"/>
          <stop offset="100%" stop-color="${palette[2]}"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#glow)"/>
      <rect x="88" y="86" width="848" height="852" rx="36" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="4"/>
      <circle cx="734" cy="255" r="134" fill="${palette[1]}" opacity="0.42"/>
      <circle cx="358" cy="462" r="176" fill="${palette[2]}" opacity="0.25"/>
      <rect x="184" y="614" width="656" height="194" rx="28" fill="rgba(4,5,12,0.42)" stroke="rgba(255,255,255,0.18)"/>
      <text x="512" y="684" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="800" fill="url(#title)">${modelText}</text>
      <text x="512" y="743" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="${palette[3]}" opacity="0.88">${title}</text>
      <text x="512" y="790" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="${palette[3]}" opacity="0.7">${input.ratio} | ${refText} | v${index + 1}</text>
    </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function requireUser(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("请先登录");

  const users = await loadUsers();
  const user = Object.values(users.accounts).find((item) => item.token === token);
  if (!user) throw new Error("登录状态已失效，请重新登录");
  return { users, user };
}

function requireAdmin(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || !adminSessions.has(token)) throw new Error("请先登录管理员后台");
  return true;
}

async function loadUserHistory(account, options = {}) {
  return getHistory({
    account,
    limit: options.limit || 20,
    offset: options.offset || 0
  });
}

async function loadAllHistory(limit = 300) {
  return getHistory({ limit });
}

function publicUser(user) {
  return {
    account: user.account,
    credits: user.credits,
    createdAt: user.createdAt
  };
}

function normalizeAccount(value) {
  return String(value || "").trim().toLowerCase().slice(0, 60);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || ""));
}

function normalizeHistoryLimit(value) {
  const number = Number(value || 20);
  if (!Number.isFinite(number)) return 20;
  return Math.min(Math.max(Math.trunc(number), 1), 50);
}

function normalizeHistoryOffset(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(Math.trunc(number), 0);
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(`dreamforge:${password}`).digest("hex");
}

function createToken() {
  return crypto.randomBytes(24).toString("hex");
}

function makeRedeemCode(credits) {
  const amount = Math.max(1, Math.floor(Number(credits || 0)));
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `VIP${amount}-${suffix}`;
}

function normalizeRechargeAmount(value) {
  const amount = Number(value || 0);
  const allowed = [1, 5, 10, 20, 50];
  if (!allowed.includes(amount)) throw new Error("请选择有效充值金额");
  return amount;
}

function makeRechargeTradeNo() {
  return `MJ${Date.now()}${crypto.randomBytes(4).toString("hex").toUpperCase()}`.slice(0, 32);
}

function getWeChatPayConfig() {
  const privateKeyPath = clean(process.env.WECHAT_PAY_PRIVATE_KEY_PATH || "");
  const privateKeyText = String(process.env.WECHAT_PAY_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  const config = {
    appid: clean(process.env.WECHAT_PAY_APPID || process.env.WECHAT_APPID || ""),
    mchid: clean(process.env.WECHAT_PAY_MCHID || ""),
    apiV3Key: String(process.env.WECHAT_PAY_API_V3_KEY || "").trim(),
    certSerialNo: clean(process.env.WECHAT_PAY_CERT_SERIAL_NO || ""),
    privateKeyPath,
    privateKey: privateKeyText,
    notifyUrl: clean(process.env.WECHAT_PAY_NOTIFY_URL || "https://mengjing233.cn/api/payment/wechat/notify"),
    apiBase: clean(process.env.WECHAT_PAY_API_BASE_URL || "https://api.mch.weixin.qq.com").replace(/\/+$/, "")
  };
  const missing = [];
  if (!config.appid) missing.push("WECHAT_PAY_APPID");
  if (!config.mchid) missing.push("WECHAT_PAY_MCHID");
  if (!config.apiV3Key) missing.push("WECHAT_PAY_API_V3_KEY");
  if (!config.certSerialNo) missing.push("WECHAT_PAY_CERT_SERIAL_NO");
  if (!config.privateKey && !config.privateKeyPath) missing.push("WECHAT_PAY_PRIVATE_KEY_PATH");
  return { ...config, missing, configured: missing.length === 0 };
}

function getWeChatPrivateKey(config = getWeChatPayConfig()) {
  if (config.privateKey) return config.privateKey;
  const filePath = path.isAbsolute(config.privateKeyPath)
    ? config.privateKeyPath
    : path.resolve(projectRoot, config.privateKeyPath);
  return fsSync.readFileSync(filePath, "utf-8");
}

async function createWeChatNativeOrder(order, config = getWeChatPayConfig()) {
  const body = {
    appid: config.appid,
    mchid: config.mchid,
    description: "梦境图片积分充值",
    out_trade_no: order.outTradeNo,
    notify_url: config.notifyUrl,
    amount: {
      total: Number(order.amountCents || 0),
      currency: "CNY"
    }
  };
  return weChatPayFetch("POST", "/v3/pay/transactions/native", body, config);
}

async function queryWeChatOrder(outTradeNo, config = getWeChatPayConfig()) {
  const pathWithQuery = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(config.mchid)}`;
  return weChatPayFetch("GET", pathWithQuery, null, config);
}

async function refreshWeChatRechargeOrder(order) {
  const config = getWeChatPayConfig();
  if (!config.configured) return order;
  try {
    const result = await queryWeChatOrder(order.outTradeNo, config);
    const tradeState = result.trade_state || "";
    if (tradeState === "SUCCESS") {
      const paidCents = Number(result.amount?.total || 0);
      if (paidCents !== Number(order.amountCents || 0)) {
        return updateRechargeOrder(order.id, {
          status: "amount_mismatch",
          error: `支付金额不一致：订单 ${order.amountCents} 分，微信 ${paidCents} 分`,
          raw: result
        });
      }
      const settled = settleRechargeOrderPaid({
        id: order.id,
        outTradeNo: order.outTradeNo,
        transactionId: result.transaction_id || "",
        raw: result,
        paidAt: result.success_time ? new Date(result.success_time).toISOString() : new Date().toISOString()
      });
      return settled.order;
    }
    if (["CLOSED", "REVOKED", "PAYERROR"].includes(tradeState)) {
      return updateRechargeOrder(order.id, { status: "failed", error: result.trade_state_desc || tradeState, raw: result });
    }
    return updateRechargeOrder(order.id, { status: "pending", raw: result });
  } catch (error) {
    return updateRechargeOrder(order.id, { error: error.message || String(error) }) || order;
  }
}

async function weChatPayFetch(method, pathWithQuery, body, config = getWeChatPayConfig()) {
  const bodyText = body ? JSON.stringify(body) : "";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const privateKey = getWeChatPrivateKey(config);
  const message = `${method}\n${pathWithQuery}\n${timestamp}\n${nonce}\n${bodyText}\n`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(message, "utf-8"), privateKey).toString("base64");
  const authorization =
    `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchid}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.certSerialNo}"`;
  const response = await fetch(`${config.apiBase}${pathWithQuery}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authorization
    },
    body: bodyText || undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.code || `微信支付请求失败：${response.status}`);
  }
  return data;
}

function decryptWeChatNotify(body = {}) {
  const resource = body.resource || {};
  const ciphertext = Buffer.from(String(resource.ciphertext || ""), "base64");
  if (!ciphertext.length) throw new Error("微信通知缺少密文");
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const data = ciphertext.subarray(0, ciphertext.length - 16);
  const config = getWeChatPayConfig();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(config.apiV3Key, "utf-8"),
    Buffer.from(String(resource.nonce || ""), "utf-8")
  );
  decipher.setAuthTag(authTag);
  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(String(resource.associated_data), "utf-8"));
  }
  const decoded = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf-8");
  return JSON.parse(decoded);
}

async function loadUsers() {
  return getUserStore();
}

async function saveUsers(users) {
  saveUserStore(users);
}

async function loadRedeemCodes() {
  const store = getRedeemStore();
  if (Object.keys(store.codes || {}).length) return store;

  const jsonStore = await readJson(redeemCodesPath, null);
  if (jsonStore) {
    saveRedeemStore(jsonStore);
    return getRedeemStore();
  }

  const initialStore = {
    codes: {
      DEMO10: { credits: 10, note: "本地测试兑换码", usedBy: "", usedAt: "" },
      TEST20: { credits: 20, note: "本地测试兑换码", usedBy: "", usedAt: "" },
      VIP50: { credits: 50, note: "本地测试兑换码", usedBy: "", usedAt: "" }
    }
  };
  saveRedeemStore(initialStore);
  return initialStore;
}

async function saveRedeemCodes(store) {
  saveRedeemStore(store);
  await writeJson(redeemCodesPath, store);
}

async function readJson(filePath, fallback) {
  try {
    const raw = (await fs.readFile(filePath, "utf-8")).replace(/^\uFEFF/, "");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function safeFileName(value) {
  return String(value || "reference.png").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").slice(0, 120);
}

app.use(express.static(distDir, {
  maxAge: "0",
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-store");
    }
  }
}));

app.get(/^(?!\/api).*/, async (_req, res, next) => {
  try {
    await fs.access(path.join(distDir, "index.html"));
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(distDir, "index.html"));
  } catch (error) {
    next();
  }
});

const host = process.env.HOST || "127.0.0.1";

app.listen(port, host, () => {
  console.log(`DreamForge listening on http://${host}:${port}`);
});
