import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Building2,
  Bell,
  Check,
  ChevronDown,
  X,
  Coins,
  Crown,
  Download,
  ImagePlus,
  Languages,
  Loader2,
  LogOut,
  Mountain,
  Palette,
  Rocket,
  Settings2,
  Sparkles,
  Trash2,
  UserRound,
  WandSparkles
} from "lucide-react";
import { AdminApp } from "./Admin.jsx";
import "./styles.css";

if (window.location.pathname.startsWith("/admin")) {
  createRoot(document.getElementById("root")).render(<AdminApp />);
} else {
  createRoot(document.getElementById("root")).render(<App />);
}

const apiBase = import.meta.env.VITE_API_BASE || "";
const trackedPaidOrders = new Set();
function trackEvent(name, params = {}) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", name, params);
  }
}
const maxReferences = 5;
const maxReferenceImageEdge = 1600;
const referenceImageQuality = 0.82;
const tokenKey = "dreamforge_token";
const languageKey = "dreamforge_language";
const announcementDismissPrefix = "dreamforge_announcement_seen_";
const rechargePlans = [1, 5, 10, 20, 50];
const historyPageSize = 20;

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

const defaults = {
  prompt: "",
  category: "custom",
  promptTemplate: "custom",
  ratio: "16:9",
  ratioLocked: false,
  style: "custom",
  model: "gpt-image-2",
  gptQuality: "1k",
  count: 1,
  references: []
};

const fallbackModels = [
  { id: "forge", label: "Forge生图模型", creditCost: 0, qualityOptions: [] },
  {
    id: "gpt-image-2",
    label: "GPT Image 2",
    creditCost: 2,
    qualityOptions: [
      { id: "1k", label: "1K", description: "标准清晰度", creditCost: 2 },
      { id: "2k", label: "2K", description: "高清海报", creditCost: 3 },
      { id: "4k", label: "4K", description: "超清大图", creditCost: 5 }
    ]
  },
  { id: "nannabanan", label: "🍌 Nannabanan", creditCost: 2, qualityOptions: [] }
];

const modelText = {
  en: {
    forge: { label: "Forge Image", description: "" },
    "gpt-image-2": { label: "GPT Image 2", description: "" },
    nannabanan: { label: "🍌 Nannabanan", description: "" },
    "1k": "Standard clarity",
    "2k": "HD poster",
    "4k": "Ultra-clear large image"
  }
};

const categoryText = {
  en: {
    custom: "Basic",
    portrait: "Portrait Editing",
    product: "Ecommerce Product",
    art: "Posters & Cards",
    ppt: "PPT Design",
    pptopt: "PPT Image Polish",
    refedit: "Reference Retouch",
    infographic: "Infographics",
    assets: "Visual Assets",
    knowledge: "Education",
    engineering: "Product Engineering",
    brandui: "Brand & UI",
    stickers: "Portraits & Stickers",
    storyboard: "Storyboards",
    game: "Game Concepts",
    longform: "Long-form Charts",
    merch: "Merchandise",
    ecommercekit: "Ecommerce Marketing Sets",
    ecommerceflow: "Ecommerce Workflows",
    nanocases: "Reference Image Ideas",
    contentdesign: "Content & Business Design",
    aesthetic: "Premium Aesthetics",
    anime: "Anime & Line Art",
    architecture: "Interior & Home",
    nature: "Landscape Scenes",
    future: "Short Video"
  }
};

const templateText = {
  en: {
    custom: ["Custom", "Freeform from your prompt"],
    "dream-portrait": ["Dream Portrait", "Stable face, mood, and light"],
    "hairstyle-change": ["Change Hairstyle", "Keep the face, change hair"],
    "makeup-change": ["Change Makeup", "Polish makeup and presence"],
    "background-change": ["Change Background", "Keep subject, change scene"],
    "sky-change": ["Change Sky", "For landscape or architecture"],
    "clean-background": ["Clean Background", "Remove clutter"],
    "high-tension-poster": ["High-impact Poster", "Cover, ad, strong click"],
    "magazine-cover": ["Text-behind Portrait", "Magazine cover layering"],
    "product-visual": ["Ecommerce Product", "Prioritize shape and material"],
    "product-scene-blend": ["Product in Scene", "Place product naturally"],
    "product-detail-page": ["Product Detail Page", "Selling points and details"],
    "product-white-background": ["White-background Product", "Main image, cutout, polish"],
    "clothing-try-on": ["Clothing Try-on", "Person plus outfit"],
    "ootd-flatlay": ["OOTD Flat Lay", "Extract a full outfit"],
    "group-photo": ["Group Photo", "Consistent people, natural interaction"],
    "wedding-photo": ["Wedding Portrait", "Couple photo"],
    "id-photo": ["ID / Profile Photo", "Professional headshot"],
    "era-portrait": ["Era Portrait", "Retro time-travel look"],
    turnaround: ["Character Turnaround", "Design sheet, multiple angles"],
    "pose-control": ["Pose Control", "Action, sketch, mannequin"],
    "style-poster-remix": ["Poster Style Remix", "Reference layout and color"],
    "xiaohongshu-card": ["Rednote Card", "Cards, infographics, guides"],
    "video-cover": ["Video Cover", "Large title, strong click"],
    "ppt-cover": ["PPT Cover Slide", "Report, course, proposal"],
    "business-launch-slide": ["Launch Slide", "Product launch, tech feel"],
    "tourism-ppt": ["Travel PPT", "City, attraction, culture"],
    "product-landing-slide": ["Product Landing Hero", "Product image, website hero"],
    "tech-ppt": ["Dark Tech PPT", "Blue-purple tech, launch"],
    "guochao-guide": ["Chinese-style Guide", "City travel, split layout"],
    "ppt-whitespace-cleanup": ["PPT Whitespace Cleanup", "Clean clutter, leave title space"],
    "ppt-wide-outpaint": ["PPT Wide Outpaint", "Extend vertical image to 16:9"],
    "ppt-cutout-layout": ["Subject Cutout Layout", "Clean subject for PPT"],
    "ppt-background-defocus": ["Background Defocus", "Clear subject, softer background"],
    "ppt-motion-image": ["PPT Motion Image", "Speed, trails, energy"],
    "ppt-style-unify": ["PPT Style Unifier", "Unify colors across images"],
    "ppt-add-elements": ["Add PPT Elements", "Foreground, props, scene additions"],
    "ppt-light-color": ["PPT Light & Color", "Sunset, backlight, cinematic"],
    "photo-deblur-upscale": ["Deblur & Upscale", "Sharpen and restore naturally"],
    "focus-control": ["Change Photo Focus", "Sharp subject, blurred background"],
    "age-transform": ["Age Transform", "Child, youth, elderly"],
    "skin-texture-edit": ["Skin Texture Edit", "Pores, glow, realistic skin"],
    "secondary-lighting": ["Relight Image", "Studio, backlight, cinematic light"],
    "consistent-outfit-change": ["Consistent Outfit Change", "Keep face/body, change clothes"],
    "multi-subject-consistency": ["Multi-subject Consistency", "People/products in one scene"],
    "roadmap-flow": ["Roadmap Flow", "Stages, nodes, arrows"],
    "business-architecture": ["Business Architecture", "Layers, modules, platform"],
    "data-dashboard": ["Data Dashboard", "Metrics, charts, conclusion"],
    "comparison-slide": ["Comparison Slide", "Side-by-side pros and cons"],
    "timeline-slide": ["Timeline Slide", "History or plan"],
    "icon-set": ["Unified Icon Set", "Same-style icon assets"],
    "illustration-kit": ["Illustration Kit", "People, scenes, elements"],
    "ppt-background": ["PPT Background", "Clean background and whitespace"],
    "title-lettering": ["Title Lettering", "Large title, display type"],
    "teaching-knowledge-card": ["Teaching Visual", "Classroom, concept, learning"],
    "six-grid-tutorial": ["Six-grid Tutorial", "Step-by-step lifestyle guide"],
    "scientific-diagram": ["Scientific Diagram", "Principle, mechanism, structure"],
    "paper-graphical-abstract": ["Graphical Abstract", "Paper, blog, research summary"],
    "product-exploded-view": ["Product Exploded View", "Parts and callouts"],
    "product-manual-page": ["Product Manual Page", "Usage steps and instructions"],
    "industrial-structure-sheet": ["Industrial Structure Sheet", "Cutaway, engineering feel"],
    "mobile-ui-showcase": ["Mobile UI Showcase", "App screens, portfolio"],
    "logo-identity-board": ["Logo Proposal Board", "Logo, grid, variations"],
    "brand-system-board": ["Brand System Board", "Packaging, posters, mockups"],
    "livestream-scene": ["Livestream Scene", "Shopping stream UI and products"],
    "cinematic-portrait": ["Cinematic Portrait", "Portrait, mood, light"],
    "outdoor-photoshoot": ["Outdoor Photoshoot", "Campus, street, natural light"],
    "sticker-pack": ["Sticker Pack", "Eight emotions, one character"],
    "journal-sticker-page": ["Journal Sticker Page", "Stickers, tape, note areas"],
    "character-bible": ["Character Bible", "People, scenes, worldbuilding"],
    "storyboard-sheet": ["Film Storyboard", "Shot size, camera, dialogue"],
    "ad-storyboard": ["Ad Storyboard", "Brand film, selling-point story"],
    "cinematic-keyframes": ["Cinematic Keyframes", "Consistent scene sequence"],
    "game-ui-concept": ["Game UI Concept", "Menu, inventory, map"],
    "gameplay-screenshot": ["Gameplay Screenshot", "First person, story UI"],
    "game-boss-scene": ["Boss Battle Scene", "Combat, results, map"],
    "narrative-silhouette-poster": ["Narrative Silhouette Poster", "World inside silhouette"],
    "event-poster": ["Event Poster", "Avatar, QR, time and place"],
    "travel-guide-poster": ["Travel Guide Poster", "Route, food, mini map"],
    "cultural-product-kit": ["Cultural Merch Kit", "Stickers, postcards, goods"],
    "ecommerce-main-set": ["Ecommerce Main Set", "Main images and selling points"],
    "ecommerce-long-detail": ["Long Detail Page", "1:3 long page and feature text"],
    "ecom-studio-main": ["Studio Main Product", "White/gray background, soft light"],
    "ecom-lifestyle-ad": ["Lifestyle Seeding Ad", "Real scene, social style"],
    "ecom-macro-detail": ["Macro Product Detail", "Material, opening, close-up"],
    "ecom-craft-process": ["Handcraft Ad", "Hands, process, craft feel"],
    "ecom-derived-products": ["Brand Derivatives", "Mugs, bags, candles, merch"],
    "ecom-product-combo": ["Product Combo Photo", "Platform, flat lay, series"],
    "ecom-marketing-pack": ["Marketing Material Set", "Main image, scene, poster, merch"],
    "ecom-bg-replace-workflow": ["Product Background Replace", "Keep product, rebuild scene"],
    "ecom-white-to-scene-workflow": ["White Product to Scene", "Turn white-background product into scene"],
    "ecom-jewelry-tryon-workflow": ["Jewelry Try-on", "Natural accessory wearing"],
    "ecom-model-tryon-workflow": ["Model Outfit Try-on", "Put clothing on a model"],
    "ecom-object-transfer-workflow": ["Object Transfer", "Place an object into target image"],
    "ecom-material-replace-workflow": ["Material Replace", "Transfer material to object"],
    "ecom-pose-replication-workflow": ["Pose Replication", "Use pose reference only"],
    "precise-image-edit": ["Precise Edit", "Short text, numbers, local edit"],
    "people-selfie-group": ["People Group Photo", "Group, selfie, hug"],
    "expression-action-edit": ["Expression / Action Edit", "Smile, sit, hug, stand"],
    "model-wear-product": ["Model Wearing Product", "Bag, sunglasses, accessory"],
    "furniture-room-staging": ["Furniture Room Staging", "Place furniture in empty room"],
    "product-collab-design": ["Product Collaboration", "Main product plus style reference"],
    "character-figure-toy": ["Character Figure Toy", "1/7 figure, blind box, desk toy"],
    "sketch-to-finished-art": ["Sketch to Finished Art", "Sketch or line art to final"],
    "physics-time-effect": ["Physical Time Effect", "Melt, burn, age, break"],
    "menu-design": ["Menu Design", "Restaurant menu, price list"],
    "invitation-business-card": ["Invitation / Business Card", "Cards and invitations"],
    "word-flash-card": ["Word Flash Card", "English word learning cards"],
    "book-cover-kit": ["Book Cover Kit", "Flat and 3D book cover"],
    "overseas-ecommerce-poster": ["Overseas Ecommerce Poster", "English selling points, Amazon/site"],
    "ecommerce-data-selling-point": ["Data Selling-point Image", "Specs, nutrition, comparisons"],
    "children-science-picturebook": ["Children Science Picturebook", "Kids science story"],
    "sketch-to-app-ui": ["Sketch to App UI", "Turn sketch into app screen"],
    "app-mockup-showcase": ["App Mockup Showcase", "Phone mockups, portfolio"],
    "research-analysis-figure": ["Research Analysis Figure", "Segmentation, classification, medical"],
    "aesthetic-3d-cartoon-portrait": ["3D Cartoon Portrait", "Animation-grade studio portrait"],
    "aesthetic-kpop-studio-beauty": ["K-pop Studio Beauty", "Idol look, hair, porcelain skin"],
    "aesthetic-fine-brush-lady": ["Fine-brush Lady", "Classical Chinese narrative"],
    "aesthetic-wordless-picturebook": ["Wordless Picturebook", "Story told through images"],
    "aesthetic-riviera-fashion": ["Riviera Fashion", "Sun, blue-white-red, relaxed premium"],
    "aesthetic-surreal-sculpture": ["Surreal Sculpture", "Minimal space, installation art"],
    "aesthetic-eco-glass-surreal": ["Eco Glass Surreal", "Glass, plants, whitespace"],
    "aesthetic-retro-healing-picturebook": ["Retro Healing Picturebook", "Pencil hatching, warm black-white"],
    "aesthetic-inflatable-surreal-product": ["Inflatable Surreal Product", "Rubber gloss, art display"],
    "aesthetic-british-linocut": ["British Linocut", "Low-poly geometry, paper texture"],
    "aesthetic-graffiti-pop": ["Graffiti Pop", "Bold lines, symbols, rhythm"],
    "knowledge-encyclopedia": ["Encyclopedia Infographic", "Atlas, modules, information"],
    "life-timeline": ["Life Timeline", "Stages, places, works"],
    "event-long-timeline": ["Event Timeline", "Development and release history"],
    "guofeng-atlas": ["Chinese Atlas Long Image", "Scroll, mythic creatures, categories"],
    "home-design": ["Home Design", "Furniture and space renovation"],
    "furniture-placement": ["Furniture Placement", "Place furniture into a room"],
    "old-photo-restore": ["Old Photo Restore", "Repair and colorize"],
    "colorize-sketch": ["Sketch Colorization", "Line art and comic coloring"],
    keyframe: ["Short-video Keyframe", "More stable for video later"]
  }
};

const uiText = {
  zh: {
    language: "中文",
    switchLanguage: "English",
    navAnnouncement: "公告",
    memberCenter: "会员中心",
    loginRegister: "登录 / 注册",
    credits: "积分",
    creditsPerImage: "积分/张",
    free: "免费",
    freePerImage: "免费/张",
    heroTitle: "让梦境成为现实",
    heroSubtitle: "上传最多 5 张参考图，再用提示词生成一张更接近你想法的 AI 图片",
    modelAria: "选择模型",
    qualityAriaSuffix: "档位",
    templateLabel: "创作模板",
    custom: "自定义",
    promptPlaceholder: "描述你想生成的画面...",
    generating: "生成中",
    generateNow: "立即生成",
    ratioManualPrefix: "提示词写了",
    ratioManualMiddle: "，当前手动选择",
    ratioManualSuffix: "，将按手动选择生成。",
    ratioAutoPrefix: "已根据提示词切换为",
    switchTo: "改为",
    referenceButton: "参考图",
    pasteHint: "可在提示词框直接粘贴图片",
    removeReference: "移除参考图",
    referenceIndex: "图",
    referenceUsagePlaceholder: "可选：这张图参考什么？如人物、服装、背景、姿势、风格",
    referenceIntel: "生成时会先自动识别每张参考图的用途，再和你的提示词合成新图。",
    templateGuidance: "提示词明确可直接生成；没思路时再选创作模板探索随机效果。不会写请联系客服。",
    resultTitle: "生成结果",
    deducted: "已扣",
    remaining: "剩余",
    referenceCountSuffix: "张参考图",
    download: "下载",
    footerTitle: "DreamForge 梦境图片创作",
    footerNote: "用户生成内容默认不公开展示，不提供评论、转发、群组等互动功能。",
    terms: "用户协议",
    privacy: "隐私政策",
    report: "投诉举报",
    icp: "ICP备案查询",
    announcement: "公告",
    announcementCenter: "公告中心",
    siteAnnouncement: "网站公告",
    gotIt: "我知道了",
    close: "关闭",
    loadingAnnouncements: "正在读取公告...",
    currentAnnouncement: "当前公告",
    noAnnouncements: "暂时还没有公告。",
    member: "会员",
    loginTitle: "登录账号",
    registerTitle: "注册账号",
    redeemTab: "积分兑换",
    rechargeTab: "充值积分",
    historyTab: "生成历史",
    forgeRule: "Forge生图模型：免费/张",
    gptRule: "GPT Image 2：1K 2 积分/张，2K 3 积分/张，4K 5 积分/张",
    bananaRule: "🍌 Nannabanan：2 积分/张",
    creditRule: "生成成功后扣除积分，失败不会扣除。",
    redeemPlaceholder: "输入兑换码",
    redeemButton: "兑换积分",
    currentRate: "当前比例",
    yuan: "元",
    rechargeCreating: "正在创建订单",
    wechatRecharge: "微信扫码充值",
    wechatQrAlt: "微信支付二维码",
    orderNo: "订单号：",
    rechargeWait: "付款后请等待后台确认，金额需与订单一致。",
    paidCheck: "我已付款，查看是否到账",
    historyLimit: "最多保留最近 100 张",
    refresh: "刷新",
    historyLoading: "正在读取历史...",
    historyEmpty: "还没有生成记录",
    historyLoadedPrefix: "已读取",
    historyLoadedSuffix: "张历史图片，图片会直接加载；如果仍未显示，请点刷新重试。",
    previewImage: "预览图片",
    historyImageAlt: "历史图片",
    historyImageError: "图片加载失败",
    reuse: "复用同款",
    loadingMore: "正在读取...",
    loadMoreHistory: "加载更多历史",
    account: "账号",
    email: "邮箱",
    accountPlaceholder: "邮箱 / 原账号",
    emailPlaceholder: "请输入邮箱地址",
    password: "密码",
    passwordPlaceholder: "至少 6 位",
    login: "登录",
    register: "注册",
    toRegister: "没有账号？去注册",
    toLogin: "已有账号？去登录",
    historyPreviewAlt: "历史图片预览",
    downloading: "下载中",
    downloadOriginal: "下载原图",
    reportType: "举报类型",
    reportContact: "联系方式",
    reportContent: "举报内容",
    reportContactPlaceholder: "手机号或邮箱，便于反馈处理结果",
    reportContentPlaceholder: "请说明账号、图片、时间或具体问题",
    reportSubmitting: "提交中",
    reportSubmit: "提交举报",
    compliance: "合规说明"
  },
  en: {
    language: "English",
    switchLanguage: "中文",
    navAnnouncement: "Updates",
    memberCenter: "Account",
    loginRegister: "Log in / Sign up",
    credits: "credits",
    creditsPerImage: "credits/image",
    free: "Free",
    freePerImage: "Free",
    heroTitle: "Turn Ideas Into Images",
    heroSubtitle: "Upload up to 5 references, then describe the image you want to create.",
    modelAria: "Choose model",
    qualityAriaSuffix: "quality",
    templateLabel: "Template",
    custom: "Custom",
    promptPlaceholder: "Describe the image you want to create...",
    generating: "Generating",
    generateNow: "Generate",
    ratioManualPrefix: "Your prompt asks for",
    ratioManualMiddle: ", but the selected ratio is",
    ratioManualSuffix: ". The selected ratio will be used.",
    ratioAutoPrefix: "Ratio switched from your prompt:",
    switchTo: "Use",
    referenceButton: "References",
    pasteHint: "Paste images directly into the prompt box",
    removeReference: "Remove reference",
    referenceIndex: "Image",
    referenceUsagePlaceholder: "Optional: what should this image guide? Person, outfit, background, pose, style...",
    referenceIntel: "Reference images are analyzed first, then combined with your prompt.",
    templateGuidance: "If your prompt is clear, use Custom. If you need inspiration, choose a template. Contact support if unsure.",
    resultTitle: "Result",
    deducted: "used",
    remaining: "remaining",
    referenceCountSuffix: "reference image(s)",
    download: "Download",
    footerTitle: "DreamForge AI Image Studio",
    footerNote: "Generated content is private by default. No public posts, comments, reposts, groups, or live features are provided.",
    terms: "Terms",
    privacy: "Privacy",
    report: "Report",
    icp: "ICP Lookup",
    announcement: "Update",
    announcementCenter: "Updates",
    siteAnnouncement: "Site Update",
    gotIt: "Got it",
    close: "Close",
    loadingAnnouncements: "Loading updates...",
    currentAnnouncement: "Current",
    noAnnouncements: "No updates yet.",
    member: "Member",
    loginTitle: "Log in",
    registerTitle: "Create account",
    redeemTab: "Redeem",
    rechargeTab: "Recharge",
    historyTab: "History",
    forgeRule: "Forge Image: free",
    gptRule: "GPT Image 2: 1K 2 credits, 2K 3 credits, 4K 5 credits",
    bananaRule: "🍌 Nannabanan: 2 credits/image",
    creditRule: "Credits are charged only after successful generation.",
    redeemPlaceholder: "Enter redeem code",
    redeemButton: "Redeem",
    currentRate: "Current rate",
    yuan: "CNY",
    rechargeCreating: "Creating order",
    wechatRecharge: "WeChat QR recharge",
    wechatQrAlt: "WeChat payment QR code",
    orderNo: "Order ID: ",
    rechargeWait: "After payment, please wait for admin confirmation. The amount must match the order.",
    paidCheck: "I paid, check status",
    historyLimit: "Latest 100 images are kept",
    refresh: "Refresh",
    historyLoading: "Loading history...",
    historyEmpty: "No generation history yet",
    historyLoadedPrefix: "Loaded",
    historyLoadedSuffix: "history images. Images load directly; refresh if they still do not appear.",
    previewImage: "Preview image",
    historyImageAlt: "History image",
    historyImageError: "Image failed to load",
    reuse: "Reuse prompt",
    loadingMore: "Loading...",
    loadMoreHistory: "Load more history",
    account: "Account",
    email: "Email",
    accountPlaceholder: "Email / old account",
    emailPlaceholder: "Enter email address",
    password: "Password",
    passwordPlaceholder: "At least 6 characters",
    login: "Log in",
    register: "Sign up",
    toRegister: "No account? Sign up",
    toLogin: "Already have an account? Log in",
    historyPreviewAlt: "History image preview",
    downloading: "Downloading",
    downloadOriginal: "Download original",
    reportType: "Report type",
    reportContact: "Contact",
    reportContent: "Details",
    reportContactPlaceholder: "Phone or email for follow-up",
    reportContentPlaceholder: "Describe the account, image, time, or issue",
    reportSubmitting: "Submitting",
    reportSubmit: "Submit report",
    compliance: "Compliance"
  }
};

const styleLabels = {
  zh: {
    custom: "自定义",
    "dream-cinematic": "梦幻电影感",
    anime: "动漫插画",
    realistic: "写实摄影",
    product: "产品海报"
  },
  en: {
    custom: "Custom",
    "dream-cinematic": "Dream cinematic",
    anime: "Anime illustration",
    realistic: "Realistic photography",
    product: "Product poster"
  }
};

const ratioLabels = {
  zh: {
    "16:9": "16:9 横图",
    "9:16": "9:16 竖图",
    "1:1": "1:1 方图",
    "3:4": "3:4 封面",
    default: "默认比例"
  },
  en: {
    "16:9": "16:9 Landscape",
    "9:16": "9:16 Portrait",
    "1:1": "1:1 Square",
    "3:4": "3:4 Cover",
    default: "Default ratio"
  }
};

const categoryPresets = [
  { id: "custom", label: "自定义", icon: Settings2 },
  { id: "fantasy", label: "奇幻世界", icon: Sparkles },
  { id: "future", label: "未来科技", icon: Rocket },
  { id: "portrait", label: "人物肖像", icon: UserRound },
  { id: "anime", label: "动漫艺术", icon: WandSparkles },
  { id: "nature", label: "自然风光", icon: Mountain },
  { id: "architecture", label: "建筑设计", icon: Building2 },
  { id: "product", label: "产品设计", icon: ImagePlus },
  { id: "art", label: "艺术创作", icon: Palette }
];

const templatePresets = [
  {
    id: "custom",
    label: "自定义",
    hint: "按你的提示词自由发挥",
    category: "custom",
    style: "custom",
    prompt: ""
  },
  {
    id: "dream-portrait",
    label: "梦幻人像",
    hint: "人物、情绪、光影更稳",
    category: "portrait",
    style: "dream-cinematic",
    prompt: "梦幻人像，主体清晰，情绪自然，柔和轮廓光，浅景深，细腻真实"
  },
  {
    id: "hairstyle-change",
    label: "换发型",
    hint: "保留脸，换发型",
    category: "portrait",
    style: "realistic",
    prompt: "保留参考人物的面部身份、五官比例和气质，只更换发型，发丝自然，头发边缘真实，光线和原画面一致"
  },
  {
    id: "makeup-change",
    label: "换妆容",
    hint: "妆面、气质优化",
    category: "portrait",
    style: "realistic",
    prompt: "保留参考人物身份和脸型，优化妆容与肤质，妆面干净高级，修正不自然细节，整体像专业美妆大片"
  },
  {
    id: "background-change",
    label: "换背景",
    hint: "主体不变，换场景",
    category: "art",
    style: "dream-cinematic",
    prompt: "保留参考图中的主体身份、姿势和重要细节，将背景更换为用户指定的新场景，边缘融合自然，光线、透视和色调统一"
  },
  {
    id: "sky-change",
    label: "换天空",
    hint: "风景、建筑照片",
    category: "nature",
    style: "realistic",
    prompt: "保留地面建筑和主体结构，将天空更换为用户指定氛围，云层、晚霞、光照方向和环境色自然融入原图"
  },
  {
    id: "clean-background",
    label: "清理杂乱",
    hint: "去杂物、净化背景",
    category: "product",
    style: "realistic",
    prompt: "清理参考图中的杂乱背景和无关物体，保留主体真实外观，补全被移除区域的纹理、光影和透视，让画面干净自然"
  },
  {
    id: "high-tension-poster",
    label: "高张力海报",
    hint: "封面、广告、强点击",
    category: "art",
    style: "product",
    prompt: "高张力视觉海报，强主体，明确视觉冲突，标题区域清晰，色彩克制"
  },
  {
    id: "magazine-cover",
    label: "人物压字",
    hint: "杂志封面层次感",
    category: "portrait",
    style: "dream-cinematic",
    prompt: "杂志封面感，人物在前景，巨大标题或图形在人物身后，前后层次清楚"
  },
  {
    id: "product-visual",
    label: "电商产品图",
    hint: "产品形态和材质优先",
    category: "product",
    style: "product",
    prompt: "高级产品广告图，产品清晰，材质真实，干净背景，商业棚拍光"
  },
  {
    id: "product-scene-blend",
    label: "产品融景",
    hint: "产品放入场景",
    category: "product",
    style: "product",
    prompt: "将参考产品自然放入用户指定或参考图提供的场景中，保留产品形状、包装、Logo和材质，匹配场景透视、光线、阴影和比例"
  },
  {
    id: "product-detail-page",
    label: "详情页图",
    hint: "卖点、细节展示",
    category: "product",
    style: "product",
    prompt: "生成电商详情页风格图片，突出产品主视觉、材质细节、使用场景和卖点模块，版式干净高级，信息区域完整但不堆满小字"
  },
  {
    id: "product-white-background",
    label: "商品白底图",
    hint: "主图、抠图、精修",
    category: "product",
    style: "product",
    prompt: "电商可用的高清商品白底图，保留产品真实外观、颜色、结构、Logo 和材质细节，边缘干净，轻微真实阴影"
  },
  {
    id: "clothing-try-on",
    label: "服装上身",
    hint: "人像 + 衣服",
    category: "product",
    style: "realistic",
    prompt: "将参考服装或配饰自然穿到参考人物身上，保留人物身份和体型，服装贴合身体结构，褶皱、材质、遮挡和光影真实"
  },
  {
    id: "ootd-flatlay",
    label: "穿搭平铺",
    hint: "提取全套穿搭",
    category: "product",
    style: "product",
    prompt: "根据参考人物或服装，生成一张平铺拍摄的OOTD穿搭展示图，清晰展示所有衣物、鞋包和配饰，排列整洁，背景干净"
  },
  {
    id: "group-photo",
    label: "多人合影",
    hint: "人物一致、自然互动",
    category: "portrait",
    style: "realistic",
    prompt: "自然多人合影，保留每个参考人物的身份特征、发型、年龄感和体型，统一光线、透视和场景，不要拼贴感"
  },
  {
    id: "wedding-photo",
    label: "婚纱合照",
    hint: "双人、情侣照",
    category: "portrait",
    style: "dream-cinematic",
    prompt: "生成自然高级的婚纱合照，保留参考人物身份和年龄感，双人互动真实，服装、场景、光线和肤色统一，避免拼贴感"
  },
  {
    id: "id-photo",
    label: "证件头像",
    hint: "职业照、证件照",
    category: "portrait",
    style: "realistic",
    prompt: "专业证件照或职业头像，保留参考人物面部身份，姿态端正，背景干净，光线自然，妆发整洁"
  },
  {
    id: "era-portrait",
    label: "年代穿越",
    hint: "复古年代照",
    category: "portrait",
    style: "realistic",
    prompt: "让参考人物穿越到用户指定年代，保留人物身份和脸部特征，服装、发型、妆容、场景、胶片质感都符合对应年代"
  },
  {
    id: "turnaround",
    label: "角色三视图",
    hint: "设定图、多角度",
    category: "anime",
    style: "custom",
    prompt: "角色设定三视图，正面、侧面、背面保持同一角色身份、服装和细节一致，干净网格排版，少量短标签"
  },
  {
    id: "pose-control",
    label: "姿势控制",
    hint: "动作、草图、人偶",
    category: "portrait",
    style: "custom",
    prompt: "优先遵守参考图中的姿势、动作和构图，把人物身份、画风和动作自然融合到完整场景中，肢体比例正确"
  },
  {
    id: "style-poster-remix",
    label: "海报仿风格",
    hint: "参考构图色彩",
    category: "art",
    style: "product",
    prompt: "分析参考海报的构图、色彩、字体气质、元素组织和视觉层级，用同类设计语言生成用户指定主题的新海报，不照抄原文案"
  },
  {
    id: "xiaohongshu-card",
    label: "小红书卡片",
    hint: "卡片、信息图、攻略",
    category: "art",
    style: "custom",
    prompt: "小红书风格视觉卡片，主视觉清晰，信息分区干净，留出标题和标签空间"
  },
  {
    id: "video-cover",
    label: "视频封面",
    hint: "大标题、强点击",
    category: "art",
    style: "product",
    prompt: "设计一张高点击视频封面，主体表情或产品视觉冲击强，大标题区域醒目，构图适合手机端浏览，文字短而有力"
  },
  {
    id: "ppt-cover",
    label: "PPT封面页",
    hint: "汇报、课程、方案封面",
    category: "ppt",
    style: "product",
    prompt: "生成一张16:9高级PPT封面页，明确主题主标题，保留充足文字留白，主视觉有冲击力，副标题和信息区层级清楚，整体像可直接用于汇报的成品首页"
  },
  {
    id: "business-launch-slide",
    label: "发布会单页",
    hint: "产品发布、科技感",
    category: "ppt",
    style: "product",
    prompt: "生成一张16:9商业科技发布会PPT单页，核心产品或主体明确，深色或极简高级背景，左/右侧预留标题和三条卖点区域，图文融合自然，少即是多，高级发布会质感"
  },
  {
    id: "tourism-ppt",
    label: "旅游宣传PPT",
    hint: "城市、景区、文旅",
    category: "ppt",
    style: "dream-cinematic",
    prompt: "生成一张16:9高端文旅宣传PPT单页，保留或塑造核心景点主视觉，一侧为风景画面，一侧为深色或渐变信息区，包含大标题、副标题、细线装饰和少量图标信息，高级电影感排版"
  },
  {
    id: "product-landing-slide",
    label: "产品官网首屏",
    hint: "产品图、官网首屏",
    category: "ppt",
    style: "product",
    prompt: "生成一张16:9产品官网首屏视觉，产品为清晰主角，左右分栏排版，包含大标题、短副标题、参数卡片、图标卖点和简洁导航感，背景干净，光影高级，适合品牌官网或商业路演"
  },
  {
    id: "tech-ppt",
    label: "深色科技PPT",
    hint: "蓝紫科技、发布会",
    category: "ppt",
    style: "dream-cinematic",
    prompt: "生成一张16:9深色科技风PPT单页，蓝紫或青绿光效，玻璃拟态信息卡片，清晰标题区，主体场景与数据/图标模块分层，背景干净，有未来科技发布会质感"
  },
  {
    id: "guochao-guide",
    label: "国潮指南页",
    hint: "城市旅游、分栏排版",
    category: "ppt",
    style: "custom",
    prompt: "生成一张16:9国潮旅游指南或城市介绍PPT，多个景点分栏展示，主标题醒目，国风色彩和纹理克制，底部信息栏或图标栏清楚，整体厚重、有文化感、可直接作为宣传单页"
  },
  {
    id: "ppt-whitespace-cleanup",
    label: "PPT留白优化",
    hint: "清杂物、留标题区",
    category: "pptopt",
    style: "product",
    prompt: "基于参考图做PPT配图优化：保留主体清晰和原有核心信息，清理杂乱元素，弱化或虚化背景，在左侧或右侧生成大面积干净留白区域，适合放PPT标题、正文和图标"
  },
  {
    id: "ppt-wide-outpaint",
    label: "PPT横图扩图",
    hint: "竖图扩成16:9",
    category: "pptopt",
    style: "realistic",
    prompt: "将参考图自然扩展为16:9横版PPT配图，保留主体、透视、光线和场景逻辑，向两侧补充合理环境与留白空间，让画面适合PPT封面或内页排版"
  },
  {
    id: "ppt-cutout-layout",
    label: "主体抠图排版",
    hint: "人物/产品干净入版",
    category: "pptopt",
    style: "product",
    prompt: "保留参考图中的人物或产品主体，去除复杂背景并重建干净背景或透明感舞台，主体边缘清晰自然，加入适合PPT排版的阴影、渐变、留白和层级"
  },
  {
    id: "ppt-background-defocus",
    label: "背景虚焦强化",
    hint: "主体清楚、背景弱化",
    category: "pptopt",
    style: "realistic",
    prompt: "保持参考图主体清晰锐利，暗化、虚焦或简化无关背景，降低背景干扰，强化主体与标题区的对比，让图片更适合作为PPT配图或封面底图"
  },
  {
    id: "ppt-motion-image",
    label: "PPT动感配图",
    hint: "拖尾、速度、张力",
    category: "pptopt",
    style: "dream-cinematic",
    prompt: "在参考图基础上增强画面动感，为车辆、列车、人物、动物、桥梁或场景加入合理的运动方向、动态模糊、拖尾、沙尘或光轨，保持主体逻辑自然，适合PPT封面冲击力"
  },
  {
    id: "ppt-style-unify",
    label: "PPT风格统一",
    hint: "多图统一色调",
    category: "pptopt",
    style: "custom",
    prompt: "将参考图统一处理成适合PPT的一致视觉风格，可根据用户要求改为黑白摄影棚、蓝色科技、暖黄商务、印象派、低饱和高级或统一品牌色。保持主体可识别，整体色调、光影和质感统一"
  },
  {
    id: "ppt-add-elements",
    label: "PPT加元素",
    hint: "前景、道具、场景补充",
    category: "pptopt",
    style: "dream-cinematic",
    prompt: "在参考图中自然增加用户指定元素，例如前景遮挡、天空、建筑、人物、动物、道具、樱花、骆驼、光效或场景层次。新增元素必须匹配透视、光线、景深和色调，不破坏主体"
  },
  {
    id: "ppt-light-color",
    label: "PPT打光调色",
    hint: "日落、逆光、电影感",
    category: "pptopt",
    style: "dream-cinematic",
    prompt: "基于参考图进行PPT级打光和调色，保留主体与构图，调整为用户指定氛围，如日落光、逆光、蓝调时刻、商务冷色、暖色人文、电影感或高级黑白，让画面更统一、更有演示质感"
  },
  {
    id: "photo-deblur-upscale",
    label: "去模糊高清修复",
    hint: "锐化、细节、自然修复",
    category: "refedit",
    style: "realistic",
    prompt: "基于参考图做摄影级去模糊和高清修复，保留主体身份、构图、光线和真实质感，增强对焦清晰度、边缘细节、皮肤/材质纹理和整体分辨率，不改变人物、产品或场景内容"
  },
  {
    id: "focus-control",
    label: "改变照片焦点",
    hint: "主体锐利、背景虚化",
    category: "refedit",
    style: "realistic",
    prompt: "基于参考图重新控制焦点：将用户指定主体或人物眼睛变得极度清晰锐利，背景或前景形成自然浅景深虚化和柔和散景，保持构图、身份、场景和光线逻辑真实"
  },
  {
    id: "age-transform",
    label: "人物年龄变化",
    hint: "儿童、青年、老年",
    category: "refedit",
    style: "realistic",
    prompt: "基于参考人物生成指定年龄阶段的真实形象，保留五官比例、脸型、发型气质和身份辨识度，只改变年龄相关的面部结构、皮肤状态、发量、服装和生活气质，避免变成陌生人"
  },
  {
    id: "skin-texture-edit",
    label: "肤质质感调整",
    hint: "毛孔、光泽、真实皮肤",
    category: "refedit",
    style: "realistic",
    prompt: "基于参考人像调整肤质质感，可按用户要求做自然通透、胶片颗粒、细腻但保留毛孔、健康光泽或年龄感皮肤。保留人物身份和真实皮肤纹理，避免塑料磨皮和五官漂移"
  },
  {
    id: "secondary-lighting",
    label: "二次打光",
    hint: "棚拍、逆光、电影光",
    category: "refedit",
    style: "dream-cinematic",
    prompt: "基于参考图进行二次打光，保留主体、构图和场景，重新设计主光、辅光、轮廓光、逆光或环境光，让画面呈现用户指定的棚拍、电影感、夜景霓虹、清晨自然光或高级商业光效"
  },
  {
    id: "consistent-outfit-change",
    label: "一致性换装",
    hint: "保脸、保体型、换服装",
    category: "refedit",
    style: "realistic",
    prompt: "基于参考人物进行换装，严格保留人物身份、脸部特征、发型、体型和姿态，将服装自然替换为用户指定风格。衣物需要贴合身体结构，褶皱、遮挡、材质、光影和比例真实"
  },
  {
    id: "multi-subject-consistency",
    label: "多主体一致性",
    hint: "多人/多产品同场景",
    category: "refedit",
    style: "realistic",
    prompt: "基于多张参考图，把多个主体自然组合进同一个新场景。每个人物或产品都要保留各自身份、比例、颜色、材质和关键细节，同时统一透视、光线、景深、阴影和色调，避免拼贴感"
  },
  {
    id: "roadmap-flow",
    label: "流程路线图",
    hint: "阶段、节点、箭头",
    category: "infographic",
    style: "custom",
    prompt: "生成一张16:9商务流程路线图PPT，将用户内容整理成3到5个阶段节点，使用卡片、图标、箭头或路径串联，标题清晰，阶段目标简洁，白底或浅色高级商务风，信息层级清楚"
  },
  {
    id: "business-architecture",
    label: "商业架构图",
    hint: "层级、模块、平台",
    category: "infographic",
    style: "custom",
    prompt: "生成一张16:9商业架构图PPT，把用户内容拆成上中下或左中右模块，使用阶梯、平台、卡片或模块矩阵展示逻辑关系，图标统一，配色克制，结构一眼能看懂"
  },
  {
    id: "data-dashboard",
    label: "数据看板",
    hint: "指标、图表、结论",
    category: "infographic",
    style: "custom",
    prompt: "生成一张16:9数据分析看板PPT，包含核心指标卡、趋势图、占比图、排名或结论模块。优先展示用户提供的数据和结论，图表清晰专业，避免编造过多小字，适合商业汇报"
  },
  {
    id: "comparison-slide",
    label: "对比分析页",
    hint: "左右对比、优劣势",
    category: "infographic",
    style: "custom",
    prompt: "生成一张16:9对比分析PPT，把用户内容整理成左右对比或多列对比结构，突出差异、优劣势、关键指标和结论，卡片边界清晰，留白充足，适合方案汇报"
  },
  {
    id: "timeline-slide",
    label: "时间轴页面",
    hint: "发展历程、计划",
    category: "infographic",
    style: "custom",
    prompt: "生成一张16:9时间轴PPT，把用户内容整理成横向或纵向时间节点，节点标题醒目，说明文字简短，配合图标和连接线，整体现代、清晰、适合项目计划或发展历程"
  },
  {
    id: "icon-set",
    label: "统一图标包",
    hint: "同风格图标资产",
    category: "assets",
    style: "custom",
    prompt: "生成一组统一风格图标资产，图标数量根据用户要求，保持线条粗细、视角、配色、阴影和图形语言一致，白底或透明感干净背景，适合PPT、海报和网页使用"
  },
  {
    id: "illustration-kit",
    label: "插画元素包",
    hint: "人物、场景、元素",
    category: "assets",
    style: "anime",
    prompt: "生成一组统一风格插画元素包，包含用户指定的人物、场景、道具或业务元素，保持画风、色彩、线条和光影一致，元素之间可组合用于PPT、海报或长图"
  },
  {
    id: "ppt-background",
    label: "PPT背景图",
    hint: "干净背景、留白",
    category: "assets",
    style: "dream-cinematic",
    prompt: "生成一张16:9高级PPT背景图，主体氛围明确但不抢文字，保留大面积干净留白，光影柔和，色彩统一，适合叠加标题、正文、图表和商务汇报内容"
  },
  {
    id: "title-lettering",
    label: "标题字设计",
    hint: "大标题、艺术字",
    category: "assets",
    style: "custom",
    prompt: "生成一个醒目的中文或英文标题字设计，字形气质符合用户主题，笔触、材质、光影和背景融合自然，可用于PPT封面、海报或视频封面。文字尽量短，保持清晰可读"
  },
  {
    id: "teaching-knowledge-card",
    label: "教学知识图",
    hint: "课堂、知识点、教辅",
    category: "knowledge",
    style: "custom",
    prompt: "生成一张高质量教学知识图，围绕用户主题用清晰主视觉、公式或概念解释、步骤拆解、重点标签和例题示意来帮助理解。背景干净，文字短而清楚，像优秀教辅教材或教学视频配图"
  },
  {
    id: "six-grid-tutorial",
    label: "六宫格教程图",
    hint: "步骤流程、生活教程",
    category: "knowledge",
    style: "custom",
    prompt: "生成一张六宫格教程信息图，将用户主题拆成6个连续步骤。每格包含步骤编号、小标题、简短说明和对应插图，整体风格统一、留白舒适、像高质量生活方式杂志教程页"
  },
  {
    id: "scientific-diagram",
    label: "科学示意图",
    hint: "原理、机制、结构",
    category: "knowledge",
    style: "custom",
    prompt: "生成一张科学示意图或知识配图，用箭头、剖面、局部放大、流程线和短标签解释用户指定的原理或机制。信息准确优先，结构清楚，避免幻想元素和不必要装饰"
  },
  {
    id: "paper-graphical-abstract",
    label: "论文图形摘要",
    hint: "论文、博客、研究总结",
    category: "knowledge",
    style: "dream-cinematic",
    prompt: "生成一张论文或技术博客图形摘要，将用户主题整理成一个强主视觉和少量精炼信息模块。适合科技封面、论文总结、演讲首页，强调核心机制、关键创新和影响，避免学术堆字"
  },
  {
    id: "product-exploded-view",
    label: "产品爆炸图",
    hint: "结构拆解、部件标注",
    category: "engineering",
    style: "product",
    prompt: "生成一张高端工业设计风格的产品爆炸分解图，展示产品核心部件、结构顺序、材质细节、引导线标注和局部放大窗。若有参考产品，必须保持外观、品牌和结构特征稳定"
  },
  {
    id: "product-manual-page",
    label: "产品说明书",
    hint: "使用步骤、图文说明",
    category: "engineering",
    style: "custom",
    prompt: "生成一张现代产品说明书页面，用清晰步骤图、功能标注、注意事项、参数区和操作示意解释产品使用方法。白底或浅灰背景，排版官方、简洁、易读，不像广告海报"
  },
  {
    id: "industrial-structure-sheet",
    label: "工业结构页",
    hint: "剖面、构造、工程感",
    category: "engineering",
    style: "product",
    prompt: "生成一张工业结构展示页，包含产品或设备主视觉、剖面结构、材料层级、关键零件标注、技术亮点和精密工程质感。整体克制高级，强调秩序、材质、空间层次和专业可信度"
  },
  {
    id: "mobile-ui-showcase",
    label: "移动端UI展示",
    hint: "App界面、作品集",
    category: "brandui",
    style: "custom",
    prompt: "生成一张移动端UI设计展示板，包含多张统一比例的手机界面 mockup，主题、颜色、卡片、图标、按钮和内容层级一致。像小红书高赞UI作品集或Behance案例展示，不要后台系统感"
  },
  {
    id: "logo-identity-board",
    label: "Logo提案板",
    hint: "标志、网格、变体",
    category: "brandui",
    style: "custom",
    prompt: "生成一张高质量Logo品牌提案板，包含主Logo、几何构成网格、黑白反白版、简化图标、字体系统、色彩系统和小型应用样机。整体极简、专业、留白充足，像成熟品牌视觉手册"
  },
  {
    id: "brand-system-board",
    label: "品牌视觉系统",
    hint: "包装、海报、样机",
    category: "brandui",
    style: "product",
    prompt: "生成一张完整品牌视觉系统提案板，包含Logo、标准字、色彩、字体、包装、海报、社交媒体物料、官网或手机端界面、应用样机和品牌场景图。整体统一、高级、像可交付的品牌方案"
  },
  {
    id: "livestream-scene",
    label: "直播间效果图",
    hint: "带货、直播UI、商品卡",
    category: "brandui",
    style: "realistic",
    prompt: "生成一张直播间效果图，包含主播、商品陈列、背景海报、灯光、评论弹幕、商品卡片、购物车和直播氛围。画面热闹但不杂乱，适合电商带货视觉预演，不要仿冒真实平台标识"
  },
  {
    id: "cinematic-portrait",
    label: "电影感写真",
    hint: "人像、情绪、光影",
    category: "stickers",
    style: "dream-cinematic",
    prompt: "根据用户人物或参考图生成电影感写真，保留人物身份、五官比例、发型和气质，优化表情、姿态、构图和自然光影。整体像文艺电影剧照，不要影楼感、网红滤镜或过度磨皮"
  },
  {
    id: "outdoor-photoshoot",
    label: "户外写真大片",
    hint: "校园、街拍、自然光",
    category: "stickers",
    style: "realistic",
    prompt: "生成一组户外写真风格画面，保留人物身份，营造自然抓拍、浅景深、逆光或侧逆光、空气感和松弛情绪。可根据主题选择校园、街道、公园、海边或咖啡馆场景"
  },
  {
    id: "sticker-pack",
    label: "表情包套图",
    hint: "8种情绪、统一角色",
    category: "stickers",
    style: "anime",
    prompt: "基于参考人物或角色生成一组统一风格表情包，至少包含开心、大笑、害羞、困惑、生气、委屈、惊讶、比心或点赞等情绪动作。保持角色身份、发型、服装和画风一致"
  },
  {
    id: "journal-sticker-page",
    label: "手帐贴纸页",
    hint: "贴纸、胶带、记录区",
    category: "stickers",
    style: "anime",
    prompt: "生成一整页手帐贴纸排版，包含人物贴纸、装饰元素、胶带、标签、日期、便签纸、文字记录区域和小图标。整体风格统一、层级清楚、适合打印或社交媒体分享"
  },
  {
    id: "character-bible",
    label: "角色设定集",
    hint: "人物、场景、世界观",
    category: "storyboard",
    style: "dream-cinematic",
    prompt: "根据用户提供的故事或主题生成一套角色设定集，包含主角、配角、反派、关键场景和世界观视觉板。每个角色身份、服装、气质、道具和色彩锚点清晰统一，适合后续短视频或剧集创作"
  },
  {
    id: "storyboard-sheet",
    label: "影视分镜表",
    hint: "景别、运镜、台词",
    category: "storyboard",
    style: "dream-cinematic",
    prompt: "把用户剧情整理成一张16:9影视分镜表，包含多格画面、镜头编号、景别、运镜、台词或旁白、时长提示。画面连续、人物一致、情绪递进清楚，适合短视频前期策划"
  },
  {
    id: "ad-storyboard",
    label: "广告分镜",
    hint: "品牌短片、卖点叙事",
    category: "storyboard",
    style: "product",
    prompt: "为用户品牌或产品生成一套广告分镜图，包含开场吸引、产品亮相、功能卖点、使用场景、情绪高潮和收尾记忆点。整体像高端品牌广告提案，产品形象稳定，镜头语言清楚"
  },
  {
    id: "cinematic-keyframes",
    label: "剧情关键帧组",
    hint: "连续镜头、统一风格",
    category: "storyboard",
    style: "dream-cinematic",
    prompt: "根据用户剧情生成一组连续电影关键帧，同一角色、同一世界观和统一光影色调，体现开端、冲突、转折、高潮和结尾。每格画面都像可继续转视频的稳定镜头"
  },
  {
    id: "game-ui-concept",
    label: "游戏UI概念",
    hint: "菜单、背包、地图",
    category: "game",
    style: "dream-cinematic",
    prompt: "生成一张16:9游戏UI概念设计图，包含主菜单、装备栏、技能树、HUD、任务日志、地图或设置等多个界面模块。主题、材质、图标、边框、按钮和色彩语言统一，像完整游戏美术提案"
  },
  {
    id: "gameplay-screenshot",
    label: "游戏实机截图",
    hint: "第一人称、剧情UI",
    category: "game",
    style: "dream-cinematic",
    prompt: "生成一张16:9高质量游戏实机截图，包含明确场景、角色或第一人称视角、HUD界面、剧情对话框或互动选项。画面像真实3A游戏截图，UI不遮挡主体，叙事情境清楚"
  },
  {
    id: "game-boss-scene",
    label: "Boss战场景",
    hint: "战斗、结算、地图",
    category: "game",
    style: "dream-cinematic",
    prompt: "生成一张游戏战斗或Boss战概念图，包含敌我关系、战斗环境、技能特效、生命条或结算界面元素。构图有压迫感和动作张力，UI与画面自然融合，不要杂乱堆满特效"
  },
  {
    id: "narrative-silhouette-poster",
    label: "叙事剪影海报",
    hint: "剪影填充世界观",
    category: "art",
    style: "dream-cinematic",
    prompt: "生成一张高级叙事剪影海报，用核心人物或物体剪影作为外轮廓，剪影内部填充与主题强绑定的世界观、场景、象征符号和关键关系。整体像电影收藏海报，双重曝光感，大面积留白，不要硬拼贴"
  },
  {
    id: "event-poster",
    label: "活动海报",
    hint: "头像、二维码、时间地点",
    category: "art",
    style: "product",
    prompt: "生成一张活动宣传海报，清晰呈现主题、时间、地点、主办方、嘉宾或人物头像、二维码区域和行动号召。若用户上传头像或二维码，必须尽量保留其可识别信息并自然融入版式，整体正式高级"
  },
  {
    id: "travel-guide-poster",
    label: "旅游攻略海报",
    hint: "路线、美食、小地图",
    category: "longform",
    style: "custom",
    prompt: "生成一张3:4或竖版旅游攻略海报，包含城市或景区主视觉、合理路线、景点、美食、时间安排、小地图或路线示意。信息分区清楚，文字简短，整体像可发布的小红书攻略图"
  },
  {
    id: "cultural-product-kit",
    label: "文创物料套装",
    hint: "贴纸、明信片、周边",
    category: "merch",
    style: "custom",
    prompt: "根据用户城市、品牌或主题生成一套文创物料设计，包括贴纸、明信片、包装、徽章、帆布袋、杯子或冰箱贴等。所有物料保持统一视觉语言、配色和图形元素，像完整商品企划板"
  },
  {
    id: "ecommerce-main-set",
    label: "电商主图套图",
    hint: "多张主图、卖点图",
    category: "product",
    style: "product",
    prompt: "基于参考产品生成一套电商主图视觉，包含白底主图、场景图、功能卖点图、材质细节图和使用前后对比图。必须保留产品形状、颜色、包装、Logo和核心卖点，画面高级且符合电商平台审美"
  },
  {
    id: "ecommerce-long-detail",
    label: "电商详情长图",
    hint: "1:3长图、功能说明",
    category: "product",
    style: "product",
    prompt: "生成一张1:3电商详情页长图，包含产品主视觉、核心卖点、功能场景、材质细节、参数模块和使用说明。信息层级清楚，图文节奏像真实详情页，避免空白占位和过密小字"
  },
  {
    id: "ecom-studio-main",
    label: "标准棚拍主图",
    hint: "白灰底、柔光、平台主图",
    category: "ecommercekit",
    style: "product",
    prompt: "基于参考产品生成标准电商棚拍主图，产品居中清晰展示，白色或浅灰背景，专业柔光棚拍，真实接触阴影，保留产品外观、包装、Logo、材质和比例，画面干净高级，适合平台首图"
  },
  {
    id: "ecom-lifestyle-ad",
    label: "生活方式种草图",
    hint: "小红书、氛围、真实场景",
    category: "ecommercekit",
    style: "realistic",
    prompt: "基于参考产品生成生活方式种草广告图，将产品自然放入真实生活场景中，强调用户情绪、自然光、环境质感和品牌调性。产品必须清晰可识别，场景服务产品，不喧宾夺主"
  },
  {
    id: "ecom-macro-detail",
    label: "产品微距细节",
    hint: "材质、开袋、局部特写",
    category: "ecommercekit",
    style: "product",
    prompt: "基于参考产品生成微距细节图，突出材质纹理、包装边缘、液体、粉末、纤维、金属或纸张等触感细节，可展示开袋、瓶口、标签、结构或使用痕迹。保持产品身份一致，细节真实可信"
  },
  {
    id: "ecom-craft-process",
    label: "匠人手作广告",
    hint: "双手、过程、工艺感",
    category: "ecommercekit",
    style: "dream-cinematic",
    prompt: "生成一张匠人手作或使用过程广告图，展示产品被制作、冲泡、使用、组装或体验的关键瞬间。加入真实双手、工具、蒸汽、材质和电影级光影，产品或品牌包装作为清晰视觉锚点"
  },
  {
    id: "ecom-derived-products",
    label: "品牌衍生品",
    hint: "杯子、袋子、蜡烛、周边",
    category: "ecommercekit",
    style: "product",
    prompt: "基于参考品牌或产品视觉，生成同一品牌调性的衍生品设计，如杯子、帆布袋、香氛蜡烛、包装盒、菜单、贴纸或礼盒。保持Logo、色彩、材质、字体气质统一，像完整品牌周边系列"
  },
  {
    id: "ecom-product-combo",
    label: "多产品组合摄影",
    hint: "展台、平铺、系列陈列",
    category: "ecommercekit",
    style: "product",
    prompt: "把多个参考产品或同一品牌系列自然组合成商业产品摄影画面，可使用展台、阶梯、平铺、Knolling整齐陈列或场景化摆放。主次关系明确，产品比例正确，阴影和材质真实，整体高级统一"
  },
  {
    id: "ecom-marketing-pack",
    label: "营销素材整套",
    hint: "主图、场景、海报、周边",
    category: "ecommercekit",
    style: "product",
    prompt: "基于参考产品生成一张完整营销素材展示板，包含标准棚拍主图、生活方式场景图、产品细节图、品牌海报、社媒种草图和衍生品应用。所有画面保持同一品牌视觉语言，像可交付的营销物料方案"
  },
  {
    id: "ecom-bg-replace-workflow",
    label: "产品换背景",
    hint: "产品不变，重建场景",
    category: "ecommerceflow",
    style: "product",
    prompt: "基于参考产品图进行电商产品换背景，严格保留产品形状、包装、Logo、材质、颜色和比例，只重建用户指定的新背景或商业场景。新场景需要匹配产品透视、接触阴影、反射、景深和光线，不能像抠图硬贴"
  },
  {
    id: "ecom-white-to-scene-workflow",
    label: "白底图生场景",
    hint: "白底产品变场景图",
    category: "ecommerceflow",
    style: "product",
    prompt: "将白底或干净背景的参考产品自然生成到用户指定的生活方式、电商广告或品牌场景中。保留产品主体真实外观、包装、Logo、材质和卖点，补充合理道具、环境、光影、接触阴影和商业构图，让画面像可直接发布的场景主图"
  },
  {
    id: "ecom-jewelry-tryon-workflow",
    label: "首饰上身",
    hint: "首饰/配饰自然佩戴",
    category: "ecommerceflow",
    style: "realistic",
    prompt: "根据参考首饰或配饰图和人物图，生成自然佩戴效果。保留首饰设计、材质、颜色、镶嵌结构和品牌细节，同时保留人物身份、肤色、姿态和比例。首饰要贴合耳朵、脖子、手腕、手指或衣物位置，遮挡、反光、阴影和尺度真实"
  },
  {
    id: "ecom-model-tryon-workflow",
    label: "模特换装",
    hint: "服装穿到模特身上",
    category: "ecommerceflow",
    style: "realistic",
    prompt: "根据参考服装图和模特图生成电商模特换装效果。保留模特身份、脸部、体型、姿势和肤色，保留服装款式、颜色、图案、材质和版型。服装需要自然贴合身体，褶皱、袖口、领口、下摆、遮挡、阴影和光线真实，避免平面贴图感"
  },
  {
    id: "ecom-object-transfer-workflow",
    label: "万物迁移",
    hint: "物体自然放入目标图",
    category: "ecommerceflow",
    style: "realistic",
    prompt: "从参考图中识别需要迁移的人物、产品、道具或物体，并自然放入用户指定或另一张参考图提供的目标场景。保留被迁移主体的身份、形状、颜色、材质、Logo和关键细节，同时匹配目标场景的透视、比例、遮挡、接触阴影、环境光和景深"
  },
  {
    id: "ecom-material-replace-workflow",
    label: "更换材质",
    hint: "材质图迁移到物体",
    category: "ecommerceflow",
    style: "product",
    prompt: "基于参考原图和材质参考图，将用户指定物体或区域替换为新的材质。保留原物体结构、轮廓、比例和功能形态，只改变表面材质、纹理、反射、粗糙度、颜色和质感。材质需要沿着物体体积和透视自然铺展，不能像平面贴纸"
  },
  {
    id: "ecom-pose-replication-workflow",
    label: "动作复刻",
    hint: "姿势参考，不换身份",
    category: "ecommerceflow",
    style: "realistic",
    prompt: "根据参考人物或模特生成动作复刻图。自动判断哪些参考图提供人物身份、哪些提供姿势和镜头角度。保留目标人物身份、脸部、体型、服装或品牌要求，只借鉴姿势参考中的动作、肢体方向、重心、手势、站姿、坐姿和构图，生成自然完整的人物或电商模特画面"
  },
  {
    id: "precise-image-edit",
    label: "精准改图",
    hint: "短字、数字、局部修改",
    category: "nanocases",
    style: "realistic",
    prompt: "基于参考图做精准局部修改，只改变用户明确指定的文字、数字、表情、动作、物体或局部区域，其他主体、构图、风格、光线和背景尽量保持一致。适合短文字和数字替换，不适合大段正文排版"
  },
  {
    id: "people-selfie-group",
    label: "人物合影",
    hint: "多人同框、自拍、拥抱",
    category: "nanocases",
    style: "realistic",
    prompt: "根据多张人物参考图生成自然同框合影、自拍或互动照片。自动识别每张图中的人物身份、年龄感、发型、脸部特征和气质，将他们放进同一个真实场景中，光线、比例、视角和互动关系自然，避免拼贴感"
  },
  {
    id: "expression-action-edit",
    label: "改表情动作",
    hint: "开心、坐下、拥抱、站起",
    category: "nanocases",
    style: "realistic",
    prompt: "基于参考图修改人物或角色的表情和动作，保留身份、服装、场景和画风，根据用户要求改成开心、生气、拥抱、坐下、站起、跑动、蹲下、吐舌头等状态。动作要符合身体结构、重心、手脚接触和场景逻辑"
  },
  {
    id: "model-wear-product",
    label: "模特穿戴产品",
    hint: "背包、墨镜、配饰",
    category: "nanocases",
    style: "realistic",
    prompt: "把参考产品自然穿戴或携带到参考模特身上，例如背包、墨镜、帽子、首饰、手表、鞋子、衣服或道具。保留模特身份和产品外观，产品位置、尺寸、遮挡、接触阴影、反光和光线要真实自然"
  },
  {
    id: "furniture-room-staging",
    label: "家具实景图",
    hint: "家具放进空房间",
    category: "nanocases",
    style: "realistic",
    prompt: "将多张参考家具按照合理布局自然放入参考空房间或室内空间。保留房间结构、墙面、地面、门窗和视角，保留家具形状、材质、颜色和比例，统一空间风格、光线方向、地面接触阴影和遮挡关系"
  },
  {
    id: "product-collab-design",
    label: "产品联名设计",
    hint: "主体产品 + 风格参考",
    category: "nanocases",
    style: "product",
    prompt: "以参考图中的产品为主体，参考另一张图的品牌风格、色彩、图案、材质、视觉符号或艺术语言，生成联名款、限定款、节日款或改色设计。必须保留主体产品结构和可识别形态，只迁移风格，不照抄他人商标"
  },
  {
    id: "character-figure-toy",
    label: "角色手办化",
    hint: "1/7手办、盲盒、桌面",
    category: "nanocases",
    style: "product",
    prompt: "将参考角色生成写实商业手办或潮玩产品图，1/7比例质感，放在真实电脑桌或展示台上，旁边可有对应盲盒包装，电脑屏幕可展示建模过程。保留角色发型、服装、配色、道具和气质，手办材质、底座、包装和场景真实高级"
  },
  {
    id: "sketch-to-finished-art",
    label: "草稿变高清",
    hint: "草图、线稿、涂鸦成品化",
    category: "nanocases",
    style: "custom",
    prompt: "将参考手绘草稿、线稿、低清概念图或涂鸦转化为高清成品图。保留原始构图、角色设计、主体关系和关键轮廓，补充干净线条、颜色、光影、材质、背景和细节，让画面成为完整可用的插画、概念图或产品图"
  },
  {
    id: "physics-time-effect",
    label: "物理变化推演",
    hint: "融化、烤焦、破损、变旧",
    category: "nanocases",
    style: "realistic",
    prompt: "根据用户描述生成物体经过时间、温度、阳光、水、撞击、燃烧、冷冻或使用后的真实变化效果，例如冰淇淋晒化、披萨烤焦、包装破损、金属生锈、纸张变旧。结果要符合基本物理逻辑、材质变化和真实环境光影"
  },
  {
    id: "menu-design",
    label: "菜单设计",
    hint: "餐饮菜单、价目表",
    category: "contentdesign",
    style: "product",
    prompt: "生成一张高级餐饮菜单或价目表设计，包含品牌主视觉、菜品分类、短菜名、价格区域、食物插图或摄影、装饰边框和清晰版式。文字只使用短标题、短标签和少量价格，不要生成大段中文正文，整体像可直接用于餐厅或外卖宣传的成品菜单"
  },
  {
    id: "invitation-business-card",
    label: "请柬名片",
    hint: "邀请函、名片、卡片",
    category: "contentdesign",
    style: "product",
    prompt: "生成一张精致请柬、名片或活动卡片设计，包含主标题区、姓名或品牌名、时间地点区域、联系方式或二维码占位、装饰纹理和清晰层级。只使用用户提供的姓名、电话、地址等真实信息，未提供的信息用装饰性短标签或留白处理，不要编造联系方式"
  },
  {
    id: "word-flash-card",
    label: "单词闪卡",
    hint: "英文单词、儿童学习卡",
    category: "contentdesign",
    style: "custom",
    prompt: "生成一张儿童或语言学习单词闪卡，包含一个醒目的英文单词、简短中文释义或音标区域、主题插图、例句短句和清爽卡片边框。英文优先清晰准确，中文只保留短标签，整体适合打印或课堂教学"
  },
  {
    id: "book-cover-kit",
    label: "书籍封面套图",
    hint: "平面封面、立体书封",
    category: "contentdesign",
    style: "product",
    prompt: "生成一套书籍封面展示图，可包含平面封面、立体书封、书脊、封底和桌面展示场景。根据用户主题设计封面主视觉、标题区、作者名区域、出版社或系列标识占位，文字尽量短而清晰，不编造 ISBN、出版社、奖项或推荐语"
  },
  {
    id: "overseas-ecommerce-poster",
    label: "海外电商海报",
    hint: "英文卖点、独立站、亚马逊",
    category: "contentdesign",
    style: "product",
    prompt: "生成一张海外电商英文促销海报，适合 Amazon、独立站、TikTok Shop 或社媒广告。以产品为主角，使用英文短卖点、价格/折扣区域、功能图标、生活方式场景和强购买氛围。英文文案短而清晰，避免中文长文和虚假认证"
  },
  {
    id: "ecommerce-data-selling-point",
    label: "电商数据卖点图",
    hint: "参数、营养、对比图",
    category: "contentdesign",
    style: "product",
    prompt: "生成一张电商详情页数据卖点图，用柱状图、对比卡、参数表、成分/材质示意、图标和产品主视觉展示卖点。保留用户提供的数据和单位，未提供的数据不要编造。文字使用短标题、短标签和数字，避免密集中文正文"
  },
  {
    id: "children-science-picturebook",
    label: "儿童科普绘本",
    hint: "儿童绘本、科普故事",
    category: "contentdesign",
    style: "anime",
    prompt: "生成一页儿童科普绘本或故事书插画，包含温暖童趣主视觉、简单场景、角色互动、少量短句或标题区域。画面亲切、清楚、适合儿童理解，知识点用短标签和图标表达，不生成大段正文"
  },
  {
    id: "sketch-to-app-ui",
    label: "手绘草图转UI",
    hint: "草图变App界面",
    category: "contentdesign",
    style: "custom",
    prompt: "根据参考手绘草图或线框图生成高质量移动端 App UI 设计稿。保留草图中的页面结构、导航、卡片、按钮和信息层级，补充现代视觉风格、图标、配色、圆角、阴影和真实内容占位。不要生成真实平台 Logo 或过密小字"
  },
  {
    id: "app-mockup-showcase",
    label: "App样机展示",
    hint: "手机样机、作品集展示",
    category: "contentdesign",
    style: "custom",
    prompt: "生成一张 App UI 样机展示图，把一个或多个手机界面放入高级作品集场景中。保持手机比例真实、界面风格统一、背景干净、有品牌色和展示标题区，适合小红书、Behance 或产品提案展示"
  },
  {
    id: "research-analysis-figure",
    label: "科研分析图例",
    hint: "分割、分类、遥感、医学",
    category: "contentdesign",
    style: "custom",
    prompt: "生成科研、教学或 AI 分析示意图，可表现医学影像分割、图像分类、语义分割、实例识别、深度估计、遥感识别或实验流程。画面应是清晰图例和方法示意，不伪造真实诊断结论、论文数据或权威实验结果，标签短而专业"
  },
  {
    id: "aesthetic-3d-cartoon-portrait",
    label: "三维卡通人像",
    hint: "3D动画级棚拍人像",
    category: "aesthetic",
    style: "dream-cinematic",
    prompt: "生成高级三维卡通棚拍人像，正面或半身构图，五官精致但保留自然气质，大眼神采、丝滑发丝、通透皮肤、柔和次表面散射、轮廓光和浅景深。整体像高端动画电影角色海报，干净背景，质感细腻，不要廉价塑料感"
  },
  {
    id: "aesthetic-kpop-studio-beauty",
    label: "韩流棚拍美学",
    hint: "精致偶像、发丝、瓷感皮肤",
    category: "aesthetic",
    style: "realistic",
    prompt: "生成韩流精致棚拍美学人像，干净纯色或浅色摄影棚背景，精修发丝、通透瓷感肤质、柔和腮红、自然高光、清爽妆容、时尚极简穿搭和精确轮廓光。构图居中高级，气质清冷明亮，避免过度磨皮和网红滤镜"
  },
  {
    id: "aesthetic-fine-brush-lady",
    label: "工笔仕女",
    hint: "国风古典叙事",
    category: "aesthetic",
    style: "custom",
    prompt: "生成国风工笔仕女或古典叙事画面，人物姿态含蓄优雅，衣纹、发饰、花草、屏风、亭台或古典器物精细克制。画面线条工整、设色雅致、留白讲究，有传统东方审美和故事感，不要现代网红脸和廉价古风影楼感"
  },
  {
    id: "aesthetic-wordless-picturebook",
    label: "无字绘本",
    hint: "靠画面讲故事",
    category: "aesthetic",
    style: "anime",
    prompt: "生成无字绘本风画面，用图像本身讲清楚一个简单故事或知识场景。圆润形状、手绘纹理、温暖低饱和色彩、清晰动作关系和画面节奏，不出现文字或单词。适合儿童理解，靠角色位置、颜色和动作传达信息"
  },
  {
    id: "aesthetic-riviera-fashion",
    label: "南法度假时尚",
    hint: "阳光、蓝白红、松弛高级",
    category: "aesthetic",
    style: "realistic",
    prompt: "生成南法度假风时尚大片，明亮夏日日光、浅米色石墙或海岸小镇、澄澈蓝天、蓝白红低对比配色、草编包、头巾、格纹、运动或休闲时装。人物全身入镜，姿态松弛但高级，画面像高端品牌度假季 campaign"
  },
  {
    id: "aesthetic-surreal-sculpture",
    label: "超现实雕塑",
    hint: "极简空间、装置艺术",
    category: "aesthetic",
    style: "custom",
    prompt: "生成超现实雕塑或当代装置艺术画面，主体被几何空间、白色墙体、洞口、框架、布料或单一材质包裹。极简构图，单一光源，强空间张力，强调身体、边界、空白和静默感，避免杂乱元素和常规海报排版"
  },
  {
    id: "aesthetic-eco-glass-surreal",
    label: "生态玻璃超现实",
    hint: "透明玻璃、植物、留白",
    category: "aesthetic",
    style: "dream-cinematic",
    prompt: "生成生态超现实主义画面，透明玻璃或半透明材质形成主体轮廓，内部有细小植物、嫩芽、光线或生命结构。背景干净，大量留白，柔和漫射光、玻璃高光、轻盈细腻的反射和纯净生命感，整体极简、通透、安静"
  },
  {
    id: "aesthetic-retro-healing-picturebook",
    label: "复古治愈绘本",
    hint: "铅笔排线、黑白、温暖",
    category: "aesthetic",
    style: "anime",
    prompt: "生成复古治愈绘本风插画，角色造型幼态圆润、轮廓柔和、表情克制可爱，大面积留白，石墨铅笔或纸张纹理，细腻交叉排线，低饱和或黑白画面。整体温暖、安静、含蓄幽默，不要尖锐攻击性和过度商业卡通感"
  },
  {
    id: "aesthetic-inflatable-surreal-product",
    label: "充气超现实产品",
    hint: "橡胶光泽、潮玩橱窗",
    category: "aesthetic",
    style: "product",
    prompt: "生成充气超现实主义产品或时尚视觉，主体呈现柔软膨胀、橡胶高光、乳胶或气囊质感，搭配极简橱窗、绿色地毯、纯色背景或潮玩展示台。画面像高端时装橱窗和艺术装置结合，避免复制真实品牌标志"
  },
  {
    id: "aesthetic-british-linocut",
    label: "复古英伦版画",
    hint: "低维几何、排线、纸感",
    category: "aesthetic",
    style: "custom",
    prompt: "生成复古英伦版画风插画，低维几何构图、简化建筑或街景、清冷低饱和色调、手工刻痕、排线纹理和纸张颗粒感。整体安静、有书籍装帧气质和现代复古感，不直接模仿具体艺术家"
  },
  {
    id: "aesthetic-graffiti-pop",
    label: "涂鸦波普",
    hint: "粗线、符号、强节奏",
    category: "aesthetic",
    style: "custom",
    prompt: "生成涂鸦波普艺术风画面，粗重黑色轮廓、平面无透视造型、高饱和平涂色彩、重复符号、动作线、放射线和街头能量。适合海报、社媒图、潮流插画和幽默视觉，不复制真实艺术家签名或商标"
  },
  {
    id: "knowledge-encyclopedia",
    label: "科普百科图",
    hint: "图鉴、模块信息",
    category: "longform",
    style: "custom",
    prompt: "根据用户主题生成一张高质量科普百科信息图，包含主题主视觉、基础档案、特征放大、分类信息、评分卡、注意事项和要点总结。浅色干净背景，圆角模块，信息丰富但不拥挤，像可收藏的百科图鉴"
  },
  {
    id: "life-timeline",
    label: "人物生平图",
    hint: "阶段、地点、作品",
    category: "longform",
    style: "custom",
    prompt: "为用户指定人物生成一张人物生平时间线长图，展示人生阶段、重要地点、代表作品、关键事件和后世影响。风格根据人物气质自动适配，结构清楚，具有收藏和科普价值"
  },
  {
    id: "event-long-timeline",
    label: "事件时间线长图",
    hint: "发展历程、发布记录",
    category: "longform",
    style: "custom",
    prompt: "生成一张事件或行业发展时间线长图，按时间顺序梳理关键节点、代表事件、影响和阶段结论。排版适合公众号、小红书或培训资料，信息准确优先，避免编造具体事实"
  },
  {
    id: "guofeng-atlas",
    label: "国风图鉴长图",
    hint: "古卷、神兽、分类",
    category: "longform",
    style: "custom",
    prompt: "生成一张国风复古图鉴长图，包含多个分类栏目、主题插画、局部细节、短标签和古卷式分栏排版。适合山海经、诗词、历史文化、非遗或民俗主题，风格统一且信息结构清楚"
  },
  {
    id: "home-design",
    label: "家居设计",
    hint: "家具、空间改造",
    category: "architecture",
    style: "realistic",
    prompt: "根据参考空间或家具生成写实家居效果图，保留空间结构和比例，优化材质、灯光、软装和色彩搭配，像室内设计成品图"
  },
  {
    id: "furniture-placement",
    label: "家具入景",
    hint: "家具放进空间",
    category: "architecture",
    style: "realistic",
    prompt: "将参考家具自然放入参考室内空间，保持家具真实形态、材质和比例，匹配房间透视、地面接触阴影和环境光"
  },
  {
    id: "old-photo-restore",
    label: "老照片修复",
    hint: "修复、上色",
    category: "portrait",
    style: "realistic",
    prompt: "修复参考老照片，提升清晰度、补全破损、自然上色，保留人物身份、年代感和原始构图，不要过度磨皮或现代化"
  },
  {
    id: "colorize-sketch",
    label: "草稿上色",
    hint: "线稿、漫画上色",
    category: "anime",
    style: "anime",
    prompt: "根据参考草稿或线稿生成完整上色图，保留原始构图、角色设计和线条关系，补充干净色彩、光影、材质和背景氛围"
  },
  {
    id: "keyframe",
    label: "短视频关键帧",
    hint: "后续转视频更稳",
    category: "future",
    style: "dream-cinematic",
    prompt: "电影关键帧，主体动作明确，场景稳定，光线方向清楚，可继续转成视频镜头"
  }
];

const templateCategoryLabels = {
  custom: "基础",
  portrait: "人像处理",
  product: "电商产品",
  art: "海报卡片",
  ppt: "PPT设计",
  pptopt: "PPT配图优化",
  refedit: "参考图精修",
  infographic: "信息图表",
  assets: "视觉资产",
  knowledge: "知识教学",
  engineering: "产品工程",
  brandui: "品牌UI",
  stickers: "写真贴纸",
  storyboard: "故事分镜",
  game: "游戏概念",
  longform: "长图图鉴",
  merch: "文创物料",
  ecommercekit: "电商营销套图",
  ecommerceflow: "电商参考图工作流",
  nanocases: "参考图爆款玩法",
  contentdesign: "图文设计与商业物料",
  aesthetic: "高级风格美学",
  anime: "动漫线稿",
  architecture: "空间家居",
  nature: "风景场景",
  future: "短视频"
};

const templateCategoryOrder = [
  "custom",
  "ppt",
  "pptopt",
  "refedit",
  "infographic",
  "assets",
  "knowledge",
  "engineering",
  "brandui",
  "stickers",
  "storyboard",
  "game",
  "longform",
  "merch",
  "ecommercekit",
  "ecommerceflow",
  "nanocases",
  "contentdesign",
  "aesthetic",
  "portrait",
  "product",
  "art",
  "anime",
  "architecture",
  "nature",
  "future"
];

const templateGroups = templateCategoryOrder
  .map((category) => ({
    id: category,
    label: templateCategoryLabels[category] || category,
    templates: templatePresets.filter((template) => template.category === category)
  }))
  .filter((group) => group.templates.length > 0);

function detectInitialLanguage() {
  const saved = localStorage.getItem(languageKey);
  if (saved === "en" || saved === "zh") return saved;
  return navigator.language?.toLowerCase().startsWith("en") ? "en" : "zh";
}

function App() {
  const [language, setLanguage] = useState(detectInitialLanguage);
  const [form, setForm] = useState(defaults);
  const [job, setJob] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey) || "");
  const [user, setUser] = useState(null);
  const [models, setModels] = useState(fallbackModels);
  const [authOpen, setAuthOpen] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ account: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemMessage, setRedeemMessage] = useState("");
  const [memberTab, setMemberTab] = useState("redeem");
  const [selectedRechargeAmount, setSelectedRechargeAmount] = useState(10);
  const [rechargeOrder, setRechargeOrder] = useState(null);
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [rechargeMessage, setRechargeMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyImageStatus, setHistoryImageStatus] = useState({});
  const [historyPreview, setHistoryPreview] = useState(null);
  const [downloadingImageId, setDownloadingImageId] = useState("");
  const [policyOpen, setPolicyOpen] = useState(null);
  const [reportForm, setReportForm] = useState({ type: "违法违规内容", contact: "", content: "" });
  const [reportMessage, setReportMessage] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [pasteMessage, setPasteMessage] = useState("");
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState(null);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementPanelOpen, setAnnouncementPanelOpen] = useState(false);
  const [announcementHistory, setAnnouncementHistory] = useState([]);
  const [announcementHistoryLoading, setAnnouncementHistoryLoading] = useState(false);
  const fileInputRef = useRef(null);
  const templateMenuRef = useRef(null);
  const text = uiText[language] || uiText.zh;

  function t(key) {
    return text[key] || uiText.zh[key] || key;
  }

  function templateLabel(template) {
    if (!template) return t("custom");
    return templateText[language]?.[template.id]?.[0] || template.label || t("custom");
  }

  function templateHint(template) {
    if (!template) return "";
    return templateText[language]?.[template.id]?.[1] || template.hint || "";
  }

  function templateGroupLabel(group) {
    return categoryText[language]?.[group.id] || group.label;
  }

  function announcementText(item, key) {
    if (!item) return "";
    if (language === "en") {
      if (key === "title") return item.titleEn || t("siteAnnouncement");
      if (key === "content") return item.contentEn || translateAnnouncementContent(item.content);
      if (key === "buttonLabel") return item.buttonLabelEn || t("gotIt");
    }
    if (key === "title") return item.title || t("siteAnnouncement");
    if (key === "content") return item.content || "";
    if (key === "buttonLabel") return item.buttonLabel || t("gotIt");
    return "";
  }

  function modelLabel(model) {
    return localizedModelLabel(model?.id, model?.label, language);
  }

  function qualityDescription(option) {
    return modelText[language]?.[option.id] || option.description;
  }

  function switchLanguage() {
    const next = language === "en" ? "zh" : "en";
    localStorage.setItem(languageKey, next);
    setLanguage(next);
  }

  useEffect(() => {
    document.documentElement.lang = language === "en" ? "en" : "zh-CN";
    document.title = language === "en"
      ? "DreamForge AI Image Studio"
      : "DreamForge 梦境 AI 图片生成工具";
  }, [language]);

  useEffect(() => {
    window.scrollTo(0, 0);
    refreshSession();
    loadAnnouncement();
  }, []);

  useEffect(() => {
    if (!templateMenuOpen) return undefined;
    function closeTemplateMenu(event) {
      if (!templateMenuRef.current?.contains(event.target)) {
        setTemplateMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeTemplateMenu);
    return () => document.removeEventListener("pointerdown", closeTemplateMenu);
  }, [templateMenuOpen]);

  useEffect(() => {
    if (!token || !rechargeOrder?.id || !["created", "pending"].includes(rechargeOrder.status)) return undefined;
    const timer = window.setInterval(() => {
      refreshRechargeOrder(rechargeOrder.id);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [token, rechargeOrder?.id, rechargeOrder?.status]);

  const selectedModel = useMemo(
    () => models.find((item) => item.id === form.model) || fallbackModels[0],
    [models, form.model]
  );

  const gptQualityOptions = selectedModel.qualityOptions || [];
  const currentCost = useMemo(() => {
    const perImageCost = gptQualityOptions.find((item) => item.id === form.gptQuality)?.creditCost ?? selectedModel.creditCost ?? 1;
    return perImageCost * Number(form.count || 1);
  }, [selectedModel, gptQualityOptions, form.gptQuality, form.count]);

  const activeImageData = job?.images?.[activeImage];
  const activeImageMeta = activeImageData
    ? `${activeImageData.width || 1024} x ${activeImageData.height || 1024}`
    : "";
  const activeTemplate = templatePresets.find((template) => template.id === form.promptTemplate) || templatePresets[0];
  const promptRatio = useMemo(() => inferRatioFromPrompt(form.prompt), [form.prompt]);
  const ratioConflict = Boolean(promptRatio && form.ratioLocked && promptRatio !== form.ratio);
  const ratioAutoMatched = Boolean(promptRatio && !form.ratioLocked && promptRatio === form.ratio);

  useEffect(() => {
    if (!promptRatio) return;
    setForm((current) => {
      if (current.ratioLocked || current.ratio === promptRatio) return current;
      return { ...current, ratio: promptRatio };
    });
  }, [promptRatio]);

  async function refreshSession() {
    const savedToken = localStorage.getItem(tokenKey);
    try {
      const response = await fetch(`${apiBase}/api/auth/me`, {
        headers: savedToken ? { Authorization: `Bearer ${savedToken}` } : {},
        cache: "no-store"
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(localizeMessage(data.error || "请先登录", language));
      setToken(savedToken);
      setUser(data.user);
      setModels(data.models || fallbackModels);
      setAuthOpen(false);
    } catch {
      localStorage.removeItem(tokenKey);
      setToken("");
      setUser(null);
      setAuthOpen(true);
    }
  }

  async function loadAnnouncement() {
    try {
      const response = await fetch(`${apiBase}/api/announcement`, { cache: "no-store" });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(localizeMessage(data.error || "公告读取失败", language));
      const item = data.announcement;
      setAnnouncement(item || null);
      if (shouldShowAnnouncement(item)) {
        setAnnouncementOpen(true);
      }
    } catch {
      setAnnouncement(null);
      setAnnouncementOpen(false);
    }
  }

  function shouldShowAnnouncement(item) {
    if (!item?.enabled || !announcementText(item, "content")) return false;
    const version = item.version || "1";
    return localStorage.getItem(`${announcementDismissPrefix}${version}`) !== "1";
  }

  function dismissAnnouncement() {
    if (announcement?.version) {
      localStorage.setItem(`${announcementDismissPrefix}${announcement.version}`, "1");
    }
    setAnnouncementOpen(false);
  }

  function closeAnnouncementOverlay() {
    setAnnouncementOpen(false);
  }

  function handleAnnouncementOverlayKeyDown(event) {
    if (event.key === "Escape") {
      closeAnnouncementOverlay();
    }
  }

  async function openAnnouncementPanel() {
    setAnnouncementPanelOpen(true);
    setAnnouncementHistoryLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/announcements`, { cache: "no-store" });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(localizeMessage(data.error || "公告读取失败", language));
      setAnnouncement(data.announcement || null);
      setAnnouncementHistory(data.history || []);
    } catch {
      setAnnouncementHistory([]);
    } finally {
      setAnnouncementHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (!announcementOpen) return undefined;
    window.addEventListener("keydown", handleAnnouncementOverlayKeyDown);
    return () => window.removeEventListener("keydown", handleAnnouncementOverlayKeyDown);
  }, [announcementOpen]);

  async function submit(event) {
    event?.preventDefault();
    if (!user || !token) {
      setAuthOpen(true);
      setError(localizeMessage("请先登录后再生成图片", language));
      return;
    }

    setLoading(true);
    setError("");
    setRedeemMessage("");

    try {
      const effectiveRatio = getEffectiveRatio(form);
      const submitForm = { ...form, ratio: effectiveRatio };
      const response = await fetch(`${apiBase}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...submitForm,
          promptTemplateLabel: activeTemplate?.label || "自定义"
        })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(localizeMessage(data.error || "生成失败", language));
      setJob(data);
      setUser(data.user);
      setActiveImage(0);
      loadHistory(token);
      trackEvent("generate_image", { model: submitForm.model || "unknown" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(event) {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");
    try {
      const response = await fetch(`${apiBase}/api/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm)
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(localizeMessage(data.error || "操作失败", language));
      localStorage.setItem(tokenKey, data.token);
      setToken(data.token);
      setUser(data.user);
      setAuthOpen(false);
      setRedeemMessage("");
      trackEvent(authMode === "register" ? "sign_up" : "login", { method: "account" });
      await refreshSession();
    } catch (err) {
      setAuthError(err.message);
    }
  }

  async function redeemCredits(event) {
    event.preventDefault();
    if (!token) {
      setAuthOpen(true);
      return;
    }
    setRedeemMessage("");
    setError("");

    try {
      const response = await fetch(`${apiBase}/api/redeem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: redeemCode })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(localizeMessage(data.error || "兑换失败", language));
      setUser(data.user);
      setRedeemCode("");
      setRedeemMessage(language === "en" ? `Redeemed successfully. Added ${data.creditsAdded} credits.` : data.message || `兑换成功，增加 ${data.creditsAdded} 积分`);
    } catch (err) {
      setRedeemMessage(err.message);
    }
  }

  async function createWechatRecharge() {
    if (!token) {
      setAuthOpen(true);
      return;
    }
    setRechargeLoading(true);
    setRechargeMessage("");
    setRedeemMessage("");
    try {
      const response = await fetch(`${apiBase}/api/recharge/wechat/native`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amountYuan: selectedRechargeAmount })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(localizeMessage(data.error || "微信充值订单创建失败", language));
      setRechargeOrder(data.order);
      setRechargeMessage(language === "en" ? "Please scan with WeChat Pay. Credits are added after admin confirmation." : "请使用微信扫码支付，付款后等待管理员确认到账。");
      trackEvent("begin_checkout", { value: Number(selectedRechargeAmount) || 0, currency: "CNY" });
    } catch (err) {
      setRechargeMessage(err.message);
    } finally {
      setRechargeLoading(false);
    }
  }

  async function refreshRechargeOrder(orderId = rechargeOrder?.id) {
    if (!token || !orderId) return;
    try {
      const response = await fetch(`${apiBase}/api/recharge/orders/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(localizeMessage(data.error || "充值订单读取失败", language));
      setRechargeOrder(data.order);
      if (data.user) setUser(data.user);
      if (data.order?.status === "paid") {
        setRechargeMessage(language === "en" ? `Recharge confirmed. ${data.order.credits} credits added.` : `充值成功，已到账 ${data.order.credits} 积分。`);
        if (!trackedPaidOrders.has(data.order.id)) {
          trackedPaidOrders.add(data.order.id);
          trackEvent("purchase", {
            value: Number(data.order.amountYuan ?? data.order.credits) || 0,
            currency: "CNY",
            transaction_id: String(data.order.id)
          });
        }
      } else if (data.order?.status === "failed") {
        setRechargeMessage(localizeMessage(data.order.error || "充值订单已关闭或失败，请重新下单。", language));
      }
    } catch (err) {
      setRechargeMessage(err.message);
    }
  }

  function logout() {
    localStorage.removeItem(tokenKey);
    setToken("");
    setUser(null);
    setHistory([]);
    setHistoryHasMore(false);
    setAuthOpen(true);
  }

  async function loadHistory(authToken = token, options = {}) {
    if (!authToken) return;
    const append = Boolean(options.append);
    const offset = append ? history.length : 0;
    setHistoryLoading(true);
    setHistoryError("");
    if (!append) setHistoryImageStatus({});
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const params = new URLSearchParams({
        limit: String(historyPageSize),
        offset: String(offset)
      });
      const response = await fetch(`${apiBase}/api/history?${params.toString()}`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store",
        signal: controller.signal
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(localizeMessage(data.error || "历史记录读取失败", language));
      setHistory((current) => (append ? [...current, ...(data.history || [])] : data.history || []));
      setHistoryHasMore(Boolean(data.hasMore));
    } catch (err) {
      setHistoryError(err.name === "AbortError" ? localizeMessage("历史记录读取超时，请稍后刷新。", language) : localizeMessage(err.message, language));
    } finally {
      window.clearTimeout(timeoutId);
      setHistoryLoading(false);
    }
  }

  function markHistoryImage(id, status) {
    setHistoryImageStatus((current) => ({ ...current, [id]: status }));
  }

  function openMember(tab = "redeem") {
    setMemberTab(tab);
    setAuthOpen(true);
    if (tab === "history" && token) loadHistory(token);
  }

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateRatio(value) {
    setForm((current) => ({ ...current, ratio: value, ratioLocked: true }));
  }

  function usePromptRatio() {
    if (!promptRatio) return;
    setForm((current) => ({ ...current, ratio: promptRatio, ratioLocked: true }));
  }

  function chooseModel(modelId) {
    setForm((current) => ({
      ...current,
      model: modelId,
      gptQuality: resolveModelQuality(modelId, current.gptQuality)
    }));
  }

  function resolveModelQuality(modelId, currentQuality) {
    const model = models.find((item) => item.id === modelId) || fallbackModels.find((item) => item.id === modelId);
    const options = model?.qualityOptions || [];
    if (!options.length) return currentQuality || "1k";
    return options.some((item) => item.id === currentQuality) ? currentQuality : options[0].id;
  }

  async function addReferenceFiles(files, source = "upload") {
    const imageFiles = Array.from(files || []).filter((file) => file?.type?.startsWith("image/"));
    if (!imageFiles.length) return 0;
    const openSlots = maxReferences - form.references.length;
    if (openSlots <= 0) {
      if (source === "paste") {
        setPasteMessage(language === "en" ? `You can upload up to ${maxReferences} reference images.` : `参考图最多 ${maxReferences} 张，已达到上限`);
      }
      return 0;
    }

    const selected = imageFiles.slice(0, openSlots);
    const references = await Promise.all(selected.map(readReferenceFile));
    setForm((current) => ({
      ...current,
      references: [...current.references, ...references].slice(0, maxReferences)
    }));
    if (source === "paste") {
      const extra = imageFiles.length > selected.length
        ? language === "en"
          ? ` Ignored ${imageFiles.length - selected.length} image(s) over the limit.`
          : `，已忽略 ${imageFiles.length - selected.length} 张超出上限的图片`
        : "";
      setPasteMessage(language === "en" ? `Added ${references.length} pasted image(s) to references.${extra}` : `已添加 ${references.length} 张粘贴图片到参考图${extra}`);
      setError("");
    }
    return references.length;
  }

  async function handleFiles(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    await addReferenceFiles(files);
    event.target.value = "";
  }

  async function handlePromptPaste(event) {
    const clipboard = event.clipboardData;
    if (!clipboard) return;

    const itemFiles = Array.from(clipboard.items || [])
      .filter((item) => item.kind === "file" && item.type?.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean);
    const files = itemFiles.length
      ? itemFiles
      : Array.from(clipboard.files || []).filter((file) => file.type?.startsWith("image/"));

    if (!files.length) return;
    event.preventDefault();
    try {
      await addReferenceFiles(files, "paste");
    } catch (err) {
      setError(localizeMessage(err.message || "粘贴参考图失败", language));
    }
  }

  function removeReference(id) {
    setForm((current) => ({
      ...current,
      references: current.references.filter((item) => item.id !== id)
    }));
  }

  function updateReferenceUsage(id, usage) {
    setForm((current) => ({
      ...current,
      references: current.references.map((item) => (item.id === id ? { ...item, usage } : item))
    }));
  }

  function applyTemplate(template) {
    setForm((current) => ({
      ...current,
      promptTemplate: template.id,
      category: template.category || current.category,
      style: template.style || current.style,
      prompt: language === "en"
        ? current.prompt
        : template.prompt && (!current.prompt || current.prompt === defaults.prompt)
          ? template.prompt
          : current.prompt
    }));
  }

  function chooseTemplate(id) {
    const template = templatePresets.find((item) => item.id === id);
    if (template) {
      applyTemplate(template);
      setTemplateMenuOpen(false);
    }
  }

  function reuseHistory(item) {
    setHistoryPreview(null);
    setForm((current) => ({
      ...current,
      prompt: item.prompt || current.prompt,
      ratio: item.ratio || current.ratio,
      style: item.style || current.style,
      promptTemplate: item.promptTemplate || "custom",
      model: item.modelId || current.model
    }));
    setAuthOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function downloadImage(url, filename, imageId = url) {
    if (!url) return;
    setDownloadingImageId(imageId);
    try {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) throw new Error("download failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename || "dreamforge-image.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingImageId("");
    }
  }

  function applyCategory(id) {
    const categoryPrompts = {
      custom: "",
      fantasy: "奇幻世界，神秘古城，发光花瓣，史诗级构图，梦幻电影感",
      future: "未来科技城市，蓝紫霓虹，透明屏幕，赛博空间，高级科幻概念图",
      portrait: "精致人物肖像，柔和轮廓光，细腻皮肤质感，情绪明确，超清细节",
      anime: "高质量动漫艺术，华丽角色设定，丰富色彩，干净线条，动态光影",
      nature: "自然风光，云海山脉，清晨光线，广角镜头，宁静而震撼",
      architecture: "幻想建筑设计，巨型空间，精密结构，建筑可视化，电影级环境",
      product: "未来感产品设计，透明材质，柔和棚拍光，高级广告视觉",
      art: "艺术创作，抽象梦境，强烈色彩关系，画廊级视觉，超现实构图"
    };
    setForm((current) => ({
      ...current,
      category: id,
      prompt: categoryPrompts[id] || current.prompt,
      promptTemplate: id === "custom" ? "custom" : current.promptTemplate
    }));
  }

  async function submitReport(event) {
    event.preventDefault();
    setReportLoading(true);
    setReportMessage("");
    try {
      const response = await fetch(`${apiBase}/api/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportForm)
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(localizeMessage(data.error || "提交失败", language));
      setReportMessage(language === "en" ? "Submitted." : data.message || "已提交");
      setReportForm({ type: "违法违规内容", contact: "", content: "" });
    } catch (err) {
      setReportMessage(err.message);
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <main className="dream-page">
      <nav className="top-nav">
        <a className="logo" href="/">
          <span>Dream</span>Forge
        </a>
        <div className="nav-actions">
          <button className="language-button" type="button" onClick={switchLanguage} aria-label={t("switchLanguage")}>
            <Languages size={15} />
            {t("language")}
          </button>
          <button className="member-button announcement-button" type="button" onClick={openAnnouncementPanel}>
            <Bell size={16} />
            {t("navAnnouncement")}
          </button>
          <button className="member-button" type="button" onClick={() => openMember("history")}>
            <Crown size={16} />
            {t("memberCenter")}
          </button>
          {user ? (
            <div className="user-chip">
              <UserRound size={16} />
              <span>{user.account}</span>
              <strong>{user.credits} {t("credits")}</strong>
              <button type="button" onClick={logout} title={language === "en" ? "Log out" : "退出登录"}>
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button className="login-button" type="button" onClick={() => openMember("redeem")}>
              {t("loginRegister")}
            </button>
          )}
        </div>
      </nav>

      <section className="hero">
        <div className="mosaic" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, index) => (
            <div className={`art-card card-${index + 1}`} key={index} />
          ))}
        </div>
        <div className="shade" />

        <div className="hero-content">
          <h1>{t("heroTitle")}</h1>
          <p>{t("heroSubtitle")}</p>

          <form className={templateMenuOpen ? "prompt-console menu-open" : "prompt-console"} onSubmit={submit}>
            <div className="model-switch" aria-label={t("modelAria")}>
              {models.map((model) => {
                const modelCost =
                  model.id === "gpt-image-2"
                    ? `${model.qualityOptions?.[0]?.creditCost || 2}-${model.qualityOptions?.[model.qualityOptions.length - 1]?.creditCost || 5}`
                    : model.creditCost;
                return (
                  <button
                    type="button"
                    className={form.model === model.id ? "model-pill active" : "model-pill"}
                    key={model.id}
                    onClick={() => chooseModel(model.id)}
                  >
                    <strong>{modelLabel(model)}</strong>
                    <span>{Number(modelCost) === 0 ? t("freePerImage") : `${modelCost} ${t("creditsPerImage")}`}</span>
                  </button>
                );
              })}
            </div>

            {gptQualityOptions.length > 0 && (
              <div className="quality-switch" aria-label={`${modelLabel(selectedModel)} ${t("qualityAriaSuffix")}`}>
                {gptQualityOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={form.gptQuality === option.id ? "quality-pill active" : "quality-pill"}
                    onClick={() => update("gptQuality", option.id)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.creditCost} {t("credits")}</span>
                  </button>
                ))}
              </div>
            )}

            <div className={templateMenuOpen ? "template-picker open" : "template-picker"} ref={templateMenuRef}>
              <label id="template-select-label">
                <WandSparkles size={16} />
                {t("templateLabel")}
              </label>
              <div className={templateMenuOpen ? "template-select-wrap open" : "template-select-wrap"}>
                <button
                  type="button"
                  className="template-trigger"
                  aria-haspopup="listbox"
                  aria-expanded={templateMenuOpen}
                  aria-labelledby="template-select-label"
                  onClick={() => setTemplateMenuOpen((open) => !open)}
                >
                  <span>
                    <strong>{templateLabel(activeTemplate)}</strong>
                    {templateHint(activeTemplate) ? <small>{templateHint(activeTemplate)}</small> : null}
                  </span>
                  <ChevronDown size={18} />
                </button>
                {templateMenuOpen && (
                  <div className="template-menu" role="listbox" aria-labelledby="template-select-label">
                    {templateGroups.map((group) => (
                      <section className="template-menu-group" key={group.id}>
                        <p>{templateGroupLabel(group)}</p>
                        {group.templates.map((template) => (
                          <button
                            type="button"
                            role="option"
                            aria-selected={form.promptTemplate === template.id}
                            className={form.promptTemplate === template.id ? "template-option active" : "template-option"}
                            key={template.id}
                            onClick={() => chooseTemplate(template.id)}
                          >
                            <span>
                              <strong>{templateLabel(template)}</strong>
                              {templateHint(template) ? <small>{templateHint(template)}</small> : null}
                            </span>
                            {form.promptTemplate === template.id ? <Check size={15} /> : null}
                          </button>
                        ))}
                      </section>
                    ))}
                  </div>
                )}
              </div>
              {templateHint(activeTemplate) ? <p>{templateHint(activeTemplate)}</p> : null}
            </div>

            <div className="prompt-main">
              <Sparkles size={22} />
              <textarea
                value={form.prompt}
                onChange={(event) => update("prompt", event.target.value)}
                onPaste={handlePromptPaste}
                placeholder={t("promptPlaceholder")}
                rows={1}
              />
              <button className="generate-button" type="submit" disabled={loading}>
                {loading ? <Loader2 className="spin" size={20} /> : null}
                {loading ? t("generating") : `${t("generateNow")} · ${currentCost === 0 ? t("free") : `${currentCost} ${t("credits")}`}`}
              </button>
            </div>
            {(ratioAutoMatched || ratioConflict) && (
              <div className={ratioConflict ? "ratio-intent-tip conflict" : "ratio-intent-tip"}>
                <Sparkles size={14} />
                <span>
                  {ratioConflict
                    ? `${t("ratioManualPrefix")} ${ratioLabel(promptRatio, language)}${t("ratioManualMiddle")} ${ratioLabel(form.ratio, language)}${t("ratioManualSuffix")}`
                    : `${t("ratioAutoPrefix")} ${ratioLabel(form.ratio, language)}。`}
                </span>
                {ratioConflict && (
                  <button type="button" onClick={usePromptRatio}>
                    {t("switchTo")} {ratioLabel(promptRatio, language)}
                  </button>
                )}
              </div>
            )}

            <div className="reference-row">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFiles}
                hidden
              />
              <button
                className="upload-tile"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={form.references.length >= maxReferences}
              >
                <ImagePlus size={18} />
                {t("referenceButton")} {form.references.length}/{maxReferences}
              </button>
              <span className="paste-hint">{t("pasteHint")}</span>
              {form.references.map((item) => (
                <div className="reference-thumb" key={item.id}>
                  <img src={item.preview} alt={item.name} />
                  <button type="button" onClick={() => removeReference(item.id)} title={t("removeReference")}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            {pasteMessage && <div className="paste-feedback">{pasteMessage}</div>}
            {form.references.length > 0 && (
              <div className="reference-usage-list">
                {form.references.map((item, index) => (
                  <label className="reference-usage-item" key={`${item.id}_usage`}>
                    <span>{t("referenceIndex")}{index + 1}</span>
                    <input
                      value={item.usage || ""}
                      onChange={(event) => updateReferenceUsage(item.id, event.target.value)}
                      placeholder={t("referenceUsagePlaceholder")}
                      maxLength={120}
                    />
                  </label>
                ))}
              </div>
            )}
            {form.references.length > 0 && (
              <div className="reference-intel">
                <Sparkles size={15} />
                <span>{t("referenceIntel")}</span>
              </div>
            )}

            <div className="compact-settings">
              <select value={form.style} onChange={(event) => update("style", event.target.value)}>
                {Object.entries(styleLabels[language] || styleLabels.zh).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select value={form.ratio} onChange={(event) => updateRatio(event.target.value)}>
                <option value="16:9">{ratioLabel("16:9", language)}</option>
                <option value="1:1">{ratioLabel("1:1", language)}</option>
                <option value="9:16">{ratioLabel("9:16", language)}</option>
                <option value="3:4">{ratioLabel("3:4", language)}</option>
              </select>
              <select value={form.count} onChange={(event) => update("count", Number(event.target.value))}>
                <option value={1}>1 {language === "en" ? "image" : "张"}</option>
                <option value={2}>2 {language === "en" ? "images" : "张"}</option>
                <option value={3}>3 {language === "en" ? "images" : "张"}</option>
              </select>
            </div>
          </form>

          {error && <p className="error-text">{error}</p>}

          <div className="template-guidance">
            <Sparkles size={16} />
            <span>{t("templateGuidance")}</span>
          </div>
        </div>
      </section>

      {job?.images?.length ? (
        <section className="result-sheet">
          <div className="result-header">
            <div>
              <p>
                {localizedModelLabel(job.input?.model, job.modelLabel || job.input?.model, language)} · {t("deducted")} {job.creditCost} {t("credits")} · {t("remaining")} {job.remainingCredits} {t("credits")}
              </p>
              <h2>{t("resultTitle")}</h2>
            </div>
            <div className="result-toolbar" aria-label={t("resultTitle")}>
              {activeImageMeta && <span>{activeImageMeta}</span>}
              <span>{job.input?.ratio || "1:1"}</span>
              {job.input?.gptQuality && <span>{qualityLabel(job.input.gptQuality, language)}</span>}
              <span>{job.input?.references?.length || 0} {t("referenceCountSuffix")}</span>
              {activeImageData && (
                <button className="download-button" type="button" onClick={() => downloadImage(activeImageData.url, `${job.id}_${activeImage + 1}.png`, activeImageData.id)} disabled={downloadingImageId === activeImageData.id}>
                  <Download size={18} />
                  {t("download")}
                </button>
              )}
            </div>
          </div>
          {job.referencePlan?.source && (
            <div className="generation-intel">
              <Sparkles size={16} />
              <span>{referencePlanLabel(job.referencePlan, language)}</span>
            </div>
          )}

          <div className="result-grid">
            {job.images.map((image, index) => (
              <button
                type="button"
                className={activeImage === index ? "result-card active" : "result-card"}
                key={image.id}
                onClick={() => setActiveImage(index)}
              >
                <img src={image.url} alt={t("resultTitle")} />
              </button>
            ))}
          </div>

        </section>
      ) : null}

      <footer className="site-footer">
        <div>
          <strong>{t("footerTitle")}</strong>
          <span>{t("footerNote")}</span>
        </div>
        <nav>
          <button type="button" onClick={() => setPolicyOpen("terms")}>{t("terms")}</button>
          <button type="button" onClick={() => setPolicyOpen("privacy")}>{t("privacy")}</button>
          <button type="button" onClick={() => setPolicyOpen("report")}>{t("report")}</button>
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">{t("icp")}</a>
        </nav>
      </footer>

      {announcementOpen && announcement?.enabled && (
        <div
          className="announcement-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="site-announcement-title"
          onClick={closeAnnouncementOverlay}
        >
          <div className="announcement-modal" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="announcement-dismiss-button"
              aria-label={t("close")}
              onClick={closeAnnouncementOverlay}
            >
              <X size={16} />
            </button>
            <div className="announcement-badge">
              <Bell size={15} />
              <span>{t("announcement")}</span>
            </div>
            <div className="announcement-content">
              <h2 id="site-announcement-title">{announcementText(announcement, "title")}</h2>
              <p>{announcementText(announcement, "content")}</p>
            </div>
            <button type="button" onClick={dismissAnnouncement}>
              {announcementText(announcement, "buttonLabel")}
            </button>
          </div>
        </div>
      )}

      {announcementPanelOpen && (
        <div className="announcement-overlay" role="dialog" aria-modal="true" aria-labelledby="site-announcement-panel-title">
          <div className="announcement-modal announcement-history-modal">
            <div className="announcement-panel-head">
              <div>
                <div className="announcement-badge">
                  <Bell size={15} />
                  <span>{t("announcementCenter")}</span>
                </div>
                <h2 id="site-announcement-panel-title">{t("siteAnnouncement")}</h2>
              </div>
              <button type="button" className="announcement-close-button" onClick={() => setAnnouncementPanelOpen(false)}>
                {t("close")}
              </button>
            </div>

            {announcementHistoryLoading ? (
              <p className="announcement-empty">{t("loadingAnnouncements")}</p>
            ) : announcementHistory.length ? (
              <div className="announcement-list">
                {announcementHistory.map((item, index) => (
                  <article className={index === 0 ? "announcement-list-item current" : "announcement-list-item"} key={`${item.version}_${item.updatedAt}_${index}`}>
                    <div>
                      <strong>{announcementText(item, "title")}</strong>
                      <span>{index === 0 ? t("currentAnnouncement") : formatDate(item.updatedAt, language)}</span>
                    </div>
                    <p>{announcementText(item, "content")}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="announcement-empty">{t("noAnnouncements")}</p>
            )}
          </div>
        </div>
      )}

      {authOpen && (
        <div className="auth-overlay">
          <div className={user ? "auth-modal member-modal" : "auth-modal login-modal"}>
            <div className="auth-head">
              <div>
                <p>{t("member")}</p>
                <h2>{user ? t("memberCenter") : authMode === "login" ? t("loginTitle") : t("registerTitle")}</h2>
              </div>
              <div className="auth-head-actions">
                <button
                  type="button"
                  className="auth-language-button"
                  onClick={switchLanguage}
                  aria-label={t("switchLanguage")}
                >
                  <Languages size={14} />
                  {t("language")}
                </button>
                <button type="button" onClick={openAnnouncementPanel}>
                  {t("navAnnouncement")}
                </button>
                {user && (
                  <button type="button" onClick={() => setAuthOpen(false)}>
                    {t("close")}
                  </button>
                )}
              </div>
            </div>

            {user ? (
              <>
                <div className="member-summary">
                  <span>{user.account}</span>
                  <strong>{user.credits} {t("credits")}</strong>
                </div>
                <div className="member-tabs">
                  <button
                    type="button"
                    className={memberTab === "redeem" ? "active" : ""}
                    onClick={() => setMemberTab("redeem")}
                  >
                    {t("redeemTab")}
                  </button>
                  <button
                    type="button"
                    className={memberTab === "recharge" ? "active" : ""}
                    onClick={() => setMemberTab("recharge")}
                  >
                    {t("rechargeTab")}
                  </button>
                  <button
                    type="button"
                    className={memberTab === "history" ? "active" : ""}
                    onClick={() => {
                      setMemberTab("history");
                      loadHistory(token);
                    }}
                  >
                    {t("historyTab")}
                  </button>
                </div>
                {memberTab === "redeem" ? (
                  <>
                    <div className="member-rules">
                      <p>{t("forgeRule")}</p>
                      <p>{t("gptRule")}</p>
                      <p>{t("bananaRule")}</p>
                      <p>{t("creditRule")}</p>
                    </div>
                    <form className="redeem-form" onSubmit={redeemCredits}>
                      <input
                        value={redeemCode}
                        onChange={(event) => setRedeemCode(event.target.value)}
                        placeholder={t("redeemPlaceholder")}
                      />
                      <button type="submit">{t("redeemButton")}</button>
                    </form>
                    {redeemMessage && <p className="auth-message">{redeemMessage}</p>}
                  </>
                ) : memberTab === "recharge" ? (
                  <div className="recharge-panel">
                    <div className="recharge-rate">
                      <span>{t("currentRate")}</span>
                      <strong>1 {t("yuan")} = 10 {t("credits")}</strong>
                    </div>
                    <div className="recharge-plans">
                      {rechargePlans.map((amount) => (
                        <button
                          type="button"
                          key={amount}
                          className={selectedRechargeAmount === amount ? "active" : ""}
                          onClick={() => {
                            setSelectedRechargeAmount(amount);
                            setRechargeOrder(null);
                            setRechargeMessage("");
                          }}
                        >
                          <span>{amount} {t("yuan")}</span>
                          <strong>{amount * 10} {t("credits")}</strong>
                        </button>
                      ))}
                    </div>
                    <button className="wechat-pay-button" type="button" onClick={createWechatRecharge} disabled={rechargeLoading}>
                      {rechargeLoading ? t("rechargeCreating") : t("wechatRecharge")}
                    </button>
                    {rechargeOrder?.qrDataUrl && (
                      <div className="wechat-qr-card">
                        <img src={rechargeOrder.qrDataUrl} alt={t("wechatQrAlt")} />
                        <div>
                          <strong>{rechargeOrder.amountYuan} {t("yuan")} / {rechargeOrder.credits} {t("credits")}</strong>
                          <span>{t("orderNo")}{rechargeOrder.outTradeNo}</span>
                          <span>{t("rechargeWait")}</span>
                          <span>{rechargeStatusLabel(rechargeOrder.status, language)}</span>
                          <button type="button" onClick={() => refreshRechargeOrder(rechargeOrder.id)}>
                            {t("paidCheck")}
                          </button>
                        </div>
                      </div>
                    )}
                    {rechargeMessage && <p className={rechargeOrder?.status === "paid" ? "auth-message" : "history-note"}>{rechargeMessage}</p>}
                  </div>
                ) : (
                  <div className="history-panel">
                    <div className="history-head">
                      <span>{t("historyLimit")}</span>
                      <button type="button" onClick={() => loadHistory(token)}>
                        {t("refresh")}
                      </button>
                    </div>
                    {historyLoading && <p className="history-empty">{t("historyLoading")}</p>}
                    {historyError && <p className="auth-error">{historyError}</p>}
                    {!historyLoading && !history.length && !historyError && (
                      <p className="history-empty">{t("historyEmpty")}</p>
                    )}
                    {!historyLoading && history.length > 0 && !historyError && (
                      <p className="history-note">{t("historyLoadedPrefix")} {history.length} {t("historyLoadedSuffix")}</p>
                    )}
                    <div className="history-grid">
                      {history.map((item) => (
                        <article className="history-card" key={item.id}>
                          <button
                            className="history-preview-button"
                            type="button"
                            onClick={() => setHistoryPreview(item)}
                            title={t("previewImage")}
                          >
                            <img
                              src={item.thumbnailUrl || item.url}
                              alt={t("historyImageAlt")}
                              loading="lazy"
                              decoding="async"
                              onLoad={() => markHistoryImage(item.id, "loaded")}
                              onError={() => markHistoryImage(item.id, "error")}
                            />
                            {historyImageStatus[item.id] === "error" && <span className="history-image-error">{t("historyImageError")}</span>}
                          </button>
                          <div>
                            <strong>{localizedModelLabel(item.model, item.modelLabel, language)}</strong>
                            <span>{formatDate(item.createdAt, language)}</span>
                          </div>
                          <button
                            className="history-download-button"
                            type="button"
                            onClick={() => downloadImage(item.url, `${item.jobId}_${item.imageIndex + 1}.png`, item.id)}
                            disabled={downloadingImageId === item.id}
                          >
                            <Download size={15} />
                            {t("download")}
                          </button>
                          <button type="button" onClick={() => reuseHistory(item)}>
                            {t("reuse")}
                          </button>
                        </article>
                      ))}
                    </div>
                    {historyHasMore && (
                      <button
                        className="history-load-more"
                        type="button"
                        onClick={() => loadHistory(token, { append: true })}
                        disabled={historyLoading}
                      >
                        {historyLoading ? t("loadingMore") : t("loadMoreHistory")}
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <form className="login-form" onSubmit={handleAuth}>
                <label>
                  <span>{authMode === "login" ? t("account") : t("email")}</span>
                  <input
                    value={authForm.account}
                    onChange={(event) => setAuthForm((current) => ({ ...current, account: event.target.value }))}
                    placeholder={authMode === "login" ? t("accountPlaceholder") : t("emailPlaceholder")}
                    type={authMode === "login" ? "text" : "email"}
                  />
                </label>
                <label>
                  <span>{t("password")}</span>
                  <input
                    value={authForm.password}
                    type="password"
                    onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder={t("passwordPlaceholder")}
                  />
                </label>
                {authError && <p className="auth-error">{authError}</p>}
                {authNotice && <p className="auth-message">{authNotice}</p>}
                <button className="auth-submit" type="submit">
                  {authMode === "login" ? t("login") : t("register")}
                </button>
                <button
                  className="auth-toggle"
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "register" : "login");
                    setAuthError("");
                    setAuthNotice("");
                  }}
                >
                  {authMode === "login" ? t("toRegister") : t("toLogin")}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {historyPreview && (
        <div className="history-preview-overlay" onClick={() => setHistoryPreview(null)}>
          <div className="history-preview-modal" onClick={(event) => event.stopPropagation()}>
            <div className="history-preview-head">
              <div>
                <strong>{localizedModelLabel(historyPreview.model, historyPreview.modelLabel, language)}</strong>
                <span>{formatDate(historyPreview.createdAt, language)}</span>
              </div>
              <button type="button" onClick={() => setHistoryPreview(null)}>
                {t("close")}
              </button>
            </div>
            <img src={historyPreview.url} alt={t("historyPreviewAlt")} />
            <div className="history-preview-actions">
              <button
                type="button"
                onClick={() =>
                  downloadImage(
                    historyPreview.url,
                    `${historyPreview.jobId}_${historyPreview.imageIndex + 1}.png`,
                    historyPreview.id
                  )
                }
                disabled={downloadingImageId === historyPreview.id}
              >
                <Download size={16} />
                {downloadingImageId === historyPreview.id ? t("downloading") : t("downloadOriginal")}
              </button>
              <button type="button" onClick={() => reuseHistory(historyPreview)}>
                {t("reuse")}
              </button>
            </div>
          </div>
        </div>
      )}

      {policyOpen && (
        <div className="auth-overlay">
          <div className="auth-modal legal-modal">
            <div className="auth-head">
              <div>
                <p>{t("compliance")}</p>
                <h2>{legalTitle(policyOpen, language)}</h2>
              </div>
              <button type="button" onClick={() => setPolicyOpen(null)}>{t("close")}</button>
            </div>
            {policyOpen === "report" ? (
              <form className="report-form" onSubmit={submitReport}>
                <label>
                  <span>{t("reportType")}</span>
                  <select
                    value={reportForm.type}
                    onChange={(event) => setReportForm((current) => ({ ...current, type: event.target.value }))}
                  >
                    {[
                      ["违法违规内容", language === "en" ? "Illegal or harmful content" : "违法违规内容"],
                      ["侵权内容", language === "en" ? "Copyright or trademark issue" : "侵权内容"],
                      ["个人信息问题", language === "en" ? "Personal information issue" : "个人信息问题"],
                      ["账号异常", language === "en" ? "Account issue" : "账号异常"],
                      ["系统漏洞", language === "en" ? "Security vulnerability" : "系统漏洞"],
                      ["其他问题", language === "en" ? "Other issue" : "其他问题"]
                    ].map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t("reportContact")}</span>
                  <input
                    value={reportForm.contact}
                    onChange={(event) => setReportForm((current) => ({ ...current, contact: event.target.value }))}
                    placeholder={t("reportContactPlaceholder")}
                  />
                </label>
                <label>
                  <span>{t("reportContent")}</span>
                  <textarea
                    value={reportForm.content}
                    onChange={(event) => setReportForm((current) => ({ ...current, content: event.target.value }))}
                    placeholder={t("reportContentPlaceholder")}
                    rows={5}
                  />
                </label>
                <button className="auth-submit" type="submit" disabled={reportLoading}>
                  {reportLoading ? t("reportSubmitting") : t("reportSubmit")}
                </button>
                {reportMessage && <p className="auth-message">{reportMessage}</p>}
              </form>
            ) : (
              <LegalContent type={policyOpen} language={language} />
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function legalTitle(type, language = "zh") {
  const maps = {
    zh: {
      terms: "用户协议",
      privacy: "隐私政策",
      report: "投诉举报"
    },
    en: {
      terms: "Terms of Use",
      privacy: "Privacy Policy",
      report: "Report an Issue"
    }
  };
  return (maps[language] || maps.zh)[type] || "";
}

function localizedModelLabel(modelId, fallback = "", language = "zh") {
  const id = String(modelId || "").toLowerCase();
  const names = language === "en"
    ? {
        forge: "Forge Image",
        "gpt-image-2": "GPT Image 2",
        nannabanan: "🍌 Nannabanan"
      }
    : {
        forge: "Forge生图模型",
        "gpt-image-2": "GPT Image 2",
        nannabanan: "🍌 Nannabanan"
      };

  if (names[id]) return names[id];
  if (id.startsWith("gpt-image-2")) return names["gpt-image-2"];
  if (id.includes("nannabanan") || id.includes("banana")) return names.nannabanan;
  if (id.includes("forge")) return names.forge;
  return fallback || (language === "en" ? "Generation" : "未知模型");
}

function translateAnnouncementContent(content = "") {
  const text = String(content || "");
  if (!text) return "";
  if (/充值福利/.test(text)) {
    return "For site questions, contact support: QQ 258480973.\nRecharge promotion: 5 CNY = 60 credits, 10 CNY = 120 credits, 20 CNY = 250 credits.";
  }
  if (/下午官方限流/.test(text)) {
    return "Support: QQ 258480973.\nThe upstream service may be rate-limited this afternoon. If generation fails, please try again.";
  }
  if (/香蕉暂不可用/.test(text)) {
    return "Support: QQ 258480973.\nNannabanan is temporarily unavailable.";
  }
  if (/拼多多已恢复/.test(text)) {
    return "Pinduoduo recharge is available again. For recharge support, contact QQ 258480973.";
  }
  if (/客服|售后/.test(text)) {
    return "For support, contact QQ 258480973.";
  }
  return "This announcement is currently available in Chinese. Please contact support for help.";
}

function LegalContent({ type, language = "zh" }) {
  if (type === "privacy") {
    if (language === "en") {
      return (
        <div className="legal-content">
          <p>We collect only necessary account, login, generation, credit, operation log, and report information for account management, content safety, dispute handling, and lawful compliance.</p>
          <p>The site uses HTTPS for transmission. Passwords are stored as hashes. Admin access is limited to administrators. Uploaded reference images and prompts are used for generation, history, and safety review.</p>
          <p>You may contact us through the report entry to request access, correction, or deletion of personal information. Records required by law may be retained for the required period.</p>
        </div>
      );
    }
    return (
      <div className="legal-content">
        <p>我们遵循最小必要原则收集账号、登录状态、生成记录、积分记录、操作日志和投诉举报信息，用于账号管理、内容安全、纠纷处理和依法配合监管。</p>
        <p>网站使用 HTTPS 传输数据，密码以哈希方式保存，后台访问仅限管理员。用户上传参考图和提示词仅用于本次生成、历史记录和安全审计。</p>
        <p>用户可通过投诉举报入口联系我们，申请查询、更正或删除个人信息。依法需要留存的安全日志、生成记录和处置记录将在规定期限内保存。</p>
      </div>
    );
  }
  if (language === "en") {
    return (
      <div className="legal-content">
        <p>Users must comply with applicable laws and may not use this site to generate or distribute illegal, pornographic, violent, fraudulent, infringing, minor-harming, or otherwise harmful content.</p>
        <p>This site is an image creation tool. It does not provide public posting, comments, reposts, groups, or live-streaming features. Generated results are private to the account by default.</p>
        <p>If misuse is found, the site may refuse generation, restrict account features, remove related records, and cooperate with regulators or law enforcement as required.</p>
      </div>
    );
  }
  return (
    <div className="legal-content">
      <p>用户应遵守法律法规，不得使用本站生成、传播涉政违法、色情低俗、暴力血腥、诈骗侵权、危害未成年人或其他违法有害内容。</p>
      <p>本站为图片创作工具，不提供公开发布、评论、转发、群组或直播功能。生成结果默认仅账号本人查看和下载。</p>
      <p>如发现违规使用，本站有权拒绝生成、限制账号功能、删除相关记录，并依法配合监管和执法部门处理。</p>
    </div>
  );
}

function referencePlanLabel(plan, language = "zh") {
  if (language === "en") {
    if (!plan?.source) return "No reference analysis";
    if (plan.source === "prompt-only") {
      const reason = shortVisionError(plan.error, language);
      return reason ? `Reference analysis: prompt-only fallback · ${reason}` : "Reference analysis: prompt-only fallback";
    }
    const source = plan.source.includes("agnes") ? "Agnes fallback vision" : plan.source.includes("gpt-5.5") ? "GPT5.5 vision" : plan.source;
    const usedFallback = Array.isArray(plan.attempts) && plan.attempts.some((item) => item.ok === false);
    return `Reference analysis complete · ${source}${usedFallback ? " · switched after primary failed" : ""}`;
  }
  if (!plan?.source) return "无参考图分析";
  if (plan.source === "prompt-only") {
    const reason = shortVisionError(plan.error, language);
    return reason ? `参考图理解：备用提示词模式 · ${reason}` : "参考图理解：备用提示词模式";
  }
  const source = plan.source.includes("agnes") ? "Agnes备用视觉" : plan.source.includes("gpt-5.5") ? "GPT5.5视觉" : plan.source;
  const usedFallback = Array.isArray(plan.attempts) && plan.attempts.some((item) => item.ok === false);
  return `参考图理解：已完成 · ${source}${usedFallback ? " · 主模型失败后切换" : ""}`;
}

function shortVisionError(error, language = "zh") {
  const text = String(error || "");
  if (!text) return "";
  if (language === "en") {
    if (/timeout/i.test(text)) return "vision model timed out";
    if (/api key|unauthorized|401|invalid key/i.test(text)) return "vision API configuration issue";
    if (/429|rate limit|too many/i.test(text)) return "vision model rate limited";
    if (/quota|balance|insufficient/i.test(text)) return "vision model quota is insufficient";
    if (/503|502|500|upstream/i.test(text)) return "vision upstream error";
    if (/No usable reference/i.test(text)) return "reference image was not received";
    return localizeMessage(text.slice(0, 80), language);
  }
  if (/timeout/i.test(text)) return "视觉模型超时";
  if (/api key|unauthorized|401|invalid key/i.test(text)) return "视觉API配置异常";
  if (/429|rate limit|too many/i.test(text)) return "视觉模型限流";
  if (/quota|balance|insufficient/i.test(text)) return "视觉模型额度不足";
  if (/503|502|500|upstream/i.test(text)) return "视觉上游异常";
  if (/No usable reference/i.test(text)) return "参考图未成功传入";
  return text.slice(0, 80);
}

function readReferenceFile(file) {
  return compressReferenceFile(file).catch(() => readFileAsDataUrl(file)).then((dataUrl) => ({
    id: `${file.name}_${file.size}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: file.name,
    type: mimeFromDataUrl(dataUrl) || file.type || "image/jpeg",
    size: approximateDataUrlBytes(dataUrl),
    preview: dataUrl,
    image: dataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""),
    usage: ""
  }));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("参考图读取失败"));
    reader.readAsDataURL(file);
  });
}

async function compressReferenceFile(file) {
  if (!file.type?.startsWith("image/") || file.type === "image/gif") return readFileAsDataUrl(file);

  const originalUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalUrl);
  const scale = Math.min(1, maxReferenceImageEdge / Math.max(image.width, image.height));
  if (scale >= 1 && file.size < 1_200_000) return originalUrl;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", referenceImageQuality);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("参考图压缩失败"));
    image.src = src;
  });
}

function mimeFromDataUrl(dataUrl) {
  return String(dataUrl || "").match(/^data:([^;]+);base64,/)?.[1] || "";
}

function approximateDataUrlBytes(dataUrl) {
  const base64 = String(dataUrl || "").replace(/^data:[^;]+;base64,/, "");
  return Math.round((base64.length * 3) / 4);
}

function inferRatioFromPrompt(prompt) {
  const text = String(prompt || "").replace(/\s+/g, "").toLowerCase();
  if (/(9[:：]?16|竖版|竖屏|竖图|手机海报|手机壁纸|短视频封面|小红书封面)/i.test(text)) return "9:16";
  if (/(16[:：]?9|横版|横屏|横图|宽屏|banner|头图|电脑壁纸)/i.test(text)) return "16:9";
  if (/(1[:：]?1|方图|正方形|头像|icon|图标)/i.test(text)) return "1:1";
  if (/(3[:：]?4)/i.test(text)) return "3:4";
  return "";
}

function getEffectiveRatio(form) {
  if (form?.ratioLocked) return form.ratio || defaults.ratio;
  return inferRatioFromPrompt(form?.prompt) || form?.ratio || defaults.ratio;
}

function ratioLabel(value, language = "zh") {
  const labels = ratioLabels[language] || ratioLabels.zh;
  return labels[value] || value || labels.default;
}

function qualityLabel(value, language = "zh") {
  const labels = language === "en"
    ? { standard: "Standard", high: "High quality" }
    : { standard: "标准", high: "高质" };
  return labels[value] || String(value || "").toUpperCase();
}

function rechargeStatusLabel(status, language = "zh") {
  const labels = language === "en"
    ? {
        created: "Order created",
        pending: "Waiting for admin confirmation",
        paid: "Recharge confirmed, credits added",
        failed: "Order closed or failed",
        amount_mismatch: "Payment amount mismatch. Contact support."
      }
    : {
        created: "订单已创建",
        pending: "等待后台确认到账",
        paid: "充值成功，积分已到账",
        failed: "订单已关闭或失败",
        amount_mismatch: "支付金额异常，请联系客服"
      };
  return labels[status] || status || (language === "en" ? "Waiting for payment" : "等待支付");
}

async function readApiResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    if (response.status === 504) {
      return {
        error: "生成时间较长，服务器网关等待超时。图片可能仍在后台生成，请稍后到会员中心历史记录查看。"
      };
    }
    if (response.status >= 500) {
      return { error: "服务器暂时异常，请稍后重试。" };
    }
    return { error: "服务器返回格式异常，请刷新页面后重试。" };
  }
}

function formatDate(value, language = "zh") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(language === "en" ? "en-US" : "zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function localizeMessage(message, language = "zh") {
  const text = String(message || "");
  if (language !== "en" || !text) return text;

  const patterns = [
    [/请先登录后再生成图片|请先登录/, "Please log in before generating images."],
    [/请先描述你想生成的画面/, "Please describe the image you want to generate."],
    [/生成失败/, "Generation failed."],
    [/操作失败/, "Operation failed."],
    [/兑换失败/, "Redeem failed."],
    [/微信充值订单创建失败/, "Failed to create WeChat recharge order."],
    [/充值订单读取失败/, "Failed to load recharge order."],
    [/充值订单已关闭或失败/, "The recharge order is closed or failed. Please create a new order."],
    [/历史记录读取失败/, "Failed to load generation history."],
    [/历史记录读取超时/, "Loading history timed out. Please refresh later."],
    [/公告读取失败/, "Failed to load updates."],
    [/提交失败/, "Submission failed."],
    [/粘贴参考图失败/, "Failed to paste reference image."],
    [/服务器网关等待超时|生成时间较长/, "Generation is taking longer than usual. The image may still appear in history later."],
    [/服务器暂时异常/, "The server is temporarily unavailable. Please try again later."],
    [/服务器返回格式异常/, "The server returned an unexpected response. Please refresh and try again."],
    [/图片加载失败/, "Image failed to load."],
    [/参考图读取失败/, "Failed to read reference image."],
    [/参考图压缩失败/, "Failed to compress reference image."]
  ];
  for (const [pattern, replacement] of patterns) {
    if (pattern.test(text)) return replacement;
  }
  if (/积分/.test(text)) return text.replace(/积分/g, "credits");
  return text;
}
