// API base URL - change this to your backend URL in production
const API_BASE = 'http://localhost:5000/api';

// ─── Token helpers ────────────────────────────────────────────────────────────

export const getToken = (): string | null => localStorage.getItem('kd_token');
export const setToken = (token: string) => localStorage.setItem('kd_token', token);
export const removeToken = () => localStorage.removeItem('kd_token');

// ─── Base fetch wrapper ───────────────────────────────────────────────────────

async function apiFetch<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.message || `Request failed with status ${res.status}`);
    }
    return data as T;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authAPI = {
    register: (name: string, email: string, password: string, adminSecret?: string) =>
        apiFetch<any>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, adminSecret }),
        }),

    login: (email: string, password: string) =>
        apiFetch<any>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    me: () => apiFetch<any>('/auth/me'),

    updateProfile: (name: string) =>
        apiFetch<any>('/auth/update-profile', {
            method: 'PUT',
            body: JSON.stringify({ name }),
        }),

    changePassword: (currentPassword: string, newPassword: string) =>
        apiFetch<any>('/auth/change-password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword }),
        }),
};

// ─── History API ──────────────────────────────────────────────────────────────

export const historyAPI = {
    save: (data: {
        videoName: string;
        videoSize?: number;
        videoType?: string;
        format: string;
        script: any[];
        duration?: string;
    }) =>
        apiFetch<any>('/history', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    list: (page = 1, limit = 10) =>
        apiFetch<any>(`/history?page=${page}&limit=${limit}`),

    get: (id: string) => apiFetch<any>(`/history/${id}`),

    markExported: (id: string) =>
        apiFetch<any>(`/history/${id}/export`, { method: 'PATCH' }),

    delete: (id: string) =>
        apiFetch<any>(`/history/${id}`, { method: 'DELETE' }),

    clearAll: () => apiFetch<any>('/history', { method: 'DELETE' }),
};

// ─── Admin API ────────────────────────────────────────────────────────────────

export const adminAPI = {
    dashboard: () => apiFetch<any>('/admin/dashboard'),

    users: (params?: { page?: number; limit?: number; search?: string; role?: string; status?: string }) => {
        const q = new URLSearchParams();
        if (params?.page) q.set('page', String(params.page));
        if (params?.limit) q.set('limit', String(params.limit));
        if (params?.search) q.set('search', params.search);
        if (params?.role) q.set('role', params.role);
        if (params?.status) q.set('status', params.status);
        return apiFetch<any>(`/admin/users?${q.toString()}`);
    },

    getUser: (id: string) => apiFetch<any>(`/admin/users/${id}`),

    updateUser: (id: string, data: { name?: string; role?: string; isActive?: boolean }) =>
        apiFetch<any>(`/admin/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    deleteUser: (id: string) =>
        apiFetch<any>(`/admin/users/${id}`, { method: 'DELETE' }),

    toggleStatus: (id: string) =>
        apiFetch<any>(`/admin/users/${id}/toggle-status`, { method: 'PATCH' }),

    allHistory: (params?: { page?: number; limit?: number; userId?: string }) => {
        const q = new URLSearchParams();
        if (params?.page) q.set('page', String(params.page));
        if (params?.limit) q.set('limit', String(params.limit));
        if (params?.userId) q.set('userId', params.userId);
        return apiFetch<any>(`/admin/history?${q.toString()}`);
    },

    deleteHistory: (id: string) =>
        apiFetch<any>(`/admin/history/${id}`, { method: 'DELETE' }),
};
