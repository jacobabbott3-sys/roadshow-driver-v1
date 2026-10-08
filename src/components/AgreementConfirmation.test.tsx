import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { AgreementConfirmationHost } from './AgreementConfirmation';
import { requestAgreementConfirmation } from '../lib/agreementConfirmation';

test('explicit review can cancel changes without approving commit', async () => {
  render(<AgreementConfirmationHost />);
  let promise: Promise<boolean>;
  act(()=>{promise=requestAgreementConfirmation({title:'Confirm agreement changes',consequences:[]});});
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
  expect(await promise!).toBe(false);
});

test('acceptance requires acknowledging the exact displayed copy', async () => {
  render(<AgreementConfirmationHost />);
  let promise: Promise<boolean>;
  act(()=>{promise=requestAgreementConfirmation({title:'Review before admin acceptance',consequences:[]});});
  expect(screen.getByRole('button',{name:'Confirm'})).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button',{name:'Confirm'}));
  expect(await promise!).toBe(true);
});
