import { createContext, useContext, useEffect, useId } from 'react';
type Presentation={ready:boolean;chats:number;notifications:number;setModalOpen:(owner:string,open:boolean)=>void;setSwipeBlocked?:(owner:string,blocked:boolean)=>void};
export const ShellPresentationContext=createContext<Presentation>({ready:false,chats:0,notifications:0,setModalOpen:(_owner:string,_open:boolean)=>{void _owner;void _open;}});
export function useShellPresentation(){return useContext(ShellPresentationContext);}
export function useNativeModal(open:boolean){
 const owner=useId();const {setModalOpen}=useShellPresentation();
 useEffect(()=>{setModalOpen(owner,open);return ()=>setModalOpen(owner,false);},[owner,open,setModalOpen]);
}

export function useSwipeBackBlock(blocked:boolean){
 const owner=useId();const {setSwipeBlocked}=useShellPresentation();
 useEffect(()=>{setSwipeBlocked?.(owner,blocked);return ()=>setSwipeBlocked?.(owner,false);},[owner,blocked,setSwipeBlocked]);
}
