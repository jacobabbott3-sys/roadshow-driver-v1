import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import type { AgreementReview } from '../lib/agreementTypes';
import { AgreementSigning } from './AgreementSigning';
import { getContractAgreement, acceptContractAgreement } from '../lib/agreementData';

vi.mock('../lib/agreementData',()=>({getContractAgreement:vi.fn(),acceptContractAgreement:vi.fn()}));
const content={contract:{kind:'setup',service_date:'2026-11-01',service_time:null,contract_pay:0,bonus_pay:null,terms:'Exact full text',document_path:null},work:{name:'Reviewed work'},linked_show_ids:[],checklist:[]};
const review=(id:string):AgreementReview=>({version:{id,version_number:1,created_at:'2026-10-07',content},signatures:[],legacy_missing:true,legacy_evidence:{signature_name:'Legacy name',signed_at:'2026-10-01T12:00:00Z',admin_signature_name:null,admin_signed_at:null}});
beforeEach(()=>{vi.mocked(getContractAgreement).mockReset();vi.mocked(acceptContractAgreement).mockReset();vi.mocked(acceptContractAgreement).mockResolvedValue('signature');});
test('requires fresh acknowledgment after switching contracts',async()=>{
  vi.mocked(getContractAgreement).mockImplementation(async id=>review(id));
  const view=render(<MemoryRouter><AgreementSigning contractId="first" onSigned={async()=>{}}/></MemoryRouter>);
  await screen.findByText('Exact full text');
  fireEvent.change(screen.getByLabelText('Full legal name'),{target:{value:'Driver Name'}});
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByLabelText('Full legal name')).toHaveValue('Driver Name');
  expect(screen.getByRole('checkbox')).toBeChecked();
  await waitFor(()=>expect(screen.getByRole('button',{name:'Accept this version and sign'})).toBeEnabled());
  view.rerender(<MemoryRouter><AgreementSigning contractId="second" onSigned={async()=>{}}/></MemoryRouter>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Accept this version and sign'})).toBeDisabled());
  expect(screen.getByRole('checkbox')).not.toBeChecked();
});
test('stale acceptance requires reviewing the newly returned version',async()=>{
  vi.mocked(getContractAgreement).mockResolvedValueOnce(review('old')).mockResolvedValue(review('new'));
  vi.mocked(acceptContractAgreement).mockRejectedValueOnce(new Error('Stale agreement: review the current version'));
  render(<MemoryRouter><AgreementSigning contractId="contract" onSigned={async()=>{}}/></MemoryRouter>);
  await screen.findByText('Exact full text');
  fireEvent.change(screen.getByLabelText('Full legal name'),{target:{value:'Driver Name'}});fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Accept this version and sign'}));
  await screen.findByText('Stale agreement: review the current version');
  await waitFor(()=>expect(screen.getByRole('checkbox')).not.toBeChecked());
  expect(acceptContractAgreement).toHaveBeenCalledWith('contract','old','driver','Driver Name');
});
test('admin acceptance reviews and signs the displayed version',async()=>{
  vi.mocked(getContractAgreement).mockResolvedValue(review('admin-version'));
  render(<MemoryRouter><AgreementSigning contractId="contract" acceptanceRole="admin" onSigned={async()=>{}}/></MemoryRouter>);
  await screen.findByText('Exact full text');
  fireEvent.change(screen.getByLabelText('Full legal name'),{target:{value:'Admin Name'}});fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Accept this version and sign'}));
  await screen.findByText('Current agreement accepted.');
  expect(acceptContractAgreement).toHaveBeenCalledWith('contract','admin-version','admin','Admin Name');
  expect(screen.getByText(/Legacy name/)).toBeInTheDocument();
});
test('saved native presentation never issues or accepts an agreement',async()=>{
  render(<MemoryRouter><AgreementSigning contractId="saved" enabled={false} onSigned={async()=>{}}/></MemoryRouter>);
  await screen.findByText('Connect and refresh to review the current agreement.');
  expect(getContractAgreement).not.toHaveBeenCalled();
  expect(acceptContractAgreement).not.toHaveBeenCalled();
});

test('display alone and legacy evidence never sign; explicit consent signs the displayed driver version',async()=>{
 vi.mocked(getContractAgreement).mockResolvedValue(review('displayed'));
 const onSigned=vi.fn().mockResolvedValue(undefined);
 render(<MemoryRouter><AgreementSigning contractId="contract" onSigned={onSigned}/></MemoryRouter>);
 await screen.findByText('Agreement version 1');
 expect(screen.getByText('Exact full text')).toBeVisible();
 expect(screen.getByText('Base pay: $0.00')).toBeVisible();
 expect(screen.getByText(/Legacy name/)).toBeInTheDocument();
 expect(acceptContractAgreement).not.toHaveBeenCalled();
 const button=screen.getByRole('button',{name:'Accept this version and sign'});
 expect(button).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Full legal name'),{target:{value:'Driver Name'}});
 expect(button).toBeDisabled();
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(button);
 await waitFor(()=>expect(onSigned).toHaveBeenCalledTimes(1));
 expect(acceptContractAgreement).toHaveBeenCalledExactlyOnceWith('contract','displayed','driver','Driver Name');
});

test('changed agreement displays new text and requires a fresh name and acknowledgment',async()=>{
 const revised={...review('new'),version:{...review('new').version,version_number:2,content:{...content,contract:{...content.contract,terms:'Revised exact terms'}}}};
 vi.mocked(getContractAgreement).mockResolvedValueOnce(review('old')).mockResolvedValue(revised);
 vi.mocked(acceptContractAgreement).mockRejectedValueOnce(new Error('Agreement changed: review is required'));
 const onSigned=vi.fn().mockResolvedValue(undefined);
 render(<AgreementSigning contractId="contract" onSigned={onSigned}/>);
 await screen.findByText('Exact full text');
 fireEvent.change(screen.getByLabelText('Full legal name'),{target:{value:'Driver Name'}});
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'Accept this version and sign'}));
 await screen.findByText('Revised exact terms');
 expect(screen.getByText('Agreement version 2')).toBeVisible();
 expect(screen.queryByText('Exact full text')).not.toBeInTheDocument();
 expect(screen.getByLabelText('Full legal name')).toHaveValue('');
 expect(screen.getByRole('checkbox')).not.toBeChecked();
 expect(screen.getByRole('button',{name:'Accept this version and sign'})).toBeDisabled();
 expect(onSigned).not.toHaveBeenCalled();
 expect(acceptContractAgreement).toHaveBeenCalledTimes(1);
});

test('failed refresh after rejected signing hides stale signing controls',async()=>{
 vi.mocked(getContractAgreement).mockResolvedValueOnce(review('old')).mockRejectedValue(new Error('Connection unavailable'));
 vi.mocked(acceptContractAgreement).mockRejectedValue(new Error('Acceptance unavailable'));
 render(<AgreementSigning contractId="contract" onSigned={async()=>{}}/>);
 await screen.findByText('Exact full text');
 fireEvent.change(screen.getByLabelText('Full legal name'),{target:{value:'Driver Name'}});
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'Accept this version and sign'}));
 await screen.findByText('Connection unavailable');
 expect(screen.queryByRole('button',{name:'Accept this version and sign'})).not.toBeInTheDocument();
 expect(screen.getByText('Acceptance unavailable')).toBeVisible();
 expect(acceptContractAgreement).toHaveBeenCalledTimes(1);
});

test('failed initial review offers no acceptance controls',async()=>{
 vi.mocked(getContractAgreement).mockRejectedValue(new Error('Assigned contract access required'));
 render(<AgreementSigning contractId="contract" onSigned={async()=>{}}/>);
 await screen.findByText('Assigned contract access required');
 expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
 expect(acceptContractAgreement).not.toHaveBeenCalled();
});

for (const outcome of ['resolve','reject'] as const) test(`late ${outcome} after online access is revoked does not refresh or notify`,async()=>{
 vi.mocked(getContractAgreement).mockResolvedValue(review('displayed'));
 let finish!:()=>void;
 vi.mocked(acceptContractAgreement).mockImplementation(()=>new Promise<string>((resolve,reject)=>{
  finish=()=>outcome==='resolve'?resolve('receipt'):reject(new Error('Late rejection'));
 }));
 const onSigned=vi.fn().mockResolvedValue(undefined);
 const view=render(<AgreementSigning contractId="contract" onSigned={onSigned}/>);
 await screen.findByText('Exact full text');
 fireEvent.change(screen.getByLabelText('Full legal name'),{target:{value:'Driver Name'}});
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'Accept this version and sign'}));
 view.rerender(<AgreementSigning enabled={false} contractId="contract" onSigned={onSigned}/>);
 await act(async()=>finish());
 expect(getContractAgreement).toHaveBeenCalledTimes(1);
 expect(onSigned).not.toHaveBeenCalled();
 expect(screen.getByText('Connect and refresh to review the current agreement.')).toBeVisible();
});

test('a superseded initial review cannot replace a newer review or its consent',async()=>{
 let stale!:(value:ReturnType<typeof review>)=>void;
 const newer={...review('new'),version:{...review('new').version,version_number:2,content:{...content,contract:{...content.contract,terms:'Newer issued terms'}}}};
 vi.mocked(getContractAgreement).mockImplementationOnce(()=>new Promise(resolve=>{stale=resolve;})).mockResolvedValue(newer);
 render(<StrictMode><AgreementSigning contractId="contract" onSigned={async()=>{}}/></StrictMode>);
 await screen.findByText('Newer issued terms');
 fireEvent.change(screen.getByLabelText('Full legal name'),{target:{value:'Driver Name'}});
 fireEvent.click(screen.getByRole('checkbox'));
 await act(async()=>stale(review('old')));
 expect(screen.getByText('Newer issued terms')).toBeVisible();
 expect(screen.queryByText('Exact full text')).not.toBeInTheDocument();
 expect(screen.getByRole('checkbox')).toBeChecked();
 fireEvent.click(screen.getByRole('button',{name:'Accept this version and sign'}));
 await waitFor(()=>expect(acceptContractAgreement).toHaveBeenCalledExactlyOnceWith('contract','new','driver','Driver Name'));
});

for (const terms of [null,'']) test(`missing terms (${String(terms)}) preserve the publication prerequisite`,async()=>{
 const fixture=review('missing-terms');fixture.version.content={...content,contract:{...content.contract,terms}};
 vi.mocked(getContractAgreement).mockResolvedValue(fixture);
 render(<AgreementSigning contractId="contract" onSigned={async()=>{}}/>);
 await screen.findByText('Contract terms have not been published yet. Contact your administrator before signing.');
 fireEvent.change(screen.getByLabelText('Full legal name'),{target:{value:'Driver Name'}});
 fireEvent.click(screen.getByRole('checkbox'));
 const button=screen.getByRole('button',{name:'Accept this version and sign'});
 expect(button).toBeDisabled();fireEvent.click(button);
 expect(acceptContractAgreement).not.toHaveBeenCalled();
});
