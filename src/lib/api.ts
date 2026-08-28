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
    const message = error.response?.data?.message || error.message;
    return Promise.reject(new Error(Array.isArray(message) ? message[0] : message));
  },
);
