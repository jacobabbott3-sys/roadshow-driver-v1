import { parseAppearance,type ShellAppearance } from './shellProtocol';
const key='roadshow-native-appearance-v1';
export function readNativeAppearance():ShellAppearance{
 try{return parseAppearance(JSON.parse(localStorage.getItem(key)||'null'))||{mode:'system',haptics:true};}catch{return {mode:'system',haptics:true};}
}
export function applyNativeAppearance(mode:ShellAppearance['mode']):()=>void{
 const media=window.matchMedia('(prefers-color-scheme: dark)');
 const apply=()=>{document.documentElement.dataset.theme=mode==='dark'||(mode==='system'&&media.matches)?'dark':'light';document.documentElement.dataset.accent='forest';};
 apply();media.addEventListener('change',apply);return ()=>media.removeEventListener('change',apply);
}
export function watchNativeAppearance():()=>void{
 let stop=applyNativeAppearance(readNativeAppearance().mode);
 const changed=(event:Event)=>{const appearance=parseAppearance((event as CustomEvent).detail);if(!appearance)return;try{localStorage.setItem(key,JSON.stringify(appearance));}catch{/* UserDefaults remains authoritative when browser storage is unavailable. */}stop();stop=applyNativeAppearance(appearance.mode);};
 window.addEventListener('roadshow:native-appearance',changed);
 return ()=>{stop();window.removeEventListener('roadshow:native-appearance',changed);};
}
