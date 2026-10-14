import { Link } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgreementReview } from '../lib/agreementTypes';
import { acceptContractAgreement, getContractAgreement } from '../lib/agreementData';
import { AgreementCopy } from './AgreementCopy';
import { PageState } from './PageState';

type Props={contractId:string;onSigned:()=>Promise<void>;acceptanceRole?:'driver'|'admin';enabled?:boolean};
export function AgreementSigning({enabled=true,...props}:Props){
 return enabled ? <LiveAgreementSigning key={`${props.contractId}:${props.acceptanceRole || 'driver'}`} {...props}/> : <p className="notice">An active account is required to review this agreement.</p>;
}
function LiveAgreementSigning({contractId,onSigned,acceptanceRole='driver'}:Props) {
  const active=useRef(false), lifetime=useRef(0), latestReview=useRef(0);
  const [query,setQuery]=useState<{data:AgreementReview|null;loading:boolean;error:string}>({data:null,loading:true,error:''});
  const refresh=useCallback(async()=>{
    if (!active.current) return;
    const request=++latestReview.current;
    setQuery(current=>({...current,loading:true,error:''}));
    try {
      const data=await getContractAgreement(contractId);
      if (active.current && request===latestReview.current) setQuery({data,loading:false,error:''});
    } catch(error) {
      if (active.current && request===latestReview.current) setQuery({data:null,loading:false,error:error instanceof Error ? error.message : 'Unable to load agreement.'});
    }
  },[contractId]);
  useEffect(()=>{
    active.current=true; lifetime.current=lifetime.current+1;
    void refresh();
    return ()=>{active.current=false; lifetime.current=lifetime.current+1; latestReview.current=latestReview.current+1;};
  },[refresh]);
  const scope=`${contractId}:${query.data?.version.id || ''}:${acceptanceRole}`;
  const [consent,setConsent]=useState({scope:'',name:'',ack:false});
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const name=consent.scope===scope ? consent.name : '';
  const ack=consent.scope===scope && consent.ack;
  const hasTerms=!!query.data?.version.content.contract.terms;
  async function sign() {
    if (!active.current || !query.data || query.loading || query.error || busy || !ack || !hasTerms || name.trim().length < 2) return;
    const signingLifetime=lifetime.current;
    const isCurrent=()=>active.current && lifetime.current===signingLifetime;
    setBusy(true);setMessage('');
    try {
      await acceptContractAgreement(contractId,query.data.version.id,acceptanceRole,name);
      if (!isCurrent()) return;
      setMessage('Current agreement accepted.');
      setConsent(current=>({...current,ack:false}));
      await refresh();
      if (isCurrent()) await onSigned();
    } catch(error) {
      if (!isCurrent()) return;
      setMessage(error instanceof Error ? error.message : 'Unable to accept agreement.');
      setConsent(current=>({...current,ack:false}));
      await refresh();
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }
  const driver=query.data?.signatures.find(s=>s.signer_role==='driver');
  const admin=query.data?.signatures.find(s=>s.signer_role==='admin');
  return <section className="sign-panel"><h2>Review and sign agreement</h2><Link to="/agreements">My agreement history</Link><PageState loading={query.loading} error={query.error} empty={!query.data}>{query.data && <>
    <h3>Agreement version {query.data.version.version_number}</h3>
    {query.data.legacy_missing && <p className="notice">Historical accepted copy unavailable for legacy signatures. Existing names and timestamps are preserved; they do not accept this new version.</p>}
    {query.data.legacy_evidence && <details><summary>Recorded legacy signature details</summary><p>{query.data.legacy_evidence.signature_name || 'Driver name not recorded'}{query.data.legacy_evidence.signed_at ? ` · ${new Date(query.data.legacy_evidence.signed_at).toLocaleString()}` : ''}</p><p>{query.data.legacy_evidence.admin_signature_name || 'Admin name not recorded'}{query.data.legacy_evidence.admin_signed_at ? ` · ${new Date(query.data.legacy_evidence.admin_signed_at).toLocaleString()}` : ''}</p></details>}
    <p className="notice">{driver && admin ? 'Driver and admin accepted this version.' : 'Current agreement acceptance pending.'}</p>
    <AgreementCopy content={query.data.version.content}/>
    {!hasTerms && <p className="notice">Contract terms have not been published yet. Contact your administrator before signing.</p>}
    <p>Driver: {driver ? `${driver.signer_name} · ${new Date(driver.signed_at).toLocaleString()}` : 'Waiting for driver'}</p><p>Admin: {admin ? `${admin.signer_name} · ${new Date(admin.signed_at).toLocaleString()}` : 'Waiting for administrator'}</p>
    {!(acceptanceRole==='driver' ? driver : admin) && <><p>Signing as {acceptanceRole}.</p><label>Full legal name<input value={name} onChange={e=>setConsent({scope,name:e.target.value,ack})}/></label><label className="checkbox-field"><input type="checkbox" checked={ack} onChange={e=>setConsent({scope,name,ack:e.target.checked})}/> I reviewed this version, full terms, pay and checklist requirements.</label><button className="button primary" disabled={busy || query.loading || !ack || !hasTerms || name.trim().length<2} onClick={()=>void sign()}>{busy ? 'Signing…' : 'Accept this version and sign'}</button></>}
  </>}</PageState>{message && <p className="notice" role="status">{message}</p>}</section>;
}
