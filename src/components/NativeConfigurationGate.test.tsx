import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NativeConfigurationGate } from './NativeConfigurationGate';
describe('NativeConfigurationGate',()=>{
  it('blocks the application before its auth/network effects can mount',()=>{
    const connected = vi.fn();
    function App(){ connected(); return <p>Connected</p>; }
    render(<NativeConfigurationGate error="Rebuild with public configuration"><App/></NativeConfigurationGate>);
    expect(screen.getByRole('alert')).toHaveTextContent('Rebuild with public configuration');
    expect(connected).not.toHaveBeenCalled();
  });
  it('renders the app for valid configuration',()=>{
    render(<NativeConfigurationGate error={null}><p>Ready</p></NativeConfigurationGate>);
    expect(screen.getByText('Ready')).toBeVisible();
  });
});
