'use client';

/**
 * Editor de prompt estilo LíderHub: contenteditable com "INSTRUÇÕES GERAIS",
 * onde digitar `@` abre um menu buscável de ferramentas/status/etiquetas/
 * departamentos/responsáveis/mensagens rápidas/variáveis. As menções viram
 * chips coloridos inline (mention-tag). Serializa de volta pra texto puro
 * (`@Label`) — é isso que o systemPrompt do agente armazena.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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

const TYPE_META: Record<
  MentionType,
  { emoji: string; chip: string }
> = {
  tool: {
    emoji: '🛠️',
    chip:
      'bg-blue-100 text-blue-700 ring-blue-300/60 dark:bg-blue-900/40 dark:text-blue-300',
  },
  status: {
    emoji: '🟢',
    chip:
      'bg-emerald-100 text-emerald-700 ring-emerald-300/60 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  etiqueta: {
    emoji: '🏷️',
    chip:
      'bg-amber-100 text-amber-700 ring-amber-300/60 dark:bg-amber-900/40 dark:text-amber-300',
  },
  departamento: {
    emoji: '🏢',
    chip:
      'bg-violet-100 text-violet-700 ring-violet-300/60 dark:bg-violet-900/40 dark:text-violet-300',
  },
  responsavel: {
    emoji: '👤',
    chip:
      'bg-pink-100 text-pink-700 ring-pink-300/60 dark:bg-pink-900/40 dark:text-pink-300',
  },
  mensagem: {
    emoji: '💬',
    chip:
      'bg-cyan-100 text-cyan-700 ring-cyan-300/60 dark:bg-cyan-900/40 dark:text-cyan-300',
  },
  variavel: {
    emoji: '🔖',
    chip:
      'bg-zinc-200 text-zinc-700 ring-zinc-300/60 dark:bg-zinc-700 dark:text-zinc-200',
  },
};

const CHIP_BASE =
  'mention-tag inline-block rounded-md px-1.5 py-0.5 text-[13px] font-medium ring-1 align-baseline whitespace-nowrap';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function chipHtml(type: MentionType, label: string): string {
  const meta = TYPE_META[type] ?? TYPE_META.tool;
  return `<span class="${CHIP_BASE} ${meta.chip}" contenteditable="false" data-mention="1" data-type="${type}" data-label="${escapeHtml(
    label,
  )}">@${escapeHtml(label)}</span>`;
}

/** texto puro (com tokens @Label) -> HTML com chips, casando labels conhecidos. */
function textToHtml(text: string, lookup: Map<string, MentionType>): string {
  if (!text) return '';
  // labels mais longos primeiro pra casar o nome completo (ex: "Maria Jullia Pepato")
  const labels = [...lookup.keys()].sort((a, b) => b.length - a.length);
  const lines = text.split('\n');
  return lines
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

/** contenteditable DOM -> texto puro (chips viram @Label, <br>/<div> viram \n). */
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

export function PromptMentionEditor({
  value,
  onChange,
  groups,
  placeholder,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastTextRef = useRef<string>('');
  const [menu, setMenu] = useState<{
    top: number;
    left: number;
    query: string;
  } | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const lookup = useMemo(() => {
    const m = new Map<string, MentionType>();
    for (const g of groups) for (const it of g.items) m.set(it.label, it.type);
    return m;
  }, [groups]);

  // (Re)render quando o valor muda por fora (carga inicial / reset).
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value !== lastTextRef.current) {
      el.innerHTML = textToHtml(value, lookup) || '';
      lastTextRef.current = value;
    }
  }, [value, lookup]);

  const flatItems = useMemo(() => {
    if (!menu) return [];
    const q = menu.query.toLowerCase();
    const res: MentionItem[] = [];
    for (const g of groups) {
      for (const it of g.items) {
        if (!q || it.label.toLowerCase().includes(q)) res.push(it);
      }
    }
    return res.slice(0, 40);
  }, [menu, groups]);

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
    if (!m) return setMenu(null);
    // não dispara se o @ está logo após uma palavra colada (email etc.)
    const before = textBefore.slice(0, textBefore.length - m[0].length);
    if (before && /[\p{L}\p{N}]$/u.test(before)) return setMenu(null);
    const rect = range.getBoundingClientRect();
    const host = editorRef.current!.getBoundingClientRect();
    setMenu({
      top: rect.bottom - host.top + 4,
      left: rect.left - host.left,
      query: m[1].trim(),
    });
    setActiveIdx(0);
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
      // apaga o "@query" digitado
      const delRange = document.createRange();
      delRange.setStart(node, offset - m[0].length);
      delRange.setEnd(node, offset);
      delRange.deleteContents();

      // monta o chip + espaço
      const tmp = document.createElement('div');
      tmp.innerHTML = chipHtml(item.type, item.label);
      const chip = tmp.firstChild as HTMLElement;
      const space = document.createTextNode(' ');
      delRange.insertNode(space);
      delRange.insertNode(chip);

      // cursor depois do espaço
      const after = document.createRange();
      after.setStartAfter(space);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);

      setMenu(null);
      emit();
    },
    [emit],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!menu) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (flatItems[activeIdx]) {
        e.preventDefault();
        insertMention(flatItems[activeIdx]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMenu(null);
    }
  };

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
          if (!['Enter', 'Tab', 'ArrowDown', 'ArrowUp', 'Escape'].includes(e.key))
            detectMention();
        }}
        onMouseUp={detectMention}
        onBlur={() => setTimeout(() => setMenu(null), 150)}
        data-placeholder={placeholder ?? 'Escreva as instruções do agente… digite @ para inserir ferramentas, status, etiquetas…'}
        className="prompt-editor min-h-[55vh] w-full whitespace-pre-wrap break-words rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm leading-relaxed text-zinc-800 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />

      {menu && flatItems.length > 0 && (
        <div
          className="absolute z-50 max-h-72 w-80 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-2xl dark:border-zinc-700 dark:bg-zinc-800"
          style={{ top: menu.top, left: Math.min(menu.left, 360) }}
        >
          {flatItems.map((it, idx) => (
            <button
              key={it.type + it.label}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(it);
              }}
              onMouseEnter={() => setActiveIdx(idx)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                idx === activeIdx
                  ? 'bg-zinc-100 dark:bg-zinc-700'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50'
              }`}
            >
              <span className="text-xs">{TYPE_META[it.type].emoji}</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-100">
                {it.label}
              </span>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-zinc-400">
                {it.type}
              </span>
            </button>
          ))}
        </div>
      )}

      <style jsx global>{`
        .prompt-editor:empty:before {
          content: attr(data-placeholder);
          color: rgb(161 161 170);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
