import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { AgreementHistoryPage } from './AgreementHistoryPage';
vi.mock('../lib/agreementData',()=>({getMyAgreementHistory:async()=>[{version:{id:'historical',version_number:2,content:{contract:{kind:'setup',service_date:'2026-11-01',contract_pay:0,bonus_pay:null,terms:'Accepted historical terms',document_path:null},work:{name:'Former assignment'},linked_show_ids:[],checklist:[]}},signatures:[{id:'signature',signer_role:'driver',signer_name:'Recorded Driver',signed_at:'2026-10-01T12:00:00Z'}]}]}));
test('historical receipt renders accepted text and evidence without a current-contract link',async()=>{
  render(<MemoryRouter><AgreementHistoryPage/></MemoryRouter>);
  await screen.findByText('Accepted historical terms');
  expect(screen.getByText(/Recorded Driver/)).toBeInTheDocument();
  expect(screen.getAllByRole('link').map(link=>link.getAttribute('href'))).toEqual(['/contracts']);
});
