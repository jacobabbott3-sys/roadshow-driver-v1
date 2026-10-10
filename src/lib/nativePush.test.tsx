import { expect, it, vi } from 'vitest';
vi.mock('./nativePlatform',()=>({isNativeApp:()=>true}));
vi.mock('./supabase',()=>({supabase:{}}));
import { deviceNotificationsSupported, enableDeviceNotifications } from './pushNotifications';
it('native push is unavailable even with browser APIs present',async()=>{
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{register:vi.fn()}});
 vi.stubGlobal('PushManager', class {});vi.stubGlobal('Notification',{requestPermission:vi.fn()});
 expect(deviceNotificationsSupported()).toBe(false);
 await expect(enableDeviceNotifications('fixture')).rejects.toThrow();
 expect(navigator.serviceWorker.register).not.toHaveBeenCalled();
 vi.unstubAllGlobals();
});
