import { Client } from "file:///C:/Temp/codex-ssh2/node_modules/ssh2/lib/index.js";

const host = process.env.SSH_HOST;
const username = process.env.SSH_USER || "root";
const password = process.env.SSH_PASS;
if (!host || !password) throw new Error("Missing SSH_HOST or SSH_PASS");

const command = String.raw`
set -u
cd /opt/image-gen-studio
node --input-type=module - <<'NODE'
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("/opt/_runtime/image-gen-studio/app.db");
const rows = db.prepare("SELECT id, url FROM images WHERE url LIKE 'http%' ORDER BY created_at DESC LIMIT 5").all();
for (const row of rows) {
  console.log("URL", row.id, row.url);
  try {
    const response = await fetch(row.url, {
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8" }
    });
    console.log(JSON.stringify({
      status: response.status,
      ok: response.ok,
      type: response.headers.get("content-type"),
      length: response.headers.get("content-length"),
      finalUrl: response.url
    }));
    const first = Buffer.from(await response.arrayBuffer()).subarray(0, 120).toString("utf8");
    console.log("first-bytes", JSON.stringify(first));
  } catch (error) {
    console.log("fetch-error", error.message, error.cause?.code || "");
  }
}
db.close();
NODE
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
