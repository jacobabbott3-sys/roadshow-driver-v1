import test from 'node:test';
import assert from 'node:assert/strict';
import { actionRoute, selectedTab, parentRoute, tabsForRole, parseShellState, validLayout, parseAppearance } from './shellProtocol.ts';
test('routes only allowlisted actions and maps nested screens', () => {
 assert.equal(actionRoute('javascript:alert(1)'), null);
 assert.equal(actionRoute('redFolder'), '/resources/red-folder');
 assert.equal(selectedTab('/signing-groups/fixture'), 'contracts');
 assert.equal(selectedTab('/admin/shows'), 'admin');
 assert.equal(selectedTab('/notifications'), null);
 assert.equal(parentRoute('/contracts/fixture'), '/contracts');
 assert.deepEqual(tabsForRole('driver'), ['home','contracts','resources','profile']);
});
test('validates shell messages and bounds badge counts', () => {
 const state={version:1,sequence:1,connection:'fixture',visible:true,tabs:tabsForRole('driver'),selected:'home',canGoBack:false,unreadChats:1000,unreadNotifications:0,modalOpen:false};
 assert.equal(parseShellState(state)?.unreadChats,99);
 for(const change of [{version:2},{sequence:-1},{unreadChats:NaN},{unreadChats:-1},{tabs:['admin']},{selected:'admin'},{visible:'yes'},{connection:''}]) assert.equal(parseShellState({...state,...change}),null);
 assert.equal(validLayout({top:NaN,bottom:2}),false);
 assert.equal(validLayout({top:48,bottom:90}),true);
});

test('local colors default older preferences to Forest and reject unknown accents',()=>{
 assert.deepEqual(parseAppearance({mode:'system',haptics:true}),{mode:'system',haptics:true,color:'forest'});
 assert.equal(parseAppearance({mode:'dark',haptics:false,color:'purple'})?.color,'purple');
 assert.equal(parseAppearance({mode:'dark',haptics:true,color:'unknown'}),null);
});
