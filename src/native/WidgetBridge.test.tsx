import {render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({native:true,verified:false,ready:false,loading:true,user:{id:'11111111-1111-4111-8111-111111111111'} as {id:string}|null,configure:vi.fn(),clear:vi.fn(),suspend:vi.fn(),consumeLink:vi.fn(),load:vi.fn()}));
vi.mock('../lib/nativePlatform',()=>({isNativeApp:()=>m.native}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>({user:m.user,profile:m.user?{id:m.user.id,is_active:true}:null,nativeProfileVerified:m.verified,loading:m.loading})}));
vi.mock('./useShellPresentation',()=>({useShellPresentation:()=>({ready:m.ready})}));
vi.mock('./widgetData',()=>({getWidgetAssignments:m.load}));
vi.mock('../lib/driverData',()=>({getChecklist:vi.fn()}));
vi.mock('./widgetPlugin',()=>({widgetPlugin:{configure:m.configure,clear:m.clear,suspend:m.suspend,consumeLink:m.consumeLink,status:vi.fn().mockResolvedValue({following:'',activityAvailable:true,widgetAvailable:true}),snapshot:vi.fn().mockResolvedValue({}),addListener:vi.fn().mockResolvedValue({remove:async()=>{}})}}));
import {WidgetBridge} from './WidgetBridge';
function Location(){return <p data-testid="location">{useLocation().pathname}</p>}
function Tree(){return <MemoryRouter><WidgetBridge><Location/></WidgetBridge></MemoryRouter>}
beforeEach(()=>{vi.clearAllMocks();m.native=true;m.verified=false;m.ready=false;m.loading=true;m.user={id:'11111111-1111-4111-8111-111111111111'};m.configure.mockResolvedValue({following:'',activityAvailable:true,widgetAvailable:true});m.clear.mockResolvedValue({});m.suspend.mockResolvedValue({});m.load.mockResolvedValue([]);m.consumeLink.mockResolvedValue({url:'roadshow-driver://contract/22222222-2222-4222-8222-222222222222?tab=checklist'});});
it('waits for verified account and native readiness before consuming a cold link',async()=>{
 const view=render(<Tree/>);expect(m.configure).not.toHaveBeenCalled();expect(m.consumeLink).not.toHaveBeenCalled();
 m.verified=true;m.ready=true;m.loading=false;view.rerender(<Tree/>);
 await waitFor(()=>expect(screen.getByTestId('location').textContent).toBe('/contracts/22222222-2222-4222-8222-222222222222'));
 m.user=null;m.verified=false;view.rerender(<Tree/>);await waitFor(()=>expect(m.clear).toHaveBeenCalled());
});
it('does not call native widget services in a browser',()=>{m.native=false;m.loading=false;render(<Tree/>);expect(m.configure).not.toHaveBeenCalled();expect(m.clear).not.toHaveBeenCalled();expect(m.load).not.toHaveBeenCalled();});
