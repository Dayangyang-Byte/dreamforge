#!/bin/bash
# DreamForge GEO 切换验收脚本
# 切换到 Vercel 后运行此脚本验证

echo "=== DreamForge GEO 切换验收 ==="
echo ""

# 1. 检查主域DNS
echo "1. 检查DNS解析..."
IP=$(nslookup mengjing233.cn 2>/dev/null | grep "Address:" | tail -1 | awk '{print $2}')
if [ "$IP" = "76.76.21.21" ]; then
    echo "   ✅ 主域DNS已切换到Vercel: $IP"
else
    echo "   ⚠️  主域DNS仍指向: $IP (预期: 76.76.21.21)"
fi

# 2. 检查sitemap.xml
echo ""
echo "2. 检查sitemap.xml..."
SITEMAP=$(curl -s https://mengjing233.cn/sitemap.xml 2>/dev/null)
if echo "$SITEMAP" | grep -q "mengjing233.cn"; then
    echo "   ✅ sitemap使用mengjing233.cn域名"
else
    echo "   ❌ sitemap仍使用旧域名"
fi

# 3. 检查llms.txt
echo ""
echo "3. 检查llms.txt..."
CONTENT_TYPE=$(curl -sI https://mengjing233.cn/llms.txt 2>/dev/null | grep "Content-Type:" | awk '{print $2}')
if [ "$CONTENT_TYPE" = "text/plain" ]; then
    echo "   ✅ llms.txt正确返回纯文本"
else
    echo "   ❌ llms.txt返回: $CONTENT_TYPE (应为 text/plain)"
fi

# 4. 检查FAQ页
echo ""
echo "4. 检查FAQ页..."
FAQ_CONTENT=$(curl -s https://mengjing233.cn/en/faq 2>/dev/null)
if echo "$FAQ_CONTENT" | grep -q "FAQPage\|常见问题"; then
    echo "   ✅ FAQ页有完整内容"
else
    echo "   ❌ FAQ页可能是空壳"
fi

# 5. 检查canonical标签
echo ""
echo "5. 检查canonical标签..."
CANONICAL=$(curl -s https://mengjing233.cn/ 2>/dev/null | grep -o 'canonical[^>]*>' | head -1)
if echo "$CANONICAL" | grep -q "mengjing233.cn"; then
    echo "   ✅ canonical指向主域"
else
    echo "   ⚠️  canonical: $CANONICAL"
fi

# 6. 检查301重定向
echo ""
echo "6. 检查Vercel原域301..."
REDIRECT=$(curl -sI https://dreamforge-679j.vercel.app/ 2>/dev/null | head -5)
if echo "$REDIRECT" | grep -q "301\|Location"; then
    echo "   ✅ 301重定向已配置"
else
    echo "   ⚠️  未检测到301重定向"
fi

# 7. 检查API健康
echo ""
echo "7. 检查API..."
API_STATUS=$(curl -sI https://api.mengjing233.cn/api/health 2>/dev/null | head -1)
if echo "$API_STATUS" | grep -q "200"; then
    echo "   ✅ API正常"
else
    echo "   ❌ API异常: $API_STATUS"
fi

# 8. 检查CORS
echo ""
echo "8. 检查CORS..."
CORS=$(curl -sI -H "Origin: https://mengjing233.cn" https://api.mengjing233.cn/api/health 2>/dev/null | grep "Access-Control-Allow-Origin")
if [ -n "$CORS" ]; then
    echo "   ✅ CORS已配置: $CORS"
else
    echo "   ❌ CORS未配置"
fi

echo ""
echo "=== 验收完成 ==="
