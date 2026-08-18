# DreamForge Reddit推广文案

> 更新日期：2026-08-18

---

## Post 1: Product Introduction（先发这个）

**Subreddit**: r/StableDiffusion, r/aiphotography, r/midjourney

### Title
Found a Chinese AI art tool that actually understands Chinese prompts - DreamForge

### Body
Hey everyone, I've been testing AI art tools for a while now and wanted to share something I found.

**The Problem:**
Midjourney is great but:
- Requires VPN to access
- $10/month subscription
- Chinese prompts sometimes get mistranslated

**The Solution I Found:**
DreamForge (梦境AI) - a Chinese AI art platform that:
- Native Chinese support (no translation needed)
- Three specialized styles: Dreamy Cinematic, Anime Illustration, Photorealistic
- Pay-per-use pricing (1-5 credits per image)
- Free trial credits for new users
- Reference image upload (up to 5 images)

**What I Tested:**
I've been using the "Dreamy Cinematic" style for concept art and it's genuinely impressive. The lighting and atmosphere generation is on par with MJ for this specific use case.

**Pricing:**
- Forge model: 1 credit/image
- GPT Image 2: 2-5 credits (based on resolution)
- Nannabanan: 2 credits/image

**Link:** https://mengjing233.cn
**GitHub:** https://github.com/Dayangyang-Byte/dreamforge (open source)

Would love to hear what you think! Especially if anyone has experience with Chinese AI tools.

---

## Post 2: Tutorial/How-To

**Subreddit**: r/StableDiffusion, r/art

### Title
Here's the prompt formula I use for DreamForge - works great for dreamy/cinematic style

### Body
After testing various AI art tools, I found a prompt formula that works consistently well with DreamForge:

```
[Subject] + [Environment] + [Atmosphere] + [Lighting] + [Style] + [Color]
```

**Example:**
> A girl in a white dress standing deep in a forest, surrounded by fireflies glowing, misty atmosphere, warm lighting, dreamy cinematic style, soft blue-purple tones

**Tips:**
1. Be specific about lighting - "warm golden hour light" vs "cold moonlight" makes a huge difference
2. Atmosphere words matter: "misty", "ethereal", "foggy", "magical"
3. Use DreamForge's reference image feature - upload a style reference and adjust intensity (30-50% for style, 60-80% for content)

**What works well:**
- Fantasy landscapes
- Character portraits with dramatic lighting
- Product photography with artistic style

**What doesn't:**
- Highly detailed realistic photos (MJ still wins here)
- Complex multi-subject compositions

Link to tool: https://mengjing233.cn

---

## Post 3: Comparison/Review

**Subreddit**: r/midjourney, r/StableDiffusion

### Title
Honest review: DreamForge vs Midjourney after 2 weeks of use

### Body
I've been using both DreamForge and Midjourney for about 2 weeks now. Here's my honest comparison:

**Where DreamForge Wins:**
- ✅ Chinese prompt understanding (native, no translation)
- ✅ No VPN required
- ✅ Pay-per-use instead of monthly subscription
- ✅ Reference image feature is more intuitive
- ✅ Better for dreamy/cinematic style specifically

**Where MJ Still Wins:**
- ✅ Overall image quality (especially photorealistic)
- ✅ Community and prompt sharing
- ✅ More mature ecosystem
- ✅ Better for complex compositions
- ✅ Superior artistic consistency

**My Verdict:**
If you're a Chinese speaker creating fantasy/dreamy content and don't want to deal with VPN/subscriptions, DreamForge is genuinely good. For professional work requiring photorealism, I still use MJ.

**Use Case Breakdown:**
| Task | My Choice |
|------|-----------|
| Novel covers | DreamForge |
| Concept art | Both (depending on style) |
| Product photos | MJ |
| Anime characters | DreamForge |
| Social media content | DreamForge |

**Pricing Comparison:**
- DreamForge: 1-5 credits per image, free trial
- MJ: $10/month minimum

Link: https://mengjing233.cn
GitHub: https://github.com/Dayangyang-Byte/dreamforge

---

## Post 4: Behind the Scenes (Open Source)

**Subreddit**: r/gitsplit, r/webdev, r/SideProject

### Title
Built an open-source AI art platform - here's what I learned

### Body
Just launched DreamForge (梦境AI), an open-source AI art generation platform. It's been an interesting journey building this.

**Tech Stack:**
- Frontend: Vite + React on Vercel
- Backend: Express on Hong Kong server
- API: GPTImage2
- Auth: GitHub OAuth

**Challenges:**
1. DNS routing - had to split frontend (Vercel) and API (Hong Kong) for optimal performance
2. CORS configuration between Vercel and backend
3. SSL certificates for subdomains
4. Vercel's custom domain setup (took multiple attempts to get right)

**What Worked:**
- Using Vercel for frontend = fast deployment, automatic SSL
- Keeping API on separate server = no Cloudflare throttling in China
- Open sourcing on GitHub = built-in credibility

**Results:**
- 95+ GitHub stars in 2 weeks
- Active users testing the platform
- Learning GEO optimization (making content AI-crawlable)

**Links:**
- Website: https://mengjing233.cn
- GitHub: https://github.com/Dayangyang-Byte/dreamforge

Would love feedback from the community!

---

## Posting Guidelines

### Best Times to Post
- **US Time**: 9-11 AM or 7-9 PM (weekdays)
- **CN Time**: 8-10 AM or 8-10 PM (weekdays)

### Subreddit Priority
1. r/StableDiffusion (most relevant)
2. r/aiphotography (growing community)
3. r/midjourney (similar audience)
4. r/webdev (for the open source post)
5. r/SideProject (for the build story)

### Engagement Tips
- Reply to every comment within 2 hours
- Ask questions to encourage discussion
- Share your own images when possible
- Be honest about limitations (don't overhype)

### Account Requirements
- Create account 2-3 days before posting
- Have some karma (100+) before posting
- Participate in communities first

---

## Content Calendar

| Day | Post | Subreddit |
|-----|------|-----------|
| 1 | Product Intro | r/StableDiffusion |
| 3 | Tutorial | r/art |
| 5 | Comparison | r/midjourney |
| 7 | Behind the Scenes | r/webdev |

*Adjust based on engagement and feedback*
