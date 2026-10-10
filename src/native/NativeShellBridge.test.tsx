import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({native:true,auth:{user:{id:'u'},profile:{id:'u',role:'admin',is_active:true},loading:false,nativeProfileVerified:true},listeners:{} as Record<string,(v:unknown)=>void>,connect:vi.fn(),setState:vi.fn().mockResolvedValue(undefined),disconnect:vi.fn().mockResolvedValue(undefined)}));
vi.mock('../lib/nativePlatform',()=>({isNativeApp:()=>m.native}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>m.auth}));
vi.mock('../hooks/useUnreadBadges',()=>({useUnreadBadges:()=>({chats:4,notifications:2})}));
vi.mock('./shellPlugin',()=>({shellPlugin:{...m,addListener:vi.fn(async(name:string,fn:(v:unknown)=>void)=>{m.listeners[name]=fn;return {remove:vi.fn()};})}}));
import { NativeShellBridge } from './NativeShellBridge';
import { useNativeModal,useShellPresentation } from './useShellPresentation';
function Probe({modal=false}:{modal?:boolean}) {const loc=useLocation();const shell=useShellPresentation();useNativeModal(modal);return <><output>{loc.pathname}</output><span>{shell.ready?'ready':'fallback'}</span><input aria-label="draft" defaultValue="retained" /></>;}
function App({modal=false}:{modal?:boolean}) {return <MemoryRouter initialEntries={['/contracts/c1']}><NativeShellBridge><Probe modal={modal}/></NativeShellBridge></MemoryRouter>;}
beforeEach(()=>{vi.clearAllMocks();m.native=true;m.auth={user:{id:'u'},profile:{id:'u',role:'admin',is_active:true},loading:false,nativeProfileVerified:true};m.listeners={};m.connect.mockImplementation(async({connection})=>({version:1,connection,appearance:{mode:'system',haptics:true}}));});
const last=()=>m.setState.mock.lastCall?.[0].state;
it('keeps web fallback until handshake, routes allowlisted actions without replacing inputs',async()=>{
 let resolve!:(v:unknown)=>void;m.connect.mockImplementation(({connection})=>new Promise(r=>{resolve=()=>r({version:1,connection,appearance:{mode:'system',haptics:true}});}));
 render(<App/>);expect(screen.getByText('fallback')).toBeTruthy();await waitFor(()=>expect(m.connect).toHaveBeenCalled());const input=screen.getByLabelText('draft');fireEvent.change(input,{target:{value:'draft'}});
 await act(async()=>resolve(null));await waitFor(()=>expect(last()?.selected).toBe('contracts'));expect(screen.getByText('ready')).toBeTruthy();
 act(()=>m.listeners.action({connection:last().connection,action:'admin'}));await waitFor(()=>expect(screen.getByText('/admin')).toBeTruthy());expect(screen.getByLabelText('draft')).toBe(input);expect(input).toHaveValue('draft');
 act(()=>m.listeners.action({connection:last().connection,action:'https://bad.example'}));expect(screen.getByText('/admin')).toBeTruthy();
 act(()=>m.listeners.action({connection:'stale',action:'home'}));expect(screen.getByText('/admin')).toBeTruthy();
});
it('sends hidden cleared state for unverified/inactive auth and hides chrome for modals',async()=>{
 const view=render(<App/>);await waitFor(()=>expect(last()?.visible).toBe(true));view.rerender(<App modal/>);await waitFor(()=>expect(last()?.modalOpen).toBe(true));
 m.auth.nativeProfileVerified=false;view.rerender(<App/>);await waitFor(()=>expect(last()?.visible).toBe(false));expect(last().unreadChats).toBe(0);expect(last().tabs).not.toContain('admin');
 m.auth.nativeProfileVerified=true;m.auth.profile.is_active=false;view.rerender(<App/>);await waitFor(()=>expect(last()?.visible).toBe(false));
});
it('restores fallback on native suspend and waits for fresh profile before reconnecting',async()=>{
 render(<App/>);await waitFor(()=>expect(screen.getByText('ready')).toBeTruthy());
 act(()=>{m.listeners.readiness({ready:false});document.dispatchEvent(new Event('resume'));});expect(screen.getByText('fallback')).toBeTruthy();expect(m.connect).toHaveBeenCalledTimes(1);
 act(()=>document.dispatchEvent(new Event('roadshow:native-active')));act(()=>document.dispatchEvent(new Event('roadshow:profile-refreshed')));await waitFor(()=>expect(m.connect).toHaveBeenCalledTimes(2));
});
it('leaves web untouched and falls back on rejected handshake',async()=>{
 m.native=false;const v=render(<App/>);expect(m.connect).not.toHaveBeenCalled();v.unmount();m.native=true;m.connect.mockRejectedValue(new Error('missing plugin'));render(<App/>);await waitFor(()=>expect(m.connect).toHaveBeenCalledOnce());expect(screen.getByText('fallback')).toBeTruthy();
});
it('cold detail back uses the parent and driver cannot invoke admin',async()=>{
 m.auth.profile.role='driver';render(<App/>);await waitFor(()=>expect(last()?.visible).toBe(true));act(()=>m.listeners.action({connection:last().connection,action:'admin'}));expect(screen.getByText('/contracts/c1')).toBeTruthy();act(()=>m.listeners.action({connection:last().connection,action:'back'}));await waitFor(()=>expect(screen.getByText('/contracts')).toBeTruthy());
});
it('keeps chrome hidden until the last nested modal closes',async()=>{
 function Modal(){useNativeModal(true);return null;}
 function Nested({count}:{count:number}){return <MemoryRouter><NativeShellBridge><Probe/>{count>0&&<Modal/>}{count>1&&<Modal/>}</NativeShellBridge></MemoryRouter>;}
 const view=render(<Nested count={2}/>);await waitFor(()=>expect(last()?.modalOpen).toBe(true));view.rerender(<Nested count={1}/>);await waitFor(()=>expect(last()?.modalOpen).toBe(true));view.rerender(<Nested count={0}/>);await waitFor(()=>expect(last()?.modalOpen).toBe(false));
});
it('times out a stalled handshake and ignores its late response',async()=>{
 vi.useFakeTimers();let resolve!:(v:unknown)=>void;let connection='';m.connect.mockImplementation((v)=>{connection=v.connection;return new Promise(r=>{resolve=r;});});
 const view=render(<App/>);await act(async()=>{});await act(async()=>vi.advanceTimersByTimeAsync(3100));expect(screen.getByText('fallback')).toBeTruthy();await act(async()=>resolve({version:1,connection,appearance:{mode:'system',haptics:true}}));expect(screen.getByText('fallback')).toBeTruthy();view.unmount();vi.useRealTimers();
});
it('recovers from inactive to active without a foreground/resume event',async()=>{
 render(<App/>);await waitFor(()=>expect(screen.getByText('ready')).toBeTruthy());
 act(()=>{m.listeners.readiness({ready:false});document.dispatchEvent(new Event('roadshow:native-active'));});expect(screen.getByText('fallback')).toBeTruthy();
 act(()=>document.dispatchEvent(new Event('roadshow:profile-refreshed')));await waitFor(()=>expect(m.connect).toHaveBeenCalledTimes(2));
});
it('native Back traverses history retaining query/state through POP and REPLACE',async()=>{
 function Routes(){const loc=useLocation();const nav=useNavigate();return <><Probe/><p data-testid="query">{loc.search}</p><p data-testid="state">{loc.state?.draft}</p><button onClick={()=>nav('/notifications')}>forward</button><button onClick={()=>nav(-1)}>pop</button><button onClick={()=>nav('/resources?filter=a',{replace:true,state:{draft:'saved'}})}>replace</button></>;}
 render(<MemoryRouter initialEntries={[{pathname:'/chat',search:'?thread=fixture',state:{draft:'keep'}}]}><NativeShellBridge><Routes/></NativeShellBridge></MemoryRouter>);await waitFor(()=>expect(last()?.visible).toBe(true));fireEvent.click(screen.getByText('forward'));
 act(()=>m.listeners.action({connection:last().connection,action:'back'}));await waitFor(()=>expect(screen.getByTestId('query')).toHaveTextContent('?thread=fixture'));expect(screen.getByTestId('state')).toHaveTextContent('keep');
 fireEvent.click(screen.getByText('replace'));fireEvent.click(screen.getByText('forward'));fireEvent.click(screen.getByText('pop'));await waitFor(()=>expect(screen.getByText('/resources')).toBeTruthy());act(()=>m.listeners.action({connection:last().connection,action:'back'}));await waitFor(()=>expect(screen.getByText('/')).toBeTruthy());
});
it('ignores verification finishing while the scene is still inactive',async()=>{render(<App/>);await waitFor(()=>expect(screen.getByText('ready')).toBeTruthy());act(()=>{m.listeners.readiness({ready:false});document.dispatchEvent(new Event('roadshow:profile-refreshed'));});await act(async()=>{});expect(m.connect).toHaveBeenCalledTimes(1);act(()=>document.dispatchEvent(new Event('roadshow:native-active')));act(()=>document.dispatchEvent(new Event('roadshow:profile-refreshed')));await waitFor(()=>expect(m.connect).toHaveBeenCalledTimes(2));});
