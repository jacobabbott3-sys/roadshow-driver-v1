import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { AgreementCopy } from './AgreementCopy';

test('renders full accepted text, null versus zero and pinned requirements', () => {
  render(<AgreementCopy content={{contract:{kind:'setup',service_date:'2026-11-01',service_time:null,contract_pay:0,bonus_pay:null,terms:'First exact line\nSecond exact line',document_path:null},work:{name:'Accepted Show',per_diem:0,lodging_included:true},linked_show_ids:[],checklist:[{id:'section',title:'Load',position:0,items:[{id:'item',title:'Check supplies',instructions:'Keep this instruction',required:true,photo_required:true,position:0}]}]}} />);
  expect(screen.getByText(/First exact line/)).toHaveTextContent('Second exact line');
  expect(screen.getByText('Potential bonus: Not specified')).toBeInTheDocument();
  expect(screen.getByText('Base pay: $0.00')).toBeInTheDocument();
  expect(screen.getByText('Keep this instruction')).toBeInTheDocument();
  expect(screen.getByText(/Required · Photo required/)).toBeInTheDocument();
});
