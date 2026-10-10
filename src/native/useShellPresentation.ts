import { createContext, useContext, useEffect, useId } from 'react';
export const ShellPresentationContext=createContext({ready:false,chats:0,notifications:0,setModalOpen:(_owner:string,_open:boolean)=>{void _owner;void _open;}});
export function useShellPresentation(){return useContext(ShellPresentationContext);}
export function useNativeModal(open:boolean){
 const owner=useId();const {setModalOpen}=useShellPresentation();
 useEffect(()=>{setModalOpen(owner,open);return ()=>setModalOpen(owner,false);},[owner,open,setModalOpen]);
}
