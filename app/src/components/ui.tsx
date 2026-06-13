// v6.0 shared UI kit — travel-poster language: paper cards, sunset CTAs,
// road-sign labels. No emoji (lucide icons only).
import type { ReactNode } from 'react';

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
}) {
  const styles = {
    primary:
      'bg-sunset text-paper shadow-warm hover:bg-sunset-deep hover:-translate-y-0.5 active:translate-y-0',
    secondary:
      'bg-paper text-ink border-2 border-ink/12 shadow-card hover:border-sunset/60 hover:-translate-y-0.5 active:translate-y-0',
    ghost: 'bg-transparent text-ink-soft hover:text-ink hover:bg-ink/5',
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-6 py-3 font-display font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-paper p-5 shadow-card ${className}`}>{children}</div>
  );
}

/** Road-sign style section label. */
export function SignLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`inline-block rounded-lg border-2 border-ink/15 bg-paper px-3 py-1 font-display text-xs font-medium uppercase tracking-[0.18em] text-ink-soft ${className}`}
    >
      {children}
    </p>
  );
}

/** The animated yellow center line — Roadie's horizontal rule. */
export function RoadDivider({ className = '' }: { className?: string }) {
  return <div className={`road-dashes w-full ${className}`} aria-hidden />;
}

/** Light glass panel for overlays that sit on the 3D scene. */
export function Glass({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-paper/85 shadow-card backdrop-blur-md ${className}`}>
      {children}
    </div>
  );
}
