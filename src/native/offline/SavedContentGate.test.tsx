import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {OfflineCoordinator} from './coordinator';
import {OfflineContext} from './context';
import {ProtectedRoute} from '../../components/ProtectedRoute';
import type {OfflineSnapshot} from './model';
import type {OfflinePlugin} from './plugin';
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:{id:'11111111-1111-4111-8111-111111111111'},profile:null,loading:true,nativeProfileVerified:false,sessionResolved:true,refreshProfile:async()=>{}})}));
vi.mock('../../lib/nativeRuntime',()=>({nativeConfigurationError:null}));
vi.mock('../../lib/nativePlatform',()=>({isNativeApp:()=>true}));
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const snapshot={version:1,owner,verifiedAt:Date.now(),lastSeenAt:Date.now(),contracts:{[id]:{contract:{id,kind:'setup',service_date:'2026-10-20',status:'assigned',show:{id:'33333333-3333-4333-8333-333333333333',name:'Fixture show',city:'Denver',is_test:false,event_type:'show',starts_on:'2026-10-20',ends_on:'2026-10-21'}},checklist:{id:null,sections:[]},fetchedAt:Date.now()}},links:[],resources:{}} as unknown as OfflineSnapshot;
async function setup(path:string){
 let resolve!:(s:OfflineSnapshot)=>void;const network=new Promise<OfflineSnapshot>(yes=>{resolve=yes});
 const plugin={configure:async()=>{},read:async()=>({snapshot}),replace:async()=>{},clear:async()=>{},usage:async()=>({bytes:1,limit:262144000}),manifest:async()=>({files:[]})} as unknown as OfflinePlugin;
 const coordinator=new OfflineCoordinator(plugin,()=>network);await coordinator.activate(owner);
 render(<OfflineContext.Provider value={coordinator}><MemoryRouter initialEntries={[path]}><Routes><Route element={<ProtectedRoute/>}><Route path="*" element={<p>General protected outlet</p>}/></Route></Routes></MemoryRouter></OfflineContext.Provider>);
 return {coordinator,resolve};
}
it('shows saved contract before account/network completion, retaining selected tab after live update',async()=>{
 const started=performance.now();
 const {coordinator,resolve}=await setup(`/contracts/${id}`);
 expect(await screen.findByText('Fixture show')).toBeVisible();
 const savedAt=performance.now()-started;
 fireEvent.click(screen.getByRole('button',{name:'Checklist'}));
 expect(screen.getByText('0 of 0 tasks complete')).toBeVisible();
 expect(screen.queryByText('General protected outlet')).toBeNull();
 expect(screen.queryByRole('button',{name:/Submit checklist/})).toBeNull();
 await act(async()=>{coordinator.verify(owner,Date.now());const pending=coordinator.refresh('manual');resolve({...snapshot,contracts:{[id]:{...snapshot.contracts[id],contract:{...snapshot.contracts[id].contract,show:{...snapshot.contracts[id].contract.show,name:'Updated fixture'}}}}});await pending;});
 await waitFor(()=>expect(screen.getByText('Updated fixture')).toBeVisible());
 expect(screen.getByText('0 of 0 tasks complete')).toBeVisible();
 const liveAt=performance.now()-started;
 expect(liveAt).toBeGreaterThan(savedAt);
 process.stdout.write(`Fixture render timings: saved=${savedAt.toFixed(1)}ms; live=${liveAt.toFixed(1)}ms (network held until after saved render)\n`);
});
it('never opens an administrator route using saved account data',async()=>{
 await setup('/admin/users');
 expect(screen.queryByText('General protected outlet')).toBeNull();
 expect(screen.queryByText('Fixture show')).toBeNull();
});
