import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { dataService, User, ROLE_PERMISSIONS } from '../../services/dataService';
import { hashPassword, validatePasswordPolicy } from '../../utils/passwordHash';

interface Props {
  onCreated: (user: User) => void;
}

/** İlk kurulum: varsayılan/bilinen parola YOKTUR; yönetici hesabı bu ekranda oluşturulur. */
export const FirstRunSetupView: React.FC<Props> = ({ onCreated }) => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const name = fullName.trim();
    const user = username.trim().toLowerCase();
    if (!name) return setError('Ad Soyad girin.');
    if (!/^[a-z0-9._-]{3,30}$/.test(user)) return setError('Kullanıcı adı 3-30 karakter olmalı (harf, rakam, . _ -).');
    const policy = validatePasswordPolicy(password);
    if (policy) return setError(policy);
    if (password !== password2) return setError('Parolalar eşleşmiyor.');
    setBusy(true);
    try {
      const created = dataService.saveUser({
        username: user,
        fullName: name,
        password: await hashPassword(password),
        role: 'ADMIN',
        roleName: ROLE_PERMISSIONS.ADMIN.label,
        permissions: [...ROLE_PERMISSIONS.ADMIN.permissions],
        isActive: true,
      });
      dataService.setCurrentUser(created);
      onCreated(created);
    } catch (err: any) {
      setError('Kayıt hatası: ' + (err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full px-4 py-3 bg-[#141416] border border-[#383844] rounded-xl text-sm text-white focus:outline-none focus:border-amber-400';

  return (
    <div className="h-screen w-screen bg-[#1C1C20] flex items-center justify-center p-6 font-sans">
      <form onSubmit={submit} className="w-full max-w-md bg-[#141416] border border-[#2C2C34] rounded-3xl p-8 space-y-4 shadow-2xl">
        <div className="text-center space-y-2">
          <ShieldCheck className="w-10 h-10 text-[#F5C877] mx-auto" />
          <h1 className="text-xl font-black text-white">İlk Kurulum</h1>
          <p className="text-xs text-[#C4C4CC]">Sistemi yönetecek hesabı oluşturun. Hazır/varsayılan bir parola yoktur; bu parolayı unutmamak sizin sorumluluğunuzdadır.</p>
        </div>
        <input className={input} placeholder="Ad Soyad" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
        <input className={input} placeholder="Kullanıcı adı (ör. patron)" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
        <input className={input} type="password" placeholder="Parola (en az 6 karakter)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <input className={input} type="password" placeholder="Parola (tekrar)" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
        {error && <div className="text-xs font-bold text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">{error}</div>}
        <button disabled={busy} className="w-full py-3 bg-[#F5C877] text-slate-950 font-black rounded-xl cursor-pointer disabled:opacity-50">
          {busy ? 'Oluşturuluyor…' : 'Yönetici Hesabını Oluştur'}
        </button>
      </form>
    </div>
  );
};
