const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const out = 'D:/Claude Code 视频项目/image-gen-studio/_tmp_live_i18n_check';
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  });
  const results = [];
  for (const [width, height, name] of [[1366, 900, 'desktop'], [390, 844, 'mobile']]) {
    const page = await browser.newPage({ viewport: { width, height }, locale: 'en-US' });
    const errors = [];
    page.on('pageerror', err => errors.push(String(err)));
    await page.goto('https://mengjing233.cn/?i18n_check=1', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: path.join(out, `${name}_initial.png`), fullPage: true });
    const initialText = await page.locator('body').innerText();
    const announcementConfirm = page.locator('.announcement-overlay .announcement-modal > button').last();
    if (await announcementConfirm.count()) {
      await announcementConfirm.first().click();
      await page.waitForTimeout(100);
    }
    const langButton = page.locator('.auth-language-button');
    const initialLabel = await langButton.innerText();
    await langButton.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `${name}_toggled.png`), fullPage: true });
    const toggledText = await page.locator('body').innerText();
    const toggledLabel = await page.locator('.auth-language-button').innerText();
    const cjkInitial = [...initialText.matchAll(/[\u4e00-\u9fff]/g)].length;
    const cjkToggled = [...toggledText.matchAll(/[\u4e00-\u9fff]/g)].length;
    const templateButton = page.locator('.template-trigger');
    let templateCjk = null;
    if (await templateButton.count()) {
      await page.addStyleTag({ content: ".auth-overlay { display: none !important; }" });
      await templateButton.click();
      await page.waitForTimeout(100);
      const templateText = await page.locator('.template-menu').innerText();
      templateCjk = [...templateText.matchAll(/[\u4e00-\u9fff]/g)].length;
    }
    const reportOptionTexts = await page.locator('select option').allTextContents();
    const nav = await page.locator('.top-nav').boundingBox();
    const consoleBox = await page.locator('.prompt-console').boundingBox();
    const viewport = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    results.push({ name, initialLabel, toggledLabel, cjkInitial, cjkToggled, templateCjk, reportOptionTexts, nav, consoleBox, viewport, errors, title: await page.title(), sample: toggledText.slice(0, 500).replace(/\n/g, ' | ') });
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch(err => { console.error(err); process.exit(1); });
