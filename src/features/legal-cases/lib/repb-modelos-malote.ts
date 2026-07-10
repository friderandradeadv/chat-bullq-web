// Modelos de MALOTE / solicitações copiáveis do REPB (os que o escritório tinha no
// Pipefy) — texto pronto pra colar no Consumidor.gov / BACEN / e-mail. Campos
// entre [colchetes] são preenchidos pelo cliente/advogado antes de enviar.

export interface ModeloMalote {
  id: string;
  titulo: string;
  canal: string;       // onde colar
  descricao?: string;
  texto: string;
}

export const MODELOS_MALOTE: ModeloMalote[] = [
  {
    id: 'dda',
    titulo: 'Cancelamento do DDA (débitos automáticos)',
    canal: 'BACEN / Consumidor.gov',
    descricao: 'Cancela os débitos automáticos e pede pagamento por boleto (Res. BACEN 4.790/2020).',
    texto: `Venho, por meio desta, solicitar o CANCELAMENTO DE AUTORIZAÇÃO DE DÉBITOS AUTOMÁTICOS EM MINHA CONTA CORRENTE, CONTA SALÁRIO E CONTA POUPANÇA DE TODOS OS CONTRATOS VIGENTES, seja, cartão de crédito, cheque especial, empréstimos e financiamentos, conforme as disposições da Resolução BACEN nº 4790 de 26/03/2020. Solicito que encaminhem outra forma de pagamento, qual seja via Boleto.

Com base no Art. 6º da mencionada resolução, é meu direito assegurado o cancelamento da autorização de débitos. De acordo com o Art. 7º, o cancelamento deve ser formalizado através da instituição destinatária, seguindo os procedimentos ali descritos.

Desta forma, solicito que seja observado o procedimento abaixo:
• Requisição de cancelamento recebida por mim em até dois dias úteis contados do recebimento da minha solicitação.
• A comunicação entre as instituições destinatária e depositária deve ser realizada por meio eletrônico, conforme o § 1º do art. 5º da Resolução BACEN nº 4790. É solicitado que seja efetuada com antecedência mínima de um dia útil para a efetivação do cancelamento do débito pela instituição depositária.

Conforme o Art. 8º da mesma resolução, a instituição depositária deve comunicar ao titular da conta e à instituição destinatária o acatamento do cancelamento da autorização de débitos em até dois dias úteis contados da data do recebimento da minha solicitação.

Saliento que o cancelamento refere-se a operações de débito específicas, conforme previsto no Art. 4º da Resolução BACEN nº 4790. Desta forma, reforço o meu direito, como titular da conta, de solicitar o cancelamento por meio da instituição destinatária, de acordo com o caput do Art. 6º da resolução.

Agradeço a atenção dispensada a esta solicitação e aguardo a confirmação do cancelamento nos termos estabelecidos pela legislação.

Atenciosamente,`,
  },
  {
    id: 'malote_completo',
    titulo: 'Malote extrajudicial — completo',
    canal: 'BACEN / e-mail',
    descricao: 'Pedido de auditoria: contratos (10 anos), planilha de evolução, taxas, extratos (5 anos) e o valor provisionado.',
    texto: `Venho, por meio desta, requerer, para fins de auditoria e verificação da regularidade da relação contratual, a apresentação dos documentos e informações relativas aos Contratos junto a esta Instituição financeira, e em relação aos empréstimos firmados nesta instituição, bem como, relação de outras dívidas contratuais.

Foi constatada a ausência de entrega documental suficiente para apuração da origem e evolução da dívida atualmente cobrada, especialmente quanto à existência de contratos anteriores, renegociações não formalizadas e lançamentos recorrentes que impossibilitam a compreensão adequada do saldo devedor. A situação configura violação ao direito à informação e fragiliza a transparência exigida nas relações de crédito.

Fundamentação normativa: A presente solicitação encontra amparo no art. 6º, III, IV e art. 46 do Código de Defesa do Consumidor, que garantem o direito à informação adequada e prévia, nos arts. 104 e 107 do Código Civil, que exigem manifestação válida de vontade para formação do contrato, no art. 2º, §3º da Resolução CMN nº 5.004/2022, no art. 4º da Resolução CMN nº 4.557/2017 e nos arts. 10 e 11 da Resolução BACEN nº 4.966/2021, que tratam da rastreabilidade, governança e provisão das operações de crédito.

Requer-se, no prazo de 10 (dez) dias úteis:
- Cópia integral dos contratos firmados nos últimos 10 (dez) anos, incluindo: operações principais; termos de renegociação; aditivos e repactuações sucessivas; instrumentos de consolidação de saldo; contratos extintos por portabilidade ou recompra;
- Cópia assinada de todos os instrumentos contratuais solicitados, como condição de validade da obrigação jurídica (arts. 104 e 107 do CC e art. 46 do CDC);
- Planilha detalhada da evolução do saldo devedor, com encargos, amortizações, capitalizações e multas aplicadas;
- Identificação das taxas de juros praticadas, periodicidade e forma de capitalização;
- Cópia dos extratos bancários e extratos da operação dos últimos 5 (cinco) anos, em formato PDF, com detalhamento de entradas, saídas, lançamentos vinculados à operação e datas de vencimentos;
- Informação sobre eventual provisão contábil já constituída para a operação, conforme os artigos 10 e 11 da Resolução BACEN nº 4.966/2021;
- Informação detalhada sobre o montante atualmente provisionado pelo banco em relação à(s) dívida(s) decorrente(s) dos contratos mencionados, discriminando valores por operação, conforme a legislação e normativos aplicáveis.

Advertência final: O não cumprimento da solicitação será considerado uma violação dos deveres legais e poderá resultar em medidas administrativas, judiciais e denúncias a órgãos como o Banco Central do Brasil (BACEN), em razão de descumprimento de normas do Conselho Monetário Nacional (CMN), à Secretaria Nacional do Consumidor (SENACON), aos órgãos de proteção e defesa do consumidor (PROCONs), ao Ministério Público e demais entidades de controle e fiscalização competentes, conforme a gravidade da conduta apurada.`,
  },
  {
    id: 'malote_consumidor',
    titulo: 'Malote — pedidos (Consumidor.gov)',
    canal: 'Consumidor.gov',
    descricao: 'A lista de pedidos, no formato que aparece na plataforma Consumidor.gov.',
    texto: `1. Cópia integral dos contratos firmados nos últimos 10 (dez) anos, incluindo:
• Operações principais;
• Termos de renegociação;
• Aditivos e repactuações sucessivas;
• Instrumentos de consolidação de saldo;
• Contratos extintos por portabilidade ou recompra;
2. Cópia assinada de todos os instrumentos contratuais solicitados, como condição de validade da obrigação jurídica (arts. 104 e 107 do CC e art. 46 do CDC);
3. Planilha detalhada da evolução do saldo devedor, com encargos, amortizações, capitalizações e multas aplicadas;
4. Identificação das taxas de juros praticadas, periodicidade e forma de capitalização;
5. Cópia dos extratos bancários e extratos da operação dos últimos 5 (cinco) anos, em formato PDF, com detalhamento de entradas, saídas, lançamentos vinculados à operação e datas de vencimentos;
6. Informação sobre eventual provisão contábil já constituída para a operação.`,
  },
  {
    id: 'malote_resumido',
    titulo: 'Malote — pedidos resumidos',
    canal: 'Consumidor.gov / BACEN',
    descricao: 'Versão curta dos pedidos, incluindo o valor provisionado por operação.',
    texto: `1. Cópia integral e assinada de todos os contratos dos últimos 10 anos, incluindo operações principais, renegociações, aditivos, repactuações, consolidações de saldo e contratos extintos.
2. Planilha detalhada da evolução do saldo devedor, com encargos, amortizações, capitalizações e multas.
3. Informação sobre taxas de juros aplicadas, periodicidade e forma de capitalização.
4. Extratos bancários e da operação dos últimos 5 anos, com detalhamento de lançamentos e vencimentos.
5. Informação sobre provisão contábil já constituída para as operações.
6. Valor atualmente provisionado pelo banco para cada dívida contratual, com discriminação por operação.`,
  },
  {
    id: 'curto_rmc',
    titulo: 'Curto — contratos e extratos de cartão RMC',
    canal: 'Consumidor.gov / BACEN',
    texto: `Solicito cópia dos contratos de cartão RMC nº [NÚMEROS DOS CARTÕES] e também os extratos desses cartões.`,
  },
  {
    id: 'curto_extratos',
    titulo: 'Curto — extratos dos últimos 5 anos',
    canal: 'Consumidor.gov / BACEN',
    texto: `Solicito cópia dos meus extratos dos últimos 5 anos, de acordo com a Resolução 5004/BACEN.`,
  },
  {
    id: 'curto_consignado',
    titulo: 'Curto — contratos de consignado',
    canal: 'Consumidor.gov / BACEN',
    texto: `Preciso da cópia dos meus contratos de empréstimo consignado com este banco.`,
  },
  {
    id: 'curto_imagem',
    titulo: 'Curto — contratos destacados na imagem',
    canal: 'Consumidor.gov / BACEN',
    texto: `Solicito a cópia de todos os contratos que estão destacados na(s) imagem(ns) anexada(s), tudo de acordo com a Resolução 5004 do BACEN.

Favor enviar os documentos no meu e-mail cadastrado.

Obrigado(a).`,
  },
];
