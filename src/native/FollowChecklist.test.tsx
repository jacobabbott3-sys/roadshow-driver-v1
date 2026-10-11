import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import {WidgetsContext} from './useWidgets';
import {FollowChecklist} from './FollowChecklist';
vi.mock('../lib/nativePlatform',()=>({isNativeApp:()=>true}));
const row={id:'one',driver_id:'me',contract_drivers:[],status:'signed',service_date:'2026-10-10',show:{name:'Show',city:'City',event_type:'show',starts_on:'2026-10-10'}};
it('requires explicit follow and displays a failure without implying success',async()=>{
 const follow=vi.fn().mockRejectedValue(new Error('Live Activities disabled'));
 render(<WidgetsContext.Provider value={{ready:true,assignments:[row],following:'',activityAvailable:true,widgetAvailable:true,error:'',follow,stop:async()=>{}}}><FollowChecklist id="one" completed={1} total={3}/></WidgetsContext.Provider>);
 expect(follow).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Follow checklist'}));await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('disabled'));expect(screen.queryByText('Stop following')).toBeNull();
});
it('offers stop for the followed contract and hides controls for other assignments',()=>{
 const value={ready:true,assignments:[row],following:'one',activityAvailable:true,widgetAvailable:true,error:'',follow:async()=>{},stop:async()=>{}};
 const view=render(<WidgetsContext.Provider value={value}><FollowChecklist id="one" completed={1} total={3}/></WidgetsContext.Provider>);expect(screen.getByRole('button',{name:'Stop following'})).toBeTruthy();view.rerender(<WidgetsContext.Provider value={value}><FollowChecklist id="other" completed={1} total={3}/></WidgetsContext.Provider>);expect(screen.queryByRole('button')).toBeNull();
});
