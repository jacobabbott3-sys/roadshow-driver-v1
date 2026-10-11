import {registerPlugin} from '@capacitor/core';
import type {OfflineSnapshot,FileRef,SavedFile} from './model';
export interface OfflinePlugin {
 configure(options:{owner:string;generation:string}):Promise<void>;
 read(options:{generation:string}):Promise<{snapshot:unknown}>;
 replace(options:{generation:string;snapshot:OfflineSnapshot}):Promise<void>;
 clear():Promise<void>;
 usage(options:{generation:string}):Promise<{bytes:number;limit:number}>;
 manifest(options:{generation:string}):Promise<{files:SavedFile[]}>;
 readFile(options:{generation:string;ref:FileRef}):Promise<{mime:string;base64:string}>;
 removeFile(options:{generation:string;ref:FileRef}):Promise<void>;
}
export const offlinePlugin=registerPlugin<OfflinePlugin>('RoadshowOffline');
