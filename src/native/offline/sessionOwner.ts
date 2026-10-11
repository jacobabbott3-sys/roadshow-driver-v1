import {uuid} from './model.ts';
// Identity only for bounded saved reads. Never supplies Session/Profile or online privileges.
export function persistedOwner(raw:string|null):string|null {
 try{const value=JSON.parse(raw||'null');return value&&typeof value.access_token==='string'&&value.access_token.length>0&&typeof value.refresh_token==='string'&&value.refresh_token.length>0&&uuid(value.user?.id)?value.user.id:null;}catch{return null;}
}
