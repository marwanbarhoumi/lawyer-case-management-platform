import { api, type SessionPayload } from '@/lib/api-client';
import type { User } from '@/types/api';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface ProfileInput {
  firstName: string;
  lastName: string;
  phone?: string | null;
}

export const authService = {
  login: (input: LoginInput) => api.post<SessionPayload>('/api/auth/login', input),
  register: (input: RegisterInput) => api.post<SessionPayload>('/api/auth/register', input),
  logout: () => api.post<{ loggedOut: boolean }>('/api/auth/logout'),
  me: () => api.get<User>('/api/auth/me'),
  updateProfile: (input: ProfileInput) => api.put<User>('/api/auth/profile', input),
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    api.put<{ updated: boolean }>('/api/auth/password', input),
  forgotPassword: (email: string) =>
    api.post<{ sent: boolean }>('/api/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post<{ reset: boolean }>('/api/auth/reset-password', { token, password }),
};
