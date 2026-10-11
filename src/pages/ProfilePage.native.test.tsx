import { fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { beforeEach,expect,it,vi } from 'vitest';
const m=vi.hoisted(()=>({native:true,update:vi.fn(),show:vi.fn().mockResolvedValue(undefined)}));
vi.mock('../lib/nativePlatform',()=>({isNativeApp:()=>m.native}));
vi.mock('../native/shellPlugin',()=>({shellPlugin:{showAppearance:m.show}}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>({user:{id:'u'},profile:{full_name:'Fixture',role:'driver'},updateAppearance:m.update})}));
vi.mock('../hooks/useAsync',()=>({useAsync:()=>({data:null,loading:false})}));
vi.mock('../lib/supabase',()=>({supabase:{}}));
vi.mock('../lib/pushNotifications',()=>({deviceNotificationsSupported:()=>false}));
vi.mock('../native/offline/DownloadSettings',()=>({DownloadSettings:()=> <section><h2>Downloads</h2></section>}));
vi.mock('../native/offline/FreshnessNotice',()=>({FreshnessNotice:()=> <button>Refresh</button>}));
import { ProfilePage } from './ProfilePage';
function Page({start='/profile'}:{start?:string}){return <MemoryRouter initialEntries={[start]}><Routes><Route path='/profile/*' element={<ProfilePage/>}/></Routes></MemoryRouter>;}
beforeEach(()=>{vi.clearAllMocks();m.native=true;});
it('opens device Appearance without an account write or web selectors',async()=>{render(<Page start="/profile/appearance"/>);fireEvent.click(screen.getByRole('button',{name:'iPhone appearance'}));await waitFor(()=>expect(m.show).toHaveBeenCalledOnce());expect(m.update).not.toHaveBeenCalled();expect(screen.queryByLabelText('Display mode')).toBeNull();});
it('keeps web account appearance controls',()=>{m.native=false;render(<Page/>);expect(screen.getByLabelText('Display mode')).toBeTruthy();expect(screen.queryByRole('button',{name:'iPhone appearance'})).toBeNull();});

it('shows a settings menu instead of stacked controls',()=>{
 render(<Page/>);
 expect(screen.getByRole('heading',{level:1,name:'Settings'})).toBeTruthy();
 expect(screen.getAllByRole('link')).toHaveLength(5);
 expect(screen.queryByLabelText('Full name')).toBeNull();
 expect(screen.queryByRole('button',{name:'iPhone appearance'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Refresh'})).toBeNull();
});
