'use client';

/**
 * A SENHA DO GOV.BR NA TELA, BUSCADA SÓ QUANDO SE PEDE.
 *
 * 🚨 POR QUE EXISTE (22/10/2026). 256 contatos guardam a senha do gov.br em
 * texto puro no cadastro, e ela viajava em TODA resposta de contato: a
 * listagem devolvia o metadata inteiro de cada contato da página, e a rota da
 * lista é aberta a parceiro travado. Quem abria a tela de contatos recebia, sem
 * pedir, a senha de 20 clientes.
 *
 * A senha continua à mão, porque o escritório entra no Meu INSS pelo cliente,
 * com procuração. O que muda é que ela só sai do servidor quando alguém
 * **clica para ver**, uma de cada vez, e esse acesso fica no log com quem pediu.
 *
 * A tela sabe que HÁ senha pela flag `cadastro.temSenha`, que não é segredo:
 * sem ela, o front precisaria do valor só para decidir se desenha o botão.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { contactsService } from '@/features/contacts/services/contacts.service';

export function SenhaDoCadastro({
  contactId, temSenha, compacto,
}: {
  contactId: string;
  temSenha: boolean;
  /** No painel do inbox o espaço é estreito: some o rótulo. */
  compacto?: boolean;
}) {
  const [senha, setSenha] = useState<string | null>(null);
  const [mostrando, setMostrando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  if (!temSenha) return null;

  /** Busca uma vez e guarda só enquanto a tela estiver aberta. */
  const pegar = async (): Promise<string | null> => {
    if (senha !== null) return senha;
    setBuscando(true);
    try {
      const r = await contactsService.senhaDoCadastro(contactId);
      if (!r?.senha) { toast.error('Não há senha guardada neste cadastro.'); return null; }
      setSenha(r.senha);
      return r.senha;
    } catch (e: any) {
      // 403 aqui quer dizer "não é sócio", e a mensagem tem de dizer isso.
      toast.error(e?.response?.status === 403
        ? 'Só sócio (OWNER/ADMIN) vê a senha do cliente.'
        : e?.response?.data?.message || 'Não consegui buscar a senha.');
      return null;
    } finally {
      setBuscando(false);
    }
  };

  const alternar = async () => {
    if (mostrando) { setMostrando(false); return; }
    if (await pegar()) setMostrando(true);
  };

  const copiar = async () => {
    const v = await pegar();
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch { toast.error('Não consegui copiar.'); }
  };

  const corpo = (
    <dd className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
      <span className="min-w-0 break-all font-mono">
        {mostrando && senha ? senha : '•'.repeat(10)}
      </span>
      <button
        type="button"
        onClick={alternar}
        disabled={buscando}
        title={mostrando ? 'Ocultar' : 'Mostrar'}
        className="shrink-0 rounded p-1 text-zinc-400 hover:text-[#228BE6] disabled:opacity-50"
      >
        {buscando ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : mostrando ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={copiar}
        disabled={buscando}
        title="Copiar"
        className="shrink-0 rounded p-1 text-zinc-400 hover:text-[#228BE6] disabled:opacity-50"
      >
        {copiado ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </dd>
  );

  if (compacto) return corpo;

  return (
    <div className="flex items-start gap-2">
      <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-zinc-400">Senha</dt>
        {corpo}
      </div>
    </div>
  );
}
