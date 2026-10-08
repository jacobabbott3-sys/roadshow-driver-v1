import { useEffect, useRef, useState } from 'react';
import type { AgreementConfirmationRequest } from '../lib/agreementConfirmation';
import { AgreementCopy } from './AgreementCopy';

export function AgreementConfirmationHost() {
  const [request,setRequest]=useState<AgreementConfirmationRequest|null>(null);
  const [acknowledged,setAcknowledged]=useState(false);
  const pending=useRef<AgreementConfirmationRequest|null>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const receive=(event: Event)=>{
      pending.current?.resolve(false);
      const next=(event as CustomEvent<AgreementConfirmationRequest>).detail;
      pending.current=next; setRequest(next); setAcknowledged(false);
    };
    window.addEventListener('roadshow-agreement-review',receive);
    return ()=>{window.removeEventListener('roadshow-agreement-review',receive);pending.current?.resolve(false);};
  },[]);
  useEffect(()=>{
    if (!request || !dialog.current) return;
    if (typeof dialog.current.showModal==='function') dialog.current.showModal();
    else dialog.current.setAttribute('open','');
  },[request]);
  const close=(confirmed: boolean)=>{pending.current?.resolve(confirmed);pending.current=null;setRequest(null);};
  if (!request) return null;
  return <dialog ref={dialog} role="dialog" aria-modal="true" aria-label={request.title} className="agreement-dialog" onCancel={event=>{event.preventDefault();close(false);}}>
    <h2>{request.title}</h2>
    {request.content && <AgreementCopy content={request.content} />}
    {request.consequences.map(change=><section key={change.contract_id}><h3>{change.work_name}</h3><p>Fresh driver and admin signatures will be required. Earlier accepted copies and checklist progress will be preserved.</p>{change.removed_signer && <p>The accepting driver will be removed and notified in the app. Their historical receipt remains private to them.</p>}<details><summary>Previous agreement</summary><AgreementCopy content={change.before}/></details><details open><summary>Proposed agreement</summary><AgreementCopy content={change.after}/></details></section>)}
    <label className="checkbox-field"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/> I reviewed this agreement and its consequences.</label>
    <div className="admin-actions"><button type="button" className="button" onClick={()=>close(false)}>Cancel</button><button type="button" className="button primary" disabled={!acknowledged} onClick={()=>close(true)}>Confirm</button></div>
  </dialog>;
}
