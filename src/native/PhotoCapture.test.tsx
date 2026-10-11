import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ShellPresentationContext } from './useShellPresentation';
import { PhotoCapture } from './PhotoCapture';

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }));
});
const file = new File(['photo'], 'front.jpg', { type: 'image/jpeg' });
function selectPhoto() {
  fireEvent.change(screen.getByLabelText('Choose from library'), { target: { files: [file] } });
}
it('requires preview confirmation and keeps a failed photo available for retry', async () => {
  let attempts = 0;
  const upload = async (selected: File, progress: (value: number) => void) => {
    expect(selected).toBe(file);
    progress(30);
    if (++attempts === 1) throw new Error('Connection lost');
  };
  render(<PhotoCapture slot="Front" upload={upload} />);
  expect(screen.getByText(/whole front/i)).toBeTruthy();
  expect(screen.getByLabelText('Take photo').getAttribute('capture')).toBe('environment');
  expect(screen.getByLabelText('Choose from library').hasAttribute('capture')).toBe(false);
  selectPhoto();
  expect(screen.getByAltText('Front photo preview')).toBeTruthy();
  expect(attempts).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Connection lost'));
  expect(screen.getByAltText('Front photo preview')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Retry upload' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Uploaded'));
  expect(attempts).toBe(2);
  expect(screen.queryByAltText('Front photo preview')).toBeNull();
});
it('retake opens the camera and cancelling it preserves the current preview', () => {
  render(<PhotoCapture slot="Back" upload={async () => { throw new Error('Should not upload'); }} />);
  selectPhoto();
  const camera = screen.getByLabelText('Take photo');
  const click = vi.spyOn(camera as HTMLInputElement, 'click');
  fireEvent.click(screen.getByRole('button', { name: 'Retake' }));
  expect(click).toHaveBeenCalledOnce();
  fireEvent.change(camera, { target: { files: [] } });
  expect(screen.getByAltText('Back photo preview')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Discard photo' }));
  expect(screen.queryByAltText('Back photo preview')).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
});
it('rejects unsupported input without losing a previous valid selection', () => {
  render(<PhotoCapture slot="Front" upload={async () => {}} />);
  selectPhoto();
  fireEvent.change(screen.getByLabelText('Choose from library'), { target: { files: [new File(['heic'], 'photo.heic', { type: 'image/heic' })] } });
  expect(screen.getByRole('alert').textContent).toContain('JPEG');
  expect(screen.getByAltText('Front photo preview')).toBeTruthy();
});
it('shows progress and prevents duplicate uploads while saving', async () => {
  let finish!: () => void;
  render(<PhotoCapture slot="Front" upload={async (_, progress) => { progress(80); await new Promise<void>(resolve => { finish = resolve; }); }} />);
  selectPhoto();
  fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));
  await waitFor(() => expect(screen.getByRole('progressbar').getAttribute('value')).toBe('80'));
  expect(screen.getByRole('button', { name: /Uploading/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Discard photo' })).toBeDisabled();
  finish();
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Uploaded'));
});

it('blocks swipe-back while a draft or failed upload is retained and releases it on discard',async()=>{
 const setSwipeBlocked=vi.fn();
 const view=render(<ShellPresentationContext.Provider value={{ready:true,chats:0,notifications:0,setModalOpen:()=>{},setSwipeBlocked}}><PhotoCapture slot="Front" upload={async()=>{throw Error('Offline')}}/></ShellPresentationContext.Provider>);
 selectPhoto();expect(setSwipeBlocked.mock.lastCall?.[1]).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Use photo'}));await screen.findByRole('alert');expect(setSwipeBlocked.mock.lastCall?.[1]).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Discard photo'}));expect(setSwipeBlocked.mock.lastCall?.[1]).toBe(false);
 selectPhoto();view.unmount();expect(setSwipeBlocked.mock.lastCall?.[1]).toBe(false);
});
