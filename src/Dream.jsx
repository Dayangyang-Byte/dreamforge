import React, { useEffect } from "react";
import { WandSparkles, Rocket, ArrowRight } from "lucide-react";

// 简单的DreamForge品牌落地页组件
export function DreamLanding() {
  useEffect(() => {
    // 追踪品牌搜索来源
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag('event', 'brand_search', {
        'source': 'xiaohongshu',
        'keyword': '梦境AI'
      });
    }
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '800px', textAlign: 'center' }}>
        {/* 徽章 */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255,255,255,0.1)',
          padding: '8px 16px',
          borderRadius: '20px',
          color: '#a0aec0',
          fontSize: '14px',
          marginBottom: '24px'
        }}>
          <WandSparkles size={20} />
          <span>DreamForge 品牌页面</span>
        </div>
        
        {/* 主标题 */}
        <h1 style={{
          fontSize: '48px',
          fontWeight: '700',
          color: '#fff',
          marginBottom: '16px',
          background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          梦境AI · DreamForge
        </h1>
        
        {/* 副标题 */}
        <p style={{
          fontSize: '20px',
          color: '#a0aec0',
          marginBottom: '40px',
          lineHeight: '1.6'
        }}>
          专注梦幻电影感AI图像生成，原生中文支持
        </p>
        
        {/* 特点卡片 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px',
          marginBottom: '40px'
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🇨🇳</div>
            <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '8px' }}>原生中文</h3>
            <p style={{ color: '#a0aec0', fontSize: '14px' }}>直接说中文就能生成</p>
          </div>
          
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎬</div>
            <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '8px' }}>电影质感</h3>
            <p style={{ color: '#a0aec0', fontSize: '14px' }}>光影氛围专业级</p>
          </div>
          
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>💎</div>
            <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '8px' }}>免费试用</h3>
            <p style={{ color: '#a0aec0', fontSize: '14px' }}>注册即送积分</p>
          </div>
        </div>
        
        {/* CTA按钮 */}
        <a 
          href="/" 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            padding: '16px 32px',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: '600',
            textDecoration: 'none',
            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)'
          }}
        >
          立即体验
          <ArrowRight size={20} />
        </a>
        
        {/* 引导文字 */}
        <p style={{
          marginTop: '24px',
          color: '#718096',
          fontSize: '14px'
        }}>
          从「小红书」找到我们？直接在网址输入：mengjing233.cn
        </p>
      </div>
    </div>
  );
}
