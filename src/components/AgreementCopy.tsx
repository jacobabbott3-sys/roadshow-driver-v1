import type { AgreementContent } from '../lib/agreementTypes';

const workLabels: Record<string,string> = {name:'Work',event_type:'Type',artist:'Artist',venue_name:'Venue',starts_on:'Starts',ends_on:'Ends',city:'City',state:'State',address:'Work address',bin_count:'Bin count',signing_at:'Signing time',setup_at:'Setup time',meals_included:'Meals included',lodging_included:'Lodging included'};
const amount=(value: number|null|undefined) => value == null ? 'Not specified' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
export function AgreementCopy({content}: {content: AgreementContent}) {
  return <div className="agreement-copy">
    <dl>{Object.entries(workLabels).map(([key,label])=>content.work[key]!=null && <div key={key}><dt>{label}</dt><dd>{typeof content.work[key]==='boolean' ? content.work[key] ? 'Yes' : 'No' : String(content.work[key])}</dd></div>)}</dl>
    <p>{content.contract.kind} · {content.contract.service_date}{content.contract.service_time ? ` at ${content.contract.service_time}` : ''}</p>
    <p>Base pay: {amount(content.contract.contract_pay)}</p><p>Potential bonus: {amount(content.contract.bonus_pay)}</p><p>Per diem: {amount(content.work.per_diem as number|null|undefined)}</p>
    <h3>Full agreement terms</h3><p style={{whiteSpace:'pre-wrap'}}>{content.contract.terms || 'Terms not specified.'}</p>
    {content.contract.document_path && <p>Contract document reference: {content.contract.document_path}</p>}
    {!!content.linked_show_ids.length && <section><h3>Linked work included</h3>{content.linked_work?.length ? content.linked_work.map(work=><div key={String(work.id)}><strong>{String(work.name)}</strong><p>{[work.artist,work.venue_name,work.address,work.city,work.state].filter(Boolean).join(' · ')}</p><p>{[work.starts_on,work.ends_on,work.setup_at,work.signing_at].filter(Boolean).join(' · ')}</p></div>) : content.linked_show_ids.map(id=><p key={id}>Linked assignment: {id}</p>)}</section>}
    <h3>Checklist and bonus requirements</h3>
    {!content.checklist.length && <p>No checklist requirements issued.</p>}
    {content.checklist.map(section=><section key={section.id}><h4>{section.title}</h4><ol>{section.items.map(item=><li key={item.id}><strong>{item.title}</strong>{item.instructions && <p style={{whiteSpace:'pre-wrap'}}>{item.instructions}</p>}<p>{item.required ? 'Required' : 'Optional'}{item.photo_required ? ' · Photo required' : ''}</p></li>)}</ol></section>)}
  </div>;
}
