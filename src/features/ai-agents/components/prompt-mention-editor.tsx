'use client';

/**
 * Editor de prompt estilo LíderHub: contenteditable com fonte legível,
 * onde digitar `@` abre um menu HIERÁRQUICO (categorias com contagem →
 * itens), buscável. As menções viram chips coloridos inline. Serializa de
 * volta pra texto puro (`@Label`) — é isso que o systemPrompt armazena.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, ChevronLeft, Search } from 'lucide-react';

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

function textToHtml(text: string, lookup: Map<string, MentionType>): string {
  if (!text) return '';
  const labels = [...lookup.keys()].sort((a, b) => b.length - a.length);
  return text
    .split('\n')
    .map((line) => {
      let html = '';
      let i = 0;
      while (i < line.length) {
        if (line[i] === '@') {
          const rest = line.slice(i + 1);
          const match = labels.find((l) => rest.startsWith(l));
          if (match) {
            html += chipHtml(lookup.get(match)!, match);
            i += 1 + match.length;
            continue;
          }
        }
        html += escapeHtml(line[i]);
        i += 1;
      }
      return html;
    })
    .join('<br>');
}

function htmlToText(root: HTMLElement): string {
  let out = '';
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent ?? '';
      } else if (child instanceof HTMLElement) {
        if (child.dataset.mention === '1') {
          out += '@' + (child.dataset.label ?? child.textContent?.replace(/^@/, '') ?? '');
        } else if (child.tagName === 'BR') {
          out += '\n';
        } else if (child.tagName === 'DIV' || child.tagName === 'P') {
          if (out && !out.endsWith('\n')) out += '\n';
          walk(child);
          if (!out.endsWith('\n')) out += '\n';
        } else {
          walk(child);
        }
      }
    });
  };
  walk(root);
  return out.replace(/\n$/, '');
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  groups: MentionGroup[];
  placeholder?: string;
}

export function PromptMentionEditor({ value, onChange, groups, placeholder }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastTextRef = useRef<string>('');
  const [menu, setMenu] = useState<{ top: number; left: number; query: string } | null>(null);
  const [openCat, setOpenCat] = useState<MentionType | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const lookup = useMemo(() => {
    const m = new Map<string, MentionType>();
    for (const g of groups) for (const it of g.items) m.set(it.label, it.type);
    return m;
  }, [groups]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value !== lastTextRef.current) {
      el.innerHTML = textToHtml(value, lookup) || '';
      lastTextRef.current = value;
    }
  }, [value, lookup]);

  // Lista visível no dropdown: categorias (nível 1) OU itens (busca / categoria aberta).
  type Row =
    | { kind: 'cat'; group: MentionGroup }
    | { kind: 'item'; item: MentionItem };

  const rows: Row[] = useMemo(() => {
    if (!menu) return [];
    const q = menu.query.toLowerCase();
    if (q) {
      const res: Row[] = [];
      for (const g of groups)
        for (const it of g.items)
          if (it.label.toLowerCase().includes(q)) res.push({ kind: 'item', item: it });
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

  const catTitle = openCat ? groups.find((g) => g.type === openCat)?.title : null;

  return (
    <div className="relative">
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
          if (!['Enter', 'Tab', 'ArrowDown', 'ArrowUp', 'Escape', 'Backspace'].includes(e.key))
            detectMention();
        }}
        onMouseUp={detectMention}
        onBlur={() => setTimeout(() => setMenu(null), 150)}
        data-placeholder={placeholder ?? 'Escreva as instruções do agente… digite @ para inserir ferramentas, status, etiquetas…'}
        className="prompt-editor min-h-[55vh] w-full whitespace-pre-wrap break-words rounded-xl border border-zinc-300 bg-white px-5 py-4 text-[15px] leading-7 text-zinc-800 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />

      {menu && rows.length > 0 && (
        <div
          className="absolute z-50 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-800"
          style={{ top: menu.top, left: Math.min(menu.left, 420) }}
        >
          {(openCat && !menu.query) && (
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
                  <span className="truncate font-medium text-zinc-800 dark:text-zinc-100">{it.label}</span>
                  {menu.query && (
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-zinc-400">{it.type}</span>
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
        .prompt-editor .inline-quote {
          color: rgb(13 148 136);
        }
      `}</style>
    </div>
  );
}
