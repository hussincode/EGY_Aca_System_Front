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
  getToken: () => string | null;
  login: (email: string, password: string) => Promise<ApiResponse<{ token: string }>>;
  logout: () => void;
  request: (url: string, options?: RequestInit) => Promise<ApiResponse<unknown>>;
  // Branches
  getBranches: () => Promise<ApiListResponse<unknown[]>>;
  createBranch: (branch: { name: string; manager?: string; location?: string }) => Promise<unknown>;
  updateBranch: (id: string, branch: { name: string; manager?: string; location?: string }) => Promise<unknown>;
  deleteBranch: (id: string) => Promise<unknown>;
  // Players
  getPlayers: () => Promise<ApiListResponse<unknown[]>>;
  createPlayer: (player: Record<string, any>) => Promise<ApiResponse<unknown>>;
  updatePlayer: (id: string, updates: Record<string, any>) => Promise<ApiResponse<unknown>>;
  deletePlayer: (id: string) => Promise<unknown>;
  // Subscriptions
  getSubscriptions: () => Promise<ApiListResponse<unknown[]>>;
  createSubscription: (subscription: Record<string, any>) => Promise<unknown>;
  updateSubscription: (id: string, subscription: Record<string, any>) => Promise<unknown>;
  deleteSubscription: (id: string) => Promise<unknown>;
  renewSubscription: (id: string, payload: Record<string, any>) => Promise<unknown>;
  // Games
  getGames: () => Promise<ApiListResponse<unknown[]>>;
  getSports: () => Promise<ApiListResponse<unknown[]>>;
  createGame: (game: { name: string; description?: string; active?: boolean }) => Promise<unknown>;
  updateGame: (id: string, game: { name: string; description?: string; active?: boolean }) => Promise<unknown>;
  deleteGame: (id: string) => Promise<unknown>;
  // Finance
  createFinance: (record: FinanceRecordLike) => Promise<unknown> | unknown;
  getFinanceRecords: () => Promise<ApiListResponse<unknown[]>>;
  updateFinance: (id: string, record: FinanceRecordLike) => Promise<unknown>;
  deleteFinance: (id: string) => Promise<unknown>;
  // Staff
  getStaff: () => Promise<ApiListResponse<unknown[]>>;
  createStaff: (staff: Record<string, any>) => Promise<unknown>;
  updateStaff: (id: string, staff: Record<string, any>) => Promise<unknown>;
  deleteStaff: (id: string) => Promise<unknown>;
  // Leads
  getLeads: () => Promise<ApiListResponse<unknown[]>>;
  createLead: (lead: { name: string; phone: string; interest?: string; status?: string; branch_id?: string; notes?: string }) => Promise<unknown>;
  updateLead: (id: string, lead: Record<string, any>) => Promise<unknown>;
  deleteLead: (id: string) => Promise<unknown>;
  // Attendance
  getAttendance: () => Promise<ApiListResponse<unknown[]>>;
  createAttendance: (attendance: { player_id: string; status: string; date?: string; subscription_id?: string }) => Promise<unknown>;
  updateAttendance: (id: string, attendance: Record<string, any>) => Promise<unknown>;
  deleteAttendance: (id: string) => Promise<unknown>;
  // Ambassadors
  getAmbassadors: () => Promise<ApiListResponse<unknown[]>>;
  createAmbassador: (ambassador: { name: string; phone?: string; branch_id?: string; notes?: string }) => Promise<unknown>;
  updateAmbassador: (id: string, ambassador: Record<string, any>) => Promise<unknown>;
  deleteAmbassador: (id: string) => Promise<unknown>;
  // Users
  getUsers: () => Promise<ApiListResponse<unknown[]>>;
  register: (payload: { name: string; email: string; password: string; role: string; branch_id?: string }) => Promise<unknown>;
  updateUser: (id: string, updates: Record<string, unknown>) => Promise<unknown>;
  deleteUser: (id: string) => Promise<unknown>;
  // Invoices
  sendInvoiceNotification: (phone: string, imageData: string, caption: string) => Promise<unknown>;
  // Dashboard
  getDashboardStats: () => Promise<ApiResponse<Record<string, unknown>>>;
}

declare global {
  interface Window {
    api: WindowApi;
    syncManager?: SyncManager;
    sharedFinance?: SharedFinanceApi;
  }
}

export {};
