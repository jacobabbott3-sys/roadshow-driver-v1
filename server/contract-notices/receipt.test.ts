import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateReceipt } from './receipt.ts';
test('receipt preserves accepted terms, exact signatures, document reference and final line over multiple pages', () => {
 const terms = 'First exact line: déjà vu.\n' + Array.from({length:105}, (_,i)=>`Another distinct line ${i+1}`).join('\n') + '\nLast exact line: (done).';
 const originals={contract:{terms,document_path:'private/signed-reference.pdf'},work:{name:'São Paulo'},checklist:[{items:[{title:'Load booth'}]}]};
 const signatures=[{id:'driver-acceptance-id',role:'driver',name:'José D’Ávila',signedAt:'2026-11-20T21:23:00Z'},{id:'admin-acceptance-id',role:'admin',name:'Renée',signedAt:'2026-11-20T20:23:00Z'}];
 const payload=generateReceipt(originals,'7',signatures), pdf=atob(payload);
 assert.equal(generateReceipt(originals,'7',signatures),payload);
 assert.match(pdf,/\/Count 3 /);
 const printable=Array.from(pdf.matchAll(/<([0-9a-f]*)> Tj/g),([,hex])=>new TextDecoder('windows-1252').decode(Uint8Array.from(hex.match(/../g)??[],byte=>parseInt(byte,16)))).join('\n');
 for(const expected of ['Version: 7','driver: José D’Ávila','admin: Renée','2026-11-20T21:23:00Z','driver-acceptance-id','admin-acceptance-id',terms,'Signed document reference (not attached): private/signed-reference.pdf','title: Load booth']) assert.ok(printable.includes(expected),expected);
 assert.throws(()=>generateReceipt({terms:'unsupported: 🦊'},'7',signatures),/unavailable/);
});
