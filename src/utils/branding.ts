const DEFAULT_FAVICON = '/favicon.svg';

/** Points the tab icon at the café logo, falling back to the bundled icon when there is none or it fails to load. */
export function applyFavicon(logoUrl?: string | null) {
  if (typeof document === 'undefined') return;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  const target = link;
  const useDefault = () => {
    target.type = 'image/svg+xml';
    target.href = DEFAULT_FAVICON;
  };

  const url = logoUrl?.trim();
  if (!url) { useDefault(); return; }

  const probe = new Image();
  probe.onload = () => {
    target.removeAttribute('type');
    target.href = url;
  };
  probe.onerror = useDefault;
  probe.src = url;
}

export function brandTitle(cafeName: string | undefined, section?: string) {
  const name = cafeName?.trim() || 'CHTH';
  return section ? `${name} · ${section}` : name;
}
