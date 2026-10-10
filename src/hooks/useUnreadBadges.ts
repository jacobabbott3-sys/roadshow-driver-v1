import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getNotifications,getUnreadChatCount } from '../lib/communications';
import { supabase } from '../lib/supabase';
const empty={chats:0,notifications:0};
/** One owner shared by native chrome and the web fallback. No business contents cross the bridge. */
export function useUnreadBadges(userId:string|undefined){
 const {pathname}=useLocation();
 const [value,setValue]=useState({userId:undefined as string|undefined,...empty});
 const previousPath=useRef(pathname);
 const refresh=useRef<()=>void>(()=>{});
 useEffect(()=>{
  if(!userId)return;
  let alive=true;let request=0;
  const reload=()=>{
   const id=++request;
   void Promise.all([getUnreadChatCount(),getNotifications(userId)]).then(([chats,items])=>{
    if(alive&&id===request)setValue({userId,chats,notifications:items.filter(item=>!item.read_at).length});
   }).catch(()=>{if(alive&&id===request)setValue({userId,...empty});});
  };
  refresh.current=reload;reload();
  const timer=window.setInterval(reload,30_000);
  const channel=supabase.channel(`top-bar-${userId}`)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages'},reload)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`recipient_id=eq.${userId}`},reload).subscribe();
  window.addEventListener('roadshow:chat-changed',reload);window.addEventListener('roadshow:notifications-changed',reload);
  return ()=>{alive=false;refresh.current=()=>{};window.clearInterval(timer);void supabase.removeChannel(channel);window.removeEventListener('roadshow:chat-changed',reload);window.removeEventListener('roadshow:notifications-changed',reload);};
 },[userId]);
 useEffect(()=>{if(previousPath.current!==pathname){previousPath.current=pathname;refresh.current();}},[pathname]);
 return userId&&value.userId===userId ? {chats:value.chats,notifications:value.notifications} : empty;
}
