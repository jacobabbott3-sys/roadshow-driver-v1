import { Link } from 'react-router-dom';
import { PageState } from '../components/PageState';
import { AgreementCopy } from '../components/AgreementCopy';
import { useAsync } from '../hooks/useAsync';
import { getMyAgreementHistory } from '../lib/agreementData';

export function AgreementHistoryPage() {
  const query=useAsync(getMyAgreementHistory,[]);
  return <main className="page"><header className="page-header"><div><h1>My agreement history</h1><p>Accepted copies remain available after an assignment ends. These receipts do not grant access to current work.</p><Link to="/contracts">Back to contracts</Link></div></header><PageState loading={query.loading} error={query.error} empty={!query.data?.length}>{query.data?.map(receipt=><details className="admin-section" key={receipt.version.id}><summary>{String(receipt.version.content.work.name)} · Version {receipt.version.version_number}</summary><AgreementCopy content={receipt.version.content}/>{receipt.signatures.map(signature=><p key={signature.id}>{signature.signer_role}: {signature.signer_name} · {new Date(signature.signed_at).toLocaleString()}</p>)}</details>)}</PageState></main>;
}
