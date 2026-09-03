import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart2, 
  Printer, 
  Clock, 
  Coins, 
  Receipt, 
  Archive, 
  Lock, 
  Filter, 
  Calendar, 
  UserCheck, 
  MapPin, 
  TrendingDown, 
  Percent, 
  Download, 
  Search, 
  Wallet
} from 'lucide-react';
import { 
  restaurantDataService, 
  ZReport, 
  ReportFilterOptions,
  DetailedReportResult 
} from '../../services/restaurantDataService';
import ExcelJS from 'exceljs';
import { notify } from '../../services/notificationService';

export const ReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'current_x' | 'filtered_analysis' | 'close_z' | 'history'>('current_x');

  const [xReport, setXReport] = useState<any>(restaurantDataService.getCurrentXReport());
  const [zHistory, setZHistory] = useState<ZReport[]>(restaurantDataService.getZReportsHistory() || []);
  const [zNoteInput, setZNoteInput] = useState<string>('');
  const [selectedZHistoryDetail, setSelectedZHistoryDetail] = useState<ZReport | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom'>('today');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedWaiter, setSelectedWaiter] = useState<string>('ALL');
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>('ALL');
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  
  const [filteredReportData, setFilteredReportData] = useState<DetailedReportResult>(() => {
    try {
      return restaurantDataService.getFilteredReport({ startDate: todayStr, endDate: todayStr });
    } catch {
      return {
        grossTotal: 0,
        netTotal: 0,
        discountTotal: 0,
        giftTotal: 0,
        cancelTotal: 0,
        totalOrders: 0,
        avgOrderAmount: 0,
        paymentBreakdown: {},
        sectionBreakdown: {},
        waiterBreakdown: {},
        vatBreakdown: [{ rate: 10, baseAmount: 0, vatAmount: 0, total: 0 }],
        productSales: {},
        totalExpenses: 0,
        supplierInvoicesTotal: 0,
        supplierPaymentsTotal: 0,
        netCashFlow: 0
      };
    }
  });

  const refreshReports = () => {
    try {
      setXReport(restaurantDataService.getCurrentXReport() || {});
      setZHistory(restaurantDataService.getZReportsHistory() || []);
      applyFilters();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refreshReports();
    const unsub = restaurantDataService.subscribe(refreshReports);
    return () => unsub();
  }, []);

  useEffect(() => {
    const now = new Date();
    if (datePreset === 'today') {
      const d = now.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (datePreset === 'yesterday') {
      const y = new Date(now.setDate(now.getDate() - 1)).toISOString().split('T')[0];
      setStartDate(y);
      setEndDate(y);
    } else if (datePreset === 'this_week') {
      const first = new Date(now.setDate(now.getDate() - now.getDay() + 1)).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(today);
    } else if (datePreset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(today);
    }
  }, [datePreset]);

  const applyFilters = () => {
    try {
      const filters: ReportFilterOptions = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sectionName: selectedSection !== 'ALL' ? selectedSection : undefined,
        waiterName: selectedWaiter !== 'ALL' ? selectedWaiter : undefined,
        paymentType: selectedPaymentType !== 'ALL' ? selectedPaymentType : undefined,
      };
      const result = restaurantDataService.getFilteredReport(filters);
      setFilteredReportData(result);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    applyFilters();
  }, [startDate, endDate, selectedSection, selectedWaiter, selectedPaymentType]);

  const formatMoney = (val: any) => {
    return (Number(val) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  // Z Raporu Kapatma
  const handleExecuteZReportClose = (e: React.FormEvent) => {
    e.preventDefault();

    notify.confirm({
      title: 'Gün Sonu Z Raporu Kapanış Onayı',
      message: `Bugünkü Net Satış: ${formatMoney(xReport?.netTotal || 0)}\nİşletme Giderleri: ${formatMoney(xReport?.totalExpenses || 0)}\nKasada Kalan Net Nakit: ${formatMoney(xReport?.netCashInRegister || 0)}\n\nGünü kapatmak ve Z Raporunu Kasa Yazıcısından basmak istiyor musunuz?`,
      confirmText: 'Evet, Günü Kapat & Fiş Bas',
      type: 'warning',
      onConfirm: () => {
        const zReport = restaurantDataService.closeDailyZReport(zNoteInput, 'Taha Usta');
        notify.success('Z Raporu Alındı', `Z No #${zReport.zNo} oluşturuldu ve Kasa Yazıcısına gönderildi.`);
        setZNoteInput('');
        setActiveTab('history');
      }
    });
  };

  const handlePrintZReceipt = (z: ZReport) => {
    notify.success('İşlem Tamamlandı', 
      `🖨️ [AFANDA 892E KASA YAZICISI (80mm) - RESMİ Z FİŞİ]\n` +
      `========================================\n` +
      `Z NO       : #${String(z.zNo).padStart(4, '0')}\n` +
      `KAPANIS    : ${z.closedAt}\n` +
      `KAPATAN    : ${z.closedBy}\n` +
      `ADISYON    : ${z.totalOrders} Adet\n` +
      `----------------------------------------\n` +
      `BRUT SATIS : ${formatMoney(z.grossTotal)}\n` +
      `INDIRIMLER : -${formatMoney(z.discountTotal)}\n` +
      `NET CIRO   : ${formatMoney(z.netTotal)}\n` +
      `GIDERLER   : -${formatMoney(z.totalExpenses || 0)}\n` +
      `TOPTANCI   : -${formatMoney(z.supplierPaymentsTotal || 0)}\n` +
      `NET NAKIT  : ${formatMoney(z.netCashInRegister || 0)}\n` +
      `========================================\n` +
      `Termal fiş kasa yazıcısına başarıyla gönderildi!`
    );
  };

  const handlePrintFilteredReport = () => {
    notify.success('İşlem Tamamlandı', 
      `🖨️ [AFANDA 892E TERMAL YAZICI - ÖZEL DÖNEM ANALİZİ]\n` +
      `========================================\n` +
      `TARIH ARALIK: ${startDate} / ${endDate}\n` +
      `BOLGE       : ${selectedSection === 'ALL' ? 'TÜM BÖLGELER' : selectedSection}\n` +
      `PERSONEL    : ${selectedWaiter === 'ALL' ? 'TÜMÜ' : selectedWaiter}\n` +
      `ODEME TIPI  : ${selectedPaymentType === 'ALL' ? 'TÜMÜ' : selectedPaymentType}\n` +
      `----------------------------------------\n` +
      `TOPLAM ADISYON : ${filteredReportData?.totalOrders || 0} Adet\n` +
      `NET SATIS CIRO : ${formatMoney(filteredReportData?.netTotal || 0)}\n` +
      `TOPLAM GIDER   : -${formatMoney(filteredReportData?.totalExpenses || 0)}\n` +
      `TOPTANCI ODEME : -${formatMoney(filteredReportData?.supplierPaymentsTotal || 0)}\n` +
      `NET NAKIT AKISI: ${formatMoney(filteredReportData?.netCashFlow || 0)}\n` +
      `========================================\n` +
      `Fiş başarıyla yazdırıldı!`
    );
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Mali Rapor & Satis Detayi');

    worksheet.columns = [
      { header: 'Kategori / Tip', key: 'category', width: 25 },
      { header: 'Detay / Isim', key: 'name', width: 30 },
      { header: 'Adet / Islem', key: 'count', width: 15 },
      { header: 'Tutar (TL)', key: 'amount', width: 20 },
    ];

    worksheet.addRow(['GENEL SATIS OZETI', 'Net Satis Cirosu', `${filteredReportData?.totalOrders || 0} Adisyon`, filteredReportData?.netTotal || 0]);
    worksheet.addRow(['GENEL SATIS OZETI', 'Brut Satis Tutari', '-', filteredReportData?.grossTotal || 0]);
    worksheet.addRow(['GENEL SATIS OZETI', 'Indirim / Iskonto', '-', filteredReportData?.discountTotal || 0]);
    worksheet.addRow(['GENEL SATIS OZETI', 'Ikram Tutari', '-', filteredReportData?.giftTotal || 0]);
    worksheet.addRow(['GENEL SATIS OZETI', 'Iptal Edilenler', '-', filteredReportData?.cancelTotal || 0]);
    worksheet.addRow([]);

    worksheet.addRow(['--- GIDERLER VE TOPTANCI AKISI ---', '', '', '']);
    worksheet.addRow(['Mali Cikis', 'Isletme Giderleri Toplami', '-', filteredReportData?.totalExpenses || 0]);
    worksheet.addRow(['Mali Cikis', 'Toptancilara Odenen Tutar', '-', filteredReportData?.supplierPaymentsTotal || 0]);
    worksheet.addRow(['Mali Giris', 'Toptanci Alis Faturalari (Giren Mal)', '-', filteredReportData?.supplierInvoicesTotal || 0]);
    worksheet.addRow(['Net Bakiye', 'Donem Net Nakit Akisi', '-', filteredReportData?.netCashFlow || 0]);
    worksheet.addRow([]);

    worksheet.addRow(['--- ODEME DAGILIMI ---', '', '', '']);
    Object.entries(filteredReportData?.paymentBreakdown || {}).forEach(([type, amount]) => {
      worksheet.addRow(['Odeme Tipi', type, '-', amount]);
    });
    worksheet.addRow([]);

    worksheet.addRow(['--- URUN BAZLI SATISLAR ---', '', '', '']);
    Object.entries(filteredReportData?.productSales || {}).forEach(([pName, pStat]: [string, any]) => {
      worksheet.addRow(['Urun Satisi', pName, pStat?.quantity || 1, pStat?.total || 0]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mali_Rapor_${startDate}_${endDate}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredProductsList = useMemo(() => {
    return Object.entries(filteredReportData?.productSales || {}).filter(([name]) => 
      name.toLowerCase().includes(productSearchQuery.toLowerCase())
    );
  }, [filteredReportData, productSearchQuery]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans text-slate-100 bg-[#141416] min-h-screen">
      
      {/* ÜST BAŞLIK VE SEKME BUTONLARI */}
      <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F5C877]/10 border border-[#F5C877]/30 text-[#F5C877] flex items-center justify-center font-black text-2xl shadow-lg">
            <BarChart2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Mali Raporlama & Z Raporu Merkezi</span>
              <span className="px-2.5 py-0.5 bg-[#F5C877]/20 text-[#F5C877] border border-[#F5C877]/30 rounded-full text-[10px] font-black uppercase">DENETİM</span>
            </h1>
            <p className="text-xs text-[#8E8E98] font-medium">Satış ciroları, giderler, toptancı alışları ve kasa nakit mutabakatı.</p>
          </div>
        </div>

        <div className="flex bg-[#141416] p-1.5 rounded-2xl border border-[#2C2C34] gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('current_x')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'current_x' ? 'bg-[#F5C877] text-slate-950 shadow-md' : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Gün İçi (X Raporu)</span>
          </button>

          <button
            onClick={() => setActiveTab('filtered_analysis')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'filtered_analysis' ? 'bg-[#F5C877] text-slate-950 shadow-md' : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Detaylı Filtreli Rapor</span>
          </button>

          <button
            onClick={() => setActiveTab('close_z')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'close_z' ? 'bg-[#F5C877] text-slate-950 shadow-md' : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Gün Sonu Al (Z Raporu)</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'history' ? 'bg-[#F5C877] text-slate-950 shadow-md' : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Z Arşivi ({(zHistory || []).length})</span>
          </button>
        </div>
      </div>

      {/* 1. GÜN İÇİ X RAPORU */}
      {activeTab === 'current_x' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg">
              <div className="text-[10px] font-black uppercase text-[#8E8E98]">Gün İçi Brüt Satış</div>
              <div className="text-2xl font-black text-[#F5C877] font-mono mt-1">{formatMoney(xReport?.grossTotal || 0)}</div>
              <div className="text-[11px] text-[#8E8E98] mt-1">{xReport?.totalOrders || 0} Adet Kapatılan Adisyon</div>
            </div>

            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg">
              <div className="text-[10px] font-black uppercase text-[#8E8E98]">Nakit Satış Geliri</div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">{formatMoney(xReport?.paymentBreakdown?.['Nakit'] || 0)}</div>
              <div className="text-[11px] text-[#8E8E98] mt-1">Masalardan alınan nakit</div>
            </div>

            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg">
              <div className="text-[10px] font-black uppercase text-[#8E8E98]">İşletme Giderleri (-)</div>
              <div className="text-2xl font-black text-rose-400 font-mono mt-1">-{formatMoney(xReport?.totalExpenses || 0)}</div>
              <div className="text-[11px] text-rose-300 mt-1">Nakit Çıkan: {formatMoney(xReport?.cashExpenses || 0)}</div>
            </div>

            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg">
              <div className="text-[10px] font-black uppercase text-[#8E8E98]">Toptancı Ödemeleri (-)</div>
              <div className="text-2xl font-black text-rose-400 font-mono mt-1">-{formatMoney(xReport?.supplierPaymentsTotal || 0)}</div>
              <div className="text-[11px] text-rose-300 mt-1">Nakit Ödenen: {formatMoney(xReport?.supplierCashPayments || 0)}</div>
            </div>

            <div className="bg-gradient-to-br from-[#1C1C20] to-[#24242A] p-5 rounded-3xl border-2 border-emerald-500/50 shadow-xl">
              <div className="text-[10px] font-black uppercase text-emerald-400 flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5" /> Kasada Kalan Net Nakit
              </div>
              <div className={`text-2xl font-black font-mono mt-1 ${(xReport?.netCashInRegister || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400 animate-pulse'}`}>
                {formatMoney(xReport?.netCashInRegister || 0)}
              </div>
              <div className="text-[10px] text-[#8E8E98] mt-1">Nakit Satış - Gider - Toptancı</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#2C2C34] pb-3">
                <Coins className="w-4 h-4 text-[#F5C877]" />
                <span>Masa Tahsilat Dağılımı</span>
              </h3>

              <div className="space-y-2">
                {Object.keys(xReport?.paymentBreakdown || {}).length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#8E8E98] bg-[#141416] rounded-2xl">
                    Bugün henüz hesap kapatılmadı.
                  </div>
                ) : (
                  Object.entries(xReport?.paymentBreakdown || {}).map(([type, amount]) => (
                    <div key={type} className="p-3 bg-[#141416] border border-[#2C2C34] rounded-2xl flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300">{type}</span>
                      <span className="font-mono font-black text-emerald-400">{formatMoney(amount)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-[#2C2C34] grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 bg-[#141416] rounded-xl border border-[#2C2C34]">
                  <div className="text-[10px] text-[#8E8E98]">İndirimler</div>
                  <div className="font-bold text-[#F5C877] mt-0.5">{formatMoney(xReport?.discountTotal || 0)}</div>
                </div>
                <div className="p-2.5 bg-[#141416] rounded-xl border border-[#2C2C34]">
                  <div className="text-[10px] text-[#8E8E98]">İkramlar</div>
                  <div className="font-bold text-rose-400 mt-0.5">{formatMoney(xReport?.giftTotal || 0)}</div>
                </div>
                <div className="p-2.5 bg-[#141416] rounded-xl border border-[#2C2C34]">
                  <div className="text-[10px] text-[#8E8E98]">İptaller</div>
                  <div className="font-bold text-[#8E8E98] mt-0.5">{formatMoney(xReport?.cancelTotal || 0)}</div>
                </div>
              </div>
            </div>

            <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#2C2C34] pb-3">
                <TrendingDown className="w-4 h-4 text-rose-400" />
                <span>Gider & Toptancı Mali Akışı</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#2C2C34] flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white">İşletme Giderleri Toplamı</div>
                    <div className="text-[10px] text-[#8E8E98]">Kira, faturalar ve sarf</div>
                  </div>
                  <span className="font-mono font-black text-rose-400">-{formatMoney(xReport?.totalExpenses || 0)}</span>
                </div>

                <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#2C2C34] flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white">Toptancı Alış Faturaları</div>
                    <div className="text-[10px] text-[#8E8E98]">Giren hammadde (Borçlanma)</div>
                  </div>
                  <span className="font-mono font-black text-[#F5C877]">+{formatMoney(xReport?.supplierInvoicesTotal || 0)}</span>
                </div>

                <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#2C2C34] flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white">Toptancı Ödemeleri</div>
                    <div className="text-[10px] text-[#8E8E98]">Tedarikçiye ödenen tutar</div>
                  </div>
                  <span className="font-mono font-black text-rose-400">-{formatMoney(xReport?.supplierPaymentsTotal || 0)}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#2C2C34] pb-3">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Ürün Satış Adetleri</span>
              </h3>

              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/40">
                {Object.keys(xReport?.productSales || {}).length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#8E8E98] bg-[#141416] rounded-2xl">
                    Satış kaydı yok.
                  </div>
                ) : (
                  Object.entries(xReport?.productSales || {}).map(([pName, pStat]: [string, any]) => (
                    <div key={pName} className="pt-2 flex items-center justify-between text-xs">
                      <span className="font-bold text-white truncate max-w-[150px]">{pName}</span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-800 text-[#F5C877] rounded-md font-mono font-bold">
                          {pStat?.quantity || 1} Adet
                        </span>
                        <span className="font-mono font-black text-[#E4E4E8] w-20 text-right">
                          {formatMoney(pStat?.total || 0)}
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

      {/* 2. DETAYLI FİLTRELİ RAPOR */}
      {activeTab === 'filtered_analysis' && (
        <div className="space-y-6">
          <div className="bg-[#1C1C20] p-6 rounded-3xl border border-[#2C2C34] shadow-2xl space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#2C2C34] pb-4">
              <div className="flex items-center gap-2.5">
                <Filter className="w-5 h-5 text-[#F5C877]" />
                <h2 className="text-base font-black text-white">Özel Dönem ve Kriter Filtreleme</h2>
              </div>

              <div className="flex bg-[#141416] p-1 rounded-xl border border-[#2C2C34] gap-1">
                <button onClick={() => setDatePreset('today')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${datePreset === 'today' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#8E8E98]'}`}>Bugün</button>
                <button onClick={() => setDatePreset('yesterday')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${datePreset === 'yesterday' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#8E8E98]'}`}>Dün</button>
                <button onClick={() => setDatePreset('this_week')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${datePreset === 'this_week' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#8E8E98]'}`}>Bu Hafta</button>
                <button onClick={() => setDatePreset('this_month')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${datePreset === 'this_month' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#8E8E98]'}`}>Bu Ay</button>
                <button onClick={() => setDatePreset('custom')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${datePreset === 'custom' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#8E8E98]'}`}>Özel</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
              <div>
                <label className="text-[#8E8E98] font-bold block mb-1.5">Başlangıç Tarihi</label>
                <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDatePreset('custom'); }} className="w-full p-2.5 bg-[#141416] border border-[#2C2C34] rounded-xl text-white font-medium focus:outline-none" />
              </div>

              <div>
                <label className="text-[#8E8E98] font-bold block mb-1.5">Bitiş Tarihi</label>
                <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDatePreset('custom'); }} className="w-full p-2.5 bg-[#141416] border border-[#2C2C34] rounded-xl text-white font-medium focus:outline-none" />
              </div>

              <div>
                <label className="text-[#8E8E98] font-bold block mb-1.5">Bölge Seçimi</label>
                <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} className="w-full p-2.5 bg-[#141416] border border-[#2C2C34] rounded-xl text-white font-medium focus:outline-none">
                  <option value="ALL">Tüm Bölgeler</option>
                  <option value="Salon">Salon</option>
                  <option value="Bahçe">Bahçe</option>
                  <option value="Paket Servis">Paket Servis</option>
                </select>
              </div>

              <div>
                <label className="text-[#8E8E98] font-bold block mb-1.5">Garson / Kasiyer</label>
                <select value={selectedWaiter} onChange={(e) => setSelectedWaiter(e.target.value)} className="w-full p-2.5 bg-[#141416] border border-[#2C2C34] rounded-xl text-white font-medium focus:outline-none">
                  <option value="ALL">Tüm Personel</option>
                  <option value="Taha Usta">Taha Usta</option>
                  <option value="Ahmet Garson">Ahmet Garson</option>
                  <option value="İbrahim">İbrahim</option>
                </select>
              </div>

              <div>
                <label className="text-[#8E8E98] font-bold block mb-1.5">Ödeme Tipi</label>
                <select value={selectedPaymentType} onChange={(e) => setSelectedPaymentType(e.target.value)} className="w-full p-2.5 bg-[#141416] border border-[#2C2C34] rounded-xl text-white font-medium focus:outline-none">
                  <option value="ALL">Tüm Ödeme Yöntemleri</option>
                  <option value="Nakit">Nakit</option>
                  <option value="Kredi Kartı">Kredi Kartı</option>
                  <option value="Cari">Cari (Veresiye)</option>
                  <option value="Sodexo">Sodexo</option>
                  <option value="Multinet">Multinet</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#2C2C34]">
              <div className="text-xs text-[#8E8E98] font-medium">
                Bulunan: <strong className="text-[#F5C877]">{filteredReportData?.totalOrders || 0} Adet Kapatılan Adisyon</strong>
              </div>

              <div className="flex gap-2">
                <button onClick={exportToExcel} className="px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer">
                  <Download className="w-4 h-4" />
                  <span>Excel İndir (.xlsx)</span>
                </button>

                <button onClick={handlePrintFilteredReport} className="px-4 py-2.5 bg-[#F5C877] hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-lg">
                  <Printer className="w-4 h-4" />
                  <span>Termal Fiş Bas (Afanda 892E)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg">
              <div className="text-[10px] font-black uppercase text-[#8E8E98]">Net Satış Cirosu</div>
              <div className="text-2xl font-black text-[#F5C877] font-mono mt-1">{formatMoney(filteredReportData?.netTotal || 0)}</div>
              <div className="text-[10px] text-[#8E8E98] mt-1">{filteredReportData?.totalOrders || 0} Adisyon Kapatıldı</div>
            </div>

            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg">
              <div className="text-[10px] font-black uppercase text-[#8E8E98]">Dönem Giderleri (-)</div>
              <div className="text-2xl font-black text-rose-400 font-mono mt-1">-{formatMoney(filteredReportData?.totalExpenses || 0)}</div>
              <div className="text-[10px] text-rose-300 mt-1">İşletme harcamaları</div>
            </div>

            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg">
              <div className="text-[10px] font-black uppercase text-[#8E8E98]">Toptancı Ödemeleri (-)</div>
              <div className="text-2xl font-black text-rose-400 font-mono mt-1">-{formatMoney(filteredReportData?.supplierPaymentsTotal || 0)}</div>
              <div className="text-[10px] text-rose-300 mt-1">Tedarikçiye ödenen</div>
            </div>

            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg">
              <div className="text-[10px] font-black uppercase text-[#8E8E98]">Toptancı Alışları (+)</div>
              <div className="text-2xl font-black text-amber-300 font-mono mt-1">+{formatMoney(filteredReportData?.supplierInvoicesTotal || 0)}</div>
              <div className="text-[10px] text-[#8E8E98] mt-1">Giren alış faturaları</div>
            </div>

            <div className="bg-gradient-to-br from-[#1C1C20] to-[#24242A] p-5 rounded-3xl border-2 border-emerald-500/50 shadow-xl">
              <div className="text-[10px] font-black uppercase text-emerald-400">Net Nakit Akışı</div>
              <div className={`text-2xl font-black font-mono mt-1 ${(filteredReportData?.netCashFlow || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatMoney(filteredReportData?.netCashFlow || 0)}
              </div>
              <div className="text-[10px] text-[#8E8E98] mt-1">Satış - Gider - Toptancı</div>
            </div>
          </div>
        </div>
      )}

      {/* 3. GÜN SONU Z RAPORU KAPATMA */}
      {activeTab === 'close_z' && (
        <div className="max-w-2xl mx-auto bg-[#1C1C20] rounded-3xl p-8 border border-[#2C2C34] shadow-2xl space-y-6">
          <div className="text-center border-b border-[#2C2C34] pb-4">
            <div className="w-16 h-16 bg-[#F5C877]/10 border border-[#F5C877]/30 text-[#F5C877] rounded-3xl flex items-center justify-center mx-auto mb-3 text-2xl font-black">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white">Resmi Gün Sonu Z Raporu Kapanışı</h2>
            <p className="text-xs text-[#8E8E98] mt-1">Günü kapatıp resmi Z Raporunu Afanda 892E Kasa Yazıcısından basmak için aşağıdaki butona basınız.</p>
          </div>

          <form onSubmit={handleExecuteZReportClose} className="space-y-5">
            <div className="p-5 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-3 text-xs">
              <div className="flex justify-between items-center text-[#8E8E98]">
                <span>Bugünkü Net Satış Cirosu:</span>
                <strong className="text-[#F5C877] font-mono text-base">{formatMoney(xReport?.netTotal || 0)}</strong>
              </div>
              <div className="flex justify-between items-center text-[#8E8E98]">
                <span>İşletme Giderleri Toplamı:</span>
                <strong className="text-rose-400 font-mono text-base">-{formatMoney(xReport?.totalExpenses || 0)}</strong>
              </div>
              <div className="flex justify-between items-center text-[#8E8E98]">
                <span>Toptancı Ödemeleri Toplamı:</span>
                <strong className="text-rose-400 font-mono text-base">-{formatMoney(xReport?.supplierPaymentsTotal || 0)}</strong>
              </div>
              <div className="h-px bg-[#2C2C34]"></div>
              <div className="flex justify-between items-center text-emerald-400">
                <span className="font-bold">Kasada Kalan Net Nakit:</span>
                <strong className="font-mono text-lg font-black">{formatMoney(xReport?.netCashInRegister || 0)}</strong>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#8E8E98]">Kapanış Notu (İsteğe Bağlı)</label>
              <input
                type="text"
                value={zNoteInput}
                onChange={(e) => setZNoteInput(e.target.value)}
                placeholder="Örn: Gün sonu sorunsuz tamamlandı..."
                className="w-full mt-1.5 p-3.5 bg-[#141416] border border-[#2C2C34] rounded-2xl text-xs text-white focus:outline-none focus:border-[#F5C877]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-[#F5C877] via-orange-500 to-amber-500 hover:from-amber-600 text-slate-950 font-black text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-98"
            >
              <Printer className="w-5 h-5" />
              <span>Günü Kapat & Resmi Z Fişini Yazdır</span>
            </button>
          </form>
        </div>
      )}

      {/* 4. GEÇMİŞ Z RAPORLARI ARŞİVİ */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(zHistory || []).length === 0 ? (
              <div className="col-span-3 p-12 text-center text-xs text-[#8E8E98] bg-[#1C1C20] rounded-3xl border border-[#2C2C34]">
                Henüz kapatılmış bir Z Raporu bulunmuyor.
              </div>
            ) : (
              [...zHistory].reverse().map((z) => (
                <div key={z.id} className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-3 py-1 bg-[#F5C877]/10 border border-[#F5C877]/30 text-[#F5C877] rounded-xl font-mono font-black text-xs">
                        Z NO: #{String(z.zNo).padStart(4, '0')}
                      </span>
                      <span className="text-[11px] text-[#8E8E98]">{z.closedAt}</span>
                    </div>

                    <div className="text-2xl font-black text-white font-mono mt-1">
                      {formatMoney(z.netTotal)}
                    </div>
                    <div className="text-[11px] text-[#8E8E98] mt-0.5">Kapatan: {z.closedBy} • {z.totalOrders} Adisyon</div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setSelectedZHistoryDetail(z)} className="flex-1 py-2.5 bg-[#282830] hover:bg-[#343440] text-[#FAF7F2] text-xs font-bold rounded-xl cursor-pointer">
                      İncele
                    </button>
                    <button onClick={() => handlePrintZReceipt(z)} className="p-2.5 bg-[#F5C877]/20 text-[#F5C877] border border-[#F5C877]/30 rounded-xl cursor-pointer" title="Tekrar Yazdır">
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Z DETAY MODALI */}
      {selectedZHistoryDetail && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4 text-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <div>
                <h3 className="text-base font-black text-white">Z Raporu Detayı (#{selectedZHistoryDetail.zNo})</h3>
                <p className="text-xs text-[#8E8E98]">{selectedZHistoryDetail.closedAt}</p>
              </div>
              <button onClick={() => setSelectedZHistoryDetail(null)} className="text-[#8E8E98] hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 text-xs pr-1">
              <div className="p-3 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-1.5">
                <div className="flex justify-between"><span className="text-[#8E8E98]">Net Masa Satışı:</span><strong className="text-[#F5C877] font-mono text-sm">{formatMoney(selectedZHistoryDetail.netTotal)}</strong></div>
                <div className="flex justify-between"><span className="text-[#8E8E98]">İşletme Giderleri:</span><strong className="text-rose-400 font-mono">-{formatMoney(selectedZHistoryDetail.totalExpenses || 0)}</strong></div>
                <div className="flex justify-between"><span className="text-[#8E8E98]">Toptancı Ödemeleri:</span><strong className="text-rose-400 font-mono">-{formatMoney(selectedZHistoryDetail.supplierPaymentsTotal || 0)}</strong></div>
                <div className="flex justify-between text-emerald-400 font-bold pt-1 border-t border-[#2C2C34]">
                  <span>Kasada Kalan Net Nakit:</span>
                  <strong className="font-mono text-sm">{formatMoney(selectedZHistoryDetail.netCashInRegister || 0)}</strong>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
              <button onClick={() => setSelectedZHistoryDetail(null)} className="px-4 py-2 bg-slate-800 rounded-xl text-xs font-bold">Kapat</button>
              <button onClick={() => handlePrintZReceipt(selectedZHistoryDetail)} className="px-5 py-2 bg-[#F5C877] text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5">
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
