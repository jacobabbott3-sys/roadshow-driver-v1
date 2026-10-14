import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

const m = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), confirm: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc: m.rpc, from: m.from } }));
vi.mock('../lib/agreementConfirmation', () => ({ requestAgreementConfirmation: m.confirm }));
vi.mock('../lib/adminData', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/adminData')>(),
  getContractTemplates: async () => [], getToolbagTemplates: async () => [],
  getTemplates: async () => [{ id: 'template', name: 'Setup', kind: 'setup', sections: [
    { id: 'section-a', title: 'Load', position: 0, items: [
      { id: 'item-a', title: 'Original', position: 0, photo_required: true, required: false, instructions: 'Keep instructions' },
      { id: 'item-b', title: 'Retained', position: 1, photo_required: false },
    ] },
    { id: 'section-b', title: 'Finish', position: 1, items: [{ id: 'item-c', title: 'Final', position: 0, photo_required: false }] },
  ] }],
}));
import { AdminTemplatesPage } from './AdminTemplatesPage';

type Section = { id: string; title: string; items: { id: string; title: string; required?: boolean; instructions?: string; photo_required: boolean }[] };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
beforeEach(() => {
  m.rpc.mockReset().mockImplementation(async (name: string) => ({ data: name === 'preview_agreement_change' ? { token: 'ticket', consequences: [{ contract_id: 'contract' }] } : 'template', error: null }));
  m.from.mockReset().mockImplementation(() => { throw new Error('Unexpected direct write'); });
  m.confirm.mockReset().mockResolvedValue(true);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
async function edit() {
  render(<MemoryRouter><AdminTemplatesPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Checklists' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
}
async function save() {
  fireEvent.submit(screen.getByRole('button', { name: 'Save template' }).closest('form')!);
  await screen.findByText('Checklist template saved.');
  const preview = m.rpc.mock.calls.find(([name]) => name === 'preview_agreement_change')![1];
  const commit = m.rpc.mock.calls.find(([name]) => name === 'commit_agreement_change')![1];
  expect(commit).toEqual({ operation: 'template', target_payload: preview.target_payload, preview_token: 'ticket' });
  expect(m.from).not.toHaveBeenCalled();
  return preview.target_payload.sections as Section[];
}
function addItem(title: string) {
  fireEvent.click(screen.getAllByRole('button', { name: '+ Add item' })[0]);
  const inputs = screen.getAllByPlaceholderText('Checklist item');
  fireEvent.change(inputs.find(input => (input as HTMLInputElement).value === '')!, { target: { value: title } });
}
test('new items and sections carry distinct persistent UUIDs through preview and commit', async () => {
  await edit();
  addItem('New first'); addItem('New second');
  fireEvent.click(screen.getByRole('button', { name: '+ Add section' }));
  fireEvent.change(screen.getAllByPlaceholderText('Section title')[2], { target: { value: 'New section' } });
  fireEvent.change(screen.getAllByPlaceholderText('Checklist item').at(-1)!, { target: { value: 'New section item' } });
  const sections = await save();
  const ids = [sections[0].items[2].id, sections[0].items[3].id, sections[2].id, sections[2].items[0].id];
  ids.forEach(id => expect(id).toMatch(uuid));
  expect(new Set(ids).size).toBe(4);
});
test('delete and re-add at the same position does not reuse an existing item or section identity', async () => {
  await edit();
  fireEvent.click(screen.getByRole('button', { name: 'Delete Original' }));
  addItem('Replacement');
  fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Replacement' }), { key: 'ArrowUp' });
  fireEvent.click(screen.getByRole('button', { name: 'Delete Finish' }));
  fireEvent.click(screen.getByRole('button', { name: '+ Add section' }));
  fireEvent.change(screen.getAllByPlaceholderText('Section title')[1], { target: { value: 'Finish' } });
  fireEvent.change(screen.getAllByPlaceholderText('Checklist item').at(-1)!, { target: { value: 'Final' } });
  const sections = await save();
  expect(sections[0].items[0]).toMatchObject({ title: 'Replacement', id: expect.stringMatching(uuid) });
  expect(sections[0].items[1].id).toBe('item-b');
  expect(sections[1].id).toMatch(uuid);
  expect(sections[1].items[0].id).toMatch(uuid);
});
test('reordering retains existing identities, flags and instructions', async () => {
  await edit();
  fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Retained' }), { key: 'ArrowUp' });
  fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Finish' }), { key: 'ArrowUp' });
  const sections = await save();
  expect(sections.map(section => section.id)).toEqual(['section-b', 'section-a']);
  expect(sections[1].items.map(item => item.id)).toEqual(['item-b', 'item-a']);
  expect(sections[1].items[1]).toMatchObject({ photo_required: true, required: false, instructions: 'Keep instructions' });
});
test('cancel and retry with reordered new items preserves the same identities', async () => {
  await edit(); addItem('New first'); addItem('New second');
  m.confirm.mockResolvedValueOnce(false);
  fireEvent.submit(screen.getByRole('button', { name: 'Save template' }).closest('form')!);
  await screen.findByText('Agreement changes canceled. Nothing was saved.');
  expect(m.rpc).toHaveBeenCalledTimes(1);
  const first = m.rpc.mock.calls[0][1].target_payload.sections[0].items as Section['items'];
  const originalIds = first.slice(2).map(item => item.id);
  originalIds.forEach(id => expect(id).toMatch(uuid));
  fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder New second' }), { key: 'ArrowUp' });
  m.rpc.mockClear();
  const sections = await save();
  expect(sections[0].items.slice(2).map(item => item.id)).toEqual([...originalIds].reverse());
  await waitFor(() => expect(m.confirm).toHaveBeenCalledTimes(2));
});
