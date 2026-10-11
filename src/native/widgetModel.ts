import {nextAssignment,assignmentDate,type AssignmentSummary} from '../lib/nextAssignment.ts';
export type OwnedAssignment=AssignmentSummary & {driver_id:string|null;contract_drivers:{driver_id:string}[]};
export type WidgetAssignment={id:string;title:string;location:string;dateLabel:string};
export type WidgetSnapshot={version:1;updatedAt:number;expiresAt:number;assignment:WidgetAssignment|null};
export const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function ownAssignments<T extends OwnedAssignment>(rows:readonly T[],userID:string):T[]{return rows.filter(row=>!row.show.is_test&&(row.driver_id===userID||row.contract_drivers.some(driver=>driver.driver_id===userID)));}
// Deliberately receives the shared selector's result from the bridge, retaining list order.
export function widgetSnapshot(rows:readonly AssignmentSummary[],now=Date.now()/1000):WidgetSnapshot{
 const row=nextAssignment(rows);
 const label=(s:string)=>Array.from(s,char=>char.charCodeAt(0)<32?' ':char).join('').trim().slice(0,120);
 const signing=row?.show.event_type==='signing';
 const date=row?assignmentDate(row).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})+(signing&&(row.show.setup_at||row.show.signing_at)?' · '+assignmentDate(row).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):row.service_time?' · '+row.service_time.slice(0,5):''):'';
 return {version:1,updatedAt:now,expiresAt:now+21600,assignment:row&&uuidPattern.test(row.id)?{id:row.id,title:label(signing?(row.show.artist||row.show.name):row.show.name),location:label([row.show.city,row.show.state].filter(Boolean).join(', ')),dateLabel:label(date)}:null};
}
export function widgetRoute(raw:string):string|null{
 try{const url=new URL(raw);const id=url.pathname.slice(1);if(url.protocol!=='roadshow-driver:'||url.host!=='contract'||url.username||url.password||url.hash||!uuidPattern.test(id))return null;
 const query=url.search;if(query!==''&&query!=='?tab=checklist')return null;return `/contracts/${id}${query}`;}catch{return null;}
}
export function editableAssignment(row:AssignmentSummary):boolean{return !['submitted','under_review','approved','bonus_earned','bonus_not_earned','cancelled'].includes(row.status);}
export function canFollow(row:AssignmentSummary,completed:number,total:number):boolean{return editableAssignment(row)&&Number.isInteger(total)&&Number.isInteger(completed)&&total>0&&total<=10000&&completed>=0&&completed<total;}
export function checklistProgress(items:readonly {response?:{completed?:boolean}|null}[]){return {completed:items.filter(item=>item.response?.completed===true).length,total:items.length};}
