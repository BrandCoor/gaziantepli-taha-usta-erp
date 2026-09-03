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
  Wallet,
  AlertTriangle,
  FileSpreadsheet,
  TrendingUp,
  Layers,
  ShoppingBag,
  Users,
  Eye,
  RefreshCw,
  CheckCircle,
  HelpCircle,
  RotateCcw,
  Coffee,
  Sun,
  Moon,
  Gift,
  Truck,
  ArrowUpDown
} from 'lucide-react';
import { 
  restaurantDataService, 
  ZReport, 
  ReportFilterOptions, 
  DetailedReportResult, 
  CompletedOrderArchive 
} from '../../services/restaurantDataService';
import ExcelJS from 'exceljs';
import { notify } from '../../services/notificationService';
import { ThermalReceiptModal } from './ThermalReceiptModal';
import { OrderAuditDetailModal } from './OrderAuditDetailModal';
import { ZCloseModal } from './ZCloseModal';

export const ReportsView: React.FC = () => {
  const [activeMainTab, setActiveMainTab] = useState<'analysis' | 'current_x' | 'close_z' | 'history'>('analysis');
  const [analysisSubTab, setAnalysisSubTab] = useState<'financial' | 'products' | 'hourly' | 'staff_sections' | 'order_audit' | 'loss_prevention' | 'suppliers'>('financial');

  // Rapor durumları
  const [xReport, setXReport] = useState<any>(restaurantDataService.getCurrentXReport());
  const [zHistory, setZHistory] = useState<ZReport[]>(restaurantDataService.getZReportsHistory() || []);
  
  // Modallar
  const [showZCloseModal, setShowZCloseModal] = useState<boolean>(false);
  const [thermalModalData, setThermalModalData] = useState<any | null>(null);
  const [selectedAuditOrder, setSelectedAuditOrder] = useState<CompletedOrderArchive | null>(null);
  const [selectedZHistoryDetail, setSelectedZHistoryDetail] = useState<ZReport | null>(null);

  // Filtreleme State'leri
  const todayStr = new Date().toISOString().split('T')[0];
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'last_30_days' | 'this_year' | 'custom'>('today');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedWaiter, setSelectedWaiter] = useState<string>('ALL');
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>('ALL');
  const [selectedShift, setSelectedShift] = useState<'ALL' | 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'NIGHT'>('ALL');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [generalSearchQuery, setGeneralSearchQuery] = useState<string>('');
  
  // Ürün Alt Sekmesi Filtreleri
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [productSortBy, setProductSortBy] = useState<'total_desc' | 'qty_desc' | 'qty_asc'>('total_desc');

  // Z Arşivi Arama
  const [zSearchQuery, setZSearchQuery] = useState<string>('');

  // Filtrelenmiş Rapor Verisi
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
        categorySales: {},
        hourlySales: {},
        totalExpenses: 0,
        supplierInvoicesTotal: 0,
        supplierPaymentsTotal: 0,
        netCashFlow: 0,
        operatingProfit: 0,
        orders: [],
        cancelLogs: [],
        giftLogs: []
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

  // Tarih Presetleri
  useEffect(() => {
    const now = new Date();
    if (datePreset === 'today') {
      const d = now.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (datePreset === 'yesterday') {
      const y = new Date();
      y.setDate(now.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (datePreset === 'this_week') {
      const curr = new Date();
      const first = new Date(curr.setDate(curr.getDate() - (curr.getDay() === 0 ? 6 : curr.getDay() - 1)));
      setStartDate(first.toISOString().split('T')[0]);
      setEndDate(new Date().toISOString().split('T')[0]);
    } else if (datePreset === 'last_week') {
      const curr = new Date();
      const first = new Date(curr.setDate(curr.getDate() - (curr.getDay() === 0 ? 6 : curr.getDay() - 1) - 7));
      const last = new Date(curr.setDate(curr.getDate() + 6));
      setStartDate(first.toISOString().split('T')[0]);
      setEndDate(last.toISOString().split('T')[0]);
    } else if (datePreset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (datePreset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const last = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(last);
    } else if (datePreset === 'last_30_days') {
      const past = new Date();
      past.setDate(now.getDate() - 30);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (datePreset === 'this_year') {
      const first = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(now.toISOString().split('T')[0]);
    }
  }, [datePreset]);

  // Filtreleri Uygula
  const applyFilters = () => {
    try {
      const filters: ReportFilterOptions = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sectionName: selectedSection !== 'ALL' ? selectedSection : undefined,
        waiterName: selectedWaiter !== 'ALL' ? selectedWaiter : undefined,
        paymentType: selectedPaymentType !== 'ALL' ? selectedPaymentType : undefined,
        serviceShift: selectedShift !== 'ALL' ? selectedShift : undefined,
        minAmount: minAmount ? parseFloat(minAmount) : undefined,
        maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
        searchQuery: generalSearchQuery ? generalSearchQuery.trim() : undefined,
      };
      const result = restaurantDataService.getFilteredReport(filters);
      setFilteredReportData(result);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    applyFilters();
  }, [startDate, endDate, selectedSection, selectedWaiter, selectedPaymentType, selectedShift, minAmount, maxAmount, generalSearchQuery]);

  // Filtreleri Sıfırla
  const resetFilters = () => {
    setDatePreset('today');
    setSelectedSection('ALL');
    setSelectedWaiter('ALL');
    setSelectedPaymentType('ALL');
    setSelectedShift('ALL');
    setMinAmount('');
    setMaxAmount('');
    setGeneralSearchQuery('');
    setProductSearchQuery('');
    setSelectedCategory('ALL');
    notify.info('Filtreler Sıfırlandı', 'Varsayılan gün filtreleri uygulandı.');
  };

  const formatMoney = (val: any) => {
    return (Number(val) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  // Dinamik Listeler (Bölge, Garson, Ödeme, Kategori)
  const availableSections = useMemo(() => {
    const list = restaurantDataService.getSections().map(s => s.name);
    (filteredReportData.orders || []).forEach(o => {
      if (o.sectionName && !list.includes(o.sectionName)) list.push(o.sectionName);
    });
    return Array.from(new Set(list));
  }, [filteredReportData]);

  const availableWaiters = useMemo(() => {
    const list = restaurantDataService.getWaiters().map(w => w.name);
    (filteredReportData.orders || []).forEach(o => {
      if (o.waiterName && !list.includes(o.waiterName)) list.push(o.waiterName);
    });
    return Array.from(new Set(list));
  }, [filteredReportData]);

  const availablePaymentMethods = useMemo(() => {
    const set = new Set<string>(['Nakit', 'Kredi Kartı', 'Cari']);
    restaurantDataService.getPaymentMethods().forEach(m => set.add(m.name));
    Object.keys(filteredReportData.paymentBreakdown || {}).forEach(k => set.add(k));
    return Array.from(set);
  }, [filteredReportData]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    restaurantDataService.getCategories().forEach(c => cats.add(c.name));
    Object.values(filteredReportData?.productSales || {}).forEach((p: any) => {
      if (p.categoryName) cats.add(p.categoryName);
    });
    return Array.from(cats);
  }, [filteredReportData]);

  // Ürün Filtreleme & Sıralama
  const filteredProductsList = useMemo(() => {
    return Object.entries(filteredReportData?.productSales || {})
      .filter(([name, stat]: [string, any]) => {
        const matchesQuery = name.toLowerCase().includes(productSearchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'ALL' || (stat?.categoryName === selectedCategory);
        return matchesQuery && matchesCategory;
      })
      .sort((a, b) => {
        if (productSortBy === 'qty_desc') return (b[1].quantity || 0) - (a[1].quantity || 0);
        if (productSortBy === 'qty_asc') return (a[1].quantity || 0) - (b[1].quantity || 0);
        return (b[1].total || 0) - (a[1].total || 0);
      });
  }, [filteredReportData, productSearchQuery, selectedCategory, productSortBy]);

  // Z Arşivi Filtreleme
  const filteredZHistory = useMemo(() => {
    if (!zSearchQuery.trim()) return zHistory;
    const q = zSearchQuery.toLowerCase().trim();
    return (zHistory || []).filter(z => 
      String(z.zNo).includes(q) ||
      (z.closedBy || '').toLowerCase().includes(q) ||
      (z.closedAt || '').toLowerCase().includes(q) ||
      (z.note || '').toLowerCase().includes(q)
    );
  }, [zHistory, zSearchQuery]);

  // Termal Fiş Önizleme Aç
  const handleOpenXReceiptModal = () => {
    setThermalModalData({
      type: 'X_REPORT',
      title: 'GÜN İÇİ ARA RAPOR (X RAPORU)',
      closedAt: new Date().toLocaleString('tr-TR'),
      closedBy: 'Kasiyer / Yetkili',
      grossTotal: xReport?.grossTotal || 0,
      discountTotal: xReport?.discountTotal || 0,
      giftTotal: xReport?.giftTotal || 0,
      cancelTotal: xReport?.cancelTotal || 0,
      netTotal: xReport?.netTotal || 0,
      totalOrders: xReport?.totalOrders || 0,
      paymentBreakdown: xReport?.paymentBreakdown || {},
      totalExpenses: xReport?.totalExpenses || 0,
      cashExpenses: xReport?.cashExpenses || 0,
      supplierPaymentsTotal: xReport?.supplierPaymentsTotal || 0,
      supplierCashPayments: xReport?.supplierCashPayments || 0,
      netCashInRegister: xReport?.netCashInRegister || 0,
      productSales: xReport?.productSales || {},
      note: 'Bu fiş gün içi ara durum kontrol belgesidir, resmi Z yerine geçmez.',
    });
  };

  const handleOpenZReceiptModal = (zData: ZReport) => {
    setThermalModalData({
      type: 'Z_REPORT',
      title: `RESMİ GÜN SONU (Z NO: #${zData.zNo})`,
      zNo: zData.zNo,
      openedAt: zData.openedAt,
      closedAt: zData.closedAt,
      closedBy: zData.closedBy,
      grossTotal: zData.grossTotal,
      discountTotal: zData.discountTotal,
      giftTotal: zData.giftTotal,
      cancelTotal: zData.cancelTotal,
      netTotal: zData.netTotal,
      totalOrders: zData.totalOrders,
      paymentBreakdown: zData.paymentBreakdown || {},
      totalExpenses: zData.totalExpenses,
      cashExpenses: zData.cashExpenses,
      supplierPaymentsTotal: zData.supplierPaymentsTotal,
      supplierCashPayments: zData.supplierCashPayments,
      netCashInRegister: zData.netCashInRegister,
      openingCashFloat: zData.openingCashFloat,
      countedCash: zData.countedCash,
      cashDifference: zData.cashDifference,
      transferredCash: zData.transferredCash,
      productSales: zData.productSales,
      note: zData.note,
    });
  };

  const handleOpenFilteredReceiptModal = () => {
    setThermalModalData({
      type: 'FILTERED',
      title: `DÖNEM RAPORU (${startDate} / ${endDate})`,
      closedAt: new Date().toLocaleString('tr-TR'),
      closedBy: selectedWaiter !== 'ALL' ? selectedWaiter : 'Tüm Personel',
      grossTotal: filteredReportData.grossTotal,
      discountTotal: filteredReportData.discountTotal,
      giftTotal: filteredReportData.giftTotal,
      cancelTotal: filteredReportData.cancelTotal,
      netTotal: filteredReportData.netTotal,
      totalOrders: filteredReportData.totalOrders,
      paymentBreakdown: filteredReportData.paymentBreakdown || {},
      totalExpenses: filteredReportData.totalExpenses,
      cashExpenses: filteredReportData.cashExpenses,
      supplierPaymentsTotal: filteredReportData.supplierPaymentsTotal,
      supplierCashPayments: filteredReportData.supplierCashPayments,
      netCashInRegister: filteredReportData.netCashFlow,
      productSales: filteredReportData.productSales,
      note: `Bölge: ${selectedSection} | Garson: ${selectedWaiter} | Ödeme: ${selectedPaymentType}`,
    });
  };

  // Kapsamlı Excel Çıktısı (ExcelJS - Çok Sayfalı)
  const exportAdvancedExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gaziantepli Taha Usta ERP';
    workbook.created = new Date();

    // 1. Sayfa: Finansal Özet & Kasa Mutabakatı
    const summarySheet = workbook.addWorksheet('Mali Özet & Kasa Akışı');
    summarySheet.columns = [
      { header: 'Kategori / Kalem', key: 'cat', width: 30 },
      { header: 'Açıklama / Detay', key: 'desc', width: 35 },
      { header: 'Adet / Miktar', key: 'count', width: 15 },
      { header: 'Tutar (TL)', key: 'amount', width: 20 },
    ];

    summarySheet.addRow(['SATIŞ HASILATI', 'Net Satış Cirosu', `${filteredReportData.totalOrders} Adisyon`, filteredReportData.netTotal]);
    summarySheet.addRow(['SATIŞ HASILATI', 'Brüt Satış Tutarı', '-', filteredReportData.grossTotal]);
    summarySheet.addRow(['SATIŞ HASILATI', 'İskonto & İndirimler', '-', -filteredReportData.discountTotal]);
    summarySheet.addRow(['SATIŞ HASILATI', 'İkram Tutarı', `${(filteredReportData.giftLogs || []).length} İkram`, -filteredReportData.giftTotal]);
    summarySheet.addRow(['SATIŞ HASILATI', 'İptal / Zayi Tutarı', `${(filteredReportData.cancelLogs || []).length} İptal`, -filteredReportData.cancelTotal]);
    summarySheet.addRow(['SATIŞ HASILATI', 'Ortalama Adisyon Sepeti', '-', filteredReportData.avgOrderAmount]);
    summarySheet.addRow([]);

    summarySheet.addRow(['GİDERLER VE NAKİT AKIŞI', 'İşletme Giderleri Toplamı', '-', -filteredReportData.totalExpenses]);
    summarySheet.addRow(['GİDERLER VE NAKİT AKIŞI', 'Kasadan Çıkan Nakit Gider', '-', -(filteredReportData.cashExpenses || 0)]);
    summarySheet.addRow(['GİDERLER VE NAKİT AKIŞI', 'Toptancıya Ödenen Tutar', '-', -filteredReportData.supplierPaymentsTotal]);
    summarySheet.addRow(['GİDERLER VE NAKİT AKIŞI', 'Kasadan Toptancıya Ödenen Nakit', '-', -(filteredReportData.supplierCashPayments || 0)]);
    summarySheet.addRow(['GİDERLER VE NAKİT AKIŞI', 'Giren Toptancı Alış Faturaları', '-', filteredReportData.supplierInvoicesTotal]);
    summarySheet.addRow(['GİDERLER VE NAKİT AKIŞI', 'Kasada Kalan Net Nakit', '-', filteredReportData.netCashFlow]);
    summarySheet.addRow(['GİDERLER VE NAKİT AKIŞI', 'Dönem Faaliyet Kârı (Ciro - Gider - Alış)', '-', filteredReportData.operatingProfit || 0]);
    summarySheet.addRow([]);

    summarySheet.addRow(['KDV DAĞILIMI', 'Gıda Matrahı (%10)', '-', filteredReportData.netTotal / 1.10]);
    summarySheet.addRow(['KDV DAĞILIMI', 'Hesaplanan KDV Tutarı (%10)', '-', filteredReportData.netTotal - (filteredReportData.netTotal / 1.10)]);
    summarySheet.addRow([]);

    summarySheet.addRow(['ÖDEME TÜRLERİ', 'Nakit Satış', '-', filteredReportData.paymentBreakdown['Nakit'] || 0]);
    summarySheet.addRow(['ÖDEME TÜRLERİ', 'Kredi Kartı / POS', '-', filteredReportData.paymentBreakdown['Kredi Kartı'] || 0]);
    summarySheet.addRow(['ÖDEME TÜRLERİ', 'Cari (Veresiye)', '-', filteredReportData.paymentBreakdown['Cari'] || 0]);
    summarySheet.addRow(['ÖDEME TÜRLERİ', 'Sodexo / Multinet / Ticket', '-', 
      (filteredReportData.paymentBreakdown['Sodexo'] || 0) + 
      (filteredReportData.paymentBreakdown['Multinet'] || 0) + 
      (filteredReportData.paymentBreakdown['Ticket'] || 0)
    ]);

    // 2. Sayfa: Ürün Satışları
    const productSheet = workbook.addWorksheet('Ürün Satış Detayı');
    productSheet.columns = [
      { header: 'Ürün Adı', key: 'name', width: 30 },
      { header: 'Kategori', key: 'cat', width: 22 },
      { header: 'Satılan Adet', key: 'qty', width: 15 },
      { header: 'Birim Ortalama (TL)', key: 'unit', width: 18 },
      { header: 'Toplam Ciro (TL)', key: 'total', width: 20 },
    ];

    Object.entries(filteredReportData.productSales || {}).forEach(([pName, pStat]: [string, any]) => {
      const qty = pStat?.quantity || 1;
      const tot = pStat?.total || 0;
      productSheet.addRow([pName, pStat?.categoryName || 'Genel Menü', qty, tot / qty, tot]);
    });

    // 3. Sayfa: Kapatılan Adisyonlar (Denetim)
    const ordersSheet = workbook.addWorksheet('Kapatılan Adisyonlar');
    ordersSheet.columns = [
      { header: 'Adisyon No', key: 'no', width: 15 },
      { header: 'Tarih', key: 'date', width: 15 },
      { header: 'Kapanış Saati', key: 'time', width: 15 },
      { header: 'Masa', key: 'table', width: 15 },
      { header: 'Bölge', key: 'sec', width: 18 },
      { header: 'Garson', key: 'waiter', width: 20 },
      { header: 'Ödeme Türü', key: 'pm', width: 20 },
      { header: 'Toplam Tutar (TL)', key: 'tot', width: 18 },
    ];

    (filteredReportData.orders || []).forEach(ord => {
      const payMethods = (ord.payments || []).map(p => p.type).join(', ');
      ordersSheet.addRow([
        `#${ord.orderNumber}`,
        ord.date,
        ord.closedTime,
        ord.tableName,
        ord.sectionName,
        ord.waiterName || 'Kasiyer',
        payMethods || 'Nakit',
        ord.totalAmount
      ]);
    });

    // 4. Sayfa: İptal Kayıtları
    if ((filteredReportData.cancelLogs || []).length > 0) {
      const cancelSheet = workbook.addWorksheet('İptal ve Zayi Kayıtları');
      cancelSheet.columns = [
        { header: 'Zaman', key: 'time', width: 20 },
        { header: 'Masa', key: 'tbl', width: 15 },
        { header: 'Ürün', key: 'prod', width: 25 },
        { header: 'Miktar', key: 'qty', width: 12 },
        { header: 'Tutar (TL)', key: 'amt', width: 15 },
        { header: 'Sebep', key: 'reason', width: 25 },
        { header: 'İptal Eden', key: 'by', width: 20 },
      ];

      (filteredReportData.cancelLogs || []).forEach((c: any) => {
        cancelSheet.addRow([
          c.cancelledAt || '-',
          c.tableName || '-',
          c.productName || '-',
          c.quantity || 1,
          c.amount || 0,
          c.reason || 'Müşteri vazgeçti',
          c.cancelledBy || 'Yetkili'
        ]);
      });
    }

    // 5. Sayfa: İkram Kayıtları
    if ((filteredReportData.giftLogs || []).length > 0) {
      const giftSheet = workbook.addWorksheet('İkram Kayıtları');
      giftSheet.columns = [
        { header: 'Adisyon No', key: 'no', width: 15 },
        { header: 'Masa', key: 'tbl', width: 15 },
        { header: 'İkram Edilen Ürün', key: 'prod', width: 25 },
        { header: 'Miktar', key: 'qty', width: 12 },
        { header: 'Tutar (TL)', key: 'amt', width: 15 },
        { header: 'Garson / Yetkili', key: 'by', width: 20 },
      ];

      (filteredReportData.giftLogs || []).forEach((g: any) => {
        giftSheet.addRow([
          `#${g.orderNumber || '-'}`,
          g.tableName || '-',
          g.productName || '-',
          g.quantity || 1,
          g.amount || 0,
          g.waiterName || 'Kasiyer'
        ]);
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mali_Denetim_Raporu_${startDate}_${endDate}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
    notify.success('Excel İndirildi', 'Tüm mali tablolar ve denetim dökümü Excel dosyası olarak kaydedildi.');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans text-slate-100 bg-[#141416] min-h-screen">
      
      {/* ÜST BAŞLIK VE ANA SEKME ÇUBUĞU */}
      <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F5C877]/10 border border-[#F5C877]/30 text-[#F5C877] flex items-center justify-center font-black text-2xl shadow-lg">
            <BarChart2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Restoran Raporlama & Z Raporu Merkezi</span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase tracking-wide">
                DENETİM AKTİF
              </span>
            </h1>
            <p className="text-xs text-[#8E8E98] font-medium">
              Ciro analizi, KDV matrahı, kasa nakit mutabakatı, adisyon ve iptal denetimi.
            </p>
          </div>
        </div>

        <div className="flex bg-[#141416] p-1.5 rounded-2xl border border-[#2C2C34] gap-1 overflow-x-auto">
          <button
            id="tab-analysis"
            onClick={() => setActiveMainTab('analysis')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeMainTab === 'analysis' ? 'bg-[#F5C877] text-slate-950 shadow-md' : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Kapsamlı Dönem Raporu</span>
          </button>

          <button
            id="tab-current-x"
            onClick={() => setActiveMainTab('current_x')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeMainTab === 'current_x' ? 'bg-[#F5C877] text-slate-950 shadow-md' : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Gün İçi (X Raporu)</span>
          </button>

          <button
            id="tab-close-z"
            onClick={() => setShowZCloseModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-[#F5C877] border border-[#F5C877]/30 hover:bg-[#F5C877] hover:text-slate-950 cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>Gün Sonu Kapat (Z Al)</span>
          </button>

          <button
            id="tab-history"
            onClick={() => setActiveMainTab('history')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeMainTab === 'history' ? 'bg-[#F5C877] text-slate-950 shadow-md' : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Z Arşivi ({(zHistory || []).length})</span>
          </button>
        </div>
      </div>

      {/* 1. KAPSAMLI DÖNEM RAPORU (ANA PANEL) */}
      {activeMainTab === 'analysis' && (
        <div className="space-y-6">
          
          {/* GELİŞMİŞ FİLTRELEME ÇUBUĞU */}
          <div className="bg-[#1C1C20] p-6 rounded-3xl border border-[#2C2C34] shadow-2xl space-y-4">
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#2C2C34] pb-4">
              <div className="flex items-center gap-2.5">
                <Filter className="w-5 h-5 text-[#F5C877]" />
                <div>
                  <h2 className="text-sm font-black text-white">İşletme Filtreleme & Kriter Paneli</h2>
                  <p className="text-[11px] text-[#8E8E98]">Dönem, vardiya, salon, personel ve tutar kriterlerine göre anlık hesaplama.</p>
                </div>
              </div>

              {/* Hızlı Tarih Presetleri */}
              <div className="flex bg-[#141416] p-1 rounded-xl border border-[#2C2C34] gap-1 overflow-x-auto text-xs font-bold">
                <button 
                  onClick={() => setDatePreset('today')} 
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${datePreset === 'today' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#8E8E98] hover:text-white'}`}
                >
                  Bugün
                </button>
                <button 
                  onClick={() => setDatePreset('yesterday')} 
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${datePreset === 'yesterday' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#8E8E98] hover:text-white'}`}
                >
                  Dün
                </button>
                <button 
                  onClick={() => setDatePreset('this_week')} 
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${datePreset === 'this_week' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#8E8E98] hover:text-white'}`}
                >
                  Bu Hafta
                </button>
                <button 
                  onClick={() => setDatePreset('last_week')} 
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${datePreset === 'last_week' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#8E8E98] hover:text-white'}`}
                >
                  Geçen Hafta
                </button>
                <button 
                  onClick={() => setDatePreset('this_month')} 
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${datePreset === 'this_month' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#8E8E98] hover:text-white'}`}
                >
                  Bu Ay
                </button>
                <button 
                  onClick={() => setDatePreset('last_month')} 
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${datePreset === 'last_month' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#8E8E98] hover:text-white'}`}
                >
                  Geçen Ay
                </button>
                <button 
                  onClick={() => setDatePreset('last_30_days')} 
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${datePreset === 'last_30_days' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#8E8E98] hover:text-white'}`}
                >
                  Son 30 Gün
                </button>
                <button 
                  onClick={() => setDatePreset('this_year')} 
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${datePreset === 'this_year' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#8E8E98] hover:text-white'}`}
                >
                  Bu Yıl
                </button>
                <button 
                  onClick={() => setDatePreset('custom')} 
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${datePreset === 'custom' ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#8E8E98] hover:text-white'}`}
                >
                  Özel
                </button>
              </div>
            </div>

            {/* Filtre Form Girişleri (Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3 text-xs">
              <div>
                <label className="text-[#8E8E98] font-bold block mb-1">Başlangıç Tarihi</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => { setStartDate(e.target.value); setDatePreset('custom'); }} 
                  className="w-full p-2.5 bg-[#141416] border border-[#2C2C34] rounded-xl text-white font-medium focus:border-[#F5C877] outline-none" 
                />
              </div>

              <div>
                <label className="text-[#8E8E98] font-bold block mb-1">Bitiş Tarihi</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => { setEndDate(e.target.value); setDatePreset('custom'); }} 
                  className="w-full p-2.5 bg-[#141416] border border-[#2C2C34] rounded-xl text-white font-medium focus:border-[#F5C877] outline-none" 
                />
              </div>

              <div>
                <label className="text-[#8E8E98] font-bold block mb-1">Servis Vardiyası</label>
                <select 
                  value={selectedShift} 
                  onChange={(e: any) => setSelectedShift(e.target.value)} 
                  className="w-full p-2.5 bg-[#141416] border border-[#2C2C34] rounded-xl text-white font-medium focus:border-[#F5C877] outline-none cursor-pointer"
                >
                  <option value="ALL">Tüm Gün (24 Saat)</option>
                  <option value="BREAKFAST">Kahvaltı (07:00 - 11:00)</option>
                  <option value="LUNCH">Öğle Servisi (11:00 - 16:00)</option>
                  <option value="DINNER">Akşam Servisi (16:00 - 23:00)</option>
                  <option value="NIGHT">Gece Servisi (23:00 - 07:00)</option>
                </select>
              </div>

              <div>
                <label className="text-[#8E8E98] font-bold block mb-1">Bölge / Salon</label>
                <select 
                  value={selectedSection} 
                  onChange={(e) => setSelectedSection(e.target.value)} 
                  className="w-full p-2.5 bg-[#141416] border border-[#2C2C34] rounded-xl text-white font-medium focus:border-[#F5C877] outline-none cursor-pointer"
                >
                  <option value="ALL">Tüm Bölgeler ({availableSections.length})</option>
                  {availableSections.map(sec => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#8E8E98] font-bold block mb-1">Personel / Garson</label>
                <select 
                  value={selectedWaiter} 
                  onChange={(e) => setSelectedWaiter(e.target.value)} 
                  className="w-full p-2.5 bg-[#141416] border border-[#2C2C34] rounded-xl text-white font-medium focus:border-[#F5C877] outline-none cursor-pointer"
                >
                  <option value="ALL">Tüm Personel ({availableWaiters.length})</option>
                  {availableWaiters.map(waiter => (
                    <option key={waiter} value={waiter}>{waiter}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#8E8E98] font-bold block mb-1">Ödeme Yöntemi</label>
                <select 
                  value={selectedPaymentType} 
                  onChange={(e) => setSelectedPaymentType(e.target.value)} 
                  className="w-full p-2.5 bg-[#141416] border border-[#2C2C34] rounded-xl text-white font-medium focus:border-[#F5C877] outline-none cursor-pointer"
                >
                  <option value="ALL">Tüm Ödemeler</option>
                  {availablePaymentMethods.map(pm => (
                    <option key={pm} value={pm}>{pm}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#8E8E98] font-bold block mb-1">Tutar Aralığı (₺)</label>
                <div className="flex items-center gap-1">
                  <input 
                    type="number"
                    placeholder="Min"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    className="w-1/2 p-2 bg-[#141416] border border-[#2C2C34] rounded-xl text-white font-mono text-xs outline-none focus:border-[#F5C877]"
                  />
                  <span className="text-[#8E8E98]">-</span>
                  <input 
                    type="number"
                    placeholder="Max"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    className="w-1/2 p-2 bg-[#141416] border border-[#2C2C34] rounded-xl text-white font-mono text-xs outline-none focus:border-[#F5C877]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#8E8E98] font-bold block mb-1">Hızlı Arama</label>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Adisyon/Masa..."
                    value={generalSearchQuery}
                    onChange={(e) => setGeneralSearchQuery(e.target.value)}
                    className="w-full p-2.5 pl-7 bg-[#141416] border border-[#2C2C34] rounded-xl text-white text-xs outline-none focus:border-[#F5C877]"
                  />
                  <Search className="w-3.5 h-3.5 text-[#8E8E98] absolute left-2 top-3" />
                </div>
              </div>
            </div>

            {/* Alt İşlem Butonları */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#2C2C34]">
              <div className="text-xs text-[#8E8E98] flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>
                  Filtre Sonucu: <strong className="text-white font-bold">{filteredReportData.totalOrders} Adisyon</strong> kapatıldı, toplam brüt <strong className="text-[#F5C877] font-mono">{formatMoney(filteredReportData.grossTotal)}</strong>, net ciro <strong className="text-emerald-400 font-mono">{formatMoney(filteredReportData.netTotal)}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={resetFilters}
                  className="px-3 py-2 bg-[#141416] hover:bg-[#282830] text-[#8E8E98] hover:text-white border border-[#2C2C34] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Filtreleri Sıfırla"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Sıfırla</span>
                </button>

                <button 
                  onClick={exportAdvancedExcel} 
                  className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Excel İndir (.xlsx)</span>
                </button>

                <button 
                  onClick={handleOpenFilteredReceiptModal} 
                  className="px-4 py-2 bg-[#F5C877] hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Termal Fiş Bas (80mm)</span>
                </button>
              </div>
            </div>
          </div>

          {/* 6 ADET KPI YÖNETİCİ ÖZET KARTLARI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-lg">
              <span className="text-[10px] font-black uppercase text-[#8E8E98] block">Net Satış Cirosu</span>
              <div className="text-xl font-black text-[#F5C877] font-mono mt-1">{formatMoney(filteredReportData.netTotal)}</div>
              <span className="text-[10px] text-emerald-400 font-bold mt-0.5 block">{filteredReportData.totalOrders} Kapatılan Adisyon</span>
            </div>

            <div className="bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-lg">
              <span className="text-[10px] font-black uppercase text-[#8E8E98] block">İskonto & İndirimler</span>
              <div className="text-xl font-black text-amber-400 font-mono mt-1">-{formatMoney(filteredReportData.discountTotal)}</div>
              <span className="text-[10px] text-[#8E8E98] mt-0.5 block">
                Brüt: {formatMoney(filteredReportData.grossTotal)} ({filteredReportData.grossTotal > 0 ? ((filteredReportData.discountTotal / filteredReportData.grossTotal) * 100).toFixed(1) : 0}% indirim)
              </span>
            </div>

            <div className="bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-lg">
              <span className="text-[10px] font-black uppercase text-[#8E8E98] block">Sepet Ortalaması (AOV)</span>
              <div className="text-xl font-black text-cyan-400 font-mono mt-1">{formatMoney(filteredReportData.avgOrderAmount)}</div>
              <span className="text-[10px] text-[#8E8E98] mt-0.5 block">Masa başı ortalama harcama</span>
            </div>

            <div className="bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-lg">
              <span className="text-[10px] font-black uppercase text-rose-400 block">İkram & Zayi / İptal</span>
              <div className="text-xl font-black text-rose-400 font-mono mt-1">
                {formatMoney(filteredReportData.giftTotal + filteredReportData.cancelTotal)}
              </div>
              <span className="text-[10px] text-[#8E8E98] mt-0.5 block">
                İkram: {formatMoney(filteredReportData.giftTotal)} • İptal: {formatMoney(filteredReportData.cancelTotal)}
              </span>
            </div>

            <div className="bg-gradient-to-br from-[#1C1C20] to-[#24242A] p-4 rounded-3xl border-2 border-emerald-500/50 shadow-xl">
              <span className="text-[10px] font-black uppercase text-emerald-400 flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5" /> Kasa Net Nakit Akışı
              </span>
              <div className={`text-xl font-black font-mono mt-1 ${filteredReportData.netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatMoney(filteredReportData.netCashFlow)}
              </div>
              <span className="text-[10px] text-[#8E8E98] mt-0.5 block">Nakit Satış - Gider - Toptancı</span>
            </div>

            <div className="bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-lg">
              <span className="text-[10px] font-black uppercase text-indigo-400 block">Dönem Faaliyet Kârı</span>
              <div className={`text-xl font-black font-mono mt-1 ${(filteredReportData.operatingProfit || 0) >= 0 ? 'text-indigo-300' : 'text-rose-400'}`}>
                {formatMoney(filteredReportData.operatingProfit || 0)}
              </div>
              <span className="text-[10px] text-[#8E8E98] mt-0.5 block">Net Ciro - Gider - Alış Faturası</span>
            </div>
          </div>

          {/* DETAYLI ALT SEKMELER (MANTIK ÇERÇEVESİNDE RESTORAN ANALİZ VE TAKİP MODÜLLERİ) */}
          <div className="space-y-4">
            
            {/* Alt Sekme Başlıkları */}
            <div className="flex bg-[#1C1C20] p-1.5 rounded-2xl border border-[#2C2C34] gap-1 overflow-x-auto text-xs font-bold">
              <button
                onClick={() => setAnalysisSubTab('financial')}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                  analysisSubTab === 'financial' ? 'bg-[#F5C877] text-slate-950 font-black shadow-md' : 'text-[#8E8E98] hover:text-white'
                }`}
              >
                <Coins className="w-4 h-4" />
                <span>Mali Özet & KDV</span>
              </button>

              <button
                onClick={() => setAnalysisSubTab('products')}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                  analysisSubTab === 'products' ? 'bg-[#F5C877] text-slate-950 font-black shadow-md' : 'text-[#8E8E98] hover:text-white'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Ürün & Menü Satış Analizi</span>
              </button>

              <button
                onClick={() => setAnalysisSubTab('hourly')}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                  analysisSubTab === 'hourly' ? 'bg-[#F5C877] text-slate-950 font-black shadow-md' : 'text-[#8E8E98] hover:text-white'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Saatlik Restoran Yoğunluğu</span>
              </button>

              <button
                onClick={() => setAnalysisSubTab('staff_sections')}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                  analysisSubTab === 'staff_sections' ? 'bg-[#F5C877] text-slate-950 font-black shadow-md' : 'text-[#8E8E98] hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Personel & Salon Verimi</span>
              </button>

              <button
                onClick={() => setAnalysisSubTab('order_audit')}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                  analysisSubTab === 'order_audit' ? 'bg-[#F5C877] text-slate-950 font-black shadow-md' : 'text-[#8E8E98] hover:text-white'
                }`}
              >
                <Receipt className="w-4 h-4" />
                <span>Adisyon Denetim Listesi ({(filteredReportData.orders || []).length})</span>
              </button>

              <button
                onClick={() => setAnalysisSubTab('loss_prevention')}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                  analysisSubTab === 'loss_prevention' ? 'bg-[#F5C877] text-slate-950 font-black shadow-md' : 'text-[#8E8E98] hover:text-white'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>İptal & İkram Denetimi ({(filteredReportData.cancelLogs || []).length + (filteredReportData.giftLogs || []).length})</span>
              </button>

              <button
                onClick={() => setAnalysisSubTab('suppliers')}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                  analysisSubTab === 'suppliers' ? 'bg-[#F5C877] text-slate-950 font-black shadow-md' : 'text-[#8E8E98] hover:text-white'
                }`}
              >
                <Truck className="w-4 h-4 text-cyan-400" />
                <span>Tedarikçi & Fatura Akışı</span>
              </button>
            </div>

            {/* ALT SEKME 1: MALİ ÖZET & KDV & ÖDEME DAĞILIMI */}
            {analysisSubTab === 'financial' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Tahsilat / Ödeme Türleri */}
                <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
                  <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#2C2C34] pb-3">
                    <Coins className="w-4 h-4 text-[#F5C877]" />
                    <span>Ödeme Türleri ve POS Dağılımı</span>
                  </h3>

                  <div className="space-y-2">
                    {Object.keys(filteredReportData.paymentBreakdown || {}).length === 0 ? (
                      <div className="text-xs text-[#8E8E98] py-4 text-center">Dönem içinde ödeme kaydı bulunamadı.</div>
                    ) : (
                      Object.entries(filteredReportData.paymentBreakdown || {}).map(([type, amount]) => {
                        const share = filteredReportData.netTotal > 0 ? (amount / filteredReportData.netTotal) * 100 : 0;
                        return (
                          <div key={type} className="p-3 bg-[#141416] border border-[#2C2C34] rounded-2xl text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-200">{type}</span>
                              <span className="font-mono font-black text-emerald-400">{formatMoney(amount)}</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-[#F5C877] h-1.5 rounded-full" style={{ width: `${Math.min(100, share)}%` }}></div>
                            </div>
                            <div className="text-[10px] text-[#8E8E98] text-right font-mono">
                              Ciro Payı: %{share.toFixed(1)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Cari (Veresiye) Detayı */}
                  {filteredReportData.cariDetails && Object.keys(filteredReportData.cariDetails).length > 0 && (
                    <div className="p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-2xl space-y-2 text-xs">
                      <div className="font-bold text-amber-300 flex items-center justify-between">
                        <span>Cari Hesaplara (Veresiye) Yazılanlar</span>
                        <span className="font-mono font-black">
                          {formatMoney(Object.values(filteredReportData.cariDetails).reduce((s, v) => s + v, 0))}
                        </span>
                      </div>
                      <div className="space-y-1 divide-y divide-amber-500/20 pt-1 max-h-32 overflow-y-auto pr-1">
                        {Object.entries(filteredReportData.cariDetails).map(([cName, cAmt]) => (
                          <div key={cName} className="flex justify-between pt-1 text-[11px]">
                            <span className="text-slate-300 truncate max-w-[150px]">{cName}</span>
                            <span className="font-mono text-amber-200 font-bold">{formatMoney(cAmt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-[#141416] rounded-2xl border border-[#2C2C34] grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-[#8E8E98] block">İndirimler</span>
                      <span className="font-mono font-bold text-[#F5C877]">{formatMoney(filteredReportData.discountTotal)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8E8E98] block">İkramlar</span>
                      <span className="font-mono font-bold text-rose-400">{formatMoney(filteredReportData.giftTotal)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8E8E98] block">İptaller</span>
                      <span className="font-mono font-bold text-slate-400">{formatMoney(filteredReportData.cancelTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* KDV Matrah & Vergi Detayı */}
                <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
                  <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#2C2C34] pb-3">
                    <Percent className="w-4 h-4 text-[#F5C877]" />
                    <span>Mali KDV ve Vergi Dökümü (%10)</span>
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="p-4 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-2">
                      <div className="flex justify-between items-center text-[#8E8E98]">
                        <span>Net Satış Hasılatı:</span>
                        <strong className="font-mono text-white text-sm">{formatMoney(filteredReportData.netTotal)}</strong>
                      </div>
                      <div className="flex justify-between items-center text-[#8E8E98]">
                        <span>Gıda KDV Matrahı (%10):</span>
                        <strong className="font-mono text-[#F5C877] text-sm">
                          {formatMoney(filteredReportData.netTotal / 1.10)}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center text-emerald-400 pt-2 border-t border-[#2C2C34]">
                        <span className="font-bold">Hesaplanan KDV Tutarı:</span>
                        <strong className="font-mono text-base font-black">
                          {formatMoney(filteredReportData.netTotal - (filteredReportData.netTotal / 1.10))}
                        </strong>
                      </div>
                    </div>

                    <div className="p-4 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-2">
                      <span className="text-[11px] font-bold text-slate-300 block">KDV Beyannamesi Notu:</span>
                      <p className="text-[10px] text-[#8E8E98] leading-relaxed">
                        Restoran ve lokanta gıda hizmetlerinde KDV oranı yasal mevzuat gereğince %10 olarak hesaplanmıştır. Mali müşavir mutabakatı için Excel çıktısını kullanabilirsiniz.
                      </p>
                    </div>

                    <div className="p-4 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-2">
                      <span className="text-[11px] font-bold text-slate-300 block">Faaliyet Marjı Göstergesi:</span>
                      <div className="flex justify-between items-center">
                        <span className="text-[#8E8E98]">Tahmini Faaliyet Kârı:</span>
                        <strong className={`font-mono font-black ${(filteredReportData.operatingProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatMoney(filteredReportData.operatingProfit || 0)}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-[#8E8E98]">
                        <span>Kârlılık Oranı:</span>
                        <strong className="text-white">
                          {filteredReportData.netTotal > 0 ? (((filteredReportData.operatingProfit || 0) / filteredReportData.netTotal) * 100).toFixed(1) : 0}%
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Giderler ve Kasa Nakit Akışı */}
                <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
                  <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#2C2C34] pb-3">
                    <TrendingDown className="w-4 h-4 text-rose-400" />
                    <span>Giderler ve Kasa Nakit Akışı</span>
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#2C2C34] flex justify-between items-center">
                      <div>
                        <div className="font-bold text-white">İşletme Giderleri Toplamı</div>
                        <div className="text-[10px] text-[#8E8E98]">Kira, personel avansı, sarf</div>
                      </div>
                      <span className="font-mono font-black text-rose-400">-{formatMoney(filteredReportData.totalExpenses)}</span>
                    </div>

                    <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#2C2C34] flex justify-between items-center">
                      <div>
                        <div className="font-bold text-white">Kasadan Çıkan Nakit Gider</div>
                        <div className="text-[10px] text-[#8E8E98]">Doğrudan kasadan ödenen masraflar</div>
                      </div>
                      <span className="font-mono font-black text-rose-400">-{formatMoney(filteredReportData.cashExpenses || 0)}</span>
                    </div>

                    <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#2C2C34] flex justify-between items-center">
                      <div>
                        <div className="font-bold text-white">Toptancıya Ödenen Tutar</div>
                        <div className="text-[10px] text-[#8E8E98]">Hammadde tedarikçi ödemeleri</div>
                      </div>
                      <span className="font-mono font-black text-rose-400">-{formatMoney(filteredReportData.supplierPaymentsTotal)}</span>
                    </div>

                    <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#2C2C34] flex justify-between items-center">
                      <div>
                        <div className="font-bold text-white">Kasadan Toptancıya Ödenen Nakit</div>
                        <div className="text-[10px] text-[#8E8E98]">Kasadan elden ödenen hammadde</div>
                      </div>
                      <span className="font-mono font-black text-rose-400">-{formatMoney(filteredReportData.supplierCashPayments || 0)}</span>
                    </div>

                    <div className="p-4 bg-gradient-to-r from-emerald-950/30 to-[#1C1C20] rounded-2xl border border-emerald-500/30 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-emerald-400">Kasada Olması Gereken Net Nakit</div>
                        <div className="text-[10px] text-[#8E8E98]">Nakit Satış - Nakit Gider - Nakit Toptancı</div>
                      </div>
                      <span className="font-mono font-black text-emerald-400 text-base">
                        {formatMoney(filteredReportData.netCashFlow)}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ALT SEKME 2: ÜRÜN VE KATEGORİ SATIŞ ANALİZİ (MENÜ MÜHENDİSLİĞİ) */}
            {analysisSubTab === 'products' && (
              <div className="space-y-4">
                
                {/* Kategori, Sıralama ve Arama Filtresi */}
                <div className="bg-[#1C1C20] p-4 rounded-2xl border border-[#2C2C34] flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-md">
                    <Search className="w-4 h-4 text-[#8E8E98]" />
                    <input 
                      type="text" 
                      placeholder="Ürün adı ile ara (Kebap, Lahmacun, Künefe, Ayran)..." 
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl p-2.5 text-white outline-none focus:border-[#F5C877]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                      <span className="text-[#8E8E98] font-bold shrink-0">Kategori:</span>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="bg-[#141416] border border-[#2C2C34] rounded-xl p-2.5 text-white outline-none focus:border-[#F5C877] cursor-pointer"
                      >
                        <option value="ALL">Tüm Kategoriler ({availableCategories.length})</option>
                        {availableCategories.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[#8E8E98] font-bold shrink-0">Sıralama:</span>
                      <select
                        value={productSortBy}
                        onChange={(e: any) => setProductSortBy(e.target.value)}
                        className="bg-[#141416] border border-[#2C2C34] rounded-xl p-2.5 text-white outline-none focus:border-[#F5C877] cursor-pointer"
                      >
                        <option value="total_desc">En Yüksek Ciro (TL)</option>
                        <option value="qty_desc">En Çok Satan (Adet)</option>
                        <option value="qty_asc">En Az Satan (Hareketsiz Ürünler)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Kategori Bazında Hasılat Dağılımı */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(filteredReportData.categorySales || {}).map(([catName, stat]: [string, any]) => (
                    <div key={catName} className="p-4 bg-[#1C1C20] rounded-2xl border border-[#2C2C34] space-y-1">
                      <span className="text-[10px] font-bold text-[#8E8E98] block truncate">{catName}</span>
                      <div className="font-mono font-black text-[#F5C877] text-base">{formatMoney(stat.total)}</div>
                      <span className="text-[10px] text-[#8E8E98] block">{stat.quantity} Adet Satış</span>
                    </div>
                  ))}
                </div>

                {/* Ürün Listesi Tablosu */}
                <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] shadow-xl overflow-hidden">
                  <div className="p-4 border-b border-[#2C2C34] flex items-center justify-between">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                      Satılan Ürünler Listesi ({filteredProductsList.length} Kalem)
                    </h3>
                    <span className="text-[11px] text-[#8E8E98]">
                      Menü Analitiği & Hasılat Katkısı
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#141416] text-[#8E8E98] font-bold border-b border-[#2C2C34]">
                        <tr>
                          <th className="p-3.5">Ürün Adı</th>
                          <th className="p-3.5">Kategori</th>
                          <th className="p-3.5 text-center">Satılan Adet</th>
                          <th className="p-3.5 text-right">Ort. Fiyat</th>
                          <th className="p-3.5 text-right">Toplam Hasılat</th>
                          <th className="p-3.5 text-right">Ciro Katkı Payı</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2C2C34]">
                        {filteredProductsList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-xs text-[#8E8E98]">
                              Arama kriterlerine uygun ürün satışı bulunamadı.
                            </td>
                          </tr>
                        ) : (
                          filteredProductsList.map(([pName, stat]: [string, any], idx) => {
                            const share = filteredReportData.netTotal > 0 ? (stat.total / filteredReportData.netTotal) * 100 : 0;
                            return (
                              <tr key={pName} className="hover:bg-[#141416]/50 transition-colors">
                                <td className="p-3.5 font-bold text-white flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-md bg-[#282830] text-[#F5C877] font-mono text-[10px] flex items-center justify-center font-black">
                                    {idx + 1}
                                  </span>
                                  <span>{pName}</span>
                                </td>
                                <td className="p-3.5 text-[#8E8E98]">{stat.categoryName || 'Genel Menü'}</td>
                                <td className="p-3.5 text-center font-mono font-bold text-cyan-400">{stat.quantity} Adet</td>
                                <td className="p-3.5 text-right font-mono text-slate-300">
                                  {formatMoney(stat.total / (stat.quantity || 1))}
                                </td>
                                <td className="p-3.5 text-right font-mono font-black text-[#F5C877]">
                                  {formatMoney(stat.total)}
                                </td>
                                <td className="p-3.5 text-right">
                                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px]">
                                    %{share.toFixed(1)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* ALT SEKME 3: SAATLİK YOĞUNLUK & VARDİYA ANALİZİ */}
            {analysisSubTab === 'hourly' && (
              <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#F5C877]" />
                      <span>Saatlik Satış & Restoran Yoğunluk Haritası</span>
                    </h3>
                    <p className="text-xs text-[#8E8E98]">Günün hangi saatlerinde mutfak ve kasanın en yoğun olduğunu denetleyin.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {Object.keys(filteredReportData.hourlySales || {}).length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#8E8E98]">Saatlik veri kaydı bulunmuyor.</div>
                  ) : (
                    Object.entries(filteredReportData.hourlySales || {})
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([hour, stat]: [string, any]) => {
                        const maxHourTotal = Math.max(...Object.values(filteredReportData.hourlySales || {}).map((s: any) => s.total || 0), 1);
                        const percent = (stat.total / maxHourTotal) * 100;
                        return (
                          <div key={hour} className="p-3 bg-[#141416] rounded-2xl border border-[#2C2C34] text-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-white text-sm">{hour}</span>
                                <span className="text-[#8E8E98]">({stat.count} Adisyon Kapatıldı)</span>
                              </div>
                              <span className="font-mono font-black text-[#F5C877] text-sm">{formatMoney(stat.total)}</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full" style={{ width: `${percent}%` }}></div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            )}

            {/* ALT SEKME 4: PERSONEL & SALON VERİMİ */}
            {analysisSubTab === 'staff_sections' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Personel Bazında Ciro */}
                <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
                  <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#2C2C34] pb-3">
                    <Users className="w-4 h-4 text-[#F5C877]" />
                    <span>Garson & Personel Ciro Katkısı</span>
                  </h3>

                  <div className="space-y-3">
                    {Object.keys(filteredReportData.waiterBreakdown || {}).length === 0 ? (
                      <div className="text-xs text-[#8E8E98] py-4 text-center">Garson verisi bulunmuyor.</div>
                    ) : (
                      Object.entries(filteredReportData.waiterBreakdown || {}).map(([waiter, rawStat]: [string, any]) => {
                        const count = typeof rawStat === 'object' ? (rawStat.count || 1) : 1;
                        const total = typeof rawStat === 'object' ? (rawStat.total || 0) : (Number(rawStat) || 0);
                        const share = filteredReportData.netTotal > 0 ? (total / filteredReportData.netTotal) * 100 : 0;
                        return (
                          <div key={waiter} className="p-4 bg-[#141416] rounded-2xl border border-[#2C2C34] text-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <strong className="text-white text-sm block">{waiter}</strong>
                                <span className="text-[11px] text-[#8E8E98]">{count} Adisyon Kapattı</span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-black text-[#F5C877] text-base block">{formatMoney(total)}</span>
                                <span className="text-[10px] text-[#8E8E98]">Masa Ort: {formatMoney(total / count)}</span>
                              </div>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-cyan-400 h-1.5 rounded-full" style={{ width: `${Math.min(100, share)}%` }}></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Bölge / Salon Bazında Ciro */}
                <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
                  <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#2C2C34] pb-3">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span>Salon & Alan Bazında Dağılım</span>
                  </h3>

                  <div className="space-y-3">
                    {Object.keys(filteredReportData.sectionBreakdown || {}).length === 0 ? (
                      <div className="text-xs text-[#8E8E98] py-4 text-center">Bölge verisi bulunmuyor.</div>
                    ) : (
                      Object.entries(filteredReportData.sectionBreakdown || {}).map(([sec, rawStat]: [string, any]) => {
                        const count = typeof rawStat === 'object' ? (rawStat.count || 1) : 1;
                        const total = typeof rawStat === 'object' ? (rawStat.total || 0) : (Number(rawStat) || 0);
                        const share = filteredReportData.netTotal > 0 ? (total / filteredReportData.netTotal) * 100 : 0;
                        return (
                          <div key={sec} className="p-4 bg-[#141416] rounded-2xl border border-[#2C2C34] text-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <strong className="text-white text-sm block">{sec}</strong>
                                <span className="text-[11px] text-[#8E8E98]">{count} Adisyon Hizmeti</span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-black text-emerald-400 text-base block">{formatMoney(total)}</span>
                                <span className="text-[10px] text-[#8E8E98]">Sepet Ort: {formatMoney(total / count)}</span>
                              </div>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: `${Math.min(100, share)}%` }}></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* ALT SEKME 5: ADİSYON DENETİM LİSTESİ */}
            {analysisSubTab === 'order_audit' && (
              <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] shadow-xl overflow-hidden">
                <div className="p-4 border-b border-[#2C2C34] flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                      Filtrelenen Dönem Adisyon Denetim Kayıtları
                    </h3>
                    <p className="text-[11px] text-[#8E8E98]">Herhangi bir adisyona tıklayarak masa fiş detayını inceleyebilirsiniz.</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#141416] text-[#8E8E98] font-bold border-b border-[#2C2C34]">
                      <tr>
                        <th className="p-3.5">Adisyon No</th>
                        <th className="p-3.5">Kapanış Saati</th>
                        <th className="p-3.5">Masa / Bölge</th>
                        <th className="p-3.5">Garson</th>
                        <th className="p-3.5">Ödeme Şekli</th>
                        <th className="p-3.5 text-right">Tutar</th>
                        <th className="p-3.5 text-center">İncele</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2C2C34]">
                      {(filteredReportData.orders || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-xs text-[#8E8E98]">
                            Seçilen filtrelere uygun kapatılmış adisyon bulunamadı.
                          </td>
                        </tr>
                      ) : (
                        (filteredReportData.orders || []).map(ord => {
                          const payStr = (ord.payments || []).map(p => p.type).join(', ') || 'Nakit';
                          return (
                            <tr key={ord.id} className="hover:bg-[#141416]/50 transition-colors">
                              <td className="p-3.5 font-mono font-bold text-[#F5C877]">#{ord.orderNumber}</td>
                              <td className="p-3.5 text-slate-300 font-mono">{ord.closedTime || ord.orderTime || '-'}</td>
                              <td className="p-3.5 font-bold text-white">{ord.tableName} <span className="text-[#8E8E98] font-normal">({ord.sectionName})</span></td>
                              <td className="p-3.5 text-slate-300">{ord.waiterName || 'Kasiyer'}</td>
                              <td className="p-3.5">
                                <span className="px-2 py-0.5 bg-slate-800 text-slate-200 rounded font-bold text-[10px]">
                                  {payStr}
                                </span>
                              </td>
                              <td className="p-3.5 text-right font-mono font-black text-white text-sm">
                                {formatMoney(ord.totalAmount)}
                              </td>
                              <td className="p-3.5 text-center">
                                <button
                                  onClick={() => setSelectedAuditOrder(ord)}
                                  className="p-1.5 bg-[#282830] hover:bg-[#343440] text-cyan-400 rounded-lg transition-colors cursor-pointer"
                                  title="Adisyon Kalemlerini Gör"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ALT SEKME 6: İPTAL VE İKRAM DENETİMİ (KAÇAK & ZAYİ ÖNLEME) */}
            {analysisSubTab === 'loss_prevention' && (
              <div className="space-y-6">
                
                {/* İptal Kayıtları Tablosu */}
                <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] shadow-xl overflow-hidden">
                  <div className="p-4 border-b border-[#2C2C34]">
                    <h3 className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Masalardan İptal Edilen Ürün ve Zayi Kayıtları ({(filteredReportData.cancelLogs || []).length})</span>
                    </h3>
                    <p className="text-[11px] text-[#8E8E98]">Siparişten silinen veya iptal edilen ürünlerin denetim kaydı.</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#141416] text-[#8E8E98] font-bold border-b border-[#2C2C34]">
                        <tr>
                          <th className="p-3.5">İptal Zamanı</th>
                          <th className="p-3.5">Masa</th>
                          <th className="p-3.5">İptal Edilen Ürün</th>
                          <th className="p-3.5 text-center">Miktar</th>
                          <th className="p-3.5 text-right">Tutar</th>
                          <th className="p-3.5">İptal Nedeni</th>
                          <th className="p-3.5">İptal Eden</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2C2C34]">
                        {(filteredReportData.cancelLogs || []).length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-xs text-emerald-400">
                              Dönem içerisinde kaydedilmiş herhangi bir iptal / zayi işlemi bulunmuyor.
                            </td>
                          </tr>
                        ) : (
                          (filteredReportData.cancelLogs || []).map((c: any, idx: number) => (
                            <tr key={idx} className="hover:bg-rose-950/20 transition-colors">
                              <td className="p-3.5 font-mono text-[#8E8E98] text-[11px]">
                                {(c.cancelledAt || '').replace('T', ' ').substring(0, 16)}
                              </td>
                              <td className="p-3.5 font-bold text-white">{c.tableName || '-'}</td>
                              <td className="p-3.5 font-bold text-rose-300">{c.productName}</td>
                              <td className="p-3.5 text-center font-mono font-bold text-slate-300">{c.quantity || 1} Adet</td>
                              <td className="p-3.5 text-right font-mono font-black text-rose-400">
                                {formatMoney(c.amount)}
                              </td>
                              <td className="p-3.5 text-slate-300 italic">{c.reason || 'Müşteri vazgeçti'}</td>
                              <td className="p-3.5 text-[#F5C877] font-bold">{c.cancelledBy || 'Yetkili'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* İkram Edilen Ürünler Tablosu */}
                <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] shadow-xl overflow-hidden">
                  <div className="p-4 border-b border-[#2C2C34]">
                    <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      <Gift className="w-4 h-4" />
                      <span>Masalara İkram Edilen Kalemler ({(filteredReportData.giftLogs || []).length})</span>
                    </h3>
                    <p className="text-[11px] text-[#8E8E98]">Garsonlar tarafından masalara ücretsiz/ikram olarak verilen ürünlerin maliyet takibi.</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#141416] text-[#8E8E98] font-bold border-b border-[#2C2C34]">
                        <tr>
                          <th className="p-3.5">Adisyon</th>
                          <th className="p-3.5">Masa</th>
                          <th className="p-3.5">İkram Edilen Ürün</th>
                          <th className="p-3.5 text-center">Miktar</th>
                          <th className="p-3.5 text-right">Maliyet / Tutar</th>
                          <th className="p-3.5">Garson / Yetkili</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2C2C34]">
                        {(filteredReportData.giftLogs || []).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-xs text-slate-400">
                              Dönem içerisinde kaydedilmiş herhangi bir ikram işlemi bulunmuyor.
                            </td>
                          </tr>
                        ) : (
                          (filteredReportData.giftLogs || []).map((g: any, idx: number) => (
                            <tr key={idx} className="hover:bg-amber-950/20 transition-colors">
                              <td className="p-3.5 font-mono font-bold text-[#F5C877]">#{g.orderNumber || '-'}</td>
                              <td className="p-3.5 font-bold text-white">{g.tableName || '-'}</td>
                              <td className="p-3.5 font-bold text-amber-200">{g.productName}</td>
                              <td className="p-3.5 text-center font-mono font-bold text-slate-300">{g.quantity || 1} Adet</td>
                              <td className="p-3.5 text-right font-mono font-black text-amber-400">
                                {formatMoney(g.amount)}
                              </td>
                              <td className="p-3.5 text-slate-300">{g.waiterName || 'Kasiyer'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* ALT SEKME 7: TEDARİKÇİ & FATURA AKIŞI */}
            {analysisSubTab === 'suppliers' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 bg-[#1C1C20] rounded-3xl border border-[#2C2C34]">
                    <span className="text-[10px] font-bold text-[#8E8E98] uppercase block">Giren Alış Faturaları</span>
                    <div className="font-mono font-black text-[#F5C877] text-2xl mt-1">
                      {formatMoney(filteredReportData.supplierInvoicesTotal)}
                    </div>
                    <span className="text-[11px] text-[#8E8E98] mt-0.5 block">Hammadde borçlanması</span>
                  </div>

                  <div className="p-5 bg-[#1C1C20] rounded-3xl border border-[#2C2C34]">
                    <span className="text-[10px] font-bold text-[#8E8E98] uppercase block">Yapılan Toplam Ödemeler</span>
                    <div className="font-mono font-black text-rose-400 text-2xl mt-1">
                      {formatMoney(filteredReportData.supplierPaymentsTotal)}
                    </div>
                    <span className="text-[11px] text-[#8E8E98] mt-0.5 block">Kasa ve bankadan ödenen</span>
                  </div>

                  <div className="p-5 bg-[#1C1C20] rounded-3xl border border-[#2C2C34]">
                    <span className="text-[10px] font-bold text-rose-400 uppercase block">Kasadan Çıkan Nakit</span>
                    <div className="font-mono font-black text-rose-400 text-2xl mt-1">
                      {formatMoney(filteredReportData.supplierCashPayments || 0)}
                    </div>
                    <span className="text-[11px] text-[#8E8E98] mt-0.5 block">Kasa çekmecesinden çıkan</span>
                  </div>
                </div>

                <div className="bg-[#1C1C20] p-6 rounded-3xl border border-[#2C2C34] text-xs text-[#8E8E98] space-y-2">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <Truck className="w-4 h-4 text-cyan-400" />
                    <span>Tedarikçi Yönetimi Entegrasyonu</span>
                  </h4>
                  <p>
                    Toptancı işlemlerini ve cari hesap mutabakatlarını sol menüdeki <strong>Toptancı & Tedarikçi</strong> modülünden de ayrıntılı olarak yönetebilirsiniz.
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* 2. GÜN İÇİ X RAPORU PANELİ */}
      {activeMainTab === 'current_x' && (
        <div className="space-y-6">
          <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#F5C877]" />
                <span>Gün İçi Ara Kasa & X Raporu</span>
              </h2>
              <p className="text-xs text-[#8E8E98]">
                Gün devam ederken kasanın, masaların ve tahsilatların anlık ara durum dökümü.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={refreshReports}
                className="px-4 py-2 bg-[#282830] hover:bg-[#343440] text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Yenile</span>
              </button>

              <button
                onClick={handleOpenXReceiptModal}
                className="px-5 py-2.5 bg-[#F5C877] hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>80mm X Fişini Yazdır</span>
              </button>
            </div>
          </div>

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
              <div className="text-[10px] font-black uppercase text-rose-400">İşletme Giderleri (-)</div>
              <div className="text-2xl font-black text-rose-400 font-mono mt-1">-{formatMoney(xReport?.totalExpenses || 0)}</div>
              <div className="text-[11px] text-rose-300 mt-1">Nakit Çıkan: {formatMoney(xReport?.cashExpenses || 0)}</div>
            </div>

            <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg">
              <div className="text-[10px] font-black uppercase text-rose-400">Toptancı Ödemeleri (-)</div>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#2C2C34] pb-3">
                <Coins className="w-4 h-4 text-[#F5C877]" />
                <span>Gün İçi Masa Tahsilat Dağılımı</span>
              </h3>

              <div className="space-y-2">
                {Object.entries(xReport?.paymentBreakdown || {}).map(([type, amount]) => (
                  <div key={type} className="p-3 bg-[#141416] border border-[#2C2C34] rounded-2xl flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">{type}</span>
                    <span className="font-mono font-black text-emerald-400">{formatMoney(amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#2C2C34] pb-3">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Gün İçi Çok Satan Ürünler</span>
              </h3>

              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-[#2C2C34]">
                {Object.entries(xReport?.productSales || {}).slice(0, 10).map(([pName, pStat]: [string, any]) => (
                  <div key={pName} className="pt-2 flex items-center justify-between text-xs">
                    <span className="font-bold text-white truncate max-w-[200px]">{pName}</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-800 text-[#F5C877] rounded-md font-mono font-bold">
                        {pStat?.quantity || 1} Adet
                      </span>
                      <span className="font-mono font-black text-[#E4E4E8] w-20 text-right">
                        {formatMoney(pStat?.total || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. GEÇMİŞ Z RAPORLARI ARŞİVİ */}
      {activeMainTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Archive className="w-5 h-5 text-[#F5C877]" />
                <span>Geçmiş Z Raporları Arşivi</span>
              </h2>
              <p className="text-xs text-[#8E8E98]">
                Tüm geçmiş mali gün sonu kapanışları, kasa mutabakatları ve termal fiş kayıtları.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Z Arama Kutusu */}
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Z No, Tarih veya Kapatan ara..."
                  value={zSearchQuery}
                  onChange={(e) => setZSearchQuery(e.target.value)}
                  className="p-2.5 pl-8 bg-[#141416] border border-[#2C2C34] rounded-xl text-white text-xs outline-none focus:border-[#F5C877] w-60"
                />
                <Search className="w-3.5 h-3.5 text-[#8E8E98] absolute left-2.5 top-3" />
              </div>

              <button
                onClick={() => setShowZCloseModal(true)}
                className="px-5 py-2.5 bg-[#F5C877] hover:bg-amber-500 text-slate-950 text-xs font-black rounded-xl flex items-center gap-2 shadow-lg cursor-pointer shrink-0"
              >
                <Lock className="w-4 h-4" />
                <span>Yeni Z Raporu Kapat</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredZHistory.length === 0 ? (
              <div className="col-span-3 p-12 text-center text-xs text-[#8E8E98] bg-[#1C1C20] rounded-3xl border border-[#2C2C34]">
                {zSearchQuery ? 'Arama kriterlerine uygun Z Raporu bulunamadı.' : 'Henüz kapatılmış bir Z Raporu bulunmuyor.'}
              </div>
            ) : (
              [...filteredZHistory].reverse().map((z) => {
                const diff = z.cashDifference !== undefined ? z.cashDifference : 0;
                return (
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
                      <div className="text-[11px] text-[#8E8E98] mt-0.5">
                        Kapatan: <strong className="text-slate-300">{z.closedBy}</strong> • {z.totalOrders} Adisyon
                      </div>

                      {/* Kasa Fark Durumu Rozeti */}
                      <div className="mt-3 pt-3 border-t border-[#2C2C34] flex items-center justify-between text-xs">
                        <span className="text-[#8E8E98] text-[11px]">Kasa Mutabakatı:</span>
                        <span className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded-lg ${
                          diff === 0 
                            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30' 
                            : diff > 0 
                            ? 'bg-blue-950/40 text-blue-400 border border-blue-500/30' 
                            : 'bg-rose-950/40 text-rose-400 border border-rose-500/30'
                        }`}>
                          {diff === 0 ? 'Kasa Tam Denk' : `${diff > 0 ? '+' : ''}${formatMoney(diff)} Fark`}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedZHistoryDetail(z)} 
                        className="flex-1 py-2.5 bg-[#282830] hover:bg-[#343440] text-slate-100 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                      >
                        Detay İncele
                      </button>
                      <button 
                        onClick={() => handleOpenZReceiptModal(z)} 
                        className="p-2.5 bg-[#F5C877]/20 hover:bg-[#F5C877]/30 text-[#F5C877] border border-[#F5C877]/30 rounded-xl cursor-pointer transition-colors" 
                        title="Termal Fiş Bas"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* GÜN SONU Z KAPATMA MODALI */}
      {showZCloseModal && (
        <ZCloseModal
          xReport={xReport}
          onClose={() => setShowZCloseModal(false)}
          onSuccess={(closedZ) => {
            setShowZCloseModal(false);
            refreshReports();
            handleOpenZReceiptModal(closedZ);
          }}
        />
      )}

      {/* TERMAL FİŞ ÖNİZLEME MODALI (80MM ESC/POS) */}
      {thermalModalData && (
        <ThermalReceiptModal
          receiptData={thermalModalData}
          onClose={() => setThermalModalData(null)}
        />
      )}

      {/* ADİSYON DENETİM DETAY MODALI */}
      {selectedAuditOrder && (
        <OrderAuditDetailModal
          order={selectedAuditOrder}
          onClose={() => setSelectedAuditOrder(null)}
        />
      )}

      {/* GEÇMİŞ Z RAPORU DETAY PENCERESİ */}
      {selectedZHistoryDetail && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4 text-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <div>
                <h3 className="text-base font-black text-white">Z Raporu Detayı (#{selectedZHistoryDetail.zNo})</h3>
                <p className="text-xs text-[#8E8E98]">{selectedZHistoryDetail.closedAt} • Kapatan: {selectedZHistoryDetail.closedBy}</p>
              </div>
              <button onClick={() => setSelectedZHistoryDetail(null)} className="text-[#8E8E98] hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 text-xs pr-1">
              <div className="p-4 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-2">
                <div className="flex justify-between"><span className="text-[#8E8E98]">Net Satış Cirosu:</span><strong className="text-[#F5C877] font-mono text-base">{formatMoney(selectedZHistoryDetail.netTotal)}</strong></div>
                <div className="flex justify-between"><span className="text-[#8E8E98]">İşletme Giderleri:</span><strong className="text-rose-400 font-mono">-{formatMoney(selectedZHistoryDetail.totalExpenses || 0)}</strong></div>
                <div className="flex justify-between"><span className="text-[#8E8E98]">Toptancı Ödemeleri:</span><strong className="text-rose-400 font-mono">-{formatMoney(selectedZHistoryDetail.supplierPaymentsTotal || 0)}</strong></div>
                
                <div className="pt-2 border-t border-[#2C2C34] space-y-1">
                  <div className="flex justify-between text-[#8E8E98]">
                    <span>Açılış Kasa Avansı:</span>
                    <span className="font-mono">{formatMoney(selectedZHistoryDetail.openingCashFloat || 0)}</span>
                  </div>
                  <div className="flex justify-between text-[#8E8E98]">
                    <span>Fiili Sayılan Nakit:</span>
                    <span className="font-mono font-bold text-emerald-400">{formatMoney(selectedZHistoryDetail.countedCash || 0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-200 font-bold">
                    <span>Kasa Farkı:</span>
                    <span className={`font-mono ${
                      (selectedZHistoryDetail.cashDifference || 0) === 0 ? 'text-emerald-400' : (selectedZHistoryDetail.cashDifference || 0) > 0 ? 'text-blue-400' : 'text-rose-400'
                    }`}>
                      {formatMoney(selectedZHistoryDetail.cashDifference || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {selectedZHistoryDetail.note && (
                <div className="p-3 bg-[#141416] rounded-xl border border-[#2C2C34]">
                  <span className="text-[10px] text-[#8E8E98] font-bold block mb-1">Kapanış Notu:</span>
                  <p className="text-slate-300 italic">{selectedZHistoryDetail.note}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
              <button onClick={() => setSelectedZHistoryDetail(null)} className="px-4 py-2 bg-slate-800 rounded-xl text-xs font-bold cursor-pointer">
                Kapat
              </button>
              <button 
                onClick={() => {
                  const target = selectedZHistoryDetail;
                  setSelectedZHistoryDetail(null);
                  handleOpenZReceiptModal(target);
                }} 
                className="px-5 py-2 bg-[#F5C877] text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Termal Fiş Bas</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
