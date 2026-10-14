import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {beforeEach,expect,test,vi} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),eventType:'show',role:'driver',active:true}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>({user:{id:'owner'},profile:{is_active:m.active,role:m.role},nativeProfileVerified:true,loading:false})}));
vi.mock('../native/offline/context',()=>({useOffline:()=>({coordinator:null,state:null})}));
vi.mock('../native/offline/DownloadControl',()=>({DownloadControl:()=> <p>Contract document control</p>}));
vi.mock('../native/FollowChecklist',()=>({FollowChecklist:()=>null}));
vi.mock('../lib/supabase',()=>({supabase:{rpc:m.rpc}}));
vi.mock('../lib/driverData',()=>({
 getContract:async(id:string)=>({id,kind:'setup',status:'in_progress',signed_at:null,document_path:'fixture.pdf',show:{id:'show',name:'Fixture work',city:'Denver',starts_on:'2026-11-01',ends_on:'2026-11-02',event_type:m.eventType}}),
 getChecklist:async()=>({id:'checklist',sections:[]}),getContractPhotos:async()=>[],getLinkedSigningContracts:async()=>[],setChecklistItem:vi.fn(),submitChecklist:vi.fn(),dateRange:()=>'',statusLabel:(s:string)=>s,
}));
import {ContractDetailPage} from './ContractDetailPage';
import {AdminRoute} from '../components/ProtectedRoute';
beforeEach(()=>{
 m.eventType='show';m.role='driver';m.active=true;m.rpc.mockReset();
 m.rpc.mockImplementation(async(name:string)=>{
  if(name==='get_contract_agreement') return {data:{version:{id:'exact-version',version_number:3,content:{contract:{kind:'setup',service_date:'2026-11-01',terms:'Issued terms'},work:{name:'Fixture work'},linked_show_ids:[],checklist:[]}},signatures:[],legacy_missing:false,legacy_evidence:null},error:null};
  if(name==='accept_contract_agreement') return {data:'receipt',error:null};
  throw new Error(`Unexpected API: ${name}`);
 });
});
for(const eventType of ['show','signing']) test(`${eventType} contract review uses only version APIs and preserves document access`,async()=>{
 m.eventType=eventType;
 render(<MemoryRouter initialEntries={['/contracts/a']}><Routes><Route path='/contracts/:id' element={<ContractDetailPage/>}/></Routes></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'Contract'}));
 await screen.findByText('Agreement version 3');
 expect(screen.getByText('Contract document control')).toBeVisible();
 expect(m.rpc).toHaveBeenCalledTimes(1);
 fireEvent.change(screen.getByLabelText('Full legal name'),{target:{value:'Driver Name'}});
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'Accept this version and sign'}));
 await waitFor(()=>expect(m.rpc).toHaveBeenCalledWith('accept_contract_agreement',{target_contract:'a',expected_version:'exact-version',acceptance_role:'driver',legal_name:'Driver Name'}));
 expect(m.rpc.mock.calls.every(([name])=>['get_contract_agreement','accept_contract_agreement'].includes(name))).toBe(true);
});


test('active admin review explicitly accepts the displayed version as admin',async()=>{
 m.role='admin';
 render(<MemoryRouter initialEntries={['/admin/contracts/a/agreement']}><Routes><Route path='/admin/contracts/:id/agreement' element={<ContractDetailPage adminReview/>}/></Routes></MemoryRouter>);
 await screen.findByText('Signing as admin.');
 expect(screen.getByText('Issued terms')).toBeVisible();
 expect(m.rpc).toHaveBeenCalledTimes(1);
 fireEvent.change(screen.getByLabelText('Full legal name'),{target:{value:'Admin Name'}});
 expect(screen.getByRole('button',{name:'Accept this version and sign'})).toBeDisabled();
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'Accept this version and sign'}));
 await waitFor(()=>expect(m.rpc).toHaveBeenCalledWith('accept_contract_agreement',{target_contract:'a',expected_version:'exact-version',acceptance_role:'admin',legal_name:'Admin Name'}));
});

for (const [role,active] of [['driver',true],['admin',false]] as const) test(`admin review cannot issue or accept for ${role} active=${active}`,async()=>{
 m.role=role;m.active=active;
 render(<MemoryRouter initialEntries={['/admin/contracts/a/agreement']}><Routes><Route path='/admin/contracts/:id/agreement' element={<ContractDetailPage adminReview/>}/></Routes></MemoryRouter>);
 await screen.findByText('Fixture work');
 fireEvent.click(screen.getByRole('button',{name:'Contract'}));
 await screen.findByText('Connect and refresh to review the current agreement.');
 expect(m.rpc).not.toHaveBeenCalled();
});

test('admin stale rejection displays the replacement version and requires renewed review',async()=>{
 m.role='admin';
 const issued=(id:string,number:number,terms:string)=>({data:{version:{id,version_number:number,content:{contract:{kind:'setup',service_date:'2026-11-01',terms},work:{name:'Work'},linked_show_ids:[],checklist:[]}},signatures:[],legacy_missing:false,legacy_evidence:null},error:null});
 m.rpc.mockReset().mockResolvedValueOnce(issued('old',1,'Original issued terms'))
  .mockResolvedValueOnce({data:null,error:{message:'Stale agreement: review the current version'}})
  .mockResolvedValue(issued('new',2,'Replacement issued terms'));
 render(<MemoryRouter initialEntries={['/admin/contracts/a/agreement']}><Routes><Route path='/admin/contracts/:id/agreement' element={<ContractDetailPage adminReview/>}/></Routes></MemoryRouter>);
 await screen.findByText('Original issued terms');
 fireEvent.change(screen.getByLabelText('Full legal name'),{target:{value:'Admin Name'}});
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Accept this version and sign'}));
 await screen.findByText('Replacement issued terms');
 expect(screen.getByText('Stale agreement: review the current version')).toBeVisible();
 expect(screen.getByText('Agreement version 2')).toBeVisible();
 expect(screen.getByLabelText('Full legal name')).toHaveValue('');
 expect(screen.getByRole('checkbox')).not.toBeChecked();
 expect(screen.getByRole('button',{name:'Accept this version and sign'})).toBeDisabled();
 expect(m.rpc.mock.calls.filter(([name])=>name==='accept_contract_agreement')).toEqual([['accept_contract_agreement',{target_contract:'a',expected_version:'old',acceptance_role:'admin',legal_name:'Admin Name'}]]);
});

test('admin review failure exposes the API error without accepting or falling back',async()=>{
 m.role='admin';m.rpc.mockResolvedValue({data:null,error:{message:'Admin access required'}});
 render(<MemoryRouter initialEntries={['/admin/contracts/a/agreement']}><Routes><Route path='/admin/contracts/:id/agreement' element={<ContractDetailPage adminReview/>}/></Routes></MemoryRouter>);
 await screen.findByText('Admin access required');
 expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
 expect(m.rpc).toHaveBeenCalledExactlyOnceWith('get_contract_agreement',{target_contract:'a'});
});


for (const role of ['driver','admin']) test(`existing admin route guard ${role==='admin'?'allows':'denies'} ${role} review`,async()=>{
 m.role=role;
 render(<MemoryRouter initialEntries={['/admin/contracts/a/agreement']}><Routes><Route path='/' element={<p>Home route</p>}/><Route element={<AdminRoute/>}><Route path='/admin/contracts/:id/agreement' element={<ContractDetailPage adminReview/>}/></Route></Routes></MemoryRouter>);
 if(role==='driver') {await screen.findByText('Home route');expect(m.rpc).not.toHaveBeenCalled();}
 else {await screen.findByText('Signing as admin.');expect(m.rpc).toHaveBeenCalledExactlyOnceWith('get_contract_agreement',{target_contract:'a'});}
});

for (const outcome of ['resolve','reject']) test(`late admin ${outcome} after role revocation cannot issue another review`,async()=>{
 m.role='admin';
 let finish!:()=>void;
 const initial=m.rpc.getMockImplementation()!;
 m.rpc.mockImplementation((name:string,...args:unknown[])=>name==='accept_contract_agreement'?new Promise((resolve,reject)=>{finish=()=>outcome==='resolve'?resolve({data:'receipt',error:null}):reject(new Error('Late rejection'));}):initial(name,...args));
 const view=render(<MemoryRouter><ContractDetailPage contractId='a' adminReview/></MemoryRouter>);
 await screen.findByText('Signing as admin.');
 fireEvent.change(screen.getByLabelText('Full legal name'),{target:{value:'Admin Name'}});
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Accept this version and sign'}));
 m.role='driver';view.rerender(<MemoryRouter><ContractDetailPage contractId='a' adminReview/></MemoryRouter>);
 await screen.findByText('Connect and refresh to review the current agreement.');
 await act(async()=>finish());
 expect(m.rpc).toHaveBeenCalledTimes(2);
});
