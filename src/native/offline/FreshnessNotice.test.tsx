import {fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({verified:true,refresh:vi.fn(),verify:vi.fn(),snapshot:true,source:'saved',refreshing:false,canMutate:false}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({nativeProfileVerified:m.verified,refreshProfile:m.verify})}));
vi.mock('./context',()=>({useOffline:()=>({coordinator:{refresh:m.refresh},state:{snapshot:m.snapshot?{verifiedAt:1}:null,contracts:{source:m.source,fetchedAt:1,canMutate:m.canMutate,refreshing:m.refreshing}}})}));
import {FreshnessNotice} from './FreshnessNotice';
beforeEach(()=>{vi.clearAllMocks();m.verified=true;m.snapshot=true;m.source="saved";m.refreshing=false;m.canMutate=false;});
it('keeps the saved/read-only notice passive outside Settings',()=>{render(<FreshnessNotice/>);expect(screen.getByText(/Saved copy/)).toBeTruthy();expect(screen.getByText(/Read only/)).toBeTruthy();expect(screen.queryByRole('button')).toBeNull();});
it('refreshes verified data only when explicitly enabled by Status',()=>{render(<FreshnessNotice allowRefresh/>);fireEvent.click(screen.getByRole('button',{name:'Refresh'}));expect(m.refresh).toHaveBeenCalledWith('manual');expect(m.verify).not.toHaveBeenCalled();});
it('verifies the account first when Status refresh starts without verified data',()=>{m.verified=false;render(<FreshnessNotice allowRefresh/>);fireEvent.click(screen.getByRole('button',{name:'Refresh'}));expect(m.verify).toHaveBeenCalledOnce();expect(m.refresh).not.toHaveBeenCalled();});
it('offers Status recovery when no saved copy is available',()=>{m.snapshot=false;render(<FreshnessNotice showEmpty allowRefresh/>);expect(screen.getByText('No saved contracts yet')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Refresh'}));expect(m.verify).toHaveBeenCalledOnce();});

it('shows no global refresh/status strip during live use or automatic updates',()=>{
 m.source='live';m.canMutate=true;const view=render(<FreshnessNotice/>);expect(view.container).toBeEmptyDOMElement();
 m.refreshing=true;m.canMutate=false;view.rerender(<FreshnessNotice/>);expect(screen.getByText('Saved copy · Read only')).toBeVisible();expect(screen.queryByText(/Updating|Last updated/)).toBeNull();
});
