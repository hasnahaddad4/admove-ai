import { useAuthStore } from '@/stores/auth-store';

const API_BASE = '/api';

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let details: any = null;
    try {
      const body = await res.json();
      message = body.error || body.message || message;
      details = body.details || null;
    } catch {}
    const error: any = new Error(message);
    error.status = res.status;
    error.details = details;
    throw error;
  }

  // Handle 204 No Content
  if (res.status === 204) return {} as T;
  return res.json();
}

export const api = {
  auth: {
    register: (data: { name: string; email: string; password: string; role?: string }) =>
      apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    me: () => apiFetch('/auth/me'),
  },
  users: {
    list: () => apiFetch('/users'),
    get: (id: string) => apiFetch(`/users/${id}`),
    create: (data: any) => apiFetch('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deactivate: (id: string) => apiFetch(`/users/${id}`, { method: 'DELETE' }),
    delete: (id: string) => apiFetch(`/users/${id}/delete`, { method: 'DELETE' }),
  },
  team: {
    list: (scope?: 'all') => apiFetch(`/team${scope ? `?scope=${scope}` : ''}`),
  },
  tasks: {
    list: (params?: { status?: string; priority?: string; assignedToId?: string; campaignId?: string; mine?: boolean }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.priority) q.set('priority', params.priority);
      if (params?.assignedToId) q.set('assignedToId', params.assignedToId);
      if (params?.campaignId) q.set('campaignId', params.campaignId);
      if (params?.mine) q.set('mine', 'true');
      return apiFetch(`/tasks?${q.toString()}`);
    },
    get: (id: string) => apiFetch(`/tasks/${id}`),
    create: (data: any) => apiFetch('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/tasks/${id}`, { method: 'DELETE' }),
    comments: {
      list: (taskId: string) => apiFetch(`/tasks/${taskId}/comments`),
      add: (taskId: string, content: string) =>
        apiFetch(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
    },
  },
  notifications: {
    list: (unreadOnly?: boolean, limit?: number) => {
      const q = new URLSearchParams();
      if (unreadOnly) q.set('unread', 'true');
      if (limit) q.set('limit', String(limit));
      return apiFetch(`/notifications?${q.toString()}`);
    },
    markAllRead: () => apiFetch('/notifications', { method: 'PUT' }),
    markRead: (id: string) => apiFetch(`/notifications/${id}`, { method: 'PATCH' }),
    delete: (id: string) => apiFetch(`/notifications/${id}`, { method: 'DELETE' }),
  },
  activity: {
    list: (limit?: number, scope?: 'me' | 'all') => {
      const q = new URLSearchParams();
      if (limit) q.set('limit', String(limit));
      if (scope) q.set('scope', scope);
      return apiFetch(`/activity?${q.toString()}`);
    },
  },
  dashboard: () => apiFetch('/dashboard'),
  campaigns: {
    list: () => apiFetch('/campaigns'),
    get: (id: string) => apiFetch(`/campaigns/${id}`),
    create: (data: any) => apiFetch('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/campaigns/${id}`, { method: 'DELETE' }),
  },
  vehicles: {
    list: () => apiFetch('/vehicles'),
    get: (id: string) => apiFetch(`/vehicles/${id}`),
    create: (data: any) => apiFetch('/vehicles', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/vehicles/${id}`, { method: 'DELETE' }),
  },
  zones: {
    list: () => apiFetch('/zones'),
    get: (id: string) => apiFetch(`/zones/${id}`),
  },
  gps: {
    list: (params?: { vehicleId?: string; campaignId?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.vehicleId) q.set('vehicleId', params.vehicleId);
      if (params?.campaignId) q.set('campaignId', params.campaignId);
      if (params?.limit) q.set('limit', String(params.limit));
      return apiFetch(`/gps?${q.toString()}`);
    },
  },
  analytics: (params?: { campaignId?: string; vehicleId?: string; zoneId?: string; days?: number }) => {
    const q = new URLSearchParams();
    if (params?.campaignId) q.set('campaignId', params.campaignId);
    if (params?.vehicleId) q.set('vehicleId', params.vehicleId);
    if (params?.zoneId) q.set('zoneId', params.zoneId);
    if (params?.days) q.set('days', String(params.days));
    return apiFetch(`/analytics?${q.toString()}`);
  },
  recommendations: (campaignId?: string) =>
    apiFetch(`/recommendations${campaignId ? `?campaignId=${campaignId}` : ''}`),
  ai: {
    predict: (data: any) => apiFetch('/ai/predict', { method: 'POST', body: JSON.stringify(data) }),
    recommend: (data: any) => apiFetch('/ai/recommend', { method: 'POST', body: JSON.stringify(data) }),
    model: () => apiFetch('/ai/model'),
    train: (datasetSize?: number) =>
      apiFetch(`/ai/train${datasetSize ? `?datasetSize=${datasetSize}` : ''}`, { method: 'POST' }),
    optimize: (data: any) => apiFetch('/ai/optimize', { method: 'POST', body: JSON.stringify(data) }),
  },
  reports: (campaignId: string) => apiFetch(`/reports/${campaignId}`),
};
