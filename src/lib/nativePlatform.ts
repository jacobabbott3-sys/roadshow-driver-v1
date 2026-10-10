import { Capacitor } from '@capacitor/core';
export function isNativeApp(): boolean { return Capacitor.isNativePlatform(); }
export async function openExternalUrl(url: string): Promise<void> {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.username || target.password) throw new Error('Unsupported external link.');
  if (isNativeApp()) {
    const { InAppBrowser } = await import('@capacitor/inappbrowser');
    await InAppBrowser.openInExternalBrowser({ url: target.href });
  } else {
    window.open(target.href, '_blank', 'noopener,noreferrer');
  }
}
