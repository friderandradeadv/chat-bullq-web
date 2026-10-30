'use client';

/**
 * A MENSAGEM COMO ELA VAI CHEGAR, em bolhas.
 *
 * 🚨 POR QUE EXISTE (30/10/2026). Pedido do escritório antes do primeiro
 * disparo: *"deixe em visualização de bolhas, como as mensagens serão
 * disparadas, pode simular a conversa no chat"*. Aprovar num campo de texto e
 * mandar em seis bolhas é aprovar uma coisa e enviar outra — e o que o cliente
 * lê é a bolha, não o campo.
 *
 * 🚨 O CORTE AQUI TEM DE SER O MESMO DO SERVIDOR. Lá, `emBolhas` parte o texto
 * nas linhas em branco (ver `MessagesService.send`). Se esta prévia cortasse por
 * outra régua, ela mentiria — e mentiria justamente na hora em que o advogado
 * confia nela para apertar o botão. Mudou lá, muda aqui, no mesmo commit.
 */
export function bolhasDaMensagem(texto: string): string[] {
  return String(texto ?? '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
}

/**
 * O mesmo ritmo que o servidor aplica (`atrasoDaBolha`), só para MOSTRAR quanto
 * cada bolha espera. Não controla nada: é legenda.
 */
function esperaDaBolha(i: number, anterior: string | undefined): number {
  if (i <= 0) return 0;
  return 900 * i + Math.min(4000, String(anterior ?? '').length * 18);
}

const segundos = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')}s`;

export function PreviaEmBolhas({ texto }: { texto: string }) {
  const partes = bolhasDaMensagem(texto);
  if (!partes.length) return null;

  return (
    <div className="rounded-lg border border-[#cfe0ed] bg-[#e9edef] p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#48626f] dark:text-zinc-400">
          como vai chegar · {partes.length} {partes.length === 1 ? 'bolha' : 'bolhas'}
        </p>
      </div>
      <div className="space-y-1.5">
        {partes.map((p, i) => (
          <div key={i} className="flex justify-end">
            <div className="relative max-w-[85%] whitespace-pre-wrap rounded-lg rounded-tr-sm bg-[#d9fdd3] px-2.5 py-1.5 text-[12px] leading-[1.35] text-[#111b21] shadow-sm dark:bg-emerald-900/50 dark:text-zinc-100">
              {p}
              {i > 0 && (
                <span
                  title="quanto esta bolha espera depois da anterior"
                  className="ml-2 align-bottom text-[9px] text-[#667781] dark:text-zinc-400"
                >
                  +{segundos(esperaDaBolha(i, partes[i - 1]))}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
