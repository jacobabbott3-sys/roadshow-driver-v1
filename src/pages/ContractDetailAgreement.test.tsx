import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {beforeEach,expect,test,vi} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),eventType:'show'}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>({user:{id:'owner'},profile:{is_active:true,role:'driver'},nativeProfileVerified:true,loading:false})}));
vi.mock('../native/offline/context',()=>({useOffline:()=>({coordinator:null,state:null})}));
vi.mock('../native/offline/DownloadControl',()=>({DownloadControl:()=> <p>Contract document control</p>}));
vi.mock('../native/FollowChecklist',()=>({FollowChecklist:()=>null}));
vi.mock('../lib/supabase',()=>({supabase:{rpc:m.rpc}}));
vi.mock('../lib/driverData',()=>({
 getContract:async(id:string)=>({id,kind:'setup',status:'in_progress',signed_at:null,document_path:'fixture.pdf',show:{id:'show',name:'Fixture work',city:'Denver',starts_on:'2026-11-01',ends_on:'2026-11-02',event_type:m.eventType}}),
 getChecklist:async()=>({id:'checklist',sections:[]}),getContractPhotos:async()=>[],getLinkedSigningContracts:async()=>[],setChecklistItem:vi.fn(),submitChecklist:vi.fn(),dateRange:()=>'',statusLabel:(s:string)=>s,
}));
import {ContractDetailPage} from './ContractDetailPage';
beforeEach(()=>{
 m.eventType='show';m.rpc.mockReset();
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
