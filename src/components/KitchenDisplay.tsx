import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellOff, ChefHat, Clock, Maximize2, Minimize2, Undo2 } from 'lucide-react';
import { OrderItemSelect, OrderSelect, SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { Button, EmptyState, IconButton, ageLabel, minutesSince, orderTypeLabel } from '../ui';
import { optionNames } from '../utils/receipt';
import { pickupLabel } from '../utils/pickupSlots';
import { tr } from '../i18n';

type KitchenStatus = 'pending' | 'preparing' | 'ready';
const COLUMNS: { status: KitchenStatus; next: 'preparing' | 'ready' | 'completed'; label: () => string; action: () => string }[] = [
  { status: 'pending', next: 'preparing', label: () => tr('New'), action: () => tr('Tap to start') },
  { status: 'preparing', next: 'ready', label: () => tr('Making'), action: () => tr('Tap when ready') },
  { status: 'ready', next: 'completed', label: () => tr('Ready'), action: () => tr('Tap when collected') }
];
const LATE_AFTER_MIN = 10;
/** A scheduled pickup further off than this waits at the end of its column. */
const LATER_MIN = 30;
const CHIME_KEY = 'chth_kitchen_chime';

/** Two soft notes, made on the spot so the panel needs no sound files. */
function chime(context: AudioContext) {
  const start = context.currentTime;
  [880, 1320].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + index * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.25, start + index * 0.18 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + index * 0.18 + 0.4);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + index * 0.18);
    oscillator.stop(start + index * 0.18 + 0.45);
  });
}

/**
 * The kitchen screen: open orders in large type, oldest (or soonest due) first, with each line's options.
 * A tap moves an order along. It refreshes on its own and can chime when a new order arrives.
 */
export function KitchenDisplay({ settings, orders, orderItems, onStateChange }: {
  settings: SettingsSelect; orders: OrderSelect[]; orderItems: OrderItemSelect[]; onStateChange: () => void;
}) {
  const timeZone = settings.timeZone || 'UTC';
  const rootRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [fullscreen, setFullscreen] = useState(false);
  const [chimeOn, setChimeOn] = useState(() => { try { return localStorage.getItem(CHIME_KEY) === '1'; } catch { return false; } });
  const [lastMove, setLastMove] = useState<{ orderId: string; orderNumber: string; from: KitchenStatus; to: string } | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const seen = useRef<Set<string> | null>(null);

  // Orders reach this screen within a few seconds; hidden tabs wait until shown.
  useEffect(() => {
    const tick = () => { setNow(new Date()); if (document.visibilityState === 'visible') void store.syncFromAPI(); };
    const timer = window.setInterval(tick, 5000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  useEffect(() => { if (!lastMove) return; const timer = window.setTimeout(() => setLastMove(null), 6000); return () => window.clearTimeout(timer); }, [lastMove]);

  const itemsByOrder = useMemo(() => {
    const map = new Map<string, OrderItemSelect[]>();
    orderItems.forEach(item => { const list = map.get(item.orderId) || []; list.push(item); map.set(item.orderId, list); });
    return map;
  }, [orderItems]);
  const due = (o: OrderSelect) => o.pickupAt || o.createdAt;
  const open = orders.filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready');
  const later = (o: OrderSelect) => !!o.pickupAt && (new Date(o.pickupAt).getTime() - now.getTime()) / 60000 > LATER_MIN;

  // A new order chimes once; the orders already open when the screen opened do not.
  const pendingKey = open.filter(o => o.status === 'pending').map(o => o.id).sort().join();
  useEffect(() => {
    const pending = open.filter(o => o.status === 'pending').map(o => o.id);
    if (!seen.current) { seen.current = new Set(pending); return; }
    const fresh = pending.filter(id => !seen.current!.has(id));
    pending.forEach(id => seen.current!.add(id));
    if (fresh.length && chimeOn && audio.current) chime(audio.current);
  }, [pendingKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleChime = () => {
    const next = !chimeOn;
    setChimeOn(next);
    try { localStorage.setItem(CHIME_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
    // Browsers only allow sound after a tap, so the tap that turns it on also unlocks it.
    if (next) {
      const Context = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Context) { audio.current ||= new Context(); void audio.current.resume(); chime(audio.current); }
    }
  };
  useEffect(() => {
    if (!chimeOn || audio.current) return;
    const unlock = () => {
      const Context = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Context) { audio.current ||= new Context(); void audio.current.resume(); }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [chimeOn]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.().catch(() => {});
  };

  const advance = (order: OrderSelect, from: KitchenStatus, to: 'preparing' | 'ready' | 'completed') => {
    store.updateOrderStatus(order.id, to);
    setLastMove({ orderId: order.id, orderNumber: order.orderNumber, from, to });
    onStateChange();
  };
  const undo = () => {
    if (!lastMove) return;
    store.updateOrderStatus(lastMove.orderId, lastMove.from);
    setLastMove(null);
    onStateChange();
  };

  return (
    <div ref={rootRef} className="ws-kds" data-fullscreen={fullscreen || undefined}>
      <header className="ws-kds-bar">
        <h1><ChefHat aria-hidden="true" />{tr('Kitchen')}</h1>
        <span className="ws-kds-clock tabular">{pickupLabel(now.toISOString(), timeZone)}</span>
        <span className="ws-spacer" />
        {lastMove && (
          <Button variant="tonal" icon={<Undo2 />} onClick={undo}>
            {tr('Undo {orderNumber}', { orderNumber: lastMove.orderNumber })}
          </Button>
        )}
        <IconButton size="md" label={chimeOn ? tr('Turn the new-order chime off') : tr('Chime for new orders')} variant={chimeOn ? 'secondary' : 'ghost'} aria-pressed={chimeOn} onClick={toggleChime}>{chimeOn ? <Bell /> : <BellOff />}</IconButton>
        <IconButton size="md" label={fullscreen ? tr('Leave full screen') : tr('Full screen')} onClick={toggleFullscreen}>{fullscreen ? <Minimize2 /> : <Maximize2 />}</IconButton>
      </header>
      <div className="ws-kds-columns">
        {COLUMNS.map(column => {
          const list = open.filter(o => o.status === column.status)
            .sort((a, b) => Number(later(a)) - Number(later(b)) || due(a).localeCompare(due(b)));
          return (
            <section key={column.status} className="ws-kds-column" data-status={column.status} aria-label={tr('{label} orders', { label: column.label() })}>
              <h2>{column.label()} <span className="tabular">{list.length}</span></h2>
              {list.length === 0 ? <div className="ws-kds-empty">{column.status === 'pending' ? tr('No new orders.') : '—'}</div> : list.map(order => {
                const age = minutesSince(order.createdAt, now);
                const lines = itemsByOrder.get(order.id) || [];
                const late = column.status !== 'ready' && (order.pickupAt ? new Date(order.pickupAt) < now : age >= LATE_AFTER_MIN);
                return (
                  <button
                    key={order.id}
                    type="button"
                    className="ws-kds-ticket"
                    data-late={late || undefined}
                    data-later={later(order) || undefined}
                    onClick={() => advance(order, column.status, column.next)}
                    aria-label={tr('Order {orderNumber}, {count}. {action}', { orderNumber: order.orderNumber, count: lines.reduce((sum, l) => sum + l.quantity, 0), action: column.action() })}
                  >
                    <span className="ws-kds-ticket-head">
                      <strong className="ws-kds-num">{order.orderNumber}</strong>
                      <span className="ws-kds-age tabular"><Clock aria-hidden="true" />{ageLabel(age)}</span>
                    </span>
                    <span className="ws-kds-meta">
                      {orderTypeLabel(order.orderType)}{order.customerName ? ` · ${order.customerName}` : ''}
                      {order.pickupAt && <strong className="ws-kds-due">{tr('Pickup {time}', { time: pickupLabel(order.pickupAt, timeZone) })}</strong>}
                    </span>
                    <span className="ws-kds-lines">
                      {lines.map(line => {
                        const options = optionNames(line.variantsJson);
                        return (
                          <span key={line.id} className="ws-kds-line">
                            <span><strong className="tabular">{line.quantity}×</strong> {line.itemName}</span>
                            {options.length > 0 && <span className="ws-kds-options">{options.join(' · ')}</span>}
                          </span>
                        );
                      })}
                      {lines.length === 0 && <span className="ws-hint">{tr('No items recorded')}</span>}
                    </span>
                    <span className="ws-kds-action">{column.action()}</span>
                  </button>
                );
              })}
            </section>
          );
        })}
      </div>
      {open.length === 0 && <EmptyState icon={<ChefHat />} title={tr('All caught up')} description={tr('New orders appear here as they come in.')} />}
    </div>
  );
}
