import { useMemo, useState } from "react";
import { Bell03, CalendarCheck01, Phone01, QrCode01, SearchSm } from "@untitledui/icons";
import AppIcon from "@/components/AppIcon";

type AttendanceRecord = {
  id: string;
  name: string;
  role: string;
  status: "present" | "absent" | "late";
  checkIn: string;
  checkOut: string;
  sessions: number;
  sessionCode: string;
  notes: string;
  phone: string;
};

const attendanceData: AttendanceRecord[] = [
  {
    id: "1",
    name: "أحمد محمد",
    role: "لاعب كرة قدم",
    status: "present",
    checkIn: "08:05",
    checkOut: "10:15",
    sessions: 3,
    sessionCode: "A2431",
    notes: "نشاط قوي في التدريب",
    phone: "+20 112 345 6789",
  },
  {
    id: "2",
    name: "سارة علي",
    role: "لاعبة كرة سلة",
    status: "late",
    checkIn: "08:18",
    checkOut: "10:30",
    sessions: 2,
    sessionCode: "B9423",
    notes: "وصلت متأخرة 13 دقيقة",
    phone: "+20 114 556 8899",
  },
  {
    id: "3",
    name: "خالد حسن",
    role: "مدرب",
    status: "present",
    checkIn: "07:55",
    checkOut: "11:00",
    sessions: 4,
    sessionCode: "C7582",
    notes: "حضور كامل ومتابعة ممتازة",
    phone: "+20 115 223 3344",
  },
  {
    id: "4",
    name: "منة الله إبراهيم",
    role: "لاعبة تنس",
    status: "absent",
    checkIn: "-",
    checkOut: "-",
    sessions: 0,
    sessionCode: "D1039",
    notes: "غياب بدون عذر",
    phone: "+20 116 778 9900",
  },
  {
    id: "5",
    name: "رامي يوسف",
    role: "لاعب كرة طائرة",
    status: "present",
    checkIn: "08:10",
    checkOut: "10:20",
    sessions: 3,
    sessionCode: "E5510",
    notes: "أداء ممتاز اليوم",
    phone: "+20 117 998 1122",
  },
];

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
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRecords = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return attendanceData;
    return attendanceData.filter((record) =>
      [record.name, record.role, record.sessionCode, record.notes, record.phone]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [searchTerm]);

  const totalRecords = attendanceData.length;
  const presentCount = attendanceData.filter((record) => record.status === "present").length;
  const absentCount = attendanceData.filter((record) => record.status === "absent").length;
  const lateCount = attendanceData.filter((record) => record.status === "late").length;
  const attendanceRate = Math.round((presentCount / totalRecords) * 100);

  return (
    <div className="space-y-6">
        
      <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">نظام الحضور</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">إدارة الحضور اليومي</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              تتبع حضور اللاعبين والمدربين بسهولة مع كود الجلسة وملخص سريع لحالة كل فرد.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-sm text-slate-500">الحضور</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-600">{presentCount}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-sm text-slate-500">الغياب</p>
              <p className="mt-2 text-3xl font-semibold text-rose-600">{absentCount}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-sm text-slate-500">الإجمالي</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{totalRecords}</p>
            </div>
          </div>
        </div>
</div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.75fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <AppIcon icon={CalendarCheck01} className="h-6 w-6 text-slate-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-500">البحث في سجلات الحضور</p>
                  <p className="text-sm text-slate-400">ابحث بالاسم، الكود، أو رقم الهاتف.</p>
                </div>
              </div>

              <div className="flex flex-1 items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-3">
                <AppIcon icon={SearchSm} className="text-slate-500" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="ابحث عن لاعب أو جلسة"
                  className="w-full border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">مسح رمز QR</p>
                <p className="mt-2 text-sm text-slate-600">استخدم الكاميرا أو الكود لتأكيد الحضور بسرعة.</p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <AppIcon icon={QrCode01} className="text-white" />
                ابدأ المسح
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">أخر تسجيل دخول</p>
                <p className="mt-3 text-xl font-semibold text-slate-900">08:15 AM</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">الجلسة الحالية</p>
                <p className="mt-3 text-xl font-semibold text-slate-900">A2431</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-900">سجل الحضور</h2>
              <p className="mt-2 text-sm text-slate-500">عرض السجلات المفلترة حسب البحث.</p>
            </div>
            <div className="min-w-full overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-4 text-right font-medium">الاسم</th>
                    <th className="px-6 py-4 text-right font-medium">الحالة</th>
                    <th className="px-6 py-4 text-right font-medium">دخول</th>
                    <th className="px-6 py-4 text-right font-medium">خروج</th>
                    <th className="px-6 py-4 text-right font-medium">الجلسات</th>
                    <th className="px-6 py-4 text-right font-medium">كود الجلسة</th>
                    <th className="px-6 py-4 text-right font-medium">ملاحظات</th>
                    <th className="px-6 py-4 text-center font-medium">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-slate-900">
                        <div>{record.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{record.role}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[record.status].className}`}>
                          {statusStyles[record.status].label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-slate-600">{record.checkIn}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-slate-600">{record.checkOut}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-slate-600">{record.sessions}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-slate-900">{record.sessionCode}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{record.notes}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                          <AppIcon icon={Phone01} className="text-slate-600" />
                          تواصل
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-500">
                        لم يتم العثور على سجلات تطابق البحث.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">معدل الحضور</p>
                <p className="mt-2 text-4xl font-semibold text-slate-900">{attendanceRate}%</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <AppIcon icon={Bell03} className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-6 grid gap-4">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">أقل عمر</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">14 سنة</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">أعلى عمر</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">29 سنة</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
            <div className="flex items-center gap-3 text-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                <AppIcon icon={QrCode01} className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold">كود حضور سريع</p>
                <p className="mt-1 text-sm text-slate-500">أرسل الكود للمشاركين لتسجيل حضورهم.</p>
              </div>
            </div>
            <div className="mt-5 rounded-3xl bg-slate-950 p-5 text-center text-white">
              <p className="text-sm">رمز الجلسة</p>
              <p className="mt-2 text-2xl font-semibold tracking-[0.18em]">A2431</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
            <p className="text-sm font-semibold text-slate-900">الحالات الشائعة</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-3xl bg-slate-50 p-4">
                <div>
                  <p className="text-sm text-slate-500">مكتملة</p>
                  <p className="text-lg font-semibold text-slate-900">{presentCount}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">+8</span>
              </div>
              <div className="flex items-center justify-between rounded-3xl bg-slate-50 p-4">
                <div>
                  <p className="text-sm text-slate-500">غائبة</p>
                  <p className="text-lg font-semibold text-slate-900">{absentCount}</p>
                </div>
                <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-700">+1</span>
              </div>
              <div className="flex items-center justify-between rounded-3xl bg-slate-50 p-4">
                <div>
                  <p className="text-sm text-slate-500">متأخرة</p>
                  <p className="text-lg font-semibold text-slate-900">{lateCount}</p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">+2</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Attendance;
