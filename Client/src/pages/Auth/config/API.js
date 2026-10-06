import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const API = axios.create({ baseURL: API_BASE });

// attach the JWT (if any) to every request
API.interceptors.request.use((config) => {
    try {
        const stored = JSON.parse(localStorage.getItem('auth') || 'null');
        if (stored?.token) config.headers.Authorization = `Bearer ${stored.token}`;
    } catch { /* ignore corrupt storage */ }
    return config;
});

// product photo may be an absolute URL or a /uploads/... path served by the API
export const photoUrl = (photo) => (!photo ? '' : photo.startsWith('/') ? API_BASE + photo : photo);

export const errMsg = (e, fallback = 'Something went wrong') => e?.response?.data?.message || fallback;

export default API;
