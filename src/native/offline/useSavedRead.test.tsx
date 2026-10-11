import {render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {OfflineCoordinator} from './coordinator';
import {OfflineContext} from './context';
import {useSavedQuery} from './useSavedRead';
import type {OfflinePlugin} from './plugin';
const auth=vi.hoisted(()=>({nativeProfileVerified:true,loading:false,user:{id:'11111111-1111-4111-8111-111111111111'},profile:{is_active:true,role:'admin'}}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>auth}));
const owner='11111111-1111-4111-8111-111111111111';
const snapshot={version:1 as const,owner,verifiedAt:Date.now(),lastSeenAt:Date.now(),contracts:{},links:[],resources:{}};
const plugin={configure:async()=>{},read:async()=>({snapshot:null}),replace:async()=>{},manifest:async()=>({files:[]}),usage:async()=>({bytes:0,limit:262144000})} as unknown as OfflinePlugin;
it('keeps broader authorized administrator live results out of the owned cache',async()=>{
 const coordinator=new OfflineCoordinator(plugin,async()=>snapshot);await coordinator.activate(owner);coordinator.verify(owner,Date.now());await coordinator.refresh('launch');
 function View(){const query=useSavedQuery(async()=>['Authorized team contract'],[],()=>[] as string[]);return <p>{query.data?.join(',')}</p>;}
 render(<OfflineContext.Provider value={coordinator}><View/></OfflineContext.Provider>);
 expect(await screen.findByText('Authorized team contract')).toBeVisible();expect(coordinator.getState().snapshot?.contracts).toEqual({});
});
it('ends loading and exposes a retryable failure when no saved copy can be refreshed',async()=>{
 auth.profile.role='driver';const coordinator=new OfflineCoordinator(plugin,async()=>{throw Error('Connection failed')});await coordinator.activate(owner);coordinator.verify(owner,Date.now());await coordinator.refresh('launch');
 function View(){const query=useSavedQuery(async()=>[],[],()=>[]);return <p>{query.loading?'Loading':query.error}</p>;}
 render(<OfflineContext.Provider value={coordinator}><View/></OfflineContext.Provider>);
 expect(await screen.findByText('Connection failed')).toBeVisible();
});
it('keeps an administrator list visible on revisit while a slow refresh is read-only',async()=>{
 auth.profile.role='admin';
 const coordinator=new OfflineCoordinator(plugin,async()=>snapshot);await coordinator.activate(owner);coordinator.verify(owner,Date.now());
 let calls=0;
 const load=()=>++calls===1?Promise.resolve(['Team assignment']):new Promise<string[]>(()=>{});
 function View(){const query=useSavedQuery(load,[],()=>[] as string[],'test-list');return <p>{query.data?.join(',')} {query.live?'Editable':'Read only'}</p>;}
 const first=render(<OfflineContext.Provider value={coordinator}><View/></OfflineContext.Provider>);
 expect(await screen.findByText(/Team assignment/)).toBeVisible();first.unmount();
 render(<OfflineContext.Provider value={coordinator}><View/></OfflineContext.Provider>);
 expect(screen.getByText(/Team assignment.*Read only/)).toBeVisible();
});

it('does not expose remembered administrator data to another owner or during verification',async()=>{
 auth.profile.role='admin';auth.nativeProfileVerified=true;
 const coordinator=new OfflineCoordinator(plugin,async()=>snapshot);await coordinator.activate(owner);coordinator.verify(owner,Date.now());
 coordinator.remember(coordinator.getState().generation,JSON.stringify(['private-list']),'Private team assignment');
 function View(){const query=useSavedQuery(()=>new Promise<string>(()=>{}),[],()=>'', 'private-list');return <p>{query.data}</p>;}
 const view=render(<OfflineContext.Provider value={coordinator}><View/></OfflineContext.Provider>);
 expect(screen.getByText('Private team assignment')).toBeVisible();
 auth.nativeProfileVerified=false;view.rerender(<OfflineContext.Provider value={coordinator}><View/></OfflineContext.Provider>);
 expect(screen.queryByText('Private team assignment')).toBeNull();
 auth.nativeProfileVerified=true;auth.user.id='22222222-2222-4222-8222-222222222222';view.rerender(<OfflineContext.Provider value={coordinator}><View/></OfflineContext.Provider>);
 expect(screen.queryByText('Private team assignment')).toBeNull();auth.user.id=owner;
});
