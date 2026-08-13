const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

(async () => {
  const out = "D:/Claude Code 视频项目/image-gen-studio/_tmp_live_i18n_check";
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"
  });
  const results = [];
  for (const [width, height, name] of [[1366, 900, "desktop-en"], [390, 844, "mobile-en"]]) {
    const page = await browser.newPage({ viewport: { width, height }, locale: "en-US" });
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    await page.addInitScript(() => {
      localStorage.setItem("dreamforge_language", "en");
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("dreamforge_announcement_seen_")) localStorage.removeItem(key);
      }
    });
    await page.goto("https://mengjing233.cn/?i18n_en_check=1", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(500);
    const bodyText = await page.locator("body").innerText();
    const cjkBody = [...bodyText.matchAll(/[\u4e00-\u9fff]/g)].length;
    const announcementText = await page.locator(".announcement-overlay").innerText().catch(() => "");
    const cjkAnnouncement = [...announcementText.matchAll(/[\u4e00-\u9fff]/g)].length;
    const closeAnnouncement = page.locator(".announcement-overlay .announcement-modal > button").last();
    if (await closeAnnouncement.count()) {
      await closeAnnouncement.click();
      await page.waitForTimeout(100);
    }
    await page.addStyleTag({ content: ".auth-overlay { display: none !important; }" });
    await page.locator(".template-trigger").click();
    await page.waitForTimeout(100);
    const templateText = await page.locator(".template-menu").innerText();
    const cjkTemplate = [...templateText.matchAll(/[\u4e00-\u9fff]/g)].length;
    const viewport = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
    results.push({
      name,
      title: await page.title(),
      cjkBody,
      cjkAnnouncement,
      cjkTemplate,
      viewport,
      errors,
      sample: bodyText.slice(0, 500).replace(/\n/g, " | ")
    });
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
