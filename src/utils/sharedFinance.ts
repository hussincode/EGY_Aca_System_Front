type FinanceType = 'income' | 'expense';

export type FinanceEntryRecord = {
  id?: string;
  type: FinanceType;
  category: string;
  branch?: string;
  branchName?: string;
  relatedTo?: string;
  amount: number;
  date: string;
  description?: string;
};

export function recordFinanceTransaction(entry: {
  type: FinanceType;
  amount: number;
  category: string;
  branch?: string;
  description?: string;
  date?: string;
  relatedTo?: string;
}) {
  if (typeof window === 'undefined') return;

  const dateStr = entry.date || new Date().toISOString().split('T')[0];
  const newRecord: FinanceEntryRecord = {
    id: `fin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: entry.type,
    category: entry.category,
    branch: entry.branch || 'الفرع الرئيسي',
    branchName: entry.branch || 'الفرع الرئيسي',
    relatedTo: entry.relatedTo || entry.branch || '',
    amount: Number(entry.amount) || 0,
    date: dateStr,
    description: entry.description || '',
  };

  let current: FinanceEntryRecord[] = [];
  try {
    const raw = window.localStorage.getItem('finances');
    current = raw ? (JSON.parse(raw) as FinanceEntryRecord[]) : [];
  } catch {
    current = [];
  }

  const updated = [newRecord, ...current];
  window.localStorage.setItem('finances', JSON.stringify(updated));

  // Sync to API if token is present
  if (window.api?.getToken?.()) {
    const apiPayload = {
      type: newRecord.type,
      category: newRecord.category,
      branch: newRecord.branch,
      branch_name: newRecord.branchName,
      related_to: newRecord.relatedTo,
      amount: newRecord.amount,
      date: newRecord.date,
      description: newRecord.description,
    };
    if (typeof window.api.createFinance === 'function') {
      void window.api.createFinance(apiPayload);
    }
  }

  // Dispatch events to notify active views
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new CustomEvent('app:sync', { detail: { key: 'finances', value: updated } }));
}

// Global initialization of window.sharedFinance
export function initSharedFinance() {
  if (typeof window === 'undefined') return;

  window.sharedFinance = {
    getFinances: () => {
      try {
        const raw = window.localStorage.getItem('finances');
        return raw ? (JSON.parse(raw) as FinanceEntryRecord[]) : [];
      } catch {
        return [];
      }
    },
    setFinances: (records) => {
      window.localStorage.setItem('finances', JSON.stringify(records));
      window.dispatchEvent(new Event('storage'));
    },
    addFinance: (type, amount, category, branch, description, date) => {
      recordFinanceTransaction({
        type: type as FinanceType,
        amount: Number(amount) || 0,
        category: String(category || ''),
        branch: String(branch || ''),
        description: String(description || ''),
        date: String(date || new Date().toISOString().split('T')[0]),
      });
    },
  };
}

// Auto-initialize when module is loaded
initSharedFinance();
