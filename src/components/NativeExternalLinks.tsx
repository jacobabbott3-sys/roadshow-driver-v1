import { useEffect, useState } from 'react';
import { isNativeApp, openExternalUrl } from '../lib/nativePlatform';
export function NativeExternalLinks() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!isNativeApp()) return;
    function follow(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const url = new URL(anchor.href);
      if (url.origin === window.location.origin || url.protocol !== 'https:') return;
      event.preventDefault(); setFailed(false);
      void openExternalUrl(url.href).catch(() => setFailed(true));
    }
    document.addEventListener('click', follow);
    return () => document.removeEventListener('click', follow);
  }, []);
  return failed ? <div className="native-link-error" role="alert">Unable to open this link. Please try again.<button type="button" onClick={()=>setFailed(false)}>Dismiss</button></div> : null;
}
