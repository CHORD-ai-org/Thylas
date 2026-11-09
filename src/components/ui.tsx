import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { IconDisclosure, IconNote } from './icons';
import type { FileKind } from '../lib/types';
import type { Tone } from '../lib/tone';
import s from './ui.module.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'quiet' | 'ghost';
  size?: 'sm' | 'md';
  icon?: ReactNode;
};

export function Button({ variant = 'quiet', size = 'md', icon, children, className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={[s.button, s[variant], size === 'sm' ? s.sm : '', className ?? ''].join(' ').trim()}
      {...rest}
    >
      {icon ? <span className={s.btnIcon}>{icon}</span> : null}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  active,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={[s.iconButton, active ? s.iconActive : '', className ?? ''].join(' ').trim()}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Chip({
  tone = 'idle',
  children,
  title,
}: {
  tone?: Tone | 'plain';
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={[s.chip, s[`tone_${tone}`]].join(' ')} title={title}>
      {children}
    </span>
  );
}

export function StatusDot({ tone = 'idle', pulse = false }: { tone?: Tone; pulse?: boolean }) {
  return <span className={[s.dot, s[`tone_${tone}`], pulse ? s.pulse : ''].join(' ')} aria-hidden />;
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className={s.badge}>{children}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}

export function SectionLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className={s.sectionLabel}>
      <span>{children}</span>
      {aside ? <span className={s.labelAside}>{aside}</span> : null}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <div className={s.empty}>
      <p className={s.emptyTitle}>{title}</p>
      <p className={s.emptyHint}>{hint}</p>
      {action ? <div className={s.emptyAction}>{action}</div> : null}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={s.field}>
      <span className={s.fieldLabel}>{label}</span>
      <span className={s.fieldValue}>{children}</span>
    </div>
  );
}

const GLYPH: Record<FileKind, string> = {
  pdf: 'PDF',
  csv: 'CSV',
  md: 'MD',
  parquet: 'PQ',
  json: 'JS',
  png: 'IMG',
  txt: 'TXT',
};

export function TypeGlyph({ kind }: { kind: FileKind }) {
  return <span className={s.glyph}>{GLYPH[kind]}</span>;
}

export function NoteGlyph() {
  return (
    <span className={s.glyph} title="Note">
      <IconNote size={11} />
    </span>
  );
}

export function ProcessGlyph() {
  return (
    <span className={s.glyph} title="Process run">
      <IconDisclosure size={11} />
    </span>
  );
}
