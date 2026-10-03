import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button, IconButton } from './primitives';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Blocks Escape, scrim taps, the close button and drag-to-dismiss (e.g. while saving). */
  busy?: boolean;
}

const EXIT_MS = 220;
const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

/** Apple's scroll-deceleration projection: where a flick would come to rest. */
const project = (velocity: number, rate = 0.99) => ((velocity / 1000) * rate) / (1 - rate);

/**
 * One dialog for the whole workspace. Desktop: centered panel that scales in.
 * Phones: a bottom sheet that enters and leaves through the bottom edge and can be
 * dragged down to dismiss (tracks 1:1, rubber-bands upward, projects the flick).
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', busy = false }: DialogProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  // Keep the last open content so the exit animation doesn't render an empty shell.
  const snapshot = useRef({ title, description, children, footer });
  if (open) snapshot.current = { title, description, children, footer };
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (open) { setMounted(true); setClosing(false); return; }
    if (!mounted) return;
    setClosing(true);
    const timer = window.setTimeout(() => { setMounted(false); setClosing(false); }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus management, scroll lock, Escape and Tab trapping while open.
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => {
      const node = dialogRef.current;
      if (!node) return;
      const preferred = node.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
      (preferred || node).focus();
    });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) { e.preventDefault(); onCloseRef.current(); }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => !el.matches(':disabled') && el.getClientRects().length > 0);
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  /* Drag-to-dismiss (sheet layout only). */
  const drag = useRef<{ startY: number; samples: { y: number; t: number }[]; offset: number } | null>(null);
  const isSheet = () => window.matchMedia('(max-width: 639px)').matches;
  const setOffset = (y: number) => { if (dialogRef.current) dialogRef.current.style.transform = y ? `translateY(${y}px)` : ''; };

  const onPointerDown = (e: React.PointerEvent) => {
    if (busy || !isSheet() || (e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, samples: [{ y: e.clientY, t: e.timeStamp }], offset: 0 };
    dialogRef.current?.setAttribute('data-dragging', '');
    dialogRef.current?.removeAttribute('data-settling');
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const raw = e.clientY - d.startY;
    // Downward follows the finger 1:1; upward resists progressively (rubber band).
    const offset = raw >= 0 ? raw : -((-raw * 60 * 0.55) / (60 + 0.55 * -raw));
    d.offset = offset;
    d.samples.push({ y: e.clientY, t: e.timeStamp });
    if (d.samples.length > 5) d.samples.shift();
    setOffset(offset);
  };
  const onPointerUp = () => {
    const d = drag.current;
    const node = dialogRef.current;
    drag.current = null;
    if (!d || !node) return;
    node.removeAttribute('data-dragging');
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const velocity = last.t > first.t ? ((last.y - first.y) / (last.t - first.t)) * 1000 : 0;
    const projected = d.offset + project(velocity);
    const height = node.getBoundingClientRect().height;
    if (projected > height * 0.4 && velocity > -50) {
      // Continue from where the finger left it; the closed state animates the rest.
      node.style.transition = `transform ${EXIT_MS}ms cubic-bezier(0.23, 1, 0.32, 1)`;
      node.style.transform = 'translateY(105%)';
      onCloseRef.current();
    } else {
      node.setAttribute('data-settling', '');
      setOffset(0);
      window.setTimeout(() => node.removeAttribute('data-settling'), 400);
    }
  };

  if (!mounted || typeof document === 'undefined') return null;
  const content = snapshot.current;

  return createPortal(
    <div className="ws ws-dialog-root" data-state={closing ? 'closed' : 'open'} style={{ minHeight: 0, background: 'transparent' }}>
      <div className="ws-scrim" aria-hidden="true" onClick={() => { if (!busy) onClose(); }} />
      <div
        ref={dialogRef}
        className="ws-dialog"
        data-size={size}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={content.description ? descId : undefined}
        aria-busy={busy || undefined}
        tabIndex={-1}
      >
        <div className="ws-dialog-grabber" aria-hidden="true" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />
        <div className="ws-dialog-head" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <div>
            <h2 id={titleId}>{content.title}</h2>
            {content.description && <p id={descId}>{content.description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} disabled={busy}><X /></IconButton>
        </div>
        {content.children !== undefined && <div className="ws-dialog-body">{content.children}</div>}
        {content.footer && <div className="ws-dialog-foot">{content.footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/** Form dialog: the footer's submit button submits the body form. */
export function FormDialog({ open, onClose, title, description, size, busy, submitLabel, submitDisabled, onSubmit, children, destructive, secondaryAction }: Omit<DialogProps, 'footer' | 'children'> & {
  submitLabel: string;
  submitDisabled?: boolean;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  destructive?: boolean;
  secondaryAction?: React.ReactNode;
}) {
  const formId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      busy={busy}
      footer={
        <>
          {secondaryAction && <span className="ws-spacer">{secondaryAction}</span>}
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form={formId} variant={destructive ? 'danger' : 'primary'} loading={busy} disabled={submitDisabled}>{submitLabel}</Button>
        </>
      }
    >
      <form id={formId} className="ws-form" onSubmit={onSubmit} aria-busy={busy || undefined}>
        <fieldset className="ws-fieldset ws-form" disabled={busy}>{children}</fieldset>
      </form>
    </Dialog>
  );
}

/** Confirmation for destructive, hard-to-undo actions only. */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Delete', tone = 'danger' }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; description: React.ReactNode; confirmLabel?: string; tone?: 'danger' | 'neutral';
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose(); }} data-autofocus>{confirmLabel}</Button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {tone === 'danger' && <AlertTriangle aria-hidden="true" style={{ width: 20, height: 20, color: 'var(--ws-danger)', flexShrink: 0, marginTop: 2 }} />}
        <div style={{ color: 'var(--ws-muted)' }}>{description}</div>
      </div>
    </Dialog>
  );
}
