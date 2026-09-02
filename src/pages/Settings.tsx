import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { SearchSm, Settings01 } from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';
import { API_BASE_URL } from '@/api';

type TabKey = 'general' | 'security' | 'landing' | 'backup';

type ToastType = 'success' | 'error' | 'warning';

type GeneralSettings = {
  academyName: string;
  currency: string;
  language: string;
  notificationEmail: string;
  siteLogo: string;
  sidebarLogo: string;
};

type LandingHeroSettings = {
  title: string;
  subtitle: string;
  videoUrl: string;
  bgType: string;
  imageUrl: string;
  badgeText?: string;
  ctaPrimary?: string;
};

type LandingBranchItem = {
  name: string;
  description: string;
  mapsUrl: string;
  image: string;
};

type LandingTestimonialItem = {
  name: string;
  role: string;
  text: string;
  rating: string;
  image: string;
};

type LandingPlanItem = {
  name: string;
  originalPrice: string | null;
  price: string;
  features: string[];
  isFeatured: boolean;
};

type LandingMediaItem = {
  type: string;
  data: string;
};

type LandingNewsItem = {
  title: string;
  category: string;
  date: string;
  link: string;
  image: string;
};

type LandingSportItem = {
  name: string;
  tag: string;
  desc: string;
  image: string;
};

type AuditLog = {
  id?: string;
  createdAt: string;
  userName: string;
  userRole: string;
  action: string;
  section: string;
  description: string;
  amount?: number;
  type?: string;
  relatedTo?: string;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function broadcastLandingChange(key: string, value: unknown) {
  try {
    const bc = new BroadcastChannel('landing_settings_sync');
    bc.postMessage({ [key]: value });
    bc.close();
  } catch { }
  try {
    fetch(`${API_BASE_URL}/api/landing-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => { });
  } catch { }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
  broadcastLandingChange(key, value);
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new CustomEvent('app:sync', { detail: { key, value } }));
}

function writeString(key: string, value: string) {
  if (typeof window === 'undefined') return;
  if (!value) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, value);
  }
  broadcastLandingChange(key, value);
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new CustomEvent('app:sync', { detail: { key, value } }));
}

function readString(key: string) {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(key) || '';
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const loggedUser = useMemo(() => {
    return readJson<{ id?: string; name?: string; role?: string; email?: string }>('loggedInUser', {
      name: 'مدير النظام',
      role: 'admin',
      email: 'admin@egy-academy.com',
    });
  }, []);

  const isAdmin = useMemo(() => {
    return (loggedUser.role || '').toLowerCase() === 'admin' || (loggedUser.role || '').toLowerCase() === 'manager';
  }, [loggedUser]);

  const [general, setGeneral] = useState<GeneralSettings>(() =>
    readJson('system_settings_general', {
      academyName: 'ايجي سبورتنج كلوب',
      currency: 'EGP',
      language: 'ar',
      notificationEmail: 'notifications@egy-academy.com',
      siteLogo: '',
      sidebarLogo: '',
    })
  );

  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });

  // Landing Page Settings States
  const [heroSettings, setHeroSettings] = useState<LandingHeroSettings>(() =>
    readJson('landing_hero_settings', {
      title: 'اصنع مستقبلك الرياضي معنا',
      subtitle: 'أكاديمية رياضية متكاملة لبناء الأبطال وتنمية المهارات بأعلى المستويات المعيارية.',
      videoUrl: '',
      bgType: 'video',
      imageUrl: '',
    })
  );
  const [heroImagePreview, setHeroImagePreview] = useState(() => readString('landing_hero_image'));
  const [ceoPhotoUrl, setCeoPhotoUrl] = useState(() => readString('landing_ceo_photo'));
  const [ceoPhotoPreview, setCeoPhotoPreview] = useState(() => readString('landing_ceo_photo'));
  const [branchName, setBranchName] = useState('');
  const [branchDescription, setBranchDescription] = useState('');
  const [branchMapsUrl, setBranchMapsUrl] = useState('');
  const [branchImageData, setBranchImageData] = useState('');
  const [branchImagePreview, setBranchImagePreview] = useState('');
  const [landingBranches, setLandingBranches] = useState<LandingBranchItem[]>(() => readJson('landing_branches', [
    { name: 'فرع دبي هيلز الرئيسي', description: 'دبي هيلز استيت، طريق الكلب هاوس', mapsUrl: '', image: '/assets/football_card.jpg' },
    { name: 'فرع سيتي سنتر', description: 'مجمع داون تاون الرياضي، شارع ٤', mapsUrl: '', image: '/assets/tennis_card.jpg' },
  ]));
  const [testimonials, setTestimonials] = useState<LandingTestimonialItem[]>(() => readJson('landing_testimonials', [
    { name: 'سارة م.', role: 'والدة مايا (٩ سنوات)', text: 'جاءت ابنتي للتنس، ولكنها استمرت بفضل الصداقات، الثقة بالنفس، والأسلوب الرائع.', rating: '5', image: '/assets/tennis_card.jpg' }
  ]));
  const [testimonialForm, setTestimonialForm] = useState({ name: '', role: '', text: '', rating: '5', image: '' });
  const [testimonialPreview, setTestimonialPreview] = useState('');
  const [planForm, setPlanForm] = useState({ originalPrice: '', name: '', price: '', features: '', isFeatured: false });
  const [plans, setPlans] = useState<LandingPlanItem[]>(() => readJson('landing_pricing_plans', [
    { name: 'باقة البداية Starter', originalPrice: null, price: '195', features: ['حصتان تدريبيتان أسبوعياً', 'قميص التدريب الرسمي', 'تطبيق متابعة التطور'], isFeatured: false },
    { name: 'الباقة الاحترافية Pro', originalPrice: '390', price: '310', features: ['٤ حصص تدريبية أسبوعياً', 'طقم رياضي احترافي كامل', 'تقييم مهارات فردي كل ٣ أشهر', 'تسجيل مجاني في البطولات'], isFeatured: true },
  ]));
  const [mediaItems, setMediaItems] = useState<LandingMediaItem[]>(() => readJson('landing_media', []));
  const [newsForm, setNewsForm] = useState({ title: '', category: '', date: '', link: '', image: '' });
  const [newsPreview, setNewsPreview] = useState('');
  const [newsItems, setNewsItems] = useState<LandingNewsItem[]>(() => readJson('landing_news', []));
  const [editingNewsIndex, setEditingNewsIndex] = useState<number>(-1);
  const [sportName, setSportName] = useState('');
  const [sportTag, setSportTag] = useState('');
  const [sportDesc, setSportDesc] = useState('');
  const [sportImage, setSportImage] = useState('');
  const [sportImagePreview, setSportImagePreview] = useState('');
  const [landingSports, setLandingSports] = useState<LandingSportItem[]>(() => readJson('landing_sports', [
    { name: 'أكاديمية كرة القدم', tag: 'كرة القدم', desc: 'تكتيكات اللعب، المهارات الفردية، والعمل الجماعي على ملاعب معتمدة من الفيفا.', image: '/assets/football_card.jpg' },
    { name: 'مسار السباحة الأولمبية', tag: 'السباحة', desc: 'إتقان السباحة، السلامة المائية، واللياقة البدنية في مسبح أولمبي مغلق.', image: '/assets/swimming_card.jpg' },
    { name: 'احتراف التنس', tag: 'التنس', desc: 'إتقان الإرسال والضربات الخلفية والتركيز الذهني.', image: '/assets/tennis_card.jpg' },
  ]));
  const [sectionTitle, setSectionTitle] = useState(() => readString('landing_sports_title') || 'برامجنا الرياضية');
  const [landingFaq, setLandingFaq] = useState<Array<{ q: string; a: string }>>(() => readJson('landing_faq', [
    { q: 'ما هي الفئات العمرية المتاحة بالأكاديمية؟', a: 'نقدم برامج مخصصة للأطفال والشباب من سن ٣ حتى ١٧ سنة مقسمة بدقة حسب الفئة العمرية والمستوى.' },
    { q: 'هل توفرون حصصاً تجريبية قبل الاشتراك؟', a: 'بالتأكيد! نشجع كل طفل على الانضمام لحصة تجريبية مجانية مدتها ٤٥ دقيقة.' }
  ]));
  const [faqForm, setFaqForm] = useState({ q: '', a: '' });
  const [landingFooter, setLandingFooter] = useState(() => readJson('landing_footer', {
    tagline: 'حركة. تواصل. نمو وتطور معاً.',
    rights: '© 2026 أكاديمية أبكس الرياضية. جميع الحقوق محفوظة.',
    phone: '+971 4 800 APEX',
    email: 'info@apexacademy.ae',
    address: 'دبي، الإمارات العربية المتحدة',
  }));

  // Audit Logs Filtration States
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditUserFilter, setAuditUserFilter] = useState('all');
  const [auditTypeFilter, setAuditTypeFilter] = useState('all');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [isResettingData, setIsResettingData] = useState(false);

  // Load landing settings from backend on mount
  useEffect(() => {
    const fetchBackendLandingData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/landing-settings`);
        if (res.ok) {
          const json = await res.json();
          const d = json?.data;
          if (d && typeof d === 'object') {
            if (d.landing_hero_settings) setHeroSettings(d.landing_hero_settings);
            if (Array.isArray(d.landing_branches) && d.landing_branches.length > 0) setLandingBranches(d.landing_branches);
            if (Array.isArray(d.landing_sports) && d.landing_sports.length > 0) setLandingSports(d.landing_sports);
            if (Array.isArray(d.landing_pricing_plans) && d.landing_pricing_plans.length > 0) setPlans(d.landing_pricing_plans);
            if (Array.isArray(d.landing_testimonials) && d.landing_testimonials.length > 0) setTestimonials(d.landing_testimonials);
            if (Array.isArray(d.landing_faq) && d.landing_faq.length > 0) setLandingFaq(d.landing_faq);
            if (d.landing_footer) setLandingFooter(d.landing_footer);
            if (d.landing_sports_title) setSectionTitle(d.landing_sports_title);
          }
        }
      } catch (err) {
        console.warn('Landing data backend fetch skipped:', err);
      }
    };
    void fetchBackendLandingData();
  }, []);

  useEffect(() => {
    writeJson('landing_hero_settings', heroSettings);
  }, [heroSettings]);

  useEffect(() => {
    writeJson('system_settings_general', general);
  }, [general]);


  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

  const saveGeneralSettings = () => {
    writeJson('system_settings_general', general);
    showToast('تم حفظ إعدادات النظام وتحديث البيانات بنجاح', 'success');
  };

  const uploadSiteLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        setGeneral((prev) => ({ ...prev, siteLogo: result }));
        showToast('تم رفع لوجو الموقع بنجاح', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const uploadSidebarLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        setGeneral((prev) => ({ ...prev, sidebarLogo: result }));
        showToast('تم رفع صورة السايدبار بنجاح وتطبيقها مباشرة', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const changeUserPassword = async () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      showToast('كلمتا المرور غير متطابقتين', 'error');
      return;
    }
    if (passwords.newPassword.length < 6) {
      showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
      return;
    }

    try {
      const token = window.api?.getToken?.();
      if (token && loggedUser?.id) {
        await window.api?.updateUser?.(loggedUser.id, { password: passwords.newPassword });
      } else {
        const users = readJson<Array<{ id: string; password?: string }>>('users', []);
        const index = users.findIndex((item) => item.id === loggedUser.id);
        if (index !== -1) {
          users[index].password = passwords.newPassword;
          writeJson('users', users);
        }
      }

      setPasswords({ newPassword: '', confirmPassword: '' });
      showToast('تم تغيير كلمة المرور بنجاح', 'success');
    } catch (error) {
      showToast(`فشل تغيير كلمة المرور: ${error instanceof Error ? error.message : 'حدث خطأ'}`, 'error');
    }
  };

  /* ── System Audit Log Engine & Filtration ────────────────────────── */
  const loadAuditLogs = useCallback(
    async (page = 1) => {
      setAuditLoading(true);
      setAuditPage(page);

      let fetchedLogs: AuditLog[] = [];
      let totalPagesCount = 1;

      const defaultUserName = loggedUser.name || systemUsers[0]?.name || 'مدير النظام';
      const defaultUserRole = loggedUser.role || systemUsers[0]?.role || 'Manager';

      // 1. Try API first
      try {
        const token = window.api?.getToken?.();
        if (token) {
          const queryParams = new URLSearchParams({
            page: String(page),
            limit: '20',
            search: auditSearch,
            user: auditUserFilter !== 'all' ? auditUserFilter : '',
            type: auditTypeFilter !== 'all' ? auditTypeFilter : '',
          });

          const response = (await window.api?.request?.(`/audit?${queryParams.toString()}`)) as {
            logs?: AuditLog[];
            data?: Array<Record<string, unknown>>;
            pages?: number;
          };

          if (Array.isArray(response?.logs) && response.logs.length > 0) {
            fetchedLogs = response.logs;
            totalPagesCount = response.pages || 1;
          } else if (Array.isArray(response?.data) && response.data.length > 0) {
            fetchedLogs = response.data.map((row) => ({
              id: String(row.id || ''),
              createdAt: String(row.created_at || row.date || new Date().toISOString()),
              userName: String(row.userName || row.user_name || defaultUserName),
              userRole: String(row.userRole || row.user_role || defaultUserRole),
              action: row.type === 'income' ? 'عملية إيراد / بيع' : 'عملية مصروف / شراء',
              section: String(row.category || 'المالية'),
              description: String(row.description || `${row.category || 'عملية'} - ${row.related_to || ''} (${row.amount || 0} ج.م)`),
              amount: Number(row.amount || 0),
              type: String(row.type || 'income'),
              relatedTo: String(row.related_to || ''),
            }));
            totalPagesCount = response.pages || 1;
          }
        }
      } catch (err) {
        console.warn('API audit fetch failed, falling back to local finance log engine', err);
      }

      // 2. Read local finance transactions to ensure complete user action tracking offline/online
      const localFinances = readJson<
        Array<{
          id?: string;
          type: string;
          category: string;
          amount: number;
          date: string;
          description?: string;
          relatedTo?: string;
          userName?: string;
          userRole?: string;
        }>
      >('finances', []);

      const mappedLocalLogs: AuditLog[] = localFinances.map((item) => ({
        id: item.id || `log_${Math.random()}`,
        createdAt: item.date || new Date().toISOString().slice(0, 10),
        userName: item.userName || defaultUserName,
        userRole: item.userRole || defaultUserRole,
        action: item.type === 'income' ? 'عملية إيراد / بيع 🛒' : 'عملية مصروف / شراء 💸',
        section: item.category || 'المالية والمبيعات',
        description: item.description || `${item.category} - ${item.relatedTo || ''} - المبلغ: ${item.amount} ج.م`,
        amount: item.amount,
        type: item.type,
        relatedTo: item.relatedTo,
      }));

      // Combine API & Local logs, eliminating duplicates by ID
      const combinedMap = new Map<string, AuditLog>();
      [...fetchedLogs, ...mappedLocalLogs].forEach((log) => {
        const key = log.id || `${log.userName}_${log.createdAt}_${log.description}`;
        if (!combinedMap.has(key)) {
          combinedMap.set(key, log);
        }
      });

      let allLogs = Array.from(combinedMap.values());

      // Apply Filters
      if (auditSearch.trim()) {
        const s = auditSearch.trim().toLowerCase();
        allLogs = allLogs.filter(
          (l) =>
            l.userName.toLowerCase().includes(s) ||
            l.description.toLowerCase().includes(s) ||
            l.section.toLowerCase().includes(s) ||
            (l.relatedTo || '').toLowerCase().includes(s)
        );
      }

      if (auditUserFilter !== 'all') {
        allLogs = allLogs.filter((l) => l.userName.toLowerCase().includes(auditUserFilter.toLowerCase()));
      }

      if (auditTypeFilter !== 'all') {
        allLogs = allLogs.filter((l) => l.type === auditTypeFilter);
      }

      // Pagination
      const pageSize = 15;
      const totalPages = Math.max(1, Math.ceil(allLogs.length / pageSize));
      const start = (page - 1) * pageSize;
      const paginated = allLogs.slice(start, start + pageSize);

      setAuditLogs(paginated);
      setAuditTotalPages(totalPages);
      setAuditLoading(false);
    },
    [auditSearch, auditUserFilter, auditTypeFilter]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAuditLogs(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [auditSearch, auditUserFilter, auditTypeFilter, loadAuditLogs]);

  // ── System Users List from Users.tsx ───────────────────────────────
  const [systemUsers, setSystemUsers] = useState<Array<{ id?: string; name?: string; role?: string }>>(() => {
    return readJson<Array<{ id?: string; name?: string; role?: string }>>('users', []);
  });

  useEffect(() => {
    const fetchUsersList = async () => {
      if (window.api?.getUsers) {
        try {
          const res = (await window.api.getUsers()) as { data?: Array<{ id?: string; name?: string; role?: string }> };
          if (Array.isArray(res?.data) && res.data.length > 0) {
            setSystemUsers(res.data);
            writeJson('users', res.data);
          }
        } catch { }
      }
    };
    void fetchUsersList();
  }, []);

  // Unique Users List for Filter Dropdown (populated directly from Users.tsx)
  const availableUsers = useMemo(() => {
    const usersMap = new Map<string, { id?: string; name: string; role?: string }>();

    // 1. All registered users from Users.tsx
    systemUsers.forEach((u) => {
      if (u.name && u.name.trim()) {
        usersMap.set(u.name.trim(), { id: u.id, name: u.name.trim(), role: u.role });
      }
    });

    // 2. Active logged-in user
    if (loggedUser.name && loggedUser.name.trim()) {
      const name = loggedUser.name.trim();
      if (!usersMap.has(name)) {
        usersMap.set(name, { id: loggedUser.id, name, role: loggedUser.role });
      }
    }

    // 3. Any users present in local finance records
    const localFinances = readJson<Array<{ userName?: string; userRole?: string }>>('finances', []);
    localFinances.forEach((f) => {
      if (f.userName && f.userName.trim()) {
        const name = f.userName.trim();
        if (!usersMap.has(name)) {
          usersMap.set(name, { name, role: f.userRole });
        }
      }
    });

    return Array.from(usersMap.values());
  }, [systemUsers, loggedUser]);

  // List of user/auth keys that should NEVER be cleared during a reset or backup restore
  const USER_PRESERVED_KEYS = useMemo(() => new Set([
    'users',
    'system_users',
    'loggedInUser',
    'user',
    'api_token',
    'token',
    'auth_token',
    'authToken',
  ]), []);

  // Backup Import & Export handlers
  const exportData = () => {
    try {
      const backupObject: Record<string, unknown> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const raw = localStorage.getItem(key);
          if (raw !== null) {
            try {
              backupObject[key] = JSON.parse(raw);
            } catch {
              backupObject[key] = raw;
            }
          }
        }
      }

      const data = JSON.stringify(backupObject, null, 2);
      const blob = new Blob([data], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `egy_academy_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      showToast('تم تصدير النسخة الاحتياطية بنجاح 📦', 'success');
    } catch (err) {
      console.error('Failed to export backup:', err);
      showToast('حدث خطأ أثناء تصدير النسخة الاحتياطية', 'error');
    }
  };

  const importData = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (!content || !content.trim()) {
          showToast('ملف النسخة الاحتياطية فارغ!', 'error');
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch {
          showToast('ملف النسخة الاحتياطية غير صالح (JSON غير سليم)', 'error');
          return;
        }

        if (typeof parsed !== 'object' || parsed === null) {
          showToast('ملف النسخة الاحتياطية لا يحتوي على بنية بيانات صالحة', 'error');
          return;
        }

        let targetData = parsed as Record<string, unknown>;

        // Unwrap if nested under data, backup, or localStorage
        if (targetData.data && typeof targetData.data === 'object' && !Array.isArray(targetData.data)) {
          targetData = targetData.data as Record<string, unknown>;
        } else if (targetData.backup && typeof targetData.backup === 'object' && !Array.isArray(targetData.backup)) {
          targetData = targetData.backup as Record<string, unknown>;
        } else if (targetData.localStorage && typeof targetData.localStorage === 'object' && !Array.isArray(targetData.localStorage)) {
          targetData = targetData.localStorage as Record<string, unknown>;
        }

        const entries = Object.entries(targetData);
        if (entries.length === 0) {
          showToast('ملف النسخة الاحتياطية لا يحتوي على أي سجلات!', 'error');
          return;
        }

        if (window.confirm('⚠️ تحذير: استرجاع النسخة الاحتياطية سيستبدل بيانات النظام الحالية بمحتوى النسخة. هل ترغب في المتابعة؟')) {
          // Backup current user session info in case backup does not include them
          const currentLoggedIn = localStorage.getItem('loggedInUser');
          const currentApiToken = localStorage.getItem('api_token');
          const currentUsers = localStorage.getItem('users');
          const currentSystemUsers = localStorage.getItem('system_users');

          // Remove non-user keys to ensure old leftover data doesn't conflict
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && !USER_PRESERVED_KEYS.has(k)) {
              keysToRemove.push(k);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));

          // Set all keys from backup file
          entries.forEach(([k, v]) => {
            if (v === undefined || v === null) return;
            if (typeof v === 'string') {
              window.localStorage.setItem(k, v);
            } else {
              window.localStorage.setItem(k, JSON.stringify(v));
            }
          });

          // Restore user credentials if missing from backup
          if (!targetData.loggedInUser && currentLoggedIn) {
            window.localStorage.setItem('loggedInUser', currentLoggedIn);
          }
          if (!targetData.api_token && currentApiToken) {
            window.localStorage.setItem('api_token', currentApiToken);
          }
          if (!targetData.users && currentUsers) {
            window.localStorage.setItem('users', currentUsers);
          }
          if (!targetData.system_users && currentSystemUsers) {
            window.localStorage.setItem('system_users', currentSystemUsers);
          }

          // Broadcast landing sync if landing settings exist
          if (targetData.landing_settings_full || targetData.landing_hero_settings) {
            broadcastLandingChange('landing_full', targetData.landing_settings_full || targetData);
          }

          window.dispatchEvent(new Event('storage'));
          showToast('تم استرجاع النسخة الاحتياطية وتطبيق البيانات بنجاح! 📥 جاري تحديث الصفحة...', 'success');
          setTimeout(() => {
            window.location.reload();
          }, 1200);
        }
      } catch (err) {
        console.error('Failed to import backup:', err);
        showToast('حدث خطأ أثناء استرجاع ملف النسخة الاحتياطية', 'error');
      } finally {
        if (event.target) {
          event.target.value = '';
        }
      }
    };
    reader.onerror = () => {
      showToast('فشل قراءة الملف المرفوع', 'error');
      if (event.target) {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleResetDataExceptUsers = async () => {
    if (
      !window.confirm(
        '⚠️ تحذير شديد الأهمية: هل أنت متأكد من مسح كافة بيانات قاعدة البيانات والنظام (اللاعبين، الاشتراكات، الحركات المالية، المصروفات، الفروع، السجلات، الحضور) بالكامل؟\n\nسيتم الاحتفاظ فقط بحسابات المستخدمين وبيانات تسجيل الدخول.'
      )
    ) {
      return;
    }

    setIsResettingData(true);
    try {
      // 1. Reset SQL Database via Backend API
      try {
        if (window.api?.resetDatabaseExceptUsers) {
          await window.api.resetDatabaseExceptUsers();
        } else {
          const token = localStorage.getItem('api_token');
          await fetch(`${API_BASE_URL}/api/system/reset-except-users`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
        }
      } catch (backendErr) {
        console.warn('Backend database reset warning (offline/fallback):', backendErr);
      }

      // 2. Clear local storage except user & session credentials
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !USER_PRESERVED_KEYS.has(key)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => {
        localStorage.removeItem(key);
      });

      window.dispatchEvent(new Event('storage'));
      showToast('تم مسح جميع بيانات قاعدة البيانات والنظام بنجاح مع الاحتفاظ بحسابات المستخدمين 🧹 جاري تحديث الصفحة...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      console.error('Failed to reset data:', err);
      showToast('حدث خطأ أثناء مسح البيانات', 'error');
      setIsResettingData(false);
    }
  };

  // Landing Page Helper Handlers
  const uploadHeroImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result;
      if (typeof result === 'string') {
        writeString('landing_hero_image', result);
        setHeroSettings((prev) => ({ ...prev, imageUrl: '' }));
        setHeroImagePreview(result);
        showToast('تم تحديث صورة خلفية الهيرو بنجاح', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const saveLandingHeroSettings = () => {
    writeJson('landing_hero_settings', heroSettings);
    showToast('تم حفظ إعدادات الواجهة بنجاح', 'success');
  };

  const uploadCeoPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result;
      if (typeof result === 'string') {
        writeString('landing_ceo_photo', result);
        setCeoPhotoUrl(result);
        setCeoPhotoPreview(result);
        showToast('تم تحديث صورة رئيس مجلس الإدارة', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const saveCeoBiographySettings = () => {
    if (!ceoPhotoUrl) {
      showToast('يرجى اختيار صورة أولاً', 'error');
      return;
    }
    writeJson('landing_ceo_settings', { photo: ceoPhotoUrl });
    showToast('تم حفظ صورة السيرة الذاتية بنجاح', 'success');
  };

  const addLandingBranch = () => {
    if (!branchName.trim() || !branchImageData) {
      showToast('يرجى إدخال اسم الفرع والصورة على الأقل', 'error');
      return;
    }
    const next = [...landingBranches, { name: branchName, description: branchDescription, mapsUrl: branchMapsUrl, image: branchImageData }];
    setLandingBranches(next);
    writeJson('landing_branches', next);
    setBranchName('');
    setBranchDescription('');
    setBranchMapsUrl('');
    setBranchImageData('');
    setBranchImagePreview('');
    showToast('تمت إضافة الفرع بنجاح', 'success');
  };

  const deleteLandingBranch = (index: number) => {
    if (!window.confirm('حذف الفرع من العرض؟')) return;
    const next = landingBranches.filter((_, itemIndex) => itemIndex !== index);
    setLandingBranches(next);
    writeJson('landing_branches', next);
  };

  const uploadLBranchImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result;
      if (typeof result === 'string') {
        setBranchImageData(result);
        setBranchImagePreview(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const uploadTImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result;
      if (typeof result === 'string') {
        setTestimonialForm((prev) => ({ ...prev, image: result }));
        setTestimonialPreview(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const addTestimonial = () => {
    if (!testimonialForm.name.trim() || !testimonialForm.text.trim()) {
      showToast('يرجى إدخال اسم العميل ونص الرأي على الأقل', 'error');
      return;
    }
    const next = [...testimonials, { ...testimonialForm, image: testimonialForm.image }];
    setTestimonials(next);
    writeJson('landing_testimonials', next);
    setTestimonialForm({ name: '', role: '', text: '', rating: '5', image: '' });
    setTestimonialPreview('');
    showToast('تمت إضافة الرأي بنجاح', 'success');
  };

  const deleteTestimonial = (index: number) => {
    if (!window.confirm('هل تريد حذف هذا الرأي؟')) return;
    const next = testimonials.filter((_, itemIndex) => itemIndex !== index);
    setTestimonials(next);
    writeJson('landing_testimonials', next);
  };

  const addLandingPlan = () => {
    if (!planForm.name.trim() || !planForm.price.trim()) {
      showToast('يرجى إدخال الاسم والسعر الحالي', 'error');
      return;
    }
    const next = [
      ...plans,
      {
        name: planForm.name.trim(),
        originalPrice: planForm.originalPrice || null,
        price: planForm.price,
        features: planForm.features.split(',').map((item) => item.trim()).filter(Boolean),
        isFeatured: planForm.isFeatured,
      },
    ];
    setPlans(next);
    writeJson('landing_pricing_plans', next);
    setPlanForm({ originalPrice: '', name: '', price: '', features: '', isFeatured: false });
    showToast('تمت إضافة الباقة بنجاح', 'success');
  };

  const deleteLandingPlan = (index: number) => {
    const next = plans.filter((_, itemIndex) => itemIndex !== index);
    setPlans(next);
    writeJson('landing_pricing_plans', next);
  };

  const uploadLandingMedia = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    const fileArray = Array.from(files);
    const fileCount = fileArray.length;
    event.target.value = '';

    const newItems: LandingMediaItem[] = [];
    let loaded = 0;
    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const result = loadEvent.target?.result;
        if (typeof result === 'string') {
          newItems.push({ type: file.type, data: result });
        }
        loaded++;
        if (loaded === fileCount) {
          setMediaItems((prev) => {
            const combined = [...newItems, ...prev].slice(0, 40);
            writeJson('landing_media', combined);
            return combined;
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const deleteLandingMedia = (index: number) => {
    const next = mediaItems.filter((_, itemIndex) => itemIndex !== index);
    setMediaItems(next);
    writeJson('landing_media', next);
  };

  const uploadNewsImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result;
      if (typeof result === 'string') {
        setNewsForm((prev) => ({ ...prev, image: result }));
        setNewsPreview(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const resetNewsEdit = () => {
    setEditingNewsIndex(-1);
    setNewsForm({ title: '', category: '', date: '', link: '', image: '' });
    setNewsPreview('');
  };

  const addLandingNews = () => {
    const { title, category, date, image } = newsForm;
    if (!title || !category || !date || !image) {
      showToast('يرجى إكمال بيانات الخبر والصورة', 'error');
      return;
    }
    const item: LandingNewsItem = { title, category, date, link: newsForm.link || '#', image };
    const next = editingNewsIndex >= 0 ? newsItems.map((news, index) => (index === editingNewsIndex ? item : news)) : [item, ...newsItems].slice(0, 6);
    setNewsItems(next);
    writeJson('landing_news', next);
    resetNewsEdit();
    showToast(editingNewsIndex >= 0 ? 'تم تحديث الخبر بنجاح' : 'تمت إضافة الخبر بنجاح', 'success');
  };

  const editLandingNews = (index: number) => {
    const item = newsItems[index];
    if (!item) return;
    setEditingNewsIndex(index);
    setNewsForm({ title: item.title, category: item.category, date: item.date, link: item.link === '#' ? '' : item.link, image: item.image });
    setNewsPreview(item.image);
  };

  const deleteLandingNews = (index: number) => {
    const next = newsItems.filter((_, itemIndex) => itemIndex !== index);
    setNewsItems(next);
    writeJson('landing_news', next);
  };

  const uploadSportImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        setSportImage(result);
        setSportImagePreview(result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const addLandingSport = () => {
    if (!sportName.trim()) {
      showToast('يرجى إدخال اسم الرياضة', 'error');
      return;
    }
    const item: LandingSportItem = { name: sportName.trim(), tag: sportTag.trim(), desc: sportDesc.trim(), image: sportImage };
    const next = [item, ...landingSports];
    setLandingSports(next);
    writeJson('landing_sports', next);
    setSportName('');
    setSportTag('');
    setSportDesc('');
    setSportImage('');
    setSportImagePreview('');
    showToast('تمت إضافة الرياضة بنجاح', 'success');
  };

  const deleteLandingSport = (index: number) => {
    const next = landingSports.filter((_, i) => i !== index);
    setLandingSports(next);
    writeJson('landing_sports', next);
  };

  const saveSportsTitle = () => {
    writeString('landing_sports_title', sectionTitle);
    showToast('تم حفظ عنوان قسم الرياضات', 'success');
  };

  const addLandingFaq = () => {
    if (!faqForm.q.trim() || !faqForm.a.trim()) {
      showToast('يرجى كتابة السؤال والإجابة', 'error');
      return;
    }
    const next = [...landingFaq, { q: faqForm.q.trim(), a: faqForm.a.trim() }];
    setLandingFaq(next);
    writeJson('landing_faq', next);
    setFaqForm({ q: '', a: '' });
    showToast('تمت إضافة السؤال بنجاح', 'success');
  };

  const deleteLandingFaq = (index: number) => {
    const next = landingFaq.filter((_, i) => i !== index);
    setLandingFaq(next);
    writeJson('landing_faq', next);
  };

  const saveAllLandingSettings = async () => {
    const fullPayload = {
      landing_hero_settings: heroSettings,
      landing_hero_image: heroImagePreview,
      landing_branches: landingBranches,
      landing_sports: landingSports,
      landing_sports_title: sectionTitle,
      landing_pricing_plans: plans,
      landing_testimonials: testimonials,
      landing_faq: landingFaq,
      landing_footer: landingFooter,
      landing_ceo_photo: ceoPhotoUrl,
    };

    writeJson('landing_settings_full', fullPayload);
    writeJson('landing_hero_settings', heroSettings);
    writeJson('landing_branches', landingBranches);
    writeJson('landing_sports', landingSports);
    writeJson('landing_pricing_plans', plans);
    writeJson('landing_testimonials', testimonials);
    writeJson('landing_faq', landingFaq);
    writeJson('landing_footer', landingFooter);

    broadcastLandingChange('landing_full', fullPayload);

    let savedOk = false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/landing-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload),
      });
      if (res.ok) savedOk = true;
    } catch (err) {
      console.warn('Failed to save landing settings to backend:', err);
    }

    if (savedOk) {
      showToast('تم حفظ ونشر جميع تعديلات اللاندنج بيدج  بنجاح 🚀', 'success');
    } else {
      showToast('تم حفظ التعديلات وبثها محلياً بنجاح ⚡', 'success');
    }
  };


  const tabButtonClass = (tab: TabKey) =>
    `rounded-2xl border px-5 py-3 text-xs md:text-sm font-bold transition-all ${activeTab === tab ? 'border-sky-600 bg-sky-600 text-white shadow-md shadow-sky-600/20' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
    }`;

  const tabContentClass = 'space-y-6';

  const auditPagination = useMemo(() => {
    if (auditTotalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-3 pt-3">
        <button
          type="button"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          disabled={auditPage <= 1 || auditLoading}
          onClick={() => void loadAuditLogs(auditPage - 1)}
        >
          السابق
        </button>
        <span className="text-xs font-bold text-slate-700">
          صفحة {auditPage} من {auditTotalPages}
        </span>
        <button
          type="button"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          disabled={auditPage >= auditTotalPages || auditLoading}
          onClick={() => void loadAuditLogs(auditPage + 1)}
        >
          التالي
        </button>
      </div>
    );
  }, [auditLoading, auditPage, auditTotalPages, loadAuditLogs]);

  return (
    <div dir="rtl" className="space-y-6 font-sans">
      {/* ── Header Banner ── */}
      <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 text-slate-500">
              <AppIcon icon={Settings01} className="text-sky-600 h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-wider text-sky-600">لوحة الإدارة المركزية</span>
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-extrabold text-slate-900">إعدادات النظام وسجل الحركات</h1>
            <p className="mt-1 text-xs md:text-sm text-slate-500">
              التحكم في بيانات الأكاديمية واللوجو واسم النظام، تتبع سجل حركات المبيعات والشراء مع الفلترة، وإدارة الأمان والتصدير.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-2xl bg-sky-600 px-5 py-3 text-xs md:text-sm font-bold text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-700"
              onClick={saveGeneralSettings}
            >
              حفظ الإعدادات العامة
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs Navigation Bar ── */}
      <div className="flex flex-wrap gap-2.5 rounded-3xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200/70">
        <button type="button" className={tabButtonClass('general')} onClick={() => setActiveTab('general')}>
          ⚙️ العام
        </button>
        <button type="button" className={tabButtonClass('security')} onClick={() => setActiveTab('security')}>
          🔒 الأمان وحسابي
        </button>
        <button type="button" className={tabButtonClass('landing')} onClick={() => setActiveTab('landing')}>
          🌐 اللاندنج بيدج
        </button>
        <button type="button" className={tabButtonClass('backup')} onClick={() => setActiveTab('backup')}>
          📦 النسخ الاحتياطي
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── TAB 1: General (العام) ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'general' ? (
        <div className={tabContentClass}>
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-900">هوية النظام والبيانات العامة</h2>
              <p className="text-xs text-slate-500">تعديل اسم النادي/الأكاديمية واللوجو واسم السايدبار وإشعارات البريد</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* System / Academy Name */}
              <label className="space-y-2 text-right text-xs font-bold text-slate-700">
                اسم النظام والأكاديمية (يظهر في السايدبار والواجهة)
                <input
                  value={general.academyName}
                  onChange={(e) => setGeneral((prev) => ({ ...prev, academyName: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  placeholder="ايجي سبورتنج كلوب"
                />
              </label>

              {/* Notification Email (Replaces WhatsApp) */}
              <label className="space-y-2 text-right text-xs font-bold text-slate-700">
                البريد الإلكتروني للإشعارات والتنبيهات
                <input
                  type="email"
                  value={general.notificationEmail}
                  onChange={(e) => setGeneral((prev) => ({ ...prev, notificationEmail: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  placeholder="notifications@egy-academy.com"
                />
                <span className="text-[10px] text-slate-400 block font-normal">
                  يستخدم لإرسال تنبيهات الطلاب المتأخرين في السداد والعمليات المالية والمبيعات والمشتريات.
                </span>
              </label>

              {/* Default Currency */}
              <label className="space-y-2 text-right text-xs font-bold text-slate-700">
                العملة الافتراضية
                <select
                  value={general.currency}
                  onChange={(e) => setGeneral((prev) => ({ ...prev, currency: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                >
                  <option value="EGP">جنيه مصري (EGP)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                  <option value="SAR">ريال سعودي (SAR)</option>
                </select>
              </label>

              {/* System Language */}
              <label className="space-y-2 text-right text-xs font-bold text-slate-700">
                لغة النظام الافتراضية
                <select
                  value={general.language}
                  onChange={(e) => setGeneral((prev) => ({ ...prev, language: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                >
                  <option value="ar">العربية (Arabic)</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>

            {/* Logo & Sidebar Image Uploaders */}
            <div className="grid gap-6 md:grid-cols-2 pt-4 border-t border-slate-100">
              {/* Site Logo Uploader */}
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="block text-xs font-bold text-slate-800">صورة لوجو الموقع الرسمي (Site Logo)</label>
                <div className="flex items-center gap-4">
                  {general.siteLogo ? (
                    <img src={general.siteLogo} alt="Site Logo" className="h-16 w-16 rounded-xl object-cover border border-slate-200" />
                  ) : (
                    <div className="h-16 w-16 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 text-xs font-bold">
                      لا يوجد
                    </div>
                  )}
                  <div className="space-y-2 flex-1">
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition">
                      <span>🖼️ رفع صورة اللوجو</span>
                      <input type="file" accept="image/*" hidden onChange={uploadSiteLogo} />
                    </label>
                    <input
                      type="text"
                      value={general.siteLogo}
                      onChange={(e) => setGeneral((prev) => ({ ...prev, siteLogo: e.target.value }))}
                      placeholder="أو ضع رابط الصورة هنا..."
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Sidebar Logo Uploader */}
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="block text-xs font-bold text-slate-800">صورة وشعار السايدبار (Sidebar Image)</label>
                <div className="flex items-center gap-4">
                  {general.sidebarLogo ? (
                    <img src={general.sidebarLogo} alt="Sidebar Logo" className="h-16 w-16 rounded-xl object-cover border border-slate-200" />
                  ) : (
                    <div className="h-16 w-16 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 text-xs font-bold">
                      شعار النادي
                    </div>
                  )}
                  <div className="space-y-2 flex-1">
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition">
                      <span>🎨 رفع صورة السايدبار</span>
                      <input type="file" accept="image/*" hidden onChange={uploadSidebarLogo} />
                    </label>
                    <input
                      type="text"
                      value={general.sidebarLogo}
                      onChange={(e) => setGeneral((prev) => ({ ...prev, sidebarLogo: e.target.value }))}
                      placeholder="أو ضع رابط الصورة هنا..."
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                className="rounded-2xl bg-sky-600 px-6 py-3 text-xs font-bold text-white shadow-md transition hover:bg-sky-700"
                onClick={saveGeneralSettings}
              >
                حفظ التغييرات
              </button>
            </div>
          </div>
        </div>
      ) : null}



      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── TAB 3: Security & Password (الأمان وحسابي) ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'security' ? (
        <div className={tabContentClass}>
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-900">الأمان وتغيير كلمة المرور</h2>
              <p className="text-xs text-slate-500">إدارة كلمة المرور وحماية حساب المستخدم الجاري</p>
            </div>

            {/* Active User Card */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 font-extrabold text-white text-lg">
                  {loggedUser.name?.charAt(0) || 'م'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{loggedUser.name}</h3>
                  <p className="text-xs text-slate-500">{loggedUser.email} · {loggedUser.role}</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-100 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
                ● الجلسة مَحمية وآمنة
              </span>
            </div>

            {/* Change Password Form */}
            <div className="grid gap-4 md:grid-cols-2 pt-2">
              <label className="space-y-2 text-right text-xs font-bold text-slate-700">
                كلمة المرور الجديدة
                <input
                  type="password"
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords((prev) => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  placeholder="أدخل كلمة مرور جديدة (6 أحرف فأكثر)"
                />
              </label>
              <label className="space-y-2 text-right text-xs font-bold text-slate-700">
                تأكيد كلمة المرور الجديدة
                <input
                  type="password"
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  placeholder="عد كتابة كلمة المرور للتأكيد"
                />
              </label>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                className="rounded-2xl bg-amber-600 px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-amber-700 transition"
                onClick={changeUserPassword}
              >
                تحديث كلمة المرور
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── TAB 4: Landing Page Management (اللاندنج بيدج) ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'landing' ? (
        <div className={tabContentClass}>
          {/* Header Action Bar with Master Save */}
          <div className="overflow-hidden rounded-3xl bg-slate-900 text-white shadow-xl ring-1 ring-slate-800">
            <div className="flex flex-col gap-4 border-b border-slate-800 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">لوحة التحكم المركزية باللاندنج بيدج</span>
                </div>
                <h2 className="mt-1 text-2xl font-bold text-white">إدارة محتوى ومكونات اللاندنج بيدج بالكامل</h2>
                <p className="mt-1 text-xs text-slate-400">التحكم الكامل في الهيرو، الفروع، الرياضات، الأسعار، الآراء، الأسئلة الشائعة وتحديث الباك إند.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveAllLandingSettings}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500"
                >
                  <span>💾 حفظ ونشر التعديلات بالكامل</span>
                </button>
              </div>
            </div>

            {/* Live Preview Bar */}
            <div className="relative min-h-[160px] w-full overflow-hidden bg-slate-950 p-6 flex flex-col justify-end">
              {heroSettings.bgType === 'video' && heroSettings.videoUrl ? (
                <video key={heroSettings.videoUrl} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover opacity-40">
                  <source src={heroSettings.videoUrl} type="video/mp4" />
                </video>
              ) : heroImagePreview || heroSettings.imageUrl ? (
                <img src={heroImagePreview || heroSettings.imageUrl} alt="Hero Preview" className="absolute inset-0 h-full w-full object-cover opacity-40" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 opacity-90" />
              )}
              <div className="relative z-10 space-y-1">
                <span className="inline-block rounded-full bg-orange-600/80 px-3 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                  {heroSettings.badgeText || '8K+ Active Players'}
                </span>
                <h1 className="text-xl md:text-2xl font-extrabold text-white">{heroSettings.title || 'اصنع مستقبلك الرياضي معنا'}</h1>
                <p className="max-w-xl text-xs text-slate-300 line-clamp-1">{heroSettings.subtitle || 'أكاديمية ايجي سبورتنج لبناء الأبطال'}</p>
              </div>
            </div>
          </div>

          {/* Section 1: Hero & Media */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">🎯 1. إعدادات الهيرو والإعلان الرئيسي</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-xs font-bold text-slate-700">
                العنوان الرئيسي (Title)
                <input
                  value={heroSettings.title}
                  onChange={(e) => setHeroSettings((prev) => ({ ...prev, title: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  placeholder="العنوان الرئيسي"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                نص الشارة العلوية (Badge Text)
                <input
                  value={heroSettings.badgeText || ''}
                  onChange={(e) => setHeroSettings((prev) => ({ ...prev, badgeText: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  placeholder="8K+ Active Players — The #1 Choice"
                />
              </label>
            </div>
            <label className="block text-xs font-bold text-slate-700">
              الوصف الفرعي (Subtitle)
              <textarea
                value={heroSettings.subtitle}
                onChange={(e) => setHeroSettings((prev) => ({ ...prev, subtitle: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                rows={2}
                placeholder="وصف مختصر للخدمات والبرامج"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-xs font-bold text-slate-700">
                رابط فيديو الخلفية (Direct MP4 URL)
                <input
                  value={heroSettings.videoUrl}
                  onChange={(e) => setHeroSettings((prev) => ({ ...prev, videoUrl: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  placeholder="https://example.com/video.mp4"
                />
              </label>
              <div className="space-y-1">
                <span className="block text-xs font-bold text-slate-700">صورة خلفية الهيرو</span>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition">
                  <span>📷 رفع صورة خلفية جديدة</span>
                  <input type="file" accept="image/*" hidden onChange={uploadHeroImage} />
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Sports & Programs Management */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">🏅 2. إدارة البرامج والرياضات المتاحة</h3>
                <p className="text-xs text-slate-500">إضافة وتعديل وحذف الرياضات التي تظهر في معرض الرياضات بالواجهة</p>
              </div>
              <input
                value={sectionTitle}
                onChange={(e) => setSectionTitle(e.target.value)}
                onBlur={saveSportsTitle}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-900 outline-none"
                placeholder="عنوان قسم الرياضات"
              />
            </div>

            {/* Form: Add New Sport */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
              <h4 className="font-bold text-slate-800 text-xs">إضافة رياضة / برنامج جديد +</h4>
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  value={sportName}
                  onChange={(e) => setSportName(e.target.value)}
                  placeholder="اسم الرياضة (مثال: كرة القدم)"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500"
                />
                <input
                  value={sportTag}
                  onChange={(e) => setSportTag(e.target.value)}
                  placeholder="التصنيف (مثال: كرة القدم، السباحة)"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500"
                />
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">
                  <span>🖼️ {sportImagePreview ? 'تم اختيار صورة' : 'رفع صورة الرياضة'}</span>
                  <input type="file" accept="image/*" hidden onChange={uploadSportImage} />
                </label>
              </div>
              <textarea
                value={sportDesc}
                onChange={(e) => setSportDesc(e.target.value)}
                placeholder="وصف تفصيلي للبرنامج التدريبي..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500"
                rows={2}
              />
              <button
                type="button"
                onClick={addLandingSport}
                className="rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-sky-700 transition"
              >
                + إدراج الرياضة في المعرض
              </button>
            </div>

            {/* List: Existing Sports */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {landingSports.map((sport, index) => (
                <div key={index} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  {sport.image && (
                    <img src={sport.image} alt={sport.name} className="h-28 w-full rounded-xl object-cover border border-slate-200" />
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{sport.name}</span>
                    <span className="rounded-full bg-sky-100 text-sky-800 px-2.5 py-0.5 text-[10px] font-bold">{sport.tag}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{sport.desc}</p>
                  <button
                    type="button"
                    onClick={() => deleteLandingSport(index)}
                    className="w-full rounded-xl bg-rose-50 border border-rose-200 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
                  >
                    🗑️ حذف الرياضة
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Branches & Facilities Management */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">🏢 3. إدارة الفروع والمرافق المتاحة</h3>
              <p className="text-xs text-slate-500">إضافة فروع الأكاديمية ومواقعها ومرافقها الرياضية</p>
            </div>

            {/* Form: Add New Branch */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
              <h4 className="font-bold text-slate-800 text-xs">إضافة فرع جديد +</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="اسم الفرع (مثال: فرع دبي هيلز)"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500"
                />
                <input
                  value={branchMapsUrl}
                  onChange={(e) => setBranchMapsUrl(e.target.value)}
                  placeholder="رابط خرائط جوجل (Google Maps URL)"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500"
                />
              </div>
              <textarea
                value={branchDescription}
                onChange={(e) => setBranchDescription(e.target.value)}
                placeholder="العنوان ومواعيد العمل والمميزات (مفصولة بفاصلة)..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500"
                rows={2}
              />
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">
                  <span>🖼️ {branchImagePreview ? 'تم اختيار صورة' : 'رفع صورة الفرع'}</span>
                  <input type="file" accept="image/*" hidden onChange={uploadLBranchImage} />
                </label>
                <button
                  type="button"
                  onClick={addLandingBranch}
                  className="rounded-xl bg-sky-600 px-5 py-2 text-xs font-bold text-white hover:bg-sky-700 transition"
                >
                  + إدراج الفرع
                </button>
              </div>
            </div>

            {/* List: Existing Branches */}
            <div className="grid gap-3 md:grid-cols-2">
              {landingBranches.map((branch, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  {branch.image && (
                    <img src={branch.image} alt={branch.name} className="h-32 w-full rounded-xl object-cover border border-slate-200" />
                  )}
                  <h4 className="font-bold text-slate-900 text-sm">{branch.name}</h4>
                  <p className="text-xs text-slate-500">{branch.description}</p>
                  <button
                    type="button"
                    onClick={() => deleteLandingBranch(index)}
                    className="w-full rounded-xl bg-rose-50 border border-rose-200 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
                  >
                    🗑️ حذف الفرع
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Pricing Plans & Subscriptions */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">💳 4. إدارة باقات الاشتراكات والأسعار</h3>
              <p className="text-xs text-slate-500">إضافة وتحديث باقات الاشتراك الشهري والسنوي والأسعار</p>
            </div>

            {/* Form: Add New Plan */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
              <h4 className="font-bold text-slate-800 text-xs">إضافة باقة اشتراك جديدة +</h4>
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  value={planForm.name}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="اسم الباقة (مثال: الباقة الاحترافية Pro)"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500"
                />
                <input
                  value={planForm.price}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="السعر الشهري (مثال: 310)"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500"
                />
                <input
                  value={planForm.originalPrice}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, originalPrice: e.target.value }))}
                  placeholder="السعر السنوي / قبل الخصم (اختياري)"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500"
                />
              </div>
              <input
                value={planForm.features}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, features: e.target.value }))}
                placeholder="المميزات مفصولة بفاصلة (مثال: 4 حصص أسبوعياً, طقم رياضي, تقييم مهارات)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={planForm.isFeatured}
                    onChange={(e) => setPlanForm((prev) => ({ ...prev, isFeatured: e.target.checked }))}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>تميز هذه الباقة بعبارة (الأكثر طلباً / MOST POPULAR)</span>
                </label>
                <button
                  type="button"
                  onClick={addLandingPlan}
                  className="rounded-xl bg-sky-600 px-5 py-2 text-xs font-bold text-white hover:bg-sky-700 transition"
                >
                  + إدراج الباقة
                </button>
              </div>
            </div>

            {/* List: Existing Plans */}
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan, index) => (
                <div
                  key={index}
                  className={`rounded-2xl border p-4 space-y-3 relative ${plan.isFeatured ? 'border-amber-400 bg-amber-50/30 ring-2 ring-amber-400/20' : 'border-slate-200 bg-slate-50'
                    }`}
                >
                  {plan.isFeatured && (
                    <span className="absolute -top-3 left-3 bg-amber-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      الأكثر طلباً 🔥
                    </span>
                  )}
                  <h4 className="font-bold text-slate-900 text-sm">{plan.name}</h4>
                  <div className="text-xl font-extrabold text-sky-700">
                    {plan.price} <span className="text-xs font-normal text-slate-500">ج.م / شهرياً</span>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {plan.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-1.5">
                        <span className="text-emerald-500 font-bold">✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => deleteLandingPlan(index)}
                    className="w-full rounded-xl bg-rose-50 border border-rose-200 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
                  >
                    🗑️ حذف الباقة
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Testimonials & Reviews */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">💬 5. آراء العملاء وأولياء الأمور</h3>
              <p className="text-xs text-slate-500">إدارة التقييمات وآراء أولياء الأمور المعروضة بالموقع</p>
            </div>

            {/* Form: Add Testimonial */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
              <h4 className="font-bold text-slate-800 text-xs">إضافة رأي جديد +</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={testimonialForm.name}
                  onChange={(e) => setTestimonialForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="اسم ولي الأمر / العميل (مثال: سارة م.)"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500"
                />
                <input
                  value={testimonialForm.role}
                  onChange={(e) => setTestimonialForm((prev) => ({ ...prev, role: e.target.value }))}
                  placeholder="الوصف (مثال: والدة مايا - 9 سنوات)"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500"
                />
              </div>
              <textarea
                value={testimonialForm.text}
                onChange={(e) => setTestimonialForm((prev) => ({ ...prev, text: e.target.value }))}
                placeholder="نص التقييم والرأي..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500"
                rows={2}
              />
              <button
                type="button"
                onClick={addTestimonial}
                className="rounded-xl bg-sky-600 px-5 py-2 text-xs font-bold text-white hover:bg-sky-700 transition"
              >
                + إدراج التقييم
              </button>
            </div>

            {/* List: Existing Testimonials */}
            <div className="grid gap-3 md:grid-cols-2">
              {testimonials.map((tItem, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{tItem.name}</span>
                    <span className="text-xs text-amber-500 font-bold">★★★★★</span>
                  </div>
                  <p className="text-xs text-slate-600 italic">"{tItem.text}"</p>
                  <p className="text-[11px] text-slate-400">{tItem.role}</p>
                  <button
                    type="button"
                    onClick={() => deleteTestimonial(index)}
                    className="w-full rounded-xl bg-rose-50 border border-rose-200 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
                  >
                    🗑️ حذف الرأي
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 6: FAQ Management */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">❓ 6. الأسئلة الشائعة (FAQ)</h3>
              <p className="text-xs text-slate-500">إضافة وتعديل الأسئلة الشائعة التي تجيب على استفسارات الأولياء</p>
            </div>

            {/* Form: Add FAQ */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <h4 className="font-bold text-slate-800 text-xs">إضافة سؤال جديد +</h4>
              <input
                value={faqForm.q}
                onChange={(e) => setFaqForm((prev) => ({ ...prev, q: e.target.value }))}
                placeholder="السؤال (مثال: ما هي الفئات العمرية المتاحة؟)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500"
              />
              <textarea
                value={faqForm.a}
                onChange={(e) => setFaqForm((prev) => ({ ...prev, a: e.target.value }))}
                placeholder="الإجابة..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-500"
                rows={2}
              />
              <button
                type="button"
                onClick={addLandingFaq}
                className="rounded-xl bg-sky-600 px-5 py-2 text-xs font-bold text-white hover:bg-sky-700 transition"
              >
                + إدراج السؤال
              </button>
            </div>

            {/* List: Existing FAQs */}
            <div className="space-y-3">
              {landingFaq.map((faq, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h5 className="font-bold text-slate-900 text-xs sm:text-sm">Q: {faq.q}</h5>
                    <p className="text-xs text-slate-600">A: {faq.a}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteLandingFaq(index)}
                    className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shrink-0"
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 7: Footer & Contact Info */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">📜 7. بيانات الفوتر وحقوق الملكية</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-xs font-bold text-slate-700">
                الشعار والرسالة (Tagline)
                <input
                  value={landingFooter.tagline}
                  onChange={(e) => setLandingFooter((prev) => ({ ...prev, tagline: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 outline-none"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                حقوق الملكية (Copyright Notice)
                <input
                  value={landingFooter.rights}
                  onChange={(e) => setLandingFooter((prev) => ({ ...prev, rights: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 outline-none"
                />
              </label>
            </div>
          </div>

          {/* Bottom Fixed-style Master Save CTA */}
          <div className="rounded-3xl bg-slate-900 p-6 text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
            <div>
              <h4 className="font-bold text-base">هل انتهيت من التعديلات؟</h4>
              <p className="text-xs text-slate-400">انقر على الزر لحفظ كافة تعديلات الفروع والرياضات والأسعار مباشرة إلى الباك إند.</p>
            </div>
            <button
              type="button"
              onClick={saveAllLandingSettings}
              className="rounded-2xl bg-emerald-500 px-8 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 transition"
            >
              💾 حفظ ونشر جميع التعديلات الآن 🚀
            </button>
          </div>
        </div>
      ) : null}


      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── TAB 5: Backup & Restore (النسخ الاحتياطي) ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'backup' ? (
        <div className={tabContentClass}>
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-900">إدارة البيانات والنسخ الاحتياطي</h2>
              <p className="text-xs text-slate-500">تصدير نسخة احتياطية كاملة من قاعدة بيانات النظام أو استرجاعها من ملف JSON</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Export Backup Card */}
              <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
                <h3 className="font-bold text-emerald-900 text-sm">تصدير نسخة احتياطية 📦</h3>
                <p className="text-xs text-emerald-700">
                  قم بتحميل ملف يحتوي على كافة بيانات اللاعبين والاشتراكات والمبيعات والفرع وحفظه بأمان.
                </p>
                <button
                  type="button"
                  onClick={exportData}
                  className="rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition"
                >
                  تصدير قاعدة البيانات (JSON)
                </button>
              </div>

              {/* Import Backup Card */}
              <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/50 p-5">
                <h3 className="font-bold text-sky-900 text-sm">استرجاع نسخة احتياطية 📥</h3>
                <p className="text-xs text-sky-700">رفع ملف نسخة احتياطية واستعادة البيانات بالكامل إلى النظام.</p>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-sky-700 transition">
                  <span>اختيار ملف النسخة وتطبيقها</span>
                  <input type="file" accept=".json,application/json" hidden onChange={importData} />
                </label>
              </div>
            </div>

            {/* Emergency Database & System Reset */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-rose-900">مسح بيانات قاعدة البيانات والنظام (ما عدا المستخدمين) ⚠️</h4>
                <p className="text-[11px] text-rose-700">
                  سيتم مسح كافة بيانات قاعدة البيانات والنظام بالكامل (سجلات اللاعبين، الاشتراكات، الحركات المالية، المصروفات، الفروع، السجلات، الحضور) مع الحفاظ التام على حسابات المستخدمين وجلسة تسجيل الدخول.
                </p>
              </div>
              <button
                type="button"
                disabled={isResettingData}
                className="rounded-2xl bg-rose-600 px-5 py-3 text-xs font-extrabold text-white shadow-md hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition whitespace-nowrap flex items-center gap-2"
                onClick={handleResetDataExceptUsers}
              >
                {isResettingData ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                    <span>جاري مسح البيانات...</span>
                  </>
                ) : (
                  <>
                    <span>🧹 مسح بيانات النظام (ما عدا المستخدمين)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Toast Alert Popup */}
      {toast ? (
        <div
          className={`fixed bottom-6 left-6 right-6 z-50 mx-auto max-w-md rounded-2xl px-5 py-3.5 text-xs font-bold text-white shadow-2xl transition-all ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'warning' ? 'bg-amber-600' : 'bg-rose-600'
            }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
