import React, { useState } from 'react';
import { 
  PhoneCall, 
  Bike, 
  User, 
  MapPin, 
  Clock, 
  Plus, 
  CheckCircle2, 
  Search, 
  PhoneIncoming, 
  Printer, 
  ShoppingBag,
  UserPlus,
  ArrowRight
} from 'lucide-react';
import { restaurantDataService, CustomerDeliveryInfo } from '../../services/restaurantDataService';
import { dataService } from '../../services/dataService';

interface DeliveryViewProps {
  onNavigateToPos?: (tableId?: string) => void;
}

export const DeliveryView: React.FC<DeliveryViewProps> = ({ onNavigateToPos }) => {
  // Sistemde kayıtlı gerçek müşterileri çek
  const registeredCustomers = dataService.getCustomers();

  const [inputPhone, setInputPhone] = useState('05321234567');
  const [activeCaller, setActiveCaller] = useState<CustomerDeliveryInfo | null>(null);
  const [isNewCustomerModal, setIsNewCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  // 1. SABİT TELEFON NUMARASINI SİSTEMDE FİLTRELE
  const handleSimulateIncomingCall = (phoneToTest?: string) => {
    const phone = (phoneToTest || inputPhone).trim();
    if (!phone) return;

    // Telefon numarasına göre filtrele
    const found = registeredCustomers.find(c => {
      const cleanCustomerPhone = (c.phone || '').replace(/\D/g, '');
      const cleanIncoming = phone.replace(/\D/g, '');
      return cleanCustomerPhone.includes(cleanIncoming) || cleanIncoming.includes(cleanCustomerPhone);
    });

    if (found) {
      setActiveCaller({
        customerId: found.id,
        name: found.name,
        phone: found.phone || phone,
        address: found.address || 'Kayıtlı adres bulunamadı',
        notes: found.notes || undefined,
      });
    } else {
      // Kayıtlı değilse yeni müşteri kartı aç
      setActiveCaller({
        name: 'Bilinmeyen Müşteri (Kayıtsız)',
        phone: phone,
        address: 'Adres henüz girilmedi',
      });
    }
  };

  // 2. YENİ MÜŞTERİYİ HEMEN KAYDET
  const handleSaveQuickCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return alert('Lütfen müşteri adını girin!');

    const created = dataService.addCustomer({
      name: newCustName.trim(),
      phone: activeCaller?.phone || inputPhone,
      address: newCustAddress.trim(),
      balance: 0,
      notes: 'Paket Servis Çağrısından Kaydedildi'
    });

    setActiveCaller({
      customerId: created.id,
      name: created.name,
      phone: created.phone || '',
      address: created.address || '',
    });

    setIsNewCustomerModal(false);
    setNewCustName('');
    setNewCustAddress('');
    alert('✅ Müşteri başarıyla kaydedildi!');
  };

  // 3. "SİPARİŞ VER" BUTONUNA BASILDIĞINDA BOŞ PAKET MASASINA GEÇİŞ YAP
  const handleStartPackageOrder = () => {
    if (!activeCaller) return;

    const allTables = restaurantDataService.getTables();
    
    // Boş olan ilk paket masasını bul (Paket 1, Paket 2 vb.)
    let targetPaketTable = allTables.find(t => t.sectionId === 'sec-paket' && t.status === 'EMPTY');

    if (!targetPaketTable) {
      // Paket masası yoksa boş olan herhangi bir masayı al
      targetPaketTable = allTables.find(t => t.status === 'EMPTY');
    }

    if (!targetPaketTable) {
      return alert('Tüm paket adisyonları ve masalar dolu! Lütfen önce bir hesabı kapatın.');
    }

    // Masaya müşteri bilgilerini bağla ve başlat
    restaurantDataService.updateTableOrder(
      targetPaketTable.id, 
      [], 
      'Kasa Görevlisi', 
      activeCaller
    );

    alert(`🛵 ${activeCaller.name} için [${targetPaketTable.name}] adisyonu açıldı! Menüye yönlendiriliyorsunuz.`);

    setActiveCaller(null);
    if (onNavigateToPos) {
      onNavigateToPos(targetPaketTable.id);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans">
      
      {/* ÜST BAŞLIK VE ÇAĞRI SİMÜLATÖRÜ */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center font-black shadow-lg">
            <PhoneCall className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">📞 Sabit Hat Caller ID & Paket Servis</h1>
            <p className="text-xs text-slate-500 font-medium">Telefon çaldığında sistemde kayıtlı müşteriyi süzer ve tek tıkla sipariş açar.</p>
          </div>
        </div>

        {/* Canlı Numara Test / Arama Alanı */}
        <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-2xl border border-slate-200">
          <input
            type="text"
            value={inputPhone}
            onChange={(e) => setInputPhone(e.target.value)}
            placeholder="Arayan Numara (Örn: 0532...)"
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold w-44 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={() => handleSimulateIncomingCall()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <PhoneIncoming className="w-4 h-4" />
            <span>Çağrı Simüle Et</span>
          </button>
        </div>
      </div>

      {/* ARAYAN MÜŞTERİ BİLGİ KARTI (POPUP KARTI) */}
      {activeCaller && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl font-black">
              <PhoneIncoming className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-white text-slate-900 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                  {activeCaller.customerId ? '● Kayıtlı Müşteri' : '○ Kayıtsız Numara'}
                </span>
                <span className="font-mono text-xs font-bold text-amber-100">{activeCaller.phone}</span>
              </div>
              <h2 className="text-2xl font-black text-white mt-1">{activeCaller.name}</h2>
              <p className="text-xs text-amber-100 mt-1 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-white" />
                <span>{activeCaller.address}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!activeCaller.customerId && (
              <button
                onClick={() => {
                  setNewCustName('');
                  setNewCustAddress('');
                  setIsNewCustomerModal(true);
                }}
                className="px-4 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Rehbere Kaydet</span>
              </button>
            )}

            <button
              onClick={() => setActiveCaller(null)}
              className="px-4 py-3 bg-black/20 hover:bg-black/30 rounded-xl text-xs font-bold cursor-pointer"
            >
              Yoksay
            </button>

            {/* SİPARİŞ VER BUTONU -> BOŞ PAKET MASASINA MENÜ AÇAR */}
            <button
              onClick={handleStartPackageOrder}
              className="px-6 py-3 bg-white text-slate-900 hover:bg-amber-50 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 cursor-pointer transition-transform transform active:scale-95"
            >
              <ShoppingBag className="w-4 h-4 text-amber-600" />
              <span>Sipariş Ver (Paket Aç) →</span>
            </button>
          </div>
        </div>
      )}

      {/* SİSTEMDE KAYITLI MÜŞTERİLER REHBERİ */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-black text-slate-900">Kayıtlı Müşteri & Adres Listesi</h2>
            <p className="text-xs text-slate-500">Müşterinin yanındaki butona basarak doğrudan çağrıyı simüle edebilirsiniz.</p>
          </div>
          <span className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-xl">
            {registeredCustomers.length} Müşteri Kayıtlı
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {registeredCustomers.map((cust) => (
            <div key={cust.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-black text-xs text-slate-900 truncate">{cust.name}</div>
                <div className="text-[11px] text-slate-500 font-mono">{cust.phone || 'Telefon yok'}</div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">{cust.address || 'Adres yok'}</div>
              </div>

              <button
                onClick={() => handleSimulateIncomingCall(cust.phone || '')}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer flex-shrink-0"
              >
                <span>Arama</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* HIZLI MÜŞTERİ KAYIT MODALI */}
      {isNewCustomerModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-black text-slate-900">Arayan Müşteriyi Kaydet</h3>

            <form onSubmit={handleSaveQuickCustomer} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Telefon Numarası</label>
                <input
                  type="text"
                  disabled
                  value={activeCaller?.phone || ''}
                  className="w-full mt-1 p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Müşteri Adı Soyadı</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="Örn: Ahmet Yılmaz"
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Teslimat Adresi & Daire No</label>
                <textarea
                  required
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="Örn: Batıkent Mah. 15. Sokak Güneş Apt. No:4 D:8"
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none"
                  rows={3}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewCustomerModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg cursor-pointer"
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
