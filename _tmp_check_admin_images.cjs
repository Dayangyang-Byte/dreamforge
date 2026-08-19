const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const root = "/opt/image-gen-studio";
const runtimeDir = process.env.APP_RUNTIME_DIR || path.join(root, "runtime");
const db = new Database(path.join(runtimeDir, "app.db"));
const rows = db
  .prepare("SELECT id, account, url, thumbnail_url, created_at FROM images ORDER BY created_at DESC LIMIT 12")
  .all();

console.log("RUNTIME", runtimeDir);
for (const row of rows) {
  const url = row.url || "";
  const thumb = row.thumbnail_url || "";
  const generatedPath = url.startsWith("/generated/")
    ? path.join(runtimeDir, "generated", path.basename(url))
    : "";
  const thumbPath = thumb.startsWith("/thumbnails/")
    ? path.join(runtimeDir, "thumbnails", path.basename(thumb))
    : "";
  console.log(JSON.stringify({
    id: row.id,
    account: row.account,
    createdAt: row.created_at,
    url,
    thumb,
    urlExists: generatedPath ? fs.existsSync(generatedPath) : null,
    thumbExists: thumbPath ? fs.existsSync(thumbPath) : null,
    generatedPath,
    thumbPath
  }));
}
