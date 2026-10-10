import { act } from '@testing-library/react';
import { beforeEach,expect,it,vi } from 'vitest';
import { applyNativeAppearance,readNativeAppearance,watchNativeAppearance } from './nativeAppearance';
let dark=false;let listener:()=>void=()=>{};
beforeEach(()=>{localStorage.clear();dark=false;vi.stubGlobal('matchMedia',vi.fn(()=>({get matches(){return dark;},addEventListener:(_name:string,fn:()=>void)=>{listener=fn;},removeEventListener:vi.fn()})));});
it('defaults System and follows OS with explicit overrides and local cache only',()=>{
 expect(readNativeAppearance().mode).toBe('system');const stop=applyNativeAppearance('system');expect(document.documentElement.dataset.theme).toBe('light');dark=true;act(()=>listener());expect(document.documentElement.dataset.theme).toBe('dark');stop();
 applyNativeAppearance('light');expect(document.documentElement.dataset.theme).toBe('light');expect(document.documentElement.dataset.accent).toBe('forest');expect(localStorage.getItem('roadshow-theme')).toBeNull();
});
it('validates persisted preferences and listens for native mode/haptics without account data',()=>{
 localStorage.setItem('roadshow-native-appearance-v1','{"mode":"bad"}');expect(readNativeAppearance()).toEqual({mode:'system',haptics:true,color:'forest'});const stop=watchNativeAppearance();
 act(()=>window.dispatchEvent(new CustomEvent('roadshow:native-appearance',{detail:{mode:'dark',haptics:false,color:'blue'}})));expect(readNativeAppearance()).toEqual({mode:'dark',haptics:false,color:'blue'});expect(document.documentElement.dataset.theme).toBe('dark');expect(document.documentElement.dataset.accent).toBe('blue');expect(localStorage.getItem('roadshow-color-scheme')).toBeNull();stop();
});
