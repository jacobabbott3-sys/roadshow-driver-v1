import {supabase} from '../lib/supabase';
import {ownAssignments,type OwnedAssignment} from './widgetModel';
const fields='id,driver_id,status,service_date,service_time,contract_drivers(driver_id),show:shows(name,city,state,event_type,starts_on,setup_at,signing_at,artist,is_test)';
type Page<T>={data:T[]|null;count:number|null;error:unknown};
async function allPages<T>(load:(offset:number)=>PromiseLike<Page<T>>):Promise<T[]> {
 const result:T[]=[];
 for(;;){
  const page=await load(result.length);if(page.error)throw page.error;
  if(page.count===null)throw new Error('Could not verify complete assignment list.');
  const rows=page.data||[];result.push(...rows);
  if(result.length>=page.count)return result;
  if(!rows.length||result.length>50000)throw new Error('Assignment list was incomplete.');
 }
}
export async function getWidgetAssignments(userID:string):Promise<OwnedAssignment[]> {
 // Server-side filters prevent administrator visibility from filling the result window.
 const [primary,links]=await Promise.all([
  allPages<OwnedAssignment>(offset=>supabase.from('contracts').select(fields,{count:'exact'}).eq('driver_id',userID).order('id').range(offset,offset+199) as unknown as PromiseLike<Page<OwnedAssignment>>),
  allPages<{contract_id:string}>(offset=>supabase.from('contract_drivers').select('contract_id',{count:'exact'}).eq('driver_id',userID).order('contract_id').range(offset,offset+199)),
 ]);
 const combined=new Map(primary.map(row=>[row.id,row]));
 const ids=[...new Set(links.map(link=>link.contract_id))].filter(id=>!combined.has(id));
 for(let index=0;index<ids.length;index+=100){
  const chunk=ids.slice(index,index+100);
  const rows=await allPages<OwnedAssignment>(offset=>supabase.from('contracts').select(fields,{count:'exact'}).in('id',chunk).order('id').range(offset,offset+199) as unknown as PromiseLike<Page<OwnedAssignment>>);
  rows.forEach(row=>combined.set(row.id,row));
 }
 return ownAssignments([...combined.values()],userID).sort((a,b)=>a.service_date.localeCompare(b.service_date)||a.id.localeCompare(b.id));
}
