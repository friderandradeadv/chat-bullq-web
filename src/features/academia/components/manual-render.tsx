'use client';

import { Fragment } from 'react';

/**
 * Render de markdown leve para os manuais da Academia.
 * Suporta: ## e ### (títulos), - (lista), 1. (lista numerada),
 * > (destaque), **negrito** e parágrafo.
 */

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\*\*[^*]+\*\*$/.test(p) ? (
          <strong key={i} className="font-semibold text-zinc-900 dark:text-zinc-50">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

type Bloco =
  | { t: 'h2' | 'h3' | 'p' | 'quote'; texto: string }
  | { t: 'ul' | 'ol'; itens: string[] };

function parse(md: string): Bloco[] {
  const linhas = md.split('\n');
  const blocos: Bloco[] = [];
  let i = 0;

  while (i < linhas.length) {
    const l = linhas[i];

    if (!l.trim()) {
      i++;
      continue;
    }
    if (l.startsWith('### ')) {
      blocos.push({ t: 'h3', texto: l.slice(4) });
      i++;
      continue;
    }
    if (l.startsWith('## ')) {
      blocos.push({ t: 'h2', texto: l.slice(3) });
      i++;
      continue;
    }
    if (l.startsWith('> ')) {
      blocos.push({ t: 'quote', texto: l.slice(2) });
      i++;
      continue;
    }
    if (/^- /.test(l)) {
      const itens: string[] = [];
      while (i < linhas.length && /^- /.test(linhas[i])) {
        itens.push(linhas[i].slice(2));
        i++;
      }
      blocos.push({ t: 'ul', itens });
      continue;
    }
    if (/^\d+\. /.test(l)) {
      const itens: string[] = [];
      while (i < linhas.length && /^\d+\. /.test(linhas[i])) {
        itens.push(linhas[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      blocos.push({ t: 'ol', itens });
      continue;
    }
    blocos.push({ t: 'p', texto: l });
    i++;
  }
  return blocos;
}

export function ManualRender({ md, cor }: { md: string; cor: string }) {
  const blocos = parse(md);
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
      {blocos.map((b, i) => {
        if (b.t === 'h2')
          return (
            <h3
              key={i}
              className="pt-4 text-base font-bold text-zinc-900 dark:text-zinc-50"
              style={{ borderLeft: `3px solid ${cor}`, paddingLeft: 10 }}
            >
              <Inline text={b.texto} />
            </h3>
          );
        if (b.t === 'h3')
          return (
            <h4 key={i} className="pt-2 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <Inline text={b.texto} />
            </h4>
          );
        if (b.t === 'quote')
          return (
            <blockquote
              key={i}
              className="rounded-xl border px-4 py-3 text-[15px]"
              style={{ borderColor: `${cor}55`, background: `${cor}0F` }}
            >
              <Inline text={b.texto} />
            </blockquote>
          );
        if (b.t === 'ul')
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-zinc-400">
              {b.itens.map((it, j) => (
                <li key={j}>
                  <Inline text={it} />
                </li>
              ))}
            </ul>
          );
        if (b.t === 'ol')
          return (
            <ol key={i} className="list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-zinc-400">
              {b.itens.map((it, j) => (
                <li key={j}>
                  <Inline text={it} />
                </li>
              ))}
            </ol>
          );
        if (b.t === 'p')
          return (
            <p key={i}>
              <Inline text={b.texto} />
            </p>
          );
        return null;
      })}
    </div>
  );
}
