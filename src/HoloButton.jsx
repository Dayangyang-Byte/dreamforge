/**
 * Holographic Button Component
 * Iridescent, shimmering effect inspired by Uiverse
 */

export function HoloButton({ children, onClick, className = '', disabled = false, size = 'md' }) {
  const sizeClasses = {
    sm: 'padding: 10px 20px; font-size: 13px;',
    md: 'padding: 14px 28px; font-size: 15px;',
    lg: 'padding: 18px 36px; font-size: 17px;'
  };

  return (
    <button
      className={`uiverse-holo-btn ${className || ''}`}
      style={{
        ...sizeClasses[size],
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
