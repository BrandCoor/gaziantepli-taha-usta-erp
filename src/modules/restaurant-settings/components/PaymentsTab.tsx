import React, { useState } from 'react';
import { 
  Wallet, 
  Plus, 
  Trash2, 
  CreditCard, 
  DollarSign, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { PaymentMethodConfig, restaurantDataService } from '../../../services/restaurantDataService';
import { notify } from '../../../services/notificationService';

interface PaymentsTabProps {
  paymentMethods: PaymentMethodConfig[];
  onRefresh: () => void;
}

export const PaymentsTab: React.FC<PaymentsTabProps> = ({ paymentMethods, onRefresh }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'OTHER' as PaymentMethodConfig['type'],
  });

  const handleToggle = (pm: PaymentMethodConfig) => {
    const isCurrentlyActive = pm.isActive ?? pm.enabled ?? true;
    const updated = paymentMethods.map(p => 
      p.id === pm.id ? { ...p, isActive: !isCurrentlyActive, enabled: !isCurrentlyActive } : p
    );
    restaurantDataService.savePaymentMethods(updated);
    notify.info(
      !isCurrentlyActive ? 'Ödeme Yöntemi Açıldı' : 'Ödeme Yöntemi Kapatıldı',
      `[${pm.name}] kasada ${!isCurrentlyActive ? 'görüntülenecek' : 'gizlenecek'}.`
    );
    onRefresh();
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return notify.error('Eksik Bilgi', 'Ödeme yöntemi adını giriniz.');

    const newMethod: PaymentMethodConfig = {
      id: `pm-${Date.now()}`,
      name: form.name,
      type: form.type,
      isActive: true,
      enabled: true,
      color: '#F5C877',
    };

    restaurantDataService.savePaymentMethods([...paymentMethods, newMethod]);
    notify.success('Ödeme Yöntemi Eklendi', `[${form.name}] kasaya tanımlandı.`);
    setModalOpen(false);
    setForm({ name: '', type: 'OTHER' });
    onRefresh();
  };

  const handleDelete = (id: string, name: string) => {
    notify.confirm({
      title: 'Ödeme Yöntemini Sil',
      message: `[${name}] ödeme yöntemini kaldırmak istediğinize emin misiniz?`,
      type: 'danger',
      onConfirm: () => {
        const updated = paymentMethods.filter(p => p.id !== id);
        restaurantDataService.savePaymentMethods(updated);
        notify.success('Silindi', `[${name}] kaldırıldı.`);
        onRefresh();
      }
    });
  };

  const getMethodIcon = (type: PaymentMethodConfig['type']) => {
    switch (type) {
      case 'CASH':
        return <DollarSign className="w-5 h-5 text-emerald-400" />;
      case 'CARD':
      case 'CREDIT_CARD':
        return <CreditCard className="w-5 h-5 text-sky-400" />;
      case 'MEAL_CARD':
        return <Sparkles className="w-5 h-5 text-amber-400" />;
      default:
        return <Wallet className="w-5 h-5 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* ÜST BİLGİ & YENİ ÖDEME KANALI BUTONU */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-sm">
        <div>
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#F5C877]" />
            <span>Kasa Ödeme Yöntemleri & Yemek Kartları</span>
          </h2>
          <p className="text-xs text-[#C4C4CC] mt-0.5">
            Adisyon kapatırken ve parça ödeme alırken geçerli olan ödeme kanallarını yönetin.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Yeni Ödeme Kanalı Ekle</span>
        </button>
      </div>

      {/* ÖDEME YÖNTEMLERİ IZGARASI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {paymentMethods.map((pm) => {
          const isActive = pm.isActive ?? pm.enabled ?? true;
          return (
            <div 
              key={pm.id} 
              className={`rounded-3xl p-5 border shadow-lg flex items-center justify-between transition-all ${
                isActive 
                  ? 'bg-[#1C1C20] border-[#2C2C34] hover:border-[#3E3E4A]' 
                  : 'bg-[#141416]/70 border-[#2C2C34]/40 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#141416] border border-[#2C2C34] flex items-center justify-center">
                  {getMethodIcon(pm.type)}
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">{pm.name}</h3>
                  <span className="text-[10px] text-[#A0A0AA] font-mono uppercase">
                    {pm.type === 'CASH' ? 'Nakit / Para' : (pm.type === 'CARD' || pm.type === 'CREDIT_CARD') ? 'Kredi Kartı / POS' : pm.type === 'MEAL_CARD' ? 'Yemek Çeki / Kartı' : 'Özel Kanal'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => handleToggle(pm)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>

                {!['pm-cash', 'pm-card'].includes(pm.id) && (
                  <button
                    onClick={() => handleDelete(pm.id, pm.name)}
                    className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg cursor-pointer transition-colors"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* YENİ ÖDEME KANALI MODALI */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#141416] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#F5C877]" />
                <span>Yeni Ödeme Kanalı Ekle</span>
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-[#A0A0AA] hover:text-white text-xs font-bold cursor-pointer">✕ Kapat</button>
            </div>

            <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Ödeme Yöntemi Adı</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Örn: Paycell / BKM Express"
                  className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#F5C877]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Ödeme Türü Sınıfı</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                  className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none"
                >
                  <option value="CREDIT_CARD">Banka & Kredi Kartı</option>
                  <option value="MEAL_CARD">Yemek Kartı (Ticket, Sodexo vb.)</option>
                  <option value="CASH">Nakit & Nakit Benzeri</option>
                  <option value="OTHER">Diğer / Cari Hesap</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-[#E4E4E8] rounded-xl text-xs font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
