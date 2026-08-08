import { Client } from "file:///C:/Temp/codex-ssh2/node_modules/ssh2/lib/index.js";

const host = process.env.SSH_HOST;
const username = process.env.SSH_USER || "root";
const password = process.env.SSH_PASS;

if (!host || !password) throw new Error("Missing SSH_HOST or SSH_PASS");

const command = String.raw`
set -u
cd /opt/image-gen-studio

echo "=== pm2 ==="
pm2 status image-gen-studio --no-color || true

echo "=== recent images ==="
node --input-type=module - <<'NODE'
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("/opt/_runtime/image-gen-studio/app.db");
const rows = db.prepare("SELECT images.id, images.job_id, images.account, images.created_at, images.model_id, images.model, images.ratio, images.width, images.height, images.url, images.thumbnail_url, jobs.input_json FROM images LEFT JOIN jobs ON jobs.id = images.job_id ORDER BY images.created_at DESC LIMIT 12").all();

const generatedDir = "/opt/_runtime/image-gen-studio/generated";
const result = [];
for (const row of rows) {
  let input = {};
  try { input = JSON.parse(row.input_json || "{}"); } catch {}
  const item = {
    id: row.id,
    jobId: row.job_id,
    account: row.account,
    createdAt: row.created_at,
    modelId: row.model_id,
    quality: input.gptQuality || "",
    ratio: row.ratio,
    width: row.width,
    height: row.height,
    url: row.url,
    thumb: row.thumbnail_url,
    urlKind: /^\/generated\//.test(row.url || "") ? "local-generated" : /^https?:\/\//.test(row.url || "") ? "remote-url" : /^data:image\//.test(row.url || "") ? "data-url" : "other"
  };
  if (item.urlKind === "local-generated") {
    const file = path.join(generatedDir, path.basename(row.url));
    item.fileExists = fs.existsSync(file);
    item.fileSize = item.fileExists ? fs.statSync(file).size : 0;
  }
  result.push(item);
}
console.log(JSON.stringify(result, null, 2));
db.close();
NODE

echo "=== local generated URL probes ==="
node --input-type=module - <<'NODE'
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("/opt/_runtime/image-gen-studio/app.db");
const rows = db.prepare("SELECT id, url FROM images ORDER BY created_at DESC LIMIT 8").all();
for (const row of rows) {
  if (!String(row.url || "").startsWith("/generated/")) continue;
  const response = await fetch("http://127.0.0.1:8787" + row.url).catch((error) => ({ ok: false, status: 0, error }));
  const type = response.headers?.get?.("content-type") || "";
  const length = response.headers?.get?.("content-length") || "";
  console.log(JSON.stringify({ id: row.id, url: row.url, ok: response.ok, status: response.status, type, length }));
}
db.close();
NODE

echo "=== recent job image records ==="
node --input-type=module - <<'NODE'
import fs from "node:fs";
import path from "node:path";
const jobsDir = "/opt/_runtime/image-gen-studio/jobs";
const files = fs.readdirSync(jobsDir).filter((name) => name.endsWith(".json")).sort().slice(-6).reverse();
for (const file of files) {
  const job = JSON.parse(fs.readFileSync(path.join(jobsDir, file), "utf8"));
  console.log(JSON.stringify({
    id: job.id,
    createdAt: job.createdAt,
    account: job.account,
    model: job.model,
    quality: job.input?.gptQuality || "",
    ratio: job.input?.ratio || "",
    images: (job.images || []).map((img) => ({
      id: img.id,
      url: img.url,
      thumbnailUrl: img.thumbnailUrl,
      originalUrlKind: img.originalUrl ? (img.originalUrl.startsWith("data:image/") ? "data" : img.originalUrl.slice(0, 80)) : "",
      originalBytes: img.originalBytes || 0,
      note: img.note || ""
    }))
  }, null, 2));
}
NODE

echo "=== recent errors ==="
pm2 logs image-gen-studio --lines 100 --nostream --raw 2>/dev/null | grep -Ei "GPT Image|generated|image|fetch|error|failed|timeout|fallback|没有返回|usable" | tail -80 || true
`;

const conn = new Client();
conn
  .on("ready", () => {
    conn.exec(command, { pty: false }, (err, stream) => {
      if (err) throw err;
      stream
        .on("close", (code) => {
          conn.end();
          process.exit(code || 0);
        })
        .on("data", (data) => process.stdout.write(data.toString()))
        .stderr.on("data", (data) => process.stderr.write(data.toString()));
    });
  })
  .on("error", (err) => {
    console.error(err.message);
    process.exit(1);
  })
  .connect({ host, port: 22, username, password, readyTimeout: 15000 });
