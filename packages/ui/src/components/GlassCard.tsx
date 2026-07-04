import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'frosted';
  gradient?: boolean;
  onClick?: () => void;
}

export function GlassCard({ 
  children, 
  className = '', 
  variant = 'default',
  gradient = false,
  onClick 
}: GlassCardProps) {
  const baseClasses = 'glass-card';
  const variantClasses = {
    default: 'glass-default',
    elevated: 'glass-elevated',
    frosted: 'glass-frosted',
  };
  
  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${gradient ? 'glass-gradient' : ''} ${className}`}
      onClick={onClick}
      style={{
        background: variant === 'frosted' 
          ? 'rgba(255, 255, 255, 0.08)'
          : 'var(--bg)',
        backdropFilter: variant === 'frosted' ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: variant === 'frosted' ? 'blur(20px)' : 'none',
        border: '1px solid',
        borderColor: gradient ? 'rgba(91, 46, 255, 0.3)' : 'var(--border)',
        borderRadius: '16px',
        padding: '24px',
        transition: 'all 0.3s ease',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: variant === 'elevated' 
          ? '0 10px 40px rgba(91, 46, 255, 0.15)' 
          : 'var(--shadow-sm)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {gradient && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, rgba(91, 46, 255, 0.05) 0%, rgba(255, 77, 157, 0.05) 100%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

export function GlassPanel({ 
  children, 
  className = '' 
}: { 
  children: ReactNode;
  className?: string;
}) {
  return (
    <div 
      className={`glass-panel ${className}`}
      style={{
        background: 'rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      {children}
    </div>
  );
}

export function GlassButton({ 
  children, 
  className = '',
  variant = 'primary',
  onClick,
  disabled = false
}: { 
  children: ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  onClick?: () => void;
  disabled?: boolean;
}) {
  const styles = {
    primary: {
      background: 'linear-gradient(135deg, #5B2EFF 0%, #8A3FFC 100%)',
      color: 'white',
      border: 'none',
    },
    secondary: {
      background: 'rgba(91, 46, 255, 0.1)',
      color: '#5B2EFF',
      border: '1px solid rgba(91, 46, 255, 0.3)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text2)',
      border: '1px solid var(--border)',
    },
  };

  return (
    <button 
      className={`glass-btn glass-btn-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        padding: '10px 20px',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s ease',
        fontFamily: 'Jost, inherit',
      }}
    >
      {children}
    </button>
  );
}

export default GlassCard;
