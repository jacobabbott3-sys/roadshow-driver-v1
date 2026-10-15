import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {Outlet} from 'react-router-dom';
import {beforeEach,expect,test,vi} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),role:'admin',active:true,loading:false,userId:'owner',profileId:'owner',eventType:'show'}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>({user:m.userId?{id:m.userId}:null,profile:{id:m.profileId,is_active:m.active,role:m.role},loading:m.loading})}));
vi.mock('../components/AppShell',()=>({AppShell:()=> <Outlet/>}));
vi.mock('./HomePage',()=>({HomePage:()=> <p>Home route</p>}));
vi.mock('../lib/supabase',()=>({supabase:{rpc:m.rpc}}));
vi.mock('../lib/driverData',()=>({
 getContract:async(id:string)=>({id,kind:'setup',status:'in_progress',signed_at:'2026-10-01',current_agreement_id:'exact-version',show:{id:'show',name:'Fixture work',city:'Denver',starts_on:'2026-11-01',ends_on:'2026-11-02',event_type:m.eventType}}),
 getChecklist:async()=>({id:'checklist',sections:[]}),getContractPhotos:async()=>[],getLinkedSigningContracts:async()=>[],setChecklistItem:vi.fn(),submitChecklist:vi.fn(),dateRange:()=>'',statusLabel:(s:string)=>s,
}));
import App from '../App';
const review=()=>({version:{id:'exact-version',version_number:3,content:{contract:{kind:'setup',service_date:'2026-11-01',terms:'Issued terms'},work:{name:'Fixture work'},linked_show_ids:[],checklist:[]}},signatures:[],legacy_missing:false,legacy_evidence:null});
const agreementCalls=()=>m.rpc.mock.calls.filter(([name])=>name==='get_contract_agreement'||name==='accept_contract_agreement');
beforeEach(()=>{
 sessionStorage.clear();m.role='admin';m.active=true;m.loading=false;m.userId='owner';m.profileId='owner';m.eventType='show';
 m.rpc.mockReset().mockImplementation(async(name:string)=>{
  if(name==='get_contract_agreement')return {data:review(),error:null};
  if(name==='contract_acceptance_gate')return {data:true,error:null};
  if(name==='accept_contract_agreement')return {data:'receipt',error:null};
  throw new Error(`Unexpected API: ${name}`);
 });
 window.history.replaceState({},'', '/admin/contracts/a/agreement');
});
function consent(){fireEvent.change(screen.getByLabelText('Full legal name'),{target:{value:'Admin Name'}});fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Accept this version and sign'}));}
for(const type of ['show','signing'])test(`${type} explicit admin route reviews before accepting the displayed version`,async()=>{
 m.eventType=type;render(<App/>);
 await screen.findByText('Signing as admin.');
 expect(screen.getByText('Issued terms')).toBeVisible();
 expect(agreementCalls().map(([name])=>name)).toEqual(['get_contract_agreement']);
 consent();
 await waitFor(()=>expect(m.rpc).toHaveBeenCalledWith('accept_contract_agreement',{target_contract:'a',expected_version:'exact-version',acceptance_role:'admin',legal_name:'Admin Name'}));
 await waitFor(()=>expect(m.rpc.mock.calls.filter(([name])=>name==='contract_acceptance_gate').length).toBeGreaterThan(1));
});
for(const condition of ['driver','inactive','loading','mismatched-profile'])test(`admin route blocks review while ${condition}`,async()=>{
 if(condition==='driver')m.role='driver';if(condition==='inactive')m.active=false;if(condition==='loading')m.loading=true;if(condition==='mismatched-profile')m.profileId='previous-owner';
 render(<App/>);
 if(condition==='inactive')await screen.findByText('Your account is inactive');
 else if(condition==='loading')expect(screen.getByRole('status')).toBeVisible();
 else await screen.findByText('Home route');
 expect(agreementCalls()).toEqual([]);
});
test('legacy admin review URL redirects to the guarded explicit route',async()=>{
 window.history.replaceState({},'', '/contracts/a?review=admin');render(<App/>);
 await screen.findByText('Signing as admin.');
 expect(window.location.pathname).toBe('/admin/contracts/a/agreement');
});
test('legacy admin URL cannot turn a driver into an admin reviewer',async()=>{
 m.role='driver';window.history.replaceState({},'', '/contracts/a?review=admin');render(<App/>);
 await screen.findByText('Home route');expect(agreementCalls()).toEqual([]);
});
test('normal driver route retains beta acceptance gate and history link',async()=>{
 m.role='driver';window.history.replaceState({},'', '/contracts/a');render(<App/>);
 fireEvent.click(await screen.findByRole('button',{name:'Contract'}));
 await screen.findByText('Signing as driver.');
 expect(screen.getByRole('link',{name:'My agreement history'})).toHaveAttribute('href','/agreements');
 expect(m.rpc).toHaveBeenCalledWith('contract_acceptance_gate',{target_contract:'a'});
});
for(const result of ['resolve','reject'])test(`late ${result} after admin revocation cannot issue another review`,async()=>{
 let finish!:()=>void;const initial=m.rpc.getMockImplementation()!;
 m.rpc.mockImplementation((name:string,...args:unknown[])=>name==='accept_contract_agreement'?new Promise((resolve,reject)=>{finish=()=>result==='resolve'?resolve({data:'receipt',error:null}):reject(new Error('Late rejection'));}):initial(name,...args));
 const view=render(<App/>);await screen.findByText('Signing as admin.');consent();
 m.role='driver';view.rerender(<App/>);await screen.findByText('Home route');
 await act(async()=>finish());expect(agreementCalls()).toHaveLength(2);
});
