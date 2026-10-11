import {it,expect,vi} from 'vitest';
const fixture=vi.hoisted(()=>{
 const show={name:'Show',city:'City',state:'NY',event_type:'show',starts_on:'2026-10-10',is_test:false};
 const rows=[{id:'foreign',driver_id:'them',contract_drivers:[],status:'signed',service_date:'2026-10-01',show},{id:'primary',driver_id:'me',contract_drivers:[],status:'signed',service_date:'2026-10-02',show},{id:'linked',driver_id:'them',contract_drivers:[{driver_id:'me'}],status:'signed',service_date:'2026-10-03',show}];
 function from(table:string){
  let data:Record<string,unknown>[]=table==='contracts'?[...rows]:[{contract_id:'linked',driver_id:'me'}];let offset=0;
  const query={select:()=>query,eq:(key:string,value:string)=>{data=data.filter(row=>row[key]===value);return query;},in:(key:string,values:string[])=>{data=data.filter(row=>values.includes(String(row[key])));return query;},order:(key:string)=>{data.sort((a,b)=>String(a[key]).localeCompare(String(b[key])));return query;},range:(start:number)=>{offset=start;return query;},then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(resolve({data:data.slice(offset,offset+1),count:data.length,error:null}))};return query;
 }return {from};
});
vi.mock('../lib/supabase',()=>({supabase:{from:fixture.from}}));
import {getWidgetAssignments} from './widgetData';
it('retrieves primary and linked assignments even when the server returns one row per page',async()=>{const rows=await getWidgetAssignments('me');expect(rows.map(row=>row.id)).toEqual(['primary','linked']);});
