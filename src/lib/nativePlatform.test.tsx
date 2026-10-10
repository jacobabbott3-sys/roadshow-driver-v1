import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({native:true,open:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>mocks.native}}));
vi.mock('@capacitor/inappbrowser',()=>({InAppBrowser:{openInExternalBrowser:mocks.open}}));
import { openExternalUrl } from './nativePlatform';
beforeEach(()=>{vi.clearAllMocks();mocks.native=true;});
it('rejects unsafe external navigation before native dispatch',async()=>{
 for(const url of ['javascript:alert(1)','http://example.test','https://user:pass@example.test']) await expect(openExternalUrl(url)).rejects.toThrow();
 expect(mocks.open).not.toHaveBeenCalled();
});
it('uses the device default browser for HTTPS',async()=>{
 await openExternalUrl('https://www.roadshowdriver.com/forgot-password');
 expect(mocks.open).toHaveBeenCalledWith({url:'https://www.roadshowdriver.com/forgot-password'});
});
