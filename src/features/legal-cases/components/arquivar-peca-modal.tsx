'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stamp, Upload, FileText, ArrowUp, ArrowDown, X, Loader2, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import {
  driveBrowserService,
  type FaseNoDrive,
} from '@/features/legal-cases/services/drive-browser.service';
import { activitiesService } from '@/features/activities/services/activities.service';
import {
  suportaMoverNoDisco,
  moverParaAPastaDoCliente,
  guardarPasta,
  lerPasta,
  permissaoDeEscrita,
} from '@/features/legal-cases/services/mesa-drive';

/**
 * Arquivar peça protocolada — a porta do pós-protocolo, com duas entradas.
 *
 * Da FICHA do cliente (`partyId`): o advogado escolhe a fase.
 * Da AGENDA (`atividade`): a tarefa/prazo já sabe de que processo é, logo de que
 * cliente é e — pela ação do DJEN — que fase o ato costuma ocupar. Ele confirma.
 *
 * O que sai é sempre a convenção do escritório, não uma escolha de tela:
 *
 *     05. MANIFESTAÇÕES INTERMEDIÁRIAS/c) 20.08.2026/
 *         01. MANIFESTACAO.pdf     <- PDFs na ORDEM DO PROTOCOLO, numerados
 *         02. SENTENCA.pdf
 *         MANIFESTACAO.docx        <- o editável, sem número
 *
 * É a mesma regra do `arquivar_peca.py`, que arquiva pela Mesa. As duas portas
 * têm de escrever igual, senão a padronização do acervo se desfaz pelo uso.
 */

/**
 * A Mesa (Desktop do Mac), quando o navegador deixa.
 *
 * Página web não mexe em arquivo do computador — é o navegador que não deixa, e
 * com razão. A File System Access API abre a única fresta: o advogado autoriza
 * pastas específicas, explicitamente, e a partir daí a página trabalha DENTRO
 * delas. Só existe em Chromium (Opera GX, Chrome).
 *
 * Autorizadas a Mesa e a `01. CLIENTES`, a peça não precisa dar a volta pela
 * nuvem para mudar de lugar: ela SAI da Mesa e ENTRA na pasta do cliente, numa
 * operação só, sem upload e sem apagar. O Google sincroniza depois.
 *
 * Sem uma das duas pastas — ou fora do Chromium — o hub sobe os bytes como
 * sempre, e o original fica onde está.
 */
/**
 * Um arquivo na pasta de trabalho. `sub` é a subpasta do cliente — desde
 * 21/08/2026 a peça não fica solta em PROTOCOLO, vai para `PROTOCOLO/<CLIENTE>/`,
 * porque três prazos no mesmo dia viram doze arquivos misturados na raiz.
 */
type ArquivoDaMesa = { nome: string; file: File; mtime: number; sub: string | null };

/**
 * Um item do protocolo. Pode vir dos ANEXOS da própria tarefa — que o advogado
 * já juntou ao trabalhar o prazo, e que estão no servidor — ou de um arquivo
 * escolhido agora (da Mesa ou do seletor). A lista é uma só porque a NUMERAÇÃO
 * depende da ordem, e a ordem é entre todos eles, não dentro de cada grupo.
 */
type ItemProtocolo =
  | { kind: 'anexo'; id: string; nome: string }
  | { kind: 'file'; file: File; nome: string; daMesa: boolean };

/** Normalização para casar nome de cliente com nome de pasta. */
const chave = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const suportaMesa = () =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

/** Data de hoje no formato do escritório. */
export function hojeDDMMAAAA() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export interface ResultadoArquivamento {
  pasta: string;
  caminho: string[];
  /** Só existe no caminho de upload — movendo no disco, a nuvem ainda não sabe. */
  webViewLink?: string;
  arquivos: string[];
}

export function ArquivarPecaModal({
  partyId,
  atividade,
  titulo = 'Arquivar peça protocolada',
  rotuloConfirmar = 'Arquivar',
  onFechar,
  onPronto,
}: {
  partyId?: string;
  atividade?: { entityType: 'task' | 'deadline'; entityId: string };
  titulo?: string;
  rotuloConfirmar?: string;
  onFechar: () => void;
  onPronto: (r: ResultadoArquivamento, partyId: string) => void;
}) {
  const [faseSel, setFaseSel] = useState<string>('');
  const [tocou, setTocou] = useState(false); // o advogado já mexeu no select?
  const [data, setData] = useState(hojeDDMMAAAA());
  const [itens, setItens] = useState<ItemProtocolo[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  // As duas pastas autorizadas: de onde o arquivo sai e para onde ele vai.
  const [mesa, setMesa] = useState<any>(null);
  // Nome da pasta que o advogado autorizou. Nem sempre é a Mesa: o Chromium
  // recusa as pastas que ficam DIRETO na home (Desktop, Documents, Downloads —
  // "contém arquivos do sistema"), então na prática se autoriza uma subpasta.
  const mesaNome = mesa?.name ?? 'pasta';
  const [clientesDir, setClientesDir] = useState<any>(null);
  const [listaMesa, setListaMesa] = useState<ArquivoDaMesa[] | null>(null);

  // Handles guardados de sessões anteriores — a permissão em si só volta com um
  // clique (o navegador exige gesto), mas o caminho o hub já sabe.
  useEffect(() => {
    if (!suportaMoverNoDisco()) return;
    (async () => {
      const [m, c] = await Promise.all([lerPasta('mesa'), lerPasta('clientes')]);
      // Permissão ainda de pé: lê a Mesa SOZINHO, sem esperar clique. É o que
      // permite reconhecer que o anexo da tarefa é o mesmo arquivo que está na
      // Mesa — e que portanto ele pode mudar de lugar em vez de ficar lá.
      if (m && (await permissaoDeEscrita(m, false))) {
        setMesa(m);
        // Pasta renomeada ou apagada desde a última vez: o handle segue
        // "autorizado" e não lê mais nada. Esquecer é melhor que ficar com uma
        // permissão que aponta para o vazio — assim o bloco de autorizar volta.
        listarMesa(m).catch(() => {
          setMesa(null);
          setListaMesa(null);
        });
      }
      if (c && (await permissaoDeEscrita(c, false))) setClientesDir(c);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Da agenda: o servidor resolve cliente + fases + sugestão numa chamada só.
  const ctx = useQuery({
    queryKey: ['drive-por-atividade', atividade?.entityType, atividade?.entityId],
    queryFn: () => driveBrowserService.porAtividade(atividade!.entityType, atividade!.entityId),
    enabled: !!atividade,
    // SEMPRE fresco. A pasta do cliente muda fora do hub — o advogado cria a
    // pasta do produto no Drive e abre o modal em seguida. Guardar essa lista
    // por um minuto significa oferecer a árvore de um minuto atrás, e foi o que
    // fez uma pasta criada às 01:16 não aparecer às 01:17.
    staleTime: 0,
    gcTime: 0,
  });

  /**
   * Os anexos que já estão na tarefa entram JÁ MARCADOS, na ordem em que foram
   * juntados. É o caminho natural: quem trabalhou o prazo anexou a petição e os
   * comprovantes ali; arquivar é levar aqueles, não escolher de novo.
   */
  const anexosQ = useQuery({
    queryKey: ['activity-anexos', atividade?.entityType, atividade?.entityId],
    queryFn: () => activitiesService.listAnexos(atividade!.entityType, atividade!.entityId),
    enabled: !!atividade,
    staleTime: 0,
  });
  const [semeou, setSemeou] = useState(false);
  const [semeouPasta, setSemeouPasta] = useState(false);
  // Vindo da Mesa, o arquivo pode fazer as duas coisas de uma vez: virar anexo
  // do prazo (o registro do que foi protocolado) e mudar de lugar para a pasta
  // do cliente. Uma coisa não substitui a outra — o anexo prova, a pasta arquiva.
  const [anexarNaTarefa, setAnexarNaTarefa] = useState(true);
  // Plano B quando o navegador recusa a pasta do Drive (ver `podeLimpar`).
  const [limparMesa, setLimparMesa] = useState(true);
  useEffect(() => {
    if (semeou || !anexosQ.data?.length) return;
    // SOMA, não substitui: os arquivos da pasta de trabalho podem ter entrado
    // antes (vêm do disco, que é mais rápido que a rede) e sobrescrever aqui
    // apagaria a lista deles.
    setItens((atuais) => [
      ...atuais,
      ...anexosQ.data
        .filter((a) => !atuais.some((i) => i.nome === a.name))
        .map((a) => ({ kind: 'anexo' as const, id: a.id, nome: a.name })),
    ]);
    setSemeou(true);
  }, [anexosQ.data, semeou]);

  /**
   * Tudo que está na pasta de trabalho já entra na lista.
   *
   * A pasta se chama ARQUIVAR e existe para isso — pedir que o advogado clique
   * arquivo por arquivo numa lista que ele mesmo montou é trabalho inventado. O
   * que não for para arquivar, ele tira no X.
   *
   * Entram ordenados por NOME, não por data: `01. …`, `02. …` é a ordem do
   * protocolo, e é dela que sai a numeração.
   */
  useEffect(() => {
    if (semeouPasta || !listaMesa?.length) return;
    // Sabendo de quem é o prazo, entram só os arquivos DAQUELE cliente: a
    // subpasta existe justamente para não misturar três prazos do mesmo dia.
    // Sem cliente conhecido (arquivando pela ficha), entra o que estiver solto
    // na raiz — o resto fica na lista de baixo, a um clique.
    const alvo = ctx.data?.cliente ? chave(ctx.data.cliente) : null;
    const meus = listaMesa.filter((f) =>
      alvo ? (f.sub ? chave(f.sub) === alvo : false) : f.sub === null,
    );
    const entram = meus.length ? meus : listaMesa.filter((f) => f.sub === null);
    if (!entram.length) {
      setSemeouPasta(true);
      return;
    }
    setItens((atuais) => [
      ...atuais,
      ...entram
        .filter((f) => !atuais.some((i) => i.nome === f.nome))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))
        .map((f) => ({ kind: 'file' as const, file: f.file, nome: f.nome, daMesa: true })),
    ]);
    setSemeouPasta(true);
  }, [listaMesa, semeouPasta, ctx.data?.cliente]);

  // Da ficha: só as fases daquele cliente.
  const fasesQ = useQuery({
    queryKey: ['drive-fases', partyId],
    queryFn: () => driveBrowserService.fases(partyId!),
    enabled: !!partyId && !atividade,
    staleTime: 0,
    gcTime: 0,
  });

  const alvoPartyId = atividade ? ctx.data?.partyId : partyId;
  const fases: FaseNoDrive[] = (atividade ? ctx.data?.fases : fasesQ.data) ?? [];
  const carregando = atividade ? ctx.isLoading : fasesQ.isLoading;
  const erro = (atividade ? ctx.error : fasesQ.error) as any;

  // A sugestão preenche o select, mas não decide: só vale enquanto o advogado
  // não mexeu, e só quando UMA fase casa com o ato (cliente com RMC e RCC tem
  // duas manifestações, e quem sabe de qual réu é o protocolo é ele).
  const sugerida =
    ctx.data?.sugeridas?.length === 1 ? ctx.data.sugeridas[0].join('/') : '';
  const escolhida = tocou || !sugerida ? faseSel : sugerida;
  const fase = fases.find((f) => f.caminho.join('/') === escolhida);
  const dataOk = /^\d{2}\.\d{2}\.\d{4}$/.test(data);

  // Só para mostrar onde vai cair: quem decide a letra é o servidor, lendo a
  // fase no Drive na hora de gravar.
  const { data: destino } = useQuery({
    queryKey: ['drive-destino', alvoPartyId, escolhida, data],
    queryFn: () => driveBrowserService.destino(alvoPartyId!, fase!.caminho, data),
    enabled: !!alvoPartyId && !!fase && dataOk,
    staleTime: 0,
    gcTime: 0,
  });

  /** Autoriza uma pasta e guarda o handle para as próximas sessões. */
  const escolherPasta = async (qual: 'mesa' | 'clientes') => {
    try {
      // O Chromium recusa `~/Library` inteira ("contém arquivos do sistema"), e
      // é lá que o Drive monta — por isso a pasta do Drive normalmente NÃO pode
      // ser autorizada, e o hub cai no plano B (subir e limpar a Mesa). O botão
      // continua existindo porque num Mac com o Drive espelhado fora de
      // ~/Library ele funciona, e aí o arquivo muda de lugar sem upload.
      const dir = await (window as any).showDirectoryPicker({
        id: `frider-${qual}`,
        mode: 'readwrite',
        startIn: qual === 'mesa' ? 'desktop' : 'documents',
      });
      if (!(await permissaoDeEscrita(dir, true))) {
        toast.error('Sem permissão de escrita nessa pasta.');
        return;
      }
      await guardarPasta(qual, dir);
      if (qual === 'mesa') {
        setMesa(dir);
        // Pasta trocada é lista nova: relê e deixa a auto-entrada acontecer de
        // novo, senão a tela continuaria mostrando o que veio da pasta velha.
        setListaMesa(null);
        setSemeouPasta(false);
        await listarMesa(dir);
      } else setClientesDir(dir);
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error(e?.message || 'Não consegui abrir a pasta.');
    }
  };

  /**
   * O que há de arquivável na pasta de trabalho — raiz E subpastas de cliente.
   *
   * Desce UM nível de propósito: a estrutura é `PROTOCOLO/<CLIENTE>/arquivos`, e
   * ir mais fundo só encontraria coisa que não é peça.
   */
  const listarMesa = async (dir: any) => {
    const serve = (n: string) => !n.startsWith('.') && /\.(pdf|docx?|jpe?g|png)$/i.test(n);
    const itens: ArquivoDaMesa[] = [];

    const ler = async (d: any, sub: string | null) => {
      for await (const [nome, h] of d.entries()) {
        if (h.kind === 'file') {
          if (!serve(nome)) continue;
          const file = await h.getFile();
          itens.push({ nome, file, mtime: file.lastModified, sub });
          continue;
        }
        if (sub === null && !nome.startsWith('.')) await ler(h, nome);
      }
    };
    await ler(dir, null);

    // A peça que você acabou de protocolar é a mais recente — ela vem em cima.
    itens.sort((a, b) => b.mtime - a.mtime);
    setListaMesa(itens.slice(0, 60));
  };

  /** Abre a Mesa: autoriza se preciso, senão só relista (o conteúdo muda). */
  const abrirMesa = async () => {
    if (mesa && (await permissaoDeEscrita(mesa, true))) return listarMesa(mesa);
    return escolherPasta('mesa');
  };

  /**
   * Mover no disco só quando NÃO há mistura: ou tudo veio da Mesa, ou nada.
   *
   * Se metade fosse movida no disco e metade subisse pela API, as duas criariam
   * a subpasta datada — o Drive aceita duas `c) 20.08.2026` sem reclamar, e o
   * protocolo acabaria partido em duas pastas irmãs.
   */
  /**
   * Mover vale quando TODO item existe na Mesa — venha ele do seletor, do
   * botão "pegar da Mesa" ou dos anexos da tarefa cujo arquivo ainda está lá.
   *
   * Continua sem mistura: se um só item não estiver na Mesa, sobe tudo. Meio
   * movendo e meio subindo criaria duas `c) 20.08.2026`, porque o Drive aceita
   * duas pastas de mesmo nome sem reclamar.
   */
  /**
   * O anexo da tarefa e o arquivo da Mesa costumam ser o MESMO arquivo — foi de
   * lá que ele subiu. Reconhecer isso pelo nome é o que faz a Mesa ficar limpa
   * sem o advogado ter de lembrar de escolher a origem "certa" no modal.
   *
   * DERIVADO, nunca guardado no item: era um `useEffect` que marcava `naMesa`
   * quando a Mesa era lida, e como os anexos chegam pela REDE e a Mesa pelo
   * DISCO, os anexos costumavam chegar depois — o efeito já tinha rodado e
   * ninguém marcava nada. Resultado: subia por upload e a Mesa ficava suja,
   * sem erro nenhum na tela.
   *
   * E vale por NOME para QUALQUER origem, não só para o botão "pegar da Mesa":
   * arrastado para os anexos, escolhido no seletor ou já anexado ontem, se o
   * arquivo está na Mesa com aquele nome, é ele. Exigir que tivesse entrado
   * pela porta "certa" era a mesma armadilha de sempre — o hub sabendo a
   * resposta e fingindo que não.
   */
  const nomesNaMesa = useMemo(
    () => new Set((listaMesa ?? []).map((m) => m.nome)),
    [listaMesa],
  );
  const estaNaMesa = (i: ItemProtocolo) => i.nome !== '' && (
    (i.kind === 'file' && i.daMesa) || nomesNaMesa.has(i.nome)
  );

  const todosNaMesa = itens.length > 0 && itens.every(estaNaMesa);

  const podeMover = suportaMoverNoDisco() && !!mesa && !!clientesDir && todosNaMesa;

  /**
   * Plano B: subir pela API e TIRAR o arquivo da Mesa depois.
   *
   * O Chromium se recusa a autorizar qualquer pasta dentro de `~/Library` — a
   * mensagem é "contém arquivos do sistema" — e é exatamente ali que o Google
   * Drive monta (`~/Library/CloudStorage/GoogleDrive-…`). Ou seja: mover o
   * arquivo para dentro do Drive pelo navegador é IMPOSSÍVEL nesta máquina,
   * por regra do navegador, não por configuração.
   *
   * A Mesa (`~/Desktop`) não é bloqueada. Então dá para fazer as duas metades
   * por caminhos diferentes: o arquivo chega à pasta certa pela API (que é
   * quem sabe a fase, a letra e a numeração) e sai da Mesa aqui — **só depois
   * que o Drive confirmar, e só pelo nome que ele devolveu**.
   */
  const podeLimpar = suportaMoverNoDisco() && !!mesa && !clientesDir && todosNaMesa;

  /** Arrastar da Mesa para cá é o gesto natural — e cai na mesma lista. */
  const receber = (lista: FileList | File[] | null) => {
    const novos = Array.from(lista ?? []);
    if (!novos.length) return;
    setItens((a) => [
      ...a,
      ...novos
        .filter((f) => !a.some((i) => i.nome === f.name))
        .map((f) => ({ kind: 'file' as const, file: f, nome: f.name, daMesa: false })),
    ]);
  };

  const pegarDaMesa = (it: ArquivoDaMesa) => {
    if (itens.some((i) => i.nome === it.nome)) return;
    setItens((a) => [...a, { kind: 'file', file: it.file, nome: it.nome, daMesa: true }]);
  };

  // Espelha a regra do servidor: PDF entra numerado na ordem, editável sem
  // número. O servidor é quem manda — isto é a prévia.
  const nomeFinal = (it: ItemProtocolo) => {
    if (!/\.pdf$/i.test(it.nome)) return it.nome;
    if (/^\d{2}\.\s/.test(it.nome)) return it.nome;
    const pdfs = itens.filter((x) => /\.pdf$/i.test(x.nome));
    return `${String(pdfs.indexOf(it) + 1).padStart(2, '0')}. ${it.nome}`;
  };

  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= itens.length) return;
    const copia = [...itens];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setItens(copia);
  };

  const salvar = async () => {
    if (!alvoPartyId || !fase) return toast.error('Escolha a fase.');
    if (!dataOk) return toast.error('A data do protocolo é DD.MM.AAAA.');
    if (!itens.length) return toast.error('Anexe ao menos a peça.');
    setSalvando(true);
    try {
      // Caminho do MOVIMENTO: a API diz onde e com que nome; o Mac executa.
      // Nada sobe pela rede e nada é apagado.
      if (podeMover) {
        // ANEXAR PRIMEIRO, mover depois. Depois do `move` o arquivo não está
        // mais na Mesa e o `File` na mão vira referência morta — se a ordem
        // fosse a inversa, uma falha ao anexar deixaria o prazo sem registro e
        // sem como refazer.
        // Anexo que já existe na tarefa não sobe de novo — só os arquivos que
        // ainda não têm registro no prazo.
        const paraAnexar = itens
          .filter((i) => i.kind === 'file')
          .map((i) => (i as any).file as File);
        if (atividade && anexarNaTarefa && paraAnexar.length) {
          try {
            await activitiesService.uploadAnexos(
              atividade.entityType,
              atividade.entityId,
              paraAnexar,
            );
            // A lista de anexos do painel é a mesma query — sem isto o anexo só
            // apareceria ao reabrir a tarefa.
            qc.invalidateQueries({
              queryKey: ['activity-anexos', atividade.entityType, atividade.entityId],
            });
          } catch (e: any) {
            toast.error(
              e?.response?.data?.message ||
                'Não consegui anexar na tarefa — não movi nada da Mesa.',
            );
            return;
          }
        }

        const plano = await driveBrowserService.plano(
          alvoPartyId,
          fase.caminho,
          itens.map((i) => i.nome),
          data,
        );
        // O arquivo pode estar na subpasta do cliente (PROTOCOLO/<CLIENTE>/):
        // quem sabe disso é a leitura da Mesa, que guarda o `sub` de cada um.
        const r2 = await moverParaAPastaDoCliente(mesa, clientesDir, plano, (nome) =>
          (listaMesa ?? []).find((f) => f.nome === nome)?.sub ?? null,
        );
        if (!r2.movidos.length) {
          toast.error(
            `Não consegui mover: ${r2.ficaram.map((f) => `${f.nome} (${f.motivo})`).join('; ')}`,
          );
          return;
        }
        if (r2.ficaram.length)
          toast.warning(
            `${r2.movidos.length} movido(s). Ficaram na Mesa: ${r2.ficaram
              .map((f) => `${f.nome} (${f.motivo})`)
              .join('; ')}`,
          );
        else
          toast.success(
            `${r2.movidos.length} arquivo(s) saíram da Mesa e entraram em ${plano.pasta}` +
              (atividade && anexarNaTarefa ? ', e ficaram anexados na tarefa.' : '.'),
          );
        onPronto(
          { pasta: plano.pasta, caminho: plano.destino, arquivos: r2.movidos },
          alvoPartyId,
        );
        return;
      }

      // Anexo da tarefa NÃO sobe de novo: já está no disco do servidor. Só os
      // arquivos escolhidos agora vão no multipart; a `ordem` diz a sequência.
      // RELÊ do disco na hora de enviar, em vez de confiar no File capturado
      // quando a pasta foi listada. O File é um retrato: se o arquivo foi
      // salvo de novo, renomeado ou a pasta mudou desde a listagem, ele vira
      // referência morta — e o que chega ao servidor é NADA, sem erro nenhum
      // no caminho.
      const novos: File[] = [];
      for (const i of itens) {
        if (i.kind !== 'file') continue;
        let f: File | null = (i as any).file ?? null;
        if (mesa && (i as any).daMesa) {
          try {
            const sub = (listaMesa ?? []).find((x) => x.nome === i.nome)?.sub ?? null;
            const dono = sub ? await mesa.getDirectoryHandle(sub) : mesa;
            f = await (await dono.getFileHandle(i.nome)).getFile();
          } catch {
            /* some do disco entre listar e enviar: fica o retrato antigo */
          }
        }
        if (!f) {
          toast.error(`Não consegui ler "${i.nome}". Tire-o da lista ou anexe de novo.`);
          return;
        }
        novos.push(f);
      }

      // A caixa "Anexar também na tarefa" aparece nos DOIS caminhos, mas só o do
      // movimento a executava: no de upload ela ficava marcada sem fazer nada.
      if (atividade && anexarNaTarefa && podeLimpar && novos.length) {
        try {
          await activitiesService.uploadAnexos(atividade.entityType, atividade.entityId, novos);
          qc.invalidateQueries({
            queryKey: ['activity-anexos', atividade.entityType, atividade.entityId],
          });
        } catch {
          toast.warning('Arquivei, mas não consegui anexar na tarefa.');
        }
      }

      const r = await driveBrowserService.arquivar(
        alvoPartyId,
        fase.caminho,
        novos,
        data,
        atividade
          ? {
              entityType: atividade.entityType,
              entityId: atividade.entityId,
              ordem: itens.map((i) =>
                i.kind === 'anexo'
                  ? { kind: 'anexo' as const, ref: i.id }
                  : { kind: 'file' as const, ref: i.nome },
              ),
            }
          : undefined,
      );
      toast.success(`Peça arquivada em ${r.pasta} (${r.arquivos.length} arquivo(s)).`);

      // Só agora, e só o que o Drive confirmou pelo nome que ele mesmo devolveu:
      // `removeEntry` não tem lixeira, então arquivo que não subiu não pode sair
      // da Mesa por engano.
      if (podeLimpar && limparMesa) {
        const confirmados = new Set<string>(r.arquivos);
        const saiu: string[] = [];
        const ficou: string[] = [];
        const subsMexidas = new Set<string>();
        for (const i of itens) {
          if (!confirmados.has(nomeFinal(i))) {
            ficou.push(i.nome);
            continue;
          }
          try {
            const sub = (listaMesa ?? []).find((f) => f.nome === i.nome)?.sub ?? null;
            const dono = sub ? await mesa.getDirectoryHandle(sub) : mesa;
            await dono.removeEntry(i.nome);
            saiu.push(i.nome);
            if (sub) subsMexidas.add(sub);
          } catch {
            ficou.push(i.nome);
          }
        }
        // Pasta de cliente que ficou vazia é pendência resolvida: sai também.
        // O que sobra em PROTOCOLO passa a ser, por construção, o que ainda não
        // foi arquivado.
        for (const sub of subsMexidas) {
          try {
            const d = await mesa.getDirectoryHandle(sub);
            let vazia = true;
            for await (const [nome] of d.entries()) {
              if (nome !== '.DS_Store') { vazia = false; break; }
              await d.removeEntry(nome).catch(() => {});
            }
            if (vazia) await mesa.removeEntry(sub, { recursive: true });
          } catch {
            /* pasta em uso ou já removida — fica, e não atrapalha nada */
          }
        }
        if (saiu.length) toast.success(`${saiu.length} arquivo(s) saíram de ${mesaNome}.`);
        if (ficou.length) toast.warning(`Ficaram em ${mesaNome}: ${ficou.join(', ')}`);
      }

      // Subiu em vez de mover: DIGA por quê. Silêncio aqui foi o que fez a Mesa
      // continuar suja duas vezes sem ninguém entender o motivo.
      if (suportaMoverNoDisco() && itens.length && !podeMover && !(podeLimpar && limparMesa)) {
        const falta = !mesa && !clientesDir
          ? 'a pasta de trabalho'
          : !mesa
            ? 'a pasta de trabalho'
            : !clientesDir
              ? 'a pasta 01. CLIENTES'
              : null;
        toast.warning(
          falta
            ? `Os arquivos continuam onde estão: falta autorizar ${falta} (uma vez só, no modal).`
            : 'Os arquivos continuam onde estão: há item fora da pasta autorizada, e misturar criaria duas pastas da mesma data.',
        );
      }
      onPronto(r, alvoPartyId);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Não consegui arquivar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
          <Stamp className="h-4 w-4 text-[#228BE6]" />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{titulo}</h3>
          <button
            type="button"
            onClick={onFechar}
            className="ml-auto rounded-md p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {ctx.data && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">{ctx.data.cliente}</span>
              {ctx.data.processo ? ` · ${ctx.data.processo}` : ''}
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Fase
            </label>
            {carregando ? (
              <p className="text-sm text-zinc-400">Lendo as fases no Drive…</p>
            ) : erro ? (
              <p className="text-sm text-rose-500">
                {erro?.response?.data?.message || (erro as Error)?.message}
              </p>
            ) : !fases.length ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Este cliente não tem pasta de fase no Drive. Crie a fase (ou rode a padronização)
                antes de arquivar.
              </p>
            ) : (
              <>
                <select
                  value={escolhida}
                  onChange={(e) => {
                    setTocou(true);
                    setFaseSel(e.target.value);
                  }}
                  className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  <option value="">Escolha a fase…</option>
                  {fases.map((f) => (
                    <option key={f.caminho.join('/')} value={f.caminho.join('/')}>
                      {f.caminho.join('  ›  ')}
                    </option>
                  ))}
                </select>
                {!tocou && sugerida && (
                  <p className="mt-1 text-[11px] text-zinc-400">
                    Sugerida pelo ato{ctx.data?.acao ? ` (${ctx.data.acao})` : ''} — confira antes de
                    arquivar.
                  </p>
                )}
                {!!ctx.data && ctx.data.sugeridas.length > 1 && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    Este cliente tem {ctx.data.sugeridas.length} pastas dessa fase (produtos
                    diferentes). Escolha a do réu certo.
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Data do protocolo
            </label>
            <input
              value={data}
              onChange={(e) => setData(e.target.value)}
              placeholder="DD.MM.AAAA"
              className={`w-40 rounded-md border bg-white px-2 py-1.5 text-sm tabular-nums outline-none dark:bg-zinc-900 ${
                dataOk
                  ? 'border-zinc-200 text-zinc-700 focus:border-[#228BE6] dark:border-zinc-700 dark:text-zinc-200'
                  : 'border-rose-300 text-rose-600 dark:border-rose-500/50'
              }`}
            />
          </div>

          {destino && (
            <div className="rounded-lg border border-[#228BE6]/30 bg-[#228BE6]/5 px-3 py-2 text-xs dark:border-[#228BE6]/40 dark:bg-[#228BE6]/10">
              <p className="text-zinc-500 dark:text-zinc-400">Vai cair em</p>
              <p className="mt-0.5 font-medium text-[#228BE6]">{destino.destino.join('  ›  ')}</p>
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Arquivos — os PDFs na ordem do protocolo
                {anexosQ.data?.length ? ' · anexos da tarefa já entraram' : ''}
              </label>
              <div className="flex items-center gap-3">
                {suportaMesa() && (
                  <span className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={abrirMesa}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#228BE6] hover:underline"
                    >
                      <Monitor className="h-3 w-3" /> {mesa ? `ver ${mesaNome}` : 'pegar da pasta'}
                    </button>
                    {/* Autorizou a pasta errada? Trocar tem de estar UM clique
                        adiante — não havia como, e a escolha ficava presa. */}
                    {mesa && (
                      <button
                        type="button"
                        onClick={() => escolherPasta('mesa')}
                        title="Autorizar outra pasta de trabalho"
                        className="text-xs text-zinc-400 hover:text-[#228BE6] hover:underline"
                      >
                        trocar
                      </button>
                    )}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  className="text-xs font-medium text-[#228BE6] hover:underline"
                >
                  anexar
                </button>
              </div>
            </div>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                receber(e.target.files);
                if (input.current) input.current.value = '';
              }}
            />
            {(() => {
              // Só o que AINDA não está na lista: o resto já entrou sozinho, e
              // repetir na tela faria parecer que falta escolher alguma coisa.
              const fora = (listaMesa ?? []).filter((f) => !itens.some((i) => i.nome === f.nome));
              return !listaMesa ? null : (
              <div className={fora.length ? 'mb-2 rounded-lg border border-zinc-200 dark:border-zinc-800' : 'hidden'}>
                <p className="border-b border-zinc-100 px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  Também em {mesaNome} — clique para incluir
                </p>
                {!fora.length ? null : (
                  <ul className="max-h-40 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
                    {fora.map((it) => {
                      return (
                        <li key={it.nome}>
                          <button
                            type="button"
                            onClick={() => pegarDaMesa(it)}
                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                            <span className="min-w-0 flex-1 truncate text-xs text-zinc-600 dark:text-zinc-300">
                              {it.nome}
                            </span>
                            {it.sub && (
                              <span className="shrink-0 truncate rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                {it.sub}
                              </span>
                            )}
                            <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">
                              {new Date(it.mtime).toLocaleDateString('pt-BR')}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              );
            })()}

            {!itens.length ? (
              <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastando(true);
                }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastando(false);
                  receber(e.dataTransfer.files);
                }}
                className={`flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-6 text-xs ${
                  arrastando
                    ? 'border-[#228BE6] bg-[#228BE6]/5 text-[#228BE6]'
                    : 'border-zinc-300 text-zinc-400 hover:border-[#228BE6] hover:text-[#228BE6] dark:border-zinc-700'
                }`}
              >
                <Upload className="h-4 w-4" />{' '}
                {atividade && anexosQ.isLoading
                  ? 'Lendo os anexos da tarefa…'
                  : arrastando
                    ? 'Solte aqui'
                    : 'Arraste da Mesa, ou clique para escolher'}
              </button>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {itens.map((it, i) => (
                  <li key={`${it.nome}-${i}`} className="flex items-center gap-2 px-2.5 py-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <span className="min-w-0 flex-1 truncate text-xs text-zinc-700 dark:text-zinc-300">
                      {nomeFinal(it)}
                    </span>
                    {/* De onde veio importa: anexo já está no servidor e não
                        sobe de novo; da Mesa, o arquivo muda de lugar. */}
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {it.kind === 'anexo'
                        ? estaNaMesa(it)
                          ? `da tarefa · em ${mesaNome}`
                          : 'da tarefa'
                        : it.daMesa
                          ? `de ${mesaNome}`
                          : 'novo'}
                    </span>
                    <button
                      type="button"
                      onClick={() => mover(i, -1)}
                      disabled={i === 0}
                      className="rounded p-0.5 text-zinc-300 hover:text-[#228BE6] disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(i, 1)}
                      disabled={i === itens.length - 1}
                      className="rounded p-0.5 text-zinc-300 hover:text-[#228BE6] disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setItens((a) => a.filter((_, j) => j !== i))}
                      className="rounded p-0.5 text-zinc-300 hover:text-rose-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-[11px] text-zinc-400">
              PDF entra numerado na ordem acima; o editável entra sem número. Nada é sobrescrito.
            </p>
            {suportaMoverNoDisco() && !!itens.length && (
              <div className="mt-2 rounded-lg border border-zinc-200 px-2.5 py-2 dark:border-zinc-800">
                {podeMover ? (
                  <>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      Os arquivos <span className="font-medium">saem da Mesa e entram na pasta</span>{' '}
                      — sem apagar. O Google sincroniza depois.
                    </p>
                    {atividade && itens.some((i) => i.kind === 'file') && (
                      <label className="mt-1.5 flex items-start gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <input
                          type="checkbox"
                          checked={anexarNaTarefa}
                          onChange={(e) => setAnexarNaTarefa(e.target.checked)}
                          className="mt-0.5 accent-[#228BE6]"
                        />
                        <span>
                          Anexar também na tarefa — fica o registro do que foi protocolado, junto do
                          prazo.
                        </span>
                      </label>
                    )}
                  </>
                ) : podeLimpar ? (
                  <>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      Os arquivos vão para a pasta do cliente e{' '}
                      <span className="font-medium">saem de {mesaNome}</span> depois que o Drive
                      confirmar.
                    </p>
                    <label className="mt-1.5 flex items-start gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <input
                        type="checkbox"
                        checked={limparMesa}
                        onChange={(e) => setLimparMesa(e.target.checked)}
                        className="mt-0.5 accent-[#228BE6]"
                      />
                      <span>
                        Tirar de {mesaNome} ({itens.length}).{' '}
                        <span className="text-amber-600 dark:text-amber-400">
                          Sai de vez, sem passar pela Lixeira
                        </span>{' '}
                        — e só sai o que o Drive confirmar.
                      </span>
                    </label>
                    {atividade && itens.some((i) => i.kind === 'file') && (
                      <label className="mt-1 flex items-start gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <input
                          type="checkbox"
                          checked={anexarNaTarefa}
                          onChange={(e) => setAnexarNaTarefa(e.target.checked)}
                          className="mt-0.5 accent-[#228BE6]"
                        />
                        <span>Anexar também na tarefa.</span>
                      </label>
                    )}
                  </>
                ) : !mesa ? (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      Do jeito que está, eu subo os arquivos e eles CONTINUAM onde estão.
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Autorize uma pasta de trabalho, uma vez só. O Opera abre o seletor do Mac —
                      escolha a pasta e clique em Selecionar.{' '}
                      <span className="font-medium">
                        O navegador recusa a Mesa inteira (“contém arquivos do sistema”), então
                        escolha a pasta PROTOCOLO que fica na Mesa — a pasta MÃE, não a de um
                        cliente (se não existir no seu Mac, crie uma com esse nome)
                      </span>{' '}
                      — é uma limitação do Chromium, vale para Documentos e Downloads também.
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => escolherPasta('mesa')}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-400/60 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10"
                      >
                        <Monitor className="h-3 w-3" /> autorizar a pasta PROTOCOLO
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      {itens.filter((i) => !estaNaMesa(i)).length} item(ns) não estão em{' '}
                      {mesaNome} — vou <span className="font-medium">subir todos</span> e nada sai
                      de lugar.
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Autorizou a pasta de um cliente em vez da PROTOCOLO?{' '}
                      <button
                        type="button"
                        onClick={() => escolherPasta('mesa')}
                        className="font-medium text-[#228BE6] hover:underline"
                      >
                        trocar a pasta
                      </button>{' '}
                      — a PROTOCOLO é a mãe, e o hub enxerga as de todos os clientes por ela.
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !fase || !itens.length || !dataOk}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#228BE6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1c7ed6] disabled:opacity-40"
          >
            {salvando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Stamp className="h-3.5 w-3.5" />
            )}
            {rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
