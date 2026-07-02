// Gerado do export do Astrea (FINANCEIRO.pdf, mai/2025->jun/2026). 157 saidas, total R$ 114.936,68.
// Cada linha bate com o "Total de saidas" mensal do Astrea. Usado no botao "Lancar gastos retroativos".
export interface AstreaDespesa { data: string; valor: number; categoria: string; party: string }

// Aportes que cobriram o déficit do escritório (Você + Pai), distribuídos pelos meses de aperto.
// Total = R$ 29.826,10 = déficit acumulado do Astrea (receitas 85.110,58 − despesas 114.936,68).
// Divisão você×pai desconhecida → tudo como "Aporte (Você + Pai)", editável depois.
export interface Aporte { data: string; valor: number }
export const APORTES: Aporte[] = [
  { data: '30/08/2025', valor: 126.23 },
  { data: '30/09/2025', valor: 8968.97 },
  { data: '30/11/2025', valor: 6923.86 },
  { data: '30/12/2025', valor: 10961.57 },
  { data: '30/01/2026', valor: 1710.47 },
  { data: '30/06/2026', valor: 1135.00 },
];

export const ASTREA_DESPESAS: AstreaDespesa[] = [
  {
    "data": "20/06/2025",
    "valor": 599.03,
    "categoria": "Pró-labore",
    "party": "Matheus Frider Andrade Quebra de Caixa"
  },
  {
    "data": "20/07/2025",
    "valor": 58.9,
    "categoria": "Suprimentos escritório",
    "party": "JusBrasil JusBrasil"
  },
  {
    "data": "20/07/2025",
    "valor": 597.0,
    "categoria": "Suprimentos escritório",
    "party": "Pipefy Dodofy/Pipefy"
  },
  {
    "data": "20/07/2025",
    "valor": 797.0,
    "categoria": "Suprimentos escritório",
    "party": "Euro Júnior IRON"
  },
  {
    "data": "20/07/2025",
    "valor": 24.25,
    "categoria": "Suprimentos escritório",
    "party": "Canva Canva PRO"
  },
  {
    "data": "20/07/2025",
    "valor": 600.13,
    "categoria": "Suprimentos escritório",
    "party": "Facebook Meta Ads"
  },
  {
    "data": "20/07/2025",
    "valor": 301.32,
    "categoria": "Suprimentos escritório",
    "party": "Astrea Astrea"
  },
  {
    "data": "20/07/2025",
    "valor": 1250.0,
    "categoria": "Suprimentos escritório",
    "party": "José Raphael Freire PRO Club"
  },
  {
    "data": "20/07/2025",
    "valor": 109.9,
    "categoria": "Suprimentos escritório",
    "party": "ZapSign ZapSign"
  },
  {
    "data": "20/07/2025",
    "valor": 99.0,
    "categoria": "Suprimentos escritório",
    "party": "Adapta Adapta"
  },
  {
    "data": "20/07/2025",
    "valor": 497.0,
    "categoria": "Suprimentos escritório",
    "party": "Líder Hub Líder Hub"
  },
  {
    "data": "20/07/2025",
    "valor": 450.0,
    "categoria": "Simples Nacional",
    "party": "RFB - Receita Federal do Brasil Simples Nacional"
  },
  {
    "data": "20/07/2025",
    "valor": 450.0,
    "categoria": "Contador",
    "party": "K3 Contabilidade Contabilidade"
  },
  {
    "data": "20/07/2025",
    "valor": 90.74,
    "categoria": "Anuidade OAB",
    "party": "OAB/PR Anuidade"
  },
  {
    "data": "20/07/2025",
    "valor": 137.8,
    "categoria": "Suprimentos escritório",
    "party": "Cálculo Jurídico Cálculo Jurídico"
  },
  {
    "data": "21/07/2025",
    "valor": 123.0,
    "categoria": "Anuidade OAB",
    "party": "OAB/PR Requerimento - Certidão Intei…"
  },
  {
    "data": "23/07/2025",
    "valor": 418.81,
    "categoria": "Anuidade OAB",
    "party": "OAB/SC Taxa de Inscrição - OAB suple…"
  },
  {
    "data": "24/07/2025",
    "valor": 45.38,
    "categoria": "Suprimentos escritório",
    "party": "Cartório Distribuidor Maringá/PR Emissão de Certidão Cível e C…"
  },
  {
    "data": "05/08/2025",
    "valor": 99.0,
    "categoria": "Suprimentos escritório",
    "party": "Adapta Adapta"
  },
  {
    "data": "05/08/2025",
    "valor": 137.8,
    "categoria": "Suprimentos escritório",
    "party": "Cálculo Jurídico Cálculo Jurídico"
  },
  {
    "data": "05/08/2025",
    "valor": 497.0,
    "categoria": "Suprimentos escritório",
    "party": "Líder Hub Líder Hub"
  },
  {
    "data": "05/08/2025",
    "valor": 6000.0,
    "categoria": "Suprimentos escritório",
    "party": "ADVLIDER CURSOS LTDA Operações Escaláveis"
  },
  {
    "data": "05/08/2025",
    "valor": 58.9,
    "categoria": "Suprimentos escritório",
    "party": "JusBrasil JusBrasil"
  },
  {
    "data": "05/08/2025",
    "valor": 301.32,
    "categoria": "Suprimentos escritório",
    "party": "Astrea Astrea"
  },
  {
    "data": "05/08/2025",
    "valor": 90.74,
    "categoria": "Anuidade OAB",
    "party": "OAB/PR Anuidade"
  },
  {
    "data": "05/08/2025",
    "valor": 24.25,
    "categoria": "Suprimentos escritório",
    "party": "Canva Canva PRO"
  },
  {
    "data": "05/08/2025",
    "valor": 797.0,
    "categoria": "Suprimentos escritório",
    "party": "Euro Júnior IRON"
  },
  {
    "data": "05/08/2025",
    "valor": 109.9,
    "categoria": "Suprimentos escritório",
    "party": "ZapSign ZapSign"
  },
  {
    "data": "15/08/2025",
    "valor": 1250.0,
    "categoria": "Suprimentos escritório",
    "party": "José Raphael Freire PRO Club"
  },
  {
    "data": "20/08/2025",
    "valor": 470.58,
    "categoria": "Simples Nacional",
    "party": "RFB - Receita Federal do Brasil Simples Nacional"
  },
  {
    "data": "29/08/2025",
    "valor": 1000.0,
    "categoria": "Suprimentos escritório",
    "party": "Facebook/Meta Tráfego Pago"
  },
  {
    "data": "30/08/2025",
    "valor": 597.0,
    "categoria": "Suprimentos escritório",
    "party": "Pipefy Dodofy/Pipefy"
  },
  {
    "data": "30/08/2025",
    "valor": 2500.0,
    "categoria": "Suprimentos escritório",
    "party": "UP ADV Agência de Marketing/Tráfego"
  },
  {
    "data": "05/09/2025",
    "valor": 6000.0,
    "categoria": "Suprimentos escritório",
    "party": "ADVLIDER CURSOS LTDA Operações Escaláveis"
  },
  {
    "data": "20/09/2025",
    "valor": 58.9,
    "categoria": "Suprimentos escritório",
    "party": "JusBrasil JusBrasil"
  },
  {
    "data": "20/09/2025",
    "valor": 109.9,
    "categoria": "Suprimentos escritório",
    "party": "ZapSign ZapSign"
  },
  {
    "data": "20/09/2025",
    "valor": 450.0,
    "categoria": "Contador",
    "party": "K3 Contabilidade Contabilidade"
  },
  {
    "data": "20/09/2025",
    "valor": 2500.0,
    "categoria": "Suprimentos escritório",
    "party": "UP ADV Agência de Marketing/Tráfego"
  },
  {
    "data": "29/09/2025",
    "valor": 301.32,
    "categoria": "Suprimentos escritório",
    "party": "Astrea Astrea"
  },
  {
    "data": "30/09/2025",
    "valor": 99.0,
    "categoria": "Suprimentos escritório",
    "party": "Adapta Adapta"
  },
  {
    "data": "30/09/2025",
    "valor": 597.0,
    "categoria": "Suprimentos escritório",
    "party": "Pipefy Dodofy/Pipefy"
  },
  {
    "data": "30/09/2025",
    "valor": 797.0,
    "categoria": "Suprimentos escritório",
    "party": "Euro Júnior IRON"
  },
  {
    "data": "30/09/2025",
    "valor": 90.74,
    "categoria": "Anuidade OAB",
    "party": "OAB/PR Anuidade"
  },
  {
    "data": "30/09/2025",
    "valor": 137.8,
    "categoria": "Suprimentos escritório",
    "party": "Cálculo Jurídico Cálculo Jurídico"
  },
  {
    "data": "30/09/2025",
    "valor": 450.0,
    "categoria": "Simples Nacional",
    "party": "Sérgio Dias de Mello Simples Nacional"
  },
  {
    "data": "30/09/2025",
    "valor": 1250.0,
    "categoria": "Suprimentos escritório",
    "party": "José Raphael Freire PRO Club"
  },
  {
    "data": "30/09/2025",
    "valor": 24.25,
    "categoria": "Suprimentos escritório",
    "party": "Canva Canva PRO"
  },
  {
    "data": "30/09/2025",
    "valor": 1000.0,
    "categoria": "Suprimentos escritório",
    "party": "Facebook/Meta Tráfego Pago"
  },
  {
    "data": "30/09/2025",
    "valor": 497.0,
    "categoria": "Suprimentos escritório",
    "party": "Líder Hub Líder Hub"
  },
  {
    "data": "23/10/2025",
    "valor": 1250.0,
    "categoria": "Suprimentos escritório",
    "party": "José Raphael Freire PRO Club"
  },
  {
    "data": "23/10/2025",
    "valor": 90.74,
    "categoria": "Anuidade OAB",
    "party": "OAB/PR Anuidade"
  },
  {
    "data": "23/10/2025",
    "valor": 6000.0,
    "categoria": "Suprimentos escritório",
    "party": "ADVLIDER CURSOS LTDA Operações Escaláveis"
  },
  {
    "data": "23/10/2025",
    "valor": 1000.0,
    "categoria": "Suprimentos escritório",
    "party": "Facebook/Meta Tráfego Pago"
  },
  {
    "data": "23/10/2025",
    "valor": 797.0,
    "categoria": "Suprimentos escritório",
    "party": "Euro Júnior IRON"
  },
  {
    "data": "23/10/2025",
    "valor": 24.25,
    "categoria": "Suprimentos escritório",
    "party": "Canva Canva PRO"
  },
  {
    "data": "27/10/2025",
    "valor": 2923.88,
    "categoria": "Repasse honorários",
    "party": "Janine Alves de Freitas Honorários 30% - Ação João …"
  },
  {
    "data": "30/10/2025",
    "valor": 597.0,
    "categoria": "Suprimentos escritório",
    "party": "Pipefy Pipefy"
  },
  {
    "data": "30/10/2025",
    "valor": 497.0,
    "categoria": "Suprimentos escritório",
    "party": "Líder Hub LíderHub"
  },
  {
    "data": "30/10/2025",
    "valor": 301.32,
    "categoria": "Suprimentos escritório",
    "party": "Astrea Assinatura Astrea"
  },
  {
    "data": "30/10/2025",
    "valor": 450.0,
    "categoria": "Contador",
    "party": "K3 Contabilidade Contador"
  },
  {
    "data": "30/10/2025",
    "valor": 137.8,
    "categoria": "Suprimentos escritório",
    "party": "Cálculo Jurídico Assinatura - CJ"
  },
  {
    "data": "30/10/2025",
    "valor": 109.9,
    "categoria": "Suprimentos escritório",
    "party": "ZapSign Assinatura ZapSign"
  },
  {
    "data": "30/10/2025",
    "valor": 58.9,
    "categoria": "Suprimentos escritório",
    "party": "JusBrasil JusBrasil"
  },
  {
    "data": "30/10/2025",
    "valor": 99.0,
    "categoria": "Suprimentos escritório",
    "party": "Adapta IA Adapta"
  },
  {
    "data": "30/10/2025",
    "valor": 450.0,
    "categoria": "Simples Nacional",
    "party": "RFB - Receita Federal do Brasil Simples Nacional"
  },
  {
    "data": "30/10/2025",
    "valor": 2500.0,
    "categoria": "Suprimentos escritório",
    "party": "UP ADV Agência de Marketing/Tráfego"
  },
  {
    "data": "28/11/2025",
    "valor": 109.9,
    "categoria": "Suprimentos escritório",
    "party": "ZapSign Assinatura ZapSign"
  },
  {
    "data": "28/11/2025",
    "valor": 137.8,
    "categoria": "Suprimentos escritório",
    "party": "Cálculo Jurídico Assinatura - CJ"
  },
  {
    "data": "28/11/2025",
    "valor": 24.25,
    "categoria": "Suprimentos escritório",
    "party": "Canva Canva PRO"
  },
  {
    "data": "28/11/2025",
    "valor": 301.32,
    "categoria": "Suprimentos escritório",
    "party": "Astrea Assinatura Astrea"
  },
  {
    "data": "28/11/2025",
    "valor": 1250.0,
    "categoria": "Suprimentos escritório",
    "party": "José Raphael Freire PRO Club"
  },
  {
    "data": "28/11/2025",
    "valor": 99.0,
    "categoria": "Suprimentos escritório",
    "party": "Adapta IA Adapta"
  },
  {
    "data": "28/11/2025",
    "valor": 58.9,
    "categoria": "Suprimentos escritório",
    "party": "JusBrasil JusBrasil"
  },
  {
    "data": "28/11/2025",
    "valor": 597.0,
    "categoria": "Suprimentos escritório",
    "party": "Pipefy Pipefy"
  },
  {
    "data": "28/11/2025",
    "valor": 1000.0,
    "categoria": "Suprimentos escritório",
    "party": "Facebook/Meta Tráfego Pago"
  },
  {
    "data": "28/11/2025",
    "valor": 6000.0,
    "categoria": "Suprimentos escritório",
    "party": "ADVLIDER CURSOS LTDA Operações Escaláveis"
  },
  {
    "data": "28/11/2025",
    "valor": 2500.0,
    "categoria": "Suprimentos escritório",
    "party": "UP ADV Agência de Marketing/Tráf…"
  },
  {
    "data": "28/11/2025",
    "valor": 90.74,
    "categoria": "Anuidade OAB",
    "party": "OAB/PR Anuidade"
  },
  {
    "data": "28/11/2025",
    "valor": 497.0,
    "categoria": "Suprimentos escritório",
    "party": "Líder Hub LíderHub"
  },
  {
    "data": "28/11/2025",
    "valor": 450.0,
    "categoria": "Contador",
    "party": "K3 Contabilidade Contador"
  },
  {
    "data": "28/11/2025",
    "valor": 797.0,
    "categoria": "Suprimentos escritório",
    "party": "Euro Júnior IRON"
  },
  {
    "data": "05/12/2025",
    "valor": 450.0,
    "categoria": "Simples Nacional",
    "party": "RFB - Receita Federal do Brasil Simples Nacional"
  },
  {
    "data": "16/12/2025",
    "valor": 6000.0,
    "categoria": "Suprimentos escritório",
    "party": "ADVLIDER CURSOS LTDA Operações Escaláveis"
  },
  {
    "data": "16/12/2025",
    "valor": 58.9,
    "categoria": "Suprimentos escritório",
    "party": "JusBrasil JusBrasil"
  },
  {
    "data": "16/12/2025",
    "valor": 99.0,
    "categoria": "Suprimentos escritório",
    "party": "Adapta IA Adapta"
  },
  {
    "data": "16/12/2025",
    "valor": 797.0,
    "categoria": "Suprimentos escritório",
    "party": "Euro Júnior IRON"
  },
  {
    "data": "16/12/2025",
    "valor": 497.0,
    "categoria": "Suprimentos escritório",
    "party": "Líder Hub LíderHub"
  },
  {
    "data": "16/12/2025",
    "valor": 109.9,
    "categoria": "Suprimentos escritório",
    "party": "ZapSign Assinatura ZapSign"
  },
  {
    "data": "16/12/2025",
    "valor": 137.8,
    "categoria": "Suprimentos escritório",
    "party": "Cálculo Jurídico Assinatura - CJ"
  },
  {
    "data": "16/12/2025",
    "valor": 24.25,
    "categoria": "Suprimentos escritório",
    "party": "Canva Canva PRO"
  },
  {
    "data": "16/12/2025",
    "valor": 301.32,
    "categoria": "Suprimentos escritório",
    "party": "Astrea Assinatura Astrea"
  },
  {
    "data": "16/12/2025",
    "valor": 450.0,
    "categoria": "Contador",
    "party": "K3 Contabilidade Contador"
  },
  {
    "data": "16/12/2025",
    "valor": 450.0,
    "categoria": "Simples Nacional",
    "party": "RFB - Receita Federal do Brasil Simples Nacional"
  },
  {
    "data": "30/12/2025",
    "valor": 2500.0,
    "categoria": "Suprimentos escritório",
    "party": "UP ADV Agência de Marketing/Tráf…"
  },
  {
    "data": "30/12/2025",
    "valor": 597.0,
    "categoria": "Suprimentos escritório",
    "party": "Pipefy Pipefy"
  },
  {
    "data": "20/01/2026",
    "valor": 450.0,
    "categoria": "Simples Nacional",
    "party": "RFB - Receita Federal do Brasil Simples Nacional"
  },
  {
    "data": "20/01/2026",
    "valor": 6000.0,
    "categoria": "Suprimentos escritório",
    "party": "ADVLIDER CURSOS LTDA Operações Escaláveis"
  },
  {
    "data": "20/01/2026",
    "valor": 301.32,
    "categoria": "Suprimentos escritório",
    "party": "Astrea Assinatura Astrea"
  },
  {
    "data": "20/01/2026",
    "valor": 450.0,
    "categoria": "Contador",
    "party": "K3 Contabilidade Contador"
  },
  {
    "data": "20/01/2026",
    "valor": 137.8,
    "categoria": "Suprimentos escritório",
    "party": "Cálculo Jurídico Assinatura - CJ"
  },
  {
    "data": "20/01/2026",
    "valor": 99.0,
    "categoria": "Suprimentos escritório",
    "party": "Adapta IA Adapta"
  },
  {
    "data": "20/01/2026",
    "valor": 24.25,
    "categoria": "Suprimentos escritório",
    "party": "Canva Canva PRO"
  },
  {
    "data": "20/01/2026",
    "valor": 497.0,
    "categoria": "Suprimentos escritório",
    "party": "Líder Hub LíderHub"
  },
  {
    "data": "20/01/2026",
    "valor": 109.9,
    "categoria": "Suprimentos escritório",
    "party": "ZapSign Assinatura ZapSign"
  },
  {
    "data": "20/01/2026",
    "valor": 58.9,
    "categoria": "Suprimentos escritório",
    "party": "JusBrasil JusBrasil"
  },
  {
    "data": "20/01/2026",
    "valor": 597.0,
    "categoria": "Suprimentos escritório",
    "party": "Pipefy Pipefy"
  },
  {
    "data": "30/01/2026",
    "valor": 2500.0,
    "categoria": "Suprimentos escritório",
    "party": "UP ADV Agência de Marketing/Trá…"
  },
  {
    "data": "06/02/2026",
    "valor": 597.0,
    "categoria": "Suprimentos escritório",
    "party": "Pipefy Pipefy"
  },
  {
    "data": "06/02/2026",
    "valor": 137.8,
    "categoria": "Suprimentos escritório",
    "party": "Cálculo Jurídico Assinatura - CJ"
  },
  {
    "data": "06/02/2026",
    "valor": 301.32,
    "categoria": "Suprimentos escritório",
    "party": "Astrea Assinatura Astrea"
  },
  {
    "data": "06/02/2026",
    "valor": 497.0,
    "categoria": "Suprimentos escritório",
    "party": "Líder Hub LíderHub"
  },
  {
    "data": "06/02/2026",
    "valor": 450.0,
    "categoria": "Simples Nacional",
    "party": "RFB - Receita Federal do Brasil Simples Nacional"
  },
  {
    "data": "06/02/2026",
    "valor": 24.25,
    "categoria": "Suprimentos escritório",
    "party": "Canva Canva PRO"
  },
  {
    "data": "06/02/2026",
    "valor": 99.0,
    "categoria": "Suprimentos escritório",
    "party": "Adapta IA Adapta"
  },
  {
    "data": "06/02/2026",
    "valor": 195.0,
    "categoria": "Contador",
    "party": "Contabilizei Contador"
  },
  {
    "data": "06/02/2026",
    "valor": 58.9,
    "categoria": "Suprimentos escritório",
    "party": "JusBrasil JusBrasil"
  },
  {
    "data": "06/02/2026",
    "valor": 109.9,
    "categoria": "Suprimentos escritório",
    "party": "ZapSign Assinatura ZapSign"
  },
  {
    "data": "26/03/2026",
    "valor": 450.0,
    "categoria": "Simples Nacional",
    "party": "RFB - Receita Federal do Brasil Simples Nacional"
  },
  {
    "data": "26/03/2026",
    "valor": 99.0,
    "categoria": "Suprimentos escritório",
    "party": "Adapta IA Adapta"
  },
  {
    "data": "26/03/2026",
    "valor": 497.0,
    "categoria": "Suprimentos escritório",
    "party": "Líder Hub LíderHub"
  },
  {
    "data": "26/03/2026",
    "valor": 24.25,
    "categoria": "Suprimentos escritório",
    "party": "Canva Canva PRO"
  },
  {
    "data": "26/03/2026",
    "valor": 301.32,
    "categoria": "Suprimentos escritório",
    "party": "Astrea Assinatura Astrea"
  },
  {
    "data": "26/03/2026",
    "valor": 195.0,
    "categoria": "Contador",
    "party": "Contabilizei Contador"
  },
  {
    "data": "26/03/2026",
    "valor": 58.9,
    "categoria": "Suprimentos escritório",
    "party": "JusBrasil JusBrasil"
  },
  {
    "data": "26/03/2026",
    "valor": 137.8,
    "categoria": "Suprimentos escritório",
    "party": "Cálculo Jurídico Assinatura - CJ"
  },
  {
    "data": "26/03/2026",
    "valor": 109.9,
    "categoria": "Suprimentos escritório",
    "party": "ZapSign Assinatura ZapSign"
  },
  {
    "data": "06/04/2026",
    "valor": 2850.0,
    "categoria": "Aluguel",
    "party": "Top Oce Aluguel"
  },
  {
    "data": "10/04/2026",
    "valor": 750.0,
    "categoria": "Suprimentos escritório",
    "party": "Capta Já Agência de Marketing"
  },
  {
    "data": "10/04/2026",
    "valor": 195.0,
    "categoria": "Contador",
    "party": "Contabilizei Contador"
  },
  {
    "data": "23/04/2026",
    "valor": 450.0,
    "categoria": "Anuidade OAB",
    "party": "OAB Nacional Anuidades"
  },
  {
    "data": "24/04/2026",
    "valor": 24.25,
    "categoria": "Suprimentos escritório",
    "party": "Canva Canva PRO"
  },
  {
    "data": "30/04/2026",
    "valor": 275.0,
    "categoria": "Suprimentos escritório",
    "party": "ZapSign Assinatura ZapSign"
  },
  {
    "data": "30/04/2026",
    "valor": 450.0,
    "categoria": "Simples Nacional",
    "party": "RFB - Receita Federal do Brasil Simples Nacional"
  },
  {
    "data": "30/04/2026",
    "valor": 1500.0,
    "categoria": "Suprimentos escritório",
    "party": "Facebook do Brasil S/A Tráfego pago"
  },
  {
    "data": "30/04/2026",
    "valor": 497.0,
    "categoria": "Suprimentos escritório",
    "party": "Líder Hub LíderHub"
  },
  {
    "data": "30/04/2026",
    "valor": 301.32,
    "categoria": "Suprimentos escritório",
    "party": "Astrea Assinatura Astrea"
  },
  {
    "data": "30/04/2026",
    "valor": 110.0,
    "categoria": "Anuidade OAB",
    "party": "OAB/PR Anuidade - Julia"
  },
  {
    "data": "30/04/2026",
    "valor": 58.9,
    "categoria": "Suprimentos escritório",
    "party": "JusBrasil JusBrasil"
  },
  {
    "data": "30/04/2026",
    "valor": 137.8,
    "categoria": "Suprimentos escritório",
    "party": "Cálculo Jurídico Assinatura - CJ"
  },
  {
    "data": "01/05/2026",
    "valor": 750.0,
    "categoria": "Suprimentos escritório",
    "party": "Capta Já Agência de Marketing"
  },
  {
    "data": "06/05/2026",
    "valor": 195.0,
    "categoria": "Contador",
    "party": "Contabilizei Contador"
  },
  {
    "data": "12/05/2026",
    "valor": 2850.0,
    "categoria": "Aluguel",
    "party": "Top Oce Aluguel"
  },
  {
    "data": "19/05/2026",
    "valor": 58.9,
    "categoria": "Suprimentos escritório",
    "party": "JusBrasil JusBrasil"
  },
  {
    "data": "19/05/2026",
    "valor": 1500.0,
    "categoria": "Suprimentos escritório",
    "party": "Facebook do Brasil S/A Tráfego pago"
  },
  {
    "data": "19/05/2026",
    "valor": 450.0,
    "categoria": "Anuidade OAB",
    "party": "OAB Nacional Anuidades"
  },
  {
    "data": "19/05/2026",
    "valor": 450.0,
    "categoria": "Simples Nacional",
    "party": "RFB - Receita Federal do Brasil Simples Nacional"
  },
  {
    "data": "19/05/2026",
    "valor": 497.0,
    "categoria": "Suprimentos escritório",
    "party": "Líder Hub LíderHub"
  },
  {
    "data": "19/05/2026",
    "valor": 301.32,
    "categoria": "Suprimentos escritório",
    "party": "Astrea Assinatura Astrea"
  },
  {
    "data": "19/05/2026",
    "valor": 109.9,
    "categoria": "Suprimentos escritório",
    "party": "ZapSign Assinatura ZapSign"
  },
  {
    "data": "19/05/2026",
    "valor": 110.0,
    "categoria": "Anuidade OAB",
    "party": "OAB/PR Anuidade - Julia"
  },
  {
    "data": "30/05/2026",
    "valor": 24.25,
    "categoria": "Suprimentos escritório",
    "party": "Canva Canva PRO"
  },
  {
    "data": "08/06/2026",
    "valor": 2850.0,
    "categoria": "Aluguel",
    "party": "Top Oce Aluguel"
  },
  {
    "data": "08/06/2026",
    "valor": 750.0,
    "categoria": "Suprimentos escritório",
    "party": "Capta Já Agência de Marketing"
  },
  {
    "data": "15/06/2026",
    "valor": 195.0,
    "categoria": "Contador",
    "party": "Contabilizei Contador"
  },
  {
    "data": "30/06/2026",
    "valor": 1500.0,
    "categoria": "Suprimentos escritório",
    "party": "Facebook do Brasil S/A Tráfego pago"
  },
  {
    "data": "30/06/2026",
    "valor": 450.0,
    "categoria": "Anuidade OAB",
    "party": "OAB Nacional Anuidades"
  },
  {
    "data": "30/06/2026",
    "valor": 110.0,
    "categoria": "Anuidade OAB",
    "party": "OAB/PR Anuidade - Julia"
  }
];
