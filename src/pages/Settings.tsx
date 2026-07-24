import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { SearchSm, Settings01 } from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';
import { API_BASE_URL } from '@/api';

type TabKey = 'general' | 'financial' | 'invoices' | 'security' | 'landing' | 'backup' | 'audit';

type ToastType = 'success' | 'error' | 'warning';

type GeneralSettings = {
  academyName: string;
  currency: string;
  language: string;
  whatsappNumber: string;
  darkMode: boolean;
};

type FinancialSettings = {
  defaultPrice: string;
  taxRate: string;
};

type InvoiceSettings = {
  title: string;
  logo: string;
  footer: string;
  contact: string;
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
  createdAt: string;
  userName: string;
  userRole: string;
  action: string;
  section: string;
  description: string;
};

type AuditResponse = {
  logs?: AuditLog[];
  page?: number;
  pages?: number;
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
}

function writeString(key: string, value: string) {
  if (typeof window === 'undefined') return;
  if (!value) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, value);
  }
  broadcastLandingChange(key, value);
}

function readString(key: string) {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(key) || '';
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [isAdmin] = useState(() => {
    const user = readJson<{ roleKey?: string; role?: string }>('loggedInUser', {});
    return (user.roleKey || user.role || '').toLowerCase() === 'admin';
  });

  const [general, setGeneral] = useState<GeneralSettings>(() => readJson('system_settings_general', {
    academyName: '',
    currency: 'EGP',
    language: 'ar',
    whatsappNumber: '',
    darkMode: false,
  }));
  const [financial, setFinancial] = useState<FinancialSettings>(() => readJson('system_settings_financial', { defaultPrice: '', taxRate: '' }));
  const [invoice, setInvoice] = useState<InvoiceSettings>(() => readJson('system_settings_invoice', { title: '', logo: '', footer: '', contact: '' }));
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });

  const [heroSettings, setHeroSettings] = useState<LandingHeroSettings>(() => readJson('landing_hero_settings', {
    title: '',
    subtitle: '',
    videoUrl: '',
    bgType: 'video',
    imageUrl: '',
  }));
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
  const [branchNameSetting, setBranchNameSetting] = useState('');

  useEffect(() => {
    writeJson('landing_hero_settings', heroSettings);
  }, [heroSettings]);

  useEffect(() => {
    writeJson('system_settings_general', general);
  }, [general]);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (general.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [general.darkMode]);

  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

  const saveGeneralSettings = () => {
    writeJson('system_settings_general', general);
    if (general.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    showToast('تم حفظ الإعدادات العامة', 'success');
  };

  const saveFinancialSettings = () => {
    writeJson('system_settings_financial', financial);
    showToast('تم حفظ الإعدادات المالية', 'success');
  };

  const saveInvoiceSettings = () => {
    writeJson('system_settings_invoice', invoice);
    showToast('تم حفظ إعدادات الفواتير', 'success');
  };

  const changeUserPassword = async () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      showToast('كلمة المرور غير متطابقة', 'error');
      return;
    }
    if (passwords.newPassword.length < 6) {
      showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
      return;
    }

    const user = readJson<{ id?: string }>('loggedInUser', {});
    if (!user?.id) {
      showToast('يجب تسجيل الدخول أولاً', 'error');
      return;
    }

    try {
      const token = window.api?.getToken?.();
      if (token) {
        await window.api?.updateUser?.(user.id, { password: passwords.newPassword });
      } else {
        const users = readJson<Array<{ id: string; password?: string }>>('users', []);
        const index = users.findIndex((item) => item.id === user.id);
        if (index === -1) {
          showToast('لا يمكن تغيير كلمة مرور الأدمن الافتراضي المحلي', 'warning');
          return;
        }
        users[index].password = passwords.newPassword;
        writeJson('users', users);
      }

      setPasswords({ newPassword: '', confirmPassword: '' });
      showToast('تم تغيير كلمة المرور بنجاح', 'success');
    } catch (error) {
      showToast(`فشل تغيير كلمة المرور: ${error instanceof Error ? error.message : 'حدث خطأ'}`, 'error');
    }
  };

  const addSport = () => {
    if (!sportName.trim()) return;
    const games = readJson<Array<{ id: string; name: string; icon: string; playersCount: number }>>('games', []);
    games.push({ id: `game_${Date.now()}`, name: sportName.trim(), icon: 'fa-solid fa-trophy', playersCount: 0 });
    writeJson('games', games);
    setSportName('');
    showToast('تم إضافة الرياضة', 'success');
  };

  const addBranchSetting = () => {
    if (!branchNameSetting.trim()) return;
    const branches = readJson<Array<{ id: string; name: string; manager: string; location: string }>>('branches', []);
    branches.push({ id: `br_${Date.now()}`, name: branchNameSetting.trim(), manager: 'غير محدد', location: 'غير محدد' });
    writeJson('branches', branches);
    setBranchNameSetting('');
    showToast('تم إضافة الفرع', 'success');
  };

  const exportData = () => {
    const data = JSON.stringify(localStorage);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'academy_backup.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const loadAuditLogs = useCallback(async (page = 1) => {
    setAuditLoading(true);
    setAuditPage(page);
    try {
      const token = window.api?.getToken?.();
      if (!token) {
        setAuditLogs([]);
        setAuditTotalPages(1);
        setAuditLoading(false);
        return;
      }
      const response = await window.api?.request?.(`/audit?page=${page}&limit=20&search=${encodeURIComponent(auditSearch)}`);
      const payload = (response as AuditResponse) || {};
      setAuditLogs(payload.logs || []);
      setAuditTotalPages(payload.pages || 1);
    } catch {
      setAuditLogs([]);
      setAuditTotalPages(1);
    } finally {
      setAuditLoading(false);
    }
  }, [auditSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAuditLogs(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [auditSearch, loadAuditLogs]);

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
        showToast('تم تحديث صورة الخلفية بنجاح', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const resetHeroImage = () => {
    if (window.confirm('هل تريد حذف الصورة المخصصة والعودة للصورة الافتراضية؟')) {
      writeString('landing_hero_image', '');
      setHeroSettings((prev) => ({ ...prev, imageUrl: '' }));
      setHeroImagePreview('');
      showToast('تم حذف الصورة المخصصة', 'success');
    }
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
    const next = [...plans, {
      name: planForm.name.trim(),
      originalPrice: planForm.originalPrice || null,
      price: planForm.price,
      features: planForm.features.split(',').map((item) => item.trim()).filter(Boolean),
      isFeatured: planForm.isFeatured,
    }];
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
    // Convert to Array before clearing input so files are retained
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
    if (!sportName.trim()) { showToast('يرجى إدخال اسم الرياضة', 'error'); return; }
    const item: LandingSportItem = { name: sportName.trim(), tag: sportTag.trim(), desc: sportDesc.trim(), image: sportImage };
    const next = [item, ...landingSports];
    setLandingSports(next);
    writeJson('landing_sports', next);
    setSportName(''); setSportTag(''); setSportDesc(''); setSportImage(''); setSportImagePreview('');
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

  const tabButtonClass = (tab: TabKey) => `rounded-2xl border px-4 py-3 text-sm font-semibold transition ${activeTab === tab ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`;

  const tabContentClass = 'space-y-6';

  const auditPagination = useMemo(() => {
    if (auditTotalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-3">
        <button type="button" className="rounded-2xl border border-slate-200 px-3 py-2 text-sm" disabled={auditPage <= 1 || auditLoading} onClick={() => void loadAuditLogs(auditPage - 1)}>
          السابق
        </button>
        <span className="text-sm font-semibold text-slate-700">صفحة {auditPage} من {auditTotalPages}</span>
        <button type="button" className="rounded-2xl border border-slate-200 px-3 py-2 text-sm" disabled={auditPage >= auditTotalPages || auditLoading} onClick={() => void loadAuditLogs(auditPage + 1)}>
          التالي
        </button>
      </div>
    );
  }, [auditLoading, auditPage, auditTotalPages, loadAuditLogs]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 text-slate-500">
              <AppIcon icon={Settings01} className="text-slate-500" />
              <span className="text-sm">إدارة النظام</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">إعدادات النظام</h1>
            <p className="mt-2 text-sm text-slate-600">إدارة الإعدادات العامة والمالية والفواتير واللاندنج بيدج.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700" onClick={saveGeneralSettings}>
              حفظ التغييرات
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-3xl bg-white p-4 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
        <button type="button" className={tabButtonClass('general')} onClick={() => setActiveTab('general')}>عام</button>
        <button type="button" className={tabButtonClass('financial')} onClick={() => setActiveTab('financial')}>إعدادات مالية</button>
        <button type="button" className={tabButtonClass('invoices')} onClick={() => setActiveTab('invoices')}>الفواتير</button>
        <button type="button" className={tabButtonClass('security')} onClick={() => setActiveTab('security')}>الأمان</button>
        <button type="button" className={tabButtonClass('landing')} onClick={() => setActiveTab('landing')}>اللاندنج بيدج</button>
        <button type="button" className={tabButtonClass('backup')} onClick={() => setActiveTab('backup')}>النسخ الاحتياطي</button>
        {isAdmin ? <button type="button" className={tabButtonClass('audit')} onClick={() => setActiveTab('audit')}>سجل النظام</button> : null}
      </div>

      {activeTab === 'general' ? (
        <div className={tabContentClass}>
          <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
            <div className="mb-6 border-b border-slate-200 pb-4">
              <h2 className="text-xl font-semibold text-slate-900">بيانات الأكاديمية</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                اسم الأكاديمية
                <input value={general.academyName} onChange={(event) => setGeneral((prev) => ({ ...prev, academyName: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="ايجى اسبورتنج كلوب" />
              </label>
              <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                العملة الافتراضية
                <select value={general.currency} onChange={(event) => setGeneral((prev) => ({ ...prev, currency: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none">
                  <option value="EGP">جنيه مصري (EGP)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                  <option value="SAR">ريال سعودي (SAR)</option>
                </select>
              </label>
              <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                لغة النظام
                <select value={general.language} onChange={(event) => setGeneral((prev) => ({ ...prev, language: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none">
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                رقم واتساب للإشعارات
                <input value={general.whatsappNumber} onChange={(event) => setGeneral((prev) => ({ ...prev, whatsappNumber: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="201000000000" />
              </label>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <input id="darkMode" type="checkbox" checked={general.darkMode} onChange={(event) => setGeneral((prev) => ({ ...prev, darkMode: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
              <label htmlFor="darkMode" className="text-sm font-medium text-slate-700">الوضع الليلي</label>
            </div>
            <div className="mt-6">
              <button type="button" className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700" onClick={saveGeneralSettings}>حفظ التغييرات</button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'financial' ? (
        <div className={tabContentClass}>
          <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
            <div className="mb-6 border-b border-slate-200 pb-4">
              <h2 className="text-xl font-semibold text-slate-900">الاشتراكات والضرائب</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                قيمة الاشتراك الافتراضية
                <input type="number" value={financial.defaultPrice} onChange={(event) => setFinancial((prev) => ({ ...prev, defaultPrice: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="0.00" />
              </label>
              <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                نسبة الضريبة (%)
                <input type="number" value={financial.taxRate} onChange={(event) => setFinancial((prev) => ({ ...prev, taxRate: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="14" />
              </label>
            </div>
            <div className="mt-6">
              <button type="button" className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700" onClick={saveFinancialSettings}>حفظ التغييرات</button>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
            <div className="mb-6 border-b border-slate-200 pb-4">
              <h2 className="text-xl font-semibold text-slate-900">إدارة الرياضات</h2>
            </div>
            <div className="flex flex-col gap-3 md:flex-row">
              <input value={sportName} onChange={(event) => setSportName(event.target.value)} className="flex-1 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="اسم الرياضة" />
              <button type="button" className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700" onClick={addSport}>إضافة</button>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
            <div className="mb-6 border-b border-slate-200 pb-4">
              <h2 className="text-xl font-semibold text-slate-900">إدارة الفروع</h2>
            </div>
            <div className="flex flex-col gap-3 md:flex-row">
              <input value={branchNameSetting} onChange={(event) => setBranchNameSetting(event.target.value)} className="flex-1 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="اسم الفرع" />
              <button type="button" className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700" onClick={addBranchSetting}>إضافة</button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'invoices' ? (
        <div className={tabContentClass}>
          <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
            <div className="mb-6 border-b border-slate-200 pb-4">
              <h2 className="text-xl font-semibold text-slate-900">تخصيص الفواتير</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-right text-sm font-medium text-slate-700 md:col-span-2">
                عنوان الفاتورة
                <input value={invoice.title} onChange={(event) => setInvoice((prev) => ({ ...prev, title: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="فاتورة اشتراك" />
              </label>
              <label className="space-y-2 text-right text-sm font-medium text-slate-700 md:col-span-2">
                رابط الشعار (Logo URL)
                <input value={invoice.logo} onChange={(event) => setInvoice((prev) => ({ ...prev, logo: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="logo.jpg" />
              </label>
              <label className="space-y-2 text-right text-sm font-medium text-slate-700 md:col-span-2">
                نص تذييل الفاتورة (Footer)
                <textarea value={invoice.footer} onChange={(event) => setInvoice((prev) => ({ ...prev, footer: event.target.value }))} className="min-h-[80px] w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="شكرًا لاشتراككم معنا..." />
              </label>
              <label className="space-y-2 text-right text-sm font-medium text-slate-700 md:col-span-2">
                رقم التواصل في الفاتورة
                <input value={invoice.contact} onChange={(event) => setInvoice((prev) => ({ ...prev, contact: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="رقم الهاتف" />
              </label>
            </div>
            <div className="mt-6">
              <button type="button" className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700" onClick={saveInvoiceSettings}>حفظ إعدادات الفواتير</button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'security' ? (
        <div className={tabContentClass}>
          <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
            <div className="mb-6 border-b border-slate-200 pb-4">
              <h2 className="text-xl font-semibold text-slate-900">تغيير كلمة المرور</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                كلمة المرور الجديدة
                <input type="password" value={passwords.newPassword} onChange={(event) => setPasswords((prev) => ({ ...prev, newPassword: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" />
              </label>
              <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                تأكيد كلمة المرور
                <input type="password" value={passwords.confirmPassword} onChange={(event) => setPasswords((prev) => ({ ...prev, confirmPassword: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" />
              </label>
            </div>
            <div className="mt-6">
              <button type="button" className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600" onClick={changeUserPassword}>تحديث كلمة المرور</button>
            </div>
          </div>
        </div>
      ) : null}

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
                  <span>فتح اللاندنج بيدج الكاملة</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Simulated Hero Section */}
            <div className="relative min-h-[260px] w-full overflow-hidden bg-slate-950 p-8 flex flex-col justify-end">
              {heroSettings.bgType === 'video' && heroSettings.videoUrl ? (
                <video
                  key={heroSettings.videoUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover opacity-50"
                >
                  <source src={heroSettings.videoUrl} type="video/mp4" />
                </video>
              ) : (heroImagePreview || heroSettings.imageUrl) ? (
                <img
                  src={heroImagePreview || heroSettings.imageUrl}
                  alt="Hero Background Preview"
                  className="absolute inset-0 h-full w-full object-cover opacity-50"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 opacity-90" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              
              <div className="relative z-10 space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                  Multi-Sport Academy
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                  {heroSettings.title || 'Train like you mean it.'}
                </h1>
                <p className="max-w-xl text-sm text-slate-300">
                  {heroSettings.subtitle || 'Apex is where the next generation of athletes is built — from first steps to podium finishes.'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
              <div className="mb-6 border-b border-slate-200 pb-4">
                <h2 className="text-xl font-semibold text-slate-900">إعدادات الواجهة الرئيسية (Hero)</h2>
              </div>
              <div className="space-y-4">
                <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                  العنوان الرئيسي
                  <input value={heroSettings.title} onChange={(event) => setHeroSettings((prev) => ({ ...prev, title: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="مثلاً: اصنع مستقبلك" />
                </label>
                <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                  الوصف الفرعي
                  <textarea value={heroSettings.subtitle} onChange={(event) => setHeroSettings((prev) => ({ ...prev, subtitle: event.target.value }))} className="min-h-[90px] w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="وصف قصير" />
                </label>
                <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                  فيديو الواجهة (رابط مباشر أو رفع ملف)
                  <input value={heroSettings.videoUrl} onChange={(event) => setHeroSettings((prev) => ({ ...prev, videoUrl: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="رابط فيديو أو ارفع ملف" />
                </label>
                <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                  نوع الخلفية الافتراضية
                  <select value={heroSettings.bgType} onChange={(event) => setHeroSettings((prev) => ({ ...prev, bgType: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none">
                    <option value="video">فيديو</option>
                    <option value="image">صورة ثابتة</option>
                  </select>
                </label>
                <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                  صورة الخلفية
                  <input value={heroSettings.imageUrl} onChange={(event) => setHeroSettings((prev) => ({ ...prev, imageUrl: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="رابط الصورة" />
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <span>رفع صورة</span>
                  <input type="file" accept="image/*" hidden onChange={uploadHeroImage} />
                </label>
                {heroImagePreview ? <img src={heroImagePreview} alt="Hero preview" className="h-32 rounded-2xl border border-slate-200 object-cover" /> : null}
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700" onClick={saveLandingHeroSettings}>حفظ إعدادات الواجهة</button>
                  <button type="button" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" onClick={resetHeroImage}>حذف الصورة الحالية</button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
              <div className="mb-6 border-b border-slate-200 pb-4">
                <h2 className="text-xl font-semibold text-slate-900">إعدادات السيرة الذاتية</h2>
              </div>
              <div className="space-y-4">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <span>رفع صورة رئيس مجلس الإدارة</span>
                  <input type="file" accept="image/*" hidden onChange={uploadCeoPhoto} />
                </label>
                {ceoPhotoPreview ? <img src={ceoPhotoPreview} alt="CEO preview" className="h-32 rounded-2xl border border-slate-200 object-cover" /> : null}
                <button type="button" className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700" onClick={saveCeoBiographySettings}>حفظ صورة السيرة الذاتية</button>
              </div>
            </div>
          </div>

          {/* ===== قسم الرياضات ===== */}
          <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
            <div className="mb-6 border-b border-slate-200 pb-4">
              <h2 className="text-xl font-semibold text-slate-900">إدارة قسم الرياضات</h2>
              <p className="mt-1 text-xs text-slate-500">أضف رياضات مخصصة تظهر في قسم الرياضات بالصفحة الرئيسية، وعدّل عنوان القسم.</p>
            </div>

            {/* عنوان القسم */}
            <div className="mb-6 space-y-3">
              <label className="block text-sm font-medium text-slate-700">عنوان قسم الرياضات (يظهر في الصفحة)</label>
              <div className="flex gap-3">
                <input
                  value={sectionTitle}
                  onChange={(e) => setSectionTitle(e.target.value)}
                  className="flex-1 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                  placeholder="مثلاً: سبع رياضات، معيار واحد."
                />
                <button type="button" className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700" onClick={saveSportsTitle}>
                  حفظ العنوان
                </button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* فورم إضافة رياضة */}
              <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <h3 className="font-semibold text-slate-800">إضافة رياضة جديدة</h3>
                <input
                  value={sportName}
                  onChange={(e) => setSportName(e.target.value)}
                  className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-right text-sm text-slate-900 outline-none"
                  placeholder="اسم الرياضة (مثلاً: كرة القدم)"
                />
                <input
                  value={sportTag}
                  onChange={(e) => setSportTag(e.target.value)}
                  className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-right text-sm text-slate-900 outline-none"
                  placeholder="تصنيف (مثلاً: جماعي · خارجي)"
                />
                <textarea
                  value={sportDesc}
                  onChange={(e) => setSportDesc(e.target.value)}
                  rows={2}
                  className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-right text-sm text-slate-900 outline-none resize-none"
                  placeholder="وصف مختصر للرياضة"
                />
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                  <span>{sportImagePreview ? '✓ تم رفع الصورة' : 'رفع صورة الرياضة'}</span>
                  <input type="file" accept="image/*" hidden onChange={uploadSportImage} />
                </label>
                {sportImagePreview && (
                  <img src={sportImagePreview} alt="Sport preview" className="h-24 w-full rounded-2xl border border-slate-200 object-cover" />
                )}
                <button type="button" className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700" onClick={addLandingSport}>
                  + إضافة الرياضة
                </button>
              </div>

              {/* قائمة الرياضات */}
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  الرياضات المضافة ({landingSports.length})
                </div>
                {landingSports.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">لا توجد رياضات مخصصة — سيتم عرض الرياضات الافتراضية</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {landingSports.map((sport, index) => (
                      <div key={`${sport.name}-${index}`} className="flex items-center gap-3 px-4 py-3">
                        {sport.image && (
                          <img src={sport.image} alt={sport.name} className="h-10 w-10 rounded-xl object-cover shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate">{sport.name}</p>
                          {sport.tag && <p className="text-xs text-slate-400 truncate">{sport.tag}</p>}
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                          onClick={() => deleteLandingSport(index)}
                        >
                          حذف
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
              <div className="mb-6 border-b border-slate-200 pb-4">
                <h2 className="text-xl font-semibold text-slate-900">إدارة فروع العرض (Landing Page)</h2>
              </div>
              <div className="space-y-4">
                <input value={branchName} onChange={(event) => setBranchName(event.target.value)} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="اسم الفرع" />
                <textarea value={branchDescription} onChange={(event) => setBranchDescription(event.target.value)} className="min-h-[90px] w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="نبذة مختصرة عن الفرع" />
                <input value={branchMapsUrl} onChange={(event) => setBranchMapsUrl(event.target.value)} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="لينك جوجل ماب" />
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <span>رفع صورة الفرع</span>
                  <input type="file" accept="image/*" hidden onChange={uploadLBranchImage} />
                </label>
                {branchImagePreview ? <img src={branchImagePreview} alt="Branch preview" className="h-20 rounded-2xl border border-slate-200 object-cover" /> : null}
                <button type="button" className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700" onClick={addLandingBranch}>إضافة الفرع للعرض</button>
              </div>
              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-right text-slate-500">
                    <tr>
                      <th className="px-4 py-3">الفرع</th>
                      <th className="px-4 py-3">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {landingBranches.length === 0 ? (
                      <tr><td colSpan={2} className="px-4 py-4 text-center text-slate-500">لا توجد فروع مضافة</td></tr>
                    ) : landingBranches.map((item, index) => (
                      <tr key={`${item.name}-${index}`} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                        <td className="px-4 py-3">
                          <button type="button" className="rounded-2xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700" onClick={() => deleteLandingBranch(index)}>حذف</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
              <div className="mb-6 border-b border-slate-200 pb-4">
                <h2 className="text-xl font-semibold text-slate-900">إدارة آراء العملاء</h2>
              </div>
              <div className="space-y-4">
                <input value={testimonialForm.name} onChange={(event) => setTestimonialForm((prev) => ({ ...prev, name: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="اسم ولي الأمر" />
                <input value={testimonialForm.role} onChange={(event) => setTestimonialForm((prev) => ({ ...prev, role: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="الوصف" />
                <textarea value={testimonialForm.text} onChange={(event) => setTestimonialForm((prev) => ({ ...prev, text: event.target.value }))} className="min-h-[90px] w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="نص الرأي" />
                <select value={testimonialForm.rating} onChange={(event) => setTestimonialForm((prev) => ({ ...prev, rating: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none">
                  <option value="5">5 نجوم</option>
                  <option value="4">4 نجوم</option>
                  <option value="3">3 نجوم</option>
                </select>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <span>صورة العميل</span>
                  <input type="file" accept="image/*" hidden onChange={uploadTImage} />
                </label>
                {testimonialPreview ? <img src={testimonialPreview} alt="Testimonial preview" className="h-20 w-20 rounded-full border border-slate-200 object-cover" /> : null}
                <button type="button" className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700" onClick={addTestimonial}>إضافة الرأي</button>
              </div>
              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-right text-slate-500">
                    <tr>
                      <th className="px-4 py-3">العميل</th>
                      <th className="px-4 py-3">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testimonials.length === 0 ? (
                      <tr><td colSpan={2} className="px-4 py-4 text-center text-slate-500">لا توجد آراء مضافة</td></tr>
                    ) : testimonials.map((item, index) => (
                      <tr key={`${item.name}-${index}`} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                        <td className="px-4 py-3">
                          <button type="button" className="rounded-2xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700" onClick={() => deleteTestimonial(index)}>حذف</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
              <div className="mb-6 border-b border-slate-200 pb-4">
                <h2 className="text-xl font-semibold text-slate-900">إدارة الباقات</h2>
              </div>
              <div className="space-y-4">
                <input value={planForm.originalPrice} onChange={(event) => setPlanForm((prev) => ({ ...prev, originalPrice: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="السعر الأصلي قبل الخصم" />
                <input value={planForm.name} onChange={(event) => setPlanForm((prev) => ({ ...prev, name: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="اسم الباقة" />
                <input value={planForm.price} onChange={(event) => setPlanForm((prev) => ({ ...prev, price: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="السعر" />
                <input value={planForm.features} onChange={(event) => setPlanForm((prev) => ({ ...prev, features: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="المميزات (افصل بينها بفاصلة)" />
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={planForm.isFeatured} onChange={(event) => setPlanForm((prev) => ({ ...prev, isFeatured: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                  باقة مميزة
                </label>
                <button type="button" className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700" onClick={addLandingPlan}>إضافة باقة</button>
              </div>
              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-right text-slate-500">
                    <tr>
                      <th className="px-4 py-3">الباقة</th>
                      <th className="px-4 py-3">السعر</th>
                      <th className="px-4 py-3">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-4 text-center text-slate-500">لا توجد باقات</td></tr>
                    ) : plans.map((item, index) => (
                      <tr key={`${item.name}-${index}`} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                        <td className="px-4 py-3 text-slate-700">{item.price}</td>
                        <td className="px-4 py-3"><button type="button" className="rounded-2xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700" onClick={() => deleteLandingPlan(index)}>حذف</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
              <div className="mb-6 border-b border-slate-200 pb-4">
                <h2 className="text-xl font-semibold text-slate-900">معرض الوسائط</h2>
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                <span>رفع صور/فيديوهات للمعرض</span>
                <input type="file" accept="image/*,video/*" hidden multiple onChange={uploadLandingMedia} />
              </label>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {mediaItems.length === 0 ? <p className="col-span-3 text-center text-sm text-slate-500">لا توجد وسائط حتى الآن</p> : mediaItems.map((item, index) => (
                  <div key={`${item.type}-${index}`} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2">
                    {item.type.startsWith('image') ? <img src={item.data} alt="media" className="h-20 w-full rounded-xl object-cover" /> : <div className="flex h-20 items-center justify-center text-slate-500">Video</div>}
                    <button type="button" className="absolute right-2 top-2 rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700" onClick={() => deleteLandingMedia(index)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
            <div className="mb-6 border-b border-slate-200 pb-4">
              <h2 className="text-xl font-semibold text-slate-900">إدارة أحدث الأخبار</h2>
            </div>
            <div className="space-y-4">
              <input value={newsForm.title} onChange={(event) => setNewsForm((prev) => ({ ...prev, title: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="عنوان الخبر" />
              <input value={newsForm.category} onChange={(event) => setNewsForm((prev) => ({ ...prev, category: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="الفئة" />
              <input type="date" value={newsForm.date} onChange={(event) => setNewsForm((prev) => ({ ...prev, date: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" />
              <input value={newsForm.link} onChange={(event) => setNewsForm((prev) => ({ ...prev, link: event.target.value }))} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none" placeholder="رابط التفاصيل" />
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                <span>رفع صورة الخبر</span>
                <input type="file" accept="image/*" hidden onChange={uploadNewsImage} />
              </label>
              {newsPreview ? <img src={newsPreview} alt="News preview" className="h-20 rounded-2xl border border-slate-200 object-cover" /> : null}
              <div className="flex flex-wrap gap-3">
                <button type="button" className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700" onClick={addLandingNews}>{editingNewsIndex >= 0 ? 'حفظ التعديلات' : 'إضافة الخبر'}</button>
                {editingNewsIndex >= 0 ? <button type="button" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700" onClick={resetNewsEdit}>إلغاء التعديل</button> : null}
              </div>
            </div>
            <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-right text-slate-500">
                  <tr>
                    <th className="px-4 py-3">العنوان</th>
                    <th className="px-4 py-3">الفئة</th>
                    <th className="px-4 py-3">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {newsItems.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-4 text-center text-slate-500">لا توجد أخبار</td></tr>
                  ) : newsItems.map((item, index) => (
                    <tr key={`${item.title}-${index}`} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-semibold text-slate-900">{item.title}</td>
                      <td className="px-4 py-3 text-slate-700">{item.category}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button type="button" className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700" onClick={() => editLandingNews(index)}>تعديل</button>
                          <button type="button" className="rounded-2xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700" onClick={() => deleteLandingNews(index)}>حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-50 p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
            <h2 className="text-lg font-semibold text-slate-900">تنبيه</h2>
            <p className="mt-2 text-sm text-slate-600">أي تغيير هنا سيظهر فوراً للزوار في صفحة اللاندنج بيدج.</p>
          </div>
        </div>
      ) : null}

      {activeTab === 'backup' ? (
        <div className={tabContentClass}>
          <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
            <div className="mb-6 border-b border-slate-200 pb-4">
              <h2 className="text-xl font-semibold text-slate-900">إدارة البيانات</h2>
            </div>
            <p className="mb-6 text-sm text-slate-600">يمكنك تحميل نسخة من جميع بيانات النظام وحفظها كملف JSON.</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700" onClick={exportData}>تصدير قاعدة البيانات</button>
              <button type="button" className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700" onClick={() => {
                if (window.confirm('هل أنت متأكد؟ سيتم حذف كل البيانات!')) {
                  window.localStorage.clear();
                  window.location.reload();
                }
              }}>حذف كافة البيانات</button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'audit' ? (
        <div className={tabContentClass}>
          <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
            <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">سجل حركات النظام</h2>
                <p className="mt-1 text-sm text-slate-600">آخر العمليات التي تمت في النظام.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <AppIcon icon={SearchSm} className="text-slate-500" />
                  <input value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} className="border-none bg-transparent text-sm text-slate-900 outline-none" placeholder="بحث..." />
                </label>
                <button type="button" className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => void loadAuditLogs(1)}>تحديث</button>
              </div>
            </div>
            <div className="overflow-hidden rounded-3xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-right text-slate-500">
                  <tr>
                    <th className="px-4 py-3">التاريخ</th>
                    <th className="px-4 py-3">المستخدم</th>
                    <th className="px-4 py-3">الحدث</th>
                    <th className="px-4 py-3">القسم</th>
                    <th className="px-4 py-3">التفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLoading ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">جاري التحميل...</td></tr>
                  ) : auditLogs.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">لا توجد سجلات حتى الآن</td></tr>
                  ) : auditLogs.map((log, index) => (
                    <tr key={`${log.createdAt}-${index}`} className="border-t border-slate-200">
                      <td className="px-4 py-3 text-slate-700">{new Date(log.createdAt).toLocaleString('en-GB')}</td>
                      <td className="px-4 py-3 text-slate-700">{log.userName}</td>
                      <td className="px-4 py-3 text-slate-700">{log.action}</td>
                      <td className="px-4 py-3 text-slate-700">{log.section}</td>
                      <td className="px-4 py-3 text-slate-700">{log.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {auditPagination ? <div className="mt-4">{auditPagination}</div> : null}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`fixed bottom-6 left-6 right-6 z-50 mx-auto max-w-md rounded-3xl px-5 py-4 text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-rose-500'}`}>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
