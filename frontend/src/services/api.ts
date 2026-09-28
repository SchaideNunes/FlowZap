import axios from 'axios';

// Detecta dinamicamente o IP ou hostname atual da máquina-sede para conexões via rede local
const backendHost = window.location.hostname;
const API_BASE_URL = `http://${backendHost}:3001/api`;

export const api = axios.create({
  baseURL: API_BASE_URL,
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
