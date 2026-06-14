'use client';

/**
 * Editor de prompt estilo LíderHub: contenteditable WYSIWYG com barra de
 * formatação (negrito, itálico, código, títulos, listas, citação) e controle
 * de fonte de leitura. Digitar `@` abre um menu HIERÁRQUICO (categorias com
 * contagem → itens), buscável; as menções viram chips coloridos inline.
 *
 * IMPORTANTE — serialização: o que sai daqui (e fica salvo em systemPrompt) é
 * **Markdown + `@Label`**, NÃO HTML. Markdown porque é isso que o Claude lê
 * nativamente — um prompt estruturado (**negrito**, `## título`, `- lista`)
 * melhora a aderência às instruções. A escolha de fonte é só conforto visual
 * de edição (display-only); não afeta o texto enviado ao modelo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Search,
  Bold,
  Italic,
  Code,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Type,
} from 'lucide-react';

export type MentionType =
  | 'tool'
  | 'status'
  | 'etiqueta'
  | 'departamento'
  | 'responsavel'
  | 'mensagem'
  | 'variavel';

export interface MentionItem {
  type: MentionType;
  label: string;
  hint?: string;
}

export interface MentionGroup {
  type: MentionType;
  title: string;
  items: MentionItem[];
}

const TYPE_META: Record<MentionType, { emoji: string; chip: string }> = {
  tool: { emoji: '🛠️', chip: 'bg-blue-100 text-blue-700 ring-blue-300/60 dark:bg-blue-900/40 dark:text-blue-300' },
  status: { emoji: '🟢', chip: 'bg-emerald-100 text-emerald-700 ring-emerald-300/60 dark:bg-emerald-900/40 dark:text-emerald-300' },
  etiqueta: { emoji: '🏷️', chip: 'bg-amber-100 text-amber-700 ring-amber-300/60 dark:bg-amber-900/40 dark:text-amber-300' },
  departamento: { emoji: '🏢', chip: 'bg-violet-100 text-violet-700 ring-violet-300/60 dark:bg-violet-900/40 dark:text-violet-300' },
  responsavel: { emoji: '👤', chip: 'bg-pink-100 text-pink-700 ring-pink-300/60 dark:bg-pink-900/40 dark:text-pink-300' },
  mensagem: { emoji: '💬', chip: 'bg-cyan-100 text-cyan-700 ring-cyan-300/60 dark:bg-cyan-900/40 dark:text-cyan-300' },
  variavel: { emoji: '🔖', chip: 'bg-zinc-200 text-zinc-700 ring-zinc-300/60 dark:bg-zinc-700 dark:text-zinc-200' },
};

const CHIP_BASE =
  'mention-tag inline-block rounded-md px-1.5 py-0.5 text-[13px] font-medium ring-1 align-baseline whitespace-nowrap';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function chipHtml(type: MentionType, label: string): string {
  const meta = TYPE_META[type] ?? TYPE_META.tool;
  return `<span class="${CHIP_BASE} ${meta.chip}" contenteditable="false" data-mention="1" data-type="${type}" data-label="${escapeHtml(
    label,
  )}">@${escapeHtml(label)}</span>`;
}

// ── Markdown inline → HTML (negrito/itálico/código + chips de @menção) ──────
function inlineToHtml(line: string, labels: string[], lookup: Map<string, MentionType>): string {
  let out = '';
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '@') {
      const rest = line.slice(i + 1);
      const match = labels.find((l) => rest.startsWith(l));
      if (match) {
        out += chipHtml(lookup.get(match)!, match);
        i += 1 + match.length;
        continue;
      }
    }
    if (line.startsWith('**', i)) {
      const close = line.indexOf('**', i + 2);
      if (close !== -1) {
        out += '<strong>' + inlineToHtml(line.slice(i + 2, close), labels, lookup) + '</strong>';
        i = close + 2;
        continue;
      }
    }
    if (ch === '*') {
      const close = line.indexOf('*', i + 1);
      if (close > i + 1) {
        out += '<em>' + inlineToHtml(line.slice(i + 1, close), labels, lookup) + '</em>';
        i = close + 1;
        continue;
      }
    }
    if (ch === '`') {
      const close = line.indexOf('`', i + 1);
      if (close !== -1) {
        out += '<code>' + escapeHtml(line.slice(i + 1, close)) + '</code>';
        i = close + 1;
        continue;
      }
    }
    out += escapeHtml(ch);
    i += 1;
  }
  return out;
}

// ── Markdown (texto salvo) → HTML (o que o contenteditable mostra) ──────────
function textToHtml(text: string, lookup: Map<string, MentionType>): string {
  if (!text) return '';
  const labels = [...lookup.keys()].sort((a, b) => b.length - a.length);
  const lines = text.split('\n');
  let html = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      html += `<h${lvl}>${inlineToHtml(h[2], labels, lookup)}</h${lvl}>`;
      i += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(inlineToHtml(lines[i].replace(/^>\s?/, ''), labels, lookup));
        i += 1;
      }
      html += `<blockquote>${buf.join('<br>')}</blockquote>`;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        buf.push(`<li>${inlineToHtml(lines[i].replace(/^[-*]\s+/, ''), labels, lookup)}</li>`);
        i += 1;
      }
      html += `<ul>${buf.join('')}</ul>`;
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        buf.push(`<li>${inlineToHtml(lines[i].replace(/^\d+\.\s+/, ''), labels, lookup)}</li>`);
        i += 1;
      }
      html += `<ol>${buf.join('')}</ol>`;
      continue;
    }
    if (line === '') {
      html += '<div><br></div>';
      i += 1;
      continue;
    }
    html += `<div>${inlineToHtml(line, labels, lookup)}</div>`;
    i += 1;
  }
  return html;
}

// ── HTML (contenteditable) → Markdown (texto salvo) ─────────────────────────
function isBold(el: HTMLElement): boolean {
  return el.tagName === 'B' || el.tagName === 'STRONG' || /font-weight:\s*(bold|[6-9]00)/.test(el.getAttribute('style') ?? '');
}
function isItalic(el: HTMLElement): boolean {
  return el.tagName === 'I' || el.tagName === 'EM' || /font-style:\s*italic/.test(el.getAttribute('style') ?? '');
}

function inlineStr(el: HTMLElement): string {
  let s = '';
  el.childNodes.forEach((c) => {
    if (c.nodeType === Node.TEXT_NODE) {
      s += c.textContent ?? '';
    } else if (c instanceof HTMLElement) {
      if (c.dataset.mention === '1') s += '@' + (c.dataset.label ?? c.textContent?.replace(/^@/, '') ?? '');
      else if (c.tagName === 'BR') s += '\n';
      else if (c.tagName === 'CODE') s += '`' + (c.textContent ?? '') + '`';
      else if (isBold(c)) s += '**' + inlineStr(c) + '**';
      else if (isItalic(c)) s += '*' + inlineStr(c) + '*';
      else s += inlineStr(c);
    }
  });
  return s;
}

function htmlToText(root: HTMLElement): string {
  let out = '';
  const ensureNL = () => {
    if (out && !out.endsWith('\n')) out += '\n';
  };
  const hasBlockChild = (el: HTMLElement) =>
    [...el.childNodes].some((n) => n instanceof HTMLElement && /^(H[1-3]|UL|OL|BLOCKQUOTE|DIV|P)$/.test(n.tagName));

  const walk = (node: Node) => {
    node.childNodes.forEach((c) => {
      if (c.nodeType === Node.TEXT_NODE) {
        out += c.textContent ?? '';
        return;
      }
      if (!(c instanceof HTMLElement)) return;
      const tag = c.tagName;
      if (c.dataset.mention === '1') {
        out += '@' + (c.dataset.label ?? c.textContent?.replace(/^@/, '') ?? '');
        return;
      }
      if (tag === 'BR') {
        out += '\n';
        return;
      }
      if (/^H[1-3]$/.test(tag)) {
        ensureNL();
        out += '#'.repeat(Number(tag[1])) + ' ' + inlineStr(c) + '\n';
        return;
      }
      if (tag === 'UL') {
        ensureNL();
        c.childNodes.forEach((li) => {
          if (li instanceof HTMLElement && li.tagName === 'LI') out += '- ' + inlineStr(li) + '\n';
        });
        return;
      }
      if (tag === 'OL') {
        ensureNL();
        let n = 1;
        c.childNodes.forEach((li) => {
          if (li instanceof HTMLElement && li.tagName === 'LI') out += `${n++}. ` + inlineStr(li) + '\n';
        });
        return;
      }
      if (tag === 'BLOCKQUOTE') {
        ensureNL();
        inlineStr(c)
          .split('\n')
          .forEach((l) => (out += '> ' + l + '\n'));
        return;
      }
      if (tag === 'DIV' || tag === 'P') {
        ensureNL();
        if (hasBlockChild(c)) walk(c);
        else out += inlineStr(c);
        if (!out.endsWith('\n')) out += '\n';
        return;
      }
      if (tag === 'CODE') {
        out += '`' + (c.textContent ?? '') + '`';
        return;
      }
      if (isBold(c)) {
        out += '**' + inlineStr(c) + '**';
        return;
      }
      if (isItalic(c)) {
        out += '*' + inlineStr(c) + '*';
        return;
      }
      out += inlineStr(c);
    });
  };
  walk(root);
  return out.replace(/^\n+/, '').replace(/\n+$/, '').replace(/\n{3,}/g, '\n\n');
}

// ── Fontes de leitura (display-only; não vai pro modelo) ────────────────────
const FONTS: { id: string; label: string; css: string }[] = [
  { id: 'sans', label: 'Padrão', css: '' },
  { id: 'serif', label: 'Serifada', css: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'Monoespaçada', css: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
];
const SIZE_MIN = 13;
const SIZE_MAX = 20;

interface Props {
  value: string;
  onChange: (v: string) => void;
  groups: MentionGroup[];
  placeholder?: string;
}

export function PromptMentionEditor({ value, onChange, groups, placeholder }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastTextRef = useRef<string>('');
  const lastLookupRef = useRef<Map<string, MentionType> | null>(null);
  const [menu, setMenu] = useState<{ top: number; left: number; query: string } | null>(null);
  const [openCat, setOpenCat] = useState<MentionType | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Preferências de leitura (persistidas localmente — só conforto visual).
  const [fontId, setFontId] = useState('sans');
  const [fontSize, setFontSize] = useState(15);
  const [fontMenu, setFontMenu] = useState(false);

  useEffect(() => {
    try {
      const f = localStorage.getItem('bullq-prompt-font');
      const s = localStorage.getItem('bullq-prompt-size');
      if (f && FONTS.some((x) => x.id === f)) setFontId(f);
      if (s) setFontSize(Math.min(SIZE_MAX, Math.max(SIZE_MIN, Number(s) || 15)));
    } catch {
      /* localStorage indisponível — ignora */
    }
  }, []);
  const setFont = (id: string) => {
    setFontId(id);
    try {
      localStorage.setItem('bullq-prompt-font', id);
    } catch {
      /* noop */
    }
  };
  const bumpSize = (delta: number) => {
    setFontSize((s) => {
      const next = Math.min(SIZE_MAX, Math.max(SIZE_MIN, s + delta));
      try {
        localStorage.setItem('bullq-prompt-size', String(next));
      } catch {
        /* noop */
      }
      return next;
    });
  };
  const fontCss = FONTS.find((f) => f.id === fontId)?.css || undefined;

  const lookup = useMemo(() => {
    const m = new Map<string, MentionType>();
    for (const g of groups) for (const it of g.items) m.set(it.label, it.type);
    return m;
  }, [groups]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const valueChanged = value !== lastTextRef.current;
    // Quando os labels de @ chegam async (ex: as tools do backend), `lookup`
    // muda mas `value` não — sem isso os `@tool` ficavam texto puro em vez de
    // virar chip. Re-renderiza nesse caso, mas só se o editor não estiver em
    // foco, pra não atropelar o cursor de quem está digitando.
    const lookupChanged = lastLookupRef.current !== lookup;
    if (valueChanged || (lookupChanged && document.activeElement !== el)) {
      el.innerHTML = textToHtml(value, lookup) || '';
      lastTextRef.current = value;
    }
    lastLookupRef.current = lookup;
  }, [value, lookup]);

  // Lista visível no dropdown: categorias (nível 1) OU itens (busca / categoria aberta).
  type Row = { kind: 'cat'; group: MentionGroup } | { kind: 'item'; item: MentionItem };

  const rows: Row[] = useMemo(() => {
    if (!menu) return [];
    const q = menu.query.toLowerCase();
    if (q) {
      const res: Row[] = [];
      for (const g of groups)
        for (const it of g.items) if (it.label.toLowerCase().includes(q)) res.push({ kind: 'item', item: it });
      return res.slice(0, 50);
    }
    if (openCat) {
      const g = groups.find((g) => g.type === openCat);
      return (g?.items ?? []).map((it) => ({ kind: 'item' as const, item: it }));
    }
    return groups.filter((g) => g.items.length > 0).map((g) => ({ kind: 'cat' as const, group: g }));
  }, [menu, groups, openCat]);

  useEffect(() => setActiveIdx(0), [openCat, menu?.query]);

  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const text = htmlToText(el);
    lastTextRef.current = text;
    onChange(text);
  }, [onChange]);

  // ── Barra de formatação (WYSIWYG → serializa em Markdown no emit) ─────────
  const exec = useCallback(
    (cmd: string, arg?: string) => {
      editorRef.current?.focus();
      try {
        document.execCommand('styleWithCSS', false, 'false');
      } catch {
        /* noop */
      }
      document.execCommand(cmd, false, arg);
      emit();
    },
    [emit],
  );

  const wrapCode = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const text = range.toString();
    range.deleteContents();
    const code = document.createElement('code');
    code.textContent = text;
    range.insertNode(code);
    const after = document.createRange();
    after.setStartAfter(code);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    emit();
  }, [emit]);

  const detectMention = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return setMenu(null);
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return setMenu(null);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return setMenu(null);
    const textBefore = (node.textContent ?? '').slice(0, range.startOffset);
    const m = textBefore.match(/@([\p{L}\p{N}\s/]{0,30})$/u);
    if (!m) {
      setMenu(null);
      return;
    }
    const before = textBefore.slice(0, textBefore.length - m[0].length);
    if (before && /[\p{L}\p{N}]$/u.test(before)) return setMenu(null);
    const rect = range.getBoundingClientRect();
    const host = editorRef.current!.getBoundingClientRect();
    setMenu({ top: rect.bottom - host.top + 4, left: rect.left - host.left, query: m[1].trim() });
    if (!m[1].trim()) setOpenCat(null);
  }, []);

  const insertMention = useCallback(
    (item: MentionItem) => {
      const el = editorRef.current;
      const sel = window.getSelection();
      if (!el || !sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType !== Node.TEXT_NODE) return;
      const offset = range.startOffset;
      const textBefore = (node.textContent ?? '').slice(0, offset);
      const m = textBefore.match(/@([\p{L}\p{N}\s/]{0,30})$/u);
      if (!m) return;
      const delRange = document.createRange();
      delRange.setStart(node, offset - m[0].length);
      delRange.setEnd(node, offset);
      delRange.deleteContents();
      const tmp = document.createElement('div');
      tmp.innerHTML = chipHtml(item.type, item.label);
      const chip = tmp.firstChild as HTMLElement;
      const space = document.createTextNode(' ');
      delRange.insertNode(space);
      delRange.insertNode(chip);
      const after = document.createRange();
      after.setStartAfter(space);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
      setMenu(null);
      setOpenCat(null);
      emit();
    },
    [emit],
  );

  const activateRow = (row: Row) => {
    if (row.kind === 'cat') setOpenCat(row.group.type);
    else insertMention(row.item);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Atalhos de formatação (funcionam mesmo sem o menu @ aberto).
    if ((e.metaKey || e.ctrlKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        exec('bold');
        return;
      }
      if (k === 'i') {
        e.preventDefault();
        exec('italic');
        return;
      }
    }
    if (!menu) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (rows[activeIdx]) {
        e.preventDefault();
        activateRow(rows[activeIdx]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (openCat) setOpenCat(null);
      else setMenu(null);
    } else if (e.key === 'Backspace' && openCat && !menu.query) {
      // volta pras categorias sem apagar texto
      e.preventDefault();
      setOpenCat(null);
    }
  };

  // Cola sempre como texto puro — evita HTML estranho de outras fontes e mantém
  // a serialização previsível (Markdown + @Label).
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const catTitle = openCat ? groups.find((g) => g.type === openCat)?.title : null;

  const TbBtn = ({
    onClick,
    title,
    children,
  }: {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
    >
      {children}
    </button>
  );

  return (
    <div className="relative">
      {/* Barra de formatação */}
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-xl border border-b-0 border-zinc-300 bg-zinc-50 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900/60">
        <TbBtn onClick={() => exec('bold')} title="Negrito (Ctrl/Cmd+B)">
          <Bold className="h-4 w-4" />
        </TbBtn>
        <TbBtn onClick={() => exec('italic')} title="Itálico (Ctrl/Cmd+I)">
          <Italic className="h-4 w-4" />
        </TbBtn>
        <TbBtn onClick={wrapCode} title="Código">
          <Code className="h-4 w-4" />
        </TbBtn>
        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
        <TbBtn onClick={() => exec('formatBlock', '<h2>')} title="Título de seção">
          <Heading2 className="h-4 w-4" />
        </TbBtn>
        <TbBtn onClick={() => exec('insertUnorderedList')} title="Lista">
          <List className="h-4 w-4" />
        </TbBtn>
        <TbBtn onClick={() => exec('insertOrderedList')} title="Lista numerada">
          <ListOrdered className="h-4 w-4" />
        </TbBtn>
        <TbBtn onClick={() => exec('formatBlock', '<blockquote>')} title="Citação / destaque">
          <Quote className="h-4 w-4" />
        </TbBtn>

        {/* Controle de fonte (só leitura/conforto visual) */}
        <div className="relative ml-auto">
          <button
            type="button"
            title="Fonte de leitura (não afeta o que a IA recebe)"
            onMouseDown={(e) => {
              e.preventDefault();
              setFontMenu((v) => !v);
            }}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
          >
            <Type className="h-4 w-4" /> {FONTS.find((f) => f.id === fontId)?.label}
            <ChevronRight className={`h-3 w-3 transition-transform ${fontMenu ? 'rotate-90' : ''}`} />
          </button>
          {fontMenu && (
            <div
              className="absolute right-0 z-50 mt-1 w-52 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
              onMouseDown={(e) => e.preventDefault()}
            >
              <p className="px-1.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Fonte</p>
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFont(f.id)}
                  style={{ fontFamily: f.css || undefined }}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                    fontId === f.id ? 'bg-zinc-100 dark:bg-zinc-700' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50'
                  }`}
                >
                  {f.label}
                  {fontId === f.id && <span className="text-primary">✓</span>}
                </button>
              ))}
              <div className="mt-1 flex items-center justify-between border-t border-zinc-100 px-1.5 pt-2 dark:border-zinc-700">
                <span className="text-[11px] text-zinc-500">Tamanho</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => bumpSize(-1)}
                    className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    A−
                  </button>
                  <span className="w-7 text-center font-mono text-xs text-zinc-500">{fontSize}</span>
                  <button
                    type="button"
                    onClick={() => bumpSize(1)}
                    className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    A+
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onInput={() => {
          emit();
          detectMention();
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => {
          if (!['Enter', 'Tab', 'ArrowDown', 'ArrowUp', 'Escape', 'Backspace'].includes(e.key)) detectMention();
        }}
        onMouseUp={detectMention}
        onPaste={onPaste}
        onBlur={() => setTimeout(() => setMenu(null), 150)}
        style={{ fontFamily: fontCss, fontSize: `${fontSize}px` }}
        data-placeholder={placeholder ?? 'Escreva as instruções do agente… digite @ para inserir ferramentas, status, etiquetas…'}
        className="prompt-editor min-h-[55vh] w-full whitespace-pre-wrap break-words rounded-b-xl border border-zinc-300 bg-white px-5 py-4 leading-7 text-zinc-800 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />

      {menu && rows.length > 0 && (
        <div
          className="absolute z-50 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-800"
          style={{ top: menu.top, left: Math.min(menu.left, 420) }}
        >
          {openCat && !menu.query && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setOpenCat(null);
              }}
              className="flex w-full items-center gap-1.5 border-b border-zinc-100 px-3 py-2 text-left text-xs font-medium text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-700/50"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> {catTitle}
            </button>
          )}
          {menu.query && (
            <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 text-xs text-zinc-400 dark:border-zinc-700">
              <Search className="h-3.5 w-3.5" /> Buscando “{menu.query}”
            </div>
          )}
          <div className="max-h-80 overflow-y-auto py-1">
            {rows.map((row, idx) => {
              const active = idx === activeIdx;
              if (row.kind === 'cat') {
                const g = row.group;
                return (
                  <button
                    key={'cat-' + g.type}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setOpenCat(g.type);
                    }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${
                      active ? 'bg-zinc-100 dark:bg-zinc-700' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50'
                    }`}
                  >
                    <span>{TYPE_META[g.type].emoji}</span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-100">{g.title}</span>
                    <span className="ml-1 text-xs text-zinc-400">({g.items.length})</span>
                    <ChevronRight className="ml-auto h-4 w-4 text-zinc-400" />
                  </button>
                );
              }
              const it = row.item;
              return (
                <button
                  key={'item-' + it.type + it.label}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(it);
                  }}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm ${
                    active ? 'bg-zinc-100 dark:bg-zinc-700' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50'
                  }`}
                >
                  <span className="text-xs">{TYPE_META[it.type].emoji}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-zinc-800 dark:text-zinc-100">{it.label}</span>
                    {it.hint && (
                      <span className="truncate text-[11px] text-zinc-400">{it.hint}</span>
                    )}
                  </span>
                  {menu.query && (
                    <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-zinc-400">{it.type}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style jsx global>{`
        .prompt-editor:empty:before {
          content: attr(data-placeholder);
          color: rgb(161 161 170);
          pointer-events: none;
        }
        .prompt-editor h1 {
          font-size: 1.5em;
          font-weight: 700;
          margin: 0.4em 0 0.2em;
        }
        .prompt-editor h2 {
          font-size: 1.25em;
          font-weight: 700;
          margin: 0.4em 0 0.2em;
        }
        .prompt-editor h3 {
          font-size: 1.1em;
          font-weight: 600;
          margin: 0.3em 0 0.15em;
        }
        .prompt-editor ul {
          list-style: disc;
          padding-left: 1.4em;
          margin: 0.25em 0;
        }
        .prompt-editor ol {
          list-style: decimal;
          padding-left: 1.5em;
          margin: 0.25em 0;
        }
        .prompt-editor blockquote {
          border-left: 3px solid rgb(212 212 216);
          padding-left: 0.8em;
          margin: 0.3em 0;
          color: rgb(113 113 122);
        }
        .dark .prompt-editor blockquote {
          border-left-color: rgb(63 63 70);
          color: rgb(161 161 170);
        }
        .prompt-editor code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 0.9em;
          background: rgb(244 244 245);
          border-radius: 4px;
          padding: 0.05em 0.35em;
        }
        .dark .prompt-editor code {
          background: rgb(39 39 42);
        }
        .prompt-editor .inline-quote {
          color: rgb(13 148 136);
        }
      `}</style>
    </div>
  );
}
