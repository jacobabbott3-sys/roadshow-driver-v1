import { fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
beforeEach(()=>{vi.clearAllMocks();m.native=true;});
it('opens device Appearance without an account write or web selectors',async()=>{render(<MemoryRouter><ProfilePage/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:'iPhone appearance'}));await waitFor(()=>expect(m.show).toHaveBeenCalledOnce());expect(m.update).not.toHaveBeenCalled();expect(screen.queryByLabelText('Display mode')).toBeNull();});
it('keeps web account appearance controls',()=>{m.native=false;render(<MemoryRouter><ProfilePage/></MemoryRouter>);expect(screen.getByLabelText('Display mode')).toBeTruthy();expect(screen.queryByRole('button',{name:'iPhone appearance'})).toBeNull();});

it('organizes native settings with downloads and refresh/status after account and appearance',()=>{
 render(<MemoryRouter><ProfilePage/></MemoryRouter>);
 expect(screen.getByRole('heading',{level:1,name:'Settings'})).toBeTruthy();
 const headings=screen.getAllByRole('heading',{level:2}).map(h=>h.textContent);
 expect(headings.indexOf('Profile')).toBeLessThan(headings.indexOf('Appearance'));
 expect(headings.indexOf('Appearance')).toBeLessThan(headings.indexOf('Downloads'));
 expect(headings.at(-1)).toBe('Status');
 expect(screen.getByRole('region',{name:'Refresh and status'}).contains(screen.getByRole('button',{name:'Refresh'}))).toBe(true);
});
