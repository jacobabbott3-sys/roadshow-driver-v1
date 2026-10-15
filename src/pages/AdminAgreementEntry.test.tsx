import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,expect,test,vi} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),eventType:'show'}));
vi.mock('../lib/supabase',()=>({supabase:{rpc:m.rpc,from:m.from}}));
vi.mock('../lib/adminData',async(importOriginal)=>({
 ...await importOriginal<typeof import('../lib/adminData')>(),
 getShowsAdmin:async()=>[{id:'show',name:'Fixture show',city:'Denver',event_type:m.eventType,starts_on:'2026-11-01',ends_on:'2026-11-02',signing_at:'2026-11-01T12:00:00Z',show_checklist_templates:[],contracts:[{id:'contract',kind:'setup',status:'available',contract_pay:null,bonus_pay:null,service_date:'2026-11-01',terms:'Existing exact terms',admin_signature_name:'Previously entered name',contract_drivers:[],contract_checklists:[],contract_external_assignees:[]}]}],
 getTemplates:async()=>[],getContractTemplates:async()=>[],getShowLinks:async()=>[],
}));
vi.mock('../lib/availabilityData',()=>({getPublishedAvailability:async()=>[]}));
import {AdminShowsPage} from './AdminShowsPage';
import {AdminSigningsPage} from './AdminSigningsPage';
beforeEach(()=>{localStorage.clear();m.eventType='show';m.rpc.mockReset().mockImplementation(async (name:string)=>({data:name==='preview_agreement_change'?{token:'preview-ticket',consequences:[]}:name==='get_contract_agreement'?{signatures:[]}: 'contract',error:null}));m.from.mockReset().mockImplementation(()=>{throw new Error('Unexpected direct table write');});vi.spyOn(window,'scrollTo').mockImplementation(()=>{});});
for (const eventType of ['show','signing']) test(`${eventType} provides explicit admin review without issuing or accepting on list load`,async()=>{
 m.eventType=eventType;
 render(<MemoryRouter>{eventType==='show'?<AdminShowsPage/>:<AdminSigningsPage/>}</MemoryRouter>);
 expect(await screen.findByRole('link',{name:'Review and sign agreement'})).toHaveAttribute('href','/admin/contracts/contract/agreement');
 expect(m.rpc).not.toHaveBeenCalled();expect(m.from).not.toHaveBeenCalled();
});
test('saving an existing show does not reuse a stored admin name or write signature fields',async()=>{
 render(<MemoryRouter><AdminShowsPage/></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'Edit'}));
 fireEvent.submit(screen.getByRole('button',{name:'Save show and contract'}).closest('form')!);
 await waitFor(()=>expect(m.rpc).toHaveBeenCalledWith('preview_agreement_change',expect.objectContaining({target_payload:expect.objectContaining({terms:'Existing exact terms'})})));
 await screen.findByText('Show and contract saved.');
 expect(m.rpc.mock.calls.map(([name])=>name)).toEqual(['preview_agreement_change','commit_agreement_change']);
 expect(m.rpc).toHaveBeenCalledTimes(2);expect(m.from).not.toHaveBeenCalled();
});
test('editing has no signature input and explains the separate review step',async()=>{
 render(<MemoryRouter><AdminShowsPage/></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'Edit'}));
 expect(screen.queryByPlaceholderText("Admin's full legal name")).not.toBeInTheDocument();
 expect(screen.getByText('Save changes, then use Review and sign agreement to accept the issued version.')).toBeVisible();
});


test('restored old drafts cannot silently sign with their saved signature name',async()=>{
 const first=render(<MemoryRouter><AdminShowsPage/></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'Edit'}));
 const draft=JSON.parse(localStorage.getItem('roadshow-admin-show-draft')!);
 draft.form.admin_signature_name='Legacy draft name';
 first.unmount();localStorage.setItem('roadshow-admin-show-draft',JSON.stringify(draft));
 render(<MemoryRouter><AdminShowsPage/></MemoryRouter>);
 fireEvent.submit(screen.getByRole('button',{name:'Save show and contract'}).closest('form')!);
 await screen.findByText('Show and contract saved.');
 expect(m.rpc.mock.calls.map(([name])=>name)).toEqual(['preview_agreement_change','commit_agreement_change']);
 expect(m.rpc).toHaveBeenCalledTimes(2);expect(m.from).not.toHaveBeenCalled();
 expect(m.rpc.mock.calls[0][1].target_payload).not.toHaveProperty('admin_signature_name');
});
