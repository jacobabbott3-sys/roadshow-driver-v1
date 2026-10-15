import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AdminAccountControls } from './AdminAccountControls';
import { AccountRequestError } from '../lib/adminAccounts';
const mock=vi.hoisted(()=>({request:vi.fn(),auth:{user:{id:'admin'} as {id:string}|null,profile:{id:'admin',role:'admin',is_active:true},session:{access_token:'synthetic-token'}}}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>mock.auth}));
vi.mock('../lib/adminAccounts',()=>({accountManagementEnabled:false,accountRequest:mock.request,AccountRequestError:class extends Error { retryAllowed:boolean;constructor(message:string,retryAllowed=false){super(message);this.retryAllowed=retryAllowed;} }}));
const invited={id:'driver',email:'test@example.test',fullName:'Test Driver',role:'driver',active:true,invitationStatus:'invited',emailDeliveryStatus:'unknown'};
const page={accounts:[invited],nextCursor:null};
beforeEach(()=>{vi.resetAllMocks();mock.auth={user:{id:'admin'},profile:{id:'admin',role:'admin',is_active:true},session:{access_token:'synthetic-token'}};mock.request.mockResolvedValue(page);});
async function open(){const view=render(<AdminAccountControls enabled/>);await screen.findByText('test@example.test');return view;}
function fill(){fireEvent.change(screen.getByLabelText('Driver name'),{target:{value:'New Driver'}});fireEvent.change(screen.getByLabelText('Invitation email'),{target:{value:'new@example.test'}});}
it('default-off shows a notice and makes no endpoint calls',()=>{render(<AdminAccountControls/>);expect(screen.getByText(/not enabled yet/)).toBeVisible();expect(mock.request).not.toHaveBeenCalled();});
it.each(['driver','inactive','mismatch','signedout'])('does not reveal account controls to %s',mode=>{
 if(mode==='driver')mock.auth.profile.role='driver';if(mode==='inactive')mock.auth.profile.is_active=false;if(mode==='mismatch')mock.auth.profile.id='other';if(mode==='signedout')mock.auth.user=null;
 render(<AdminAccountControls enabled/>);expect(screen.queryByLabelText('Invitation email')).not.toBeInTheDocument();expect(mock.request).not.toHaveBeenCalled();
});
it('shows invitation state separately from activity and keeps confirmed recovery distinct',async()=>{
 mock.request.mockResolvedValue({accounts:[invited,{...invited,id:'confirmed',email:'confirmed@example.test',fullName:'Confirmed Driver',invitationStatus:'confirmed'}, {...invited,id:'inactive',email:'inactive@example.test',fullName:'Inactive Driver',active:false}],nextCursor:null});
 await open();const confirmed=screen.getByText('confirmed@example.test').closest('article')!;
 expect(within(confirmed).getByRole('button',{name:'Resend invitation'})).toBeDisabled();expect(within(confirmed).getByRole('button',{name:'Send password recovery'})).toBeEnabled();
 const inactive=screen.getByRole('heading',{name:'Inactive Driver'}).closest('article')!;expect(within(inactive).getByRole('button',{name:'Resend invitation'})).toBeDisabled();
});
it('creates driver without a role/redirect field and suppresses pending duplicate submits',async()=>{
 await open();fill();let resolve!:(value:unknown)=>void;mock.request.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 const form=screen.getByRole('button',{name:'Create driver and invite'}).closest('form')!;fireEvent.submit(form);fireEvent.submit(form);
 expect(mock.request).toHaveBeenCalledTimes(2);const command=mock.request.mock.calls[1][0];expect(command).toMatchObject({action:'create',email:'new@example.test',fullName:'New Driver'});expect(command).not.toHaveProperty('role');expect(command).not.toHaveProperty('redirectTo');
 await act(async()=>resolve({emailRequestStatus:'accepted'}));expect(screen.getByRole('status')).toHaveTextContent('Delivery has not been confirmed');
});
it('retains inputs and same request ID after uncertain failure; no automatic retry',async()=>{
 await open();fill();mock.request.mockRejectedValueOnce(new AccountRequestError('Request outcome is unknown.'));
 fireEvent.click(screen.getByRole('button',{name:'Create driver and invite'}));expect(await screen.findByRole('alert')).toHaveTextContent('unknown');
 expect(screen.getByLabelText('Invitation email')).toHaveValue('new@example.test');expect(mock.request).toHaveBeenCalledTimes(2);
 const first=mock.request.mock.calls[1][0].requestId;mock.request.mockResolvedValueOnce({emailRequestStatus:'accepted'});
 fireEvent.click(screen.getByRole('button',{name:'Create driver and invite'}));await screen.findByRole('status');expect(mock.request.mock.calls[2][0].requestId).toBe(first);
});
it('a deliberate later resend gets a new ID after success, rather than replaying old email',async()=>{
 await open();mock.request.mockResolvedValue({emailRequestStatus:'accepted'});const resend=screen.getByRole('button',{name:'Resend invitation'});
 fireEvent.click(resend);await screen.findByRole('status');const first=mock.request.mock.calls[1][0].requestId;
 fireEvent.click(resend);await waitFor(()=>expect(mock.request).toHaveBeenCalledTimes(3));expect(mock.request.mock.calls[2][0].requestId).not.toBe(first);
});
it('known rejection permits an explicit new request ID',async()=>{
 await open();mock.request.mockRejectedValueOnce(new AccountRequestError('Email rejected. Try again after one minute.',true));const resend=screen.getByRole('button',{name:'Resend invitation'});
 fireEvent.click(resend);await screen.findByRole('alert');const first=mock.request.mock.calls[1][0].requestId;mock.request.mockResolvedValueOnce({emailRequestStatus:'accepted'});
 fireEvent.click(resend);await screen.findByRole('status');expect(mock.request.mock.calls[2][0].requestId).not.toBe(first);
});
it('clears displayed account data on a session change and ignores late old-session response',async()=>{
 let resolve!:(value:unknown)=>void;mock.request.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));const view=render(<AdminAccountControls enabled/>);
 mock.auth.user=null;view.rerender(<AdminAccountControls enabled/>);await act(async()=>resolve(page));expect(screen.queryByText('test@example.test')).not.toBeInTheDocument();
});
it('ignores late mutation feedback after admin access is revoked',async()=>{
 const view=await open();let resolve!:(value:unknown)=>void;mock.request.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));fireEvent.click(screen.getByRole('button',{name:'Resend invitation'}));
 mock.auth.profile.is_active=false;view.rerender(<AdminAccountControls enabled/>);await act(async()=>resolve({emailRequestStatus:'accepted'}));expect(screen.queryByRole('status')).not.toBeInTheDocument();expect(screen.queryByText('test@example.test')).not.toBeInTheDocument();
});
it('loads next account page and recovers from list failures without leaking errors',async()=>{
 mock.request.mockRejectedValueOnce(new Error('private service detail'));render(<AdminAccountControls enabled/>);expect(await screen.findByRole('alert')).not.toHaveTextContent('private service detail');
 mock.request.mockResolvedValueOnce({...page,nextCursor:'2'});fireEvent.click(screen.getByRole('button',{name:'Refresh account status'}));await screen.findByText('test@example.test');
 mock.request.mockResolvedValueOnce({accounts:[{...invited,id:'other',email:'other@example.test'}],nextCursor:null});fireEvent.click(screen.getByRole('button',{name:'Load more accounts'}));expect(await screen.findByText('other@example.test')).toBeVisible();expect(mock.request).toHaveBeenLastCalledWith({action:'list',limit:25,cursor:'2'});
});
