import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({native:true,open:vi.fn(),reset:vi.fn()}));
vi.mock('../lib/nativePlatform',()=>({isNativeApp:()=>mocks.native,openExternalUrl:mocks.open}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>({resetPassword:mocks.reset})}));
import { ForgotPasswordPage } from './ForgotPasswordPage';
beforeEach(()=>{vi.clearAllMocks(); mocks.native=true; mocks.open.mockResolvedValue(undefined);});
it('opens public recovery in the system browser without sending mail',async()=>{
 render(<MemoryRouter><ForgotPasswordPage/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Open password recovery'}));
 await waitFor(()=>expect(mocks.open).toHaveBeenCalledWith('https://www.roadshowdriver.com/forgot-password'));
 expect(mocks.reset).not.toHaveBeenCalled();
 expect(screen.getByText(/Return here/)).toBeVisible();
});
it('shows a recoverable browser launch failure',async()=>{
 mocks.open.mockRejectedValue(new Error('native unavailable'));
 render(<MemoryRouter><ForgotPasswordPage/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Open password recovery'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Unable to open');
});
it('retains web password recovery',async()=>{
 mocks.native=false;
 render(<MemoryRouter><ForgotPasswordPage/></MemoryRouter>);
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'fixture@example.test'}});
 fireEvent.click(screen.getByRole('button',{name:'Send reset link'}));
 await waitFor(()=>expect(mocks.reset).toHaveBeenCalledWith('fixture@example.test'));
 expect(mocks.open).not.toHaveBeenCalled();
});
