import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { UpdatePasswordPage } from './UpdatePasswordPage';
import { AuthConfirmPage } from './AuthConfirmPage';
import { ProtectedRoute } from '../components/ProtectedRoute';
const mocks = vi.hoisted(() => ({ resetPassword: vi.fn(), updateUser: vi.fn(), verifyOtp: vi.fn(), user: { id: 'test-user' } as {id:string}|null }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({user:mocks.user, profile:{is_active:true}, loading:false, resetPassword:mocks.resetPassword}) }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { updateUser:mocks.updateUser, verifyOtp:mocks.verifyOtp } } }));
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); mocks.user = {id:'test-user'}; });
function renderPage(page: React.ReactNode, path = '/') {
  return render(<StrictMode><MemoryRouter initialEntries={[path]}><Routes><Route path="/" element={page}/><Route path="/auth/confirm" element={page}/><Route path="/update-password" element={<p>Password setup</p>}/></Routes></MemoryRouter></StrictMode>);
}
it('suppresses duplicate recovery requests and never claims delivery', async () => {
  let resolve!: () => void;
  mocks.resetPassword.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  renderPage(<ForgotPasswordPage/>);
  fireEvent.change(screen.getByLabelText('Email address'), {target:{value:'test@example.test'}});
  const form = screen.getByRole('button', {name:'Send reset link'}).closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(mocks.resetPassword).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', {name:'Requesting…'})).toBeDisabled();
  await act(async () => resolve());
  expect(screen.getByRole('status')).toHaveTextContent('This does not confirm email delivery');
});
it('retains email and permits manual retry after provider failure without exposing raw errors', async () => {
  mocks.resetPassword.mockRejectedValueOnce(new Error('private provider detail')).mockResolvedValueOnce(undefined);
  renderPage(<ForgotPasswordPage/>);
  fireEvent.change(screen.getByLabelText('Email address'), {target:{value:'test@example.test'}});
  fireEvent.click(screen.getByRole('button', {name:'Send reset link'}));
  expect(await screen.findByRole('alert')).not.toHaveTextContent('private provider detail');
  expect(screen.getByLabelText('Email address')).toHaveValue('test@example.test');
  fireEvent.click(screen.getByRole('button', {name:'Send reset link'}));
  expect(await screen.findByRole('status')).toBeVisible();
  expect(mocks.resetPassword).toHaveBeenCalledTimes(2);
});
for (const type of ['signup', 'email_change', 'magiclink', '']) it(`rejects unsupported callback type ${type}`, async () => {
  renderPage(<AuthConfirmPage/>, `/auth/confirm?token_hash=fake&type=${type}`);
  expect(await screen.findByText(/link is incomplete/)).toBeVisible();
  expect(mocks.verifyOtp).not.toHaveBeenCalled();
});
for (const type of ['invite','recovery']) it(`exchanges ${type} once under StrictMode and opens password setup`, async () => {
  mocks.verifyOtp.mockResolvedValue({data:{session:{user:{id:'test-user'}}},error:null});
  renderPage(<AuthConfirmPage/>, `/auth/confirm?token_hash=fake&type=${type}`);
  expect(await screen.findByText('Password setup')).toBeVisible();
  expect(mocks.verifyOtp).toHaveBeenCalledExactlyOnceWith({token_hash:'fake',type});
  expect(sessionStorage.getItem('roadshow-auth-flow')).toBe(type);
});
it('handles expired OTP without entering password setup', async () => {
  mocks.verifyOtp.mockResolvedValue({data:{session:null},error:{message:'expired'}});
  renderPage(<AuthConfirmPage/>, '/auth/confirm?token_hash=fake&type=recovery');
  expect(await screen.findByText(/invalid or expired/)).toBeVisible();
  expect(sessionStorage.getItem('roadshow-auth-flow')).toBeNull();
});
it('handles rejected OTP transport', async () => {
  mocks.verifyOtp.mockRejectedValue(new Error('offline'));
  renderPage(<AuthConfirmPage/>, '/auth/confirm?token_hash=fake&type=recovery');
  expect(await screen.findByText(/couldn’t verify/)).toBeVisible();
});
it('does not apply a callback after unmount', async () => {
  let resolve!: (value: unknown) => void;
  mocks.verifyOtp.mockImplementation(() => new Promise(done => {resolve=done;}));
  const view = renderPage(<AuthConfirmPage/>, '/auth/confirm?token_hash=fake&type=recovery');
  view.unmount();
  await act(async () => resolve({data:{session:{}},error:null}));
  expect(sessionStorage.getItem('roadshow-auth-flow')).toBeNull();
});
it('routes recovery sessions at the site root to password setup', async () => {
  sessionStorage.setItem('roadshow-auth-flow','recovery');
  renderPage(<ProtectedRoute/>);
  expect(await screen.findByText('Password setup')).toBeVisible();
});
it('blocks password updates for an expired session', () => {
  mocks.user=null;
  renderPage(<UpdatePasswordPage/>);
  expect(screen.getByRole('button',{name:'Save new password'})).toBeDisabled();
  expect(mocks.updateUser).not.toHaveBeenCalled();
});
it('retains recovery flow and permits retry when password update fails', async () => {
  sessionStorage.setItem('roadshow-auth-flow','recovery');
  mocks.updateUser.mockRejectedValueOnce(new Error('session expired'));
  renderPage(<UpdatePasswordPage/>);
  fireEvent.change(screen.getByLabelText('New password'),{target:{value:'synthetic-password'}});
  fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:'synthetic-password'}});
  fireEvent.click(screen.getByRole('button',{name:'Save new password'}));
  expect(await screen.findByText(/couldn’t save your password/)).toBeVisible();
  expect(sessionStorage.getItem('roadshow-auth-flow')).toBe('recovery');
  expect(screen.getByRole('button',{name:'Save new password'})).toBeEnabled();
});
it('requires a session even when OTP verification returns no error', async () => {
  mocks.verifyOtp.mockResolvedValue({data:{session:null},error:null});
  renderPage(<AuthConfirmPage/>, '/auth/confirm?token_hash=fake&type=recovery');
  expect(await screen.findByText(/invalid or expired/)).toBeVisible();
});
it('suppresses duplicate password saves and clears flow only after success', async () => {
  sessionStorage.setItem('roadshow-auth-flow','recovery');
  let resolve!: (value: unknown) => void;
  mocks.updateUser.mockImplementation(() => new Promise(done => {resolve=done;}));
  renderPage(<UpdatePasswordPage/>);
  fireEvent.change(screen.getByLabelText('New password'),{target:{value:'synthetic-password'}});
  fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:'synthetic-password'}});
  const form = screen.getByRole('button',{name:'Save new password'}).closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(mocks.updateUser).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem('roadshow-auth-flow')).toBe('recovery');
  await act(async () => resolve({error:null}));
  expect(sessionStorage.getItem('roadshow-auth-flow')).toBeNull();
});
