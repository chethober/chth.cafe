import { useSyncExternalStore } from 'react';
import { getLocale, getStringsVersion, subscribeLocale, tr, type Locale, type Vars } from './translate';

export * from './translate';

/** The current language; re-renders when it changes. */
export const useLocale = (): Locale => useSyncExternalStore(subscribeLocale, getLocale, () => 'en' as Locale);

/** Re-renders when the language changes or more strings load (the staff table). */
export const useStrings = (): string => useSyncExternalStore(subscribeLocale, getStringsVersion, () => 'en:0');

/** A translate function bound to the current language. */
export function useT() {
  const locale = useLocale();
  useStrings();
  return (key: string, vars?: Vars) => tr(key, vars, locale);
}
