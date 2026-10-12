import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { acceptContractAgreement, getContractAgreement } from '../lib/agreementData';
import { AgreementCopy } from './AgreementCopy';
import { PageState } from './PageState';

export function AgreementSigning({contractId,onSigned,acceptanceRole='driver'}: {contractId:string;onSigned:()=>Promise<void>;acceptanceRole?:'driver'|'admin'}) {
  const query=useAsync(()=>getContractAgreement(contractId),[contractId]);
  const scope=`${contractId}:${query.data?.version.id || ''}:${acceptanceRole}`;
  const [consent,setConsent]=useState({scope:'',name:'',ack:false});
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const name=consent.scope===scope ? consent.name : '';
  const ack=consent.scope===scope && consent.ack;
  async function sign() {
    if (!query.data || !ack) return;
    setBusy(true);setMessage('');
    try {await acceptContractAgreement(contractId,query.data.version.id,acceptanceRole,name);setMessage('Current agreement accepted.');await query.refresh();await onSigned();}
    catch(error){setMessage(error instanceof Error ? error.message : 'Unable to accept agreement.');setConsent(current=>({...current,ack:false}));await query.refresh();}
    finally{setBusy(false);}
  }
  const driver=query.data?.signatures.find(s=>s.signer_role==='driver');
  const admin=query.data?.signatures.find(s=>s.signer_role==='admin');
  return <section className="sign-panel"><h2>Review and sign agreement</h2><Link to="/agreements">My agreement history</Link><PageState loading={query.loading} error={query.error} empty={!query.data}>{query.data && <>
    <h3>Agreement version {query.data.version.version_number}</h3>
    {query.data.legacy_missing && <p className="notice">Historical accepted copy unavailable for legacy signatures. Existing names and timestamps are preserved; they do not accept this new version.</p>}
    {query.data.legacy_evidence && <details><summary>Recorded legacy signature details</summary><p>{query.data.legacy_evidence.signature_name || 'Driver name not recorded'}{query.data.legacy_evidence.signed_at ? ` · ${new Date(query.data.legacy_evidence.signed_at).toLocaleString()}` : ''}</p><p>{query.data.legacy_evidence.admin_signature_name || 'Admin name not recorded'}{query.data.legacy_evidence.admin_signed_at ? ` · ${new Date(query.data.legacy_evidence.admin_signed_at).toLocaleString()}` : ''}</p></details>}
    <p className="notice">{driver && admin ? 'Driver and admin accepted this version.' : 'Current agreement acceptance pending.'}</p>
    <AgreementCopy content={query.data.version.content}/>
    <p>Driver: {driver ? `${driver.signer_name} · ${new Date(driver.signed_at).toLocaleString()}` : 'Waiting for driver'}</p><p>Admin: {admin ? `${admin.signer_name} · ${new Date(admin.signed_at).toLocaleString()}` : 'Waiting for administrator'}</p>
    {!(acceptanceRole==='driver' ? driver : admin) && <><p>Signing as {acceptanceRole}.</p><label>Full legal name<input value={name} onChange={e=>setConsent({scope,name:e.target.value,ack})}/></label><label className="checkbox-field"><input type="checkbox" checked={ack} onChange={e=>setConsent({scope,name,ack:e.target.checked})}/> I reviewed this version, full terms, pay and checklist requirements.</label><button className="button primary" disabled={busy || query.loading || !ack || name.trim().length<2} onClick={()=>void sign()}>{busy ? 'Signing…' : 'Accept this version and sign'}</button></>}
  </>}</PageState>{message && <p className="notice" role="status">{message}</p>}</section>;
}
