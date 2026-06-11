'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';

/** Picker de emojis simples (sem dependência externa), com categorias + busca. */
const GROUPS: { label: string; key: string; emojis: string[] }[] = [
  {
    key: 'smileys',
    label: 'Rostos',
    emojis: [
      '😀','😃','😄','😁','😆','😅','😂','🤣','🥲','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤗','🤭','🤫','🤔','🤐','😐','😑','😶','😏','😒','🙄','😬','😮‍💨','😌','😔','😪','😴','😷','🤒','🤕','🤧','🥵','🥶','😵','🤯','🥳','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬',
    ],
  },
  {
    key: 'gestures',
    label: 'Gestos',
    emojis: [
      '👍','👎','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤝','👏','🙌','👐','🤲','🙏','✍️','💪','🦾','👊','✊','🤛','🤜',
    ],
  },
  {
    key: 'hearts',
    label: 'Corações & Símbolos',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','✅','❌','⚠️','❗','❓','💯','🔥','⭐','🌟','✨','🎉','🎊','🥳','🏆','🎁','📌','📎','🔔','🔒','💡',
    ],
  },
  {
    key: 'objects',
    label: 'Objetos & Trabalho',
    emojis: [
      '📄','📃','📑','📊','📈','📉','🗂️','📁','📂','🗒️','📝','✏️','🖊️','🖋️','📅','📆','⏰','⌛','💼','💰','💵','💳','🧾','📱','💻','🖥️','⌨️','🖨️','📞','☎️','📧','✉️','📨','🔗','📍','🏠','🏢','⚖️','🔍',
    ],
  },
  {
    key: 'misc',
    label: 'Diversos',
    emojis: [
      '👋','🙋','🙆','🙅','💁','🤷','🤦','👨‍💼','👩‍💼','👨‍⚖️','👩‍⚖️','🚗','✈️','📍','☕','🍻','🎯','👀','💬','🗣️','🤝','🫶','👑','🙏🏻','😅','😬','🆗','🆕','🔝','▶️','⏳','📲',
    ],
  },
];

export function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    if (!q.trim()) return GROUPS;
    // Sem nomes de emoji aqui — busca só funciona colando o próprio emoji.
    const term = q.trim();
    return GROUPS.map((g) => ({
      ...g,
      emojis: g.emojis.filter((e) => e.includes(term)),
    })).filter((g) => g.emojis.length > 0);
  }, [q]);

  return (
    <>
      {/* backdrop p/ fechar ao clicar fora */}
      <button
        type="button"
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-[55] cursor-default"
      />
      <div className="absolute bottom-full left-2 z-[60] mb-2 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="border-b border-zinc-100 p-2 dark:border-zinc-800">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar emoji…"
              className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-1 pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto p-2 scrollbar-thin">
          {filtered.map((g) => (
            <div key={g.key} className="mb-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                {g.label}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {g.emojis.map((e, i) => (
                  <button
                    key={`${g.key}-${i}`}
                    type="button"
                    onClick={() => onPick(e)}
                    className="rounded p-1 text-lg leading-none transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-[11px] text-zinc-400">Nenhum emoji</p>
          )}
        </div>
      </div>
    </>
  );
}
