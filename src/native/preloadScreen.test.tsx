import { it, expect, vi } from 'vitest';
const loaded = vi.hoisted(() => ({home:vi.fn(),contract:vi.fn(),render:vi.fn()}));
vi.mock('../pages/HomePage', () => { loaded.home(); return {HomePage: loaded.render}; });
vi.mock('../pages/ContractDetailPage', () => { loaded.contract(); return {ContractDetailPage: loaded.render}; });
import { preloadNativeScreen } from './preloadScreen';
it('loads initial page code without mounting it or starting page data effects', async () => {
  await preloadNativeScreen('/');
  expect(loaded.home).toHaveBeenCalledOnce();
  expect(loaded.render).not.toHaveBeenCalled();
  await preloadNativeScreen('/contracts/assignment-id');
  expect(loaded.contract).toHaveBeenCalledOnce();
  expect(loaded.render).not.toHaveBeenCalled();
});
it('does not invent a route for unknown or authentication paths', async () => {
  await expect(preloadNativeScreen('/unknown')).resolves.toBeUndefined();
  await expect(preloadNativeScreen('/login')).resolves.toBeUndefined();
});
