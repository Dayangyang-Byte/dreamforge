import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverIndexPath = path.join(root, "server", "index.js");
const source = fs.readFileSync(serverIndexPath, "utf-8");
const frontendSource = fs.readFileSync(path.join(root, "src", "main.jsx"), "utf-8");
const adminSource = fs.readFileSync(path.join(root, "src", "Admin.jsx"), "utf-8");
const dbSource = fs.readFileSync(path.join(root, "server", "db.js"), "utf-8");

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

assert(
  source.includes('source: "custom-literal"'),
  "Custom mode must keep the custom-literal guard."
);

assert(
  source.includes('dotenv.config({ path: path.resolve(projectRoot, ".env"), override: true, quiet: true });'),
  "Project .env must override the parent shared .env so tier-specific production API fixes actually take effect."
);

assert(
  source.includes('const checkedKeys = [\n    "GPT_IMAGE_API_BASE_URL"\n  ];') &&
    !source.includes('"GPT_IMAGE_1K_API_BASE_URL",\n    "GPT_IMAGE_2K_API_BASE_URL"'),
  "Expected GPT Image base URL guard must not block tier-specific 1K/4K API routes."
);

assert(
  source.includes('if (!selectedTemplate) return "";'),
  "Custom template guide must return empty when no template is selected."
);

const designerStart = source.indexOf("async function buildDesignerPlan");
const customGuard = source.indexOf("if (customMode)", designerStart);
const designerConfig = source.indexOf("const config = getDesignerBrainConfig()", designerStart);
assert(
  designerStart >= 0 && customGuard > designerStart && designerConfig > customGuard,
  "Custom mode must exit buildDesignerPlan before designer brain config is used."
);

assert(
  source.includes("const data = await generateGptImageViaEdits(item, input, activeModelConfig, apiBase, apiKey, size, quality, responseFormat);"),
  "GPT reference generation must route through the documented image edit function."
);

assert(
  source.includes("const editEndpoint = `${apiBase}/images/edits`;"),
  "GPT reference generation must call the G-AISC/OpenAI-compatible /images/edits endpoint."
);

assert(
  source.includes('form.append("image"'),
  "GPT reference generation must upload user reference images as multipart image fields."
);

assert(
  !source.includes("generateGptImageViaChatCompletions"),
  "Legacy GPT reference chat-completions route must not be present."
);

assert(
  source.includes("image edit route"),
  "GPT reference route note must identify the image edit route."
);

assert(
  source.includes("function getGptImageFallbackConfig") &&
    source.includes("GPT_IMAGE_FALLBACK_API_KEY") &&
    source.includes("GPT_IMAGE_1K_FALLBACK_API_KEY") &&
    source.includes("GPT_IMAGE_2K_FALLBACK_API_KEY") &&
    source.includes("GPT_IMAGE_4K_FALLBACK_API_KEY"),
  "GPT Image fallback API configuration must support generic and tier-specific fallback channels."
);

assert(
  source.includes("tier === \"1k\" ? process.env.GPT_IMAGE_1K_API_KEY") &&
    source.includes("tier === \"1k\" ? process.env.GPT_IMAGE_1K_API_BASE_URL") &&
    source.includes("tier === \"1k\" ? process.env.GPT_IMAGE_1K_MODEL") &&
    source.includes("tier === \"1k\" ? process.env.GPT_IMAGE_1K_RESPONSE_FORMAT"),
  "GPT Image 1K primary channel must support tier-specific API configuration without changing 2K/4K."
);

assert(
  source.includes("const tierPrimaryModel = tier === \"1k\" ? process.env.GPT_IMAGE_1K_MODEL") &&
    source.includes("const tierPrimaryResponseFormat =") &&
    source.includes("tierPrimaryModel ||") &&
    source.includes("tierPrimaryResponseFormat ||"),
  "GPT Image 1K fallback must inherit the 1K model and response format instead of falling back to a generic 2K-capable image model."
);

assert(
  source.includes("function normalizeGptImageResponseFormat") &&
    source.includes("response_format: responseFormat") &&
    source.includes('form.append("response_format", normalizeGptImageResponseFormat(responseFormat));'),
  "GPT Image response format must be configurable so unstable upstream URLs can be avoided with b64_json."
);

assert(
  source.includes('"16:9": "1024x640"') &&
    source.includes('"9:16": "640x1024"') &&
    source.includes('"21:9": "1024x439"') &&
    !source.includes('"16:9": "1280x720"') &&
    !source.includes('"9:16": "720x1280"'),
  "GPT Image 1K wide and portrait sizes must meet upstream minimum pixels while keeping the longest edge at or below 1024."
);

assert(
  source.includes("function getGptImageChannelConfigs") &&
    source.includes("shouldFallbackGptImageError(error)") &&
    source.includes("switching to fallback"),
  "GPT Image generation must try the primary channel first and switch to fallback only for retryable channel failures."
);

assert(
  source.includes('throw new Error("该生图模型已下架或不可用，请刷新页面后重新选择模型。");') &&
    !source.includes('id: "nanobanana"') &&
    !source.includes('id: `nanobanana_${tier}_${role}`') &&
    !source.includes('getApiChannels({ provider: "nanobanana" })'),
  "Nanobanana must stay delisted from model options and API Studio defaults."
);

assert(
  source.includes('id: "nannabanan"') &&
    source.includes('label: "🍌 Nannabanan"') &&
    source.includes('provider: "nannabanan"') &&
    frontendSource.includes('id: "nannabanan"') &&
    frontendSource.includes('label: "🍌 Nannabanan"'),
  "Nannabanan must be exposed as a separate public model without changing Forge or GPT Image 2."
);

assert(
  source.includes("function generateWithNannabanan") &&
    source.includes("normalizeGeminiApiBase") &&
    source.includes("/models/${normalizeGeminiModelPath(config.model || modelConfig.model)}:generateContent") &&
    source.includes('responseModalities: ["TEXT", "IMAGE"]') &&
    source.includes("imageConfig") &&
    source.includes("extractImageUrl(data)"),
  "Nannabanan must use the Gemini native v1beta generateContent image route and parse inline image data."
);

assert(
  dbSource.includes('["1k", "2k", "4k", "standard", "high"].includes(tier)'),
  "API channel tiers must preserve Nanobanana standard/high instead of coercing them to GPT 1K."
);

assert(
  source.includes("embeddedDataUrl") &&
    source.includes("inline_data") &&
    source.includes("imageUrl") &&
    source.includes("anyUrlMatch"),
  "Image URL extraction must support Nanobanana chat image response formats including inline data and extensionless URLs."
);

assert(
  source.includes("fetchRemoteGeneratedImage(url)"),
  "Generated remote image URLs must be downloaded and served from local /generated assets."
);

assert(
  source.includes("async function assertGeneratedImageUrlUsable") &&
    source.includes("await assertGeneratedImageUrlUsable(imageUrl, apiBase, gptConfig.channel);"),
  "GPT Image remote result URLs must be checked before a generation can be treated as successful."
);

assert(
  source.includes("上游返回的图片链接不可读取，未能保存到本地") &&
    source.includes("throw userFacingError(\"上游返回的图片链接不可读取"),
  "Unreadable remote result URLs must fail before credit settlement instead of becoming broken history images."
);

assert(
  source.includes("originalUrl: url"),
  "Persisted remote images should keep the upstream originalUrl for debugging."
);

assert(
  source.includes('app.set("etag", false)') &&
    source.includes('"Cache-Control", "no-store, no-cache, must-revalidate, private"'),
  "API JSON responses must not be cached or returned as 304 without a body."
);

assert(
  frontendSource.includes('cache: "no-store"'),
  "Frontend auth/history API requests must bypass mobile browser caches."
);

assert(
  dbSource.includes("function getChinaDayRange"),
  "Today image stats must use the China-time day range helper."
);

assert(
  dbSource.includes("created_at >= ? AND created_at < ?"),
  "Today image stats must use a bounded UTC range, not UTC date LIKE."
);

assert(
  dbSource.includes("export function settleGenerationSuccess"),
  "Successful generation settlement must be handled by one database transaction function."
);

assert(
  source.includes("const settlement = settleGenerationSuccess({"),
  "Generation route must use transactional settlement for job, credit, log, and request status."
);

assert(
  !source.includes("saveJobRecord(job);"),
  "Generation route must not save the job before credit settlement."
);

assert(
  source.includes("function resolveInputRatio") &&
    source.includes("ratio: ratioLocked ? selectedRatio : promptRatio || selectedRatio"),
  "Backend must let explicit prompt ratio override only the default/unlocked aspect ratio."
);

assert(
  source.includes("Never change generation count. The backend resolved aspect ratio is final.") &&
    source.includes("Prompt-declared ratio after parsing:"),
  "Designer brain must not be allowed to override the backend-resolved aspect ratio."
);

assert(
  !source.includes("UI-selected aspect ratio is final.") &&
    !source.includes("Do not suggest or override aspect ratio. Keep the current UI ratio exactly."),
  "Old UI-locked aspect ratio wording must not return."
);

assert(
  source.includes("function getVisionAnalyzerConfigs()"),
  "Reference analysis must support multiple vision analyzers."
);

assert(
  source.includes("process.env.VISION_TIMEOUT_MS || 60_000"),
  "Primary vision analyzer timeout must default to 60 seconds."
);

assert(
  source.includes("process.env.VISION_FALLBACK_API_KEY") &&
    source.includes("process.env.AGNES_API_KEY") &&
    source.includes('"agnes-2.5-flash"'),
  "Agnes 2.5 Flash must remain configured as the reference-analysis fallback option."
);

assert(
  source.includes("for (const [index, analyzer] of analyzers.entries())"),
  "Reference analysis must try configured vision analyzers in order before falling back to prompt-only."
);

assert(
  source.includes("function isTemplateProductLocalEditPrompt(input = {}, referencePlan = null)") &&
    source.includes("if (!hasSelectedWorkflowTemplate(input)) return false;"),
  "Template product local edit mode must exist and must not affect custom mode."
);

assert(
  source.includes("Priority order is mandatory: user's explicit edit instruction first, referenced product/package preservation second, selected template style last."),
  "Template product local edit mode must keep user prompt above reference lock above template style."
);

assert(
  source.includes("For packaged tissue, wet wipes, boxed paper, bags, bottles, cans, cups, and similar products: do not open the package"),
  "Template product local edit mode must prevent implausible exposed package contents unless requested."
);

assert(
  source.includes("Template priority rule: the selected template is a helper only."),
  "Template guide must state that templates are helpers, not higher priority than user prompt or references."
);

assert(
  dbSource.includes("export function setUserCreditsWithManualLog") &&
    dbSource.includes('database.exec("BEGIN IMMEDIATE")') &&
    dbSource.includes("'manual'"),
  "Manual credit adjustments must update the user balance and write a manual ledger log in one transaction."
);

assert(
  source.includes('app.post("/api/admin/users/:account/credits"') &&
    source.includes("请填写本次调整原因，方便后续追溯"),
  "Admin manual credit adjustments must require a tracked reason."
);

assert(
  adminSource.includes("function AccountSearch") &&
    adminSource.includes("搜索账号、兑换码或备注") &&
    adminSource.includes("人工调整余额"),
  "Admin must keep account search, redeem-code search, and the manual balance adjustment panel."
);

if (failures.length) {
  console.error("Quality guards failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Quality guards passed.");
