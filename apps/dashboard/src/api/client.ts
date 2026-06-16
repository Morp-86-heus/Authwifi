import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const LICENSE_ERRORS = ['Licenza scaduta', 'Account sospeso'];

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status;
    const detail: string = err.response?.data?.detail ?? '';

    if (status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    } else if (status === 403 && LICENSE_ERRORS.some((e) => detail.includes(e))) {
      useAuthStore.getState().setLicenseError(detail);
    }

    return Promise.reject(err);
  },
);

export default api;
