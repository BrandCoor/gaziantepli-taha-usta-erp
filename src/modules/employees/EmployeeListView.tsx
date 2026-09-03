import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserCheck, 
  Search, 
  Plus, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Edit2, 
  Trash2, 
  Phone, 
  DollarSign, 
  CreditCard, 
  X,
  Lock,
  Clock,
  Printer,
  FileSpreadsheet,
  Calendar,
  Sparkles,
  Smartphone,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Banknote,
  Users,
  TrendingUp,
  FileText,
  Filter,
  Check,
  ChevronRight,
  ShieldAlert,
  ArrowDownCircle,
  ArrowUpCircle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Employee, EmployeePayment, dataService } from '../../services/dataService';
import { restaurantDataService, WaiterConfig } from '../../services/restaurantDataService';
import { exportService } from '../../services/exportService';
import { notify } from '../../services/notificationService';
import { WaitersTab } from '../restaurant-settings/components/WaitersTab';
import { OvertimeModal } from './OvertimeModal';
import { EmployeePaymentModal } from './EmployeePaymentModal';
import { EmployeeStatementModal } from './EmployeeStatementModal';
import { BatchSalaryModal } from './BatchSalaryModal';

interface EmployeeListViewProps {
  employees: Employee[];
  onRefresh: () => void;
  onOpenPaymentModal?: (employeeId?: string) => void;
}

type TabType = 'staff' | 'overtime' | 'payments' | 'waiters';
type SortField = 'fullName' | 'position' | 'salary' | 'balance';
type SortOrder = 'asc' | 'desc';

export const EmployeeListView: React.FC<EmployeeListViewProps> = ({ 
  employees, 
  onRefresh, 
  onOpenPaymentModal 
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('staff');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('balance');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Modallar
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);
  const [selectedOvertimeEmpId, setSelectedOvertimeEmpId] = useState<string | undefined>(undefined);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPaymentEmpId, setSelectedPaymentEmpId] = useState<string | undefined>(undefined);
  const [paymentModalType, setPaymentModalType] = useState<'ADVANCE' | 'SALARY_PAYMENT' | 'BONUS' | 'DEDUCTION' | 'SALARY_ACCRUAL'>('ADVANCE');

  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [selectedStatementEmp, setSelectedStatementEmp] = useState<Employee | null>(null);

  const [isBatchSalaryModalOpen, setIsBatchSalaryModalOpen] = useState(false);

  // Hareket Düzenleme State'leri
  const [editingPaymentItem, setEditingPaymentItem] = useState<EmployeePayment | null>(null);
  const [editPayAmount, setEditPayAmount] = useState('');
  const [editPayDate, setEditPayDate] = useState('');
  const [editPayType, setEditPayType] = useState<EmployeePayment['type']>('SALARY_ACCRUAL');
  const [editPayMethod, setEditPayMethod] = useState<'CASH' | 'BANK'>('CASH');
  const [editPayDescription, setEditPayDescription] = useState('');

  // Form State (Personel Ekle / Düzenle)
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPosition, setFormPosition] = useState('Garson');
  const [formSalary, setFormSalary] = useState('');
  const [formIban, setFormIban] = useState('');
  const [formStartDate, setFormStartDate] = useState('');

  // Mesai Sekmesi Filtreleri
  const [overtimeEmpFilter, setOvertimeEmpFilter] = useState<string>('ALL');
  const [overtimePayoutFilter, setOvertimePayoutFilter] = useState<string>('ALL');

  // Ödeme Sekmesi Filtresi
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('ALL');

  // Garsonlar & QR Yönetimi
  const [waiters, setWaiters] = useState<WaiterConfig[]>([]);

  const loadWaiters = () => {
    const list = restaurantDataService.getWaiters();
    setWaiters(list);
  };

  useEffect(() => {
    loadWaiters();
  }, []);

  const handleRefreshAll = () => {
    onRefresh();
    loadWaiters();
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Tüm Ödemeleri & Mesaileri Al
  const allPayments = useMemo(() => {
    return dataService.getEmployeePayments().sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [employees, activeTab]);

  // Sadece Mesai Kayıtları
  const overtimePayments = useMemo(() => {
    return allPayments.filter(p => p.type === 'OVERTIME_ACCRUAL');
  }, [allPayments]);

  // Filtrelenmiş Mesailer
  const filteredOvertimes = useMemo(() => {
    return overtimePayments.filter(p => {
      if (overtimeEmpFilter !== 'ALL' && p.employeeId !== overtimeEmpFilter) return false;
      if (overtimePayoutFilter === 'CASH' && p.payoutType !== 'CASH_IMMEDIATE') return false;
      if (overtimePayoutFilter === 'SALARY' && p.payoutType !== 'SALARY_ACCRUAL') return false;
      return true;
    });
  }, [overtimePayments, overtimeEmpFilter, overtimePayoutFilter]);

  // Filtrelenmiş Ödemeler
  const filteredPayments = useMemo(() => {
    return allPayments.filter(p => {
      if (paymentTypeFilter !== 'ALL' && p.type !== paymentTypeFilter) return false;
      return true;
    });
  }, [allPayments, paymentTypeFilter]);

  // Personel Listesi Filtreleme & Sıralama
  const processedEmployees = useMemo(() => {
    let list = employees.filter(e => {
      const matchSearch = e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (e.phone && e.phone.includes(searchQuery)) ||
                          (e.position && e.position.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchRole = roleFilter === 'ALL' || (e.position && e.position.toLowerCase().includes(roleFilter.toLowerCase()));
      return matchSearch && matchRole;
    });

    list.sort((a, b) => {
      let valA: any = a[sortField] || '';
      let valB: any = b[sortField] || '';

      if (sortField === 'salary' || sortField === 'balance') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [employees, searchQuery, roleFilter, sortField, sortOrder]);

  // Finansal KPI Özetleri
  const totalSalarySum = useMemo(() => employees.reduce((s, e) => s + (Number(e.salary) || 0), 0), [employees]);
  const totalEmployeeBalance = useMemo(() => employees.reduce((s, e) => s + Math.max(0, Number(e.balance) || 0), 0), [employees]);
  
  const currentMonthOvertimeTotal = useMemo(() => {
    return overtimePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [overtimePayments]);

  const currentMonthOvertimeHours = useMemo(() => {
    return overtimePayments.reduce((s, p) => s + (Number(p.overtimeHours) || 0), 0);
  }, [overtimePayments]);

  const formatMoney = (val: number) => {
    return (Number(val) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  // Modal Açıcılar
  const handleOpenAddEmployee = () => {
    setEditingEmployee(null);
    setFormName('');
    setFormPhone('');
    setFormPosition('Garson');
    setFormSalary('');
    setFormIban('');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setIsEmployeeModalOpen(true);
  };

  const handleOpenEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormName(emp.fullName);
    setFormPhone(emp.phone || '');
    setFormPosition(emp.position || 'Garson');
    setFormSalary(emp.salary.toString());
    setFormIban(emp.iban || '');
    setFormStartDate(emp.startDate || '');
    setIsEmployeeModalOpen(true);
  };

  const handleOpenOvertime = (empId?: string) => {
    setSelectedOvertimeEmpId(empId);
    setIsOvertimeModalOpen(true);
  };

  const handleOpenPayment = (empId?: string, type: 'ADVANCE' | 'SALARY_PAYMENT' | 'BONUS' | 'DEDUCTION' | 'SALARY_ACCRUAL' = 'ADVANCE') => {
    setSelectedPaymentEmpId(empId);
    setPaymentModalType(type);
    setIsPaymentModalOpen(true);
  };

  const handleOpenStatement = (emp: Employee) => {
    setSelectedStatementEmp(emp);
    setIsStatementModalOpen(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      notify.error('Lütfen personel adını giriniz.');
      return;
    }

    const salaryNum = parseFloat(formSalary) || 0;

    if (editingEmployee) {
      dataService.updateEmployee(editingEmployee.id, {
        fullName: formName.trim(),
        phone: formPhone.trim(),
        position: formPosition.trim(),
        salary: salaryNum,
        iban: formIban.trim(),
        startDate: formStartDate || undefined,
      });

      // Eğer garson ise garson listesinde de güncelle
      if (formPosition.toLowerCase().includes('garson')) {
        const waitersList = restaurantDataService.getWaiters();
        const existingWaiter = waitersList.find(
          w => w.name.toLowerCase() === editingEmployee.fullName.toLowerCase() ||
               (editingEmployee.phone && w.phone === editingEmployee.phone) ||
               w.name.toLowerCase() === formName.trim().toLowerCase()
        );
        if (existingWaiter) {
          restaurantDataService.updateWaiter(existingWaiter.id, {
            name: formName.trim(),
            phone: formPhone.trim(),
          });
        }
      }

      notify.success(`${formName} bilgileri güncellendi.`);
    } else {
      dataService.addEmployee({
        fullName: formName.trim(),
        phone: formPhone.trim(),
        position: formPosition.trim(),
        salary: salaryNum,
        iban: formIban.trim(),
        startDate: formStartDate || new Date().toISOString().split('T')[0],
        isActive: true,
      });

      // Eğer garson ise garson listesine de telefon ve otomatik MAC adresi ile ekle
      if (formPosition.toLowerCase().includes('garson')) {
        restaurantDataService.addWaiter({
          name: formName.trim(),
          phone: formPhone.trim(),
          pin: '1111',
          allowedSections: ['ALL'],
          permissions: {
            canDiscount: false,
            canVoidItem: false,
            canGift: false,
            canTransferTable: true,
            canPrintBill: true,
          },
        });
      }

      notify.success(`${formName} kadroya eklendi.`);
    }

    setIsEmployeeModalOpen(false);
    handleRefreshAll();
  };

  const handleDeleteEmployee = (emp: Employee) => {
    if (Math.abs(Number(emp.balance) || 0) > 0.01) {
      notify.error(`Bu personelin ${formatMoney(emp.balance)} hesap bakiyesi bulunmaktadır. Bakiye sıfırlanmadan personel silinemez!`);
      return;
    }

    notify.confirm({
      title: 'Personeli Sil',
      message: `"${emp.fullName}" isimli personeli sistemden silmek istediğinize emin misiniz? Tüm geçmiş kayıtları kaldırılacaktır.`,
      type: 'danger',
      confirmText: 'Evet, Sil',
      onConfirm: () => {
        const res = dataService.deleteEmployee(emp.id);
        if (res.success) {
          notify.success('Personel Silindi', 'Personel başarıyla silindi.');
          handleRefreshAll();
        } else {
          notify.error('Hata', res.message || 'Silme işlemi başarısız.');
        }
      }
    });
  };

  const handleDeletePaymentItem = (paymentId: string) => {
    notify.confirm({
      title: 'Kayıt Sil',
      message: 'Bu hareket kaydını silmek istediğinize emin misiniz? Personel bakiyesi otomatik olarak yeniden hesaplanacaktır.',
      type: 'danger',
      confirmText: 'Evet, Sil',
      onConfirm: () => {
        dataService.deleteEmployeePayment(paymentId);
        notify.success('Kayıt Silindi', 'Kayıt silindi ve personel bakiyesi güncellendi.');
        handleRefreshAll();
      }
    });
  };

  const openEditPaymentItem = (p: EmployeePayment) => {
    setEditingPaymentItem(p);
    setEditPayAmount(String(p.amount || 0));
    setEditPayDate(p.date ? p.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditPayType(p.type);
    setEditPayMethod(p.paymentMethod || 'CASH');
    setEditPayDescription(p.description || '');
  };

  const handleSavePaymentItemEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPaymentItem) return;
    const amountNum = parseFloat(editPayAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return notify.error('Geçersiz Tutar', 'Lütfen geçerli bir tutar girin.');
    }

    dataService.updateEmployeePayment(editingPaymentItem.id, {
      amount: amountNum,
      date: editPayDate,
      type: editPayType,
      paymentMethod: editPayMethod,
      description: editPayDescription.trim(),
    });

    notify.success('Güncellendi', 'Hareket kaydı ve bakiye güncellendi.');
    setEditingPaymentItem(null);
    handleRefreshAll();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto select-none text-[#FAF7F2]">
      {/* 1. ÜST BAŞLIK & GENEL AKSİYONLAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#F5C877] text-[#141416] flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Personeller, Garsonlar & Bordro Yönetimi</h1>
              <p className="text-xs text-[#8E8E98]">
                Mesai hesaplama (katsayılı / manuel), nakit & maaşa aktarma, avans, hakediş ve QR garson terminalleri.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mesai Ekle */}
          <button
            onClick={() => handleOpenOvertime()}
            className="px-4 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>+ Mesai Ekle</span>
          </button>

          {/* Avans / Ödeme Yap */}
          <button
            onClick={() => handleOpenPayment(undefined, 'ADVANCE')}
            className="px-4 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>+ Avans / Ödeme</span>
          </button>

          {/* Toplu Maaş Tahakkuku */}
          <button
            onClick={() => setIsBatchSalaryModalOpen(true)}
            className="px-3.5 py-2.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="Tüm çalışanların maaşını tek tıkla hakedişe ekle"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline">Toplu Maaş Tahakkuku</span>
          </button>

          {/* Yeni Personel Ekle */}
          <button
            onClick={handleOpenAddEmployee}
            className="px-4 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] hover:brightness-110 text-[#141416] rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Personel</span>
          </button>

          {/* Dışa Aktar */}
          <div className="flex bg-[#1C1C20] border border-[#2C2C34] rounded-2xl p-1">
            <button
              onClick={() => exportService.exportEmployeesExcel(employees, totalEmployeeBalance)}
              className="p-2 text-[#8E8E98] hover:text-emerald-400 rounded-xl transition-colors cursor-pointer"
              title="Excel'e Aktar"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
            <button
              onClick={() => exportService.exportEmployeesPdf(employees, totalEmployeeBalance)}
              className="p-2 text-[#8E8E98] hover:text-amber-400 rounded-xl transition-colors cursor-pointer"
              title="PDF Olarak Yazdır"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. 4'LÜ KPI ÖZET KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Toplam Personel */}
        <div className="bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#F5C877]/10 border border-[#F5C877]/20 flex items-center justify-center text-[#F5C877]">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#8E8E98]">Kayıtlı Kadro & Garson</div>
            <div className="text-xl font-black text-white">{employees.length} Çalışan</div>
            <div className="text-[10px] text-[#A0A0AA]">{waiters.length} Garson Terminali Aktif</div>
          </div>
        </div>

        {/* Aylık Sabit Maaş Yükü */}
        <div className="bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#8E8E98]">Aylık Sabit Maaş Yükü</div>
            <div className="text-xl font-mono font-black text-white">{formatMoney(totalSalarySum)}</div>
            <div className="text-[10px] text-blue-400">Sözleşmeli Taban Maaşlar</div>
          </div>
        </div>

        {/* Kayıtlı Fazla Mesai */}
        <div className="bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#8E8E98]">Toplam Fazla Mesai</div>
            <div className="text-xl font-mono font-black text-amber-300">{formatMoney(currentMonthOvertimeTotal)}</div>
            <div className="text-[10px] text-amber-400 font-mono">{currentMonthOvertimeHours} Saat Mesai Yapıldı</div>
          </div>
        </div>

        {/* Ödenecek Kalan Hakediş Borcu */}
        <div className="bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-sm flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            totalEmployeeBalance > 0 
              ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' 
              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
          }`}>
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#8E8E98]">Ödenecek Net Hakediş</div>
            <div className={`text-xl font-mono font-black ${totalEmployeeBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {formatMoney(totalEmployeeBalance)}
            </div>
            <div className="text-[10px] text-[#A0A0AA]">Mesai & Tahakkuk Kalanı</div>
          </div>
        </div>
      </div>

      {/* 3. ANA MODÜL SEKMELERİ (TABS) */}
      <div className="flex border-b border-[#2C2C34] gap-2 overflow-x-auto pb-0.5">
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-5 py-3 rounded-t-2xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'staff'
              ? 'bg-[#1C1C20] text-[#F5C877] border-amber-400'
              : 'text-[#8E8E98] border-transparent hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Personel & Garson Kadrosu ({employees.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('overtime')}
          className={`px-5 py-3 rounded-t-2xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'overtime'
              ? 'bg-[#1C1C20] text-amber-300 border-amber-400'
              : 'text-[#8E8E98] border-transparent hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Mesai & Fazla Çalışma ({overtimePayments.length})</span>
          {overtimePayments.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-[10px] text-amber-300">
              {currentMonthOvertimeHours}s
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`px-5 py-3 rounded-t-2xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'payments'
              ? 'bg-[#1C1C20] text-emerald-400 border-emerald-400'
              : 'text-[#8E8E98] border-transparent hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Maaş, Avans & Ödemeler ({allPayments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('waiters')}
          className={`px-5 py-3 rounded-t-2xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'waiters'
              ? 'bg-[#1C1C20] text-blue-400 border-blue-400'
              : 'text-[#8E8E98] border-transparent hover:text-white'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Garson QR & Masalar ({waiters.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PERSONEL & GARSON KADROSU */}
      {/* ========================================================================= */}
      {activeTab === 'staff' && (
        <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] overflow-hidden shadow-sm space-y-4 p-4 sm:p-6">
          {/* Filtre ve Arama Çubuğu */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#8E8E98]" />
              <input
                type="text"
                placeholder="Personel adı, görev veya telefon..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-white focus:border-[#F5C877] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex bg-[#121214] border border-[#2C2C34] rounded-2xl p-1 text-xs">
                {['ALL', 'Garson', 'Usta', 'Kurye', 'Mutfak'].map((role) => (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(role)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                      roleFilter === role ? 'bg-[#282830] text-amber-300' : 'text-[#8E8E98] hover:text-white'
                    }`}
                  >
                    {role === 'ALL' ? 'Tümü' : role}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Personel Tablosu */}
          <div className="overflow-x-auto border border-[#26262E] rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#26262E] text-[#8E8E98] bg-[#141416]">
                  <th onClick={() => toggleSort('fullName')} className="p-3.5 font-black cursor-pointer hover:text-white">
                    <div className="flex items-center gap-1.5">
                      <span>Personel Adı Soyadı</span>
                      {sortField === 'fullName' ? (sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-400" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-400" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}
                    </div>
                  </th>
                  <th onClick={() => toggleSort('position')} className="p-3.5 font-black cursor-pointer hover:text-white">
                    <div className="flex items-center gap-1.5">
                      <span>Görevi / Pozisyon</span>
                      {sortField === 'position' ? (sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-400" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-400" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}
                    </div>
                  </th>
                  <th className="p-3.5 font-black">İletişim & IBAN</th>
                  <th onClick={() => toggleSort('salary')} className="p-3.5 font-black text-right cursor-pointer hover:text-white">
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Aylık Maaş</span>
                      {sortField === 'salary' ? (sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-400" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-400" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}
                    </div>
                  </th>
                  <th className="p-3.5 font-black text-right">Saatlik Ücret (8s/gün)</th>
                  <th onClick={() => toggleSort('balance')} className="p-3.5 font-black text-right cursor-pointer hover:text-white">
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Kalan Hakediş / Borç</span>
                      {sortField === 'balance' ? (sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-400" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-400" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}
                    </div>
                  </th>
                  <th className="p-3.5 font-black text-center w-48">Hızlı Aksiyonlar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202028]">
                {processedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#8E8E98]">
                      Arama kriterlerine uygun personel kaydı bulunamadı.
                    </td>
                  </tr>
                ) : (
                  processedEmployees.map((emp) => {
                    const hasBalance = Math.abs(Number(emp.balance) || 0) > 0.01;
                    const hourlyRate = Math.round(((emp.salary || 0) / (8 * 26)) * 100) / 100;
                    const isWaiter = (emp.position || '').toLowerCase().includes('garson');

                    return (
                      <tr key={emp.id} className="hover:bg-[#18181F] transition-colors">
                        {/* Personel Adı */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-[#282830] text-amber-400 font-bold flex items-center justify-center text-xs">
                              {emp.fullName.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-black text-white flex items-center gap-1.5">
                                {emp.fullName}
                                {isWaiter && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-500/20 text-blue-300 font-bold">
                                    Garson
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-[#8E8E98]">
                                {emp.startDate ? `Giriş: ${emp.startDate}` : 'Aktif Kadro'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Görevi */}
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 rounded-xl bg-[#141416] border border-[#2C2C34] text-xs font-bold text-[#E4E4E8]">
                            {emp.position || 'Personel'}
                          </span>
                        </td>

                        {/* İletişim */}
                        <td className="p-3.5 text-[#8E8E98]">
                          <div className="font-mono text-white text-xs">{emp.phone || '-'}</div>
                          {emp.iban && (
                            <div className="text-[10px] font-mono text-[#A0A0AA] truncate max-w-[150px]" title={emp.iban}>
                              {emp.iban}
                            </div>
                          )}
                        </td>

                        {/* Aylık Maaş */}
                        <td className="p-3.5 text-right font-mono font-bold text-white text-xs">
                          {formatMoney(emp.salary)}
                        </td>

                        {/* Standart Saatlik Ücret */}
                        <td className="p-3.5 text-right font-mono text-amber-300 text-xs">
                          {hourlyRate.toFixed(2)} ₺/s
                        </td>

                        {/* Kalan Hakediş / Borç */}
                        <td className="p-3.5 text-right">
                          <div className={`font-mono font-black text-xs ${emp.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {formatMoney(emp.balance)}
                          </div>
                          <div className="text-[10px] text-[#8E8E98]">
                            {emp.balance > 0 ? 'Ödenecek Borç' : 'Hesap Sıfırlandı'}
                          </div>
                        </td>

                        {/* İşlemler */}
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* + Mesai Ekle */}
                            <button
                              onClick={() => handleOpenOvertime(emp.id)}
                              className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                              title="Bu personele fazla mesai ekle"
                            >
                              + Mesai
                            </button>

                            {/* + Avans / Ödeme */}
                            <button
                              onClick={() => handleOpenPayment(emp.id, 'ADVANCE')}
                              className="px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                              title="Avans veya maaş ödemesi yap"
                            >
                              + Ödeme
                            </button>

                            {/* Ekstre */}
                            <button
                              onClick={() => handleOpenStatement(emp)}
                              className="p-1.5 text-[#8E8E98] hover:text-white hover:bg-[#282830] rounded-lg transition-colors cursor-pointer"
                              title="Hesap Dökümü & Ekstre"
                            >
                              <FileText className="w-4 h-4" />
                            </button>

                            {/* Düzenle */}
                            <button
                              onClick={() => handleOpenEditEmployee(emp)}
                              className="p-1.5 text-[#8E8E98] hover:text-[#F5C877] hover:bg-[#282830] rounded-lg transition-colors cursor-pointer"
                              title="Düzenle"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Silme */}
                            <button
                              onClick={() => handleDeleteEmployee(emp)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                hasBalance ? 'text-[#8E8E98] hover:text-amber-400 hover:bg-amber-500/10' : 'text-rose-400 hover:bg-rose-500/10'
                              }`}
                              title={hasBalance ? 'Hesap bakiyesi olduğu için silinemez' : 'Sil'}
                            >
                              {hasBalance ? <Lock className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
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

      {/* ========================================================================= */}
      {/* TAB 2: MESAİ & FAZLA ÇALIŞMA YÖNETİMİ */}
      {/* ========================================================================= */}
      {activeTab === 'overtime' && (
        <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] overflow-hidden shadow-sm p-4 sm:p-6 space-y-5">
          {/* Mesai Üst Özet Kartları */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 bg-[#141416] rounded-2xl border border-[#26262E]">
              <div className="text-xs font-bold text-[#8E8E98]">Toplam Kayıtlı Mesai Saati</div>
              <div className="text-xl font-mono font-black text-amber-300 mt-1">
                {currentMonthOvertimeHours} Saat
              </div>
              <div className="text-[10px] text-[#A0A0AA] mt-0.5">Tüm personeller toplamı</div>
            </div>

            <div className="p-4 bg-[#141416] rounded-2xl border border-[#26262E]">
              <div className="text-xs font-bold text-[#8E8E98]">Gününde Nakit Ödenen Mesailer</div>
              <div className="text-xl font-mono font-black text-emerald-400 mt-1">
                {formatMoney(
                  overtimePayments
                    .filter(p => p.payoutType === 'CASH_IMMEDIATE')
                    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
                )}
              </div>
              <div className="text-[10px] text-emerald-400">Kasadan anında kapatıldı</div>
            </div>

            <div className="p-4 bg-[#141416] rounded-2xl border border-[#26262E]">
              <div className="text-xs font-bold text-[#8E8E98]">Maaş Hakedişine Eklenenler</div>
              <div className="text-xl font-mono font-black text-purple-400 mt-1">
                {formatMoney(
                  overtimePayments
                    .filter(p => p.payoutType === 'SALARY_ACCRUAL')
                    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
                )}
              </div>
              <div className="text-[10px] text-purple-400">Ay sonu bordroya yansıtılacak</div>
            </div>
          </div>

          {/* Mesai Filtreleri & Aksiyon */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Personel Seçimi */}
              <select
                value={overtimeEmpFilter}
                onChange={(e) => setOvertimeEmpFilter(e.target.value)}
                className="p-2 bg-[#121214] border border-[#2C2C34] rounded-xl text-xs font-bold text-white focus:outline-none"
              >
                <option value="ALL">Tüm Personeller</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName}</option>
                ))}
              </select>

              {/* Ödeme Türü Seçimi */}
              <div className="flex bg-[#121214] border border-[#2C2C34] rounded-xl p-0.5 text-xs">
                <button
                  onClick={() => setOvertimePayoutFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                    overtimePayoutFilter === 'ALL' ? 'bg-[#282830] text-amber-300' : 'text-[#8E8E98]'
                  }`}
                >
                  Tümü
                </button>
                <button
                  onClick={() => setOvertimePayoutFilter('CASH')}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                    overtimePayoutFilter === 'CASH' ? 'bg-[#282830] text-emerald-400' : 'text-[#8E8E98]'
                  }`}
                >
                  Gününde Nakit
                </button>
                <button
                  onClick={() => setOvertimePayoutFilter('SALARY')}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                    overtimePayoutFilter === 'SALARY' ? 'bg-[#282830] text-purple-400' : 'text-[#8E8E98]'
                  }`}
                >
                  Maaşa Eklenen
                </button>
              </div>
            </div>

            <button
              onClick={() => handleOpenOvertime()}
              className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black rounded-xl text-xs flex items-center gap-1.5 shadow cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Mesai Girişi Yap</span>
            </button>
          </div>

          {/* Mesai Kayıtları Tablosu */}
          <div className="overflow-x-auto border border-[#26262E] rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#26262E] text-[#8E8E98] bg-[#141416]">
                  <th className="p-3 font-black">Tarih</th>
                  <th className="p-3 font-black">Personel</th>
                  <th className="p-3 font-black text-center">Mesai Süresi</th>
                  <th className="p-3 font-black text-center">Normal Çalışma</th>
                  <th className="p-3 font-black text-center">Katsayı / Tarife</th>
                  <th className="p-3 font-black text-right">Mesai Ücreti</th>
                  <th className="p-3 font-black">Ödeme Yöntemi</th>
                  <th className="p-3 font-black">Açıklama</th>
                  <th className="p-3 font-black text-center w-12">Sil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202028]">
                {filteredOvertimes.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-[#8E8E98]">
                      Kayıtlı fazla mesai bulunmuyor. Yeni mesai eklemek için üstteki butonu kullanabilirsiniz.
                    </td>
                  </tr>
                ) : (
                  filteredOvertimes.map((p) => {
                    const emp = employees.find(e => e.id === p.employeeId);
                    const isCash = p.payoutType === 'CASH_IMMEDIATE';

                    return (
                      <tr key={p.id} className="hover:bg-[#18181F] transition-colors">
                        <td className="p-3 font-mono text-[#C4C4CC] whitespace-nowrap">
                          {p.date}
                        </td>
                        <td className="p-3 font-bold text-white whitespace-nowrap">
                          {emp?.fullName || 'Bilinmeyen'}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-black">
                            {p.overtimeHours || 0} Saat
                          </span>
                        </td>
                        <td className="p-3 text-center text-[#8E8E98] font-mono whitespace-nowrap">
                          {p.normalDailyHours || 8} Saat/Gün
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {p.isManualAmount ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-300 font-bold">
                              El ile Manuel
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-300 font-bold">
                              {p.overtimeMultiplier || 1.5}x Katsayı
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-amber-400 text-xs whitespace-nowrap">
                          {formatMoney(p.amount)}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {isCash ? (
                            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 font-bold text-[10px] border border-emerald-500/30 flex items-center gap-1 w-fit">
                              <Banknote className="w-3 h-3" /> Gününde Nakit Ödendi
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-xl bg-purple-500/15 text-purple-300 font-bold text-[10px] border border-purple-500/30 flex items-center gap-1 w-fit">
                              <CreditCard className="w-3 h-3" /> Maaşa / Hakedişe Eklendi
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-[#A0A0AA] max-w-xs truncate text-[11px]" title={p.description}>
                          {p.description || '-'}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleDeletePaymentItem(p.id)}
                            className="p-1 text-[#8E8E98] hover:text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer transition-colors"
                            title="Mesai kaydını sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* ========================================================================= */}
      {/* TAB 3: MAAŞ, AVANS & TÜM ÖDEMELER */}
      {/* ========================================================================= */}
      {activeTab === 'payments' && (
        <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] overflow-hidden shadow-sm p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#8E8E98]">İşlem Filtresi:</span>
              <div className="flex bg-[#121214] border border-[#2C2C34] rounded-xl p-1 text-xs">
                {[
                  { id: 'ALL', label: 'Tüm Hareketler' },
                  { id: 'SALARY_ACCRUAL', label: 'Maaş Tahakkuku' },
                  { id: 'OVERTIME_ACCRUAL', label: 'Mesailer' },
                  { id: 'ADVANCE', label: 'Avanslar' },
                  { id: 'SALARY_PAYMENT', label: 'Maaş Ödemeleri' },
                  { id: 'BONUS', label: 'Prim / Bahşiş' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setPaymentTypeFilter(item.id)}
                    className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      paymentTypeFilter === item.id ? 'bg-[#282830] text-amber-300' : 'text-[#8E8E98]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleOpenPayment(undefined, 'ADVANCE')}
              className="px-4 py-2 bg-emerald-500 text-black font-black rounded-xl text-xs flex items-center gap-1.5 shadow cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Ödeme / Avans Gir</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-[#26262E] rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#26262E] text-[#8E8E98] bg-[#141416]">
                  <th className="p-3 font-black">Tarih</th>
                  <th className="p-3 font-black">Personel</th>
                  <th className="p-3 font-black">İşlem Türü</th>
                  <th className="p-3 font-black">Açıklama</th>
                  <th className="p-3 font-black">Ödeme Kanalı</th>
                  <th className="p-3 font-black text-right">Hakediş (+)</th>
                  <th className="p-3 font-black text-right">Ödenen (-)</th>
                  <th className="p-3 font-black text-center w-12">Sil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202028]">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-[#8E8E98]">
                      Seçilen filtreye uygun hareket kaydı bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => {
                    const emp = employees.find(e => e.id === p.employeeId);
                    const isAccrual = 
                      p.type === 'SALARY_ACCRUAL' || 
                      p.type === 'OVERTIME_ACCRUAL' || 
                      p.type === 'BONUS' || 
                      p.type === 'TERMINATION_SETTLEMENT';

                    return (
                      <tr key={p.id} className="hover:bg-[#18181F] transition-colors">
                        <td className="p-3 font-mono text-[#C4C4CC] whitespace-nowrap">
                          {p.date}
                        </td>
                        <td className="p-3 font-bold text-white whitespace-nowrap">
                          {emp?.fullName || 'Bilinmeyen'}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {p.type === 'SALARY_ACCRUAL' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300">Maaş Hakedişi</span>}
                          {p.type === 'OVERTIME_ACCRUAL' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">Mesai Hakedişi</span>}
                          {p.type === 'OVERTIME_PAYMENT' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">Nakit Mesai Ödendi</span>}
                          {p.type === 'ADVANCE' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">Avans</span>}
                          {p.type === 'SALARY_PAYMENT' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">Maaş Ödemesi</span>}
                          {p.type === 'BONUS' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300">Prim / Bahşiş</span>}
                          {p.type === 'DEDUCTION' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300">Kesinti</span>}
                        </td>
                        <td className="p-3 text-white max-w-sm truncate text-[11px]" title={p.description}>
                          {p.description || '-'}
                        </td>
                        <td className="p-3 text-[#8E8E98] whitespace-nowrap">
                          {p.paymentMethod === 'BANK' ? 'Banka Havalesi' : 'Nakit Kasa'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-purple-400 whitespace-nowrap">
                          {isAccrual ? `+${formatMoney(p.amount)}` : '-'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                          {!isAccrual ? `-${formatMoney(p.amount)}` : '-'}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleDeletePaymentItem(p.id)}
                            className="p-1 text-[#8E8E98] hover:text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer transition-colors"
                            title="Bu kaydı sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* ========================================================================= */}
      {/* TAB 4: GARSON MASALARI & QR / PIN YÖNETİMİ */}
      {/* ========================================================================= */}
      {activeTab === 'waiters' && (
        <WaitersTab 
          waiters={waiters} 
          sections={restaurantDataService.getSections()} 
          onRefresh={loadWaiters} 
          embedded={true}
        />
      )}

      {/* ========================================================================= */}
      {/* MODALLAR */}
      {/* ========================================================================= */}

      {/* 1. MESAİ EKLEME & HESAPLAMA MODALI */}
      <OvertimeModal
        isOpen={isOvertimeModalOpen}
        onClose={() => setIsOvertimeModalOpen(false)}
        employees={employees}
        initialEmployeeId={selectedOvertimeEmpId}
        onSuccess={handleRefreshAll}
      />

      {/* 2. AVANS & MAAŞ ÖDEME MODALI */}
      <EmployeePaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        employees={employees}
        initialEmployeeId={selectedPaymentEmpId}
        initialType={paymentModalType}
        onSuccess={handleRefreshAll}
      />

      {/* 3. PERSONEL EKSTRESİ & HESAP DÖKÜMÜ MODALI */}
      <EmployeeStatementModal
        isOpen={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
        employee={selectedStatementEmp}
        onUpdate={handleRefreshAll}
      />

      {/* 4. TOPLU MAAŞ TAHAKKUKU MODALI */}
      <BatchSalaryModal
        isOpen={isBatchSalaryModalOpen}
        onClose={() => setIsBatchSalaryModalOpen(false)}
        employees={employees}
        onSuccess={handleRefreshAll}
      />

      {/* 5. PERSONEL EKLE / DÜZENLE MODALI */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white">
                {editingEmployee ? 'Personeli Düzenle' : 'Yeni Personel Ekle'}
              </h3>
              <button 
                onClick={() => setIsEmployeeModalOpen(false)} 
                className="text-[#8E8E98] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Personel Adı Soyadı</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Örn: Serkan Kaya"
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Görevi / Pozisyonu</label>
                  <input
                    type="text"
                    required
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                    placeholder="Örn: Garson / Aşçı / Kurye"
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Aylık Maaşı (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formSalary}
                    onChange={(e) => setFormSalary(e.target.value)}
                    placeholder="25000.00"
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono font-bold text-rose-400 focus:border-[#F5C877] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Telefon Numarası</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="0532..."
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono font-bold text-[#F5C877] focus:border-[#F5C877] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">İşe Giriş Tarihi</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">IBAN Numarası</label>
                <input
                  type="text"
                  value={formIban}
                  onChange={(e) => setFormIban(e.target.value)}
                  placeholder="TR..."
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsEmployeeModalOpen(false)} 
                  className="px-4 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] rounded-xl text-xs font-black shadow-lg cursor-pointer"
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
