import {act,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({active:false,owner:'11111111-1111-4111-8111-111111111111'}));
vi.mock('../../lib/nativePlatform',()=>({isNativeApp:()=>true}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:null,savedSessionOwner:m.owner,sessionResolved:false,loading:true,nativeProfileVerified:false,profile:null})}));
vi.mock('./data',()=>({loadOwnedSnapshot:()=>new Promise(()=>{}),downloadServices:undefined}));
vi.mock('./plugin',()=>({offlinePlugin:{
 configure:async()=>{if(!m.active)throw Error('Scene inactive')},
 read:async()=>({snapshot:{version:1,owner:m.owner,verifiedAt:Date.now(),lastSeenAt:Date.now(),contracts:{},links:[],resources:{}}}),
 manifest:async()=>({files:[]}),usage:async()=>({bytes:0,limit:262144000})
}}));
import {OfflineBridge} from './OfflineBridge';
import {useOffline} from './context';
function Probe(){const {state}=useOffline();return <p>{state?.snapshot?`Saved: ${state.contracts.canMutate?'editable':'read only'}`:state?.contracts.error||'Waiting'}</p>}
it('hydrates read-only saved data when the scene activates without waiting for session/network resolution',async()=>{
 render(<MemoryRouter><OfflineBridge><Probe/></OfflineBridge></MemoryRouter>);
 await screen.findByText('Could not read saved data.');
 m.active=true;act(()=>document.dispatchEvent(new Event('roadshow:native-active')));
 await waitFor(()=>expect(screen.getByText('Saved: read only')).toBeTruthy());
});
