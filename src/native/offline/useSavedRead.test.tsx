import {render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {OfflineCoordinator} from './coordinator';
import {OfflineContext} from './context';
import {useSavedQuery} from './useSavedRead';
import type {OfflinePlugin} from './plugin';
const auth=vi.hoisted(()=>({nativeProfileVerified:true,loading:false,profile:{is_active:true,role:'admin'}}));
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
