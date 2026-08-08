import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getDatabase,
  initDatabase,
  insertCreditLog,
  saveJobRecord,
  saveRedeemStore,
  upsertUser
} from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const runtimeDir = path.resolve(projectRoot, "..", "_runtime", "image-gen-studio");
const dbPath = path.join(runtimeDir, "app.db");
const usersPath = path.join(runtimeDir, "users.json");
const redeemCodesPath = path.join(runtimeDir, "redeem-codes.json");
const jobsDir = path.join(runtimeDir, "jobs");

initDatabase(dbPath);
const db = getDatabase();
db.exec("DELETE FROM images; DELETE FROM jobs; DELETE FROM credit_logs; DELETE FROM redeem_codes; DELETE FROM users;");

const users = await readJson(usersPath, { accounts: {} });
let userCount = 0;
let logCount = 0;
for (const user of Object.values(users.accounts || {})) {
  upsertUser(user);
  userCount += 1;
  for (const log of user.creditLogs || []) {
    insertCreditLog(user.account, log);
    logCount += 1;
  }
}

const redeemStore = await readJson(redeemCodesPath, { codes: {} });
saveRedeemStore(redeemStore);
const redeemCount = Object.keys(redeemStore.codes || {}).length;

let jobCount = 0;
let imageCount = 0;
try {
  const files = await fs.readdir(jobsDir);
  for (const fileName of files) {
    if (!fileName.endsWith(".json")) continue;
    const job = await readJson(path.join(jobsDir, fileName), null);
    if (!job || !job.id) continue;
    saveJobRecord(job);
    jobCount += 1;
    imageCount += Array.isArray(job.images) ? job.images.length : 0;
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

console.log(JSON.stringify({ dbPath, userCount, logCount, redeemCount, jobCount, imageCount }, null, 2));

async function readJson(filePath, fallback) {
  try {
    const raw = (await fs.readFile(filePath, "utf-8")).replace(/^\uFEFF/, "");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    console.warn(`Skip invalid JSON: ${filePath}`);
    return fallback;
  }
}
