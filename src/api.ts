type ApiResponse<T = unknown> = {
  data?: T;
  message?: string;
  success?: boolean;
};

function getStoredToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('api_token');
}

function saveStoredToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem('api_token', token);
  } else {
    window.localStorage.removeItem('api_token');
  }
}

function resolveApiUrl(url: string) {
  const normalized = url.startsWith('/api') ? url : `/api${url.startsWith('/') ? url : `/${url}`}`;
  return `${import.meta.env.VITE_API_BASE || ''}${normalized}`;
}

async function request<T = unknown>(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  const token = getStoredToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body != null && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(resolveApiUrl(url), {
    credentials: 'include',
    ...options,
    headers,
  });

  const text = await response.text();
  let payload: any;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message = payload?.message || response.statusText || 'API request failed';
    throw new Error(message);
  }

  return payload as T;
}

function readJsonStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function resolveGameId(gameName: string) {
  if (!gameName || typeof window === 'undefined') return null;
  const games = readJsonStorage<Array<{ id: string; name: string }>>('games') || [];
  const found = games.find((game) => game.name === gameName || game.name?.toLowerCase() === gameName.toLowerCase());
  return found?.id || null;
}

function normalizeSubscriptionPayload(subscription: Record<string, any>) {
  return {
    player_id: subscription.playerId || subscription.player_id || null,
    game_id: subscription.gameId || subscription.game_id || resolveGameId(subscription.game) || null,
    branch_id: subscription.branchId || subscription.branch_id || null,
    schedule: subscription.schedule || '',
    training_time: subscription.trainingTime || subscription.training_time || '',
    sessions: subscription.sessions ?? 0,
    subscription_value: subscription.subscriptionValue ?? subscription.subscription_value ?? 0,
    paid_amount: subscription.paidAmount ?? subscription.paid_amount ?? 0,
    start_date: subscription.startDate || subscription.start_date || null,
    end_date: subscription.endDate || subscription.end_date || null,
    status: subscription.status || 'active',
    invoice_number: subscription.invoiceNumber || subscription.invoice_number || null,
  };
}

function normalizePlayerUpdate(payload: Record<string, any>) {
  const copy = { ...payload };
  if (copy.trainingTime !== undefined) {
    copy.training_time = copy.trainingTime;
    delete copy.trainingTime;
  }
  return copy;
}

const api = {
  getToken() {
    return getStoredToken();
  },

  login(email: string, password: string) {
    return request<ApiResponse<{ token: string }>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).then((result) => {
      if (result?.data?.token) {
        saveStoredToken(result.data.token);
      }
      return result;
    });
  },

  register(payload: { name: string; email: string; password: string; role: string; branch_id?: string }) {
    return request<ApiResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  logout() {
    saveStoredToken(null);
  },

  request,

  getBranches() {
    return request<ApiResponse<Array<unknown>>>('/branches');
  },

  createBranch(branch: { name: string; manager?: string; location?: string }) {
    return request<ApiResponse>('/branches', {
      method: 'POST',
      body: JSON.stringify({ name: branch.name, manager: branch.manager, location: branch.location }),
    });
  },

  updateBranch(id: string, branch: { name: string; manager?: string; location?: string }) {
    return request<ApiResponse>(`/branches/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: branch.name, manager: branch.manager, location: branch.location }),
    });
  },

  deleteBranch(id: string) {
    return request<void>(`/branches/${id}`, { method: 'DELETE' });
  },

  getPlayers() {
    return request<ApiResponse<Array<unknown>>>('/players');
  },

  getSubscriptions() {
    return request<ApiResponse<Array<unknown>>>('/subscriptions');
  },

  getSports() {
    return request<ApiResponse<Array<unknown>>>('/games');
  },

  updateSubscription(id: string, subscription: Record<string, any>) {
    return request<ApiResponse>(`/subscriptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(normalizeSubscriptionPayload(subscription)),
    });
  },

  createSubscription(subscription: Record<string, any>) {
    return request<ApiResponse>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(normalizeSubscriptionPayload(subscription)),
    });
  },

  deleteSubscription(id: string) {
    return request<void>(`/subscriptions/${id}`, { method: 'DELETE' });
  },

  updatePlayer(id: string, updates: Record<string, any>) {
    return request<ApiResponse>(`/players/${id}`, {
      method: 'PUT',
      body: JSON.stringify(normalizePlayerUpdate(updates)),
    });
  },

  createFinance(record: Record<string, any>) {
    return request<ApiResponse>('/finance', {
      method: 'POST',
      body: JSON.stringify({
        type: record.type,
        category: record.category,
        branch_id: record.branchId || record.branch_id || null,
        related_to: record.relatedTo || record.related_to || null,
        amount: record.amount,
        date: record.date || new Date().toISOString().split('T')[0],
        description: record.description || null,
        source: record.source || null,
        source_id: record.sourceId || record.source_id || null,
        created_by_id: record.created_by_id || record.createdById || null,
      }),
    });
  },

  getFinanceRecords() {
    return request<ApiResponse<Array<unknown>>>('/finance');
  },

  deleteFinance(id: string) {
    return request<void>(`/finance/${id}`, { method: 'DELETE' });
  },

  renewSubscription(id: string, payload: Record<string, any>) {
    return this.updateSubscription(id, payload);
  },

  sendInvoiceNotification(phone: string, _imageData: string, caption: string) {
    if (typeof window === 'undefined') {
      return Promise.resolve({ ok: false });
    }
    const normalized = phone.replace(/\D/g, '');
    const number = normalized.startsWith('0') ? `2${normalized}` : normalized;
    const url = `https://wa.me/${encodeURIComponent(number)}?text=${encodeURIComponent(caption)}`;
    window.open(url, '_blank');
    return Promise.resolve({ ok: true });
  },

  updateUser(id: string, updates: Record<string, unknown>) {
    return request<ApiResponse>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
};

if (typeof window !== 'undefined') {
  window.api = api;
}

export default api;
