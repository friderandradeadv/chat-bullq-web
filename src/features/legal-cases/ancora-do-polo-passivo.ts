/**
 * QUEM DÁ NOME À AÇÃO, ENTRE OS RÉUS DELA — lado da tela.
 *
 * 🚨 13/11/2026, medido no BRAZ: a ação nasceu com CINCO réus, o título do card
 * dizia `x BANCO SANTANDER (BRASIL) S.A.` e a ficha mostrava
 * `BANCO OLÉ CONSIGNADO S.A.`. Quem escolhia era `parties.find(role ===
 * 'OPPONENT')` — o primeiro que viesse —, e lista sem ordem não promete ordem.
 * Com um réu por ação nunca apareceu; com litisconsórcio, aparece sempre.
 *
 * A âncora se lê do TÍTULO, que nasce do réu escolhido no desmembramento
 * (`ordemDoPoloPassivo`: quem desconta primeiro). Ordem de criação é só
 * desempate.
 *
 * ⚠️ ESTE ARQUIVO É O ESPELHO de `inicial/ancora-do-polo-passivo.ts`, na API.
 * São dois pacotes, sem import entre eles: mudou lá, muda aqui.
 */

export interface ParteDoPolo {
  name: string;
  role?: string | null;
  createdAt?: string | Date | null;
}

/** O sufixo forense, em qualquer caixa. */
const RE_E_OUTROS = /\s+E\s+OUTROS\.?$/i;

const chave = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

/** O que vem depois do PRIMEIRO " x " do título, literal. */
export function reuDoTitulo(title?: string | null): string {
  const t = String(title ?? '');
  const m = /\s+x\s+/i.exec(t);
  // O "E OUTROS" é do nome da AÇÃO, não do banco: sai antes de comparar.
  return m ? t.slice(m.index + m[0].length).replace(RE_E_OUTROS, '').trim() : '';
}

/** Acrescenta " E OUTROS" a um nome que ainda não o tenha. */
export function comOutros(nome: string): string {
  const n = String(nome ?? '').trim();
  return RE_E_OUTROS.test(n) ? n : `${n} E OUTROS`;
}

/**
 * O NOME DO POLO PASSIVO NO PADRÃO FORENSE: "FULANO S/A E OUTROS".
 *
 * 🚨 Ordem do escritório (13/11/2026): *"no cadastro nome tem que ser tipo
 * BANCO SANTANDER S/A e OUTROS, padrão para todos"*. Ação com litisconsorte não
 * se nomeia pelo primeiro réu como se ele fosse o único.
 */
export function nomeDoPoloPassivo<T extends ParteDoPolo>(
  parties: T[] | null | undefined,
  title?: string | null,
): string | null {
  const ancora = ancoraDoPoloPassivo(parties, title);
  if (!ancora) return null;
  return litisconsortesDoPolo(parties, title).length ? comOutros(ancora.name) : ancora.name;
}

export function ancoraDoPoloPassivo<T extends ParteDoPolo>(
  parties: T[] | null | undefined,
  title?: string | null,
): T | null {
  const reus = (parties ?? []).filter((p) => String(p.role ?? '') === 'OPPONENT');
  if (!reus.length) return null;
  const doTitulo = chave(reuDoTitulo(title));
  if (doTitulo) {
    const exato = reus.find((p) => chave(p.name) === doTitulo);
    if (exato) return exato;
    const dentro = reus.find((p) => {
      const k = chave(p.name);
      return k.length > 3 && (doTitulo.includes(k) || k.includes(doTitulo));
    });
    if (dentro) return dentro;
  }
  const comData = reus.filter((p) => p.createdAt);
  if (comData.length === reus.length && reus.length > 1) {
    return [...reus].sort(
      (a, b) => new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime(),
    )[0];
  }
  return reus[0];
}

export function litisconsortesDoPolo<T extends ParteDoPolo>(
  parties: T[] | null | undefined,
  title?: string | null,
): T[] {
  const reus = (parties ?? []).filter((p) => String(p.role ?? '') === 'OPPONENT');
  const ancora = ancoraDoPoloPassivo(reus, title);
  return reus.filter((p) => p !== ancora);
}
