import React, { useState, useRef, useEffect } from 'react';
import { Lock, ArrowRight, ShieldCheck, AlertCircle, Sparkles, UtensilsCrossed } from 'lucide-react';
import { dataService, User } from '../../services/dataService';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const users = dataService.getUsers();
  const company = dataService.getCompanySettings();
  
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 100);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const user = users.find(u => u.id === selectedUserId);
    if (!user) {
      setError('Lütfen bir kullanıcı seçin');
      return;
    }

    if (user.password !== password) {
      setError('Hatalı şifre girdiniz! Lütfen tekrar deneyin.');
      setPassword('');
      setTimeout(() => passwordInputRef.current?.focus(), 50);
      return;
    }

    dataService.setCurrentUser(user);
    onLoginSuccess(user);
  };

  return (
    <div className="h-screen w-screen bg-[#1C1C20] flex flex-col items-center justify-between p-6 select-none relative overflow-hidden font-sans">
      {/* Arka Plan Dekoratif Işıltı Efektleri */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#F5C877]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#F5C877] text-[#141416]/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Üst Logo ve Başlık */}
      <div className="w-full text-center pt-8 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F5C877]/10 border border-[#F5C877]/20 rounded-full text-[11px] font-black text-[#F5C877] uppercase tracking-widest mb-3">
          <Sparkles className="w-3.5 h-3.5" /> Özel İşletme Paneli
        </div>
      </div>

      {/* Giriş Kartı */}
      <div className="w-full max-w-md bg-[#141416]/90 border border-[#2C2C34] rounded-3xl p-8 shadow-2xl backdrop-blur-xl z-10 animate-fadeIn">
        {/* Yuvarlak Kurumsal Logo */}
        <div className="w-20 h-20 mx-auto rounded-full overflow-hidden border-2 border-[#F5C877]/50 shadow-xl bg-black flex items-center justify-center mb-4 p-0.5">
          {company.logoBase64 ? (
            <img src={company.logoBase64} alt={company.companyName} className="w-full h-full object-fill rounded-full" />
          ) : (
            <UtensilsCrossed className="w-8 h-8 text-amber-500" />
          )}
        </div>

        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-white tracking-tight">{company.companyName}</h2>
          <p className="text-xs text-[#C4C4CC] mt-1">Cari, Finans & Personel Yönetim Sistemi</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#E4E4E8] mb-1.5">Giriş Yapacak Kullanıcı</label>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setError('');
                setTimeout(() => passwordInputRef.current?.focus(), 50);
              }}
              className="w-full px-4 py-3 bg-[#1C1C20] border border-[#383844] focus:border-[#F5C877] rounded-2xl text-xs font-bold text-white focus:outline-none transition-colors cursor-pointer"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.roleName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#E4E4E8] mb-1.5">Kullanıcı Giriş Şifresi</label>
            <div className="relative">
              <input
                ref={passwordInputRef}
                type="password"
                required
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Şifrenizi girin..."
                className={`w-full px-4 py-3 bg-[#1C1C20] border rounded-2xl text-xs font-mono text-white focus:outline-none transition-colors select-text cursor-text ${
                  error ? 'border-rose-500 bg-rose-950/20 text-rose-300' : 'border-[#383844] focus:border-[#F5C877]'
                }`}
              />
              <Lock className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-[#A0A0AA] pointer-events-none" />
            </div>

            {error && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-rose-400 animate-fadeIn">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-[#F5C877] hover:to-[#D4A351] text-white font-black rounded-2xl text-xs shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
          >
            <span>Sisteme Giriş Yap</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Alt Geliştirici & Lisans İmzası */}
      <div className="text-center pb-4 text-[11px] text-[#A0A0AA] font-medium z-10">
        <span>Özel Tasarım & Yazılım Mimarisi: </span>
        <strong className="text-[#F5C877] font-black tracking-wider">RYMedya</strong>
        <span className="text-[#A0A0AA]"> • © 2026</span>
      </div>
    </div>
  );
};