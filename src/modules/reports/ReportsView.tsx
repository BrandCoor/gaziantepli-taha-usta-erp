import React, { useState, useEffect } from 'react';
import { 
  BarChart2, 
  Printer, 
  Clock, 
  Coins, 
  CreditCard, 
  Building2, 
  Receipt, 
  CheckCircle2, 
  Archive, 
  Lock,
  Tag,
  Gift,
  Bike,
  FileText
} from 'lucide-react';
import { restaurantDataService, ZReport } from '../../services/restaurantDataService';

export const ReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'current_x' | 'close_z' | 'history'>('current_x');

  const [xReport, setXReport] = useState(restaurantDataService.getCurrentXReport());
  const [zHistory, setZHistory] = useState<ZReport[]>(restaurantDataService.getZReportsHistory());
  const [zNoteInput, setZNoteInput] = useState<string>('');
  const [selectedZHistoryDetail, setSelectedZHistoryDetail] = useState<ZReport | null>(null);

  const refreshReports = () => {
    setXReport(restaurantDataService.getCurrentXReport());
    setZHistory(restaurantDataService.getZReportsHistory());
  };

  useEffect(() => {
    refreshReports();
    const unsub = restaurantDataService.subscribe(refreshReports);
    return () => unsub();
  }, []);

  const formatMoney = (val: number) => {
    return (Number(val) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  const handleExecuteZReportClose = (e: React.FormEvent) => {
    e.preventDefault();

    const confirmed = confirm(
      `⚠️ GÜN SONU Z RAPORU KAPANIS ONAYI\n\n` +
      `Bugünkü Toplam Ciro: ${formatMoney(xReport.grossTotal)}\n` +
      `Kapatılan Adisyon Sayısı: ${xReport.totalOrders} Adet\n\n` +
      `Günü kapatmak ve Z Raporunu Kasa Yazıcısından basmak istiyor musunuz?`
    );

    if (!confirmed) return;

    const zReport = restaurantDataService.closeDailyZReport(zNoteInput, 'Taha Usta');
    alert(`✅ Z Raporu (#${zReport.zNo}) oluşturuldu ve Kasa Yazıcısından Z fişi basıldı!`);

    setZNoteInput('');
    setActiveTab('history');
  };

  const handlePrintZReceipt = (z: ZReport) => {
    alert(
      `🖨️ [KASA TERMAL YAZICISI (USB) - Z NO #${z.zNo}]:\n\n` +
      `Tarih: ${z.closedAt}\n` +
      `Kapatan: ${z.closedBy}\n` +
      `Net Ciro: ${formatMoney(z.netTotal)}\n\n` +
      `Termal Z Fişi Başarıyla Basıldı!`
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans text-slate-100 bg-slate-900 min-h-screen">
      
      {/* ÜST BAŞLIK VE SEKME BUTONLARI */}
      <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black text-2xl shadow-lg">
            <BarChart2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Gün Sonu Z Raporu & Kasa Dökümleri</span>
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-[10px] font-black uppercase">TÜM ÖDEME KANALLARI</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Nakit, POS, Cari isim dökümü, Sodexo, Multinet, Ticket, Setcard ve Online platformlar.</p>
          </div>
        </div>

        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('current_x')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'current_x' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Gün İçi Durum (X Raporu)</span>
          </button>

          <button
            onClick={() => setActiveTab('close_z')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'close_z' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Gün Sonu Al (Z Raporu Kapat)</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'history' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Geçmiş Z Raporları ({zHistory.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. ANLIK GÜN İÇİ X RAPORU (TÜM ÖDEME DETAYLARI) */}
      {/* ========================================================================= */}
      {activeTab === 'current_x' && (
        <div className="space-y-6">
          
          {/* 4 Ana Metrik Kartı */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-lg">
              <div className="text-[10px] font-black uppercase text-slate-400">Bugünkü Brüt Satış</div>
              <div className="text-2xl font-black text-amber-400 font-mono mt-1">{formatMoney(xReport.grossTotal)}</div>
              <div className="text-[11px] text-slate-500 mt-1">{xReport.totalOrders} Adet Kapatılan Adisyon</div>
            </div>

            <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-lg">
              <div className="text-[10px] font-black uppercase text-slate-400">Nakit Kasa</div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">{formatMoney(xReport.paymentBreakdown['Nakit'] || 0)}</div>
              <div className="text-[11px] text-slate-500 mt-1">Fiziki nakit toplamı</div>
            </div>

            <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-lg">
              <div className="text-[10px] font-black uppercase text-slate-400">Kredi Kartı / POS</div>
              <div className="text-2xl font-black text-sky-400 font-mono mt-1">{formatMoney(xReport.paymentBreakdown['Kredi Kartı'] || 0)}</div>
              <div className="text-[11px] text-slate-500 mt-1">Banka POS toplamı</div>
            </div>

            <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-lg">
              <div className="text-[10px] font-black uppercase text-slate-400">Cari (Veresiye) Toplamı</div>
              <div className="text-2xl font-black text-orange-400 font-mono mt-1">
                {formatMoney(xReport.paymentBreakdown['Cari (Veresiye)'] || 0)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">{Object.keys(xReport.cariDetails || {}).length} Müşteriye Yazıldı</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Sol: Genel Ödeme Dağılımı */}
            <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>Ödeme Kanalları Dağılımı</span>
              </h3>

              <div className="space-y-2">
                {Object.keys(xReport.paymentBreakdown).length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-900 rounded-2xl">
                    Bugün henüz hesap kapatılmadı.
                  </div>
                ) : (
                  Object.entries(xReport.paymentBreakdown).map(([type, amount]) => (
                    <div key={type} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300">{type}</span>
                      <span className="font-mono font-black text-emerald-400">{formatMoney(amount)}</span>
                    </div>
                  ))
                )}
              </div>

              {/* İskonto & İkram */}
              <div className="pt-2 border-t border-slate-800 grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-500">İndirimler</div>
                  <div className="font-bold text-amber-400 mt-0.5">{formatMoney(xReport.discountTotal)}</div>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-500">İkramlar</div>
                  <div className="font-bold text-rose-400 mt-0.5">{formatMoney(xReport.giftTotal)}</div>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-500">İptaller</div>
                  <div className="font-bold text-slate-400 mt-0.5">{formatMoney(xReport.cancelTotal)}</div>
                </div>
              </div>
            </div>

            {/* Orta: CARİ MÜŞTERİ BAZINDA DÖKÜM (Kime Ne Kadar Yazıldı) */}
            <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Building2 className="w-4 h-4 text-orange-400" />
                <span>Cari (Veresiye) Müşteri Dökümü</span>
              </h3>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {Object.keys(xReport.cariDetails || {}).length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-900 rounded-2xl">
                    Bugün cariye borç yazılmadı.
                  </div>
                ) : (
                  Object.entries(xReport.cariDetails || {}).map(([custName, amount]) => (
                    <div key={custName} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                      <div>
                        <div className="font-black text-white">{custName}</div>
                        <div className="text-[10px] text-orange-400 font-medium">Veresiye Borç</div>
                      </div>
                      <span className="font-mono font-black text-rose-400">+{formatMoney(amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Sağ: Ürün Satış Adetleri */}
            <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Ürün Satış Adetleri</span>
              </h3>

              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/40">
                {Object.keys(xReport.productSales).length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-900 rounded-2xl">
                    Satış kaydı yok.
                  </div>
                ) : (
                  Object.entries(xReport.productSales).map(([pName, pStat]) => (
                    <div key={pName} className="pt-2 flex items-center justify-between text-xs">
                      <span className="font-bold text-white truncate max-w-[150px]">{pName}</span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-800 text-amber-400 rounded-md font-mono font-bold">
                          {pStat.quantity} Adet
                        </span>
                        <span className="font-mono font-black text-slate-300 w-20 text-right">
                          {formatMoney(pStat.total)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. GÜN SONU Z RAPORU KAPATMA */}
      {/* ========================================================================= */}
      {activeTab === 'close_z' && (
        <div className="max-w-2xl mx-auto bg-slate-950 rounded-3xl p-8 border border-slate-800 shadow-2xl space-y-6">
          <div className="text-center border-b border-slate-800 pb-4">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-3xl flex items-center justify-center mx-auto mb-3 text-2xl font-black">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white">Gün Sonu Z Raporu Kapanışı</h2>
            <p className="text-xs text-slate-400 mt-1">Günü kapatıp resmi Z Raporunu Kasa Yazıcısından basmak için aşağıdaki butona basınız.</p>
          </div>

          <form onSubmit={handleExecuteZReportClose} className="space-y-5">
            <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-3 text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>Bugünkü Net Satış Cirosu:</span>
                <strong className="text-amber-400 font-mono text-base">{formatMoney(xReport.netTotal)}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Nakit Kasa Tutarı:</span>
                <strong className="text-emerald-400 font-mono text-base">{formatMoney(xReport.paymentBreakdown['Nakit'] || 0)}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Kredi Kartı / POS Toplamı:</span>
                <strong className="text-sky-400 font-mono text-base">{formatMoney(xReport.paymentBreakdown['Kredi Kartı'] || 0)}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Cari (Veresiye) Toplamı:</span>
                <strong className="text-orange-400 font-mono text-base">{formatMoney(xReport.paymentBreakdown['Cari (Veresiye)'] || 0)}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Kapatılan Adisyon Sayısı:</span>
                <strong className="text-white font-mono">{xReport.totalOrders} Adet Masa</strong>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300">Kapanış Notu (İsteğe Bağlı)</label>
              <input
                type="text"
                value={zNoteInput}
                onChange={(e) => setZNoteInput(e.target.value)}
                placeholder="Örn: Gün sonu sorunsuz tamamlandı..."
                className="w-full mt-1.5 p-3 bg-slate-900 border border-slate-700 rounded-2xl text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-transform transform active:scale-98"
            >
              <Printer className="w-5 h-5" />
              <span>Günü Kapat & Z Raporu Fişini Bas</span>
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. GEÇMİŞ Z RAPORLARI ARŞİVİ */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-white">Geçmiş Gün Sonu Z Raporları Arşivi</h2>
              <p className="text-xs text-slate-500">Tüm eski günlerin Z dökümlerini inceleyebilir ve tekrar fiş yazdırabilirsiniz.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zHistory.length === 0 ? (
              <div className="col-span-3 p-12 text-center text-xs text-slate-500 bg-slate-950 rounded-3xl border border-slate-800">
                Henüz kapatılmış bir Z Raporu bulunmuyor.
              </div>
            ) : (
              [...zHistory].reverse().map((z) => (
                <div key={z.id} className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-lg flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl font-mono font-black text-xs">
                        Z NO: #{String(z.zNo).padStart(4, '0')}
                      </span>
                      <span className="text-[11px] text-slate-500">{z.closedAt.split(' ')[0]}</span>
                    </div>

                    <div className="text-2xl font-black text-white font-mono mt-1">
                      {formatMoney(z.netTotal)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Kapatan: {z.closedBy} • {z.totalOrders} Adisyon</div>

                    <div className="mt-3 p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-1 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Nakit:</span>
                        <strong className="text-emerald-400 font-mono">{formatMoney(z.paymentBreakdown['Nakit'] || 0)}</strong>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Kredi Kartı:</span>
                        <strong className="text-sky-400 font-mono">{formatMoney(z.paymentBreakdown['Kredi Kartı'] || 0)}</strong>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Cari:</span>
                        <strong className="text-orange-400 font-mono">{formatMoney(z.paymentBreakdown['Cari (Veresiye)'] || 0)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedZHistoryDetail(z)}
                      className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      İncele
                    </button>
                    <button
                      onClick={() => handlePrintZReceipt(z)}
                      className="p-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 rounded-xl cursor-pointer"
                      title="Z Fişini Tekrar Bas"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Z RAPORU DETAY POPUP */}
      {selectedZHistoryDetail && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-800 space-y-4 text-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white">Z Raporu Detayı (#{selectedZHistoryDetail.zNo})</h3>
                <p className="text-xs text-slate-400">{selectedZHistoryDetail.closedAt}</p>
              </div>
              <button onClick={() => setSelectedZHistoryDetail(null)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 text-xs pr-1">
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-400">Net Ciro:</span><strong className="text-amber-400 font-mono text-sm">{formatMoney(selectedZHistoryDetail.netTotal)}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">Nakit:</span><strong className="text-emerald-400 font-mono">{formatMoney(selectedZHistoryDetail.paymentBreakdown['Nakit'] || 0)}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">Kredi Kartı:</span><strong className="text-sky-400 font-mono">{formatMoney(selectedZHistoryDetail.paymentBreakdown['Kredi Kartı'] || 0)}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">Cari:</span><strong className="text-orange-400 font-mono">{formatMoney(selectedZHistoryDetail.paymentBreakdown['Cari (Veresiye)'] || 0)}</strong></div>
              </div>

              {/* Cari Müşteri Listesi */}
              {Object.keys(selectedZHistoryDetail.cariDetails || {}).length > 0 && (
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <div className="font-bold text-orange-400 mb-1">Cariye Yazılan Müşteriler:</div>
                  {Object.entries(selectedZHistoryDetail.cariDetails || {}).map(([cName, cAmt]) => (
                    <div key={cName} className="flex justify-between py-0.5">
                      <span>• {cName}</span>
                      <strong className="font-mono text-rose-400">+{formatMoney(cAmt)}</strong>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <div className="font-bold text-slate-300 mb-1">Satılan Ürünler:</div>
                <div className="space-y-1 divide-y divide-slate-800/40">
                  {Object.entries(selectedZHistoryDetail.productSales || {}).map(([name, stat]) => (
                    <div key={name} className="pt-1 flex justify-between">
                      <span>{name} ({(stat as any).quantity}x)</span>
                      <strong className="font-mono">{formatMoney((stat as any).total)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button onClick={() => setSelectedZHistoryDetail(null)} className="px-4 py-2 bg-slate-800 rounded-xl text-xs font-bold">Kapat</button>
              <button onClick={() => handlePrintZReceipt(selectedZHistoryDetail)} className="px-5 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5">
                <Printer className="w-4 h-4" />
                <span>Yazıcıdan Bas</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
