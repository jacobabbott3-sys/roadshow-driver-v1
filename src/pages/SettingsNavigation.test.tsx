import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Routes,Route,useLocation} from 'react-router-dom';
import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({
 auth:{user:{id:'a',email:'a@example.test'},profile:{id:'a',full_name:'Account A',phone:'111',role:'driver',is_active:true},loading:false,nativeProfileVerified:true,refreshProfile:vi.fn(),updateAppearance:vi.fn(),signOut:vi.fn()},
 preferences:vi.fn(),listeners:{} as Record<string,(value:unknown)=>void>,setState:vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>m.auth}));
vi.mock('../lib/nativePlatform',()=>({isNativeApp:()=>true}));
vi.mock('../hooks/useUnreadBadges',()=>({useUnreadBadges:()=>({chats:0,notifications:0})}));
vi.mock('../lib/supabase',()=>({supabase:{}}));
vi.mock('../lib/pushNotifications',()=>({deviceNotificationsSupported:()=>false,getNotificationPreferences:(...args:unknown[])=>m.preferences(...args)}));
vi.mock('../native/shellPlugin',()=>({shellPlugin:{
 connect:async({connection}:{connection:string})=>({version:1,connection,appearance:{mode:'system',haptics:true}}),
 setState:m.setState,disconnect:async()=>{},showAppearance:async()=>{},
 addListener:async(name:string,callback:(v:unknown)=>void)=>{m.listeners[name]=callback;return {remove:async()=>{}};}
}}));
import {ProfilePage} from './ProfilePage';
import {NativeShellBridge} from '../native/NativeShellBridge';
function Location(){return <output data-testid="path">{useLocation().pathname}</output>}
function App({nativeBack=false,start='/profile'}:{nativeBack?:boolean;start?:string}){
 const content=<><Location/><Routes><Route path="/profile/*" element={<ProfilePage/>}/></Routes></>;
 return <MemoryRouter initialEntries={[start]}>{nativeBack?<NativeShellBridge>{content}</NativeShellBridge>:content}</MemoryRouter>;
}
const last=()=>m.setState.mock.calls.at(-1)?.[0].state;
const sections=['Profile','Appearance','Downloads','Notifications','Status'];
beforeEach(()=>{vi.clearAllMocks();m.preferences.mockResolvedValue(null);m.auth.user={id:'a',email:'a@example.test'};m.auth.profile={id:'a',full_name:'Account A',phone:'111',role:'driver',is_active:true};m.listeners={};});
it('opens each separate screen and returns to the menu repeatedly with fallback back navigation',async()=>{
 render(<App/>);
 for(let pass=0;pass<2;pass++)for(const title of sections){
  expect(screen.getByRole('heading',{level:1,name:'Settings'})).toBeTruthy();
  expect(screen.queryByLabelText('Full name')).toBeNull();
  expect(screen.queryByRole('button',{name:'Refresh'})).toBeNull();
  fireEvent.click(screen.getByRole('link',{name:new RegExp(`^${title}`)}));
  expect(await screen.findByRole('heading',{level:1,name:title})).toBeTruthy();
  expect(screen.queryByRole('navigation',{name:'Settings'})).toBeNull();
  fireEvent.click(screen.getByRole('link',{name:'Back to settings'}));
 }
 expect(screen.getByTestId('path')).toHaveTextContent('/profile');
});
it('native Back exits every submenu repeatedly without duplicate web Back controls',async()=>{
 render(<App nativeBack/>);await waitFor(()=>expect(last()?.visible).toBe(true));
 for(let pass=0;pass<2;pass++)for(const title of sections){
  fireEvent.click(screen.getByRole('link',{name:new RegExp(`^${title}`)}));
  await screen.findByRole('heading',{level:1,name:title});
  await waitFor(()=>expect(last()?.selected).toBe('profile'));
  expect(screen.queryByRole('link',{name:'Back to settings'})).toBeNull();
  act(()=>m.listeners.action({connection:last().connection,action:'back'}));
  await screen.findByRole('heading',{level:1,name:'Settings'});
 }
});
it('clears profile drafts on account replacement and when returning to a submenu',async()=>{
 const view=render(<App/>);fireEvent.click(screen.getByRole('link',{name:/^Profile/}));
 fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'Account A draft'}});
 m.auth.user={id:'b',email:'b@example.test'};m.auth.profile={id:'b',full_name:'Account B',phone:'222',role:'driver',is_active:true};
 view.rerender(<App/>);
 expect(screen.getByLabelText('Full name')).toHaveValue('Account B');expect(screen.queryByDisplayValue('Account A draft')).toBeNull();
 fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'Discard this'}});
 fireEvent.click(screen.getByRole('link',{name:'Back to settings'}));fireEvent.click(screen.getByRole('link',{name:/^Profile/}));
 expect(screen.getByLabelText('Full name')).toHaveValue('Account B');
});
it('cold submenu native Back returns to Settings',async()=>{
 render(<App nativeBack start="/profile/downloads"/>);await screen.findByRole('heading',{level:1,name:'Downloads'});await waitFor(()=>expect(last()?.visible).toBe(true));
 act(()=>m.listeners.action({connection:last().connection,action:'back'}));await screen.findByRole('heading',{level:1,name:'Settings'});
});

it('ignores a late notification response from the previous account after switching',async()=>{
 let finish!:(value:unknown)=>void;m.preferences.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValue({availability_release_alerts:false,assignment_alerts:false,work_day_alerts:false,message_alerts:false});
 const view=render(<App start="/profile/notifications"/>);await waitFor(()=>expect(m.preferences).toHaveBeenCalledWith('a'));
 m.auth.user={id:'b',email:'b@example.test'};m.auth.profile={id:'b',full_name:'Account B',phone:'222',role:'driver',is_active:true};view.rerender(<App start="/profile/notifications"/>);
 await waitFor(()=>expect(screen.getAllByRole('switch').every(input=>!(input as HTMLInputElement).checked)).toBe(true));
 await act(async()=>finish({availability_release_alerts:true,assignment_alerts:true,work_day_alerts:true,message_alerts:true}));
 expect(screen.getAllByRole('switch').every(input=>!(input as HTMLInputElement).checked)).toBe(true);
});
it('keeps every submenu navigable after an account replacement',async()=>{
 const view=render(<App nativeBack/>);await waitFor(()=>expect(last()?.visible).toBe(true));
 for(const [index,title] of sections.entries()){
  fireEvent.click(screen.getByRole('link',{name:new RegExp(`^${title}`)}));await screen.findByRole('heading',{level:1,name:title});
  const id=`account-${index}`;m.auth.user={id,email:`${id}@example.test`};m.auth.profile={id,full_name:`Fixture ${index}`,phone:'222',role:'driver',is_active:true};view.rerender(<App nativeBack/>);
  expect(screen.getByRole('heading',{level:1,name:title})).toBeTruthy();
  if(title==='Profile')expect(screen.getByLabelText('Full name')).toHaveValue(`Fixture ${index}`);
  act(()=>m.listeners.action({connection:last().connection,action:'back'}));await screen.findByRole('heading',{level:1,name:'Settings'});
 }
});
