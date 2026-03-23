import api from './api';

export const authService = {
  async login(code, deviceId, deviceInfo) {
    return api.post('/auth/login', {
      code,
      device_id: deviceId,
      device_info: deviceInfo,
    });
  },

  async getUserInfo() {
    return api.get('/auth/me');
  },

  async updateUserInfo(data) {
    return api.put('/auth/me', data);
  },

  async logout() {
    return api.post('/auth/logout');
  },

  async refreshToken(token) {
    return api.post('/auth/refresh', { token });
  },

  isAuthenticated() {
    return !!localStorage.getItem('token');
  },

  getToken() {
    return localStorage.getItem('token');
  },

  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  setToken(token) {
    localStorage.setItem('token', token);
  },

  setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  },

  clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
};