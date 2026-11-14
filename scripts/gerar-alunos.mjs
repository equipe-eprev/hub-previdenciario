// Uso: node scripts/gerar-alunos.mjs <arquivo-com-emails> [<outro-arquivo> ...]
// Aceita .txt ou .csv: qualquer e-mail encontrado no texto entra na lista.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const SALT = 'eprev-hub-v1:';
const files = process.argv.slice(2);
if (!files.length) {
  console.error('Informe ao menos um arquivo com e-mails.');
  process.exit(1);
}

const emails = new Set();
for (const f of files) {
  const found = readFileSync(f, 'utf8').match(/[^\s,;<>"'@]+@[^\s,;<>"'@]+\.[^\s,;<>"'@]+/g) || [];
  for (const e of found) emails.add(e.trim().toLowerCase().replace(/\\_/g, '_'));
}

const hashes = [...emails]
  .map((e) => createHash('sha256').update(SALT + e).digest('hex'))
  .sort();

writeFileSync(
  new URL('../alunos.js', import.meta.url),
  `window.ALUNOS_SALT = ${JSON.stringify(SALT)};\nwindow.ALUNOS = new Set(${JSON.stringify(hashes, null, 0)});\n`
);
console.log(`alunos.js gerado com ${hashes.length} e-mails.`);
