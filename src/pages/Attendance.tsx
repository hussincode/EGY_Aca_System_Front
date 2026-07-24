import { useEffect, useMemo, useState } from "react";
import { Bell03, CalendarCheck01, QrCode01, SearchSm } from "@untitledui/icons";
import AppIcon from "@/components/AppIcon";
import { useAuth } from "@/contexts/AuthContext";

type AttendanceRecord = {
  id: string;
  player_id: string;
  subscription_id?: string;
  date: string;
  status: "present" | "absent" | "late";
  player_name?: string;
  subscription_schedule?: string;
  notes?: string;
  phone?: string;
};

const ATTENDANCE_KEY = "attendanceRecords";

function readStoredData<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(key);
  if (!stored) return fallback;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

function normalizeAttendanceFromDb(row: Record<string, unknown> | null | undefined): AttendanceRecord | null {
  if (!row) return null;
  return {
    id: String(row.id || ""),
    player_id: String(row.player_id || ""),
    subscription_id: String(row.subscription_id || "") || undefined,
    date: String(row.date || new Date().toISOString().slice(0, 10)),
    status: (row.status as AttendanceRecord["status"]) || "present",
    player_name: String(row.player_name || ""),
    subscription_schedule: String(row.subscription_schedule || "") || undefined,
    notes: String(row.notes || "") || undefined,
    phone: String(row.phone || "") || undefined,
  };
}

const statusStyles = {
  present: {
    label: "حاضر",
    className: "bg-emerald-100 text-emerald-700",
  },
  absent: {
    label: "غائب",
    className: "bg-rose-100 text-rose-700",
  },
  late: {
    label: "متأخر",
    className: "bg-amber-100 text-amber-700",
  },
};

const Attendance = () => {
  const { canEdit } = useAuth();
  const canEditAttendance = canEdit('attendance');
  const [records, setRecords] = useState<AttendanceRecord[]>(() =>
    readStoredData<AttendanceRecord[]>(ATTENDANCE_KEY, [])
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState({
    player_id: "",
    status: "present" as AttendanceRecord["status"],
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Load from API on mount
  useEffect(() => {
    const loadData = async () => {
      const api = window.api;
      if (!api?.getAttendance || !api?.getToken?.()) {
        setRecords(readStoredData<AttendanceRecord[]>(ATTENDANCE_KEY, []));
        return;
      }

      try {
        const response: { data?: unknown[] } = await api.getAttendance() as { data?: unknown[] };
        const serverRecords = Array.isArray(response?.data) ? response.data : [];
        const mapped = serverRecords
          .map((item: unknown) => normalizeAttendanceFromDb(item as Record<string, unknown>))
          .filter((item): item is AttendanceRecord => Boolean(item && item.id));

        if (mapped.length > 0) {
          const localRecords = readStoredData<AttendanceRecord[]>(ATTENDANCE_KEY, []);
          const merged = [
            ...mapped,
            ...localRecords.filter(
              (local) => !mapped.some((server) => server.id === local.id)
            ),
          ];
          setRecords(merged);
          window.localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(merged));
        }
      } catch (error) {
        console.error("Failed to load attendance from API", error);
        setRecords(readStoredData<AttendanceRecord[]>(ATTENDANCE_KEY, []));
      }
    };

    loadData();
  }, []);

  // Sync to localStorage
  useEffect(() => {
    window.localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  };

  const filteredRecords = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return records;
    return records.filter((record) =>
      [record.player_name, record.subscription_schedule, record.notes, record.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [records, searchTerm]);

  const totalRecords = records.length;
  const presentCount = records.filter((record) => record.status === "present").length;
  const absentCount = records.filter((record) => record.status === "absent").length;
  const lateCount = records.filter((record) => record.status === "late").length;
  const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

  const handleAddAttendance = () => {
    setIsModalOpen(true);
    setFormState({
      player_id: "",
      status: "present",
      date: new Date().toISOString().slice(0, 10),
      notes: "",
    });
  };

  const handleSaveAttendance = async () => {
    if (!formState.player_id) {
      showToast("اختر اللاعب أولاً", "error");
      return;
    }

    const newRecord: AttendanceRecord = {
      id: `att_${Date.now()}`,
      player_id: formState.player_id,
      status: formState.status,
      date: formState.date,
      notes: formState.notes || undefined,
    };

    // Try API first
    const api = window.api;
    if (api?.createAttendance && api?.getToken?.()) {
      try {
const response = await api.createAttendance({
          player_id: formState.player_id,
          status: formState.status,
          date: formState.date,
        });
        const serverRecord = (response as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
        if (serverRecord?.id) {
          newRecord.id = String(serverRecord.id);
        }
      } catch (error) {
        console.error("Failed to save attendance to API", error);
      }
    }

    setRecords((prev) => {
      const next = [newRecord, ...prev];
      window.localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(next));
      return next;
    });

    setIsModalOpen(false);
    showToast("تم تسجيل الحضور");
  };

  const handleDeleteAttendance = async (id: string) => {
    if (!window.confirm("هل تريد حذف هذا السجل؟")) return;

    const api = window.api;
    if (api?.deleteAttendance && api?.getToken?.()) {
      try {
        await api.deleteAttendance(id);
      } catch (error) {
        console.error("Failed to delete attendance from API", error);
      }
    }

    setRecords((prev) => {
      const next = prev.filter((record) => record.id !== id);
      window.localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(next));
      return next;
    });
    showToast("تم حذف السجل");
  };

  return (
      <div className="space-y-6 overflow-x-hidden">
    <div className="space-y-6">
      {toast ? (
        <div className={`fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl sm:left-auto sm:right-6 sm:translate-x-0 sm:rounded-3xl ${
          toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
        }`}>
          {toast.message}
        </div>
      ) : null}

<div className="overflow-hidden rounded-2xl bg-white shadow-sm shadow-slate-200 ring-1 ring-slate-200/70 sm:rounded-3xl">
        <div className="px-4 py-4 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="shrink-0">
              <p className="text-sm font-semibold text-slate-500">نظام الحضور</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">إدارة الحضور اليومي</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                تتبع حضور اللاعبين والمدربين بسهولة.
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-3 sm:min-w-0 sm:grid-cols-4 sm:gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center sm:rounded-3xl sm:px-4 sm:py-4">
                <p className="text-xs text-slate-500 sm:text-sm">الحضور</p>
                <p className="mt-1 text-xl font-semibold text-emerald-600 sm:mt-2 sm:text-3xl">{presentCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center sm:rounded-3xl sm:px-4 sm:py-4">
                <p className="text-xs text-slate-500 sm:text-sm">الغياب</p>
                <p className="mt-1 text-xl font-semibold text-rose-600 sm:mt-2 sm:text-3xl">{absentCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center sm:rounded-3xl sm:px-4 sm:py-4">
                <p className="text-xs text-slate-500 sm:text-sm">متأخر</p>
                <p className="mt-1 text-xl font-semibold text-amber-600 sm:mt-2 sm:text-3xl">{lateCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center sm:rounded-3xl sm:px-4 sm:py-4">
                <p className="text-xs text-slate-500 sm:text-sm">الإجمالي</p>
                <p className="mt-1 text-xl font-semibold text-slate-900 sm:mt-2 sm:text-3xl">{totalRecords}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    <div className="grid gap-4 md:gap-6 xl:grid-cols-[1.5fr_0.75fr]">
        <section className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm shadow-slate-200 ring-1 ring-slate-200/70 sm:rounded-3xl">
            <div className="px-4 py-4 sm:px-6 sm:py-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 sm:h-11 sm:w-11">
                    <AppIcon icon={CalendarCheck01} className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-500">البحث في سجلات الحضور</p>
                    <p className="mt-0.5 text-xs text-slate-400">ابحث بالاسم أو التاريخ.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:w-64 sm:rounded-2xl">
                    <AppIcon icon={SearchSm} className="h-4 w-4 shrink-0 text-slate-500" />
                    <input
                      type="search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="ابحث عن لاعب..."
                      className="w-full border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </div>

                  {canEditAttendance && (
                    <button
                      type="button"
                      onClick={handleAddAttendance}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 sm:w-auto sm:rounded-2xl"
                    >
                      + تسجيل حضور
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm shadow-slate-200 ring-1 ring-slate-200/70 sm:rounded-3xl">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-6">
              <h2 className="text-base font-semibold text-slate-900 sm:text-lg">سجل الحضور</h2>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">عرض السجلات المفلترة حسب البحث.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[450px] w-full divide-y divide-slate-200 text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-3 text-right font-medium sm:px-6">اللاعب</th>
                    <th className="px-3 py-3 text-right font-medium sm:px-6">التاريخ</th>
                    <th className="px-3 py-3 text-right font-medium sm:px-6">الحالة</th>
                    <th className="hidden sm:table-cell px-3 py-3 text-right font-medium sm:px-6">ملاحظات</th>
                    <th className="px-3 py-3 text-center font-medium sm:px-6">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold text-slate-900 sm:px-6 sm:text-sm">
                        {record.player_name || record.player_id}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-slate-600 sm:px-6">{record.date}</td>
                      <td className="px-3 py-3 text-right sm:px-6">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold sm:text-xs ${statusStyles[record.status]?.className || "bg-slate-100 text-slate-700"}`}>
                          {statusStyles[record.status]?.label || record.status}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell px-3 py-3 text-right text-slate-600 sm:px-6">{record.notes || "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-center sm:px-6">
                        {canEditAttendance && (
                          <button
                            type="button"
                            onClick={() => handleDeleteAttendance(record.id)}
                            className="rounded-xl bg-rose-100 px-2.5 py-1.5 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-200 sm:text-xs"
                          >
                            حذف
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-xs text-slate-500 sm:px-6 sm:text-sm">
                        لم يتم العثور على سجلات.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="grid grid-cols-1 gap-4">
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm shadow-slate-200 ring-1 ring-slate-200/70 sm:rounded-3xl">
            <div className="flex items-center justify-between gap-2 px-4 py-4 sm:px-6 sm:py-6">
              <div>
                <p className="text-xs font-semibold text-slate-500 sm:text-sm">معدل الحضور</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 sm:mt-2 sm:text-3xl">{attendanceRate}%</p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 sm:h-11 sm:w-11">
                <AppIcon icon={Bell03} className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm shadow-slate-200 ring-1 ring-slate-200/70 sm:rounded-3xl">
            <div className="flex items-center gap-3 px-4 py-4 text-slate-900 sm:px-6 sm:py-6">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 sm:h-11 sm:w-11">
                <AppIcon icon={QrCode01} className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">تسجيل حضور سريع</p>
                <p className="mt-0.5 text-xs text-slate-500">سجل حضور اللاعبين بسرعة.</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm shadow-slate-200 ring-1 ring-slate-200/70 sm:rounded-3xl">
            <div className="px-4 py-4 sm:px-6 sm:py-6">
              <p className="text-sm font-semibold text-slate-900">إحصائيات اليوم</p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500 sm:text-sm">حاضر</p>
                  <p className="text-sm font-semibold text-slate-900 sm:text-base">{presentCount}</p>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500 sm:text-sm">غائب</p>
                  <p className="text-sm font-semibold text-slate-900 sm:text-base">{absentCount}</p>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500 sm:text-sm">متأخر</p>
                  <p className="text-sm font-semibold text-slate-900 sm:text-base">{lateCount}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 sm:items-center">
          <div className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-slate-200/70 sm:mx-4 sm:max-w-md sm:rounded-3xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
              <h2 className="text-base font-semibold text-slate-900 sm:text-lg">تسجيل حضور</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:space-y-4 sm:px-6">
              <label className="block space-y-1 text-sm text-slate-700">
                <span className="font-medium">معرف اللاعب (ID)</span>
                <input
                  value={formState.player_id}
                  onChange={(event) => setFormState((prev) => ({ ...prev, player_id: event.target.value }))}
                  placeholder="أدخل معرف اللاعب"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-right text-sm sm:rounded-2xl"
                />
              </label>
              <label className="block space-y-1 text-sm text-slate-700">
                <span className="font-medium">التاريخ</span>
                <input
                  type="date"
                  value={formState.date}
                  onChange={(event) => setFormState((prev) => ({ ...prev, date: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-right text-sm sm:rounded-2xl"
                />
              </label>
              <label className="block space-y-1 text-sm text-slate-700">
                <span className="font-medium">الحالة</span>
                <select
                  value={formState.status}
                  onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value as AttendanceRecord["status"] }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-right text-sm sm:rounded-2xl"
                >
                  <option value="present">حاضر</option>
                  <option value="absent">غائب</option>
                  <option value="late">متأخر</option>
                </select>
              </label>
              <label className="block space-y-1 text-sm text-slate-700">
                <span className="font-medium">ملاحظات</span>
                <textarea
                  value={formState.notes}
                  onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-right text-sm sm:rounded-2xl"
                />
              </label>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 px-4 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 sm:rounded-2xl"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveAttendance}
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white sm:rounded-2xl"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </div>
  );
};

export default Attendance;