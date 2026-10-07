// CarbonGate — API Client

const BASE_URL = 'http://localhost:8000';

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API Error ${res.status}: ${err}`);
  }
  return res.json();
}

export const api = {
  // Health
  health: () => apiCall<{ status: string }>('/health'),
  status: () => apiCall<any>('/api/status'),

  // Query
  query: (body: {
    query: string;
    department: string;
    workload_type: string;
    is_critical: boolean;
  }) => apiCall<any>('/api/query', { method: 'POST', body: JSON.stringify(body) }),

  // Ledger
  ledger: (department?: string, limit = 50) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (department) params.set('department', department);
    return apiCall<{ entries: any[] }>(`/api/ledger?${params}`);
  },

  // Stats
  stats: (department?: string) => {
    const params = department ? `?department=${department}` : '';
    return apiCall<any>(`/api/stats${params}`);
  },

  daily: (department?: string, days = 14) => {
    const params = new URLSearchParams({ days: String(days) });
    if (department) params.set('department', department);
    return apiCall<{ daily: any[] }>(`/api/daily?${params}`);
  },

  // Budget
  budget: (department = 'default') =>
    apiCall<any>(`/api/budget?department=${department}`),

  allBudgets: () => apiCall<any>('/api/budget/all'),

  updateBudget: (department: string, budget_kg: number) =>
    apiCall<any>('/api/budget/update', {
      method: 'POST',
      body: JSON.stringify({ department, budget_kg }),
    }),

  resetBudget: (department = 'default') =>
    apiCall<any>(`/api/budget/reset?department=${department}`, { method: 'POST' }),

  // Cache
  cacheStats: () => apiCall<any>('/api/cache/stats'),
  clearCache: () => apiCall<any>('/api/cache/clear', { method: 'POST' }),

  // Grid / Scheduling
  grid: () => apiCall<any>('/api/grid'),
  scheduleForecast: () => apiCall<any>('/api/schedule/forecast'),
  scheduleCheck: (body: any) =>
    apiCall<any>('/api/schedule/check', { method: 'POST', body: JSON.stringify(body) }),

  // RAG
  ragStats: () => apiCall<any>('/api/rag/stats'),
  ragReingest: () => apiCall<any>('/api/rag/reingest', { method: 'POST' }),

  // Demo
  simulateLoad: (count = 10) =>
    apiCall<any>(`/api/demo/simulate-load?requests_count=${count}`, { method: 'POST' }),
};
