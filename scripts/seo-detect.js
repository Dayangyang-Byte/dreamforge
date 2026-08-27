#!/usr/bin/env node
/**
 * DreamForge SEO/GEO 自动检测脚本
 * 检测标准：robots.txt、sitemap、Meta标签、结构化数据、内容可索引性
 * 用法: node scripts/seo-detect.js [--url URL] [--json]
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');

// 配置
const CONFIG = {
  targetUrl: process.argv.includes('--url') 
    ? process.argv[process.argv.indexOf('--url') + 1] 
    : 'https://mengjing233.cn',
  outputJson: process.argv.includes('--json'),
  verbose: process.argv.includes('--verbose'),
};

// 检测结果
const report = {
  timestamp: new Date().toISOString(),
  url: CONFIG.targetUrl,
  checks: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    score: 0,
  },
};

// 工具函数
function addCheck(name, status, detail, severity = 'info') {
  report.checks.push({ name, status, detail, severity });
  report.summary.total++;
  if (status === 'pass') report.summary.passed++;
  else if (status === 'fail') report.summary.failed++;
  else report.summary.warnings++;
}

function calcScore() {
  if (report.summary.total === 0) return 0;
  return Math.round((report.summary.passed / report.summary.total) * 100);
}

// ============== 检测项 ==============

// 1. robots.txt
async function checkRobotsTxt() {
  try {
    const resp = await fetch(`${CONFIG.targetUrl}/robots.txt`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    
    // 检查是否允许所有爬虫
    const hasAllowAll = text.includes('Allow: /') || text.includes('User-agent: *');
    
    // 检查是否允许AI爬虫
    const aiBots = ['GPTBot', 'PerplexityBot', 'ClaudeBot', 'Anthropic', 'BytesBot'];
    const hasAiAllow = aiBots.some(bot => text.includes(`User-agent: ${bot}`) || text.includes('GPTBot'));
    
    // 检查是否禁止某些重要爬虫（有Disallow而不是Allow）
    const blocked = [
      'Disallow: /',
      'Disallow: /*',
      'Disallow: /admin',
      'Disallow: /private'
    ];
    // 检查是否有明确的禁止规则（而不是Allow规则）
    const hasDisallow = text.includes('Disallow:');
    const hasAllow = text.includes('Allow:');
    const isBlocked = hasDisallow && !hasAllow;
    
    addCheck('robots.txt 存在', !isBlocked ? 'pass' : 'fail', 
      `Content-Type: ${resp.headers.get('content-type')}`);
    
    addCheck('robots.txt 放行所有爬虫', hasAllowAll ? 'pass' : 'fail',
      '包含 Allow: / 或 User-agent: *');
    
    addCheck('robots.txt 放行AI爬虫', hasAiAllow ? 'pass' : 'warning',
      '建议添加 GPTBot, ClaudeBot 等AI爬虫规则');
    
    addCheck('robots.txt 无禁止项', !isBlocked ? 'pass' : 'fail',
      '检查是否有 Disallow: / 或禁止主要爬虫');
    
  } catch (e) {
    addCheck('robots.txt 访问', 'fail', e.message);
  }
}

// 2. sitemap.xml
async function checkSitemap() {
  try {
    const resp = await fetch(`${CONFIG.targetUrl}/sitemap.xml`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    
    // 解析sitemap
    const urls = text.match(/<loc>([^<]+)<\/loc>/g) || [];
    const count = urls.length;
    
    addCheck('sitemap.xml 存在', count > 0 ? 'pass' : 'fail',
      `发现 ${count} 个URL`);
    
    // 检查priority
    const hasPriority = text.includes('<priority>');
    addCheck('sitemap.xml 包含priority', hasPriority ? 'pass' : 'warning',
      '建议每个URL设置priority值');
    
    // 检查changefreq
    const hasChangeFreq = text.includes('<changefreq>');
    addCheck('sitemap.xml 包含changefreq', hasChangeFreq ? 'pass' : 'warning',
      '建议设置changefreq');
    
  } catch (e) {
    addCheck('sitemap.xml 访问', 'fail', e.message);
  }
}

// 3. HTML源码检测
async function checkHtmlSource() {
  try {
    const resp = await fetch(CONFIG.targetUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    
    // Meta标签检测
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    const keywordsMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]+)"/i);
    const robotsMatch = html.match(/<meta\s+name="robots"\s+content="([^"]+)"/i);
    
    addCheck('Title标签', titleMatch ? 'pass' : 'fail',
      titleMatch ? `长度: ${titleMatch[1].length} 字符` : '缺少<title>标签');
    
    addCheck('Meta description', descMatch ? 'pass' : 'warning',
      descMatch ? `长度: ${descMatch[1].length} 字符` : '缺少description标签');
    
    addCheck('Meta keywords', keywordsMatch ? 'pass' : 'info',
      keywordsMatch ? `包含: ${keywordsMatch[1]}` : '缺少keywords标签（可选）');
    
    addCheck('Meta robots', robotsMatch ? 'pass' : 'info',
      robotsMatch ? robotsMatch[1] : '使用默认值（index,follow）');
    
    // Open Graph检测
    const ogTitle = html.match(/property="og:title"\s+content="([^"]+)"/i);
    const ogDesc = html.match(/property="og:description"\s+content="([^"]+)"/i);
    const ogImage = html.match(/property="og:image"\s+content="([^"]+)"/i);
    const ogUrl = html.match(/property="og:url"\s+content="([^"]+)"/i);
    
    addCheck('Open Graph title', ogTitle ? 'pass' : 'warning',
      ogTitle ? `内容: ${ogTitle[1].substring(0, 30)}...` : '缺少og:title');
    
    addCheck('Open Graph description', ogDesc ? 'pass' : 'warning',
      ogDesc ? `长度: ${ogDesc[1].length} 字符` : '缺少og:description');
    
    addCheck('Open Graph image', ogImage ? 'pass' : 'fail',
      ogImage ? `URL: ${ogImage[1]}` : '缺少og:image（影响社交分享）');
    
    addCheck('Open Graph url', ogUrl ? 'pass' : 'info',
      ogUrl ? `URL: ${ogUrl[1]}` : '缺少og:url');
    
    // Twitter Cards检测
    const twitterCard = html.match(/name="twitter:card"\s+content="([^"]+)"/i);
    const twitterTitle = html.match(/name="twitter:title"\s+content="([^"]+)"/i);
    const twitterImage = html.match(/name="twitter:image"\s+content="([^"]+)"/i);
    
    addCheck('Twitter Card', twitterCard ? 'pass' : 'warning',
      twitterCard ? `类型: ${twitterCard[1]}` : '缺少twitter:card');
    
    addCheck('Twitter Title', twitterTitle ? 'pass' : 'warning',
      twitterTitle ? `内容: ${twitterTitle[1].substring(0, 30)}...` : '缺少twitter:title');
    
    addCheck('Twitter Image', twitterImage ? 'pass' : 'fail',
      twitterImage ? `URL: ${twitterImage[1]}` : '缺少twitter:image');
    
    // Canonical URL
    const canonical = html.match(/rel="canonical"\s+href="([^"]+)"/i);
    addCheck('Canonical URL', canonical ? 'pass' : 'info',
      canonical ? canonical[1] : '缺少canonical标签（可选）');
    
    // JSON-LD 结构化数据
    const jsonLdMatch = html.match(/<script\s+type="application\/ld\+json">([^<]+)<\/script>/is);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        addCheck('JSON-LD 结构化数据', 'pass', 
          `类型: ${jsonLd['@type'] || 'Unknown'}`);
        
        // 检查是否有价格信息
        if (jsonLd.offers || jsonLd.highPrice || jsonLd.lowPrice) {
          addCheck('JSON-LD 价格信息', 'pass', '包含价格结构化数据');
        } else {
          addCheck('JSON-LD 价格信息', 'warning', '建议添加价格结构化数据');
        }
        
        // 检查FAQ
        if (jsonLd.mainEntity && Array.isArray(jsonLd.mainEntity)) {
          const faqs = jsonLd.mainEntity.filter(e => e.questionName);
          addCheck('JSON-LD FAQ', faqs.length > 0 ? 'pass' : 'warning',
            `找到 ${faqs.length} 个FAQ问题`);
        }
      } catch (e) {
        addCheck('JSON-LD 有效性', 'fail', 'JSON格式错误');
      }
    } else {
      addCheck('JSON-LD 结构化数据', 'fail', '未找到JSON-LD脚本');
    }
    
    // 检测关键词密度（简单统计）
    const keywords = ['梦境AI', 'DreamForge', 'AI图片', 'AI生成', 'GPT Image'];
    const keywordCounts = {};
    let totalWords = 0;
    
    // 简单统计（忽略标签）
    const textOnly = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    totalWords = textOnly.split(' ').filter(w => w.length > 0).length;
    
    for (const kw of keywords) {
      const matches = html.match(new RegExp(kw, 'gi')) || [];
      keywordCounts[kw] = matches.length;
    }
    
    addCheck('核心关键词密度', 'info',
      Object.entries(keywordCounts).map(([k, v]) => `${k}: ${v}`).join(', '));
    
    addCheck('页面文字密度', totalWords > 500 ? 'pass' : 'warning',
      `约 ${totalWords} 个文字（不含HTML标签）`);
    
  } catch (e) {
    addCheck('HTML源码获取', 'fail', e.message);
  }
}

// 4. 检查JavaScript动态内容风险
async function checkJsrisk() {
  try {
    const resp = await fetch(CONFIG.targetUrl);
    const html = await resp.text();
    
    // 检测关键内容是否在HTML中
    const pricePatterns = [/¥\d+/, /\$\d+/, /定价.*?\d/, /价格.*?\d/];
    const hasStaticPrice = pricePatterns.some(p => p.test(html));
    
    addCheck('价格信息静态化', hasStaticPrice ? 'pass' : 'warning',
      '价格信息应直接在HTML中，而非JS动态生成');
    
    // 检测是否有内联关键内容
    const hasStaticContent = /梦幻.*?电影|电影感.*?风格|AI.*?绘画/.test(html);
    addCheck('核心内容静态化', hasStaticContent ? 'pass' : 'warning',
      '核心描述应直接在HTML中');
    
  } catch (e) {
    addCheck('JS风险检测', 'fail', e.message);
  }
}

// 5. 检查响应头
async function checkHeaders() {
  try {
    const resp = await fetch(CONFIG.targetUrl, { method: 'HEAD' });
    
    // HSTS
    const hsts = resp.headers.get('strict-transport-security');
    addCheck('HSTS 安全头', hsts ? 'pass' : 'warning',
      hsts ? `max-age: ${hsts.match(/max-age=(\d+)/)?.[1] || 'N/A'}` : '缺少HSTS头');
    
    // Cache-Control
    const cache = resp.headers.get('cache-control');
    addCheck('Cache-Control', cache ? 'pass' : 'info',
      cache || '未设置');
    
    // X-Frame-Options
    const frame = resp.headers.get('x-frame-options');
    addCheck('X-Frame-Options', frame ? 'pass' : 'warning',
      frame || '缺少（可能被点击劫持）');
    
    // Content-Type
    const ct = resp.headers.get('content-type');
    addCheck('Content-Type', ct?.includes('text/html') ? 'pass' : 'warning',
      ct || '未知');
    
  } catch (e) {
    addCheck('响应头检测', 'fail', e.message);
  }
}

// 6. 检查多语言支持
async function checkMultilingual() {
  try {
    const resp = await fetch(`${CONFIG.targetUrl}/en`);
    const exists = resp.ok;
    
    addCheck('英文页面 /en', exists ? 'pass' : 'warning',
      exists ? '英文页面存在' : '英文页面不存在（建议添加）');
    
    // 检查hreflang
    const htmlResp = await fetch(CONFIG.targetUrl);
    const html = await htmlResp.text();
    const hreflangs = html.match(/hreflang="([^"]+)"/g) || [];
    
    addCheck('Hreflang 标签', hreflangs.length > 0 ? 'pass' : 'warning',
      `找到 ${hreflangs.length} 个hreflang标签`);
      
  } catch (e) {
    addCheck('多语言检测', 'warning', e.message);
  }
}

// ============== 主函数 ==============
async function run() {
  console.log(`🚀 DreamForge SEO/GEO 自动检测`);
  console.log(`📍 目标URL: ${CONFIG.targetUrl}`);
  console.log(`⏰ 时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('='.repeat(50));
  
  await checkRobotsTxt();
  await checkSitemap();
  await checkHtmlSource();
  await checkJsrisk();
  await checkHeaders();
  await checkMultilingual();
  
  report.summary.score = calcScore();
  
  // 输出报告
  if (CONFIG.outputJson) {
    const outputDir = resolve(ROOT_DIR, 'reports');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = resolve(outputDir, `seo-report-${timestamp}.json`);
    writeFileSync(outputFile, JSON.stringify(report, null, 2));
    console.log(`\n✅ JSON报告已保存: ${outputFile}`);
  }
  
  printReport();
}

function printReport() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 检测结果');
  console.log('='.repeat(50));
  
  const passColor = '\x1b[32m';
  const failColor = '\x1b[31m';
  const warnColor = '\x1b[33m';
  const infoColor = '\x1b[36m';
  const resetColor = '\x1b[0m';
  
  for (const check of report.checks) {
    let color = infoColor;
    let icon = 'ℹ️';
    
    if (check.status === 'pass') { color = passColor; icon = '✅'; }
    else if (check.status === 'fail') { color = failColor; icon = '❌'; }
    else if (check.status === 'warning') { color = warnColor; icon = '⚠️'; }
    
    console.log(`${color}${icon} ${check.name}`);
    if (check.detail) console.log(`   ${color}${check.detail}${resetColor}`);
  }
  
  console.log('='.repeat(50));
  console.log(`\n📈 总结`);
  console.log(`   总分: ${report.summary.score}/100`);
  console.log(`   通过: ${report.summary.passed}`);
  console.log(`   失败: ${report.summary.failed}`);
  console.log(`   警告: ${report.summary.warnings}`);
  console.log(`   总数: ${report.summary.total}`);
  
  if (report.summary.score >= 80) {
    console.log('\n🎉 优秀！网站SEO健康度良好');
  } else if (report.summary.score >= 60) {
    console.log('\n⚠️  一般，建议修复失败项');
  } else {
    console.log('\n🚨 较差，需要立即优化');
  }
}

// 执行
run().catch(console.error);
