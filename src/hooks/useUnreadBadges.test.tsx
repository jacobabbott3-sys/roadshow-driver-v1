import { act,renderHook,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach,expect,it,vi } from 'vitest';
const m=vi.hoisted(()=>({chats:vi.fn().mockResolvedValue(3),notifications:vi.fn().mockResolvedValue([{read_at:null},{read_at:'yes'}]),remove:vi.fn(),channel:vi.fn(),on:vi.fn(),subscribe:vi.fn()}));
vi.mock('../lib/communications',()=>({getUnreadChatCount:m.chats,getNotifications:m.notifications}));
vi.mock('../lib/supabase',()=>({supabase:{channel:m.channel,removeChannel:m.remove}}));
import { useUnreadBadges } from './useUnreadBadges';
beforeEach(()=>{vi.clearAllMocks();const channel={on:m.on,subscribe:m.subscribe};m.channel.mockReturnValue(channel);m.on.mockReturnValue(channel);m.subscribe.mockReturnValue(channel);});
it('shares one channel, clears identity changes and removes listeners on unmount',async()=>{
 const view=renderHook(({id})=>useUnreadBadges(id),{initialProps:{id:'a' as string|undefined},wrapper:({children})=><MemoryRouter>{children}</MemoryRouter>});
 await waitFor(()=>expect(view.result.current).toEqual({chats:3,notifications:1}));expect(m.channel).toHaveBeenCalledOnce();expect(m.chats).toHaveBeenCalledOnce();
 act(()=>window.dispatchEvent(new Event('roadshow:chat-changed')));await waitFor(()=>expect(m.chats.mock.calls.length).toBeGreaterThan(1));
 view.rerender({id:undefined});expect(view.result.current).toEqual({chats:0,notifications:0});expect(m.remove).toHaveBeenCalledOnce();
 const calls=m.chats.mock.calls.length;view.unmount();act(()=>window.dispatchEvent(new Event('roadshow:chat-changed')));expect(m.chats).toHaveBeenCalledTimes(calls);
});
