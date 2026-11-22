// ISO 32000 PDF with a standard Courier Type 1 font + WinAnsiEncoding.
// Unsupported glyphs fail rather than producing a lossy signed receipt.
const extra = '€\u0000‚ƒ„…†‡ˆ‰Š‹Œ\u0000Ž\u0000\u0000‘’“”•–—˜™š›œ\u0000žŸ';
function winAnsi(value: string) {
  return Array.from(value, char => {
    const code = char.codePointAt(0)!;
    const extended = char === '\u0000' ? -1 : extra.indexOf(char);
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) return code;
    if (extended >= 0) return 128 + extended;
    throw new Error('Signed receipt contains a character unavailable in the receipt font.');
  });
}
function records(value: unknown, depth = 0): string[] {
  if (depth > 12) throw new Error('Invalid receipt structure.');
  if (Array.isArray(value)) return value.length ? value.flatMap((item, index) => [`${index + 1}.`, ...records(item, depth + 1)]) : ['(none)'];
  if (value !== null && typeof value === 'object') return Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).flatMap(([key, field]) => {
    if (key === 'document_path') return [field == null ? 'Signed document reference: none' : `Signed document reference (not attached): ${String(field)}`];
    const label = key.replaceAll('_', ' ');
    return typeof field === 'object' && field !== null ? [`${label}:`, ...records(field, depth + 1)] : [`${label}: ${field === null ? '(not specified)' : String(field)}`];
  });
  return [value == null ? '(not specified)' : String(value)];
}
export function generateReceipt(contents: unknown, version: string, signatures: ReadonlyArray<{id:string;role:string;name:string;signedAt:string}>, evidence?: {contractId:string;versionId:string}) {
  const heading = ['Roadshow Driver | Signed agreement receipt', `Version: ${version}`, ...(evidence ? [`Contract ID: ${evidence.contractId}`, `Version ID: ${evidence.versionId}`] : []), '', 'Recorded signatures',
    ...signatures.flatMap(s => [`${s.role}: ${s.name}`, `Signed at: ${s.signedAt}`, `Acceptance ID: ${s.id}`]), '', 'Immutable signed agreement contents'];
  const source = JSON.stringify(contents);
  if (!source || source.length > 100_000) throw new Error('Signed receipt exceeds supported size.');
  const lines = [...heading, ...records(contents)].flatMap(line => line.split(/\r\n|\r|\n/).flatMap(part => {
    const bytes = winAnsi(part.replaceAll('\t', '    '));
    const output = [];
    for (let i = 0; i < Math.max(1, bytes.length); i += 76) output.push(bytes.slice(i, i + 76).map(byte => byte.toString(16).padStart(2,'0')).join(''));
    return output;
  }));
  if (lines.length > 2400) throw new Error('Signed receipt exceeds page limit.');
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += 50) pages.push(lines.slice(i, i + 50));
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${4+2*i} 0 R`).join(' ')}] >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'];
  for (const [i, page] of pages.entries()) {
    const stream = `BT /F1 10 Tf 42 750 Td 14 TL\n${page.map(line => `<${line}> Tj T*`).join('\n')}\nET\n`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+2*i} 0 R >>`, `<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  }
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [i, object] of objects.entries()) { offsets.push(pdf.length); pdf += `${i+1} 0 obj\n${object}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return btoa(pdf);
}
