import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const orgId = localStorage.getItem('active_org_id');
    if (orgId) {
      config.headers['x-organization-id'] = orgId;
    }
    // "Ver como parceiro": enquanto ligado, TODA requisição vai com o recorte,
    // e o servidor devolve o que o parceiro receberia. Fica no interceptor de
    // propósito — se dependesse de cada chamada lembrar de mandar o cabeçalho,
    // a tela misturaria dados cortados com dados completos e a pré-visualização
    // mentiria justamente onde precisa ser fiel.
    const preview = localStorage.getItem('preview_partnership');
    if (preview) {
      config.headers['x-preview-partnership'] = preview;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken && !error.config._retry) {
        error.config._retry = true;
        try {
          const { data } = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            { refreshToken },
          );
          localStorage.setItem('access_token', data.data.accessToken);
          localStorage.setItem('refresh_token', data.data.refreshToken);
          error.config.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(error.config);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    // Resposta de erro de um endpoint `responseType: 'blob'` (PDF, XLSX) chega
    // como Blob: `data.message` é undefined e o usuário via "Request failed
    // with status code 400" no lugar da explicação do servidor. Medido em
    // 01/09/2026 no laudo de HISCON.
    let corpo: unknown = error.response?.data;
    if (corpo instanceof Blob) {
      try {
        corpo = JSON.parse(await corpo.text());
      } catch {
        corpo = undefined; // blob que não é JSON: cai na mensagem do axios
      }
    }
    const message = (corpo as { message?: string | string[] })?.message || error.message;
    // 🚨 O ERRO CARREGA AS DUAS FORMAS (21/10/2026). Rejeitar um `new Error`
    // seco apagava `error.response`, e o hub inteiro lê a recusa do servidor
    // como `e?.response?.data?.message`: são **530 lugares em 286 arquivos**,
    // todos caindo no texto genérico de reserva. Medido quando ele clicou em
    // "Pedir o extrato ao cliente" às 21h45: o servidor recusou com "São 21h.
    // Mensagem que parte do escritório sai das 6h às 20h, regra da casa", e a
    // tela disse "Não consegui mandar o pedido." — o que é indistinguível de
    // falha de rede, de card sem conversa ou de defeito no hub.
    //
    // Consertar nos 530 lugares seria uma varredura arriscada que amanhã outra
    // cópia desfaz. Aqui o erro passa a trazer `message` E `response`, e as duas
    // leituras funcionam. Os quatro lugares que testam `response?.status`
    // (conquistas, copiloto, barra de progresso, arquivar peça) voltam a fazer
    // o que o autor deles escreveu.
    const erro = new Error(Array.isArray(message) ? message[0] : message) as Error & {
      response?: unknown; status?: number; code?: string;
    };
    if (error.response) erro.response = { ...error.response, data: corpo };
    erro.status = error.response?.status;
    erro.code = error.code;
    return Promise.reject(erro);
  },
);
