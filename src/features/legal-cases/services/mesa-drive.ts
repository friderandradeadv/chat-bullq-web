/**
 * Mover o arquivo da Mesa para a pasta do cliente, DENTRO do Drive montado.
 *
 * O caminho normal do hub sobe os bytes pela API. Aqui não: no Mac o Drive é
 * uma pasta de verdade, então a peça não precisa dar a volta pela nuvem para
 * mudar de lugar. Ela SAI da Mesa e ENTRA na pasta, numa operação só — sem
 * upload e sem apagar nada. O Google sincroniza depois, sozinho.
 *
 * Quem manda na convenção continua sendo a API (`/drive/:partyId/plano`): qual
 * pasta, que letra, que nome cada arquivo recebe. Este módulo só executa. São
 * dois executores da mesma regra — nunca duas regras.
 *
 * Só existe em Chromium (Opera GX, Chrome) e só com o Drive montado. Onde não
 * houver, o hub continua subindo por upload.
 */

/** A API existe? (File System Access + `move` de arquivo entre pastas.) */
export function suportaMoverNoDisco(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * As duas pastas autorizadas ficam guardadas no IndexedDB.
 *
 * Sem isso o advogado teria de navegar até `01. CLIENTES` no seletor a cada
 * sessão — e o que se pede duas vezes por dia deixa de ser usado. Com o handle
 * guardado, o navegador só pede a confirmação da permissão: um clique.
 */
const DB = 'frider-pastas';
const STORE = 'handles';

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
}

export async function guardarPasta(chave: string, handle: any): Promise<void> {
  try {
    const db = await abrirDb();
    await new Promise((ok, erro) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(handle, chave);
      tx.oncomplete = () => ok(null);
      tx.onerror = () => erro(tx.error);
    });
  } catch {
    /* sem IndexedDB (aba anônima) — só perde a memória da pasta */
  }
}

export async function lerPasta(chave: string): Promise<any | null> {
  try {
    const db = await abrirDb();
    return await new Promise((ok) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(chave);
      req.onsuccess = () => ok(req.result ?? null);
      req.onerror = () => ok(null);
    });
  } catch {
    return null;
  }
}

/**
 * Confirma a permissão de escrita numa pasta já autorizada antes.
 *
 * `queryPermission` não pede nada (serve para saber se ainda vale);
 * `requestPermission` PRECISA de gesto do usuário — por isso só é chamado a
 * partir de um clique, nunca no carregamento da tela.
 */
export async function permissaoDeEscrita(handle: any, pedir: boolean): Promise<boolean> {
  if (!handle?.queryPermission) return true;
  const opts = { mode: 'readwrite' as const };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if (!pedir) return false;
  return (await handle.requestPermission(opts)) === 'granted';
}

const norm = (s: string) => s.normalize('NFC').trim().toLowerCase();

/**
 * Subpasta por nome, tolerante à normalização Unicode.
 *
 * `getDirectoryHandle` compara string crua, e o macOS entrega nome de arquivo
 * em NFD enquanto a API do Drive devolve NFC: "MANIFESTAÇÕES" e "MANIFESTAÇÕES"
 * têm os mesmos caracteres na tela e bytes diferentes. Sem esta tolerância a
 * pasta simplesmente "não existe" — foi assim que uma varredura do acervo achou
 * ZERO cliente sem dar erro nenhum.
 */
async function acharSubpasta(dir: any, nome: string, criar = false): Promise<any> {
  try {
    return await dir.getDirectoryHandle(nome, { create: criar });
  } catch (e: any) {
    if (e?.name !== 'NotFoundError' && !criar) throw e;
  }
  const alvo = norm(nome);
  for await (const [n, h] of dir.entries()) {
    if (h.kind === 'directory' && norm(n) === alvo) return h;
  }
  if (!criar) throw new Error(`Não achei a pasta "${nome}" no Drive montado.`);
  return dir.getDirectoryHandle(nome, { create: true });
}

/** Arquivo por nome, com a mesma tolerância. */
async function acharArquivo(dir: any, nome: string): Promise<any> {
  try {
    return await dir.getFileHandle(nome);
  } catch (e: any) {
    if (e?.name !== 'NotFoundError') throw e;
  }
  const alvo = norm(nome);
  for await (const [n, h] of dir.entries()) {
    if (h.kind === 'file' && norm(n) === alvo) return h;
  }
  throw new Error(`"${nome}" não está mais na Mesa.`);
}

export interface PlanoDeMovimento {
  pastaCliente: string;
  caminho: string[];
  pasta: string;
  arquivos: { de: string; para: string }[];
}

/**
 * Executa o plano: cria a subpasta datada e move cada arquivo da Mesa para lá.
 *
 * Devolve o que moveu e o que ficou. Falha de um arquivo não derruba os outros
 * nem o arquivamento: arquivo aberto no Word, por exemplo, o macOS recusa mover
 * — e é melhor ele ficar na Mesa do que sumir.
 *
 * `subDe` diz em qual SUBPASTA da Mesa cada arquivo está. Desde 21/08/2026 a
 * PROTOCOLO é organizada por cliente (`PROTOCOLO/<CLIENTE>/peça.docx`), e esta
 * função procurava o arquivo só na raiz: dava `"...pdf" não está mais na Mesa`
 * com o arquivo ali, a um nível de distância. Quem lê a Mesa já carrega o `sub`
 * de cada arquivo; sem `subDe` o comportamento é o antigo, só a raiz.
 */
export async function moverParaAPastaDoCliente(
  mesa: any,
  clientes: any,
  plano: PlanoDeMovimento,
  subDe?: (nome: string) => string | null,
): Promise<{ movidos: string[]; ficaram: { nome: string; motivo: string }[] }> {
  const cliente = await acharSubpasta(clientes, plano.pastaCliente);
  let atual = cliente;
  for (const nome of plano.caminho) atual = await acharSubpasta(atual, nome);
  // A subpasta datada é criada AQUI, no disco — a API não cria de propósito.
  // Se as duas criassem, apareceriam duas `c) 20.08.2026`: o Drive aceita duas
  // pastas de mesmo nome sem reclamar.
  const destino = await acharSubpasta(atual, plano.pasta, true);

  const movidos: string[] = [];
  const ficaram: { nome: string; motivo: string }[] = [];

  const subsMexidas = new Set<string>();

  for (const item of plano.arquivos) {
    try {
      const sub = subDe?.(item.de) ?? null;
      const dono = sub ? await acharSubpasta(mesa, sub) : mesa;
      const fh = await acharArquivo(dono, item.de);
      if (typeof fh.move !== 'function')
        throw new Error('este navegador não move arquivo entre pastas');
      // Não sobrescreve: se já existe lá, o arquivo fica na Mesa e você decide.
      let existe = false;
      try {
        await destino.getFileHandle(item.para);
        existe = true;
      } catch {
        /* não existe — é o esperado */
      }
      if (existe) throw new Error(`já existe "${item.para}" na pasta`);
      await fh.move(destino, item.para);
      movidos.push(item.para);
      if (sub) subsMexidas.add(sub);
    } catch (e: any) {
      ficaram.push({ nome: item.de, motivo: e?.message || 'não consegui mover' });
    }
  }

  // Pasta de cliente que ficou vazia é pendência resolvida: sai também, do mesmo
  // modo que no caminho de upload. O que sobra em PROTOCOLO passa a ser, por
  // construção, o que ainda não foi arquivado.
  for (const sub of subsMexidas) {
    try {
      const d = await acharSubpasta(mesa, sub);
      let vazia = true;
      for await (const [nome] of d.entries()) {
        if (nome !== '.DS_Store') {
          vazia = false;
          break;
        }
        await d.removeEntry(nome).catch(() => {});
      }
      if (vazia) await mesa.removeEntry(sub, { recursive: true });
    } catch {
      /* pasta em uso ou já removida — fica, e não atrapalha nada */
    }
  }

  return { movidos, ficaram };
}
