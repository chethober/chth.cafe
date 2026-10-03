import React, { useId, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button, Input } from '../ui';

/** Resize uploads before storing them in the existing image URL fields. */
export async function prepareImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not process this image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL('image/webp', 0.82);
    if (result.length > 900_000) throw new Error('This image is too detailed. Choose a smaller image.');
    return result;
  } finally { URL.revokeObjectURL(url); }
}

export function ImageUpload({ label, value, onChange, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <fieldset disabled={disabled || busy} className="ws-fieldset ws-field">
      <legend className="ws-label" style={{ marginBottom: 6 }}>{label}</legend>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="ws-panel" style={{ width: 88, height: 88, padding: 0, display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {value ? <img src={value} alt={`${label} preview`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImagePlus aria-hidden="true" style={{ color: 'var(--ws-muted)' }} />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button size="sm" icon={<ImagePlus />} loading={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Preparing…' : value ? 'Replace' : 'Upload'}</Button>
            {value && <Button size="sm" variant="danger-ghost" icon={<Trash2 />} onClick={() => { onChange(''); setError(''); }}>Remove</Button>}
          </div>
          <span className="ws-hint">JPEG, PNG, or WebP up to 10 MB. Resized automatically.</span>
        </div>
      </div>
      <input ref={fileRef} id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label={`Upload ${label}`} onChange={async event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setBusy(true); setError('');
        try { onChange(await prepareImage(file)); }
        catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not read this image.'); }
        finally { setBusy(false); }
      }} />
      <Input type="url" aria-label={`${label} URL`} value={value.startsWith('data:') ? '' : value} placeholder="Or paste an image URL" onChange={event => onChange(event.target.value)} style={{ marginTop: 10 }} />
      {error && <span role="alert" className="ws-error-text">{error}</span>}
    </fieldset>
  );
}
