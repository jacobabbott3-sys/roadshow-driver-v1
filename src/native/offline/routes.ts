import {matchPath} from 'react-router-dom';
export function savedRoute(path:string){return ['/', '/contracts','/resources','/resources/red-folder'].includes(path)||!!matchPath('/contracts/:id',path)||!!matchPath('/signing-groups/:showId',path);}
