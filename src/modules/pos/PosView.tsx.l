import React, { useState, useMemo } from 'react';

// Tip Tanımlamaları
export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  note?: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  printed?: boolean;
}

export interface Table {
  id: string;
  number: string;
  name: string;
  section: 'SALON' | 'BAHCE' | 'PAKET';
  status: 'EMPTY' | 'OCCUPIED' | 'BILL_REQUESTED';
  guestCount?: number;
  orders: OrderItem[];
  openedAt?: string;
  callerCustomer?: {
    name: string;
    phone: string;
    address: string;
  };
}

export const PosView: React.FC = () => {
  // Demo Masalar
  const [tables, setTables] = useState<Table[]>([
    { id: '1', number: 'S-1', name: 'Masa 1', section: 'SALON', status: 'OCCUPIED', guestCount: 4, openedAt: '12:30', orders: [
      { id: 'o1', name: 'Adana Kebap', price: 280, quantity: 2, category: 'Kebap', status: 'CONFIRMED', printed: true },
      { id: 'o2', name: 'Lahmacun (Acılı)', price: 90, quantity: 3, category: 'Fırın', status: 'CONFIRMED', printed: true },
      { id: 'o3', name: 'Ayran (Yayık)', price: 35, quantity: 4, category: 'İçecek', status: 'CONFIRMED', printed: true }
    ]},
    { id: '2', number: 'S-2', name: 'Masa 2', section: 'SALON', status: 'EMPTY', orders: [] },
    { id: '3', number: 'S-3', name: 'Masa 3', section: 'SALON', status: 'BILL_REQUESTED', guestCount: 2, openedAt: '13:10', orders: [
      { id: 'o4', name: 'Kuşbaşılı Pide', price: 240, quantity: 2, category: 'Fırın', status: 'CONFIRMED', printed: true },
      { id: 'o5', name: 'Kola', price: 45, quantity: 2, category: 'İçecek', status: 'CONFIRMED', printed: true }
    ]},
    { id: '4', number: 'S-4', name: 'Masa 4', section: 'SALON', status: 'EMPTY', orders: [] },
    { id: '5', number: 'B-1', name: 'Bahçe 1', section: 'BAHCE', status: 'OCCUPIED', guestCount: 6, openedAt: '13:45', orders: [
      { id: 'o6', name: 'Karışık Izgara', price: 550, quantity: 2, category: 'Kebap', status: 'CONFIRMED', printed: true },
      { id: 'o7', name: 'Gavurdağı Salata', price: 120, quantity: 2, category: 'Meze', status: 'CONFIRMED', printed: true }
    ]},
    { id: '6', number: 'B-2', name: 'Bahçe 2', section: 'BAHCE', status: 'EMPTY', orders: [] },
    { id: '7', number: 'B-3', name: 'Bahçe 3', section: 'BAHCE', status: 'EMPTY', orders: [] },
    { id: '8', number: 'P-1', name: 'Paket 1', section: 'PAKET', status: 'EMPTY', orders: [] },
    { id: '9', number: 'P-2', name: 'Paket 2', section: 'PAKET', status: 'EMPTY', orders: [] },
  ]);

  const [activeSection, setActiveSection] = useState<'ALL' | 'SALON' | 'BAHCE' | 'PAKET'>('ALL');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  // Görsel Masa Taşıma Modal Durumları
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTargetTableId, setTransferTargetTableId] = useState<string | null>(null);
  const [transferSectionFilter, setTransferSectionFilter] = useState<'ALL' | 'SALON' | 'BAHCE' | 'PAKET'>('ALL');

  // Bildirim / Mesaj
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const selectedTable = useMemo(() => {
    return tables.find(t => t.id === selectedTableId) || null;
  }, [tables, selectedTableId]);

  const filteredTables = useMemo(() => {
    if (activeSection === 'ALL') return tables;
    return tables.filter(t => t.section === activeSection);
  }, [tables, activeSection]);

  const transferModalFilteredTables = useMemo(() => {
    if (transferSectionFilter === 'ALL') return tables;
    return tables.filter(t => t.section === transferSectionFilter);
  }, [tables, transferSectionFilter]);

  const getTableTotal = (table: Table) => {
    return table.orders
      .filter(o => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + (o.price * o.quantity), 0);
  };

  // Görsel Masa Taşıma İşlemi
  const handleExecuteTransfer = () => {
    if (!selectedTableId || !transferTargetTableId) return;

    const sourceTable = tables.find(t => t.id === selectedTableId);
    const targetTable = tables.find(t => t.id === transferTargetTableId);

    if (!sourceTable || !targetTable) return;

    setTables(prevTables => {
      return prevTables.map(t => {
        // Kaynak Masa -> Sıfırla ve Boş yap
        if (t.id === sourceTable.id) {
          return {
            ...t,
            status: 'EMPTY',
            orders: [],
            guestCount: undefined,
            openedAt: undefined
          };
        }
        // Hedef Masa -> Siparişleri aktar veya birleştir
        if (t.id === targetTable.id) {
          const isTargetOccupied = t.orders.length > 0;
          return {
            ...t,
            status: 'OCCUPIED',
            guestCount: (t.guestCount || 0) + (sourceTable.guestCount || 1),
            openedAt: t.openedAt || sourceTable.openedAt || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            orders: [...t.orders, ...sourceTable.orders]
          };
        }
        return t;
      });
    });

    const isMerge = targetTable.orders.length > 0;
    showNotification(
      isMerge 
        ? `[BİRLEŞTİRİLDİ] ${sourceTable.name} adisyonu ${targetTable.name} ile birleştirildi!`
        : `[TAŞINDI] ${sourceTable.name} başarıyla ${targetTable.name} masasına aktarıldı!`
    );

    // Modalı kapat ve seçili masayı hedef masa yap
    setIsTransferModalOpen(false);
    setSelectedTableId(targetTable.id);
    setTransferTargetTableId(null);
  };

  return (
    <div className="flex h-screen bg-[#141416] text-[#FAF7F2] font-sans select-none overflow-hidden">
      
      {/* SOL: Masalar Listesi ve Filtre */}
      <div className="flex-1 flex flex-col border-r border-[#2C2C34] bg-[#141416]">
        
        {/* Üst Bar: Bölüm Sekmeleri */}
        <div className="h-16 px-6 border-b border-[#2C2C34] flex items-center justify-between bg-[#1C1C20]">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-wider text-[#F5C877]">TAHA USTA POS</span>
            <span className="text-xs px-2.5 py-1 rounded bg-[#2C2C34] text-[#8E8E98] font-bold">MASA YÖNETİMİ</span>
          </div>

          <div className="flex bg-[#141416] p-1 rounded-xl border border-[#2C2C34] gap-1">
            {[
              { id: 'ALL', label: 'Tümü' },
              { id: 'SALON', label: '🏛️ Salon' },
              { id: 'BAHCE', label: '🌿 Bahçe' },
              { id: 'PAKET', label: '🛵 Paket' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeSection === tab.id
                    ? 'bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] shadow-lg shadow-[#F5C877]/10'
                    : 'text-[#8E8E98] hover:text-[#FAF7F2] hover:bg-[#2C2C34]/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Masa Kartları Grid */}
        <div className="flex-1 p-6 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-max">
          {filteredTables.map(table => {
            const isSelected = table.id === selectedTableId;
            const total = getTableTotal(table);

            let statusStyle = 'border-[#2C2C34] bg-[#1C1C20] hover:border-[#8E8E98]/40';
            let badgeStyle = 'bg-[#2C2C34] text-[#8E8E98]';
            let badgeText = 'BOŞ';

            if (table.status === 'OCCUPIED') {
              statusStyle = 'border-rose-600/50 bg-rose-950/20 hover:border-rose-500';
              badgeStyle = 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
              badgeText = 'DOLU';
            } else if (table.status === 'BILL_REQUESTED') {
              statusStyle = 'border-amber-500/60 bg-amber-950/20 hover:border-amber-400';
              badgeStyle = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
              badgeText = 'HESAP İSTENDİ';
            }

            if (isSelected) {
              statusStyle = 'border-[#F5C877] bg-[#F5C877]/10 ring-2 ring-[#F5C877] shadow-xl shadow-[#F5C877]/10';
            }

            return (
              <div
                key={table.id}
                onClick={() => setSelectedTableId(table.id)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between min-h-[140px] relative ${statusStyle}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#8E8E98]">{table.number}</span>
                    <h3 className="text-lg font-black text-[#FAF7F2]">{table.name}</h3>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${badgeStyle}`}>
                    {badgeText}
                  </span>
                </div>

                {table.status !== 'EMPTY' ? (
                  <div className="mt-3 pt-3 border-t border-[#2C2C34] flex items-end justify-between">
                    <div>
                      <div className="text-[11px] text-[#8E8E98]">
                        {table.orders.filter(o => o.status !== 'CANCELLED').length} Çeşit • {table.openedAt}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-[#F5C877]">
                        {total.toFixed(2)} ₺
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-[#8E8E98] font-medium flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Müsait
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Canlı Bildirim Çubuğu */}
        {notification && (
          <div className="m-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-bold flex items-center justify-between animate-fade-in">
            <span>✨ {notification}</span>
            <button onClick={() => setNotification(null)} className="text-xs underline text-emerald-300">Kapat</button>
          </div>
        )}
      </div>

      {/* SAĞ: Seçili Masa Detayı & Hızlı İşlemler */}
      <div className="w-96 border-l border-[#2C2C34] bg-[#1C1C20] flex flex-col">
        {selectedTable ? (
          <>
            {/* Masa Başlığı & Butonlar */}
            <div className="p-5 border-b border-[#2C2C34] bg-[#141416]/50">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#F5C877]">{selectedTable.section} BÖLÜMÜ</span>
                  <h2 className="text-2xl font-black text-[#FAF7F2]">{selectedTable.name}</h2>
                </div>
                
                {/* GÖRSEL MASA TAŞIMA TETİKLEME BUTONU */}
                {selectedTable.orders.length > 0 && (
                  <button
                    onClick={() => {
                      setTransferTargetTableId(null);
                      setTransferSectionFilter('ALL');
                      setIsTransferModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/40 hover:border-amber-400 text-[#F5C877] rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                  >
                    <span>🔄</span>
                    <span>Masa Taşı</span>
                  </button>
                )}
              </div>
            </div>

            {/* Adisyon Listesi */}
            <div className="flex-1 p-5 overflow-y-auto space-y-2.5">
              <div className="text-xs font-bold text-[#8E8E98] tracking-wider mb-2">ADİSYON ÜRÜNLERİ</div>
              {selectedTable.orders.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center text-[#8E8E98]">
                  <span className="text-3xl mb-2">🍽️</span>
                  <p className="text-sm font-bold">Masa Henüz Boş</p>
                  <p className="text-xs text-[#8E8E98]/70 mt-1">Sipariş eklemek için menüyü kullanın.</p>
                </div>
              ) : (
                selectedTable.orders.map(item => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[#141416] border border-[#2C2C34] flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-sm text-[#FAF7F2]">{item.name}</div>
                      <div className="text-xs text-[#8E8E98]">
                        {item.quantity} Adet × {item.price.toFixed(2)} ₺
                      </div>
                    </div>
                    <div className="font-black text-sm text-[#F5C877]">
                      {(item.quantity * item.price).toFixed(2)} ₺
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Alt Toplam & Ödeme Butonu */}
            <div className="p-5 border-t border-[#2C2C34] bg-[#141416]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-[#8E8E98]">Genel Toplam:</span>
                <span className="text-2xl font-black text-[#F5C877]">
                  {getTableTotal(selectedTable).toFixed(2)} ₺
                </span>
              </div>
              <button
                disabled={selectedTable.orders.length === 0}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                💳 Tahsilat Al (Parçalı / Alman Usulü)
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#8E8E98]">
            <span className="text-4xl mb-3">👈</span>
            <h4 className="text-base font-bold text-[#FAF7F2]">Masa Seçilmedi</h4>
            <p className="text-xs mt-1">İşlem yapmak için soldaki ızgaradan bir masa seçin.</p>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 🚀 GÖRSEL MASA TAŞIMA & BİRLEŞTİRME MODALI (POPUP) */}
      {/* ========================================================= */}
      {isTransferModalOpen && selectedTable && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-[#1C1C20] border-2 border-[#2C2C34] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            
            {/* Modal Üst Başlık */}
            <div className="p-6 border-b border-[#2C2C34] bg-[#141416] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔄</span>
                  <h2 className="text-xl font-black text-[#FAF7F2]">Görsel Masa Taşıma & Birleştirme</h2>
                </div>
                <p className="text-xs text-[#8E8E98] mt-1">
                  Taşınacak Kaynak: <span className="text-[#F5C877] font-bold">{selectedTable.name} ({selectedTable.section})</span> • Tutar: <span className="text-[#F5C877] font-bold">{getTableTotal(selectedTable).toFixed(2)} ₺</span>
                </p>
              </div>

              {/* Bölüm Filtre Butonları */}
              <div className="flex bg-[#1C1C20] p-1 rounded-xl border border-[#2C2C34] gap-1">
                {[
                  { id: 'ALL', label: 'Tümü' },
                  { id: 'SALON', label: 'Salon' },
                  { id: 'BAHCE', label: 'Bahçe' },
                  { id: 'PAKET', label: 'Paket' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setTransferSectionFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      transferSectionFilter === tab.id
                        ? 'bg-[#F5C877] text-[#141416]'
                        : 'text-[#8E8E98] hover:text-[#FAF7F2]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Masalar Izgarası (Grid Seçim Alanı) */}
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-[#141416]/60">
              {transferModalFilteredTables.map(targetTbl => {
                const isCurrent = targetTbl.id === selectedTable.id;
                const isSelected = targetTbl.id === transferTargetTableId;
                const isOccupied = targetTbl.orders.length > 0;
                const targetTotal = getTableTotal(targetTbl);

                let cardBorder = 'border-[#2C2C34] bg-[#1C1C20] hover:border-[#F5C877]/60';
                if (isCurrent) {
                  cardBorder = 'opacity-30 border-dashed border-[#2C2C34] bg-[#141416] cursor-not-allowed';
                } else if (isSelected) {
                  cardBorder = 'border-[#F5C877] bg-[#F5C877]/15 ring-2 ring-[#F5C877] shadow-xl shadow-[#F5C877]/20 scale-[1.02]';
                }

                return (
                  <div
                    key={targetTbl.id}
                    onClick={() => {
                      if (!isCurrent) setTransferTargetTableId(targetTbl.id);
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between min-h-[115px] relative ${cardBorder}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#8E8E98]">{targetTbl.number}</span>
                      {isCurrent ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">MEVCUT</span>
                      ) : isOccupied ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          DOLU ({targetTotal.toFixed(0)} ₺)
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          BOŞ
                        </span>
                      )}
                    </div>

                    <div className="my-1">
                      <h4 className="text-base font-black text-[#FAF7F2]">{targetTbl.name}</h4>
                      <p className="text-[11px] text-[#8E8E98]">{targetTbl.section}</p>
                    </div>

                    {isSelected && (
                      <div className="text-[11px] font-bold text-[#F5C877] flex items-center gap-1 mt-1">
                        <span>✨</span>
                        <span>{isOccupied ? 'BİRLEŞTİRİLECEK' : 'HEDEF SEÇİLDİ'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Alt Aksiyon Barı */}
            <div className="p-5 border-t border-[#2C2C34] bg-[#1C1C20] flex items-center justify-between">
              <div>
                {transferTargetTableId ? (
                  <div className="text-sm font-bold">
                    Seçilen Hedef: <span className="text-[#F5C877]">{tables.find(t => t.id === transferTargetTableId)?.name}</span>
                    {tables.find(t => t.id === transferTargetTableId)?.orders.length! > 0 ? (
                      <span className="ml-2 text-xs text-rose-400 font-normal">⚠️ Dolu masa seçildi, siparişler birleştirilecek.</span>
                    ) : (
                      <span className="ml-2 text-xs text-emerald-400 font-normal">✅ Boş masa, doğrudan aktarılacak.</span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-[#8E8E98]">Lütfen yukarıdaki masalardan birine tıklayarak hedef masayı seçin.</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-[#2C2C34] text-xs font-bold text-[#8E8E98] hover:text-[#FAF7F2] hover:bg-[#2C2C34]"
                >
                  Vazgeç
                </button>
                <button
                  disabled={!transferTargetTableId}
                  onClick={handleExecuteTransfer}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#F5C877] to-[#D4A351] hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed text-[#141416] font-black text-xs transition-all shadow-lg shadow-[#F5C877]/10"
                >
                  ✅ Masayı Aktar / Birleştir
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default PosView;