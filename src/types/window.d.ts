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
  getPlayers?: () => Promise<ApiListResponse<unknown[]>>;
  getSubscriptions?: () => Promise<ApiListResponse<unknown[]>>;
  getSports?: () => Promise<ApiListResponse<unknown[]>>;
  getBranches?: () => Promise<ApiListResponse<unknown[]>>;
  createBranch?: (branch: Record<string, unknown>) => Promise<unknown>;
  updateBranch?: (id: string, branch: Record<string, unknown>) => Promise<unknown>;
  deleteBranch?: (id: string) => Promise<unknown>;
  updateSubscription?: (id: string, subscription: unknown) => Promise<unknown>;
  createSubscription?: (subscription: unknown) => Promise<unknown>;
  deleteSubscription?: (id: string) => Promise<unknown>;
  updatePlayer?: (id: string, updates: unknown) => Promise<unknown>;
  createFinance?: (record: FinanceRecordLike) => Promise<unknown> | unknown;
  getFinanceRecords?: () => Promise<ApiListResponse<unknown[]>>;
  deleteFinance?: (id: string) => Promise<unknown>;
  renewSubscription?: (id: string, payload: unknown) => Promise<unknown>;
  sendInvoiceNotification?: (phone: string, imageData: string, caption: string) => Promise<unknown>;
  updateUser?: (id: string, updates: Record<string, unknown>) => Promise<unknown>;
  request?: (url: string) => Promise<unknown>;
}

declare global {
  interface Window {
    api?: WindowApi;
    syncManager?: SyncManager;
    sharedFinance?: SharedFinanceApi;
  }
}

export {};
