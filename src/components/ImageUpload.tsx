import React, { useId, useState } from 'react';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <fieldset disabled={disabled || busy} className="space-y-3 image-upload">
    <legend className="text-sm font-semibold mb-2">{label}</legend>
    {value && <div className="flex items-center gap-3"><img src={value} alt={`${label} preview`} className="image-upload-preview" /><button type="button" onClick={() => { onChange(''); setError(''); }} className="appearance-reset">Remove image</button></div>}
    <label htmlFor={id} className="block text-xs text-zinc-400">Upload JPEG, PNG, or WebP (up to 10 MB)</label>
    <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="w-full text-sm" onChange={async event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      setBusy(true); setError('');
      try { onChange(await prepareImage(file)); }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not read this image.'); }
      finally { setBusy(false); }
    }} />
    <label htmlFor={`${id}-url`} className="block text-xs text-zinc-400">Or use an image URL</label>
    <input id={`${id}-url`} type="url" value={value.startsWith('data:') ? '' : value} placeholder="https://example.com/photo.jpg" onChange={event => onChange(event.target.value)} className="w-full p-3 bg-zinc-900 border border-zinc-800 text-zinc-100" />
    <p className="text-xs text-zinc-400" role="status">{busy ? 'Preparing image…' : value.startsWith('data:') ? 'Image ready. Save the form to keep it.' : 'Images are resized automatically. Save the form to keep changes.'}</p>
    {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
  </fieldset>;
}
