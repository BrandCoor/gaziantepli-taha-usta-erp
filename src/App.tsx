import React, { useState, useRef, useEffect } from 'react';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './modules/dashboard/DashboardView';
import { CustomerListView } from './modules/customers/CustomerListView';
import { EmployeeListView } from './modules/employees/EmployeeListView';
import { ExpenseListView, EXPENSE_CATEGORIES } from './modules/expenses/ExpenseListView';
import { ReportsView } from './modules/reports/ReportsView';
import { UserManagementView } from './modules/users/UserManagementView';
import { CompanySettingsView } from './modules/settings/CompanySettingsView';
import { LoginView } from './modules/auth/LoginView';
import { dataService, PendingSalaryAccrual, User } from './services/dataService';
import { createCircularIconDataUrl } from './utils/imageHelper';
import { formatCurrency, formatDate } from './utils/formatters';
import { AlertCircle, Lock, Bell, CheckCircle2, Calendar, Clock, DollarSign, AlertTriangle, Receipt } from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [customers, setCustomers] = useState(dataService.getCustomers());
  const [employees, setEmployees] = useState(dataService.getEmployees());
  const [suppliers, setSuppliers] = useState(dataService.getSuppliers());
  const [expenses, setExpenses] = useState(dataService.getExpenses());
  const [users, setUsers] = useState(dataService.getUsers());
  const [currentUser, setCurrentUser] = useState(dataService.getCurrentUser());
  const [company, setCompany] = useState(dataService.getCompanySettings());

  // Vadesi Gelen Maaş Hakedişleri
  const [pendingAccruals, setPendingAccruals] = useState<PendingSalaryAccrual[]>([]);
  const [accrualModalOpen, setAccrualModalOpen] = useState(false);

  // Kullanıcı Değiştirme
  const [switchUserModalOpen, setSwitchUserModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [enteredPassword, setEnteredPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Müşteri Borç / Tahsilat
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [modalCustomerId, setModalCustomerId] = useState('');
  const [modalTxType, setModalTxType] = useState<'DEBT' | 'COLLECTION'>('DEBT');
  const [modalTxDate, setModalTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [modalAmount, setModalAmount] = useState('');
  const [modalMethod, setModalMethod] = useState<'CASH' | 'BANK' | 'CREDIT_CARD'>('BANK');
  const [modalDesc, setModalDesc] = useState('');

  // Anlık Gider Modalı (Üst Bar Tetikleyicisi)
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [modalExpTitle, setModalExpTitle] = useState('');
  const [modalExpCategory, setModalExpCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [modalExpSupplier, setModalExpSupplier] = useState('');
  const [modalExpAmount, setModalExpAmount] = useState('');
  const [modalExpMethod, setModalExpMethod] = useState<'CASH' | 'CREDIT_CARD' | 'BANK'>('CASH');
  const [modalExpDate, setModalExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [modalExpDesc, setModalExpDesc] = useState('');

  // Personel Ödeme
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [modalEmployeeId, setModalEmployeeId] = useState('');
  const [modalPayType, setModalPayType] = useState<'SALARY_PAYMENT' | 'ADVANCE' | 'SALARY_ACCRUAL' | 'BONUS' | 'DEDUCTION'>('SALARY_PAYMENT');
  const [modalEmpDate, setModalEmpDate] = useState(new Date().toISOString().split('T')[0]);
  const [modalEmpAmount, setModalEmpAmount] = useState('');
  const [modalEmpMethod, setModalEmpMethod] = useState<'CASH' | 'BANK'>('BANK');
  const [modalEmpDesc, setModalEmpDesc] = useState('');

  const sendCircularIconToWindows = async (base64: string) => {
    if (!base64 || !(window as any).require) return;
    try {
      const circularIcon = await createCircularIconDataUrl(base64);
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send('update-app-icon', circularIcon);
    } catch {}
  };

  useEffect(() => {
    const comp = dataService.getCompanySettings();
    if (comp.logoBase64) {
      sendCircularIconToWindows(comp.logoBase64);
    }
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    refreshAll();
    
    const list = dataService.getPendingSalaryAccruals();
    setPendingAccruals(list);
    if (list.length > 0) {
      setAccrualModalOpen(true);
    }
  };

  const refreshAll = () => {
    setCustomers(dataService.getCustomers());
    setEmployees(dataService.getEmployees());
    setSuppliers(dataService.getSuppliers());
    setExpenses(dataService.getExpenses());
    setUsers(dataService.getUsers());
    setCurrentUser(dataService.getCurrentUser());
    const freshCompany = dataService.getCompanySettings();
    setCompany(freshCompany);
    
    if (freshCompany.logoBase64) {
      sendCircularIconToWindows(freshCompany.logoBase64);
    }

    const list = dataService.getPendingSalaryAccruals();
    setPendingAccruals(list);
  };

  const handleApproveSingleAccrual = (item: PendingSalaryAccrual) => {
    dataService.approveSalaryAccrual(item);
    refreshAll();
    const remaining = pendingAccruals.filter(p => !(p.employeeId === item.employeeId && p.dueDate === item.dueDate));
    setPendingAccruals(remaining);
    if (remaining.length === 0) {
      setAccrualModalOpen(false);
    }
  };

  const handleApproveAllAccruals = () => {
    dataService.approveAllSalaryAccruals(pendingAccruals);
    refreshAll();
    setPendingAccruals([]);
    setAccrualModalOpen(false);
  };

  const openCustomerTx = (customerId?: string, type?: 'DEBT' | 'COLLECTION') => {
    const list = dataService.getCustomers();
    setCustomers(list);
    setModalCustomerId(customerId || (list[0]?.id ?? ''));
    setModalTxType(type || 'DEBT');
    setModalTxDate(new Date().toISOString().split('T')[0]);
    setModalAmount('');
    setModalDesc(type === 'COLLECTION' ? 'Tahsilat Alındı' : 'Sipariş / Hizmet Bedeli');
    setCustomerModalOpen(true);
  };

  const openQuickExpense = () => {
    setModalExpTitle('');
    setModalExpCategory(EXPENSE_CATEGORIES[0]);
    setModalExpSupplier('');
    setModalExpAmount('');
    setModalExpMethod('CASH');
    setModalExpDate(new Date().toISOString().split('T')[0]);
    setModalExpDesc('');
    setExpenseModalOpen(true);
  };

  const openEmployeePay = (employeeId?: string, defaultType?: 'SALARY_PAYMENT' | 'SALARY_ACCRUAL' | 'ADVANCE') => {
    const list = dataService.getEmployees();
    setEmployees(list);
    const targetEmp = employeeId ? list.find(e => e.id === employeeId) : list[0];
    setModalEmployeeId(targetEmp?.id || '');
    setModalEmpDate(new Date().toISOString().split('T')[0]);
    
    const pType = defaultType || 'SALARY_PAYMENT';
    setModalPayType(pType);
    
    if (pType === 'SALARY_ACCRUAL' && targetEmp) {
      setModalEmpAmount(targetEmp.salary.toString());
      setModalEmpDesc(`${new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })} Maaş Hak Edişi`);
    } else {
      setModalEmpAmount('');
      setModalEmpDesc(pType === 'ADVANCE' ? 'Avans Ödemesi' : 'Maaş Ödemesi');
    }
    
    setEmployeeModalOpen(true);
  };

  const handleCustomerTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCustomerId) return alert('Lütfen müşteri seçin');
    if (!modalAmount || Number(modalAmount) <= 0) return alert('Geçerli bir tutar girin');

    dataService.addCustomerTransaction(modalCustomerId, {
      type: modalTxType,
      amount: Number(modalAmount),
      paymentMethod: modalMethod,
      date: modalTxDate || new Date().toISOString().split('T')[0],
      description: modalDesc
    });

    setCustomerModalOpen(false);
    refreshAll();
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalExpTitle.trim()) return alert('Lütfen gider adını girin');
    if (!modalExpAmount || Number(modalExpAmount) <= 0) return alert('Geçerli bir tutar girin');

    dataService.saveExpense({
      title: modalExpTitle,
      category: modalExpCategory,
      supplier: modalExpSupplier,
      amount: Number(modalExpAmount),
      paymentMethod: modalExpMethod,
      date: modalExpDate,
      description: modalExpDesc
    });

    setExpenseModalOpen(false);
    refreshAll();
  };

  const handleEmployeePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEmployeeId) return alert('Lütfen personel seçin');
    if (!modalEmpAmount || Number(modalEmpAmount) <= 0) return alert('Geçerli bir tutar girin');

    const pendingForThisEmp = pendingAccruals.find(p => p.employeeId === modalEmployeeId);
    if ((modalPayType === 'SALARY_PAYMENT' || modalPayType === 'ADVANCE') && pendingForThisEmp) {
      alert(`Bu personelin ${formatCurrency(pendingForThisEmp.salary)} tutarında onay bekleyen hakedişi bulunmaktadır. Lütfen önce onaylayınız.`);
      return;
    }

    dataService.addEmployeePayment(modalEmployeeId, {
      type: modalPayType,
      amount: Number(modalEmpAmount),
      paymentMethod: modalEmpMethod,
      date: modalEmpDate || new Date().toISOString().split('T')[0],
      description: modalEmpDesc
    });

    setEmployeeModalOpen(false);
    refreshAll();
  };

  const handleSwitchUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const freshUsers = dataService.getUsers();
    const userToSwitch = freshUsers.find(u => u.id === selectedUserId);
    
    if (!userToSwitch) {
      setLoginError('Lütfen bir kullanıcı seçin');
      return;
    }

    if (userToSwitch.password !== enteredPassword) {
      setLoginError('Hatalı şifre! Lütfen tekrar deneyin.');
      setEnteredPassword('');
      setTimeout(() => passwordInputRef.current?.focus(), 50);
      return;
    }

    dataService.setCurrentUser(userToSwitch);
    setCurrentUser(userToSwitch);
    setSwitchUserModalOpen(false);
    setEnteredPassword('');
    setLoginError('');
    setActiveTab('dashboard');
    refreshAll();
  };

  const pendingForSelectedEmp = pendingAccruals.find(p => p.employeeId === modalEmployeeId);

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans text-slate-900 antialiased">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <Header 
          pendingAccrualCount={pendingAccruals.length}
          onOpenPendingAccruals={() => setAccrualModalOpen(true)}
          onQuickDebt={() => openCustomerTx(undefined, 'DEBT')}
          onQuickCollection={() => openCustomerTx(undefined, 'COLLECTION')}
          onQuickExpense={openQuickExpense}
          onQuickEmployeePayment={() => openEmployeePay()}
          onSwitchUser={() => {
            const freshUsers = dataService.getUsers();
            setUsers(freshUsers);
            setSelectedUserId(freshUsers[0]?.id || '');
            setEnteredPassword('');
            setLoginError('');
            setSwitchUserModalOpen(true);
          }}
          onLockApp={() => setIsAuthenticated(false)}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50/60 min-w-0">
          {activeTab === 'dashboard' && (
            <DashboardView 
              onNavigate={setActiveTab}
              onQuickDebt={() => openCustomerTx(undefined, 'DEBT')}
              onQuickCollection={() => openCustomerTx(undefined, 'COLLECTION')}
              onQuickExpense={openQuickExpense}
              onQuickEmployeePayment={() => openEmployeePay()}
            />
          )}
          {activeTab === 'customers' && (
            <CustomerListView customers={customers} onRefresh={refreshAll} onOpenTxModal={openCustomerTx} />
          )}
          {activeTab === 'expenses' && (
            <ExpenseListView 
              expenses={expenses} 
              suppliers={suppliers} 
              onRefresh={refreshAll} 
              onOpenAddExpenseModal={openQuickExpense}
            />
          )}
          {activeTab === 'employees' && (
            <EmployeeListView employees={employees} onRefresh={refreshAll} onOpenPaymentModal={openEmployeePay} />
          )}
          {activeTab === 'reports' && (
            <ReportsView />
          )}
          {activeTab === 'users' && (
            <UserManagementView />
          )}
          {activeTab === 'company-settings' && (
            <CompanySettingsView onSettingsSaved={refreshAll} />
          )}
        </main>

        <footer className="h-7 bg-white border-t border-slate-200 px-6 flex items-center justify-between text-[10px] text-slate-500 select-none z-10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="font-semibold text-slate-700">{company.companyName}</span>
            <span className="text-slate-300">|</span>
            <span>Windows Çevrimdışı Güvenli Mod</span>
          </div>

          <div className="flex items-center gap-1 font-medium">
            <span>Özel Tasarım & Yazılım Mimarisi:</span>
            <span className="font-black text-blue-600 tracking-wider">RYMedya</span>
            <span className="text-slate-400">© 2026</span>
          </div>
        </footer>
      </div>

      {/* MAAŞ HAKEDİŞ ONAY POP-UP */}
      {accrualModalOpen && pendingAccruals.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border-2 border-amber-400">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/30">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Vadesi Gelen Maaş Hakediş Bildirimi</h3>
                  <p className="text-xs text-slate-500">Maaş ödeme günü gelen personeller tespit edildi</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-black">
                {pendingAccruals.length} Onay Bekliyor
              </span>
            </div>

            <div className="py-4 space-y-2.5 max-h-72 overflow-y-auto">
              {pendingAccruals.map((item, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 hover:bg-amber-50/40 transition-colors">
                  <div>
                    <div className="font-black text-slate-900 text-sm">{item.employeeName}</div>
                    <div className="text-xs text-slate-600 font-medium">{item.position} • {item.periodText}</div>
                    <div className="text-[10px] text-amber-700 font-bold mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Vade Tarihi: {formatDate(item.dueDate)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-black text-slate-900 text-sm">{formatCurrency(item.salary)}</div>
                      <div className="text-[10px] text-slate-400">Hak Edilen Tutar</div>
                    </div>
                    <button
                      onClick={() => handleApproveSingleAccrual(item)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Onayla</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAccrualModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Daha Sonra Hatırlat (Kapat)
              </button>

              <button
                type="button"
                onClick={handleApproveAllAccruals}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20 flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Tümünü Onayla ve Hakedişleri Ekle</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIZLI ANLIK GİDER MODALI (ÜST BAR TETİKLEYİCİSİ) */}
      {expenseModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fadeIn"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative z-50 pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Receipt className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Yeni Anlık Gider Ekle</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">Kasadan veya karttan ödenen anlık harcamayı kaydedin</p>

            <form onSubmit={handleExpenseSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Harcama / Malzeme Adı *</label>
                <input
                  type="text"
                  required
                  value={modalExpTitle}
                  onChange={e => setModalExpTitle(e.target.value)}
                  placeholder="Örn: Gider / Malzeme Adı"
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-amber-600 rounded-xl text-xs bg-white font-medium select-text cursor-text"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tutar (TL) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={modalExpAmount}
                    onChange={e => setModalExpAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border-2 border-slate-200 focus:border-amber-600 rounded-xl text-sm font-black text-rose-600 bg-white select-text cursor-text"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Harcama Tarihi *</label>
                  <input
                    type="date"
                    required
                    value={modalExpDate}
                    onChange={e => setModalExpDate(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-slate-200 focus:border-amber-600 rounded-xl text-xs font-semibold bg-white cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Gider Kategorisi</label>
                <select
                  value={modalExpCategory}
                  onChange={e => setModalExpCategory(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-amber-600 rounded-xl text-xs font-bold bg-white cursor-pointer"
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ödeme Kanalı</label>
                  <select
                    value={modalExpMethod}
                    onChange={e => setModalExpMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border-2 border-slate-200 focus:border-amber-600 rounded-xl text-xs font-bold bg-white cursor-pointer"
                  >
                    <option value="CASH">💵 Nakit Kasa</option>
                    <option value="CREDIT_CARD">💳 Kredi / Banka Kartı</option>
                    <option value="BANK">🏦 Banka / Havale</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tedarikçi / Alınan Yer</label>
                  <input
                    type="text"
                    value={modalExpSupplier}
                    onChange={e => setModalExpSupplier(e.target.value)}
                    placeholder="Örn: Firma / Tedarikçi"
                    className="w-full px-3 py-2 border-2 border-slate-200 focus:border-amber-600 rounded-xl text-xs bg-white select-text cursor-text"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Açıklama / Fiş No</label>
                <input
                  type="text"
                  value={modalExpDesc}
                  onChange={e => setModalExpDesc(e.target.value)}
                  placeholder="İşlem açıklaması veya fiş no..."
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-amber-600 rounded-xl text-xs bg-white select-text cursor-text"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-600/20 cursor-pointer"
                >
                  Harcamayı Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Müşteri Borç / Tahsilat Modalı */}
      {customerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {modalTxType === 'DEBT' ? 'Müşteriye Borç Kaydet' : 'Müşteriden Tahsilat Al'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {modalTxType === 'DEBT' ? 'Verilen sipariş / hizmet tutarını müşterinin borcuna ekleyin.' : 'Müşteriden tahsil edilen ödemeyi kaydedin.'}
            </p>

            <form onSubmit={handleCustomerTxSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Müşteri Seçin *</label>
                <select 
                  value={modalCustomerId}
                  onChange={e => setModalCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:outline-none bg-white select-text"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (Bakiye: {c.balance} TL)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">İşlem Türü</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalTxType('DEBT')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${modalTxType === 'DEBT' ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                  >
                    Borç Ekle (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTxType('COLLECTION')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${modalTxType === 'COLLECTION' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                  >
                    Tahsilat (-)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tutar (TL) *</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    value={modalAmount}
                    onChange={e => setModalAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-sm font-bold focus:outline-none bg-white select-text"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">İşlem Tarihi *</label>
                  <input 
                    type="date"
                    required
                    value={modalTxDate}
                    onChange={e => setModalTxDate(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs font-semibold focus:outline-none bg-white cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ödeme Yöntemi</label>
                <select 
                  value={modalMethod}
                  onChange={e => setModalMethod(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:outline-none bg-white select-text"
                >
                  <option value="BANK">Banka / Havale / EFT</option>
                  <option value="CASH">Nakit Kasa</option>
                  <option value="CREDIT_CARD">Kredi Kartı</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Açıklama</label>
                <input 
                  type="text"
                  value={modalDesc}
                  onChange={e => setModalDesc(e.target.value)}
                  placeholder="İşlem açıklaması..."
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs focus:outline-none bg-white select-text"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setCustomerModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Vazgeç
                </button>
                <button 
                  type="submit" 
                  className={`px-4 py-2 text-white font-bold rounded-xl text-xs shadow-md ${modalTxType === 'DEBT' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PERSONEL ÖDEME MODALI */}
      {employeeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {modalPayType === 'SALARY_ACCRUAL' ? 'Maaş Hak Edişi Yansıt' : 'Personel Ödemesi / Avans Gir'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {modalPayType === 'SALARY_ACCRUAL' 
                ? 'Dönem dolduğunda personelin hak ettiği maaşı borç olarak kaydedin.' 
                : 'Personele yapılan maaş ödemesi, avans veya kesintiyi kaydedin.'}
            </p>

            {(modalPayType === 'SALARY_PAYMENT' || modalPayType === 'ADVANCE') && pendingForSelectedEmp && (
              <div className="mb-4 p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-900 text-xs animate-fadeIn">
                <div className="font-black text-xs flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Onay Bekleyen Maaş Hakedişi Bulunuyor!</span>
                </div>
                <p className="mt-1 text-[11px] text-amber-700 leading-tight">
                  Bu personelin <strong>{formatCurrency(pendingForSelectedEmp.salary)}</strong> tutarındaki ({pendingForSelectedEmp.periodText}) hakedişi henüz onaylanmamıştır. Ödeme yapabilmek için önce hakedişi onaylamalısınız.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    handleApproveSingleAccrual(pendingForSelectedEmp);
                  }}
                  className="mt-2.5 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Hakedişi Şimdi Onayla ({formatCurrency(pendingForSelectedEmp.salary)})</span>
                </button>
              </div>
            )}

            <form onSubmit={handleEmployeePaySubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Personel Seçin *</label>
                <select 
                  value={modalEmployeeId}
                  onChange={e => {
                    setModalEmployeeId(e.target.value);
                    const targetEmp = employees.find(emp => emp.id === e.target.value);
                    if (modalPayType === 'SALARY_ACCRUAL' && targetEmp) {
                      setModalEmpAmount(targetEmp.salary.toString());
                    }
                  }}
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:outline-none bg-white select-text cursor-pointer"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName} (Kalan Borç: {emp.balance} TL)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">İşlem Türü</label>
                <select 
                  value={modalPayType}
                  onChange={e => {
                    const newType = e.target.value as any;
                    setModalPayType(newType);
                    const targetEmp = employees.find(emp => emp.id === modalEmployeeId);
                    if (newType === 'SALARY_ACCRUAL' && targetEmp) {
                      setModalEmpAmount(targetEmp.salary.toString());
                      setModalEmpDesc(`${new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })} Maaş Hak Edişi`);
                    } else if (newType === 'ADVANCE') {
                      setModalEmpDesc('Avans Ödemesi');
                    } else if (newType === 'SALARY_PAYMENT') {
                      setModalEmpDesc('Maaş Ödemesi');
                    }
                  }}
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold focus:outline-none bg-white select-text cursor-pointer"
                >
                  <option value="SALARY_PAYMENT">💰 Maaş Ödemesi Yap (Personele Borcu Azaltır)</option>
                  <option value="ADVANCE">💵 Avans Ver (Personele Borcu Azaltır)</option>
                  <option value="SALARY_ACCRUAL">📅 Maaş Hak Edişi Tanımla (Personele Borcu Artırır)</option>
                  <option value="BONUS">🎁 Prim / İkramiye (Personele Borcu Artırır)</option>
                  <option value="DEDUCTION">🔻 Maaş Kesintisi (Personele Borcu Azaltır)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tutar (TL) *</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    value={modalEmpAmount}
                    onChange={e => setModalEmpAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-sm font-bold focus:outline-none bg-white select-text"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ödeme Tarihi *</label>
                  <input 
                    type="date"
                    required
                    value={modalEmpDate}
                    onChange={e => setModalEmpDate(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs font-semibold focus:outline-none bg-white cursor-pointer"
                  />
                </div>
              </div>

              {modalPayType !== 'SALARY_ACCRUAL' && modalPayType !== 'DEDUCTION' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ödeme Kanalı</label>
                  <select 
                    value={modalEmpMethod}
                    onChange={e => setModalEmpMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs focus:outline-none bg-white select-text cursor-pointer"
                  >
                    <option value="BANK">Banka / IBAN Havalesi</option>
                    <option value="CASH">Nakit Kasa</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Açıklama</label>
                <input 
                  type="text"
                  value={modalEmpDesc}
                  onChange={e => setModalEmpDesc(e.target.value)}
                  placeholder="İşlem açıklaması..."
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs focus:outline-none bg-white select-text"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setEmployeeModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Vazgeç
                </button>
                <button 
                  type="submit" 
                  disabled={(modalPayType === 'SALARY_PAYMENT' || modalPayType === 'ADVANCE') && !!pendingForSelectedEmp}
                  className={`px-4 py-2 text-white font-bold rounded-xl text-xs shadow-md transition-all ${
                    (modalPayType === 'SALARY_PAYMENT' || modalPayType === 'ADVANCE') && !!pendingForSelectedEmp
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 cursor-pointer'
                  }`}
                >
                  {modalPayType === 'SALARY_ACCRUAL' ? 'Hak Edişi Kaydet' : 'Ödemeyi Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}