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

if (!vtt.startsWith('WEBVTT')) {
  // Sem o cabeçalho o navegador ignora a faixa inteira, calado. Melhor falhar aqui.
  console.error('A resposta não começa com WEBVTT — não vou gravar um .vtt inválido.');
  console.error(vtt.slice(0, 300));
  process.exit(5);
}

const blocos = (vtt.match(/-->/g) || []).length;
writeFileSync(vttPath, vtt + '\n');
console.log(`vtt gravado: ${vttPath} (${blocos} blocos)`);
