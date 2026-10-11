import {createContext,useContext} from 'react';
import type {WidgetViewState} from './widgetController';
export const WidgetsContext=createContext<WidgetViewState & {follow:(id:string)=>Promise<void>;stop:()=>Promise<void>}>({ready:false,assignments:[],following:'',activityAvailable:false,widgetAvailable:false,error:'',follow:async()=>{},stop:async()=>{}});
export function useWidgets(){return useContext(WidgetsContext);}
