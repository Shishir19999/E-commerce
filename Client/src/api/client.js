import axios from 'axios';
import { createDemoApi } from '../demo/server.js';
import { artUri, fallbackArt } from '../lib/art.js';

export const DEMO = import.meta.env.VITE_DEMO === 'true';
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const real = axios.create({ baseURL: API_BASE });
real.interceptors.request.use((config) => {
  try {
    const stored = JSON.parse(localStorage.getItem('auth') || 'null');
    if (stored?.token) config.headers.Authorization = `Bearer ${stored.token}`;
  } catch {
    /* corrupt storage */
  }
  return config;
});

// Same get/post/put/delete surface in both modes; the demo one runs entirely in the browser.
const API = DEMO ? createDemoApi() : real;
export default API;

export const resetDemo = () => (DEMO ? API.resetDemo() : Promise.resolve());

// photo may be an absolute URL, an "art:" spec (bundled artwork), a data URI or an /uploads path on the API
export const photoUrl = (photo, name) => {
  if (!photo) return fallbackArt(name);
  if (photo.startsWith('art:')) return artUri(photo);
  return photo.startsWith('/') ? API_BASE + photo : photo;
};

export const errMsg = (e, fallback = 'Something went wrong') => e?.response?.data?.message || fallback;
