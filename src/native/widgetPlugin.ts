import {registerPlugin,type PluginListenerHandle} from '@capacitor/core';
import type {WidgetAPI} from './widgetController';
export const widgetPlugin=registerPlugin<WidgetAPI & {addListener(event:'link',listener:()=>void):Promise<PluginListenerHandle>}>('RoadshowWidgets');
