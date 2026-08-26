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
  } catch {}
  try {
    fetch(`${API_BASE_URL}/api/landing-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {});
  } catch {}
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
      title: '',
      subtitle: '',
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
  const [landingBranches, setLandingBranches] = useState<LandingBranchItem[]>(() => readJson('landing_branches', []));
  const [testimonials, setTestimonials] = useState<LandingTestimonialItem[]>(() => readJson('landing_testimonials', []));
  const [testimonialForm, setTestimonialForm] = useState({ name: '', role: '', text: '', rating: '5', image: '' });
  const [testimonialPreview, setTestimonialPreview] = useState('');
  const [planForm, setPlanForm] = useState({ originalPrice: '', name: '', price: '', features: '', isFeatured: false });
  const [plans, setPlans] = useState<LandingPlanItem[]>(() => readJson('landing_pricing_plans', []));
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
  const [landingSports, setLandingSports] = useState<LandingSportItem[]>(() => readJson('landing_sports', []));
  const [sectionTitle, setSectionTitle] = useState(() => readString('landing_sports_title'));

  // Audit Logs Filtration States
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditUserFilter, setAuditUserFilter] = useState('all');
  const [auditTypeFilter, setAuditTypeFilter] = useState('all');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);

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
        } catch {}
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

  // Backup Import & Export handlers
  const exportData = () => {
    const backupObject: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        try {
          backupObject[key] = JSON.parse(localStorage.getItem(key) || '');
        } catch {
          backupObject[key] = localStorage.getItem(key);
        }
      }
    }

    const data = JSON.stringify(backupObject, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `egy_academy_backup_${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('تم تصدير النسخة الاحتياطية بنجاح 📦', 'success');
  };

  const importData = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content) as Record<string, unknown>;

        if (typeof parsed === 'object' && parsed !== null) {
          if (window.confirm('⚠️ تحذير: استرجاع النسخة الاحتياطية سيستبدل البيانات الحالية. هل ترغب في الاستمرار؟')) {
            Object.entries(parsed).forEach(([k, v]) => {
              if (typeof v === 'string') {
                window.localStorage.setItem(k, v);
              } else {
                window.localStorage.setItem(k, JSON.stringify(v));
              }
            });
            showToast('تم استرجاع النسخة الاحتياطية بنجاح! جاري تحديث الصفحة...', 'success');
            setTimeout(() => window.location.reload(), 1200);
          }
        }
      } catch {
        showToast('ملف النسخة الاحتياطية غير صالح', 'error');
      }
    };
    reader.readAsText(file);
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

  const tabButtonClass = (tab: TabKey) =>
    `rounded-2xl border px-5 py-3 text-xs md:text-sm font-bold transition-all ${
      activeTab === tab ? 'border-sky-600 bg-sky-600 text-white shadow-md shadow-sky-600/20' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
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
          {/* Live Preview Header Card */}
          <div className="overflow-hidden rounded-3xl bg-slate-900 text-white shadow-xl ring-1 ring-slate-800">
            <div className="flex flex-col gap-4 border-b border-slate-800 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">معاينة حية ومباشرة (Live Preview)</span>
                </div>
                <h2 className="mt-1 text-2xl font-bold text-white">معاينة واجهة اللاندنج بيدج</h2>
                <p className="mt-1 text-xs text-slate-400">أي تعديل في المدخلات بالأسفل ينعكس فوراً في هذه المعاينة.</p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="https://egyacaback.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-sky-500"
                >
                  <span>فتح اللاندنج بيدج الكاملة ↗</span>
                </a>
              </div>
            </div>

            {/* Simulated Hero Section */}
            <div className="relative min-h-[240px] w-full overflow-hidden bg-slate-950 p-8 flex flex-col justify-end">
              {heroSettings.bgType === 'video' && heroSettings.videoUrl ? (
                <video key={heroSettings.videoUrl} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover opacity-50">
                  <source src={heroSettings.videoUrl} type="video/mp4" />
                </video>
              ) : heroImagePreview || heroSettings.imageUrl ? (
                <img src={heroImagePreview || heroSettings.imageUrl} alt="Hero Preview" className="absolute inset-0 h-full w-full object-cover opacity-50" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 opacity-90" />
              )}
              <div className="relative z-10 space-y-2">
                <h1 className="text-2xl md:text-3xl font-extrabold text-white">{heroSettings.title || 'اصنع مستقبلك الرياضي معنا'}</h1>
                <p className="max-w-xl text-xs md:text-sm text-slate-300">{heroSettings.subtitle || 'أكاديمية ايجي سبورتنج لبناء الأبطال'}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">إعدادات الهيرو (Hero Section)</h2>
              <label className="block text-xs font-bold text-slate-700">
                العنوان الرئيسي
                <input
                  value={heroSettings.title}
                  onChange={(e) => setHeroSettings((prev) => ({ ...prev, title: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 outline-none"
                  placeholder="العنوان الرئيسي"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                الوصف الفرعي
                <textarea
                  value={heroSettings.subtitle}
                  onChange={(e) => setHeroSettings((prev) => ({ ...prev, subtitle: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 outline-none"
                  rows={2}
                  placeholder="وصف مختصر"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                فيديو الخلفية (رابط mp4)
                <input
                  value={heroSettings.videoUrl}
                  onChange={(e) => setHeroSettings((prev) => ({ ...prev, videoUrl: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 outline-none"
                  placeholder="رابط فيديو خلفية الهيرو"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700">
                <span>📷 رفع صورة خلفية</span>
                <input type="file" accept="image/*" hidden onChange={uploadHeroImage} />
              </label>
              <button
                type="button"
                className="w-full rounded-2xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-sky-700"
                onClick={saveLandingHeroSettings}
              >
                حفظ إعدادات الهيرو
              </button>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">سيرة رئيس مجلس الإدارة</h2>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700">
                <span>👤 رفع صورة رئيس مجلس الإدارة</span>
                <input type="file" accept="image/*" hidden onChange={uploadCeoPhoto} />
              </label>
              {ceoPhotoPreview && <img src={ceoPhotoPreview} alt="CEO" className="h-28 rounded-2xl object-cover border border-slate-200" />}
              <button
                type="button"
                className="w-full rounded-2xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-sky-700"
                onClick={saveCeoBiographySettings}
              >
                حفظ صورة السيرة الذاتية
              </button>
            </div>
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
                  <input type="file" accept=".json" hidden onChange={importData} />
                </label>
              </div>
            </div>

            {/* Emergency Reset */}
            <div className="pt-4 border-t border-slate-100">
              <button
                type="button"
                className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
                onClick={() => {
                  if (window.confirm('⚠️ تحذير شديد: هل أنت متأكد من مسح جميع البيانات والتخزين المحلي للنظام بالكامل؟')) {
                    window.localStorage.clear();
                    window.location.reload();
                  }
                }}
              >
                ⚠️ مسح التخزين المحلي المحلي وإعادة الضبط
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Toast Alert Popup */}
      {toast ? (
        <div
          className={`fixed bottom-6 left-6 right-6 z-50 mx-auto max-w-md rounded-2xl px-5 py-3.5 text-xs font-bold text-white shadow-2xl transition-all ${
            toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'warning' ? 'bg-amber-600' : 'bg-rose-600'
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
