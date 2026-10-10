import { parseAppearance,type ShellAppearance } from './shellProtocol';
const key='roadshow-native-appearance-v1';
export function readNativeAppearance():ShellAppearance{
 try{return parseAppearance(JSON.parse(localStorage.getItem(key)||'null'))||{mode:'system',haptics:true,color:'forest'};}catch{return {mode:'system',haptics:true,color:'forest'};}
}
export function applyNativeAppearance(mode:ShellAppearance['mode'],color:ShellAppearance['color']='forest'):()=>void{
 const media=window.matchMedia('(prefers-color-scheme: dark)');
 const apply=()=>{document.documentElement.dataset.theme=mode==='dark'||(mode==='system'&&media.matches)?'dark':'light';document.documentElement.dataset.accent=color;};
 apply();media.addEventListener('change',apply);return ()=>media.removeEventListener('change',apply);
}
export function watchNativeAppearance():()=>void{
 const saved=readNativeAppearance();
 let stop=applyNativeAppearance(saved.mode,saved.color);
 const changed=(event:Event)=>{const appearance=parseAppearance((event as CustomEvent).detail);if(!appearance)return;try{localStorage.setItem(key,JSON.stringify(appearance));}catch{/* UserDefaults remains authoritative when browser storage is unavailable. */}stop();stop=applyNativeAppearance(appearance.mode,appearance.color);};
 window.addEventListener('roadshow:native-appearance',changed);
 return ()=>{stop();window.removeEventListener('roadshow:native-appearance',changed);};
}
