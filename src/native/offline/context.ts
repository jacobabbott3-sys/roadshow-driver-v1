import {createContext,useContext,useSyncExternalStore} from 'react';
import type {OfflineCoordinator} from './coordinator';
export const OfflineContext=createContext<OfflineCoordinator|null>(null);
const noop=()=>()=>{};const none=()=>null;
export function useOffline(){const coordinator=useContext(OfflineContext);const state=useSyncExternalStore(coordinator?.subscribe||noop,coordinator?.getState||none);return {coordinator,state};}
