const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"
  });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, locale: "en-US" });
  await page.goto("https://mengjing233.cn/?i18n_inspect=1", { waitUntil: "networkidle", timeout: 30000 });
  const result = {
    title: await page.title(),
    overlays: await page.locator(".auth-overlay, .announcement-overlay").count(),
    authText: await page.locator(".auth-overlay").innerText().catch(() => ""),
    authButtons: await page.locator(".auth-overlay button").allTextContents(),
    navButtons: await page.locator(".top-nav button").allTextContents(),
    navAria: await page.locator(".top-nav button").evaluateAll((items) => items.map((item) => ({
      text: item.innerText,
      aria: item.getAttribute("aria-label"),
      title: item.getAttribute("title"),
      className: item.className
    }))),
    bodySample: (await page.locator("body").innerText()).slice(0, 1200)
  };
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
