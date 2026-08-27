/**
 * Uiverse Component Showcase for DreamForge
 * Premium UI components inspired by Uiverse.io
 * Compatible with existing DreamForge dark theme
 */

import React from 'react';
import { WandSparkles, Download, Sparkles, Zap, ArrowRight } from 'lucide-react';

// Neon Glow Button
export function NeonButton({ children, onClick, className = '', size = 'md' }) {
  const sizeClasses = {
    sm: 'padding: 10px 20px; font-size: 14px;',
    md: 'padding: 14px 32px; font-size: 16px;',
    lg: 'padding: 18px 40px; font-size: 18px;'
  };

  return (
    <button
      className={`uiverse-neon-btn ${className}`}
      style={sizeClasses[size]}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// Gradient Border Button
export function GradientButton({ children, onClick, icon: Icon, className = '', disabled = false }) {
  return (
    <button
      className={`uiverse-gradient-btn ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={{ opacity: disabled ? 0.6 : 1 }}
    >
      {Icon && <Icon size={20} />}
      {children}
    </button>
  );
}

// Holographic Button
export function HoloButton({ children, onClick, className = '' }) {
  return (
    <button
      className={`uiverse-holo-btn ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// Glass Card
export function GlassCard({ children, className = '', onClick }) {
  return (
    <div
      className={`uiverse-glass-card ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {children}
    </div>
  );
}

// Neon Card
export function NeonCard({ children, className = '' }) {
  return (
    <div className={`uiverse-neon-card ${className}`}>
      {children}
    </div>
  );
}

// Floating Card
export function FloatCard({ children, className = '' }) {
  return (
    <div className={`uiverse-float-card ${className}`}>
      {children}
    </div>
  );
}

// Floating Label Input
export function FloatingInput({ label, type = 'text', value, onChange, placeholder, textarea = false }) {
  const InputTag = textarea ? 'textarea' : 'input';
  return (
    <div className="uiverse-floating-input">
      <InputTag
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <label>{label}</label>
    </div>
  );
}

// Toggle Switch
export function Toggle({ checked, onChange, className = '' }) {
  return (
    <div
      className={`uiverse-toggle ${checked ? 'active' : ''} ${className}`}
      onClick={() => onChange(!checked)}
    />
  );
}

// Badge/Tag
export function Badge({ children, className = '' }) {
  return (
    <span className={`uiverse-badge ${className}`}>
      {children}
    </span>
  );
}

// Spinner
export function Spinner({ className = '' }) {
  return <div className={`uiverse-spinner ${className}`} />;
}

// Pulsing Ring
export function PulseRing({ className = '' }) {
  return <div className={`uiverse-pulse-ring ${className}`} />;
}

// Feature Showcase Component
export function FeatureShowcase() {
  const features = [
    {
      icon: WandSparkles,
      title: '梦幻生成',
      desc: '一键生成电影级梦幻场景',
      badge: '热门'
    },
    {
      icon: Sparkles,
      title: '风格多样化',
      desc: '支持多种艺术风格一键切换',
      badge: 'NEW'
    },
    {
      icon: Zap,
      title: '极速出图',
      desc: '平均10秒生成高清图片',
      badge: null
    }
  ];

  return (
    <div className="uiverse-flex-center" style={{ gap: '24px', flexWrap: 'wrap' }}>
      {features.map((feature, index) => (
        <GlassCard key={index} className="feature-card" style={{ flex: '1 1 280px', maxWidth: '320px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <feature.icon size={32} color="var(--cyan)" />
            {feature.badge && <Badge>{feature.badge}</Badge>}
          </div>
          <h3 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
            {feature.title}
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '1.6' }}>
            {feature.desc}
          </p>
        </GlassCard>
      ))}
    </div>
  );
}

// CTA Section Component
export function CTASection() {
  return (
    <FloatCard style={{ textAlign: 'center', padding: '48px 40px', maxWidth: '600px' }}>
      <h2 style={{ color: '#fff', fontSize: '32px', fontWeight: '800', marginBottom: '16px' }}>
        开始你的梦幻创作
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '16px', marginBottom: '32px', lineHeight: '1.6' }}>
        注册即送免费积分，体验电影级AI绘画
      </p>
      <div className="uiverse-flex-center" style={{ gap: '16px', flexWrap: 'wrap' }}>
        <GradientButton icon={WandSparkles}>
          免费试用
          <ArrowRight size={18} />
        </GradientButton>
        <NeonButton>
          了解更多
        </NeonButton>
      </div>
    </FloatCard>
  );
}

// Demo Component
export function UIDemo() {
  return (
    <div style={{ padding: '40px', background: 'var(--ink-900)' }}>
      <h1 style={{ color: '#fff', fontSize: '28px', marginBottom: '32px' }}>
        Uiverse Components Demo
      </h1>
      
      {/* Buttons */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ color: 'var(--cyan)', fontSize: '18px', marginBottom: '16px' }}>Buttons</h2>
        <div className="uiverse-flex-center" style={{ gap: '16px', flexWrap: 'wrap' }}>
          <NeonButton>Neon Button</NeonButton>
          <GradientButton icon={WandSparkles}>Gradient Button</GradientButton>
          <HoloButton>Holographic</HoloButton>
        </div>
      </section>

      {/* Cards */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ color: 'var(--cyan)', fontSize: '18px', marginBottom: '16px' }}>Cards</h2>
        <div className="uiverse-flex-center" style={{ gap: '24px', flexWrap: 'wrap' }}>
          <GlassCard style={{ width: '280px' }}>
            <h3 style={{ color: '#fff', marginBottom: '8px' }}>Glass Card</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>玻璃拟态效果</p>
          </GlassCard>
          <NeonCard style={{ width: '280px' }}>
            <h3 style={{ color: '#fff', marginBottom: '8px' }}>Neon Card</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>霓虹边框效果</p>
          </NeonCard>
          <FloatCard style={{ width: '280px' }}>
            <h3 style={{ color: '#fff', marginBottom: '8px' }}>Float Card</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>悬浮阴影效果</p>
          </FloatCard>
        </div>
      </section>

      {/* Inputs */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ color: 'var(--cyan)', fontSize: '18px', marginBottom: '16px' }}>Inputs</h2>
        <div className="uiverse-flex-center" style={{ gap: '24px', flexWrap: 'wrap' }}>
          <FloatingInput label="用户名" placeholder="请输入用户名" />
          <FloatingInput label="密码" type="password" placeholder="请输入密码" />
        </div>
      </section>

      {/* Toggle */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ color: 'var(--cyan)', fontSize: '18px', marginBottom: '16px' }}>Toggle</h2>
        <div className="uiverse-flex-center" style={{ gap: '16px' }}>
          <Toggle checked={false} onChange={() => {}} />
          <Toggle checked={true} onChange={() => {}} />
        </div>
      </section>

      {/* Badges */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ color: 'var(--cyan)', fontSize: '18px', marginBottom: '16px' }}>Badges</h2>
        <div className="uiverse-flex-center" style={{ gap: '12px', flexWrap: 'wrap' }}>
          <Badge>热门</Badge>
          <Badge>NEW</Badge>
          <Badge>Pro</Badge>
        </div>
      </section>

      {/* Loaders */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ color: 'var(--cyan)', fontSize: '18px', marginBottom: '16px' }}>Loaders</h2>
        <div className="uiverse-flex-center" style={{ gap: '24px' }}>
          <Spinner />
          <PulseRing />
        </div>
      </section>
    </div>
  );
}

export default {
  NeonButton,
  GradientButton,
  HoloButton,
  GlassCard,
  NeonCard,
  FloatCard,
  FloatingInput,
  Toggle,
  Badge,
  Spinner,
  PulseRing,
  FeatureShowcase,
  CTASection,
  UIDemo
};
