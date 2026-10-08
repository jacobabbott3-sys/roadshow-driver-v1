import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { AgreementSigning } from './AgreementSigning';
import { getContractAgreement, acceptContractAgreement } from '../lib/agreementData';

vi.mock('../lib/agreementData',()=>({getContractAgreement:vi.fn(),acceptContractAgreement:vi.fn()}));
const content={contract:{kind:'setup',service_date:'2026-11-01',service_time:null,contract_pay:0,bonus_pay:null,terms:'Exact full text',document_path:null},work:{name:'Reviewed work'},linked_show_ids:[],checklist:[]};
const review=(id:string)=>({version:{id,version_number:1,created_at:'2026-10-07',content},signatures:[],legacy_missing:true,legacy_evidence:{signature_name:'Legacy name',signed_at:'2026-10-01T12:00:00Z',admin_signature_name:null,admin_signed_at:null}});
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
