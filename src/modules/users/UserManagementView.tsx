import React, { useState, useRef, useEffect } from 'react';
import { Plus, Shield, User as UserIcon, Trash2, Edit2, CheckCircle2, AlertCircle } from 'lucide-react';
import { dataService, User, RoleType, Permission } from '../../services/dataService';

export const UserManagementView: React.FC = () => {
  const [users, setUsers] = useState<User[]>(dataService.getUsers());
  const currentUser = dataService.getCurrentUser();
  const [showModal, setShowModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleType>('ACCOUNTANT');
  const [formError, setFormError] = useState('');

  const fullNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showModal) {
      setTimeout(() => {
        fullNameInputRef.current?.focus();
      }, 50);
    }
  }, [showModal]);

  const refreshList = () => {
    const updated = dataService.getUsers();
    setUsers([...updated]);
  };

  const handleOpenAdd = () => {
    setEditingUserId(null);
    setFullName('');
    setUsername('');
    setPassword('');
    setRole('ACCOUNTANT');
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUserId(user.id);
    setFullName(user.fullName);
    setUsername(user.username);
    setPassword(user.password);
    setRole(user.role);
    setFormError('');
    setShowModal(true);
  };

  const handleDelete = (user: User) => {
    if (confirm(`"${user.fullName}" kullanıcısını silmek istediğinize emin misiniz?`)) {
      const success = dataService.deleteUser(user.id);
      if (success) {
        refreshList();
      }
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    
    const cleanFullName = fullName.trim();
    const cleanUsername = username.toLowerCase().trim();
    const cleanPassword = password.trim();

    if (!cleanFullName) {
      setFormError('Lütfen Ad Soyad alanını doldurun');
      return;
    }
    if (!cleanUsername) {
      setFormError('Lütfen Kullanıcı Adı belirleyin');
      return;
    }
    if (!cleanPassword) {
      setFormError('Lütfen Giriş Şifresi belirleyin');
      return;
    }

    let roleName = 'Muhasebe / Cari Sorumlusu';
    let permissions: Permission[] = ['CUSTOMERS_VIEW', 'CUSTOMERS_MANAGE', 'CUSTOMERS_TRANSACTION', 'REPORTS_VIEW'];

    if (role === 'ADMIN') {
      roleName = 'Yönetici (Tam Yetkili)';
      permissions = ['ALL'];
    } else if (role === 'HR') {
      roleName = 'İnsan Kaynakları Sorumlusu';
      permissions = ['EMPLOYEES_VIEW', 'EMPLOYEES_MANAGE', 'EMPLOYEES_PAYMENT', 'REPORTS_VIEW'];
    } else if (role === 'VIEWER') {
      roleName = 'Sadece Görüntüleme (İzleyici)';
      permissions = ['CUSTOMERS_VIEW', 'EMPLOYEES_VIEW', 'REPORTS_VIEW'];
    }

    try {
      dataService.saveUser({
        id: editingUserId || undefined,
        username: cleanUsername,
        fullName: cleanFullName,
        password: cleanPassword,
        role,
        roleName,
        permissions,
        isActive: true
      });

      setShowModal(false);
      setFormError('');
      refreshList();
    } catch (err: any) {
      setFormError('Kayıt hatası: ' + err.message);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-[1500px] mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#FAF7F2]">Kullanıcılar & Yetkilendirme</h2>
          <p className="text-xs text-[#A0A0AA]">Sistemi kullanan personelleri tanımlayın ve erişim yetkilerini belirleyin ({users.length} Kayıtlı Kullanıcı)</p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#F5C877] text-[#141416] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Kullanıcı Ekle</span>
        </button>
      </div>

      {/* Kullanıcı Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {users.map(u => (
          <div key={u.id} className="bg-[#1C1C20] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                    u.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' :
                    u.role === 'ACCOUNTANT' ? 'bg-blue-100 text-[#F5C877]' :
                    u.role === 'HR' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-[#141416] text-slate-700'
                  }`}>
                    {u.role === 'ADMIN' ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-[#FAF7F2] text-sm leading-tight">{u.fullName}</h4>
                    <div className="text-xs text-[#C4C4CC] font-mono">@{u.username}</div>
                  </div>
                </div>

                {currentUser.id === u.id && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                    Aktif Oturum
                  </span>
                )}
              </div>

              <div className="p-3 bg-[#141416] rounded-xl text-xs space-y-1.5 my-3">
                <div className="flex justify-between">
                  <span className="text-[#A0A0AA]">Yetki Rolü:</span>
                  <span className="font-bold text-slate-800">{u.roleName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A0A0AA]">Giriş Şifresi:</span>
                  <span className="font-mono text-[#A0A0AA] font-bold">{u.password}</span>
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-[#A0A0AA] mb-4">
                <div className="font-semibold text-slate-700 text-xs mb-1">Erişim İzinleri:</div>
                {u.role === 'ADMIN' && <div className="text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Tüm Sisteme Tam Yetki</div>}
                {u.role === 'ACCOUNTANT' && <div>• Müşteri Yönetimi, Borç Yazma, Tahsilat Alma, Raporlar</div>}
                {u.role === 'HR' && <div>• Personel Yönetimi, Maaş/Avans Ödemeleri, Raporlar</div>}
                {u.role === 'VIEWER' && <div>• Yalnızca Görüntüleme ve Rapor Alma (Değişiklik Yapamaz)</div>}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => handleOpenEdit(u)}
                className="px-3 py-1.5 bg-[#141416] hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors"
              >
                <Edit2 className="w-3 h-3" /> Düzenle
              </button>
              {u.role !== 'ADMIN' && u.username !== 'admin' && (
                <button
                  onClick={() => handleDelete(u)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs flex items-center gap-1 border border-rose-200 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Sil
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* KULLANICI EKLEME / DÜZENLEME MODALI */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-[#141416]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false);
              setFormError('');
            }
          }}
        >
          <div 
            className="bg-[#1C1C20] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[#FAF7F2] mb-1">
              {editingUserId ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Oluştur'}
            </h3>
            <p className="text-xs text-[#A0A0AA] mb-4">Kullanıcı giriş bilgilerini ve erişim rolünü belirleyin</p>

            {formError && (
              <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Personel Ad Soyad *</label>
                <input
                  ref={fullNameInputRef}
                  type="text"
                  required
                  value={fullName}
                  onChange={e => {
                    setFullName(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder="Örn: Ayşe Demir"
                  className="w-full px-3 py-2 border-2 border-slate-300 focus:border-blue-600 rounded-xl text-xs text-[#FAF7F2] bg-[#1C1C20] font-medium focus:outline-none shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kullanıcı Adı (Giriş İçin) *</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => {
                    setUsername(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder="Örn: ayse"
                  className="w-full px-3 py-2 border-2 border-slate-300 focus:border-blue-600 rounded-xl text-xs font-mono text-[#FAF7F2] bg-[#1C1C20] focus:outline-none shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Giriş Şifresi *</label>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder="Şifre belirleyin..."
                  className="w-full px-3 py-2 border-2 border-slate-300 focus:border-blue-600 rounded-xl text-xs font-mono text-[#FAF7F2] bg-[#1C1C20] focus:outline-none shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Yetki Rolü (Sınıflandırma) *</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as RoleType)}
                  className="w-full px-3 py-2 border-2 border-slate-300 focus:border-blue-600 rounded-xl text-xs font-bold text-[#FAF7F2] bg-[#1C1C20] focus:outline-none shadow-sm cursor-pointer"
                >
                  <option value="ACCOUNTANT">💼 Muhasebe / Cari (Müşteri & Borç/Tahsilat)</option>
                  <option value="HR">👥 İnsan Kaynakları (Personel & Maaş/Ödeme)</option>
                  <option value="VIEWER">👁️ Sadece Görüntüleme (Hiçbir Veriyi Değiştiremez)</option>
                  <option value="ADMIN">👑 Yönetici (Tam Yetkili - Her İşlemi Yapar)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormError('');
                  }}
                  className="px-4 py-2 bg-[#141416] hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F5C877] text-[#141416] hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20"
                >
                  {editingUserId ? 'Değişiklikleri Kaydet' : 'Kullanıcıyı Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};