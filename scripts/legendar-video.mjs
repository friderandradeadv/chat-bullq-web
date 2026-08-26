/**
 * Gera a legenda .vtt de um vídeo da Academia, a partir do áudio já extraído.
 * RODA NA VPS — é lá que existem o ffmpeg e a GEMINI_API_KEY.
 *
 *   node legendar-video.mjs <audio.ogg> <saida.vtt>
 *
 * Usa o mesmo modelo que o backend usa para transcrever áudio de cliente
 * (gemini-2.5-flash), para não haver dois comportamentos de transcrição no
 * escritório.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , audioPath, vttPath] = process.argv;
if (!audioPath || !vttPath) {
  console.error('uso: node legendar-video.mjs <audio.ogg> <saida.vtt>');
  process.exit(2);
}

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY ausente no ambiente.');
  process.exit(3);
}

const PROMPT = [
  'Transcreva o áudio deste vídeo institucional em português do Brasil e devolva LEGENDA no formato WebVTT.',
  '',
  'REGRAS:',
  '- Comece exatamente com a linha WEBVTT.',
  '- Cada bloco: linha de tempo "HH:MM:SS.mmm --> HH:MM:SS.mmm" e abaixo o texto.',
  '- No máximo 2 linhas por bloco e no máximo 42 caracteres por linha.',
  '- Blocos de 2 a 5 segundos, quebrando em pausa natural da fala.',
  '- Transcreva o que foi DITO, sem resumir, sem corrigir e sem inventar.',
  '- Não use rótulo de locutor.',
  '- Não escreva mais nada além do WebVTT.',
  '',
  // Sem isto o transcritor troca nome próprio por palavra comum: ele ouviu
  // "Claude" e escreveu "Cloud" nas duas transcrições, mesmo com o vídeo
  // instruído a dizer Claude. Nome próprio do escritório vai listado.
  'GRAFIA OBRIGATÓRIA destes nomes, mesmo que o áudio soe diferente:',
  'Claude (nunca "Cloud"), Kanban (nunca "Camba"), card / cards (nunca "cartório" —',
  'no hub, "card" é o cartão do kanban; "cartório" só se o áudio falar de tabelionato),',
  'Frider Andrade, hub, DJEN, RMC, RCC,',
  'HISCON, HISCRE, PJe, e-SAJ, Projudi, eproc, ZapSign, Gemini, WhatsApp, OAB, CPC, CNJ,',
  'INSS, LGPD, alvará, astreinte, sucumbência, preclusão.',
].join('\n');

const body = {
  contents: [
    {
      role: 'user',
      parts: [
        { text: PROMPT },
        { inlineData: { mimeType: 'audio/ogg', data: readFileSync(audioPath).toString('base64') } },
      ],
    },
  ],
  generationConfig: { temperature: 0 },
};

const url =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' +
  apiKey;

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

if (!res.ok) {
  console.error(`Gemini respondeu ${res.status}: ${(await res.text()).slice(0, 400)}`);
  process.exit(4);
}

const data = await res.json();
let vtt = (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();

// O modelo às vezes embrulha em cerca de código. Tira.
vtt = vtt.replace(/^```(?:vtt|webvtt)?\s*/i, '').replace(/```\s*$/i, '').trim();

/**
 * O Gemini erra o formato do timestamp na metade do arquivo: escreve
 * "02:12:700" (MM:SS:mmm) em vez de "00:02:12.700" (HH:MM:SS.mmm). O navegador
 * DESCARTA as deixas invalidas sem avisar — a legenda some no meio do video e
 * parece que "funcionou pela metade". Normaliza e, no fim, exige que TODAS as
 * deixas estejam validas.
 */
function normalizarTempo(t) {
  const p = t.trim().split(':');
  let h = '00', m, s, ms;
  if (p.length === 4) [h, m, s, ms] = p;                 // HH:MM:SS:mmm
  else if (p.length === 3 && p[2].includes('.')) {       // HH:MM:SS.mmm (ja ok)
    [h, m] = p; [s, ms] = p[2].split('.');
  } else if (p.length === 3) [m, s, ms] = p;             // MM:SS:mmm
  else if (p.length === 2) {                             // MM:SS.mmm
    m = p[0]; [s, ms] = p[1].split('.');
  } else return null;
  if ([h, m, s, ms].some((x) => x === undefined || !/^\d+$/.test(x))) return null;
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}.${ms.padEnd(3, '0').slice(0, 3)}`;
}

let naoNormalizadas = 0;
vtt = vtt
  .split('\n')
  .map((linha) => {
    if (!linha.includes('-->')) return linha;
    const [a, b] = linha.split('-->');
    const ini = normalizarTempo(a);
    const fim = normalizarTempo((b.trim().split(/\s+/)[0] ?? b));
    if (!ini || !fim) { naoNormalizadas++; return linha; }
    return `${ini} --> ${fim}`;
  })
  .join('\n');

if (naoNormalizadas > 0) {
  console.error(`${naoNormalizadas} deixa(s) com tempo que nao consegui normalizar — nao gravo legenda quebrada.`);
  process.exit(6);
}

// VALIDACAO SEMANTICA — formato valido nao basta.
// Em 25/08 o Gemini emitiu "01:01:11.000" num video de 3:28: formato impecavel,
// valor absurdo. A deixa anterior ficava eternamente na tela e as seguintes
// nunca apareciam. O navegador nao reclama; a legenda simplesmente morre no meio.
// Aconteceu em 2 dos 6 videos ja publicados, e passou batido pela checagem antiga.
const emSegundos = (t) => {
  const [h, m, r] = t.split(':');
  const [s, ms] = r.split('.');
  return +h * 3600 + +m * 60 + +s + +ms / 1000;
};
const linhas = vtt.split('\n');
const idxDeixas = linhas.map((l, i) => (l.includes('-->') ? i : -1)).filter((i) => i >= 0);

// Conserto do padrao conhecido: hora espuria. Se zerar a hora de TODAS as deixas
// torna a sequencia coerente, o tempo real era esse. So aplico se resolver de fato.
const problemas = (linhasDeixa) => {
  const p = [];
  let anterior = -1;
  linhasDeixa.forEach((l, n) => {
    const [a, b] = l.split('-->').map((x) => x.trim().split(/\s+/)[0]);
    const ini = emSegundos(a);
    const fim = emSegundos(b);
    if (fim <= ini) p.push(`#${n + 1} termina antes de comecar (${a} -> ${b})`);
    if (ini < anterior) p.push(`#${n + 1} volta no tempo (${a} depois de ${b})`);
    if (fim - ini > 15) p.push(`#${n + 1} dura ${Math.round(fim - ini)}s (${a} -> ${b})`);
    anterior = fim;
  });
  return p;
};

let deixas = idxDeixas.map((i) => linhas[i]);
if (problemas(deixas).length > 0) {
  const zeradas = deixas.map((l) => l.replace(/(^|> )\d\d:/g, '$100:'));
  if (problemas(zeradas).length === 0) {
    console.warn('⚠️  hora espuria nos timestamps do Gemini — zerei a hora e a sequencia fechou.');
    idxDeixas.forEach((i, n) => { linhas[i] = zeradas[n]; });
    deixas = zeradas;
    vtt = linhas.join('\n');
  }
}

const restantes = problemas(deixas);
if (restantes.length > 0) {
  console.error('Timestamps incoerentes — nao gravo legenda que morre no meio:');
  restantes.slice(0, 8).forEach((p) => console.error('  ' + p));
  if (restantes.length > 8) console.error(`  ... e mais ${restantes.length - 8}`);
  process.exit(7);
}
console.log(`⏱️  ${deixas.length} deixas coerentes, termina em ${(emSegundos(deixas[deixas.length - 1].split('-->')[1].trim().split(/\s+/)[0]) / 60).toFixed(2)} min.`);

if (!vtt.startsWith('WEBVTT')) {
  // Sem o cabeçalho o navegador ignora a faixa inteira, calado. Melhor falhar aqui.
  console.error('A resposta não começa com WEBVTT — não vou gravar um .vtt inválido.');
  console.error(vtt.slice(0, 300));
  process.exit(5);
}

// Ultima trava: toda deixa tem que casar com o formato estrito do WebVTT.
const RE = /^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}$/;
const cues = vtt.split('\n').filter((l) => l.includes('-->'));
const ruins = cues.filter((l) => !RE.test(l.trim()));
if (ruins.length) {
  console.error(`${ruins.length} de ${cues.length} deixas fora do formato. Exemplo: ${ruins[0].trim()}`);
  process.exit(7);
}

const blocos = cues.length;
writeFileSync(vttPath, vtt + '\n');
console.log(`vtt gravado: ${vttPath} (${blocos} blocos)`);
