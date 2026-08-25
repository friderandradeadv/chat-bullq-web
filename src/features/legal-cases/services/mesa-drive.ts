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

/**
 * Lixo que o sistema cria sozinho e que NÃO conta como conteúdo da pasta.
 * O `.DS_Store` existe em toda pasta que o Finder abriu — e o advogado abre a
 * PROTOCOLO justamente para conferir o que arquivou.
 */
const lixoDoSistema = (nome: string) =>
  nome === '.DS_Store' ||
  nome === '.localized' ||
  nome === 'Thumbs.db' ||
  nome.startsWith('._') ||
  nome.startsWith('Icon');

/**
 * Remove as subpastas de cliente que ficaram vazias depois do arquivamento.
 *
 * A pasta `PROTOCOLO/<CLIENTE>/` é embalagem: saindo as peças, ela vira sujeira
 * que finge pendência. Sai junto — o que sobra em PROTOCOLO passa a ser, por
 * construção, o que ainda não foi arquivado.
 *
 * A lista de nomes é lida INTEIRA antes de apagar qualquer coisa. Apagar dentro
 * do `for await (… of d.entries())` derruba o iterador no Chromium, e era isso
 * que deixava a pasta do cliente na Mesa depois de os arquivos saírem: a exceção
 * morria num `catch` mudo e ninguém via. Quem apaga o `.DS_Store` é o
 * `recursive: true` da remoção da própria pasta, não uma passada à parte.
 */
export async function removerSubpastasVazias(
  mesa: any,
  subs: Iterable<string>,
): Promise<{ removidas: string[]; ficaram: { sub: string; motivo: string }[] }> {
  const removidas: string[] = [];
  const ficaram: { sub: string; motivo: string }[] = [];
  for (const sub of subs) {
    try {
      const d = await acharSubpasta(mesa, sub);
      const nomes: string[] = [];
      for await (const [nome] of d.entries()) nomes.push(nome);
      const sobra = nomes.filter((n) => !lixoDoSistema(n));
      if (sobra.length) {
        ficaram.push({ sub, motivo: `ainda tem ${sobra.length} arquivo(s) dentro` });
        continue;
      }
      // `removeEntry` compara o nome cru, e o macOS entrega NFD onde a leitura
      // pode ter trazido NFC: pega o nome como o disco escreve, não como veio.
      const alvo = norm(sub);
      let real = sub;
      for await (const [n, h] of mesa.entries()) {
        if (h.kind === 'directory' && norm(n) === alvo) { real = n; break; }
      }
      await mesa.removeEntry(real, { recursive: true });
      removidas.push(sub);
    } catch (e: any) {
      ficaram.push({ sub, motivo: e?.message || 'não consegui remover a pasta' });
    }
  }
  return { removidas, ficaram };
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
 *
 * `subDe` recebe o ÍNDICE, não o nome. O plano vem do servidor na mesma ordem
 * da lista da tela (a numeração é feita com um `map`, um para um), então o
 * índice casa item a item. Pelo nome não casava: dois clientes podem ter
 * `01. MANIFESTACAO.pdf` na pasta de trabalho, e a busca por nome devolvia
 * sempre a primeira ocorrência — o arquivo do cliente errado.
 */
export async function moverParaAPastaDoCliente(
  mesa: any,
  clientes: any,
  plano: PlanoDeMovimento,
  subDe?: (indice: number, nome: string) => string | null,
): Promise<{
  movidos: string[];
  ficaram: { nome: string; motivo: string }[];
  pastas: { removidas: string[]; ficaram: { sub: string; motivo: string }[] };
}> {
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

  for (const [indice, item] of plano.arquivos.entries()) {
    try {
      const sub = subDe?.(indice, item.de) ?? null;
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
  // modo que no caminho de upload.
  const pastas = await removerSubpastasVazias(mesa, subsMexidas);

  return { movidos, ficaram, pastas };
}
