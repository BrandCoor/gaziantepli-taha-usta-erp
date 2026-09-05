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

  const [activeCaller, setActiveCaller] = useState<CustomerDeliveryInfo | null>(null);
  const [searchCallQuery, setSearchCallQuery] = useState('');
  const [manualCallModal, setManualCallModal] = useState(false);
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');

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

  const handleCreateManualCall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone.trim()) return;

    const cleanRaw = manualPhone.replace(/\D/g, '');
    const found = customers.find(c => {
      const cleanC = (c.phone || '').replace(/\D/g, '');
      return cleanC && (cleanC.includes(cleanRaw) || cleanRaw.includes(cleanC));
    });

    const info: CustomerDeliveryInfo = {
      customerId: found?.id,
      name: manualName.trim() || found?.name || 'Gelen Çağrı',
      phone: manualPhone.trim(),
      address: manualAddress.trim() || found?.address || '',
    };

    setActiveCaller(info);
    restaurantDataService.addCallLog(manualPhone.trim(), info);
    setManualCallModal(false);
    setManualPhone('');
    setManualName('');
    setManualAddress('');
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans text-slate-100 bg-[#141416] min-h-screen">
      
      {/* ÜST BAŞLIK VE ARAMA TEST BAR */}
      <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F5C877]/10 border border-[#F5C877]/30 text-[#F5C877] flex items-center justify-center font-black text-2xl shadow-lg">
            <PhoneCall className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Sabit Hat Caller ID & Paket Servis</span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase">CANLI ÇAĞRI</span>
            </h1>
            <p className="text-xs text-[#C4C4CC] font-medium">Arayan müşteriyi tanıyın, tek tıkla boş paket masasına sipariş açın.</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8E8E98] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchCallQuery}
              onChange={(e) => setSearchCallQuery(e.target.value)}
              placeholder="Numara veya müşteri ara..."
              className="pl-8 pr-3 py-2 bg-[#141416] border border-[#383844] rounded-xl text-xs font-medium text-white placeholder:text-[#8E8E98] w-48 sm:w-56 focus:outline-none focus:border-[#F5C877]"
            />
          </div>

          <button
            onClick={() => setManualCallModal(true)}
            className="px-4 py-2 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 rounded-xl text-xs font-black shadow-md cursor-pointer flex items-center gap-1.5 transition-all"
          >
            <PhoneIncoming className="w-4 h-4" />
            <span>+ Çağrı Ekle</span>
          </button>
        </div>
      </div>

      {/* CANLI ARAYAN KART POPUP */}
      {activeCaller && (
        <div className="bg-gradient-to-r from-[#F5C877] via-orange-500 to-[#D4A351] text-slate-950 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#1C1C20]/20 rounded-2xl flex items-center justify-center text-3xl font-black">
              <PhoneIncoming className="w-8 h-8 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-[#1C1C20] text-[#F5C877] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                  {activeCaller.customerId ? '● Kayıtlı Müşteri' : '○ Kayıtsız Numara'}
                </span>
                <span className="font-mono text-xs font-bold text-[#FAF7F2]">{activeCaller.phone}</span>
              </div>
              <h2 className="text-2xl font-black text-slate-950 mt-1">{activeCaller.name}</h2>
              <p className="text-xs text-[#FAF7F2] font-bold mt-1 flex items-center gap-1">
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
                className="px-4 py-3 bg-[#1C1C20] hover:bg-[#141416] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <UserPlus className="w-4 h-4 text-[#F5C877]" />
                <span>Rehbere Kaydet</span>
              </button>
            )}

            <button
              onClick={() => setActiveCaller(null)}
              className="px-4 py-3 bg-black/20 hover:bg-black/30 rounded-xl text-xs font-bold text-[#FAF7F2] cursor-pointer"
            >
              Yoksay
            </button>

            <button
              onClick={() => handleLaunchPackageOrder()}
              className="px-6 py-3 bg-[#1C1C20] text-[#F5C877] hover:bg-black rounded-xl text-xs font-black shadow-xl flex items-center gap-2 cursor-pointer transition-transform transform active:scale-95"
            >
              <ShoppingBag className="w-4 h-4 text-[#F5C877]" />
              <span>Sipariş Ver (Paket Aç) →</span>
            </button>
          </div>
        </div>
      )}

      {/* SON ARAYANLAR LİSTESİ */}
      <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#F5C877]" />
            <div>
              <h2 className="text-sm font-black text-white">Gelen Çağrılar ve Son Arayanlar</h2>
              <p className="text-[11px] text-[#C4C4CC]">Sabit hat Caller ID cihazından gelen çağrılar. Tek tıkla doğrudan boş paket masasına adisyon açabilirsiniz.</p>
            </div>
          </div>
          <span className="text-xs font-bold text-[#F5C877] bg-[#F5C877]/10 border border-[#F5C877]/20 px-3 py-1 rounded-xl">
            {recentCalls.length} Arama Kaydı
          </span>
        </div>

        <div className="space-y-2.5">
          {(() => {
            const filteredCalls = recentCalls.filter(c => {
              const q = searchCallQuery.toLowerCase().trim();
              if (!q) return true;
              return (
                (c.phone || '').includes(q) ||
                (c.customerName || '').toLowerCase().includes(q) ||
                (c.address || '').toLowerCase().includes(q)
              );
            });

            if (filteredCalls.length === 0) {
              return (
                <div className="p-10 text-center text-xs text-[#A0A0AA] bg-[#141416]/60 rounded-2xl border border-dashed border-[#2C2C34] space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-[#282830] flex items-center justify-center text-[#8E8E98]">
                    <PhoneIncoming className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-white">Henüz Gelen Arama Bulunmuyor</div>
                  <div className="text-[11px] text-[#8E8E98] max-w-md mx-auto">
                    Sabit hat Caller ID cihazı dinlemede. Müşteri aradığında bilgileri anlık olarak burada listelenir veya &quot;+ Çağrı Ekle&quot; ile manuel arama kaydedebilirsiniz.
                  </div>
                </div>
              );
            }

            return filteredCalls.map((call) => {
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
                  className="p-4 bg-[#141416] hover:bg-slate-850 border border-[#2C2C34] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black flex-shrink-0 ${
                      isReg ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-[#F5C877]/10 text-[#F5C877] border border-[#F5C877]/30'
                    }`}>
                      <PhoneIncoming className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-white truncate">{displayName}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${
                          isReg ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-[#C4C4CC]'
                        }`}>
                          {isReg ? 'Kayıtlı Müşteri' : 'Kayıtsız Numara'}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-amber-300 font-bold mt-0.5">{call.phone}</div>
                      {displayAddress && (
                        <div className="text-[10px] text-[#C4C4CC] truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-[#A0A0AA] flex-shrink-0" />
                          <span>{displayAddress}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                    <span className="text-[10px] text-[#A0A0AA] font-mono mr-2">{call.time}</span>

                    {!isReg && (
                      <button
                        onClick={() => {
                          setRegName('');
                          setRegAddress('');
                          setRegPhone(call.phone);
                          setQuickSaveModal(true);
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-[#FAF7F2] rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-[#F5C877]" />
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
                      className="px-4 py-2 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-transform active:scale-95"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-slate-950" />
                      <span>Sipariş Aç →</span>
                    </button>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* HIZLI KAYIT MODALI */}
      {quickSaveModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#141416] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#F5C877]" />
                <span>Müşteriyi Rehbere Kaydet</span>
              </h3>
              <button onClick={() => setQuickSaveModal(false)} className="text-[#C4C4CC] hover:text-white cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerForm} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Telefon Numarası</label>
                <input
                  type="text"
                  disabled
                  value={regPhone}
                  className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#2C2C34] rounded-xl text-xs font-mono font-bold text-amber-300"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Müşteri Adı Soyadı</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Örn: Mehmet Demir"
                  className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#F5C877]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Teslimat Adresi</label>
                <textarea
                  required
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  placeholder="Örn: Batıkent Mah. 15. Sok. Güneş Apt. No:4 D:8"
                  className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs text-white focus:outline-none focus:border-[#F5C877]"
                  rows={3}
                />
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickSaveModal(false)}
                  className="px-4 py-2.5 bg-slate-800 text-[#E4E4E8] rounded-xl text-xs font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#F5C877] hover:bg-[#F5C877] text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer"
                >
                  Rehbere Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUEL ÇAĞRI EKLEME MODALI */}
      {manualCallModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#141416] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <PhoneIncoming className="w-5 h-5 text-[#F5C877]" />
                <span>Manuel Çağrı & Arayan Kaydı Ekle</span>
              </h3>
              <button onClick={() => setManualCallModal(false)} className="text-[#C4C4CC] hover:text-white cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualCall} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Arayan Telefon Numarası *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="0532 123 45 67"
                  className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-[#F5C877]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Müşteri Adı Soyadı (Opsiyonel)</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Örn: Ahmet Yılmaz"
                  className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#F5C877]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Teslimat Adresi (Opsiyonel)</label>
                <textarea
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="Örn: Değirmiçem Mah. Mithat Enç Cad. No: 12"
                  className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs text-white focus:outline-none focus:border-[#F5C877]"
                  rows={2}
                />
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setManualCallModal(false)}
                  className="px-4 py-2.5 bg-slate-800 text-[#E4E4E8] rounded-xl text-xs font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer flex items-center gap-1.5"
                >
                  <PhoneIncoming className="w-4 h-4" />
                  <span>Çağrıyı Kaydet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
