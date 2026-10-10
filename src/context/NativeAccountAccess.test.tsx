import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ single: vi.fn(), signOut: vi.fn() }));
vi.mock('../lib/nativePlatform', () => ({ isNativeApp: () => true }));
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'fixture' } } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    startAutoRefresh: vi.fn(), stopAutoRefresh: vi.fn(), signOut: mocks.signOut,
  },
  from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }),
} }));
import { AuthProvider } from './AuthContext';
import { NativeLifecycle } from '../components/NativeLifecycle';
import { ProtectedRoute } from '../components/ProtectedRoute';
const profile = (active: boolean) => ({ data: { id: 'fixture', full_name: 'Fixture', is_active: active, role: 'driver' }, error: null });
function mount() {
  render(<AuthProvider><NativeLifecycle /><MemoryRouter><Routes><Route element={<ProtectedRoute />}><Route path="/" element={<p>Protected content</p>} /></Route></Routes></MemoryRouter></AuthProvider>);
}
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); });
it('keeps a known inactive account blocked when a scene resume cannot verify the profile', async () => {
  mocks.single.mockResolvedValue(profile(false)); mount();
  await screen.findByRole('heading', { name: 'Your account is inactive' });
  mocks.single.mockResolvedValue({ data: null, error: { message: 'offline' } });
  await act(async () => { document.dispatchEvent(new Event('resume')); });
  expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Your account is inactive' })).toBeVisible();
});
it('blocks protected content during resume verification and offers retry after network failure', async () => {
  mocks.single.mockResolvedValue(profile(true)); mount(); await screen.findByText('Protected content');
  let finish!: (value: unknown) => void;
  mocks.single.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  act(() => { document.dispatchEvent(new Event('resume')); });
  expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  await act(async () => { finish({ data: null, error: { message: 'offline' } }); });
  expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  mocks.single.mockResolvedValue(profile(true));
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Protected content');
});
it('fails closed on initial verification failure and on a thrown refresh error', async () => {
  mocks.single.mockResolvedValue({ data: null, error: { message: 'offline' } }); mount();
  await screen.findByRole('button', { name: 'Try again' });
  mocks.single.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled());
  expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
});
