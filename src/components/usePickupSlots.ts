import { useEffect, useState } from 'react';

export interface PickupSlot { at: string; label: string; remaining: number }

/** Today's open pickup slots, read while `active` and refreshed every minute so full and past slots drop off. */
export function usePickupSlots(active: boolean): { enabled: boolean; slots: PickupSlot[]; loading: boolean } {
  const [state, setState] = useState<{ enabled: boolean; slots: PickupSlot[]; loading: boolean }>({ enabled: false, slots: [], loading: false });
  useEffect(() => {
    if (!active) return;
    let live = true;
    const load = () => {
      setState(s => ({ ...s, loading: true }));
      fetch('/api/pickup-slots')
        .then(r => r.json() as Promise<{ data?: { enabled?: boolean; slots?: PickupSlot[] } }>)
        .then(({ data }) => { if (live) setState({ enabled: data?.enabled === true, slots: Array.isArray(data?.slots) ? data.slots : [], loading: false }); })
        .catch(() => { if (live) setState(s => ({ ...s, loading: false })); });
    };
    load();
    const timer = window.setInterval(load, 60_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [active]);
  return state;
}
