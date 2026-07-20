import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift02, SearchSm } from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';
import type { Ambassador, ReferredPlayer } from '../types/ambassador';

type AmbassadorStats = {
  totalPoints: number;
  rewards: number;
  referredPlayers: Array<ReferredPlayer & { lastPoints: number }>;
  activeCount: number;
};

function readStoredData<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  const saved = window.localStorage.getItem(key);
  if (!saved) return fallback;

  try {
    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
}

function buildEmptyForm(): Ambassador {
  return {
    AmbName: '',
    AmbPhone: '',
    RefCode: '',
    Ambstatus: 'Active',
  };
}

export default function Ambassadors() {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>(() =>
    readStoredData<Ambassador[]>('ambassadors', [])
  );
  const [players, setPlayers] = useState<ReferredPlayer[]>(() =>
    readStoredData<ReferredPlayer[]>('players', [])
  );
  const [referrals] = useState<ReferredPlayer[]>(() =>
    readStoredData<ReferredPlayer[]>('ambassadorReferrals', [])
  );
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<Ambassador>(buildEmptyForm);
  const [isPlayersModalOpen, setIsPlayersModalOpen] = useState(false);
  const [selectedAmbassadorId, setSelectedAmbassadorId] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem('ambassadors', JSON.stringify(ambassadors));
  }, [ambassadors]);

  useEffect(() => {
    window.localStorage.setItem('players', JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    window.localStorage.setItem('ambassadorReferrals', JSON.stringify(referrals));
  }, [referrals]);

  function calculatePointsForPlayer(p: ReferredPlayer): number {
    let points = 0;

    if (!p.RefPointsCounted && p.Joined) points += 10;

    if (p.Subscription?.status === 'active') {
      points += 50;

      switch (p.Subscription.plan) {
        case 'monthly':
          points += 20;
          break;
        case '3months':
          points += 70;
          break;
        case '6months':
          points += 150;
          break;
      }

      if (p.Sport === 'swimming') points += 30;
      else if (p.Sport === 'football') points += 25;

      if (p.Activity === 'private') points += 40;
      points += Math.floor(p.Subscription.value / 100) * 5;
    }

    return points;
  }

  const calculateAmbassadorPoints = useCallback(
    (ambId: string): AmbassadorStats => {
      const referredPlayers = [...players, ...referrals].filter((p) => p.AmbId === ambId);
      const activePlayers = referredPlayers.filter(
        (p) => p.Subscription?.status === 'active'
      );

      const playersWithPoints = referredPlayers.map((p) => ({
        ...p,
        lastPoints: calculatePointsForPlayer(p),
      }));

      let totalPoints = playersWithPoints.reduce((sum, p) => sum + p.lastPoints, 0);

      const activeCount = activePlayers.length;
      if (activeCount >= 20) totalPoints *= 3;
      else if (activeCount >= 10) totalPoints *= 2;
      else if (activeCount >= 5) totalPoints *= 1.5;

      const rewards = Math.floor(totalPoints / 100) * 100;

      return { totalPoints, rewards, referredPlayers: playersWithPoints, activeCount };
    },
    [players, referrals]
  );

  const ambassadorRows = useMemo(
    () =>
      ambassadors.map((amb) => ({
        ...amb,
        stats: calculateAmbassadorPoints(amb.RefCode),
      })),
    [ambassadors, calculateAmbassadorPoints]
  );

  const filteredAmbassadors = useMemo(() => {
    const term = search.trim().toLowerCase();

    return ambassadorRows.filter((amb) => {
      const matchesSearch = !term || amb.AmbName.toLowerCase().includes(term);
      const matchesStatus = !filterStatus || amb.Ambstatus.toLowerCase() === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [ambassadorRows, filterStatus, search]);

  const metrics = useMemo(() => {
    return ambassadorRows.reduce(
      (acc, amb) => {
        acc.ambassadors += 1;
        acc.players += amb.stats.activeCount;
        acc.points += amb.stats.totalPoints;
        acc.rewards += amb.stats.rewards;
        return acc;
      },
      { ambassadors: 0, players: 0, points: 0, rewards: 0 }
    );
  }, [ambassadorRows]);

  function openModal(index: number | null = null) {
    if (index !== null && index >= 0) {
      const ambassador = ambassadors[index];
      setEditingIndex(index);
      setForm({
        AmbName: ambassador.AmbName,
        AmbPhone: ambassador.AmbPhone,
        RefCode: ambassador.RefCode,
        Ambstatus: ambassador.Ambstatus,
      });
    } else {
      setEditingIndex(null);
      setForm({
        AmbName: '',
        AmbPhone: '',
        RefCode: `REF${Math.floor(1000 + Math.random() * 9000)}`,
        Ambstatus: 'Active',
      });
    }

    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingIndex(null);
    setForm(buildEmptyForm());
  }

  function saveAmbassador() {
    const name = form.AmbName.trim();
    const phone = form.AmbPhone.trim();

    if (!name || !phone) {
      window.alert('الاسم والهاتف مطلوبان');
      return;
    }

    const payload: Ambassador = {
      AmbName: name,
      AmbPhone: phone,
      RefCode: form.RefCode || `REF${Math.floor(1000 + Math.random() * 9000)}`,
      Ambstatus: form.Ambstatus,
    };

    if (editingIndex !== null) {
      setAmbassadors((prev) =>
        prev.map((ambassador, index) => (index === editingIndex ? payload : ambassador))
      );
    } else {
      setAmbassadors((prev) => [...prev, payload]);
    }

    closeModal();
  }

  function deleteAmbassador(index: number) {
    if (!window.confirm('متأكد من حذف هذا السفير؟')) return;
    setAmbassadors((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  function openPlayersModal(ambId: string) {
    setSelectedAmbassadorId(ambId);
    setIsPlayersModalOpen(true);
  }

  function closePlayersModal() {
    setIsPlayersModalOpen(false);
    setSelectedAmbassadorId(null);
  }

  function addSampleData() {
    if (ambassadors.length === 0) {
      setAmbassadors((prev) =>
        prev.length
          ? prev
          : [
              {
                AmbName: 'أحمد السفير',
                AmbPhone: '01001234567',
                RefCode: 'REF1234',
                Ambstatus: 'Active',
              },
            ]
      );
    }

    setPlayers((prev) => {
      if (prev.some((player) => player.AmbId === 'REF1234')) return prev;

      return [
        {
          AmbId: 'REF1234',
          Name: 'محمد أحمد',
          Age: 12,
          Sport: 'football',
          Activity: 'group',
          Subscription: { plan: 'monthly', status: 'active', value: 500 },
          Joined: true,
          RefPointsCounted: true,
          JoinedDate: new Date().toLocaleDateString('ar-EG'),
        },
        {
          AmbId: 'REF1234',
          Name: 'علي خالد',
          Age: 10,
          Sport: 'swimming',
          Activity: 'private',
          Subscription: { plan: '3months', status: 'active', value: 1200 },
          Joined: true,
          RefPointsCounted: true,
          JoinedDate: new Date().toLocaleDateString('ar-EG'),
        },
      ];
    });
  }

  const selectedStats = selectedAmbassadorId ? calculateAmbassadorPoints(selectedAmbassadorId) : null;

  return (
    <div dir="rtl" className="min-h-screen bg-body-bg p-6 text-right">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[24px] border border-border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-light px-3 py-1 text-sm font-semibold text-primary">
                <AppIcon icon={Gift02} className="text-primary" />
                نظام إحالات ومكافآت
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-text-primary">برنامج السفراء</h1>
                <p className="text-lg text-text-secondary">
                  إدارة الإحالات، حساب النقاط والمكافآت، ومراجعة اللاعبين المحالين بنفس
                  استايل باقي النظام.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => openModal(null)}
                  className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                >
                  + إضافة سفير
                </button>
                <button
                  type="button"
                  onClick={addSampleData}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-slate-50"
                >
                  <AppIcon icon={Gift02} className="text-primary" />
                  بيانات تجريبية
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[480px] xl:grid-cols-4">
              <div className="rounded-2xl border border-border bg-slate-50 p-4">
                <div className="text-sm text-text-secondary">إجمالي السفراء</div>
                <div className="mt-2 text-2xl font-bold text-text-primary">{metrics.ambassadors}</div>
              </div>
              <div className="rounded-2xl border border-border bg-slate-50 p-4">
                <div className="text-sm text-text-secondary">لاعبون نشطون</div>
                <div className="mt-2 text-2xl font-bold text-text-primary">{metrics.players}</div>
              </div>
              <div className="rounded-2xl border border-border bg-slate-50 p-4">
                <div className="text-sm text-text-secondary">إجمالي النقاط</div>
                <div className="mt-2 text-2xl font-bold text-text-primary">
                  {Math.round(metrics.points).toLocaleString('ar-EG')}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-slate-50 p-4">
                <div className="text-sm text-text-secondary">المكافآت المتاحة</div>
                <div className="mt-2 text-2xl font-bold text-text-primary">
                  {metrics.rewards.toLocaleString('ar-EG')} EGP
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="flex flex-1 items-center rounded-xl border border-border bg-slate-50 px-3 py-2.5">
              <AppIcon icon={SearchSm} className="text-text-secondary ml-2" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="بحث عن سفير..."
                className="w-full border-0 bg-transparent text-right outline-none"
              />
            </label>

            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              className="rounded-xl border border-border bg-white px-3 py-2.5 text-right outline-none"
            >
              <option value="">كل الحالات</option>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </select>

            <button
              type="button"
              onClick={() => openModal(null)}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              + إضافة سفير
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold text-text-primary">قائمة السفراء</div>
            <div className="rounded-full bg-info-light px-3 py-1 text-sm font-semibold text-info">
              {filteredAmbassadors.length} سفير
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-right">
              <thead>
                <tr className="border-b border-border bg-white text-sm text-text-secondary">
                  <th className="px-4 py-3 font-semibold">السفير</th>
                  <th className="px-4 py-3 font-semibold">الهاتف</th>
                  <th className="px-4 py-3 font-semibold">رمز الإحالة</th>
                  <th className="px-4 py-3 font-semibold">اللاعبون النشطون</th>
                  <th className="px-4 py-3 font-semibold">النقاط</th>
                  <th className="px-4 py-3 font-semibold">المكافآت</th>
                  <th className="px-4 py-3 font-semibold">الحالة</th>
                  <th className="px-4 py-3 font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredAmbassadors.length > 0 ? (
                  filteredAmbassadors.map((amb, index) => (
                    <tr key={amb.RefCode} className="border-b border-border last:border-b-0 hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-text-primary">{amb.AmbName}</td>
                      <td className="px-4 py-3 text-text-secondary">{amb.AmbPhone}</td>
                      <td className="px-4 py-3 font-semibold text-text-primary">{amb.RefCode}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openPlayersModal(amb.RefCode)}
                          className="rounded-lg bg-success px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
                        >
                          {amb.stats.activeCount} نشط
                        </button>
                      </td>
                      <td className="px-4 py-3 font-semibold text-text-primary">
                        {Math.round(amb.stats.totalPoints).toLocaleString('ar-EG')}
                      </td>
                      <td className="px-4 py-3 font-semibold text-text-primary">
                        {amb.stats.rewards.toLocaleString('ar-EG')} EGP
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-semibold ${
                            amb.Ambstatus === 'Active'
                              ? 'bg-success-light text-success'
                              : 'bg-warning-light text-warning'
                          }`}
                        >
                          {amb.Ambstatus === 'Active' ? 'نشط' : 'غير نشط'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openModal(index)}
                            className="rounded-lg bg-purple px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-violet-600"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAmbassador(index)}
                            className="rounded-lg bg-danger px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-rose-600"
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-text-muted">
                      لا توجد نتائج مطابقة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-[24px] border border-border bg-white p-0 shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-lg font-bold text-text-primary">
                {editingIndex !== null ? 'تعديل سفير' : 'إضافة سفير جديد'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-2 text-text-secondary transition-colors hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-1 block text-sm font-semibold text-text-secondary">
                  اسم السفير
                </label>
                <input
                  value={form.AmbName}
                  onChange={(event) => setForm((prev) => ({ ...prev, AmbName: event.target.value }))}
                  className="w-full rounded-xl border border-border px-3 py-2.5 outline-none"
                  placeholder="اسم السفير *"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-text-secondary">
                  الهاتف
                </label>
                <input
                  value={form.AmbPhone}
                  onChange={(event) => setForm((prev) => ({ ...prev, AmbPhone: event.target.value }))}
                  className="w-full rounded-xl border border-border px-3 py-2.5 outline-none"
                  placeholder="الهاتف *"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-text-secondary">
                  رمز الإحالة
                </label>
                <input
                  value={form.RefCode}
                  readOnly
                  className="w-full rounded-xl border border-border bg-slate-50 px-3 py-2.5 outline-none"
                  placeholder="رمز الإحالة"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-text-secondary">
                  الحالة
                </label>
                <select
                  value={form.Ambstatus}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, Ambstatus: event.target.value as Ambassador['Ambstatus'] }))
                  }
                  className="w-full rounded-xl border border-border px-3 py-2.5 outline-none"
                >
                  <option value="Active">نشط</option>
                  <option value="Inactive">غير نشط</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={saveAmbassador}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white"
              >
                حفظ التغييرات
              </button>
            </div>
          </div>
        </div>
      )}

      {isPlayersModalOpen && selectedStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-6xl rounded-[24px] border border-border bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-lg font-bold text-text-primary">
                اللاعبين المحالون ({selectedStats.referredPlayers.length} إجمالي، {selectedStats.activeCount} نشط)
              </h3>
              <button
                type="button"
                onClick={closePlayersModal}
                className="rounded-full p-2 text-text-secondary transition-colors hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="overflow-x-auto p-5">
              <table className="min-w-full text-right">
                <thead>
                  <tr className="border-b border-border text-sm text-text-secondary">
                    <th className="px-3 py-2 font-semibold">الاسم</th>
                    <th className="px-3 py-2 font-semibold">العمر</th>
                    <th className="px-3 py-2 font-semibold">الرياضة</th>
                    <th className="px-3 py-2 font-semibold">النشاط</th>
                    <th className="px-3 py-2 font-semibold">الخطة</th>
                    <th className="px-3 py-2 font-semibold">الحالة</th>
                    <th className="px-3 py-2 font-semibold">القيمة</th>
                    <th className="px-3 py-2 font-semibold">تاريخ الانضمام</th>
                    <th className="px-3 py-2 font-semibold">نقاط اللاعب</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedStats.referredPlayers.length > 0 ? (
                    selectedStats.referredPlayers.map((player: ReferredPlayer & { lastPoints: number }) => (
                      <tr key={`${player.AmbId}-${player.Name}`} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-3 text-text-primary">{player.Name || 'غير محدد'}</td>
                        <td className="px-3 py-3 text-text-secondary">{player.Age || '-'}</td>
                        <td className="px-3 py-3 text-text-secondary">{player.Sport || '-'}</td>
                        <td className="px-3 py-3 text-text-secondary">{player.Activity || '-'}</td>
                        <td className="px-3 py-3 text-text-secondary">{player.Subscription?.plan || '-'}</td>
                        <td className="px-3 py-3 text-text-secondary">{player.Subscription?.status || '-'}</td>
                        <td className="px-3 py-3 text-text-secondary">{player.Subscription?.value || 0} EGP</td>
                        <td className="px-3 py-3 text-text-secondary">{player.JoinedDate || '-'}</td>
                        <td className="px-3 py-3 font-semibold text-text-primary">
                          {Math.round(player.lastPoints || 0)} نقطة
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-text-muted">
                        لا يوجد لاعبين محالين لهذا السفير
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={closePlayersModal}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}