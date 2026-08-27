import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

let db;

export function initDatabase(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      account TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      credits INTEGER NOT NULL DEFAULT 0,
      token TEXT,
      ip TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account TEXT NOT NULL,
      type TEXT NOT NULL,
      credits INTEGER,
      cost INTEGER,
      code TEXT,
      model TEXT,
      quality TEXT,
      prompt TEXT,
      ip TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS redeem_codes (
      code TEXT PRIMARY KEY,
      credits INTEGER NOT NULL,
      note TEXT,
      used_by TEXT,
      used_at TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      initial_credits INTEGER NOT NULL DEFAULT 0,
      max_uses INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      used_by_json TEXT,
      note TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      account TEXT NOT NULL,
      model TEXT,
      model_label TEXT,
      provider TEXT,
      credit_cost INTEGER,
      remaining_credits INTEGER,
      input_json TEXT,
      reference_plan_json TEXT,
      prompts_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      account TEXT NOT NULL,
      image_index INTEGER NOT NULL,
      url TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      model TEXT,
      provider TEXT,
      prompt TEXT,
      ratio TEXT,
      style TEXT,
      references_count INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account TEXT,
      action TEXT NOT NULL,
      method TEXT,
      path TEXT,
      status INTEGER,
      ip TEXT,
      source_port TEXT,
      target TEXT,
      user_agent TEXT,
      detail_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact TEXT,
      type TEXT,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      handled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS generation_failures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account TEXT,
      model TEXT,
      quality TEXT,
      ratio TEXT,
      prompt TEXT,
      references_count INTEGER NOT NULL DEFAULT 0,
      stage TEXT,
      cost INTEGER NOT NULL DEFAULT 0,
      upstream_succeeded INTEGER NOT NULL DEFAULT 0,
      points_refunded INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      input_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generation_requests (
      id TEXT PRIMARY KEY,
      account TEXT NOT NULL,
      model TEXT,
      model_label TEXT,
      quality TEXT,
      ratio TEXT,
      count INTEGER NOT NULL DEFAULT 1,
      references_count INTEGER NOT NULL DEFAULT 0,
      cost INTEGER NOT NULL DEFAULT 0,
      prompt TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      stage TEXT,
      error TEXT,
      job_id TEXT,
      channel_attempts_json TEXT,
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS api_channels (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL DEFAULT 'gpt-image-2',
      tier TEXT NOT NULL,
      role TEXT NOT NULL,
      name TEXT,
      api_base TEXT,
      api_key TEXT,
      model TEXT,
      response_format TEXT,
      enabled INTEGER NOT NULL DEFAULT 0,
      timeout_ms INTEGER NOT NULL DEFAULT 600000,
      note TEXT,
      last_test_status TEXT,
      last_test_message TEXT,
      last_test_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      title TEXT,
      content TEXT,
      button_label TEXT,
      title_en TEXT,
      content_en TEXT,
      button_label_en TEXT,
      version TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recharge_orders (
      id TEXT PRIMARY KEY,
      account TEXT NOT NULL,
      provider TEXT NOT NULL,
      out_trade_no TEXT NOT NULL UNIQUE,
      amount_cents INTEGER NOT NULL,
      credits INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'created',
      code_url TEXT,
      qr_data_url TEXT,
      transaction_id TEXT,
      error TEXT,
      raw_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      paid_at TEXT
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_images_account_created_at ON images(account, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_generation_requests_status_started ON generation_requests(status, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_generation_requests_started ON generation_requests(started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_api_channels_provider_tier ON api_channels(provider, tier, role);
    CREATE INDEX IF NOT EXISTS idx_recharge_orders_account_created ON recharge_orders(account, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_recharge_orders_status_created ON recharge_orders(status, created_at DESC);
  `);
  ensureImageAssetColumns();
  ensureGenerationRequestColumns();
  ensureAnnouncementColumns();
  ensureCreditLogsColumns();
  return db;
}

function ensureImageAssetColumns() {
  const database = getDatabase();
  const columns = new Set(database.prepare("PRAGMA table_info(images)").all().map((row) => row.name));
  const additions = [
    ["model_id", "TEXT"],
    ["prompt_template", "TEXT"],
    ["final_prompt", "TEXT"],
    ["negative_prompt", "TEXT"],
    ["reference_plan_json", "TEXT"],
    ["asset_status", "TEXT NOT NULL DEFAULT '候选'"],
    ["quality_score", "INTEGER NOT NULL DEFAULT 0"],
    ["review_notes", "TEXT"],
    ["reusable_pattern", "TEXT"],
    ["failure_reason", "TEXT"],
    ["thumbnail_url", "TEXT"]
  ];

  for (const [name, type] of additions) {
    if (!columns.has(name)) {
      database.exec(`ALTER TABLE images ADD COLUMN ${name} ${type}`);
    }
  }
}

function ensureGenerationRequestColumns() {
  const database = getDatabase();
  const columns = new Set(database.prepare("PRAGMA table_info(generation_requests)").all().map((row) => row.name));
  const additions = [["channel_attempts_json", "TEXT"]];

  for (const [name, type] of additions) {
    if (!columns.has(name)) {
      database.exec(`ALTER TABLE generation_requests ADD COLUMN ${name} ${type}`);
    }
  }
}

function ensureAnnouncementColumns() {
  const database = getDatabase();
  const columns = new Set(database.prepare("PRAGMA table_info(announcements)").all().map((row) => row.name));
  const additions = [
    ["title_en", "TEXT"],
    ["content_en", "TEXT"],
    ["button_label_en", "TEXT"]
  ];

  for (const [name, type] of additions) {
    if (!columns.has(name)) {
      database.exec(`ALTER TABLE announcements ADD COLUMN ${name} ${type}`);
    }
  }
}

function ensureCreditLogsColumns() {
  const database = getDatabase();
  // 确保 credit_logs 表有 ip 字段
  const columns = new Set(database.prepare("PRAGMA table_info(credit_logs)").all().map((row) => row.name));
  const additions = [["ip", "TEXT"]];

  for (const [name, type] of additions) {
    if (!columns.has(name)) {
      database.exec(`ALTER TABLE credit_logs ADD COLUMN ${name} ${type}`);
    }
  }

  // 确保 users 表有 ip 字段
  const userColumns = new Set(database.prepare("PRAGMA table_info(users)").all().map((row) => row.name));
  if (!userColumns.has("ip")) {
    database.exec(`ALTER TABLE users ADD COLUMN ip TEXT`);
  }
}

function getChinaDayRange(date = new Date()) {
  const chinaOffsetMs = 8 * 60 * 60 * 1000;
  const chinaDate = new Date(date.getTime() + chinaOffsetMs);
  const startUtcMs = Date.UTC(
    chinaDate.getUTCFullYear(),
    chinaDate.getUTCMonth(),
    chinaDate.getUTCDate()
  ) - chinaOffsetMs;
  return {
    startUtc: new Date(startUtcMs).toISOString(),
    endUtc: new Date(startUtcMs + 24 * 60 * 60 * 1000).toISOString()
  };
}

export function getDatabase() {
  if (!db) throw new Error("Database has not been initialized");
  return db;
}

export function getUserStore() {
  const rows = getDatabase().prepare("SELECT * FROM users ORDER BY created_at ASC").all();
  const accounts = {};
  for (const row of rows) {
    const logs = getDatabase()
      .prepare("SELECT * FROM credit_logs WHERE account = ? ORDER BY created_at ASC, id ASC")
      .all(row.account)
      .map(dbLogToPublicLog);
    accounts[row.account] = dbUserToRuntimeUser(row, logs);
  }
  return { accounts };
}

export function saveUserStore(store) {
  const database = getDatabase();
  database.exec("BEGIN");
  try {
    for (const user of Object.values(store.accounts || {})) {
      upsertUser(user);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function upsertUser(user) {
  getDatabase()
    .prepare(
      `INSERT INTO users (account, password_hash, credits, token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(account) DO UPDATE SET
         password_hash = excluded.password_hash,
         credits = excluded.credits,
         token = excluded.token,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`
    )
    .run(
      user.account,
      user.passwordHash,
      Number(user.credits || 0),
      user.token || "",
      user.createdAt || new Date().toISOString(),
      user.updatedAt || new Date().toISOString()
    );
}

export function insertCreditLog(account, log) {
  getDatabase()
    .prepare(
      `INSERT INTO credit_logs (account, type, credits, cost, code, model, quality, prompt, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      account,
      log.type || "",
      log.credits ?? null,
      log.cost ?? null,
      log.code || "",
      log.model || "",
      log.quality || "",
      log.prompt || "",
      log.ip || "",
      log.createdAt || new Date().toISOString()
    );
}

export function adjustUserCredits(account, delta) {
  const now = new Date().toISOString();
  getDatabase()
    .prepare("UPDATE users SET credits = credits + ?, updated_at = ? WHERE account = ?")
    .run(Number(delta || 0), now, account);
  const row = getDatabase().prepare("SELECT * FROM users WHERE account = ?").get(account);
  if (!row) throw new Error("User not found");
  const logs = getDatabase()
    .prepare("SELECT * FROM credit_logs WHERE account = ? ORDER BY created_at ASC, id ASC")
    .all(account)
    .map(dbLogToPublicLog);
  return dbUserToRuntimeUser(row, logs);
}

export function setUserCreditsWithManualLog({ account, targetCredits, note = "", admin = "admin" } = {}) {
  const target = Math.floor(Number(targetCredits));
  if (!Number.isInteger(target) || target < 0) {
    throw new Error("目标积分必须是大于或等于 0 的整数");
  }

  const database = getDatabase();
  const now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    const current = database.prepare("SELECT * FROM users WHERE account = ?").get(account);
    if (!current) throw new Error("用户不存在");

    const previousCredits = Number(current.credits || 0);
    const delta = target - previousCredits;
    if (!delta) throw new Error("目标积分与当前余额相同，无需调整");

    database
      .prepare("UPDATE users SET credits = ?, updated_at = ? WHERE account = ?")
      .run(target, now, account);
    database
      .prepare(
        `INSERT INTO credit_logs (account, type, credits, cost, code, model, quality, prompt, ip, created_at)
         VALUES (?, 'manual', ?, NULL, ?, 'admin-adjustment', 'set-balance', ?, ?, ?)`
      )
      .run(
        account,
        delta,
        `admin:${String(admin || "admin").slice(0, 80)}`,
        `目标余额 ${target}，原余额 ${previousCredits}。${String(note || "").trim()}`,
        "",
        now
      );

    const row = database.prepare("SELECT * FROM users WHERE account = ?").get(account);
    const logs = database
      .prepare("SELECT * FROM credit_logs WHERE account = ? ORDER BY created_at ASC, id ASC")
      .all(account)
      .map(dbLogToPublicLog);
    database.exec("COMMIT");
    return {
      user: dbUserToRuntimeUser(row, logs),
      previousCredits,
      targetCredits: target,
      delta,
      adjustedAt: now
    };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function insertOperationLog(log) {
  getDatabase()
    .prepare(
      `INSERT INTO operation_logs
       (account, action, method, path, status, ip, source_port, target, user_agent, detail_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      log.account || "",
      log.action || "api_request",
      log.method || "",
      log.path || "",
      Number(log.status || 0),
      log.ip || "",
      log.sourcePort || "",
      log.target || "",
      log.userAgent || "",
      JSON.stringify(log.detail || {}),
      log.createdAt || new Date().toISOString()
    );
}

export function getOperationLogs({ limit = 300 } = {}) {
  const rows = getDatabase()
    .prepare("SELECT * FROM operation_logs ORDER BY created_at DESC, id DESC LIMIT ?")
    .all(limit);
  return rows.map((row) => ({
    id: row.id,
    account: row.account || "",
    action: row.action,
    method: row.method || "",
    path: row.path || "",
    status: Number(row.status || 0),
    ip: row.ip || "",
    sourcePort: row.source_port || "",
    target: row.target || "",
    userAgent: row.user_agent || "",
    detail: safeJson(row.detail_json, {}),
    createdAt: row.created_at
  }));
}

export function insertGenerationFailure(failure) {
  getDatabase()
    .prepare(
      `INSERT INTO generation_failures
       (account, model, quality, ratio, prompt, references_count, stage, cost, upstream_succeeded, points_refunded, error, input_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      failure.account || "",
      failure.model || "",
      failure.quality || "",
      failure.ratio || "",
      String(failure.prompt || "").slice(0, 1200),
      Number(failure.referencesCount || 0),
      failure.stage || "",
      Number(failure.cost || 0),
      failure.upstreamSucceeded ? 1 : 0,
      Number(failure.pointsRefunded || 0),
      String(failure.error || "").slice(0, 1600),
      JSON.stringify(failure.input || {}),
      failure.createdAt || new Date().toISOString()
    );
}

export function getGenerationFailures({ limit = 200 } = {}) {
  const rows = getDatabase()
    .prepare("SELECT * FROM generation_failures ORDER BY created_at DESC, id DESC LIMIT ?")
    .all(limit);
  return rows.map((row) => ({
    id: row.id,
    account: row.account || "",
    model: row.model || "",
    quality: row.quality || "",
    ratio: row.ratio || "",
    prompt: row.prompt || "",
    referencesCount: Number(row.references_count || 0),
    stage: row.stage || "",
    cost: Number(row.cost || 0),
    upstreamSucceeded: Boolean(row.upstream_succeeded),
    pointsRefunded: Number(row.points_refunded || 0),
    error: row.error || "",
    input: safeJson(row.input_json, {}),
    createdAt: row.created_at
  }));
}

export function insertGenerationRequest(request) {
  const now = new Date().toISOString();
  getDatabase()
    .prepare(
      `INSERT OR REPLACE INTO generation_requests
       (id, account, model, model_label, quality, ratio, count, references_count, cost, prompt, status, stage, error, job_id, channel_attempts_json, started_at, updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      request.id,
      request.account || "",
      request.model || "",
      request.modelLabel || "",
      request.quality || "",
      request.ratio || "",
      Number(request.count || 1),
      Number(request.referencesCount || 0),
      Number(request.cost || 0),
      String(request.prompt || "").slice(0, 1200),
      request.status || "pending",
      request.stage || "submitted",
      request.error || "",
      request.jobId || "",
      JSON.stringify(normalizeChannelAttempts(request.channelAttempts)),
      request.startedAt || now,
      request.updatedAt || now,
      request.completedAt || ""
    );
}

export function updateGenerationRequest(id, patch = {}) {
  if (!id) return;
  const current = getDatabase().prepare("SELECT * FROM generation_requests WHERE id = ?").get(id);
  if (!current) return;
  const next = {
    status: patch.status ?? current.status,
    stage: patch.stage ?? current.stage,
    error: patch.error ?? current.error,
    jobId: patch.jobId ?? current.job_id,
    channelAttempts: patch.channelAttempts === undefined ? safeJson(current.channel_attempts_json, []) : normalizeChannelAttempts(patch.channelAttempts),
    updatedAt: patch.updatedAt || new Date().toISOString(),
    completedAt: patch.completedAt ?? current.completed_at
  };
  getDatabase()
    .prepare(
      `UPDATE generation_requests
       SET status = ?, stage = ?, error = ?, job_id = ?, channel_attempts_json = ?, updated_at = ?, completed_at = ?
       WHERE id = ?`
    )
    .run(
      next.status,
      next.stage,
      String(next.error || "").slice(0, 1600),
      next.jobId || "",
      JSON.stringify(next.channelAttempts),
      next.updatedAt,
      next.completedAt || "",
      id
    );
}

export function getGenerationRequests({ limit = 100 } = {}) {
  const rows = getDatabase()
    .prepare("SELECT * FROM generation_requests ORDER BY started_at DESC LIMIT ?")
    .all(limit);
  return rows.map((row) => ({
    id: row.id,
    account: row.account || "",
    model: row.model || "",
    modelLabel: row.model_label || row.model || "",
    quality: row.quality || "",
    ratio: row.ratio || "",
    count: Number(row.count || 1),
    referencesCount: Number(row.references_count || 0),
    cost: Number(row.cost || 0),
    prompt: row.prompt || "",
    status: row.status || "pending",
    stage: row.stage || "",
    error: row.error || "",
    jobId: row.job_id || "",
    channelAttempts: normalizeChannelAttempts(safeJson(row.channel_attempts_json, [])),
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || ""
  }));
}

export function insertReport(report) {
  const result = getDatabase()
    .prepare(
      `INSERT INTO reports (contact, type, content, status, ip, user_agent, created_at, handled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      report.contact || "",
      report.type || "other",
      report.content || "",
      report.status || "pending",
      report.ip || "",
      report.userAgent || "",
      report.createdAt || new Date().toISOString(),
      report.handledAt || ""
    );
  return result.lastInsertRowid;
}

export function getReports({ limit = 200 } = {}) {
  const rows = getDatabase()
    .prepare("SELECT * FROM reports ORDER BY created_at DESC, id DESC LIMIT ?")
    .all(limit);
  return rows.map((row) => ({
    id: row.id,
    contact: row.contact || "",
    type: row.type || "",
    content: row.content || "",
    status: row.status || "pending",
    ip: row.ip || "",
    userAgent: row.user_agent || "",
    createdAt: row.created_at,
    handledAt: row.handled_at || ""
  }));
}

export function getRedeemStore() {
  const rows = getDatabase().prepare("SELECT * FROM redeem_codes ORDER BY code ASC").all();
  const codes = {};
  for (const row of rows) {
    codes[row.code] = {
      credits: Number(row.credits || 0),
      note: row.note || "",
      usedBy: row.used_by || "",
      usedAt: row.used_at || "",
      createdAt: row.created_at || ""
    };
  }
  return { codes };
}

export function saveRedeemStore(store) {
  const database = getDatabase();
  database.exec("BEGIN");
  try {
    for (const [code, entry] of Object.entries(store.codes || {})) {
      upsertRedeemCode(code, entry);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function upsertRedeemCode(code, entry) {
  getDatabase()
    .prepare(
      `INSERT INTO redeem_codes (code, credits, note, used_by, used_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET
         credits = excluded.credits,
         note = excluded.note,
         used_by = excluded.used_by,
         used_at = excluded.used_at,
         created_at = excluded.created_at`
    )
    .run(
      code,
      Number(entry.credits || 0),
      entry.note || "",
      entry.usedBy || "",
      entry.usedAt || "",
      entry.createdAt || ""
    );
}

export function getInviteStore() {
  const rows = getDatabase().prepare("SELECT * FROM invite_codes ORDER BY created_at DESC, code ASC").all();
  const codes = {};
  for (const row of rows) {
    codes[row.code] = {
      initialCredits: Number(row.initial_credits || 0),
      maxUses: Number(row.max_uses || 1),
      usedCount: Number(row.used_count || 0),
      usedBy: safeJson(row.used_by_json, []),
      note: row.note || "",
      createdAt: row.created_at || ""
    };
  }
  return { codes };
}

export function upsertInviteCode(code, entry) {
  getDatabase()
    .prepare(
      `INSERT INTO invite_codes (code, initial_credits, max_uses, used_count, used_by_json, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET
         initial_credits = excluded.initial_credits,
         max_uses = excluded.max_uses,
         used_count = excluded.used_count,
         used_by_json = excluded.used_by_json,
         note = excluded.note,
         created_at = excluded.created_at`
    )
    .run(
      code,
      Number(entry.initialCredits || 0),
      Number(entry.maxUses || 1),
      Number(entry.usedCount || 0),
      JSON.stringify(entry.usedBy || []),
      entry.note || "",
      entry.createdAt || new Date().toISOString()
    );
}

function writeJobRecord(database, job) {
  database
    .prepare(
      `INSERT OR REPLACE INTO jobs
       (id, account, model, model_label, provider, credit_cost, remaining_credits, input_json, reference_plan_json, prompts_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      job.id,
      String(job.account || ""),
      job.model || "",
      job.modelLabel || "",
      job.provider || "",
      Number(job.creditCost || 0),
      Number(job.remainingCredits || 0),
      JSON.stringify(job.input || {}),
      JSON.stringify(job.referencePlan || null),
      JSON.stringify(job.prompts || []),
      job.createdAt || new Date().toISOString()
    );

  for (const [index, image] of (job.images || []).entries()) {
    const promptRecord = (job.prompts || [])[index] || (job.prompts || [])[0] || {};
    database
      .prepare(
        `INSERT OR REPLACE INTO images
         (id, job_id, account, image_index, url, width, height, model, provider, prompt, ratio, style, references_count, created_at,
          model_id, prompt_template, final_prompt, negative_prompt, reference_plan_json, asset_status, quality_score, review_notes, reusable_pattern, failure_reason, thumbnail_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        `${job.id}_${index + 1}`,
        job.id,
        String(job.account || ""),
        index,
        image.url || "",
        Number(image.width || 0),
        Number(image.height || 0),
        job.modelLabel || job.model || "",
        job.provider || "",
        job.input?.prompt || "",
        job.input?.ratio || "",
        job.input?.style || "",
        job.input?.references?.length || 0,
        job.createdAt || new Date().toISOString(),
        job.model || "",
        job.input?.promptTemplate || "custom",
        promptRecord.prompt || "",
        promptRecord.negativePrompt || "",
        JSON.stringify(job.referencePlan || null),
        "候选",
        0,
        "",
        "",
        "",
        image.thumbnailUrl || image.url || ""
      );
  }
}

export function saveJobRecord(job) {
  const database = getDatabase();
  database.exec("BEGIN");
  try {
    writeJobRecord(database, job);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function settleGenerationSuccess({ job, account, cost, log, requestId, completedAt }) {
  const database = getDatabase();
  const now = completedAt || new Date().toISOString();
  let settledJob = job;
  database.exec("BEGIN IMMEDIATE");
  try {
    const currentUser = database.prepare("SELECT * FROM users WHERE account = ?").get(account);
    if (!currentUser) throw new Error("User not found");
    const currentCredits = Number(currentUser.credits || 0);
    const chargeCost = Number(cost || 0);
    if (currentCredits < chargeCost) {
      throw new Error(`Insufficient credits during settlement: need ${chargeCost}, current ${currentCredits}`);
    }

    settledJob = {
      ...job,
      remainingCredits: currentCredits - chargeCost
    };
    writeJobRecord(database, settledJob);

    database
      .prepare("UPDATE users SET credits = credits - ?, updated_at = ? WHERE account = ?")
      .run(chargeCost, now, account);

    database
      .prepare(
        `INSERT INTO credit_logs (account, type, credits, cost, code, model, quality, prompt, ip, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        account,
        log.type || "generate",
        log.credits ?? null,
        log.cost ?? chargeCost,
        log.code || "",
        log.model || "",
        log.quality || "",
        log.prompt || "",
        log.ip || "",
        log.createdAt || now
      );

    if (requestId) {
      database
        .prepare(
          `UPDATE generation_requests
           SET status = ?, stage = ?, error = ?, job_id = ?, updated_at = ?, completed_at = ?
           WHERE id = ?`
        )
        .run("success", "completed", "", settledJob.id || "", now, now, requestId);
    }

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  const row = database.prepare("SELECT * FROM users WHERE account = ?").get(account);
  const logs = database
    .prepare("SELECT * FROM credit_logs WHERE account = ? ORDER BY created_at ASC, id ASC")
    .all(account)
    .map(dbLogToPublicLog);
  return { job: settledJob, user: dbUserToRuntimeUser(row, logs) };
}

export function getHistory({ account = "", limit = 100, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit || 100), 1), 300);
  const safeOffset = Math.max(Number(offset || 0), 0);
  const sql = account
    ? `SELECT images.*, jobs.credit_cost AS job_credit_cost, jobs.input_json AS job_input_json,
        jobs.model AS job_model_id, jobs.model_label AS job_model_label,
        job_counts.image_count AS job_image_count
       FROM images
       LEFT JOIN jobs ON jobs.id = images.job_id
       LEFT JOIN (
         SELECT job_id, COUNT(*) AS image_count
         FROM images
         GROUP BY job_id
       ) AS job_counts ON job_counts.job_id = images.job_id
       WHERE images.account = ?
       ORDER BY images.created_at DESC
       LIMIT ? OFFSET ?`
    : `SELECT images.*, jobs.credit_cost AS job_credit_cost, jobs.input_json AS job_input_json,
        jobs.model AS job_model_id, jobs.model_label AS job_model_label,
        job_counts.image_count AS job_image_count
       FROM images
       LEFT JOIN jobs ON jobs.id = images.job_id
       LEFT JOIN (
         SELECT job_id, COUNT(*) AS image_count
         FROM images
         GROUP BY job_id
       ) AS job_counts ON job_counts.job_id = images.job_id
       ORDER BY images.created_at DESC
       LIMIT ? OFFSET ?`;
  const rows = account
    ? getDatabase().prepare(sql).all(account, safeLimit, safeOffset)
    : getDatabase().prepare(sql).all(safeLimit, safeOffset);
  return rows.map(dbImageToHistory);
}

export function getApiChannels({ provider = "gpt-image-2", tier = "" } = {}) {
  const database = getDatabase();
  const params = [provider];
  let where = "provider = ?";
  if (tier) {
    where += " AND tier = ?";
    params.push(tier);
  }

  return database
    .prepare(`SELECT * FROM api_channels WHERE ${where} ORDER BY tier ASC, role ASC`)
    .all(...params)
    .map(dbApiChannelToRuntime);
}

export function getAnnouncement() {
  const row = getDatabase().prepare("SELECT * FROM announcements WHERE id = ?").get("main");
  if (!row) return defaultAnnouncement();
  return dbAnnouncementToRuntime(row);
}

export function getAnnouncementHistory({ limit = 50 } = {}) {
  const database = getDatabase();
  const current = getAnnouncement();
  const rows = database
    .prepare("SELECT * FROM announcements WHERE id != ? AND (content != '' OR content_en != '') ORDER BY updated_at DESC LIMIT ?")
    .all("main", Number(limit || 50))
    .map(dbAnnouncementToRuntime);
  const items = current.content || current.contentEn ? [current, ...rows] : rows;
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.version}|${item.title}|${item.content}|${item.titleEn}|${item.contentEn}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, Number(limit || 50));
}

export function upsertAnnouncement(raw = {}) {
  const database = getDatabase();
  const current = getAnnouncement();
  const now = new Date().toISOString();
  const next = normalizeAnnouncementInput(raw, current);
  database.exec("BEGIN");
  try {
    database
      .prepare(
        `INSERT INTO announcements (id, enabled, title, content, button_label, title_en, content_en, button_label_en, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           enabled = excluded.enabled,
           title = excluded.title,
           content = excluded.content,
           button_label = excluded.button_label,
           title_en = excluded.title_en,
           content_en = excluded.content_en,
           button_label_en = excluded.button_label_en,
           version = excluded.version,
           updated_at = excluded.updated_at`
      )
      .run(
        "main",
        next.enabled ? 1 : 0,
        next.title,
        next.content,
        next.buttonLabel,
        next.titleEn,
        next.contentEn,
        next.buttonLabelEn,
        next.version,
        current.createdAt || now,
        now
      );

    if (next.content || next.contentEn) {
      database
        .prepare(
          `INSERT INTO announcements (id, enabled, title, content, button_label, title_en, content_en, button_label_en, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          `history_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
          next.enabled ? 1 : 0,
          next.title,
          next.content,
          next.buttonLabel,
          next.titleEn,
          next.contentEn,
          next.buttonLabelEn,
          next.version,
          now,
          now
        );
      database.exec(
        `DELETE FROM announcements
         WHERE id != 'main'
           AND id NOT IN (
             SELECT id FROM announcements
             WHERE id != 'main'
             ORDER BY updated_at DESC
             LIMIT 100
           )`
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return getAnnouncement();
}

export function createRechargeOrder(order = {}) {
  const now = order.createdAt || new Date().toISOString();
  getDatabase()
    .prepare(
      `INSERT INTO recharge_orders
       (id, account, provider, out_trade_no, amount_cents, credits, status, code_url, qr_data_url, transaction_id, error, raw_json, created_at, updated_at, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      order.id,
      order.account || "",
      order.provider || "wechat",
      order.outTradeNo || "",
      Number(order.amountCents || 0),
      Number(order.credits || 0),
      order.status || "created",
      order.codeUrl || "",
      order.qrDataUrl || "",
      order.transactionId || "",
      order.error || "",
      JSON.stringify(order.raw || {}),
      now,
      now,
      order.paidAt || ""
    );
  return getRechargeOrder(order.id);
}

export function updateRechargeOrder(id, patch = {}) {
  const current = getDatabase().prepare("SELECT * FROM recharge_orders WHERE id = ?").get(id);
  if (!current) return null;
  const next = {
    status: patch.status ?? current.status,
    credits: patch.credits ?? current.credits,
    codeUrl: patch.codeUrl ?? current.code_url,
    qrDataUrl: patch.qrDataUrl ?? current.qr_data_url,
    transactionId: patch.transactionId ?? current.transaction_id,
    error: patch.error ?? current.error,
    raw: patch.raw ?? safeJson(current.raw_json, {}),
    paidAt: patch.paidAt ?? current.paid_at,
    updatedAt: patch.updatedAt || new Date().toISOString()
  };
  getDatabase()
    .prepare(
      `UPDATE recharge_orders
       SET status = ?, credits = ?, code_url = ?, qr_data_url = ?, transaction_id = ?, error = ?, raw_json = ?, updated_at = ?, paid_at = ?
       WHERE id = ?`
    )
    .run(
      next.status,
      Number(next.credits || 0),
      next.codeUrl || "",
      next.qrDataUrl || "",
      next.transactionId || "",
      String(next.error || "").slice(0, 1200),
      JSON.stringify(next.raw || {}),
      next.updatedAt,
      next.paidAt || "",
      id
    );
  return getRechargeOrder(id);
}

export function confirmManualRechargeOrder({ id = "", credits = 0, note = "", admin = "" } = {}) {
  const database = getDatabase();
  const now = new Date().toISOString();
  const finalCredits = Math.floor(Number(credits || 0));
  if (!id) throw new Error("Recharge order id is required");
  if (!Number.isFinite(finalCredits) || finalCredits <= 0) throw new Error("确认积分必须大于 0");

  let order;
  let user;
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database.prepare("SELECT * FROM recharge_orders WHERE id = ?").get(id);
    if (!row) throw new Error("Recharge order not found");
    order = dbRechargeOrderToRuntime(row);
    if (order.status === "paid") throw new Error("该充值订单已确认到账，不能重复入账");
    if (!["created", "pending"].includes(order.status)) throw new Error(`该订单当前状态为 ${order.status}，不能确认到账`);

    const raw = {
      ...(order.raw || {}),
      manualConfirm: {
        admin: String(admin || "").slice(0, 80),
        note: String(note || "").slice(0, 500),
        originalCredits: Number(order.credits || 0),
        confirmedCredits: finalCredits,
        confirmedAt: now
      }
    };

    database
      .prepare(
        `UPDATE recharge_orders
         SET status = ?, credits = ?, transaction_id = ?, raw_json = ?, updated_at = ?, paid_at = ?
         WHERE id = ? AND status != 'paid'`
      )
      .run("paid", finalCredits, `manual_${now.replace(/\D/g, "").slice(0, 14)}`, JSON.stringify(raw), now, now, order.id);
    database
      .prepare("UPDATE users SET credits = credits + ?, updated_at = ? WHERE account = ?")
      .run(finalCredits, now, order.account);
    database
      .prepare(
        `INSERT INTO credit_logs (account, type, credits, cost, code, model, quality, prompt, ip, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        order.account,
        "recharge",
        finalCredits,
        null,
        order.outTradeNo,
        order.provider || "wechat_manual",
        "",
        `微信人工充值 ${formatAmountYuan(order.amountCents)} 元，确认 ${finalCredits} 积分${note ? `；${String(note).slice(0, 120)}` : ""}`,
        "",
        now
      );

    const userRow = database.prepare("SELECT * FROM users WHERE account = ?").get(order.account);
    const logs = database
      .prepare("SELECT * FROM credit_logs WHERE account = ? ORDER BY created_at ASC, id ASC")
      .all(order.account)
      .map(dbLogToPublicLog);
    user = dbUserToRuntimeUser(userRow, logs);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return { order: getRechargeOrder(id), user };
}

export function settleRechargeOrderPaid({ id = "", outTradeNo = "", transactionId = "", raw = {}, paidAt = "" } = {}) {
  const database = getDatabase();
  const now = paidAt || new Date().toISOString();
  let order;
  let user;
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = id
      ? database.prepare("SELECT * FROM recharge_orders WHERE id = ?").get(id)
      : database.prepare("SELECT * FROM recharge_orders WHERE out_trade_no = ?").get(outTradeNo);
    if (!row) throw new Error("Recharge order not found");
    order = dbRechargeOrderToRuntime(row);
    if (order.status !== "paid") {
      database
        .prepare(
          `UPDATE recharge_orders
           SET status = ?, transaction_id = ?, raw_json = ?, updated_at = ?, paid_at = ?
           WHERE id = ?`
        )
        .run("paid", transactionId || order.transactionId || "", JSON.stringify(raw || {}), now, now, order.id);
      database
        .prepare("UPDATE users SET credits = credits + ?, updated_at = ? WHERE account = ?")
        .run(Number(order.credits || 0), now, order.account);
      database
        .prepare(
          `INSERT INTO credit_logs (account, type, credits, cost, code, model, quality, prompt, ip, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          order.account,
          "recharge",
          Number(order.credits || 0),
          null,
          order.outTradeNo,
          "wechat",
          "",
          `微信充值 ${formatAmountYuan(order.amountCents)} 元`,
          "",
          now
        );
    }
    const userRow = database.prepare("SELECT * FROM users WHERE account = ?").get(order.account);
    const logs = database
      .prepare("SELECT * FROM credit_logs WHERE account = ? ORDER BY created_at ASC, id ASC")
      .all(order.account)
      .map(dbLogToPublicLog);
    user = dbUserToRuntimeUser(userRow, logs);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return { order: getRechargeOrder(order.id), user };
}

export function getRechargeOrder(id) {
  const row = getDatabase().prepare("SELECT * FROM recharge_orders WHERE id = ?").get(id);
  return row ? dbRechargeOrderToRuntime(row) : null;
}

export function getRechargeOrderByOutTradeNo(outTradeNo) {
  const row = getDatabase().prepare("SELECT * FROM recharge_orders WHERE out_trade_no = ?").get(outTradeNo);
  return row ? dbRechargeOrderToRuntime(row) : null;
}

export function getRechargeOrders({ account = "", limit = 100 } = {}) {
  const rows = account
    ? getDatabase()
        .prepare("SELECT * FROM recharge_orders WHERE account = ? ORDER BY created_at DESC LIMIT ?")
        .all(account, Number(limit || 100))
    : getDatabase()
        .prepare("SELECT * FROM recharge_orders ORDER BY created_at DESC LIMIT ?")
        .all(Number(limit || 100));
  return rows.map(dbRechargeOrderToRuntime);
}

export function getUserCreditTrace(account) {
  const target = String(account || "").trim().toLowerCase();
  if (!target) throw new Error("Account is required");

  const database = getDatabase();
  const userRow = database.prepare("SELECT * FROM users WHERE account = ?").get(target);
  const logs = database
    .prepare("SELECT * FROM credit_logs WHERE account = ? ORDER BY created_at DESC, id DESC LIMIT 500")
    .all(target)
    .map(dbCreditTraceLogToRuntime);
  const redeemCodes = database
    .prepare("SELECT * FROM redeem_codes WHERE used_by = ? ORDER BY used_at DESC, created_at DESC, code ASC")
    .all(target)
    .map((row) => ({
      code: row.code,
      credits: Number(row.credits || 0),
      note: row.note || "",
      usedBy: row.used_by || "",
      usedAt: row.used_at || "",
      createdAt: row.created_at || ""
    }));
  const rechargeOrders = getRechargeOrders({ account: target, limit: 200 });
  const totals = database
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'redeem' THEN credits ELSE 0 END), 0) AS redeem_credits,
        COALESCE(SUM(CASE WHEN type = 'recharge' THEN credits ELSE 0 END), 0) AS recharge_credits,
        COALESCE(SUM(CASE WHEN type = 'refund' THEN credits ELSE 0 END), 0) AS refund_credits,
        COALESCE(SUM(CASE WHEN type = 'manual' THEN credits ELSE 0 END), 0) AS manual_credits,
        COALESCE(SUM(CASE WHEN type = 'generate' THEN cost ELSE 0 END), 0) AS generate_cost,
        COUNT(*) AS log_count
       FROM credit_logs
       WHERE account = ?`
    )
    .get(target);

  const ledgerCredits =
    Number(totals.redeem_credits || 0) +
    Number(totals.recharge_credits || 0) +
    Number(totals.refund_credits || 0) +
    Number(totals.manual_credits || 0) -
    Number(totals.generate_cost || 0);
  const paidRechargeOrders = rechargeOrders.filter((order) => order.status === "paid");

  return {
    account: target,
    user: userRow ? dbUserToRuntimeUser(userRow, []) : null,
    summary: {
      currentCredits: userRow ? Number(userRow.credits || 0) : 0,
      ledgerCredits,
      diff: userRow ? Number(userRow.credits || 0) - ledgerCredits : -ledgerCredits,
      redeemCredits: Number(totals.redeem_credits || 0),
      redeemCount: redeemCodes.length,
      rechargeCredits: Number(totals.recharge_credits || 0),
      rechargeCount: paidRechargeOrders.length,
      refundCredits: Number(totals.refund_credits || 0),
      manualCredits: Number(totals.manual_credits || 0),
      generateCost: Number(totals.generate_cost || 0),
      logCount: Number(totals.log_count || 0),
      pendingRechargeCount: rechargeOrders.filter((order) => ["created", "pending"].includes(order.status)).length
    },
    redeemCodes,
    rechargeOrders,
    creditLogs: logs
  };
}

export function getEnabledApiChannels({ provider = "gpt-image-2", tier = "" } = {}) {
  return getApiChannels({ provider, tier })
    .filter((channel) => channel.enabled && channel.apiBase && channel.apiKey && channel.model)
    .sort((a, b) => apiRolePriority(a.role) - apiRolePriority(b.role));
}

export function upsertApiChannels(channels = []) {
  const database = getDatabase();
  const now = new Date().toISOString();
  database.exec("BEGIN");
  try {
    const saved = [];
    for (const raw of channels) {
      const channel = normalizeApiChannelInput(raw);
      const current = database.prepare("SELECT * FROM api_channels WHERE id = ?").get(channel.id);
      const apiKey = channel.apiKey || current?.api_key || "";
      database
        .prepare(
          `INSERT INTO api_channels
            (id, provider, tier, role, name, api_base, api_key, model, response_format, enabled, timeout_ms, note,
             last_test_status, last_test_message, last_test_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             provider = excluded.provider,
             tier = excluded.tier,
             role = excluded.role,
             name = excluded.name,
             api_base = excluded.api_base,
             api_key = excluded.api_key,
             model = excluded.model,
             response_format = excluded.response_format,
             enabled = excluded.enabled,
             timeout_ms = excluded.timeout_ms,
             note = excluded.note,
             updated_at = excluded.updated_at`
        )
        .run(
          channel.id,
          channel.provider,
          channel.tier,
          channel.role,
          channel.name,
          channel.apiBase,
          apiKey,
          channel.model,
          channel.responseFormat,
          channel.enabled ? 1 : 0,
          channel.timeoutMs,
          channel.note,
          current?.last_test_status || "",
          current?.last_test_message || "",
          current?.last_test_at || "",
          current?.created_at || now,
          now
        );
      saved.push(dbApiChannelToRuntime(database.prepare("SELECT * FROM api_channels WHERE id = ?").get(channel.id)));
    }
    database.exec("COMMIT");
    return saved;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function updateApiChannelTestResult(id, result = {}) {
  const now = new Date().toISOString();
  getDatabase()
    .prepare(
      `UPDATE api_channels
       SET last_test_status = ?, last_test_message = ?, last_test_at = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      String(result.status || "").slice(0, 40),
      String(result.message || "").slice(0, 500),
      now,
      now,
      id
    );
  const row = getDatabase().prepare("SELECT * FROM api_channels WHERE id = ?").get(id);
  return row ? dbApiChannelToRuntime(row) : null;
}

export function getImageStats() {
  const database = getDatabase();
  const { startUtc, endUtc } = getChinaDayRange();
  return {
    images: Number(database.prepare("SELECT COUNT(*) AS count FROM images").get().count || 0),
    jobs: Number(database.prepare("SELECT COUNT(*) AS count FROM jobs").get().count || 0),
    todayImages: Number(
      database
        .prepare("SELECT COUNT(*) AS count FROM images WHERE created_at >= ? AND created_at < ?")
        .get(startUtc, endUtc).count || 0
    ),
    todayJobs: Number(
      database
        .prepare("SELECT COUNT(*) AS count FROM jobs WHERE created_at >= ? AND created_at < ?")
        .get(startUtc, endUtc).count || 0
    ),
    todayStartUtc: startUtc,
    todayEndUtc: endUtc
  };
}

export function getUserGenerationStats() {
  const rows = getDatabase()
    .prepare(
      `SELECT
        account,
        COUNT(*) AS image_count,
        COUNT(DISTINCT job_id) AS job_count
       FROM images
       GROUP BY account`
    )
    .all();
  const stats = {};
  for (const row of rows) {
    stats[row.account] = {
      imageCount: Number(row.image_count || 0),
      jobCount: Number(row.job_count || 0)
    };
  }
  return stats;
}

export function getCreditLedgerAudit({ limit = 50 } = {}) {
  const database = getDatabase();
  const totals = database
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'redeem' THEN credits ELSE 0 END), 0) AS redeem_credits,
        COALESCE(SUM(CASE WHEN type = 'recharge' THEN credits ELSE 0 END), 0) AS recharge_credits,
        COALESCE(SUM(CASE WHEN type = 'refund' THEN credits ELSE 0 END), 0) AS refund_credits,
        COALESCE(SUM(CASE WHEN type = 'manual' THEN credits ELSE 0 END), 0) AS manual_credits,
        COALESCE(SUM(CASE WHEN type = 'welcome' THEN credits ELSE 0 END), 0) AS welcome_credits,
        COALESCE(SUM(CASE WHEN type = 'generate' THEN cost ELSE 0 END), 0) AS generate_cost,
        COUNT(*) AS log_count
       FROM credit_logs`
    )
    .get();
  const totalCredits = Number(database.prepare("SELECT COALESCE(SUM(credits), 0) AS value FROM users").get().value || 0);
  const ledgerCredits =
    Number(totals.redeem_credits || 0) +
    Number(totals.recharge_credits || 0) +
    Number(totals.refund_credits || 0) +
    Number(totals.manual_credits || 0) +
    Number(totals.welcome_credits || 0) -
    Number(totals.generate_cost || 0);
  const mismatches = database
    .prepare(
      `WITH ledger AS (
        SELECT account,
          COALESCE(SUM(CASE
            WHEN type = 'redeem' THEN credits
            WHEN type = 'recharge' THEN credits
            WHEN type = 'refund' THEN credits
            WHEN type = 'manual' THEN credits
            WHEN type = 'welcome' THEN credits
            WHEN type = 'generate' THEN -cost
            ELSE 0
          END), 0) AS ledger_credits,
          COUNT(*) AS log_count
        FROM credit_logs
        GROUP BY account
      )
      SELECT
        u.account,
        u.credits AS user_credits,
        COALESCE(l.ledger_credits, 0) AS ledger_credits,
        COALESCE(l.log_count, 0) AS log_count,
        u.credits - COALESCE(l.ledger_credits, 0) AS diff,
        u.updated_at AS updated_at
      FROM users u
      LEFT JOIN ledger l ON l.account = u.account
      WHERE u.credits != COALESCE(l.ledger_credits, 0)
      ORDER BY ABS(diff) DESC, u.account
      LIMIT ?`
    )
    .all(Number(limit || 50))
    .map((row) => ({
      account: row.account,
      userCredits: Number(row.user_credits || 0),
      ledgerCredits: Number(row.ledger_credits || 0),
      diff: Number(row.diff || 0),
      logCount: Number(row.log_count || 0),
      updatedAt: row.updated_at || ""
    }));

  return {
    totalCredits,
    ledgerCredits,
    diff: totalCredits - ledgerCredits,
    mismatchCount: Number(
      database
        .prepare(
          `WITH ledger AS (
            SELECT account,
              COALESCE(SUM(CASE
              WHEN type = 'redeem' THEN credits
              WHEN type = 'recharge' THEN credits
              WHEN type = 'refund' THEN credits
                WHEN type = 'manual' THEN credits
                WHEN type = 'generate' THEN -cost
                ELSE 0
              END), 0) AS ledger_credits
            FROM credit_logs
            GROUP BY account
          )
          SELECT COUNT(*) AS count
          FROM users u
          LEFT JOIN ledger l ON l.account = u.account
          WHERE u.credits != COALESCE(l.ledger_credits, 0)`
        )
        .get().count || 0
    ),
    redeemCredits: Number(totals.redeem_credits || 0),
    rechargeCredits: Number(totals.recharge_credits || 0),
    refundCredits: Number(totals.refund_credits || 0),
    manualCredits: Number(totals.manual_credits || 0),
    welcomeCredits: Number(totals.welcome_credits || 0),
    generateCost: Number(totals.generate_cost || 0),
    mismatches
  };
}

export function updateImageAsset(id, patch) {
  const current = getDatabase().prepare("SELECT * FROM images WHERE id = ?").get(id);
  if (!current) throw new Error("图片记录不存在");

  const assetStatus = normalizeAssetStatus(patch.assetStatus ?? patch.status ?? current.asset_status);
  const qualityScore = clampNumber(patch.qualityScore ?? current.quality_score, 0, 10);
  getDatabase()
    .prepare(
      `UPDATE images
       SET asset_status = ?, quality_score = ?, review_notes = ?, reusable_pattern = ?, failure_reason = ?
       WHERE id = ?`
    )
    .run(
      assetStatus,
      qualityScore,
      String(patch.reviewNotes ?? current.review_notes ?? "").slice(0, 1200),
      String(patch.reusablePattern ?? current.reusable_pattern ?? "").slice(0, 1200),
      String(patch.failureReason ?? current.failure_reason ?? "").slice(0, 1200),
      id
    );

  return dbImageToHistory(getDatabase().prepare("SELECT * FROM images WHERE id = ?").get(id));
}

export function updateImageThumbnailUrl(id, thumbnailUrl) {
  getDatabase()
    .prepare("UPDATE images SET thumbnail_url = ? WHERE id = ?")
    .run(String(thumbnailUrl || ""), id);
}

function dbUserToRuntimeUser(row, logs = []) {
  return {
    account: row.account,
    passwordHash: row.password_hash,
    credits: Number(row.credits || 0),
    token: row.token || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    creditLogs: logs
  };
}

function dbLogToPublicLog(row) {
  return {
    type: row.type,
    credits: row.credits ?? undefined,
    cost: row.cost ?? undefined,
    code: row.code || undefined,
    model: row.model || undefined,
    quality: row.quality || undefined,
    prompt: row.prompt || undefined,
    createdAt: row.created_at
  };
}

function dbCreditTraceLogToRuntime(row) {
  return {
    id: row.id,
    account: row.account || "",
    type: row.type || "",
    credits: row.credits ?? undefined,
    cost: row.cost ?? undefined,
    code: row.code || "",
    model: row.model || "",
    quality: row.quality || "",
    prompt: row.prompt || "",
    createdAt: row.created_at || ""
  };
}

function dbImageToHistory(row) {
  const input = safeJson(row.job_input_json, {});
  return {
    id: row.id,
    jobId: row.job_id,
    imageIndex: Number(row.image_index || 0),
    account: row.account,
    createdAt: row.created_at,
    model: row.model,
    modelLabel: row.job_model_label || row.model,
    modelId: row.model_id || row.job_model_id || "",
    quality: input.gptQuality || "",
    creditCost: Number(row.job_credit_cost || 0),
    provider: row.provider,
    prompt: row.prompt || "",
    ratio: row.ratio || "",
    style: row.style || "",
    promptTemplate: row.prompt_template || "custom",
    promptTemplateLabel: input.promptTemplateLabel || (row.prompt_template === "custom" || !row.prompt_template ? "自定义" : row.prompt_template),
    jobImageCount: Number(row.job_image_count || 1),
    finalPrompt: row.final_prompt || "",
    negativePrompt: row.negative_prompt || "",
    referencePlan: safeJson(row.reference_plan_json, null),
    assetStatus: row.asset_status || "候选",
    qualityScore: Number(row.quality_score || 0),
    reviewNotes: row.review_notes || "",
    reusablePattern: row.reusable_pattern || "",
    failureReason: row.failure_reason || "",
    thumbnailUrl: row.thumbnail_url || row.url,
    referencesCount: Number(row.references_count || 0),
    width: Number(row.width || 0),
    height: Number(row.height || 0),
    url: row.url
  };
}

function dbApiChannelToRuntime(row) {
  const apiKey = row.api_key || "";
  return {
    id: row.id,
    provider: row.provider || "gpt-image-2",
    tier: row.tier || "1k",
    role: row.role || "primary",
    name: row.name || "",
    apiBase: row.api_base || "",
    apiKey,
    apiKeySet: Boolean(apiKey),
    apiKeyMasked: maskApiKey(apiKey),
    model: row.model || "",
    responseFormat: row.response_format || "b64_json",
    enabled: Boolean(row.enabled),
    timeoutMs: Number(row.timeout_ms || 600000),
    note: row.note || "",
    lastTestStatus: row.last_test_status || "",
    lastTestMessage: row.last_test_message || "",
    lastTestAt: row.last_test_at || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function defaultAnnouncement() {
  return {
    enabled: false,
    title: "网站公告",
    content: "",
    buttonLabel: "我知道了",
    titleEn: "Site Update",
    contentEn: "",
    buttonLabelEn: "Got it",
    version: "1",
    createdAt: "",
    updatedAt: ""
  };
}

function dbAnnouncementToRuntime(row) {
  return {
    enabled: Boolean(row.enabled),
    title: row.title || "网站公告",
    content: row.content || "",
    buttonLabel: row.button_label || "我知道了",
    titleEn: row.title_en || "",
    contentEn: row.content_en || "",
    buttonLabelEn: row.button_label_en || "",
    version: row.version || "1",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function dbRechargeOrderToRuntime(row) {
  return {
    id: row.id,
    account: row.account || "",
    provider: row.provider || "wechat",
    outTradeNo: row.out_trade_no || "",
    amountCents: Number(row.amount_cents || 0),
    amountYuan: formatAmountYuan(row.amount_cents),
    credits: Number(row.credits || 0),
    status: row.status || "created",
    codeUrl: row.code_url || "",
    qrDataUrl: row.qr_data_url || "",
    transactionId: row.transaction_id || "",
    error: row.error || "",
    raw: safeJson(row.raw_json, {}),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    paidAt: row.paid_at || ""
  };
}

function formatAmountYuan(amountCents) {
  const cents = Number(amountCents || 0);
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

function normalizeAnnouncementInput(raw = {}, current = defaultAnnouncement()) {
  const title = String(raw.title ?? current.title ?? "网站公告").trim().slice(0, 80) || "网站公告";
  const content = String(raw.content ?? current.content ?? "").trim().slice(0, 3000);
  const buttonLabel = String(raw.buttonLabel ?? raw.button_label ?? current.buttonLabel ?? "我知道了").trim().slice(0, 20) || "我知道了";
  const titleEn = String(raw.titleEn ?? raw.title_en ?? current.titleEn ?? "").trim().slice(0, 80);
  const contentEn = String(raw.contentEn ?? raw.content_en ?? current.contentEn ?? "").trim().slice(0, 3000);
  const buttonLabelEn = String(raw.buttonLabelEn ?? raw.button_label_en ?? current.buttonLabelEn ?? "").trim().slice(0, 20);
  const incomingVersion = String(raw.version ?? "").trim().slice(0, 40);
  const version = incomingVersion || String(Date.now());
  return {
    enabled: raw.enabled === true || raw.enabled === "true" || raw.enabled === 1,
    title,
    content,
    buttonLabel,
    titleEn,
    contentEn,
    buttonLabelEn,
    version
  };
}

function normalizeApiChannelInput(raw = {}) {
  const provider = normalizeApiChannelProvider(raw.provider);
  const tier = normalizeApiChannelTier(raw.tier);
  const role = normalizeApiChannelRole(raw.role);
  return {
    id: String(raw.id || `${provider}_${tier}_${role}`).trim(),
    provider,
    tier,
    role,
    name: String(raw.name || "").trim().slice(0, 80),
    apiBase: normalizeApiBaseInput(raw.apiBase || raw.api_base || ""),
    apiKey: String(raw.apiKey || raw.api_key || "").trim(),
    model: String(raw.model || "").trim().slice(0, 120),
    responseFormat: normalizeApiResponseFormatInput(raw.responseFormat || raw.response_format || "b64_json"),
    enabled: raw.enabled === true || raw.enabled === "true" || raw.enabled === 1,
    timeoutMs: clampNumber(raw.timeoutMs || raw.timeout_ms || 600000, 30000, 900000),
    note: String(raw.note || "").trim().slice(0, 300)
  };
}

function normalizeApiChannelProvider(value) {
  const provider = String(value || "gpt-image-2").trim().toLowerCase();
  return provider || "gpt-image-2";
}

function normalizeApiChannelTier(value) {
  const tier = String(value || "1k").trim().toLowerCase();
  return ["1k", "2k", "4k", "standard", "high"].includes(tier) ? tier : "1k";
}

function normalizeApiChannelRole(value) {
  const role = String(value || "primary").trim().toLowerCase();
  return ["primary", "fallback1", "fallback2"].includes(role) ? role : "primary";
}

function normalizeApiBaseInput(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function normalizeApiResponseFormatInput(value) {
  const format = String(value || "b64_json").trim().toLowerCase();
  return format === "url" ? "url" : "b64_json";
}

function apiRolePriority(role) {
  return { primary: 0, fallback1: 1, fallback2: 2 }[role] ?? 9;
}

function maskApiKey(apiKey) {
  const key = String(apiKey || "");
  if (!key) return "";
  if (key.length <= 12) return `${key.slice(0, 3)}***`;
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

function normalizeAssetStatus(value) {
  const status = String(value || "候选").trim();
  return ["候选", "可用", "精选", "失败"].includes(status) ? status : "候选";
}

function clampNumber(value, min, max) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function normalizeChannelAttempts(value) {
  const attempts = Array.isArray(value) ? value : [];
  return attempts.slice(0, 30).map((item) => ({
    promptIndex: Number(item?.promptIndex || 0),
    promptId: String(item?.promptId || "").slice(0, 80),
    tier: String(item?.tier || "").slice(0, 20),
    role: String(item?.role || item?.channel || "").slice(0, 30),
    channelName: String(item?.channelName || "").slice(0, 80),
    source: String(item?.source || "").slice(0, 40),
    apiBase: String(item?.apiBase || "").slice(0, 160),
    model: String(item?.model || "").slice(0, 100),
    responseFormat: String(item?.responseFormat || "").slice(0, 30),
    status: String(item?.status || "pending").slice(0, 20),
    retryable: Boolean(item?.retryable),
    statusCode: Number(item?.statusCode || 0),
    error: String(item?.error || "").slice(0, 600),
    startedAt: String(item?.startedAt || "").slice(0, 40),
    completedAt: String(item?.completedAt || "").slice(0, 40),
    durationMs: Number(item?.durationMs || 0)
  }));
}

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
