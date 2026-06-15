// Parser de data/hora em linguagem natural (pt-BR) para o agendamento de
// mensagens — "a IA lê" o que o atendente digita. Cobre os casos práticos:
//   "amanhã às 7h", "hoje 15h", "daqui 2 horas", "em 30 min", "segunda às 9h",
//   "25/12 às 10h", "3 de julho às 8h", "18:30", "meio-dia".
// Retorna um Date no fuso local, ou null quando não consegue interpretar.

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

const MONTHS: Record<string, number> = {
  jan: 0, janeiro: 0,
  fev: 1, fevereiro: 1,
  mar: 2, marco: 2,
  abr: 3, abril: 3,
  mai: 4, maio: 4,
  jun: 5, junho: 5,
  jul: 6, julho: 6,
  ago: 7, agosto: 7,
  set: 8, setembro: 8,
  out: 9, outubro: 9,
  nov: 10, novembro: 10,
  dez: 11, dezembro: 11,
};

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function hasWord(s: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`).test(s);
}

export function parseNaturalDate(input: string, now: Date = new Date()): Date | null {
  if (!input) return null;
  const s = stripAccents(input.toLowerCase()).replace(/\s+/g, ' ').trim();
  if (!s) return null;

  // ── 1) Relativo: "daqui (a) X h/min/dias", "em X horas" ────────────────
  const rel = s.match(/(?:daqui(?:\s+a)?|em)\s+(\d+)\s*(min(?:uto)?s?|h(?:ora)?s?|dias?)/);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const unit = rel[2];
    const d = new Date(now);
    if (unit.startsWith('min')) d.setMinutes(d.getMinutes() + n);
    else if (unit.startsWith('h')) d.setHours(d.getHours() + n);
    else d.setDate(d.getDate() + n);
    return d;
  }
  if (hasWord(s, 'meia hora')) {
    const d = new Date(now);
    d.setMinutes(d.getMinutes() + 30);
    return d;
  }
  if (/(daqui(?:\s+a)?|em)\s+(uma|1)\s+hora/.test(s)) {
    const d = new Date(now);
    d.setHours(d.getHours() + 1);
    return d;
  }

  // ── 2) Horário do dia (às HH[:MM][h]) ──────────────────────────────────
  let hour: number | null = null;
  let minute = 0;
  if (/\bmeio[\s-]?dia\b/.test(s)) {
    hour = 12;
  } else if (/\bmeia[\s-]?noite\b/.test(s)) {
    hour = 0;
  } else {
    const t =
      s.match(/(?:as|@)\s*(\d{1,2})(?:[:h](\d{2}))?/) || // "às 7", "às 7:30", "às 7h30"
      s.match(/\b(\d{1,2})[:h](\d{2})\b/) || // "7:30", "19h00"
      s.match(/\b(\d{1,2})\s*h(?:oras?)?\b/); // "7h", "19 horas"
    if (t) {
      hour = parseInt(t[1], 10);
      minute = t[2] ? parseInt(t[2], 10) : 0;
    }
  }
  if (hour !== null && (hour > 23 || minute > 59)) return null;

  // ── 3) Data-base ───────────────────────────────────────────────────────
  let base: Date | null = null;
  let dayExplicit = false;

  // dd/mm[/yyyy]
  const dm = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (dm) {
    const day = parseInt(dm[1], 10);
    const mon = parseInt(dm[2], 10) - 1;
    let year = dm[3] ? parseInt(dm[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;
    base = new Date(now);
    base.setFullYear(year, mon, day);
    dayExplicit = true;
  }

  // "3 de julho"
  if (!base) {
    const dmes = s.match(/\b(\d{1,2})\s+de\s+([a-z]+)/);
    if (dmes && MONTHS[dmes[2]] !== undefined) {
      base = new Date(now);
      base.setMonth(MONTHS[dmes[2]], parseInt(dmes[1], 10));
      dayExplicit = true;
    }
  }

  // relativos de dia
  if (!base) {
    if (/depois de amanha/.test(s)) {
      base = new Date(now);
      base.setDate(base.getDate() + 2);
      dayExplicit = true;
    } else if (hasWord(s, 'amanha')) {
      base = new Date(now);
      base.setDate(base.getDate() + 1);
      dayExplicit = true;
    } else if (hasWord(s, 'hoje')) {
      base = new Date(now);
      dayExplicit = true;
    }
  }

  // dia da semana ("segunda", "sexta que vem", …)
  if (!base) {
    for (const [name, wd] of Object.entries(WEEKDAYS)) {
      if (hasWord(s, name)) {
        base = new Date(now);
        let add = (wd - base.getDay() + 7) % 7;
        if (add === 0) add = 7; // sempre a próxima ocorrência
        base.setDate(base.getDate() + add);
        dayExplicit = true;
        break;
      }
    }
  }

  // só horário, sem dia → hoje (ajusta pra amanhã abaixo se já passou)
  if (!base && hour !== null) base = new Date(now);

  if (!base) return null;

  // ── 4) Aplica horário ──────────────────────────────────────────────────
  if (hour !== null) {
    base.setHours(hour, minute, 0, 0);
  } else {
    base.setHours(9, 0, 0, 0); // dia sem horário → 09:00 padrão
  }

  // ── 5) Passado? ──────────────────────────────────────────────────────
  if (base.getTime() <= now.getTime()) {
    if (dayExplicit) return null; // dia explícito no passado → inválido
    base.setDate(base.getDate() + 1); // só horário → joga pro próximo dia
  }

  return base;
}

/** Formata o Date para preview amigável: "seg, 16/06 às 07:00". */
export function formatScheduledPreview(d: Date): string {
  const data = d.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${data.replace('.', '')} às ${hora}`;
}
