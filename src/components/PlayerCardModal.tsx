import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import logo from '@/assets/logo.jpg';

type Player = {
  id: string;
  name: string;
  age?: number;
  phone?: string;
  game?: string;
  branch?: string;
  status?: 'paid' | 'due';
  ambId?: string;
  photo?: string;
  schedule?: string;
  memberType?: 'none' | 'annual' | 'federation';
  memberId?: string;
  memberExpiry?: string;
  memberValue?: number;
  playerSerial?: string;
  playerBarcodeValue?: string;
  joined?: boolean;
  joinDate?: string;
};

type SubscriptionRecord = {
  id: string;
  playerId?: string;
  player?: string;
  playerCode?: string;
  game?: string;
  branch?: string;
  schedule?: string;
  sessions?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
};

interface PlayerCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  subscription?: SubscriptionRecord | null;
}

export default function PlayerCardModal({
  isOpen,
  onClose,
  player,
  subscription,
}: PlayerCardModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const cardRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (!player) return;

    const qrData = player.playerBarcodeValue || player.playerSerial || player.id;
    QRCode.toDataURL(qrData, {
      width: 250,
      margin: 1,
      color: {
        dark: '#031b2e',
        light: '#ffffff',
      },
    })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [player]);

  if (!isOpen || !player) return null;

  const activityName = subscription?.game || player.game || 'رياضة عامة';
  const startDate = subscription?.startDate || player.joinDate || '2025 / 09 / 01';
  const endDate = subscription?.endDate || '2026 / 02 / 28';
  const sessionsCount = subscription?.sessions ? `${subscription.sessions} حصة` : 'اشتراك شهري';

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md overflow-y-auto">
      {/* Hidden print styles to only print the card */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #egy-player-card-printable, #egy-player-card-printable * {
            visibility: visible !important;
          }
          #egy-player-card-printable {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 950px !important;
            height: 600px !important;
            margin: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="flex w-full max-w-5xl flex-col items-center gap-5 my-auto">
        {/* Actions Bar */}
        <div className="flex w-full items-center justify-between rounded-2xl bg-slate-900/90 border border-slate-700/60 px-6 py-3.5 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>
            <h2 className="text-sm md:text-base font-extrabold text-white">
              كارنيه اشتراك اللاعب: <span className="text-cyan-400">{player.name}</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition active:scale-95 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              طباعة الكارنيه (Print)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>

        {/* ── CARD CONTAINER ── */}
        <div className="w-full overflow-x-auto flex justify-center py-2">
          <div
            id="egy-player-card-printable"
            ref={cardRef}
            dir="rtl"
            className="relative w-[950px] h-[600px] shrink-0 rounded-[32px] p-7 overflow-hidden select-none"
            style={{
              background: 'radial-gradient(130% 100% at 50% 0%, #06233d 0%, #031322 55%, #010a13 100%)',
              boxShadow: '0 0 50px rgba(0, 210, 255, 0.15), inset 0 0 30px rgba(0, 180, 255, 0.08)',
              border: '2.5px solid rgba(0, 220, 255, 0.75)',
            }}
          >
            {/* Cyber Corner Accents */}
            <div className="absolute top-0 right-0 w-32 h-32 border-t-4 border-r-4 border-cyan-400 rounded-tr-[30px] opacity-80 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 border-b-4 border-l-4 border-cyan-400 rounded-bl-[30px] opacity-80 pointer-events-none" />
            <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-cyan-500/40 rounded-tl-[30px] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-cyan-500/40 rounded-br-[30px] pointer-events-none" />

            {/* Subtle Tech Grid / Wave Overlay */}
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#00e5ff 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            {/* ── HEADER ── */}
            <div className="relative z-10 flex items-center justify-between border-b border-cyan-500/30 pb-4">
              {/* Academy Logo & Name */}
              <div className="flex items-center gap-4">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-cyan-400 bg-cyan-950/60 p-1.5 shadow-[0_0_20px_rgba(0,229,255,0.35)]">
                  <img src={logo} alt="EGY Logo" className="h-full w-full object-contain rounded-xl" />
                </div>
                <div className="text-right">
                  <h1 className="text-2xl font-black tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                    أكاديمية <span className="text-cyan-400">إيجي سبورتنج كلوب</span>
                  </h1>
                  <p className="text-[11px] font-bold tracking-[0.25em] text-cyan-200/90 uppercase font-mono">
                    EGY SPORTING CLUB ACADEMY
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="h-[2px] w-6 bg-cyan-400/80 rounded-full"></span>
                    <span className="text-xs font-bold text-cyan-300">ابنك معانا بطل أوليمبي</span>
                    <span className="h-[2px] w-6 bg-cyan-400/80 rounded-full"></span>
                  </div>
                </div>
              </div>

              {/* Card Title Badge (Top Left / Right) */}
              <div className="relative">
                <div className="rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 px-7 py-2.5 shadow-[0_0_25px_rgba(0,210,255,0.45)] border-2 border-white/60">
                  <h2 className="text-lg font-black text-slate-950 text-center tracking-wide">
                    كارنيه اشتراك لاعب
                  </h2>
                  <p className="text-[9px] font-extrabold text-slate-900/90 tracking-widest text-center font-mono uppercase">
                    PLAYER SUBSCRIPTION CARD
                  </p>
                </div>
              </div>
            </div>

            {/* ── CARD BODY (3 Columns) ── */}
            <div className="relative z-10 grid grid-cols-[1.35fr_1fr_0.9fr] gap-6 items-center mt-5">
              {/* 1. Player Info List */}
              <div className="space-y-3">
                {/* Name */}
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/80 bg-cyan-950/70 text-cyan-400 shadow-[0_0_12px_rgba(0,210,255,0.25)]">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 flex items-center justify-between rounded-xl bg-white px-4 py-2 shadow-md">
                    <span className="text-xs font-black text-slate-900">أسم اللاعب</span>
                    <span className="text-sm font-black text-slate-950 truncate max-w-[170px]">
                      {player.name}
                    </span>
                  </div>
                </div>

                {/* Sport / Activity */}
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/80 bg-cyan-950/70 text-cyan-400 shadow-[0_0_12px_rgba(0,210,255,0.25)]">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <circle cx="12" cy="12" r="9" strokeWidth="2" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v18M3 12h18" />
                    </svg>
                  </div>
                  <div className="flex-1 flex items-center justify-between rounded-xl bg-white px-4 py-2 shadow-md">
                    <span className="text-xs font-black text-slate-900">النشاط</span>
                    <span className="text-sm font-black text-cyan-700 truncate max-w-[170px]">
                      {activityName}
                    </span>
                  </div>
                </div>

                {/* Start Date */}
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/80 bg-cyan-950/70 text-cyan-400 shadow-[0_0_12px_rgba(0,210,255,0.25)]">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 flex items-center justify-between rounded-xl bg-white px-4 py-2 shadow-md">
                    <span className="text-xs font-black text-slate-900">بداية الاشتراك</span>
                    <span className="text-xs font-mono font-bold text-slate-950" dir="ltr">
                      {startDate}
                    </span>
                  </div>
                </div>

                {/* End Date */}
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/80 bg-cyan-950/70 text-cyan-400 shadow-[0_0_12px_rgba(0,210,255,0.25)]">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 flex items-center justify-between rounded-xl bg-white px-4 py-2 shadow-md">
                    <span className="text-xs font-black text-slate-900">نهاية الاشتراك</span>
                    <span className="text-xs font-mono font-bold text-slate-950" dir="ltr">
                      {endDate}
                    </span>
                  </div>
                </div>

                {/* Sessions Count / Details */}
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/80 bg-cyan-950/70 text-cyan-400 shadow-[0_0_12px_rgba(0,210,255,0.25)]">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <div className="flex-1 flex items-center justify-between rounded-xl bg-white px-4 py-2 shadow-md">
                    <span className="text-xs font-black text-slate-900">عدد الحصص</span>
                    <span className="text-sm font-black text-emerald-700">
                      {sessionsCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Photo Area (Empty slot for Stapling as requested) */}
              <div className="flex flex-col items-center justify-center">
                <div className="relative w-[190px] h-[235px] rounded-2xl border-2 border-dashed border-cyan-400/90 bg-cyan-950/40 p-3 flex flex-col items-center justify-center text-center shadow-[0_0_20px_rgba(0,229,255,0.15)]">
                  {/* Staple Pin Corner Marks */}
                  <div className="absolute top-2 right-2 w-4 h-1.5 bg-cyan-400 rounded-sm" />
                  <div className="absolute top-2 left-2 w-4 h-1.5 bg-cyan-400 rounded-sm" />

                  {/* Photo Staple Placeholder Graphic */}
                  <div className="h-16 w-16 rounded-2xl border border-cyan-400/50 bg-cyan-900/40 flex items-center justify-center text-cyan-300 mb-3 shadow-inner">
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>

                  <p className="text-sm font-extrabold text-cyan-200">
                    مكان تدبيس
                  </p>
                  <p className="text-xs font-bold text-white mt-0.5">
                    الصورة الشخصية
                  </p>
                  <span className="mt-2 text-[10px] font-mono font-semibold text-cyan-300/80 bg-cyan-950/90 px-2 py-0.5 rounded-full border border-cyan-500/40">
                    4 × 6 cm
                  </span>
                </div>
              </div>

              {/* 3. QR Code Box */}
              <div className="flex flex-col items-center justify-center">
                <div className="relative rounded-2xl border-2 border-cyan-400 bg-white p-3 shadow-[0_0_25px_rgba(0,210,255,0.35)]">
                  {/* Tech Corner Accents */}
                  <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-cyan-500" />
                  <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-cyan-500" />

                  {qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="Player QR Code" className="h-36 w-36 object-contain" />
                  ) : (
                    <div className="h-36 w-36 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                      جاري التحميل...
                    </div>
                  )}
                </div>

                <div className="mt-3 text-center">
                  <p className="text-xs font-black text-cyan-300">
                    إمسح الكود
                  </p>
                  <p className="text-[11px] font-bold text-white/90">
                    لتسجيل الحضور والغياب
                  </p>
                  <p className="mt-1 text-[10px] font-mono font-bold text-cyan-400/90" dir="ltr">
                    {player.playerSerial || player.playerBarcodeValue || player.id}
                  </p>
                </div>
              </div>
            </div>

            {/* ── FOOTER ── */}
            <div className="relative z-10 flex items-center justify-between border-t border-cyan-500/30 pt-3.5 mt-4">
              {/* Slogan */}
              <div className="flex items-center gap-2 text-white">
                <span className="text-cyan-400 font-bold">/</span>
                <span className="text-xs font-extrabold tracking-wide">
                  “ رياضة .. التزام .. مستقبل أفضل ”
                </span>
                <span className="text-[10px] font-bold text-cyan-300 font-mono tracking-wider ml-1">
                  • SPORTS .. COMMITMENT .. A BETTER FUTURE •
                </span>
              </div>

              {/* Sports Icons Strip */}
              <div className="flex items-center gap-3 text-cyan-400">
                {/* Swimming */}
                <span title="سباحة" className="p-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-sm">🏊‍♂️</span>
                {/* Football */}
                <span title="كرة قدم" className="p-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-sm">⚽</span>
                {/* Martial Arts */}
                <span title="فنون قتالية" className="p-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-sm">🥋</span>
                {/* Basketball */}
                <span title="كرة سلة" className="p-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-sm">🏀</span>
                {/* Running */}
                <span title="لياقة وجري" className="p-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-sm">🏃‍♂️</span>
              </div>

              {/* System Badge */}
              <div className="flex items-center gap-2 text-right">
                <span className="text-[9px] font-mono font-black text-cyan-300 tracking-wider">
                  EGY SYSTEM MANAGEMENT
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
