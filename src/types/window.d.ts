type ApiListResponse<T = unknown> = {
  data?: T;
  message?: string;
  success?: boolean;
};

type FinanceRecordLike = {
  id?: string;
  source?: string;
  sourceId?: string;
  description?: string;
  category?: string;
  relatedTo?: string;
  [key: string]: unknown;
};

type SharedFinanceApi = {
  getFinances: () => FinanceRecordLike[];
  setFinances: (records: FinanceRecordLike[]) => void;
  addFinance?: (...args: unknown[]) => void;
};

type SyncManager = {
  update?: (key: string, value: unknown) => void;
};

interface WindowApi {
  getToken?: () => string | null;
  login?: (email: string, password: string) => Promise<ApiResponse<{ token: string }>>;
  logout?: () => void;
  getPlayers?: () => Promise<ApiListResponse<unknown[]>>;
  getSubscriptions?: () => Promise<ApiListResponse<unknown[]>>;
  getSports?: () => Promise<ApiListResponse<unknown[]>>;
  getBranches?: () => Promise<ApiListResponse<unknown[]>>;
  createBranch?: (branch: { name: string; manager?: string; location?: string }) => Promise<unknown>;
  updateBranch?: (id: string, branch: { name: string; manager?: string; location?: string }) => Promise<unknown>;
  deleteBranch?: (id: string) => Promise<unknown>;
  updateSubscription?: (id: string, subscription: Record<string, any>) => Promise<unknown>;
  createSubscription?: (subscription: Record<string, any>) => Promise<unknown>;
  deleteSubscription?: (id: string) => Promise<unknown>;
  updatePlayer?: (id: string, updates: Record<string, any>) => Promise<unknown>;
  createFinance?: (record: FinanceRecordLike) => Promise<unknown> | unknown;
  getFinanceRecords?: () => Promise<ApiListResponse<unknown[]>>;
  deleteFinance?: (id: string) => Promise<unknown>;
  renewSubscription?: (id: string, payload: Record<string, any>) => Promise<unknown>;
  sendInvoiceNotification?: (phone: string, imageData: string, caption: string) => Promise<unknown>;
  updateUser?: (id: string, updates: Record<string, unknown>) => Promise<unknown>;
  request?: (url: string, options?: RequestInit) => Promise<ApiResponse<unknown>>;
}

declare global {
  interface Window {
    api?: WindowApi;
    syncManager?: SyncManager;
    sharedFinance?: SharedFinanceApi;
  }
}

export {};
