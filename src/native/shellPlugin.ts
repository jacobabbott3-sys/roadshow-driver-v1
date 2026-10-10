import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { ShellAppearance, ShellState } from './shellProtocol';
export interface ShellPlugin {
 connect(options:{connection:string}):Promise<{version:1;connection:string;appearance:ShellAppearance}>;
 setState(options:{state:ShellState}):Promise<void>;
 disconnect(options:{connection:string}):Promise<void>;
 setAppearance(options:{appearance:ShellAppearance}):Promise<void>;
 showAppearance():Promise<void>;
 addListener(event:string,listener:(value:unknown)=>void):Promise<PluginListenerHandle>;
}
export const shellPlugin=registerPlugin<ShellPlugin>('RoadshowShell');
