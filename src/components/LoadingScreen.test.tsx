import { render, screen } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import { LoadingScreen } from './LoadingScreen';
const native = vi.hoisted(() => ({ value:true }));
vi.mock('../lib/nativePlatform',()=>({isNativeApp:()=>native.value}));
it('uses the native launch brand without hiding accessible loading feedback',()=>{
  const view=render(<LoadingScreen label="Verifying your account…"/>);
  expect(screen.getByText('Roadshow Driver')).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Verifying your account…');
  native.value=false; view.rerender(<LoadingScreen/>);
  expect(screen.queryByText('Roadshow Driver')).toBeNull();
  expect(screen.getByRole('status')).toHaveTextContent('Getting your roadshow ready…');
  native.value=true;
});
