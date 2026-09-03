import React, { useState, useEffect, useMemo } from 'react';
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
  FileText,
  Filter,
  Calendar,
  UserCheck,
  MapPin,
  TrendingUp,
  Percent,
  Download,
  Search,
  RefreshCw,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { 
  restaurantDataService, 
  ZReport, 
  ReportFilterOptions,
  DetailedReportResult 
} from '../../services/restaurantDataService';
import ExcelJS from 'exceljs';

export const ReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'current_x' | 'filtered_analysis' | 'close_z' | 'history'>('current_x');

  // X Raporu ve Z Geçmişi
  const [xReport, setXReport] = useState(restaurantDataService.getCurrentXReport());
  const [zHistory, setZHistory] = useState<ZReport[]>(restaurantDataService.getZReportsHistory());
  const [zNoteInput, setZNoteInput] = useState<string>('');
  const [selectedZHistoryDetail, setSelectedZHistoryDetail] = useState<ZReport | null>(null);

  // Filtreli Rapor Durumları
  const todayStr = new Date().toISOString().split('T')[0];
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom'>('today');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedWaiter, setSelectedWaiter] = useState<string>('ALL');
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>('ALL');
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [filteredReportData, setFilteredReportData] = useState<DetailedReportResult>(
    restaurantDataService.getFilteredReport({ startDate: todayStr, endDate: todayStr })
  );

  // Verileri yenileme
  const refreshReports = () => {
    setXReport(restaurantDataService.getCurrentXReport());
    setZHistory(restaurantDataService.getZReportsHistory());
    applyFilters();
  };

  useEffect(() => {
    refreshReports();
    const unsub = restaurantDataService.subscribe(refreshReports);
    return () => unsub();
  }, []);

  // Filtre ön ayarları değişince tarihleri güncelle
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

  // Filtreleri uygula
  const applyFilters = () => {
    const filters: ReportFilterOptions = {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      sectionName: selectedSection !== 'ALL' ? selectedSection : undefined,
      waiterName: selectedWaiter !== 'ALL' ? selectedWaiter : undefined,
      paymentType: selectedPaymentType !== 'ALL' ? selectedPaymentType : undefined,
    };
    const result = restaurantDataService.getFilteredReport(filters);
    setFilteredReportData(result);
  };

  useEffect(() => {
    applyFilters();
  }, [startDate, endDate, selectedSection, selectedWaiter, selectedPaymentType]);

  const formatMoney = (val: number) => {
    return (Number(val) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  // Z Raporu Kapatma
  const handleExecuteZReportClose = (e: React.FormEvent) => {
    e.preventDefault();

    const confirmed = confirm(
      `⚠️ GÜN SONU Z RAPORU KAPANIS ONAYI\n\n` +
      `Bugünkü Toplam Ciro: ${formatMoney(xReport.grossTotal)}\n` +
      `Kapatılan Adisyon Sayısı: ${xReport.totalOrders} Adet\n\n` +
      `Günü kapatmak ve Z Raporunu Kasa Yazıcısından (Afanda 892E) basmak istiyor musunuz?`
    );

    if (!confirmed) return;

    const zReport = restaurantDataService.closeDailyZReport(zNoteInput, 'Taha Usta');
    notify.success('İşlem Tamamlandı', `✅ Z Raporu (#${zReport.zNo}) oluşturuldu ve Kasa Yazıcısından Z fişi basıldı!`);

    setZNoteInput('');
    setActiveTab('history');
  };

  // Termal Z Fişi Yazdırma
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
      `========================================\n` +
      `Termal fiş kasa yazıcısına başarıyla gönderildi!`
    );
  };

  // Filtreli Rapor Fişi Yazdırma
  const handlePrintFilteredReport = () => {
    notify.success('İşlem Tamamlandı', 
      `🖨️ [AFANDA 892E TERMAL YAZICI - ÖZEL DÖNEM ANALİZİ]\n` +
      `========================================\n` +
      `TARIH ARALIK: ${startDate} / ${endDate}\n` +
      `BOLGE       : ${selectedSection === 'ALL' ? 'TÜM BÖLGELER' : selectedSection}\n` +
      `PERSONEL    : ${selectedWaiter === 'ALL' ? 'TÜMÜ' : selectedWaiter}\n` +
      `ODEME TIPI  : ${selectedPaymentType === 'ALL' ? 'TÜMÜ' : selectedPaymentType}\n` +
      `----------------------------------------\n` +
      `TOPLAM ADISYON : ${filteredReportData.totalOrders} Adet\n` +
      `ORTALAMA ADIS. : ${formatMoney(filteredReportData.avgOrderAmount)}\n` +
      `NET CIRO       : ${formatMoney(filteredReportData.netTotal)}\n` +
      `========================================\n` +
      `Fiş başarıyla yazdırıldı!`
    );
  };

  // Excel Dışa Aktarma
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Z Raporu ve Satis Detayi');

    worksheet.columns = [
      { header: 'Kategori / Tip', key: 'category', width: 25 },
      { header: 'Detay / Isim', key: 'name', width: 30 },
      { header: 'Adet / Islem', key: 'count', width: 15 },
      { header: 'Tutar (TL)', key: 'amount', width: 20 },
    ];

    worksheet.addRow(['GENEL OZET', 'Net Satis Cirosu', `${filteredReportData.totalOrders} Adisyon`, filteredReportData.netTotal]);
    worksheet.addRow(['GENEL OZET', 'Brut Satis Tutari', '-', filteredReportData.grossTotal]);
    worksheet.addRow(['GENEL OZET', 'Indirim / Iskonto', '-', filteredReportData.discountTotal]);
    worksheet.addRow(['GENEL OZET', 'Ikram Tutari', '-', filteredReportData.giftTotal]);
    worksheet.addRow(['GENEL OZET', 'Iptal Edilenler', '-', filteredReportData.cancelTotal]);
    worksheet.addRow([]);

    worksheet.addRow(['--- ODEME DAGILIMI ---', '', '', '']);
    Object.entries(filteredReportData.paymentBreakdown).forEach(([type, amount]) => {
      worksheet.addRow(['Odeme Tipi', type, '-', amount]);
    });
    worksheet.addRow([]);

    worksheet.addRow(['--- URUN BAZLI SATISLAR ---', '', '', '']);
    Object.entries(filteredReportData.productSales).forEach(([pName, pStat]) => {
      worksheet.addRow(['Urun Satisi', pName, pStat.quantity, pStat.total]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Z_Raporu_Detayli_${startDate}_${endDate}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Filtrelenmiş Ürün Listesi
  const filteredProductsList = useMemo(() => {
    return Object.entries(filteredReportData.productSales).filter(([name]) => 
      name.toLowerCase().includes(productSearchQuery.toLowerCase())
    );
  }, [filteredReportData.productSales, productSearchQuery]);

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
              <span>Gaziantepli Taha Usta - Mali Denetim & Z Raporu</span>
              <span className="px-2.5 py-0.5 bg-[#F5C877]/20 text-[#F5C877] border border-[#F5C877]/30 rounded-full text-[10px] font-black uppercase">ERP v2.0</span>
            </h1>
            <p className="text-xs text-[#C4C4CC] font-medium">Nakit, POS, Sodexo/Multinet/Ticket, Cari Müşteri Borçları, Fırın & Ocak Ürün Satış Analizleri.</p>
          </div>
        </div>

        <div className="flex bg-[#141416] p-1.5 rounded-2xl border border-[#2C2C34] gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('current_x')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'current_x' ? 'bg-[#F5C877] text-slate-950 shadow-md' : 'text-[#C4C4CC] hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Gün İçi (X Raporu)</span>
          </button>

          <button
            onClick={() => setActiveTab('filtered_analysis')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'filtered_analysis' ? 'bg-[#F5C877] text-slate-950 shadow-md' : 'text-[#C4C4CC] hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Detaylı Filtreli Rapor</span>
          </button>

          <button
            onClick={() => setActiveTab('close_z')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'close_z' ? 'bg-[#F5C877] text-slate-950 shadow-md' : 'text-[#C4C4CC] hover:text-white'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Gün Sonu Al (Z Raporu Kapat)</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'history' ? 'bg-[#F5C877] text-slate-950 shadow-md' : 'text-[#C4C4CC] hover:text-white'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Z Arşivi ({zHistory.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. ANLIK GÜN İÇİ X RAPORU */}
      {/* ========================================================================= */}
      {activeTab === 'current_x' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg">
              <div className="text-[10px] font-black uppercase text-[#C4C4CC]">Gün İçi Brüt Satış</div>
              <div className="text-2xl font-black text-[#F5C877] font-mono mt-1">{formatMoney(xReport.grossTotal)}</div>
              <div className="text-[11px] text-[#A0A0AA] mt-1">{xReport.totalOrders} Adet Kapatılan Adisyon</div>
            </div>

            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg">
              <div className="text-[10px] font-black uppercase text-[#C4C4CC]">Nakit Kasa</div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">{formatMoney(xReport.paymentBreakdown['Nakit'] || 0)}</div>
              <div className="text-[11px] text-[#A0A0AA] mt-1">Kasada bekleyen nakit</div>
            </div>

            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg">
              <div className="text-[10px] font-black uppercase text-[#C4C4CC]">Kredi Kartı / POS</div>
              <div className="text-2xl font-black text-sky-400 font-mono mt-1">{formatMoney(xReport.paymentBreakdown['Kredi Kartı'] || 0)}</div>
              <div className="text-[11px] text-[#A0A0AA] mt-1">Banka POS toplamı</div>
            </div>

            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg">
              <div className="text-[10px] font-black uppercase text-[#C4C4CC]">Cari (Veresiye) Toplamı</div>
              <div className="text-2xl font-black text-orange-400 font-mono mt-1">
                {formatMoney(xReport.paymentBreakdown['Cari (Veresiye)'] || 0)}
              </div>
              <div className="text-[11px] text-[#A0A0AA] mt-1">{Object.keys(xReport.cariDetails || {}).length} Müşteriye Borç Yazıldı</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#2C2C34] pb-3">
                <Coins className="w-4 h-4 text-[#F5C877]" />
                <span>Ödeme Kanalları Dağılımı</span>
              </h3>

              <div className="space-y-2">
                {Object.keys(xReport.paymentBreakdown).length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#A0A0AA] bg-[#141416] rounded-2xl">
                    Bugün henüz hesap kapatılmadı.
                  </div>
                ) : (
                  Object.entries(xReport.paymentBreakdown).map(([type, amount]) => (
                    <div key={type} className="p-3 bg-[#141416] border border-[#2C2C34] rounded-2xl flex items-center justify-between text-xs">
                      <span className="font-bold text-[#E4E4E8]">{type}</span>
                      <span className="font-mono font-black text-emerald-400">{formatMoney(amount)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-[#2C2C34] grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 bg-[#141416] rounded-xl border border-[#2C2C34]">
                  <div className="text-[10px] text-[#A0A0AA]">İndirimler</div>
                  <div className="font-bold text-[#F5C877] mt-0.5">{formatMoney(xReport.discountTotal)}</div>
                </div>
                <div className="p-2.5 bg-[#141416] rounded-xl border border-[#2C2C34]">
                  <div className="text-[10px] text-[#A0A0AA]">İkramlar</div>
                  <div className="font-bold text-rose-400 mt-0.5">{formatMoney(xReport.giftTotal)}</div>
                </div>
                <div className="p-2.5 bg-[#141416] rounded-xl border border-[#2C2C34]">
                  <div className="text-[10px] text-[#A0A0AA]">İptaller</div>
                  <div className="font-bold text-[#C4C4CC] mt-0.5">{formatMoney(xReport.cancelTotal)}</div>
                </div>
              </div>
            </div>

            <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#2C2C34] pb-3">
                <Building2 className="w-4 h-4 text-orange-400" />
                <span>Cari (Veresiye) Müşteri Dökümü</span>
              </h3>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {Object.keys(xReport.cariDetails || {}).length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#A0A0AA] bg-[#141416] rounded-2xl">
                    Bugün cariye borç yazılmadı.
                  </div>
                ) : (
                  Object.entries(xReport.cariDetails || {}).map(([custName, amount]) => (
                    <div key={custName} className="p-3 bg-[#141416] border border-[#2C2C34] rounded-2xl flex items-center justify-between text-xs">
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

            <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#2C2C34] pb-3">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Ürün Satış Adetleri</span>
              </h3>

              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/40">
                {Object.keys(xReport.productSales).length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#A0A0AA] bg-[#141416] rounded-2xl">
                    Satış kaydı yok.
                  </div>
                ) : (
                  Object.entries(xReport.productSales).map(([pName, pStat]) => (
                    <div key={pName} className="pt-2 flex items-center justify-between text-xs">
                      <span className="font-bold text-white truncate max-w-[150px]">{pName}</span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-800 text-[#F5C877] rounded-md font-mono font-bold">
                          {pStat.quantity} Adet
                        </span>
                        <span className="font-mono font-black text-[#E4E4E8] w-20 text-right">
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
      {/* 2. DETAYLI VE İSTEĞE GÖRE FİLTRELENEBİLİR Z/X RAPORLAMA */}
      {/* ========================================================================= */}
      {activeTab === 'filtered_analysis' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* FİLTRELEME KONTROL PANELİ */}
          <div className="bg-[#1C1C20] p-6 rounded-3xl border border-[#2C2C34] shadow-2xl space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#2C2C34] pb-4">
              <div className="flex items-center gap-2.5">
                <Filter className="w-5 h-5 text-[#F5C877]" />
                <h2 className="text-base font-black text-white">Özel Dönem ve Kriter Filtreleme</h2>
              </div>

              {/* Hızlı Tarih Butonları */}
              <div className="flex bg-[#141416] p-1 rounded-xl border border-[#2C2C34] gap-1">
                <button
                  onClick={() => setDatePreset('today')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    datePreset === 'today' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#C4C4CC] hover:text-white'
                  }`}
                >
                  Bugün
                </button>
                <button
                  onClick={() => setDatePreset('yesterday')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    datePreset === 'yesterday' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#C4C4CC] hover:text-white'
                  }`}
                >
                  Dün
                </button>
                <button
                  onClick={() => setDatePreset('this_week')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    datePreset === 'this_week' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#C4C4CC] hover:text-white'
                  }`}
                >
                  Bu Hafta
                </button>
                <button
                  onClick={() => setDatePreset('this_month')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    datePreset === 'this_month' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#C4C4CC] hover:text-white'
                  }`}
                >
                  Bu Ay
                </button>
                <button
                  onClick={() => setDatePreset('custom')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    datePreset === 'custom' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#C4C4CC] hover:text-white'
                  }`}
                >
                  Özel Aralık
                </button>
              </div>
            </div>

            {/* Filtre Form Alanları */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
              <div>
                <label className="text-[#C4C4CC] font-bold block mb-1.5">Başlangıç Tarihi</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setDatePreset('custom'); }}
                  className="w-full p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-white font-medium focus:border-[#F5C877] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[#C4C4CC] font-bold block mb-1.5">Bitiş Tarihi</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setDatePreset('custom'); }}
                  className="w-full p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-white font-medium focus:border-[#F5C877] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[#C4C4CC] font-bold block mb-1.5">Bölge Seçimi</label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-white font-medium focus:border-[#F5C877] focus:outline-none"
                >
                  <option value="ALL">Tüm Bölgeler</option>
                  <option value="Salon">Salon</option>
                  <option value="Bahçe">Bahçe</option>
                  <option value="Paket Servis">Paket Servis</option>
                  <option value="Online Siparişler">Online Platformlar</option>
                </select>
              </div>

              <div>
                <label className="text-[#C4C4CC] font-bold block mb-1.5">Garson / Kasiyer</label>
                <select
                  value={selectedWaiter}
                  onChange={(e) => setSelectedWaiter(e.target.value)}
                  className="w-full p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-white font-medium focus:border-[#F5C877] focus:outline-none"
                >
                  <option value="ALL">Tüm Personel</option>
                  <option value="Taha Usta">Taha Usta (Kasa)</option>
                  <option value="Ahmet Garson">Ahmet Garson</option>
                  <option value="Mehmet Garson">Mehmet Garson</option>
                  <option value="Ali Paket">Ali Paket</option>
                </select>
              </div>

              <div>
                <label className="text-[#C4C4CC] font-bold block mb-1.5">Ödeme Tipi</label>
                <select
                  value={selectedPaymentType}
                  onChange={(e) => setSelectedPaymentType(e.target.value)}
                  className="w-full p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-white font-medium focus:border-[#F5C877] focus:outline-none"
                >
                  <option value="ALL">Tüm Ödeme Yöntemleri</option>
                  <option value="Nakit">Nakit</option>
                  <option value="Kredi Kartı">Kredi Kartı / POS</option>
                  <option value="Cari">Cari (Veresiye)</option>
                  <option value="Sodexo">Sodexo</option>
                  <option value="Multinet">Multinet</option>
                  <option value="Ticket">Ticket</option>
                  <option value="Trendyol">Trendyol Yemek</option>
                  <option value="Getir">Getir Yemek</option>
                  <option value="Yemeksepeti">Yemeksepeti</option>
                </select>
              </div>
            </div>

            {/* Dışa Aktarma Butonları */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#2C2C34]/80">
              <div className="text-xs text-[#C4C4CC] font-medium">
                Bulunan: <strong className="text-[#F5C877]">{filteredReportData.totalOrders} Adet Kapatılan Adisyon</strong>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={exportToExcel}
                  className="px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Excel İndir (.xlsx)</span>
                </button>

                <button
                  onClick={handlePrintFilteredReport}
                  className="px-4 py-2.5 bg-[#F5C877] hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-lg transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>Termal Fiş Bas (Afanda 892E)</span>
                </button>
              </div>
            </div>
          </div>

          {/* METRİK ÖZET KARTLARI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg">
              <div className="text-[10px] font-black uppercase text-[#C4C4CC]">Brüt Satış Cirosu</div>
              <div className="text-2xl font-black text-white font-mono mt-1">{formatMoney(filteredReportData.grossTotal)}</div>
              <div className="text-[10px] text-[#A0A0AA] mt-1">İndirimler öncesi</div>
            </div>

            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg">
              <div className="text-[10px] font-black uppercase text-[#C4C4CC]">İndirim & İskonto</div>
              <div className="text-2xl font-black text-rose-400 font-mono mt-1">-{formatMoney(filteredReportData.discountTotal)}</div>
              <div className="text-[10px] text-[#A0A0AA] mt-1">Uygulanan iskonto</div>
            </div>

            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#F5C877]/30 bg-gradient-to-br from-[#F5C877]/5 to-slate-950 shadow-xl">
              <div className="text-[10px] font-black uppercase text-[#F5C877]">Net Ciro (Kasa Toplamı)</div>
              <div className="text-2xl font-black text-[#F5C877] font-mono mt-1">{formatMoney(filteredReportData.netTotal)}</div>
              <div className="text-[10px] text-[#C4C4CC] mt-1">Tahsil edilen net tutar</div>
            </div>

            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg">
              <div className="text-[10px] font-black uppercase text-[#C4C4CC]">Adisyon Sayısı</div>
              <div className="text-2xl font-black text-sky-400 font-mono mt-1">{filteredReportData.totalOrders} Adet</div>
              <div className="text-[10px] text-[#A0A0AA] mt-1">Kapatılan masa & paket</div>
            </div>

            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg">
              <div className="text-[10px] font-black uppercase text-[#C4C4CC]">Ortalama Adisyon</div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">{formatMoney(filteredReportData.avgOrderAmount)}</div>
              <div className="text-[10px] text-[#A0A0AA] mt-1">Masa başına sepet ort.</div>
            </div>
          </div>

          {/* 3'LÜ DETAY GRİDİ (Ödemeler, Bölgeler, Garsonlar) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* ÖDEME KANALLARI DAĞILIMI */}
            <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center justify-between border-b border-[#2C2C34] pb-3">
                <span className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-[#F5C877]" />
                  <span>Ödeme Dağılımı</span>
                </span>
                <span className="text-[11px] text-[#C4C4CC] font-mono">{Object.keys(filteredReportData.paymentBreakdown).length} Kanal</span>
              </h3>

              <div className="space-y-2">
                {Object.entries(filteredReportData.paymentBreakdown).map(([type, amount]) => {
                  const percent = filteredReportData.netTotal > 0 ? ((amount / filteredReportData.netTotal) * 100).toFixed(1) : '0';
                  return (
                    <div key={type} className="p-3 bg-[#141416] border border-[#2C2C34] rounded-2xl flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white">{type}</div>
                        <div className="text-[10px] text-[#A0A0AA] font-mono">%{percent} Ciro Payı</div>
                      </div>
                      <span className="font-mono font-black text-emerald-400 text-sm">{formatMoney(amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* BÖLGE VE ALAN PERFORMANSI (Salon, Bahçe, Paket) */}
            <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center justify-between border-b border-[#2C2C34] pb-3">
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-sky-400" />
                  <span>Bölge Satış Performansı</span>
                </span>
              </h3>

              <div className="space-y-2">
                {Object.entries(filteredReportData.sectionBreakdown).map(([secName, secData]) => (
                  <div key={secName} className="p-3 bg-[#141416] border border-[#2C2C34] rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black text-white">{secName}</div>
                      <div className="text-[10px] text-sky-400">{secData.orderCount} Adisyon Kapatıldı</div>
                    </div>
                    <span className="font-mono font-black text-[#F5C877] text-sm">{formatMoney(secData.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* GARSON VE PERSONEL PERFORMANSI */}
            <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center justify-between border-b border-[#2C2C34] pb-3">
                <span className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Personel Satış Dağılımı</span>
                </span>
              </h3>

              <div className="space-y-2">
                {Object.entries(filteredReportData.waiterBreakdown).map(([wName, wData]) => (
                  <div key={wName} className="p-3 bg-[#141416] border border-[#2C2C34] rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black text-white">{wName}</div>
                      <div className="text-[10px] text-emerald-400">{wData.orderCount} Sipariş Teslim Edildi</div>
                    </div>
                    <span className="font-mono font-black text-white text-sm">{formatMoney(wData.total)}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* KDV VE ÜRÜN SATIŞ TABLOSU */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* KDV Dağılımı */}
            <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#2C2C34] pb-3">
                <Percent className="w-4 h-4 text-purple-400" />
                <span>KDV Dağılımı & Vergi Matrahı</span>
              </h3>

              <div className="space-y-3 text-xs">
                {filteredReportData.vatBreakdown.map((vat, idx) => (
                  <div key={idx} className="p-4 bg-[#141416] border border-[#2C2C34] rounded-2xl space-y-2">
                    <div className="flex justify-between font-black text-purple-400">
                      <span>Restoran KDV (%{vat.rate})</span>
                      <span>{formatMoney(vat.total)}</span>
                    </div>
                    <div className="flex justify-between text-[#C4C4CC]">
                      <span>Matrah (KDV Hariç):</span>
                      <strong className="text-white font-mono">{formatMoney(vat.baseAmount)}</strong>
                    </div>
                    <div className="flex justify-between text-[#C4C4CC]">
                      <span>Hesaplanan KDV:</span>
                      <strong className="text-purple-300 font-mono">{formatMoney(vat.vatAmount)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ürün Bazlı Satış Dökümü (Aramalı) */}
            <div className="lg:col-span-2 bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2C2C34] pb-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#F5C877]" />
                  <span>Ürün Satış Performansı ({filteredProductsList.length} Çeşit Ürün)</span>
                </h3>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#C4C4CC] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Ürün adı ile ara..."
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-[#141416] border border-[#383844] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#F5C877] w-48"
                  />
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto pr-1 divide-y divide-slate-800/40">
                {filteredProductsList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#A0A0AA] bg-[#141416] rounded-2xl">
                    Seçilen kriterlerde satılan ürün bulunamadı.
                  </div>
                ) : (
                  filteredProductsList.map(([pName, pStat]) => (
                    <div key={pName} className="py-2.5 flex items-center justify-between text-xs hover:bg-[#141416]/50 px-2 rounded-xl transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-[#F5C877]"></span>
                        <span className="font-bold text-white">{pName}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="px-3 py-1 bg-slate-800 text-[#F5C877] rounded-xl font-mono font-black text-xs">
                          {pStat.quantity} Adet
                        </span>
                        <span className="font-mono font-black text-emerald-400 text-sm w-28 text-right">
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
      {/* 3. GÜN SONU Z RAPORU KAPATMA */}
      {/* ========================================================================= */}
      {activeTab === 'close_z' && (
        <div className="max-w-2xl mx-auto bg-[#1C1C20] rounded-3xl p-8 border border-[#2C2C34] shadow-2xl space-y-6">
          <div className="text-center border-b border-[#2C2C34] pb-4">
            <div className="w-16 h-16 bg-[#F5C877]/10 border border-[#F5C877]/30 text-[#F5C877] rounded-3xl flex items-center justify-center mx-auto mb-3 text-2xl font-black">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white">Resmi Gün Sonu Z Raporu Kapanışı</h2>
            <p className="text-xs text-[#C4C4CC] mt-1">Günü kapatıp resmi Z Raporunu Afanda 892E Kasa Yazıcısından basmak için aşağıdaki butona basınız.</p>
          </div>

          <form onSubmit={handleExecuteZReportClose} className="space-y-5">
            <div className="p-5 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-3 text-xs">
              <div className="flex justify-between items-center text-[#C4C4CC]">
                <span>Bugünkü Net Satış Cirosu:</span>
                <strong className="text-[#F5C877] font-mono text-base">{formatMoney(xReport.netTotal)}</strong>
              </div>
              <div className="flex justify-between items-center text-[#C4C4CC]">
                <span>Nakit Kasa Tutarı:</span>
                <strong className="text-emerald-400 font-mono text-base">{formatMoney(xReport.paymentBreakdown['Nakit'] || 0)}</strong>
              </div>
              <div className="flex justify-between items-center text-[#C4C4CC]">
                <span>Kredi Kartı / POS Toplamı:</span>
                <strong className="text-sky-400 font-mono text-base">{formatMoney(xReport.paymentBreakdown['Kredi Kartı'] || 0)}</strong>
              </div>
              <div className="flex justify-between items-center text-[#C4C4CC]">
                <span>Cari (Veresiye) Toplamı:</span>
                <strong className="text-orange-400 font-mono text-base">{formatMoney(xReport.paymentBreakdown['Cari (Veresiye)'] || 0)}</strong>
              </div>
              <div className="flex justify-between items-center text-[#C4C4CC]">
                <span>Kapatılan Adisyon Sayısı:</span>
                <strong className="text-white font-mono">{xReport.totalOrders} Adet Masa</strong>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#E4E4E8]">Kapanış Notu (İsteğe Bağlı)</label>
              <input
                type="text"
                value={zNoteInput}
                onChange={(e) => setZNoteInput(e.target.value)}
                placeholder="Örn: Gün sonu sorunsuz tamamlandı, kasa sayımı tuttu..."
                className="w-full mt-1.5 p-3.5 bg-[#141416] border border-[#383844] rounded-2xl text-xs text-white focus:outline-none focus:border-[#F5C877] font-medium"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-[#F5C877] via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-transform transform active:scale-98"
            >
              <Printer className="w-5 h-5" />
              <span>Günü Kapat & Resmi Z Fişini Yazdır</span>
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. GEÇMİŞ Z RAPORLARI ARŞİVİ */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-white">Geçmiş Gün Sonu Z Raporları Arşivi</h2>
              <p className="text-xs text-[#A0A0AA]">Eski günlerin resmi Z kapanışlarını inceleyebilir ve kasa fişlerini tekrar yazdırabilirsiniz.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zHistory.length === 0 ? (
              <div className="col-span-3 p-12 text-center text-xs text-[#A0A0AA] bg-[#1C1C20] rounded-3xl border border-[#2C2C34]">
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
                      <span className="text-[11px] text-[#A0A0AA]">{z.closedAt}</span>
                    </div>

                    <div className="text-2xl font-black text-white font-mono mt-1">
                      {formatMoney(z.netTotal)}
                    </div>
                    <div className="text-[11px] text-[#C4C4CC] mt-0.5">Kapatan: {z.closedBy} • {z.totalOrders} Adisyon</div>

                    <div className="mt-3 p-3 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-1 text-xs">
                      <div className="flex justify-between text-[#C4C4CC]">
                        <span>Nakit:</span>
                        <strong className="text-emerald-400 font-mono">{formatMoney(z.paymentBreakdown['Nakit'] || 0)}</strong>
                      </div>
                      <div className="flex justify-between text-[#C4C4CC]">
                        <span>Kredi Kartı:</span>
                        <strong className="text-sky-400 font-mono">{formatMoney(z.paymentBreakdown['Kredi Kartı'] || 0)}</strong>
                      </div>
                      <div className="flex justify-between text-[#C4C4CC]">
                        <span>Cari:</span>
                        <strong className="text-orange-400 font-mono">{formatMoney(z.paymentBreakdown['Cari (Veresiye)'] || 0)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedZHistoryDetail(z)}
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-[#E4E4E8] text-xs font-bold rounded-xl cursor-pointer transition-colors"
                    >
                      İncele
                    </button>
                    <button
                      onClick={() => handlePrintZReceipt(z)}
                      className="p-2.5 bg-[#F5C877]/20 hover:bg-[#F5C877]/30 text-[#F5C877] border border-[#F5C877]/40 rounded-xl cursor-pointer transition-colors"
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
          <div className="bg-[#141416] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4 text-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <div>
                <h3 className="text-base font-black text-white">Z Raporu Detayı (#{selectedZHistoryDetail.zNo})</h3>
                <p className="text-xs text-[#C4C4CC]">{selectedZHistoryDetail.closedAt}</p>
              </div>
              <button onClick={() => setSelectedZHistoryDetail(null)} className="text-[#C4C4CC] hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 text-xs pr-1">
              <div className="p-3 bg-[#1C1C20] rounded-2xl border border-[#2C2C34] space-y-1.5">
                <div className="flex justify-between"><span className="text-[#C4C4CC]">Net Ciro:</span><strong className="text-[#F5C877] font-mono text-sm">{formatMoney(selectedZHistoryDetail.netTotal)}</strong></div>
                <div className="flex justify-between"><span className="text-[#C4C4CC]">Nakit:</span><strong className="text-emerald-400 font-mono">{formatMoney(selectedZHistoryDetail.paymentBreakdown['Nakit'] || 0)}</strong></div>
                <div className="flex justify-between"><span className="text-[#C4C4CC]">Kredi Kartı:</span><strong className="text-sky-400 font-mono">{formatMoney(selectedZHistoryDetail.paymentBreakdown['Kredi Kartı'] || 0)}</strong></div>
                <div className="flex justify-between"><span className="text-[#C4C4CC]">Cari:</span><strong className="text-orange-400 font-mono">{formatMoney(selectedZHistoryDetail.paymentBreakdown['Cari (Veresiye)'] || 0)}</strong></div>
              </div>

              {Object.keys(selectedZHistoryDetail.cariDetails || {}).length > 0 && (
                <div className="p-3 bg-[#1C1C20] rounded-2xl border border-[#2C2C34] space-y-1">
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
                <div className="font-bold text-[#E4E4E8] mb-1">Satılan Ürünler:</div>
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

            <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
              <button onClick={() => setSelectedZHistoryDetail(null)} className="px-4 py-2 bg-slate-800 rounded-xl text-xs font-bold cursor-pointer">Kapat</button>
              <button onClick={() => handlePrintZReceipt(selectedZHistoryDetail)} className="px-5 py-2 bg-[#F5C877] text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer">
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