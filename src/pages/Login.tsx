import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '@/components/AppIcon';
import { HomeLine } from '@untitledui/icons';

function getErrorMessage(error: unknown) {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return 'حدث خطأ أثناء تسجيل الدخول';
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await window.api?.login?.(email.trim(), password);
      const response = await window.api?.request?.('/auth/me');
      const user = response?.data;
      if (user && typeof window !== 'undefined') {
        window.localStorage.setItem('loggedInUser', JSON.stringify(user));
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/95 p-10 shadow-2xl shadow-slate-950/20">
          <div className="mb-10 flex items-center gap-3">
            <AppIcon icon={HomeLine} className="text-sky-400" />
            <div>
              <h1 className="text-3xl font-semibold text-white">تسجيل الدخول</h1>
              <p className="text-sm text-slate-400">اتصل بباك إند المشروع لتفعيل البيانات الحقيقية.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-300">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-sky-500/20 transition focus:border-sky-400 focus:ring"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-sky-500/20 transition focus:border-sky-400 focus:ring"
              />
            </div>

            {error ? <p className="text-sm text-rose-400">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
