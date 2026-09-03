import React, { useState, useEffect } from 'react';
import { 
  PhoneCall, 
  PhoneIncoming, 
  ShoppingBag, 
  UserPlus, 
  Clock, 
  MapPin, 
  ArrowRight,
  Search,
  CheckCircle2,
  XCircle,
  Sparkles
} from 'lucide-react';
import { restaurantDataService, CustomerDeliveryInfo, CallLogItem } from '../../services/restaurantDataService';
import { dataService, Customer } from '../../services/dataService';

interface DeliveryViewProps {
  onStartOrder?: (tableId: string) => void;
}

export const DeliveryView: React.FC<DeliveryViewProps> = ({ onStartOrder }) => {
  const [customers, setCustomers] = useState<Customer[]>(dataService.getCustomers() || []);
  const [recentCalls, setRecentCalls] = useState<CallLogItem[]>(restaurantDataService.getRecentCalls() || []);

  const [inputPhone, setInputPhone] = useState('0532 999 88 77');
  const [activeCaller, setActiveCaller] = useState<CustomerDeliveryInfo | null>(null);

  // Hızlı Kayıt Modalı
  const [quickSaveModal, setQuickSaveModal] = useState(false);
  const [regName, setRegName] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPhone, setRegPhone] = useState('');

  const refreshCustomersAndCalls = () => {
    setCustomers(dataService.getCustomers() || []);
    setRecentCalls(restaurantDataService.getRecentCalls() || []);
  };

  useEffect(() => {
    refreshCustomersAndCalls();
    const unsub = restaurantDataService.subscribe(refreshCustomersAndCalls);
    return () => unsub();
  }, []);

  const handleSimulateCall = (phoneToTest?: string) => {
    const rawPhone = (phoneToTest || inputPhone).trim();
    if (!rawPhone) return;

    const cleanRaw = rawPhone.replace(/\D/g, '');
    const found = customers.find(c => {
      const cleanC = (c.phone || '').replace(/\D/g, '');
      return cleanC && (cleanC.includes(cleanRaw) || cleanRaw.includes(cleanC));
    });

    if (found) {
      const info: CustomerDeliveryInfo = {
        customerId: found.id,
        name: found.name,
        phone: found.phone || rawPhone,
        address: found.address || 'Kayıtlı adres yok',
        notes: found.notes,
      };
      setActiveCaller(info);
      restaurantDataService.addCallLog(rawPhone, info);
    } else {
      const info: CustomerDeliveryInfo = {
        name: 'Kayıtsız Müşteri',
        phone: rawPhone,
        address: '',
      };
      setActiveCaller(info);
      restaurantDataService.addCallLog(rawPhone, { name: 'Kayıtsız Numara', address: '' });
    }
  };

  const handleSaveCustomerForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) return alert('Müşteri adını girin!');

    const created = dataService.addCustomer({
      name: regName.trim(),
      phone: regPhone,
      address: regAddress.trim(),
      balance: 0,
      notes: 'Caller ID üzerinden kaydedildi'
    });

    setCustomers(dataService.getCustomers());

    const updatedInfo: CustomerDeliveryInfo = {
      customerId: created.id,
      name: created.name,
      phone: created.phone || regPhone,
      address: created.address || '',
    };

    setActiveCaller(updatedInfo);
    restaurantDataService.addCallLog(regPhone, updatedInfo);
    setQuickSaveModal(false);
    alert(`✅ [${created.name}] rehbere kaydedildi!`);
  };

  // DOĞRUDAN PAKET MASASINA BAĞLAN VE SİPARİŞİ AÇ
  const handleLaunchPackageOrder = (callerInfo?: CustomerDeliveryInfo | null) => {
    const targetCaller = callerInfo || activeCaller;
    if (!targetCaller) return;

    const allTables = restaurantDataService.getTables();
    
    // 1. Önce "sec-paket" altındaki boş masayı bul (Paket 1, Paket 2 vb.)
    let targetTable = allTables.find(t => t.sectionId === 'sec-paket' && t.status === 'EMPTY');

    // 2. Paket masası kalmamışsa boş olan herhangi bir masayı al
    if (!targetTable) {
      targetTable = allTables.find(t => t.status === 'EMPTY');
    }

    if (!targetTable) {
      return alert('Tüm paket adisyonları ve masalar dolu! Lütfen önce bir adisyonu kapatın.');
    }

    // 3. Masaya müşteri bilgilerini ata
    restaurantDataService.updateTableOrder(
      targetTable.id,
      [],
      'Kasa (Paket)',
      targetCaller
    );

    // 4. Hedef masayı hafızaya al
    restaurantDataService.setPendingPosTableToOpen(targetTable.id);
    setActiveCaller(null);

    // 5. App.tsx'e POS sekmesini aç emrini ver
    if (onStartOrder) {
      onStartOrder(targetTable.id);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans text-slate-100 bg-slate-900 min-h-screen">
      
      {/* ÜST BAŞLIK VE ARAMA TEST BAR */}
      <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black text-2xl shadow-lg">
            <PhoneCall className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Sabit Hat Caller ID & Paket Servis</span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase">CANLI ÇAĞRI</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Arayan müşteriyi tanıyın, tek tıkla boş paket masasına sipariş açın.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-2xl border border-slate-800">
          <input
            type="text"
            value={inputPhone}
            onChange={(e) => setInputPhone(e.target.value)}
            placeholder="0532 999 88 77"
            className="px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-amber-300 w-40 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={() => handleSimulateCall()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md cursor-pointer flex items-center gap-1.5 transition-all"
          >
            <PhoneIncoming className="w-4 h-4" />
            <span>Çağrı Simüle Et</span>
          </button>
        </div>
      </div>

      {/* CANLI ARAYAN KART POPUP */}
      {activeCaller && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-950/20 rounded-2xl flex items-center justify-center text-3xl font-black">
              <PhoneIncoming className="w-8 h-8 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-slate-950 text-amber-400 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                  {activeCaller.customerId ? '● Kayıtlı Müşteri' : '○ Kayıtsız Numara'}
                </span>
                <span className="font-mono text-xs font-bold text-slate-900">{activeCaller.phone}</span>
              </div>
              <h2 className="text-2xl font-black text-slate-950 mt-1">{activeCaller.name}</h2>
              <p className="text-xs text-slate-900 font-bold mt-1 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-slate-950" />
                <span>{activeCaller.address || 'Adres henüz girilmemiş'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!activeCaller.customerId && (
              <button
                onClick={() => {
                  setRegName('');
                  setRegAddress('');
                  setRegPhone(activeCaller.phone);
                  setQuickSaveModal(true);
                }}
                className="px-4 py-3 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <UserPlus className="w-4 h-4 text-amber-400" />
                <span>Rehbere Kaydet</span>
              </button>
            )}

            <button
              onClick={() => setActiveCaller(null)}
              className="px-4 py-3 bg-black/20 hover:bg-black/30 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
            >
              Yoksay
            </button>

            <button
              onClick={() => handleLaunchPackageOrder()}
              className="px-6 py-3 bg-slate-950 text-amber-400 hover:bg-black rounded-xl text-xs font-black shadow-xl flex items-center gap-2 cursor-pointer transition-transform transform active:scale-95"
            >
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              <span>Sipariş Ver (Paket Aç) →</span>
            </button>
          </div>
        </div>
      )}

      {/* SON ARAYANLAR LİSTESİ */}
      <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-black text-white">Son Arayanlar Listesi (Gelen Çağrılar Geçmişi)</h2>
              <p className="text-[11px] text-slate-400">Sabit hattan gelen son aramalar. Tek tıkla doğrudan paket sipariş açabilirsiniz.</p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl">
            {recentCalls.length} Arama Kaydı
          </span>
        </div>

        <div className="space-y-2.5">
          {recentCalls.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/60 rounded-2xl">
              Henüz çağrı kaydı bulunmuyor.
            </div>
          ) : (
            recentCalls.map((call) => {
              const registered = customers.find(c => {
                const cClean = (c.phone || '').replace(/\D/g, '');
                const pClean = call.phone.replace(/\D/g, '');
                return cClean && (cClean.includes(pClean) || pClean.includes(cClean));
              });

              const displayName = registered ? registered.name : call.customerName;
              const displayAddress = registered ? registered.address : call.address;
              const isReg = Boolean(registered || call.isRegistered);

              return (
                <div
                  key={call.id}
                  className="p-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black flex-shrink-0 ${
                      isReg ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}>
                      <PhoneIncoming className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-white truncate">{displayName}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${
                          isReg ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {isReg ? 'Kayıtlı' : 'Kayıtsız'}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-amber-300 font-bold mt-0.5">{call.phone}</div>
                      {displayAddress && (
                        <div className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          <span>{displayAddress}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                    <span className="text-[10px] text-slate-500 font-mono mr-2">{call.time}</span>

                    {!isReg && (
                      <button
                        onClick={() => {
                          setRegName('');
                          setRegAddress('');
                          setRegPhone(call.phone);
                          setQuickSaveModal(true);
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                        <span>Rehbere Ekle</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleLaunchPackageOrder({
                        customerId: registered?.id,
                        name: displayName,
                        phone: call.phone,
                        address: displayAddress || '',
                      })}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-transform active:scale-95"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-slate-950" />
                      <span>Sipariş Ver →</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* HIZLI KAYIT MODALI */}
      {quickSaveModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                <span>Müşteriyi Rehbere Kaydet</span>
              </h3>
              <button onClick={() => setQuickSaveModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerForm} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-400">Telefon Numarası</label>
                <input
                  type="text"
                  disabled
                  value={regPhone}
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold text-amber-300"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400">Müşteri Adı Soyadı</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Örn: Mehmet Demir"
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400">Teslimat Adresi</label>
                <textarea
                  required
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  placeholder="Örn: Batıkent Mah. 15. Sok. Güneş Apt. No:4 D:8"
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  rows={3}
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickSaveModal(false)}
                  className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer"
                >
                  Rehbere Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
