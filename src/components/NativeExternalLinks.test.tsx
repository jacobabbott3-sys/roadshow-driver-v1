import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({native:true,open:vi.fn()}));
vi.mock('../lib/nativePlatform',()=>({isNativeApp:()=>mocks.native,openExternalUrl:mocks.open}));
import { NativeExternalLinks } from './NativeExternalLinks';
beforeEach(()=>{vi.clearAllMocks();mocks.native=true;mocks.open.mockResolvedValue(undefined)});
it('opens external files outside native webview and keeps internal routes',async()=>{
 render(<><NativeExternalLinks/><a href="https://myraoovepjwhkafzdppq.supabase.co/storage/fixture.pdf">PDF</a><a href="/contracts">Internal</a></>);
 fireEvent.click(screen.getByText('PDF'));
 await waitFor(()=>expect(mocks.open).toHaveBeenCalledOnce());
 fireEvent.click(screen.getByText('Internal'));
 expect(mocks.open).toHaveBeenCalledOnce();
});
it('reports opening errors without exposing signed URL',async()=>{
 mocks.open.mockRejectedValue(new Error('secret-url'));
 render(<><NativeExternalLinks/><a href="https://example.test/file?token=private">File</a></>);
 fireEvent.click(screen.getByText('File'));
 expect(await screen.findByRole('alert')).toHaveTextContent('Unable to open');
 expect(screen.getByRole('alert')).not.toHaveTextContent('private');
});
