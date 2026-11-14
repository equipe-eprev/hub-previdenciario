// Uso: node scripts/gerar-alunos.mjs <planilha.csv> [<outra.csv> ...]
// O CSV precisa ter uma coluna de e-mail e uma de documento (CPF/CNPJ), como a exportação da planilha de alunos.
import { readFileSync, writeFileSync } from 'node:fs';
import { pbkdf2Sync } from 'node:crypto';

const SALT = 'eprev-hub-v2:';
const ITERACOES = 100000;
const files = process.argv.slice(2);
if (!files.length) {
  console.error('Informe ao menos um arquivo CSV.');
  process.exit(1);
}

function parseCsv(texto) {
  const delim = (texto.split('\n')[0].match(/;/g) || []).length > (texto.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const linhas = [];
  let campo = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === delim) { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

const normalizarEmail = (e) => e.trim().toLowerCase().replace(/\\_/g, '_');
const normalizarDocumento = (d) => {
  const n = d.replace(/\D/g, '');
  return n.length > 0 && n.length <= 11 ? n.padStart(11, '0') : n;
};
// Precisa bater com normalizarSenha() do index.html.
const normalizarPrimeiroNome = (nome) =>
  nome.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/)[0] || '';

const pares = new Map();
const porNome = [];
const semSenha = [];
for (const f of files) {
  const [cab, ...linhas] = parseCsv(readFileSync(f, 'utf8'));
  const iEmail = cab.findIndex((h) => /mail/i.test(h));
  const iDoc = cab.findIndex((h) => /documento|cpf|cnpj/i.test(h));
  const iNome = cab.findIndex((h) => /nome/i.test(h));
  if (iEmail < 0 || iDoc < 0) {
    console.error(`${f}: não encontrei as colunas de e-mail e documento no cabeçalho.`);
    process.exit(1);
  }
  for (const l of linhas) {
    const email = normalizarEmail(l[iEmail] || '');
    if (!email.includes('@')) continue;
    const doc = normalizarDocumento(l[iDoc] || '');
    if (doc) { pares.set(email, doc); continue; }
    const nome = iNome >= 0 ? normalizarPrimeiroNome(l[iNome] || '') : '';
    if (nome) { pares.set(email, nome); porNome.push(`${email} (senha: ${nome})`); }
    else semSenha.push(email);
  }
}

const hashes = [...pares]
  .map(([email, doc]) => pbkdf2Sync(doc, SALT + email, ITERACOES, 32, 'sha256').toString('hex'))
  .sort();

writeFileSync(
  new URL('../alunos.js', import.meta.url),
  `window.ALUNOS_SALT = ${JSON.stringify(SALT)};\nwindow.ALUNOS_ITERACOES = ${ITERACOES};\nwindow.ALUNOS = new Set(${JSON.stringify(hashes)});\n`
);
console.log(`alunos.js gerado com ${hashes.length} alunos.`);
if (porNome.length) {
  console.log(`\n${porNome.length} aluno(s) sem CPF/CNPJ entram com o primeiro nome:`);
  for (const e of porNome) console.log('  - ' + e);
}
if (semSenha.length) {
  console.log(`\n${semSenha.length} aluno(s) sem documento nem nome (não conseguirão entrar):`);
  for (const e of semSenha) console.log('  - ' + e);
}
