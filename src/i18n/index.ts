import { useSyncExternalStore } from 'react';
import { getLocale, subscribeLocale, tr, type Locale } from './translate';

export * from './translate';

/** The current customer language; re-renders when it changes. */
export const useLocale = (): Locale => useSyncExternalStore(subscribeLocale, getLocale, () => 'en' as Locale);

/** A translate function bound to the current language. */
export function useT() {
  const locale = useLocale();
  return (key: string, vars?: Record<string, string | number>) => tr(key, vars, locale);
}
