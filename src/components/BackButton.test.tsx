import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { it, expect, vi } from 'vitest';
import { BackButton } from './BackButton';
import { ShellPresentationContext } from '../native/useShellPresentation';
const native = vi.hoisted(() => ({ value: true }));
vi.mock('../lib/nativePlatform', () => ({ isNativeApp: () => native.value }));
it('hides duplicate route back only when native navigation is ready and restores fallback', () => {
  const content = (ready: boolean) => <MemoryRouter initialEntries={['/contracts/example']}><ShellPresentationContext.Provider value={{ready,chats:0,notifications:0,setModalOpen:()=>{}}}><BackButton to="/contracts" label="Back to contracts" /></ShellPresentationContext.Provider></MemoryRouter>;
  const view = render(content(false));
  expect(screen.getByRole('link', {name:'Back to contracts'})).toBeVisible();
  view.rerender(content(true));
  expect(screen.queryByRole('link')).toBeNull();
  view.rerender(content(false));
  expect(screen.getByRole('link')).toBeVisible();
  native.value = false;
  view.rerender(content(true));
  expect(screen.getByRole('link')).toBeVisible();
  native.value = true;
});
it('keeps local controls such as All chats even with native navigation', () => {
  const action = vi.fn();
  render(<MemoryRouter><ShellPresentationContext.Provider value={{ready:true,chats:0,notifications:0,setModalOpen:()=>{}}}><BackButton label="All chats" onClick={action} /></ShellPresentationContext.Provider></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'All chats'}));
  expect(action).toHaveBeenCalledOnce();
});

it('keeps recovery navigation outside the native signed-in shell',()=>{
  render(<MemoryRouter initialEntries={['/forgot-password']}><ShellPresentationContext.Provider value={{ready:true,chats:0,notifications:0,setModalOpen:()=>{}}}><BackButton to="/login" label="Back to sign in" /></ShellPresentationContext.Provider></MemoryRouter>);
  expect(screen.getByRole('link',{name:'Back to sign in'})).toBeVisible();
});
