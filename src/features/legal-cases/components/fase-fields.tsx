'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';

type FieldType = 'checklist' | 'radio' | 'text' | 'textarea' | 'date' | 'datetime' | 'currency' | 'select';
interface Field { key: string; label: string; type: FieldType; options?: string[] }

/** Campos do painel "Fase atual" por fase — espelha os campos de cada fase do Pipefy. */
export const FASE_FORMS: Record<string, Field[]> = {
  novos_clientes: [
    { key: 'documentos', label: 'Verifique os documentos necessários', type: 'checklist', options: ['Procuração', 'Declaração de hipossuficiência', 'Comprovante de residência', 'Documentos pessoais', 'Outros'] },
    { key: 'prazo_confeccao', label: 'Prazo fatal de confecção da peça', type: 'date' },
  ],
  reuniao_agendada: [
    { key: 'reuniao_feita', label: 'Reunião de pós-venda realizada?', type: 'radio', options: ['Sim', 'Não'] },
    { key: 'obs', label: 'Observações', type: 'textarea' },
  ],
  info_faltantes: [
    { key: 'docs_faltantes', label: 'Quais documentos faltantes?', type: 'textarea' },
    { key: 'obter_docs', label: 'Obter documentos', type: 'checklist', options: ['Entrar em contato com o cliente', 'Solicitar documentos', 'Subir no Drive', 'Anexar documentos recebidos'] },
  ],
  montar_inicial: [
    { key: 'docs_ok', label: 'Temos todos os documentos?', type: 'radio', options: ['Sim', 'Não'] },
    { key: 'peticao_pronta', label: 'Petição pronta?', type: 'radio', options: ['Sim', 'Não'] },
    { key: 'info', label: 'Informações importantes', type: 'textarea' },
  ],
  revisao_inicial: [
    { key: 'revisada', label: 'Petição revisada?', type: 'radio', options: ['Sim', 'Não'] },
    { key: 'aprovada', label: 'Aprovada para protocolo?', type: 'radio', options: ['Sim', 'Não'] },
  ],
  para_correcao: [{ key: 'pontos', label: 'Pontos para correção', type: 'textarea' }],
  revisao_final: [
    { key: 'revisada', label: 'Petição revisada?', type: 'radio', options: ['Sim', 'Não'] },
    { key: 'aprovada', label: 'Aprovada para protocolo?', type: 'radio', options: ['Sim', 'Não'] },
  ],
  inss_admin: [
    { key: 'numero', label: 'Número do processo administrativo', type: 'text' },
    { key: 'data', label: 'Data do protocolo', type: 'date' },
    { key: 'obs', label: 'Observações', type: 'textarea' },
  ],
  protocolo: [
    { key: 'tribunal_cadastrado', label: 'Tribunal', type: 'radio', options: ['Cadastrado', 'Protocolado'] },
    { key: 'astrea', label: 'Astrea', type: 'radio', options: ['Cadastrado', 'Pendente'] },
    { key: 'pedidos', label: 'Pedidos protocolados', type: 'checklist', options: ['Gratuidade de justiça', 'Tutela de urgência', 'Prioridade de tramitação', 'Sigilo'] },
  ],
  admissao: [
    { key: 'decisao', label: 'Decisão inicial?', type: 'radio', options: ['Deferida', 'Indeferida', 'Pendente'] },
    { key: 'gratuidade', label: 'Gratuidade de justiça', type: 'radio', options: ['Deferida', 'Indeferida'] },
    { key: 'tutela', label: 'Tutela de urgência', type: 'radio', options: ['Deferida', 'Indeferida', 'Não pedida'] },
    { key: 'obs', label: 'Observações', type: 'textarea' },
  ],
  citacao: [
    { key: 'houve', label: 'Houve citação?', type: 'radio', options: ['Sim', 'Não'] },
    { key: 'meios', label: 'Meios de citação realizados', type: 'checklist', options: ['Carta', 'Oficial de justiça', 'Edital', 'Eletrônica'] },
    { key: 'obs', label: 'Anotações importantes', type: 'textarea' },
  ],
  aud_conciliacao: [
    { key: 'data_hora', label: 'Data e hora da audiência', type: 'datetime' },
    { key: 'formato', label: 'Formato', type: 'radio', options: ['Presencial', 'Videoconferência'] },
    { key: 'local', label: 'Local / link da audiência', type: 'text' },
  ],
  contestacao: [{ key: 'obs', label: 'Observações', type: 'textarea' }],
  provas: [{ key: 'info', label: 'Informações importantes', type: 'textarea' }],
  pericia: [{ key: 'obs', label: 'Observações', type: 'textarea' }],
  aud_instrucao: [
    { key: 'data_hora', label: 'Data e hora da audiência', type: 'datetime' },
    { key: 'formato', label: 'Formato', type: 'radio', options: ['Presencial', 'Videoconferência'] },
    { key: 'local', label: 'Local / link da audiência', type: 'text' },
  ],
  aguardando_sentenca: [{ key: 'obs', label: 'Observações', type: 'textarea' }],
  sentenca: [
    { key: 'resultado', label: 'Sentença proferida', type: 'radio', options: ['Procedente', 'Parcialmente procedente', 'Improcedente'] },
    { key: 'julgamento', label: 'Julgamento', type: 'textarea' },
    { key: 'recorrer', label: 'Vamos recorrer?', type: 'radio', options: ['Sim', 'Não'] },
    { key: 'motivo', label: 'Motivo (se não recorrer)', type: 'text' },
  ],
  recurso: [
    { key: 'especie', label: 'Espécie de recurso', type: 'select', options: ['Apelação', 'Agravo de instrumento', 'Embargos de declaração', 'Recurso especial', 'Recurso extraordinário', 'Recurso inominado'] },
    { key: 'julgamento', label: 'Julgamento', type: 'radio', options: ['Provido', 'Não provido', 'Parcialmente provido', 'Aguardando'] },
  ],
  aguardando_arquivamento: [{ key: 'motivo', label: 'Motivo do arquivamento', type: 'textarea' }],
  transito: [
    { key: 'transitou', label: 'Transitou em julgado?', type: 'radio', options: ['Sim', 'Não'] },
    { key: 'vencemos', label: 'Vencemos a ação?', type: 'radio', options: ['Sim', 'Não', 'Parcial'] },
    { key: 'obs', label: 'Anotações importantes', type: 'textarea' },
  ],
  cumprimento: [
    { key: 'protocolado', label: 'Cumprimento de sentença protocolado?', type: 'radio', options: ['Sim', 'Ainda não'] },
    { key: 'valor_calculo', label: 'Valor do cálculo', type: 'currency' },
    { key: 'numero_cs', label: 'Número dos autos de CS', type: 'text' },
  ],
  arq_provisorio: [{ key: 'motivo', label: 'Motivo do arquivamento provisório', type: 'textarea' }],
  prestacao_contas: [
    { key: 'valor_alvara', label: 'Valor bruto do alvará', type: 'currency' },
    { key: 'sucumbencia', label: 'Honorários de sucumbência?', type: 'radio', options: ['Sim', 'Não'] },
    { key: 'valor_sucumbencia', label: 'Valor dos honorários de sucumbência', type: 'currency' },
    { key: 'honorarios_contratuais', label: 'Honorários contratuais', type: 'currency' },
    { key: 'valor_cliente', label: 'Valor do cliente', type: 'currency' },
  ],
  suspenso: [{ key: 'motivo', label: 'Motivo da suspensão/sobrestamento', type: 'textarea' }],
  arquivado: [{ key: 'motivo', label: 'Motivo do arquivamento', type: 'textarea' }],
  abandonado: [{ key: 'motivo', label: 'Motivo', type: 'textarea' }],
  perdidos_valeska: [{ key: 'motivo', label: 'Motivo', type: 'textarea' }],
  jackson: [{ key: 'obs', label: 'Observações', type: 'textarea' }],
};

const INPUT = 'h-9 w-full rounded-lg border border-[#cfe0ed] bg-transparent px-2.5 text-sm text-[#101820] outline-none focus:border-[#4a90e2] dark:border-zinc-700 dark:text-zinc-200';

export function FaseFields({ caseId, phase, data }: { caseId: string; phase: string; data: Record<string, any> }) {
  const fields = FASE_FORMS[phase];
  const qc = useQueryClient();
  const [vals, setVals] = useState<Record<string, any>>(data ?? {});
  useEffect(() => { setVals(data ?? {}); }, [data, phase]);

  const save = async (key: string, value: any) => {
    setVals((v) => ({ ...v, [key]: value }));
    try {
      await legalCasesService.saveFaseField(caseId, phase, key, value);
      qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] });
    } catch { toast.error('Erro ao salvar'); }
  };

  if (!fields || fields.length === 0) return null;

  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <div key={f.key}>
          <p className="mb-1.5 text-sm font-medium text-[#101820] dark:text-zinc-200">{f.label}</p>
          <FieldInput field={f} value={vals[f.key]} onSave={(v) => save(f.key, v)} />
        </div>
      ))}
    </div>
  );
}

function FieldInput({ field, value, onSave }: { field: Field; value: any; onSave: (v: any) => void }) {
  const [local, setLocal] = useState(value ?? '');
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setLocal(value ?? ''); }, [value]);

  if (field.type === 'checklist') {
    const obj: Record<string, boolean> = value ?? {};
    return (
      <ul className="space-y-2">
        {field.options!.map((opt) => (
          <li key={opt}>
            <button onClick={() => onSave({ ...obj, [opt]: !obj[opt] })} className="flex items-center gap-2 text-left">
              <span className={`flex h-4 w-4 items-center justify-center rounded-sm border ${obj[opt] ? 'border-[#228BE6] bg-[#228BE6]' : 'border-zinc-300 dark:border-zinc-600'}`}>
                {obj[opt] && <Check className="h-3 w-3 text-white" />}
              </span>
              <span className={`text-[13px] ${obj[opt] ? 'text-zinc-400 line-through' : 'text-[#4b5863] dark:text-zinc-300'}`}>{opt}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  if (field.type === 'radio') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {field.options!.map((opt) => (
          <button key={opt} onClick={() => onSave(value === opt ? '' : opt)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${value === opt ? 'border-[#228BE6] bg-[#228BE6] text-white' : 'border-[#cfe0ed] text-[#4b5863] hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}>
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <select value={value ?? ''} onChange={(e) => onSave(e.target.value)} className={INPUT}>
        <option value="">—</option>
        {field.options!.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          if (debRef.current) clearTimeout(debRef.current);
          debRef.current = setTimeout(() => onSave(e.target.value), 700);
        }}
        onBlur={() => onSave(local)}
        rows={2}
        className="w-full rounded-lg border border-[#cfe0ed] bg-transparent px-2.5 py-1.5 text-sm text-[#101820] outline-none focus:border-[#4a90e2] dark:border-zinc-700 dark:text-zinc-200"
      />
    );
  }

  const inputType = field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : 'text';
  return (
    <input
      type={inputType}
      value={local}
      placeholder={field.type === 'currency' ? 'R$ 0,00' : undefined}
      onChange={(e) => { setLocal(e.target.value); if (inputType !== 'text') onSave(e.target.value); }}
      onBlur={() => onSave(local)}
      className={INPUT}
    />
  );
}
