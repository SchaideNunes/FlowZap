import axios from 'axios';

// Na Vercel (deploy de múltiplos serviços) e em produção, as requisições do navegador
// utilizam o prefixo relativo '/api', roteado automaticamente para o serviço backend.
// Em desenvolvimento, o proxy do Vite encaminha para o BACKEND_URL injetado ou localhost:3001.
const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return '/api';
};

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 20000,
});

// Interceptor para injetar o token JWT em todas as requisições autenticadas
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('flowzap_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de resposta para redirecionar em caso de 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('flowzap_token');
      localStorage.removeItem('flowzap_user');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);
