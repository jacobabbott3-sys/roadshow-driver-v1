import {lazy,Suspense} from 'react';
import {Link,useLocation,matchPath} from 'react-router-dom';
import {useOffline} from './context';
import {canReadSaved} from './model';
import {FreshnessNotice} from './FreshnessNotice';
import {LoadingScreen} from '../../components/LoadingScreen';
const Home=lazy(()=>import('../../pages/HomePage').then(m=>({default:m.HomePage})));
const Contracts=lazy(()=>import('../../pages/ContractsPage').then(m=>({default:m.ContractsPage})));
const Detail=lazy(()=>import('../../pages/ContractDetailPage').then(m=>({default:m.ContractDetailPage})));
const Group=lazy(()=>import('../../pages/SigningGroupPage').then(m=>({default:m.SigningGroupPage})));
const Resources=lazy(()=>import('../../pages/ResourcesPage').then(m=>({default:m.ResourcesPage})));
const RedFolder=lazy(()=>import('../../pages/RedFolderPage').then(m=>({default:m.RedFolderPage})));
export function SavedContentGate({owner}:{owner:string}){
 const {state}=useOffline(),{pathname}=useLocation();
 if(!state?.snapshot||!canReadSaved(state.snapshot,owner,Date.now()))return null;
 const detail=matchPath('/contracts/:id',pathname),group=matchPath('/signing-groups/:showId',pathname);
 const content=detail?<Detail contractId={detail.params.id}/>:group?<Group groupId={group.params.showId}/>:pathname==='/contracts'?<Contracts/>:pathname==='/resources/red-folder'?<RedFolder/>:pathname==='/resources'?<Resources/>:<Home/>;
 return <div className="app-shell offline-shell"><div className="app-main"><Suspense fallback={<LoadingScreen/>}>{content}</Suspense><FreshnessNotice/></div><nav className="bottom-nav" aria-label="Saved content navigation"><Link to="/">Home</Link><Link to="/contracts">Contracts</Link><Link to="/resources">Resources</Link><Link to="/profile">Settings</Link></nav></div>;
}
