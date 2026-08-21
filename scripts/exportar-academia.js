const fs = require('fs');
const path = require('path');

const { TRILHAS, TOTAL_AULAS, TOTAL_MINUTOS, promptCompleto } = require(process.argv[2]);
const DEST = process.argv[3];

// Nome de arquivo seguro para Drive/Finder (dois-pontos vira travessão).
const seguro = (s) => s.replace(/:/g, ' —').replace(/[\\/]/g, '-');

const dirFontes = path.join(DEST, '01. FONTES PARA O NOTEBOOKLM');
fs.mkdirSync(dirFontes, { recursive: true });

// ── Uma fonte .md por trilha (é o que se sobe no NotebookLM) ─────────────────
TRILHAS.forEach((t, ti) => {
  const linhas = [];
  linhas.push(`# ${t.titulo}`);
  linhas.push('');
  linhas.push(`_${t.subtitulo}_`);
  linhas.push('');
  linhas.push(`**Para quem é:** ${t.publico}`);
  linhas.push('');
  linhas.push(`**Escritório:** Frider Andrade | Advogados — Maringá/PR`);
  linhas.push('');
  linhas.push('---');
  t.aulas.forEach((a, ai) => {
    linhas.push('');
    linhas.push(`# ${ti + 1}.${ai + 1} ${a.titulo}`);
    linhas.push('');
    linhas.push(`_${a.resumo}_`);
    linhas.push('');
    linhas.push(a.manual);
    if (a.checklist && a.checklist.length) {
      linhas.push('');
      linhas.push('## Você consegue fazer sozinho');
      linhas.push('');
      a.checklist.forEach((c) => linhas.push(`- ${c}`));
    }
    linhas.push('');
    linhas.push('---');
  });
  const nome = seguro(`${String(ti + 1).padStart(2, '0')}. ${t.titulo}.md`);
  fs.writeFileSync(path.join(dirFontes, nome), linhas.join('\n') + '\n');
});

// ── Documento único com todos os prompts ────────────────────────────────────
const p = [];
p.push('# Prompts para gerar os vídeos no NotebookLM');
p.push('');
p.push('Frider Andrade | Advogados — Academia interna');
p.push('');
p.push('## Como usar');
p.push('');
p.push('1. Abra o **NotebookLM** e crie um caderno novo **por trilha** (8 cadernos no total).');
p.push('2. Em **Fontes**, suba o arquivo `.md` daquela trilha, que está na pasta `01. FONTES PARA O NOTEBOOKLM`.');
p.push('   Suba também, no mesmo caderno, os documentos institucionais que fizerem sentido:');
p.push('   Regimento Interno, Missão Visão e Valores, Manual do Associado e Manual da Fase Judicial.');
p.push('3. Vá em **Video Overview** (Resumo em vídeo) e escolha **Personalizar**.');
p.push('4. Cole o prompt da aula correspondente, que está abaixo.');
p.push('5. Gere, assista inteiro e confira: nome do escritório correto ("Frider Andrade - Advogados", nunca "Advocacia"),');
p.push('   nenhuma promessa de resultado, e todo texto que aparece na tela em português — o modelo traduz a fala e esquece a arte.');
p.push('6. Baixe o vídeo e envie ao responsável pelo hub para publicar na Academia.');
p.push('');
p.push('> Regra fixa de todos os vídeos: idioma português do Brasil, e nunca prometer resultado processual (art. 41 do Código de Ética da OAB).');
p.push('');
p.push('---');
p.push('');

let n = 0;
TRILHAS.forEach((t, ti) => {
  p.push('');
  p.push(`# Caderno ${ti + 1} — ${t.titulo}`);
  p.push('');
  p.push(`**Fonte a subir:** \`01. FONTES PARA O NOTEBOOKLM/${seguro(String(ti + 1).padStart(2, '0') + '. ' + t.titulo + '.md')}\``);
  p.push('');
  p.push(`**Público da trilha:** ${t.publico}`);
  p.push('');
  t.aulas.forEach((a, ai) => {
    if (!a.promptVideo) return;
    n++;
    p.push('');
    p.push(`## Vídeo ${n} — ${a.titulo}`);
    p.push('');
    p.push(`Aula ${ti + 1}.${ai + 1} · duração alvo compatível com ${a.minutos} min de aula`);
    p.push('');
    p.push('```');
    p.push(promptCompleto(a));
    p.push('```');
    p.push('');
  });
  p.push('---');
});

p.push('');
p.push(`_Total: ${n} vídeos, cobrindo ${TOTAL_AULAS} aulas e cerca de ${Math.round(TOTAL_MINUTOS / 60)} horas de conteúdo escrito._`);
fs.writeFileSync(path.join(DEST, '02. PROMPTS DOS VIDEOS (NotebookLM).md'), p.join('\n') + '\n');

console.log('trilhas:', TRILHAS.length, '| aulas:', TOTAL_AULAS, '| prompts:', n, '| minutos:', TOTAL_MINUTOS);

// ── LEIA-ME ─────────────────────────────────────────────────────────────────
const leia = [
  '# Academia Frider — pacote de produção',
  '',
  'Este é o material escrito da **Academia**, a biblioteca de treinamento que fica dentro do',
  'hub, em **hub.friderandrade.com.br/academia**.',
  '',
  '## O que tem aqui',
  '',
  '- `01. FONTES PARA O NOTEBOOKLM/` — um arquivo por trilha, com o manual completo de cada aula.',
  '  É o que se sobe no NotebookLM para gerar os vídeos. Serve também como apostila para imprimir.',
  '- `02. PROMPTS DOS VIDEOS (NotebookLM).md` — o prompt pronto de cada vídeo, com o que dizer,',
  '  em que ordem, e o que nunca dizer.',
  '',
  '## A regra da fonte única',
  '',
  'O texto destes arquivos é **gerado a partir do conteúdo que está no hub**. Se você editar aqui,',
  'o hub não muda. Para corrigir um manual, corrija na Academia (no código do hub) e gere estes',
  'arquivos de novo — assim os dois nunca divergem.',
  '',
  '## Publicar um vídeo na Academia',
  '',
  'Depois de gerar o vídeo no NotebookLM, mande o arquivo para quem cuida do hub. O vídeo é',
  'publicado de duas formas possíveis:',
  '',
  '1. **Google Drive** — sobe na pasta de tutoriais e a aula aponta para o arquivo (o time assiste',
  '   logado com a conta do escritório).',
  '2. **Servidor do escritório** — o arquivo vai para o armazenamento do hub e a aula aponta para a',
  '   URL direta. É o caminho mais confortável para quem assiste no celular.',
  '',
  '## Conferência obrigatória antes de publicar',
  '',
  '- [ ] O nome sai como **Frider Andrade - Advogados** (nunca "Advocacia").',
  '- [ ] Nenhuma promessa de resultado processual (art. 41 do Código de Ética da OAB).',
  '- [ ] Todo texto que aparece na tela está em português — sem rótulo solto em inglês.',
  '- [ ] Nenhum dado real de cliente aparece ou é citado.',
  '- [ ] O áudio está em português do Brasil e o vídeo foi assistido inteiro por uma pessoa.',
  '',
  '## O acervo antigo',
  '',
  'As gravações de 2024 e 2025 continuam na pasta `01. ESCRITÓRIO`, como histórico. Onde uma delas',
  'contradisser uma aula da Academia, **vale a Academia**.',
];
fs.writeFileSync(path.join(DEST, '00. LEIA-ME.md'), leia.join('\n') + '\n');
