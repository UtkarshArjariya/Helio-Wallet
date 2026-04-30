import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { SolarPatterns } from './theme';

export function PremiumCard({ 
  children, 
  className, 
  variant = 'default',
  showPattern = false 
}: { 
  children: React.ReactNode; 
  className?: string;
  variant?: 'default' | 'solar' | 'cosmic';
  showPattern?: boolean;
}) {
  const variants = {
    default: "bg-surface-1 border-border",
    solar: "bg-gradient-to-br from-[#F5D548]/10 via-[#FF9448]/5 to-transparent border-accent-primary/20",
    cosmic: "bg-gradient-to-br from-[#7C5CFF]/10 via-[#58A6FF]/5 to-transparent border-accent-tertiary/20"
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-3xl border p-6 shadow-surface overflow-hidden group",
        variants[variant],
        className
      )}
    >
      {showPattern && <SolarPatterns.OrbitalLines />}
      <div className="relative z-10">{children}</div>
      
      {/* Premium hover glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
    </motion.div>
  );
}

export function PremiumButton({ 
  children, 
  className, 
  variant = 'primary',
  size = 'default',
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'ghost' | 'solar';
  size?: 'default' | 'sm' | 'icon';
}) {
  const baseStyles = "relative inline-flex items-center justify-center font-bold tracking-wider uppercase transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none overflow-hidden";
  
  const variants = {
    primary: "bg-text-primary text-background rounded-2xl hover:bg-white",
    secondary: "bg-surface-2 text-text-primary border border-border rounded-2xl hover:bg-surface-3",
    ghost: "text-text-secondary hover:text-text-primary",
    solar: "bg-gradient-to-r from-[#F5D548] to-[#FF9448] text-background rounded-2xl shadow-glow hover:brightness-110"
  };

  const sizes = {
    default: "h-14 px-8 text-xs",
    sm: "h-10 px-4 text-[10px]",
    icon: "h-14 w-14 rounded-full"
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      <span className="relative z-10">{children}</span>
      {variant === 'solar' && (
        <motion.div 
          className="absolute inset-0 bg-white/20"
          initial={{ x: '-100%' }}
          whileHover={{ x: '100%' }}
          transition={{ duration: 0.6 }}
        />
      )}
    </button>
  );
}
