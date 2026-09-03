import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Phone, 
  UserCheck, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Calendar, 
  Clock, 
  Printer, 
  Download, 
  UserMinus, 
  UserPlus, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  Calculator,
  Eye,
  EyeOff,
  Flame,
  Wallet
} from 'lucide-react';
import { dataService, Employee, EmployeePayment, EmployeeStatus } from '../../services/dataService';
import { exportService } from '../../services/exportService';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface EmployeeListViewProps {
  employees: Employee[];
  onRefresh: () => void;
  onOpenPaymentModal: (employeeId?: string, defaultType?: 'SALARY_PAYMENT' | 'SALARY_ACCRUAL' | 'ADVANCE') => void;
}

type EmpSortField = 'fullName' | 'position' | 'salary' | 'balance' | 'startDate';
type EmpSortOrder = 'asc' | 'desc' | null;
type StatusFilter = 'ALL' | 'ACTIVE' | 'TERMINATED' | 'HAS_BALANCE';

export const EmployeeListView: React.FC<EmployeeListViewProps> = ({ employees, onRefresh, onOpenPaymentModal }) => {
  const company = dataService.getCompanySettings();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [hideSalaries, setHideSalaries] = useState(true);
  const [revealedEmpIds, setRevealedEmpIds] = useState<string[]>([]);

  const [sortField, setSortField] = useState<EmpSortField>('balance');
  const [sortOrder, setSortOrder] = useState<EmpSortOrder>('desc');

  const [showModal, setShowModal] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');
  const [iban, setIban] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [payday, setPayday] = useState('1');

  // === FAZLA MESAİ MODALI STATE'LERİ ===
  const [overtimeEmployee, setOvertimeEmployee] = useState<Employee | null>(null);
  const [overtimeDate, setOvertimeDate] = useState(new Date().toISOString().split('T')[0]);
  const [overtimeAmount, setOvertimeAmount] = useState('');
  const [overtimeDesc, setOvertimeDesc] = useState('Akşam Yoğunluk Mesaisi');
  const [overtimePayoutType, setOvertimePayoutType] = useState<'INSTANT_CASH' | 'INSTANT_BANK' | 'ACCRUE_TO_SALARY'>('INSTANT_CASH');

  const [terminatingEmployee, setTerminatingEmployee] = useState<Employee | null>(null);
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveReason, setLeaveReason] = useState('İstifa / Kendi İsteğiyle Ayrıldı');
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementDesc, setSettlementDesc] = useState('');
  const [calculatedDays, setCalculatedDays] = useState(0);
  const [dailyRate, setDailyRate] = useState(0);

  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [paymentToDeleteId, setPaymentToDeleteId] = useState<string | null>(null);

  const [editingPayment, setEditingPayment] = useState<EmployeePayment | null>(null);
  const [payType, setPayType] = useState<'SALARY_ACCRUAL' | 'ADVANCE' | 'SALARY_PAYMENT' | 'BONUS' | 'DEDUCTION' | 'TERMINATION_SETTLEMENT' | 'OVERTIME_ACCRUAL' | 'OVERTIME_PAYMENT'>('SALARY_PAYMENT');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'BANK'>('BANK');
  const [payDate, setPayDate] = useState('');
  const [payDesc, setPayDesc] = useState('');

  const safeEmployees = Array.isArray(employees) ? employees : [];
  const activeCount = safeEmployees.filter(e => e.status === 'ACTIVE').length;
  const terminatedCount = safeEmployees.filter(e => e.status === 'TERMINATED').length;
  const hasBalanceCount = safeEmployees.filter(e => e.balance > 0).length;

  const toggleSingleReveal = (empId: string) => {
    setRevealedEmpIds(prev => prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]);
  };
  const isSalaryVisible = (empId: string) => (!hideSalaries) || revealedEmpIds.includes(empId);

  // === MESAİ HESAPLAMA MOTORU ===
  const workHours = company.dailyWorkHours || 10;
  const multiplier = company.overtimeMultiplier || 1.5;
  const monthlyHours = workHours * 30;

  const otHourly = overtimeEmployee ? Math.round(((overtimeEmployee.salary / monthlyHours) * multiplier) * 100) / 100 : 0;
  const otDaily = overtimeEmployee ? Math.round((overtimeEmployee.salary / 30) * 100) / 100 : 0;

  const handleOpenOvertime = (emp: Employee) => {
    setOvertimeEmployee(emp);
    setOvertimeDate(new Date().toISOString().split('T')[0]);
    setOvertimePayoutType('INSTANT_CASH');
    
    // Varsayılan: 2 Saatlik Mesaiyi formüle göre hesapla ve otomatik yaz
    const defaultAmount = Math.round((((emp.salary / monthlyHours) * multiplier) * 2) * 100) / 100;
    setOvertimeAmount(defaultAmount > 0 ? defaultAmount.toString() : '');
    setOvertimeDesc('2 Saat Fazla Mesai');
  };

  const setQuickOvertime = (hoursOrDay: number, isDay = false) => {
    if (!overtimeEmployee) return;
    if (isDay) {
      setOvertimeAmount(otDaily.toString());
      setOvertimeDesc('1 Tam Gün Extra Yevmiye');
    } else {
      const total = Math.round((otHourly * hoursOrDay) * 100) / 100;
      setOvertimeAmount(total.toString());
      setOvertimeDesc(`${hoursOrDay} Saat Fazla Mesai`);
    }
  };

  const handleSaveOvertime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overtimeEmployee) return;
    if (!overtimeAmount || Number(overtimeAmount) <= 0) return alert('Lütfen geçerli bir mesai tutarı girin');

    dataService.addEmployeeOvertime(overtimeEmployee.id, {
      amount: Number(overtimeAmount),
      date: overtimeDate,
      description: overtimeDesc,
      payoutType: overtimePayoutType
    });

    setOvertimeEmployee(null);
    onRefresh();
  };

  const autoCalculateSettlement = (emp: Employee, targetLeaveDate: string) => {
    if (!emp || !emp.salary || emp.salary <= 0 || !emp.startDate || !targetLeaveDate) return { days: 0, rate: 0, amount: 0, desc: '' };
    const leaveObj = new Date(targetLeaveDate);
    const startObj = new Date(emp.startDate);
    const dRate = Math.round((emp.salary / 30) * 100) / 100;
    const accruals = (emp.payments || []).filter(p => p.type === 'SALARY_ACCRUAL');
    let lastPeriodStartObj = startObj;
    if (accruals.length > 0) {
      const sortedAccruals = [...accruals].sort((a, b) => b.date.localeCompare(a.date));
      const latestAccrualDate = new Date(sortedAccruals[0].date);
      if (!isNaN(latestAccrualDate.getTime()) && latestAccrualDate > startObj) lastPeriodStartObj = latestAccrualDate;
    }
    let diffDays = 0;
    if (leaveObj >= lastPeriodStartObj) {
      const diffTime = leaveObj.getTime() - lastPeriodStartObj.getTime();
      diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      if (lastPeriodStartObj.getTime() === startObj.getTime()) diffDays += 1;
    }
    if (diffDays <= 0) diffDays = 1;
    if (diffDays > 30) diffDays = 30;
    const finalAmount = Math.round((dRate * diffDays) * 100) / 100;
    const desc = `${diffDays} Günlük Son Çalışma Hakedişi (${formatDate(lastPeriodStartObj)} - ${formatDate(targetLeaveDate)})`;
    return { days: diffDays, rate: dRate, amount: finalAmount, desc };
  };

  const handleOpenTerminate = (emp: Employee) => {
    setTerminatingEmployee(emp);
    const today = new Date().toISOString().split('T')[0];
    setLeaveDate(today);
    setLeaveReason('İstifa / Kendi İsteğiyle Ayrıldı');
    const result = autoCalculateSettlement(emp, today);
    setCalculatedDays(result.days);
    setDailyRate(result.rate);
    setSettlementAmount(result.amount > 0 ? result.amount.toString() : '');
    setSettlementDesc(result.desc);
  };

  const handleLeaveDateChange = (newDate: string) => {
    setLeaveDate(newDate);
    if (terminatingEmployee) {
      const result = autoCalculateSettlement(terminatingEmployee, newDate);
      setCalculatedDays(result.days);
      setDailyRate(result.rate);
      setSettlementAmount(result.amount > 0 ? result.amount.toString() : '');
      setSettlementDesc(result.desc);
    }
  };

  const handleSort = (field: EmpSortField) => {
    if (sortField === field) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else if (sortOrder === 'desc') { setSortField('fullName'); setSortOrder(null); }
      else setSortOrder('asc');
    } else { setSortField(field); setSortOrder('asc'); }
  };

  const handleOpenAdd = () => {
    setEditingEmpId(null); setFullName(''); setPhone(''); setPosition(''); setSalary(''); setIban(''); setStartDate(new Date().toISOString().split('T')[0]); setPayday('1'); setShowModal(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmpId(emp.id); setFullName(emp.fullName); setPhone(emp.phone || ''); setPosition(emp.position || ''); setSalary(emp.salary.toString()); setIban(emp.iban || ''); setStartDate(emp.startDate || emp.createdAt || new Date().toISOString().split('T')[0]); setPayday((emp.payday || 1).toString()); setShowModal(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return alert('Lütfen personel ad ve soyadını girin');
    if (!salary || Number(salary) < 0) return alert('Lütfen geçerli bir maaş girin');
    dataService.saveEmployee({ id: editingEmpId || undefined, fullName: fullName.trim(), phone: phone.trim(), position: position.trim(), salary: Number(salary), iban: iban.trim(), startDate, payday: Number(payday) || 1, initialBalance: 0 });
    setShowModal(false); onRefresh();
  };

  const handleConfirmTerminate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminatingEmployee) return;
    dataService.terminateEmployee(terminatingEmployee.id, leaveDate, leaveReason, Number(settlementAmount) || 0, settlementDesc);
    setTerminatingEmployee(null); onRefresh();
  };

  const handleReactivate = (emp: Employee) => {
    if (confirm(`"${emp.fullName}" isimli eski personeli yeniden Aktif Çalışan durumuna almak istiyor musunuz?`)) { dataService.reactivateEmployee(emp.id); onRefresh(); }
  };

  const handleConfirmDeleteEmployee = () => {
    if (!employeeToDelete) return;
    dataService.deleteEmployee(employeeToDelete.id); setEmployeeToDelete(null); onRefresh();
  };

  const handleOpenEditPayment = (p: EmployeePayment) => {
    setEditingPayment(p); setPayType(p.type); setPayAmount(p.amount.toString()); setPayMethod(p.paymentMethod); setPayDate(p.date); setPayDesc(p.description || '');
  };

  const handleDeletePayment = (paymentId: string) => {
    if (!selectedEmployee) return;
    if (confirm('Bu maaş/ödeme hareketini dökümden silmek istediğinize emin misiniz? Bakiye otomatik güncellenecektir.')) {
      const updated = dataService.deleteEmployeePayment(selectedEmployee.id, paymentId);
      if (updated) { setSelectedEmployee({ ...updated }); onRefresh(); }
    }
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !editingPayment) return;
    if (!payAmount || Number(payAmount) <= 0) return alert('Lütfen geçerli bir tutar girin');
    const updated = dataService.updateEmployeePayment(selectedEmployee.id, editingPayment.id, { type: payType, amount: Number(payAmount), paymentMethod: payMethod, date: payDate || new Date().toISOString().split('T')[0], description: payDesc });
    if (updated) { setSelectedEmployee({ ...updated }); setEditingPayment(null); onRefresh(); }
  };

  const processedEmployees = [...safeEmployees]
    .filter(e => {
      if (statusFilter === 'ACTIVE' && e.status !== 'ACTIVE') return false;
      if (statusFilter === 'TERMINATED' && e.status !== 'TERMINATED') return false;
      if (statusFilter === 'HAS_BALANCE' && e.balance <= 0) return false;
      return e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || (e.position && e.position.toLowerCase().includes(searchTerm.toLowerCase())) || (e.phone && e.phone.includes(searchTerm));
    })
    .sort((a, b) => {
      if (!sortOrder || !sortField) return 0;
      let comp = 0;
      if (sortField === 'fullName') comp = a.fullName.localeCompare(b.fullName, 'tr');
      else if (sortField === 'position') comp = (a.position || '').localeCompare(b.position || '', 'tr');
      else if (sortField === 'salary') comp = a.salary - b.salary;
      else if (sortField === 'balance') comp = a.balance - b.balance;
      else if (sortField === 'startDate') comp = (a.startDate || '').localeCompare(b.startDate || '');
      return sortOrder === 'asc' ? comp : -comp;
    });

  const renderSortIcon = (field: EmpSortField) => {
    if (sortField !== field || sortOrder === null) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-600 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600 font-bold" />;
  };

  return (
    <div className="p-10 space-y-8 max-w-[1700px] mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Personeller & Maaş Yönetimi</h2>
          <p className="text-xs text-slate-500">Maaşlar, fazla mesailer, avanslar ve hakediş takibi</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setHideSalaries(!hideSalaries)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm border ${
              hideSalaries ? 'bg-slate-900 text-amber-400 border-slate-800 hover:bg-slate-800' : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
            }`}
            title={hideSalaries ? "Maaşları Ekranda Göster" : "Maaşları Gizle"}
          >
            {hideSalaries ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4 text-amber-600" />}
            <span>{hideSalaries ? 'Maaşlar Gizli' : 'Maaşlar Görünür'}</span>
          </button>
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Personel veya görev ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm select-text cursor-text" />
          </div>
          <button onClick={handleOpenAdd} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer">
            <Plus className="w-4 h-4" /><span>Yeni Personel Ekle</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-slate-200/80 p-1.5 rounded-2xl border border-slate-300 w-fit select-none">
        <button type="button" onClick={() => setStatusFilter('ACTIVE')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${statusFilter === 'ACTIVE' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'text-slate-600 hover:bg-slate-300/60'}`}><span className="w-2 h-2 rounded-full bg-emerald-300"></span><span>🟢 Aktif Çalışanlar ({activeCount})</span></button>
        <button type="button" onClick={() => setStatusFilter('TERMINATED')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${statusFilter === 'TERMINATED' ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20' : 'text-slate-600 hover:bg-slate-300/60'}`}><UserMinus className="w-3.5 h-3.5 text-slate-300" /><span>🔴 İşten Ayrılanlar ({terminatedCount})</span></button>
        <button type="button" onClick={() => setStatusFilter('HAS_BALANCE')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${statusFilter === 'HAS_BALANCE' ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20' : 'text-slate-600 hover:bg-slate-300/60'}`}><AlertTriangle className="w-3.5 h-3.5 text-rose-200" /><span>⚠️ Alacağı Kalanlar ({hasBalanceCount})</span></button>
        <button type="button" onClick={() => setStatusFilter('ALL')} className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-300/60'}`}>Tümü ({safeEmployees.length})</button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase select-none">
            <tr>
              <th onClick={() => handleSort('fullName')} className="py-4 px-6 cursor-pointer hover:bg-slate-100/80 group"><div className="flex items-center gap-1.5"><span className={sortField === 'fullName' ? 'text-blue-600 font-black' : ''}>Personel Ad Soyad</span>{renderSortIcon('fullName')}</div></th>
              <th onClick={() => handleSort('position')} className="py-4 px-6 cursor-pointer hover:bg-slate-100/80 group"><div className="flex items-center gap-1.5"><span className={sortField === 'position' ? 'text-blue-600 font-black' : ''}>Görevi</span>{renderSortIcon('position')}</div></th>
              <th onClick={() => handleSort('salary')} className="py-4 px-6 text-right cursor-pointer hover:bg-slate-100/80 group"><div className="flex items-center justify-end gap-1.5"><span className={sortField === 'salary' ? 'text-blue-600 font-black' : ''}>Maaş & Ödeme Günü</span>{renderSortIcon('salary')}</div></th>
              <th className="py-4 px-6">İletişim & IBAN</th>
              <th onClick={() => handleSort('balance')} className="py-4 px-6 text-right cursor-pointer hover:bg-slate-100/80 group"><div className="flex items-center justify-end gap-1.5"><span className={sortField === 'balance' ? 'text-blue-600 font-black' : ''}>Personele Kalan Borç</span>{renderSortIcon('balance')}</div></th>
              <th className="py-4 px-6 text-center">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {processedEmployees.length === 0 ? (
              <tr><td colSpan={6} className="py-16 text-center text-slate-400"><UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" /><p className="font-bold text-slate-600 text-sm">Bu filtreye uygun personel bulunamadı.</p></td></tr>
            ) : (
              processedEmployees.map(emp => {
                const isTerminated = emp.status === 'TERMINATED';
                const visible = isSalaryVisible(emp.id);

                return (
                  <tr key={emp.id} className={`hover:bg-slate-50/60 transition-colors ${isTerminated ? 'bg-slate-50/40' : ''}`}>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-slate-900 text-sm">{emp.fullName}</div>
                        {isTerminated ? <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full font-bold text-[10px]">İşten Ayrıldı</span> : <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">Aktif</span>}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1"><span>Giriş: {formatDate(emp.startDate)}</span>{emp.leaveDate && <span className="text-rose-600 font-bold">• Çıkış: {formatDate(emp.leaveDate)}</span>}</div>
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-700">{emp.position || '-'}</td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" onClick={() => toggleSingleReveal(emp.id)} className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer" title="Maaşı göster/gizle">
                          {visible ? <Eye className="w-3.5 h-3.5 text-blue-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                        </button>
                        <span className="font-black text-slate-900">{visible ? formatCurrency(emp.salary) : '•••••• ₺'}</span>
                      </div>
                      <div className="text-[10px] text-blue-600 font-bold mt-0.5">Her ayın {emp.payday || 1}'i</div>
                    </td>
                    <td className="py-4 px-6 text-slate-600"><div>{emp.phone || '-'}</div>{emp.iban && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{emp.iban}</div>}</td>
                    <td className="py-4 px-6 text-right">
                      <div className={`font-black text-sm ${emp.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{visible ? formatCurrency(emp.balance) : '•••••• ₺'}</div>
                      <div className="text-[10px] text-slate-400 font-semibold">{emp.balance > 0 ? 'Ödeme Bekliyor' : 'Hesap Kapandı (0 ₺)'}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-1.5">
                        {!isTerminated && (
                          <button onClick={() => handleOpenOvertime(emp)} className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-[11px] shadow-sm flex items-center gap-1 cursor-pointer transition-all" title="Fazla Mesai Ekle (Günlük Öde veya Maaşa Yansıt)">
                            <Flame className="w-3 h-3" /><span>+ Mesai</span>
                          </button>
                        )}
                        {!isTerminated && (
                          <button onClick={() => onOpenPaymentModal(emp.id, 'SALARY_ACCRUAL')} className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-xl text-[11px] border border-amber-200 cursor-pointer" title="Dönem Maaş Hakedişi Ekle">+ Hakediş</button>
                        )}
                        <button onClick={() => onOpenPaymentModal(emp.id, 'SALARY_PAYMENT')} className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-[11px] border border-blue-200 cursor-pointer" title="Ödeme Yap">+ Ödeme</button>
                        <button onClick={() => setSelectedEmployee(emp)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] cursor-pointer" title="Dökümü İncele ve Yazdır">Döküm</button>
                        {!isTerminated ? (
                          <button onClick={() => handleOpenTerminate(emp)} className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-xl text-xs border border-slate-200 cursor-pointer" title="İşten Çıkış / Ayrılış İşlemi Yap"><UserMinus className="w-3.5 h-3.5" /></button>
                        ) : (
                          <button onClick={() => handleReactivate(emp)} className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs border border-emerald-200 cursor-pointer" title="Yeniden Aktif Çalışan Yap"><UserPlus className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => handleOpenEdit(emp)} className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl text-xs border border-slate-200 cursor-pointer" title="Bilgileri Düzenle"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEmployeeToDelete(emp)} className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl text-xs border border-slate-200 cursor-pointer" title="Sil"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* FAZLA MESAİ EKRANI (HIZLI HESAPLAMA MOTORU) */}
      {overtimeEmployee && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4 z-50 animate-fadeIn" onMouseDown={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-3xl max-w-lg w-full p-7 shadow-2xl border-2 border-amber-300 relative z-50 pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shadow-sm">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Fazla Mesai Ekle</h3>
                <p className="text-xs text-slate-500"><strong>{overtimeEmployee.fullName}</strong> için mesai hesaplayın ve ödeme yöntemini seçin</p>
              </div>
            </div>

            <form onSubmit={handleSaveOvertime} className="space-y-4 py-4">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex justify-between items-center">
                <div>
                  <span className="text-slate-500">Saatlik Mesai Ücreti ({company.overtimeMultiplier || 1.5}x):</span>
                  <div className="font-black text-slate-900 text-sm">{formatCurrency(otHourly)} / Saat</div>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Tam Gün Yevmiyesi:</span>
                  <div className="font-black text-slate-900 text-sm">{formatCurrency(otDaily)} / Gün</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Hızlı Süre Seçimi</label>
                <div className="grid grid-cols-4 gap-2">
                  <button type="button" onClick={() => setQuickOvertime(1)} className="py-2 bg-slate-100 hover:bg-amber-100 text-slate-800 hover:text-amber-900 font-black rounded-xl text-xs border border-slate-200 transition-all cursor-pointer">+1 Saat</button>
                  <button type="button" onClick={() => setQuickOvertime(2)} className="py-2 bg-slate-100 hover:bg-amber-100 text-slate-800 hover:text-amber-900 font-black rounded-xl text-xs border border-slate-200 transition-all cursor-pointer">+2 Saat</button>
                  <button type="button" onClick={() => setQuickOvertime(3)} className="py-2 bg-slate-100 hover:bg-amber-100 text-slate-800 hover:text-amber-900 font-black rounded-xl text-xs border border-slate-200 transition-all cursor-pointer">+3 Saat</button>
                  <button type="button" onClick={() => setQuickOvertime(1, true)} className="py-2 bg-amber-50 hover:bg-amber-200 text-amber-950 font-black rounded-xl text-xs border border-amber-300 transition-all cursor-pointer">+1 Gün Yevmiye</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mesai Tutarı (TL) *</label>
                  <input type="number" step="0.01" required value={overtimeAmount} onChange={e => setOvertimeAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 border-2 border-amber-300 focus:border-amber-600 rounded-xl text-sm font-black text-slate-900 bg-white select-text cursor-text focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mesai Tarihi *</label>
                  <input type="date" required value={overtimeDate} onChange={e => setOvertimeDate(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-amber-600 rounded-xl text-xs font-semibold bg-white cursor-pointer focus:outline-none" />
                </div>
              </div>

              <div className="p-3.5 bg-amber-50/70 border-2 border-amber-300 rounded-2xl space-y-2.5">
                <label className="block text-xs font-black text-amber-950">Ödeme Şekli Nasıl Olacak?</label>
                <div className="space-y-2">
                  <label className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${overtimePayoutType === 'INSTANT_CASH' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'}`}>
                    <input type="radio" name="payout" checked={overtimePayoutType === 'INSTANT_CASH'} onChange={() => setOvertimePayoutType('INSTANT_CASH')} className="hidden" />
                    <Wallet className="w-4 h-4 flex-shrink-0" />
                    <div><div className="font-black text-xs">💵 Kasadan Hemen Nakit Öde (Günlük)</div><div className={`text-[10px] ${overtimePayoutType === 'INSTANT_CASH' ? 'text-emerald-100' : 'text-slate-500'}`}>Para hemen personele verilir, maaş bakiyesini bozmaz.</div></div>
                  </label>
                  <label className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${overtimePayoutType === 'ACCRUE_TO_SALARY' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'}`}>
                    <input type="radio" name="payout" checked={overtimePayoutType === 'ACCRUE_TO_SALARY'} onChange={() => setOvertimePayoutType('ACCRUE_TO_SALARY')} className="hidden" />
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <div><div className="font-black text-xs">📅 Maaşına Yansıt / Biriktir (Maaş Günü Öde)</div><div className={`text-[10px] ${overtimePayoutType === 'ACCRUE_TO_SALARY' ? 'text-blue-100' : 'text-slate-500'}`}>Personelin alacak bakiyesine eklenir, ay sonunda maaşıyla ödenir.</div></div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Açıklama / Not</label>
                <input type="text" value={overtimeDesc} onChange={e => setOvertimeDesc(e.target.value)} placeholder="Örn: Akşam 2 saat yoğunluk mesaisi..." className="w-full px-3 py-2 border-2 border-slate-200 focus:border-amber-600 rounded-xl text-xs bg-white select-text cursor-text focus:outline-none" />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setOvertimeEmployee(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Vazgeç</button>
                <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs shadow-md shadow-amber-600/20 cursor-pointer flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /><span>Mesaiyi Kaydet</span></button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* İŞTEN ÇIKIŞ VERME SİHİRBAZI MODALI */}
      {terminatingEmployee && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4 z-50 animate-fadeIn" onMouseDown={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-3xl max-w-lg w-full p-7 shadow-2xl border-2 border-rose-200 relative z-50 pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shadow-sm"><UserMinus className="w-5 h-5" /></div>
              <div>
                <h3 className="text-base font-black text-slate-900">İşten Çıkış & Hesap Tasfiyesi</h3>
                <p className="text-xs text-slate-500"><strong>{terminatingEmployee.fullName}</strong> için ayrılış işlemlerini tamamlayın</p>
              </div>
            </div>
            <form onSubmit={handleConfirmTerminate} className="space-y-4 py-4">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between text-slate-600"><span>İşe Giriş Tarihi:</span><span className="font-bold">{formatDate(terminatingEmployee.startDate)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Sabit Aylık Maaş:</span><span className="font-bold text-slate-900">{formatCurrency(terminatingEmployee.salary)}</span></div>
                <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200"><span>Mevcut Kalan Alacağı:</span><span className="font-black text-rose-600">{formatCurrency(terminatingEmployee.balance)}</span></div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">İşten Ayrılış Tarihi *</label>
                <input type="date" required value={leaveDate} onChange={e => handleLeaveDateChange(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-rose-600 rounded-xl text-xs font-semibold focus:outline-none bg-white cursor-pointer" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ayrılış Nedeni</label>
                <select value={leaveReason} onChange={e => setLeaveReason(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-rose-600 rounded-xl text-xs font-bold focus:outline-none bg-white cursor-pointer">
                  <option value="İstifa / Kendi İsteğiyle Ayrıldı">İstifa / Kendi İsteğiyle Ayrıldı</option>
                  <option value="Karşılıklı Anlaşma (İbra Edildi)">Karşılıklı Anlaşma (İbra Edildi)</option>
                  <option value="İşveren Tarafından Fesih">İşveren Tarafından Fesih</option>
                  <option value="Sezon / Proje Sonu">Sezon / Proje Sonu</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>
              <div className="p-4 bg-amber-50 rounded-2xl border-2 border-amber-300 text-xs space-y-2.5">
                <div className="font-black text-amber-900 flex items-center justify-between"><span className="flex items-center gap-1.5"><Calculator className="w-4 h-4 text-amber-600" /> Otomatik Hesaplanan Son Çalışma Hakedişi</span><span className="bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-lg text-[10px] font-black">{calculatedDays} Gün Çalıştı</span></div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-amber-800 pt-1 border-t border-amber-200/80"><div>Günlük Yevmiye: <strong>{formatCurrency(dailyRate)}</strong></div><div className="text-right">Kıst Tutar: <strong className="text-sm font-black text-amber-950">{formatCurrency(Number(settlementAmount) || 0)}</strong></div></div>
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">Çıkış Hakediş / Tazminat Tutarı (TL)</label>
                  <input type="number" step="0.01" value={settlementAmount} onChange={e => setSettlementAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 border-2 border-amber-400 focus:border-amber-600 rounded-xl text-sm font-black text-slate-900 bg-white focus:outline-none select-text cursor-text" />
                  <p className="text-[10px] text-amber-700 mt-1">Tarihe göre otomatik hesaplandı. Dilerseniz tutarın üzerine kıdem/ihbar tazminatı ekleyebilirsiniz.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setTerminatingEmployee(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Vazgeç</button>
                <button type="submit" className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 cursor-pointer flex items-center gap-1.5"><UserMinus className="w-4 h-4" /><span>İşten Çıkışı Onayla ve Kaydet</span></button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DÖKÜM MODALI */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-7 shadow-2xl border border-slate-200 max-h-[88vh] flex flex-col relative z-50">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900">{selectedEmployee.fullName} - Maaş & Ödeme Dökümü</h3>
                  {selectedEmployee.status === 'TERMINATED' && <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px]">İşten Ayrıldı ({formatDate(selectedEmployee.leaveDate)})</span>}
                </div>
                <p className="text-xs text-slate-500">İşe Giriş: {formatDate(selectedEmployee.startDate)} {selectedEmployee.leaveDate ? `| Çıkış: ${formatDate(selectedEmployee.leaveDate)}` : ''} | Maaş: {formatCurrency(selectedEmployee.salary)}</p>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => exportService.exportSingleEmployeeStatementPdf(selectedEmployee)} className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer" title="Resmi PDF / İbraname Dökümü Al"><Printer className="w-3.5 h-3.5" /><span>Yazdır / İbraname</span></button>
                <button type="button" onClick={() => exportService.exportSingleEmployeeStatementExcel(selectedEmployee)} className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer" title="Excel (.xlsx) Tablosu Olarak İndir"><Download className="w-3.5 h-3.5" /><span>Excel (.xlsx)</span></button>
                <div className="text-right pl-3 border-l border-slate-200">
                  <div className="text-[11px] text-slate-400 font-medium">Kalan Alacak / Bakiye</div>
                  <div className={`text-base font-black ${selectedEmployee.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(selectedEmployee.balance)}</div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Tarih</th>
                    <th className="py-2.5 px-3">Hareket Türü</th>
                    <th className="py-2.5 px-3">Açıklama</th>
                    <th className="py-2.5 px-3">Ödeme Kanalı</th>
                    <th className="py-2.5 px-3 text-right">Tutar</th>
                    <th className="py-2.5 px-3 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!selectedEmployee.payments || selectedEmployee.payments.length === 0) ? (
                    <tr><td colSpan={6} className="py-12 text-center text-slate-400">Hareket kaydı yok.</td></tr>
                  ) : (
                    selectedEmployee.payments.map(p => {
                      const isAddition = p.type === 'SALARY_ACCRUAL' || p.type === 'BONUS' || p.type === 'TERMINATION_SETTLEMENT' || p.type === 'OVERTIME_ACCRUAL';
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{formatDate(p.date)}</td>
                          <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                            {p.type === 'SALARY_ACCRUAL' && <span className="text-blue-600">+ Maaş Hak Edişi</span>}
                            {p.type === 'OVERTIME_ACCRUAL' && <span className="text-amber-600 font-black">+ Fazla Mesai</span>}
                            {p.type === 'OVERTIME_PAYMENT' && <span className="text-purple-600 font-black">- Mesai Ödendi</span>}
                            {p.type === 'TERMINATION_SETTLEMENT' && <span className="text-purple-600">+ Çıkış / Tazminat</span>}
                            {p.type === 'SALARY_PAYMENT' && <span className="text-emerald-600">- Maaş Ödendi</span>}
                            {p.type === 'ADVANCE' && <span className="text-amber-600">- Avans Verildi</span>}
                            {p.type === 'BONUS' && <span className="text-purple-600">+ Prim</span>}
                            {p.type === 'DEDUCTION' && <span className="text-rose-600">- Kesinti</span>}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{p.description || '-'}</td>
                          <td className="py-2.5 px-3 text-slate-500">{p.paymentMethod === 'BANK' ? 'Banka / Havale' : 'Nakit Kasa'}</td>
                          <td className={`py-2.5 px-3 text-right font-black whitespace-nowrap ${isAddition ? 'text-slate-800' : 'text-emerald-600'}`}>
                            {isAddition ? '+' : '-'}{formatCurrency(p.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleOpenEditPayment(p)} className="p-1 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg border border-slate-200 cursor-pointer" title="Düzenle"><Edit2 className="w-3 h-3" /></button>
                              <button onClick={() => handleDeletePayment(p.id)} className="p-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg border border-slate-200 cursor-pointer" title="Sil"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button onClick={() => setSelectedEmployee(null)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs cursor-pointer">Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* DÖKÜM İÇİ HAREKET DÜZENLEME MODALI */}
      {editingPayment && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Maaş/Ödeme/Mesai Hareketini Düzenle</h3>
            <p className="text-xs text-slate-500 mb-4">Kaydın detaylarını değiştirin</p>

            <form onSubmit={handleSavePayment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">İşlem Türü</label>
                <select
                  value={payType}
                  onChange={e => setPayType(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold focus:outline-none bg-white cursor-pointer"
                >
                  <option value="SALARY_PAYMENT">💰 Maaş Ödemesi Yap (Personele Borcu Azaltır)</option>
                  <option value="ADVANCE">💵 Avans Ver (Personele Borcu Azaltır)</option>
                  <option value="OVERTIME_ACCRUAL">🔥 Fazla Mesai Hakedişi (Personele Borcu Artırır)</option>
                  <option value="OVERTIME_PAYMENT">💜 Günlük Mesai Ödemesi (Personele Borcu Azaltır)</option>
                  <option value="SALARY_ACCRUAL">📅 Maaş Hak Edişi Tanımla (Personele Borcu Artırır)</option>
                  <option value="TERMINATION_SETTLEMENT">📋 Çıkış Hakedişi / Tazminat (Personele Borcu Artırır)</option>
                  <option value="BONUS">🎁 Prim / İkramiye (Personele Borcu Artırır)</option>
                  <option value="DEDUCTION">🔻 Maaş Kesintisi (Personele Borcu Azaltır)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tutar (TL) *</label>
                <input type="number" step="0.01" required value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-sm font-bold bg-white select-text cursor-text" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tarih</label>
                <input type="date" required value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs font-semibold bg-white cursor-pointer" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Açıklama</label>
                <input type="text" value={payDesc} onChange={e => setPayDesc(e.target.value)} placeholder="İşlem açıklaması..." className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs bg-white select-text cursor-text" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingPayment(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Vazgeç</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20 cursor-pointer">Değişikliği Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SİLME ONAY MODALLARI */}
      {employeeToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 mb-1">Personeli Sil</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              <strong>"{employeeToDelete.fullName}"</strong> personelini ve tüm kayıtlarını kalıcı olarak silmek istediğinize emin misiniz?
            </p>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setEmployeeToDelete(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Vazgeç</button>
              <button type="button" onClick={handleConfirmDeleteEmployee} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 cursor-pointer">Evet, Sil</button>
            </div>
          </div>
        </div>
      )}

      {paymentToDeleteId && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 mb-1">Hareketi Sil</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Bu maaş hareketini dökümden silmek istediğinize emin misiniz? Bakiye otomatik güncellenecektir.
            </p>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setPaymentToDeleteId(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Vazgeç</button>
              <button type="button" onClick={handleConfirmDeletePayment} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 cursor-pointer">Evet, Sil</button>
            </div>
          </div>
        </div>
      )}

      {/* YENİ PERSONEL EKLEME / DÜZENLEME MODALI */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto relative z-50 pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900 mb-1">{editingEmpId ? 'Personel Bilgilerini Düzenle' : 'Yeni Personel Kartı Oluştur'}</h3>
            <p className="text-xs text-slate-500 mb-4">Personel özlük, işe giriş ve maaş ödeme günü bilgilerini belirleyin</p>

            <form onSubmit={handleSaveEmployee} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Personel Ad Soyad *</label>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Örn: Ad Soyad" className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs bg-white font-medium select-text cursor-text" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Görevi / Pozisyonu</label>
                <input type="text" value={position} onChange={e => setPosition(e.target.value)} placeholder="Örn: Görev / Pozisyon" className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs bg-white select-text cursor-text" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Aylık Sabit Maaş (TL) *</label>
                  <input type="number" step="0.01" required value={salary} onChange={e => setSalary(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold bg-white select-text cursor-text" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Maaş Ödeme Günü *</label>
                  <select value={payday} onChange={e => setPayday(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold bg-white cursor-pointer">
                    <option value="1">Her ayın 1'i</option>
                    <option value="5">Her ayın 5'i</option>
                    <option value="10">Her ayın 10'u</option>
                    <option value="15">Her ayın 15'i</option>
                    <option value="20">Her ayın 20'si</option>
                    <option value="25">Her ayın 25'i</option>
                    <option value="30">Her ayın son günü</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">İşe Başlama Tarihi *</label>
                <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs font-semibold bg-white cursor-pointer" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefon Numarası</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="05XX XXX XX XX" className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs bg-white select-text cursor-text" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">IBAN Numarası</label>
                  <input type="text" value={iban} onChange={e => setIban(e.target.value)} placeholder="TR00 0000 0000 0000 0000 0000 00" className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs font-mono bg-white select-text cursor-text" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Vazgeç</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20 cursor-pointer">{editingEmpId ? 'Değişiklikleri Kaydet' : 'Personeli Kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};