import cloudIconUrl from '../../../assets/skydot-icon.svg?no-inline';

// Vite fingerprints the approved cloud mark, so cached legacy PNGs cannot replace it.
export const appIconUrl = cloudIconUrl;
export const appNotificationIconUrl = `${import.meta.env.BASE_URL}icons/icon-192.png?v=${encodeURIComponent(cloudIconUrl)}`;

/** Presentation only. Keep persisted compatibility keys and custom site names. */
export function productAppName(name?: string | null): string {
  return !name || ['SkyDot', 'SkyDot'].includes(name) ? 'SkyDot' : name;
}
