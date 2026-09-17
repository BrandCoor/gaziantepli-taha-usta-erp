// Gaziantepli Taha Usta - ERP, Cari, Personel & Toptancı Servisi (Bakiye Güvenlik Kilitli)

export interface CustomerTransaction {
  id: string;
  customerId: string;
  type: 'DEBT' | 'COLLECTION';
  amount: number;
  paymentMethod: 'CASH' | 'BANK' | 'CREDIT_CARD';
  date: string;
  description?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  balance: number;
  transactions?: CustomerTransaction[];
  createdAt: string;
  updatedAt: string;
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  type: 'INVOICE' | 'PAYMENT' | 'PURCHASE' | string;
  amount: number;
  paymentMethod: 'CASH' | 'BANK' | 'CREDIT_CARD' | 'CHECK' | string;
  date: string;
  invoiceNo?: string;
  documentNumber?: string;
  dueDate?: string;
  description?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  category: string;
  address?: string;
  balance: number;
  notes?: string;
  transactions?: SupplierTransaction[];
  createdAt: string;
  updatedAt: string;
}

export type SalaryType = 'MONTHLY' | 'WEEKLY' | 'DAILY';

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Pazartesi',
  2: 'Salı',
  3: 'Çarşamba',
  4: 'Perşembe',
  5: 'Cuma',
  6: 'Cumartesi',
  7: 'Pazar',
};

export interface EmployeePayment {
  id: string;
  employeeId: string;
  type: 'SALARY_ACCRUAL' | 'ADVANCE' | 'SALARY_PAYMENT' | 'BONUS' | 'DEDUCTION' | 'TERMINATION_SETTLEMENT' | 'OVERTIME_ACCRUAL' | 'OVERTIME_PAYMENT' | string;
  amount: number;
  paymentMethod: 'CASH' | 'BANK' | string;
  date: string;
  description?: string;
  // Mesai & Vardiya Hesap Detayları
  overtimeHours?: number;
  overtimeMultiplier?: number;
  normalDailyHours?: number;
  hourlyRate?: number;
  isManualAmount?: boolean;
  payoutType?: 'CASH_IMMEDIATE' | 'SALARY_ACCRUAL';
  createdAt: string;
}

export interface Employee {
  id: string;
  fullName: string;
  phone?: string;
  position?: string;
  salary: number; // Aylık maaş, Haftalık ücret veya Günlük yevmiye tutarı
  salaryType?: SalaryType; // 'MONTHLY' | 'WEEKLY' | 'DAILY' (Varsayılan: 'MONTHLY')
  salaryPaymentDay?: number; // Aylık için: ayın 1-31'i. Haftalık için: haftanın 1-7'si (1:Pzt ... 7:Paz). Günlük için: 0 / her gün.
  dailyWorkHours?: number;   // Normal günlük çalışma saati (Örn: 8)
  overtimeMultiplier?: number; // Mesai katsayısı (Örn: 1.5)
  iban?: string;
  balance: number;
  isActive: boolean;
  startDate?: string;
  payments?: EmployeePayment[];
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  title: string;
  category: string;
  supplierId?: string;
  supplierName?: string;
  supplier?: string;
  amount: number;
  paymentMethod: 'CASH' | 'CREDIT_CARD' | 'BANK';
  date: string;
  description?: string;
  createdAt: string;
}

export type RoleType = 'ADMIN' | 'CASHIER' | 'WAITER' | 'ACCOUNTANT' | 'HR' | 'VIEWER';
export type Permission = 'ALL' | 'CUSTOMERS_VIEW' | 'CUSTOMERS_MANAGE' | 'CUSTOMERS_TRANSACTION' | 'EMPLOYEES_VIEW' | 'EMPLOYEES_MANAGE' | 'EMPLOYEES_PAYMENT' | 'REPORTS_VIEW' | string;

export interface User {
  id: string;
  username: string;
  fullName: string;
  password?: string;
  role: RoleType;
  roleName?: string;
  permissions?: Permission[];
  isActive?: boolean;
}

export interface CompanySettings {
  companyName: string;
  subTitle?: string;
  logoBase64?: string;
  phone?: string;
  email?: string;
  taxOffice?: string;
  taxNumber?: string;
  address?: string;
  dailyWorkHours?: number;
  overtimeMultiplier?: number;
  defaultSalaryPaymentDay?: number;
}

export interface PendingSalaryAccrual {
  employeeId: string;
  employeeName: string;
  salary: number;
  salaryType: SalaryType;
  salaryPaymentDay: number; // Aylık için ayın günü (1-31), haftalık için haftanın günü (1-7), günlük için 0
  dueDate: string;
  periodName: string;
  periodKey: string; // '2026-09', '2026-W38', '2026-09-17'
}

const STORAGE_KEYS = {
  CUSTOMERS: 'gtu_erp_customers',
  CUSTOMER_TX: 'gtu_erp_customer_transactions',
  SUPPLIERS: 'gtu_erp_suppliers',
  SUPPLIER_TX: 'gtu_erp_supplier_transactions',
  EMPLOYEES: 'gtu_erp_employees',
  EMPLOYEE_PAYMENTS: 'gtu_erp_employee_payments',
  EXPENSES: 'gtu_erp_expenses',
  USERS: 'gtu_erp_users',
  COMPANY: 'gtu_erp_company_settings',
};

const DEFAULT_SUPPLIERS: Supplier[] = [];

const DEFAULT_CUSTOMERS: Customer[] = [];

const DEFAULT_EMPLOYEES: Employee[] = [];

class DataService {
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.purgeDemoData();
  }

  private purgeDemoData() {
    try {
      const demoSupIds = ['sup-1', 'sup-2', 'sup-3'];
      const demoCustIds = ['cust-1', 'cust-2'];
      const demoEmpIds = ['emp-1', 'emp-2', 'emp-3', 'emp-4', 'emp-5'];

      const rawCust = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      if (rawCust) {
        const custs: Customer[] = JSON.parse(rawCust);
        const filtered = custs.filter(c => !demoCustIds.includes(c.id));
        if (filtered.length !== custs.length) {
          localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(filtered));
        }
      }

      const rawSup = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
      if (rawSup) {
        const sups: Supplier[] = JSON.parse(rawSup);
        const filtered = sups.filter(s => !demoSupIds.includes(s.id));
        if (filtered.length !== sups.length) {
          localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(filtered));
        }
      }

      const rawEmp = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
      if (rawEmp) {
        const emps: Employee[] = JSON.parse(rawEmp);
        const filtered = emps.filter(e => !demoEmpIds.includes(e.id));
        if (filtered.length !== emps.length) {
          localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(filtered));
        }
      }

      // Purge demo payments
      const rawPay = localStorage.getItem(STORAGE_KEYS.EMPLOYEE_PAYMENTS);
      if (rawPay) {
        const pays: EmployeePayment[] = JSON.parse(rawPay);
        const filtered = pays.filter(p => !demoEmpIds.includes(p.employeeId));
        if (filtered.length !== pays.length) {
          localStorage.setItem(STORAGE_KEYS.EMPLOYEE_PAYMENTS, JSON.stringify(filtered));
        }
      }
    } catch (e) {
      console.warn('Demo purge error:', e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // 1. MÜŞTERİLER
  public getCustomers(): Customer[] {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (!data) return [...DEFAULT_CUSTOMERS];
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [...DEFAULT_CUSTOMERS];
    } catch {
      return [...DEFAULT_CUSTOMERS];
    }
  }

  public saveCustomers(customers: Customer[]) {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    this.notify();
  }

  public addCustomer(c: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Customer {
    const customers = this.getCustomers();
    const newCust: Customer = {
      ...c,
      id: `cust-${Date.now()}`,
      balance: Number(c.balance) || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    customers.push(newCust);
    this.saveCustomers(customers);
    return newCust;
  }

  public updateCustomer(id: string, partial: Partial<Customer>) {
    const customers = this.getCustomers().map(c => c.id === id ? { ...c, ...partial, updatedAt: new Date().toISOString() } : c);
    this.saveCustomers(customers);
  }

  // MÜŞTERİ SİLME KİLİDİ (BAKİYE != 0 İSE SİLİNEMEZ)
  public deleteCustomer(id: string): { success: boolean; message?: string } {
    const customers = this.getCustomers();
    const target = customers.find(c => c.id === id);
    if (!target) return { success: false, message: 'Müşteri bulunamadı.' };

    if (Math.abs(Number(target.balance) || 0) > 0.01) {
      return {
        success: false,
        message: `Bu müşterinin ${target.balance.toFixed(2)} ₺ cari bakiyesi bulunmaktadır. Bakiye sıfırlanmadan müşteri silinemez!`
      };
    }

    const updated = customers.filter(c => c.id !== id);
    this.saveCustomers(updated);
    return { success: true };
  }

  public getCustomerTransactions(): CustomerTransaction[] {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOMER_TX);
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public saveCustomerTransactions(txs: CustomerTransaction[]) {
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_TX, JSON.stringify(txs));
    this.notify();
  }

  public getCustomerWithTransactions(customerId: string): (Customer & { transactions: CustomerTransaction[] }) | null {
    const customer = this.getCustomers().find(c => c.id === customerId);
    if (!customer) return null;
    const allTx = this.getCustomerTransactions();
    const transactions = allTx
      .filter(t => t.customerId === customerId)
      .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
    return {
      ...customer,
      transactions,
    };
  }

  public addCustomerTransaction(customerId: string, tx: Omit<CustomerTransaction, 'id' | 'customerId' | 'createdAt'>): CustomerTransaction | null {
    const customers = this.getCustomers();
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return null;

    const newTx: CustomerTransaction = {
      ...tx,
      id: `ctx-${Date.now()}-${Math.random()}`,
      customerId,
      createdAt: new Date().toISOString(),
    };

    const transactions = this.getCustomerTransactions();
    transactions.push(newTx);
    this.saveCustomerTransactions(transactions);

    if (tx.type === 'DEBT') {
      customer.balance = (Number(customer.balance) || 0) + Number(tx.amount);
    } else if (tx.type === 'COLLECTION') {
      customer.balance = (Number(customer.balance) || 0) - Number(tx.amount);
    }
    customer.updatedAt = new Date().toISOString();

    this.saveCustomers(customers);
    return newTx;
  }

  public updateCustomerTransaction(txId: string, partial: Partial<CustomerTransaction>) {
    const transactions = this.getCustomerTransactions();
    const txIndex = transactions.findIndex(t => t.id === txId);
    if (txIndex === -1) return;

    const oldTx = transactions[txIndex];
    const customers = this.getCustomers();
    const customer = customers.find(c => c.id === oldTx.customerId);

    if (customer) {
      if (oldTx.type === 'DEBT') {
        customer.balance = (Number(customer.balance) || 0) - Number(oldTx.amount);
      } else if (oldTx.type === 'COLLECTION') {
        customer.balance = (Number(customer.balance) || 0) + Number(oldTx.amount);
      }

      const newAmount = partial.amount !== undefined ? Number(partial.amount) : oldTx.amount;
      const newType = partial.type || oldTx.type;

      if (newType === 'DEBT') {
        customer.balance = (Number(customer.balance) || 0) + Number(newAmount);
      } else if (newType === 'COLLECTION') {
        customer.balance = (Number(customer.balance) || 0) - Number(newAmount);
      }

      customer.updatedAt = new Date().toISOString();
      this.saveCustomers(customers);
    }

    transactions[txIndex] = { ...oldTx, ...partial };
    this.saveCustomerTransactions(transactions);
  }

  public deleteCustomerTransaction(txId: string) {
    const transactions = this.getCustomerTransactions();
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;

    const customers = this.getCustomers();
    const customer = customers.find(c => c.id === tx.customerId);

    if (customer) {
      if (tx.type === 'DEBT') {
        customer.balance = (Number(customer.balance) || 0) - Number(tx.amount);
      } else if (tx.type === 'COLLECTION') {
        customer.balance = (Number(customer.balance) || 0) + Number(tx.amount);
      }
      customer.updatedAt = new Date().toISOString();
      this.saveCustomers(customers);
    }

    const updated = transactions.filter(t => t.id !== txId);
    this.saveCustomerTransactions(updated);
  }

  // 2. TOPTANCILAR
  public getSuppliers(): Supplier[] {
    const data = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
    if (!data) return [...DEFAULT_SUPPLIERS];
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [...DEFAULT_SUPPLIERS];
    } catch {
      return [...DEFAULT_SUPPLIERS];
    }
  }

  public saveSuppliers(suppliers: Supplier[]) {
    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
    this.notify();
  }

  public addSupplier(s: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Supplier {
    const suppliers = this.getSuppliers();
    const newSup: Supplier = {
      ...s,
      id: `sup-${Date.now()}`,
      balance: Number(s.balance) || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    suppliers.push(newSup);
    this.saveSuppliers(suppliers);
    return newSup;
  }

  public updateSupplier(id: string, partial: Partial<Supplier>) {
    const suppliers = this.getSuppliers().map(s => s.id === id ? { ...s, ...partial, updatedAt: new Date().toISOString() } : s);
    this.saveSuppliers(suppliers);
  }

  // TOPTANCI SİLME KİLİDİ (BAKİYE != 0 İSE SİLİNEMEZ)
  public deleteSupplier(id: string): { success: boolean; message?: string } {
    const suppliers = this.getSuppliers();
    const target = suppliers.find(s => s.id === id);
    if (!target) return { success: false, message: 'Toptancı bulunamadı.' };

    if (Math.abs(Number(target.balance) || 0) > 0.01) {
      return {
        success: false,
        message: `Bu toptancıya ${target.balance.toFixed(2)} ₺ borç bakiyesi bulunmaktadır. Hesap kapatılmadan toptancı kaydı silinemez!`
      };
    }

    const updated = suppliers.filter(s => s.id !== id);
    this.saveSuppliers(updated);
    return { success: true };
  }

  public getSupplierTransactions(): SupplierTransaction[] {
    const data = localStorage.getItem(STORAGE_KEYS.SUPPLIER_TX);
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public saveSupplierTransactions(txs: SupplierTransaction[]) {
    localStorage.setItem(STORAGE_KEYS.SUPPLIER_TX, JSON.stringify(txs));
  }

  public addSupplierTransaction(supplierId: string, tx: Omit<SupplierTransaction, 'id' | 'supplierId' | 'createdAt'>): SupplierTransaction | null {
    const suppliers = this.getSuppliers();
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return null;

    const newTx: SupplierTransaction = {
      ...tx,
      id: `stx-${Date.now()}-${Math.random()}`,
      supplierId,
      createdAt: new Date().toISOString(),
    };

    const transactions = this.getSupplierTransactions();
    transactions.push(newTx);
    this.saveSupplierTransactions(transactions);

    if (tx.type === 'INVOICE') {
      supplier.balance = (Number(supplier.balance) || 0) + Number(tx.amount);
    } else if (tx.type === 'PAYMENT') {
      supplier.balance = (Number(supplier.balance) || 0) - Number(tx.amount);
    }
    supplier.updatedAt = new Date().toISOString();

    this.saveSuppliers(suppliers);
    return newTx;
  }

  public updateSupplierTransaction(txId: string, partial: Partial<SupplierTransaction>) {
    const transactions = this.getSupplierTransactions();
    const txIndex = transactions.findIndex(t => t.id === txId);
    if (txIndex === -1) return;

    const oldTx = transactions[txIndex];
    const suppliers = this.getSuppliers();
    const supplier = suppliers.find(s => s.id === oldTx.supplierId);

    if (supplier) {
      if (oldTx.type === 'INVOICE') {
        supplier.balance = (Number(supplier.balance) || 0) - Number(oldTx.amount);
      } else if (oldTx.type === 'PAYMENT') {
        supplier.balance = (Number(supplier.balance) || 0) + Number(oldTx.amount);
      }

      const newAmount = partial.amount !== undefined ? Number(partial.amount) : oldTx.amount;
      const newType = partial.type || oldTx.type;

      if (newType === 'INVOICE') {
        supplier.balance = (Number(supplier.balance) || 0) + Number(newAmount);
      } else if (newType === 'PAYMENT') {
        supplier.balance = (Number(supplier.balance) || 0) - Number(newAmount);
      }

      supplier.updatedAt = new Date().toISOString();
      this.saveSuppliers(suppliers);
    }

    transactions[txIndex] = { ...oldTx, ...partial };
    this.saveSupplierTransactions(transactions);
    this.notify();
  }

  public deleteSupplierTransaction(txId: string) {
    const transactions = this.getSupplierTransactions();
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;

    const suppliers = this.getSuppliers();
    const supplier = suppliers.find(s => s.id === tx.supplierId);

    if (supplier) {
      if (tx.type === 'INVOICE') {
        supplier.balance = (Number(supplier.balance) || 0) - Number(tx.amount);
      } else if (tx.type === 'PAYMENT') {
        supplier.balance = (Number(supplier.balance) || 0) + Number(tx.amount);
      }
      supplier.updatedAt = new Date().toISOString();
      this.saveSuppliers(suppliers);
    }

    const updatedTxs = transactions.filter(t => t.id !== txId);
    this.saveSupplierTransactions(updatedTxs);
    this.notify();
  }

  public getSupplierStatement(supplierId: string): SupplierTransaction[] {
    const all = this.getSupplierTransactions();
    return all.filter(t => t.supplierId === supplierId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // 3. İŞLETME GİDERLERİ
  public getExpenses(): Expense[] {
    const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public saveExpensesList(expenses: Expense[]) {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    this.notify();
  }

  public saveExpense(exp: Omit<Expense, 'id' | 'createdAt'>): Expense {
    const expenses = this.getExpenses();
    const newExp: Expense = {
      ...exp,
      id: `exp-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    expenses.push(newExp);
    this.saveExpensesList(expenses);
    return newExp;
  }

  public addExpense(exp: Omit<Expense, 'id' | 'createdAt'>): Expense {
    return this.saveExpense(exp);
  }

  public updateExpense(id: string, partial: Partial<Expense>) {
    const expenses = this.getExpenses().map(e => e.id === id ? { ...e, ...partial } : e);
    this.saveExpensesList(expenses);
  }

  public deleteExpense(id: string) {
    const expenses = this.getExpenses().filter(e => e.id !== id);
    this.saveExpensesList(expenses);
  }

  // 4. PERSONELLER & GARSONLAR
  public getEmployees(): Employee[] {
    const data = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
    if (!data) {
      return [];
    }
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
    } catch {
      return [];
    }
  }

  public saveEmployees(emps: Employee[]) {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(emps));
    this.notify();
  }

  public getEmployeeById(id: string): Employee | undefined {
    const employees = this.getEmployees();
    const emp = employees.find(e => e.id === id);
    if (!emp) return undefined;
    const payments = this.getEmployeePayments().filter(p => p.employeeId === id);
    return { ...emp, payments };
  }

  public addEmployee(emp: Omit<Employee, 'id' | 'createdAt' | 'updatedAt' | 'balance'>): Employee {
    const employees = this.getEmployees();
    const newEmp: Employee = {
      ...emp,
      id: `emp-${Date.now()}`,
      balance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    employees.push(newEmp);
    this.saveEmployees(employees);
    return newEmp;
  }

  public updateEmployee(id: string, partial: Partial<Employee>) {
    const employees = this.getEmployees().map(e => e.id === id ? { ...e, ...partial, updatedAt: new Date().toISOString() } : e);
    this.saveEmployees(employees);
  }

  // PERSONEL SİLME KİLİDİ (BAKİYE != 0 İSE SİLİNEMEZ)
  public deleteEmployee(id: string): { success: boolean; message?: string } {
    const employees = this.getEmployees();
    const target = employees.find(e => e.id === id);
    if (!target) return { success: false, message: 'Personel bulunamadı.' };

    if (Math.abs(Number(target.balance) || 0) > 0.01) {
      return {
        success: false,
        message: `Bu personelin ${target.balance.toFixed(2)} ₺ hesap bakiyesi bulunmaktadır. Bakiye sıfırlanmadan personel silinemez!`
      };
    }

    const updated = employees.filter(e => e.id !== id);
    this.saveEmployees(updated);
    return { success: true };
  }

  public getEmployeePayments(employeeId?: string): EmployeePayment[] {
    const data = localStorage.getItem(STORAGE_KEYS.EMPLOYEE_PAYMENTS);
    const payments: EmployeePayment[] = data ? JSON.parse(data) : [];
    if (employeeId) {
      return payments.filter(p => p.employeeId === employeeId);
    }
    return payments;
  }

  public recalculateEmployeeBalance(employeeId: string): number {
    const employees = this.getEmployees();
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return 0;

    const allPayments = this.getEmployeePayments().filter(p => p.employeeId === employeeId);
    let balance = 0;
    allPayments.forEach(p => {
      const amt = Number(p.amount) || 0;
      if (p.type === 'SALARY_ACCRUAL' || p.type === 'OVERTIME_ACCRUAL' || p.type === 'BONUS' || p.type === 'TERMINATION_SETTLEMENT') {
        balance += amt;
      } else if (p.type === 'SALARY_PAYMENT' || p.type === 'OVERTIME_PAYMENT' || p.type === 'ADVANCE' || p.type === 'DEDUCTION') {
        balance -= amt;
      }
    });

    emp.balance = balance;
    emp.updatedAt = new Date().toISOString();
    this.saveEmployees(employees);
    return balance;
  }

  public addEmployeePayment(employeeId: string, payment: Omit<EmployeePayment, 'id' | 'employeeId' | 'createdAt'>): EmployeePayment | null {
    const employees = this.getEmployees();
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return null;

    const payments = this.getEmployeePayments();
    const newPay: EmployeePayment = { 
      ...payment, 
      id: `ep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, 
      employeeId, 
      createdAt: new Date().toISOString() 
    };
    payments.push(newPay);
    localStorage.setItem(STORAGE_KEYS.EMPLOYEE_PAYMENTS, JSON.stringify(payments));

    this.recalculateEmployeeBalance(employeeId);
    this.notify();
    return newPay;
  }

  public updateEmployeePayment(id: string, partial: Partial<EmployeePayment>): boolean {
    const payments = this.getEmployeePayments();
    const target = payments.find(p => p.id === id);
    if (!target) return false;

    const updated = payments.map(p => p.id === id ? { ...p, ...partial } : p);
    localStorage.setItem(STORAGE_KEYS.EMPLOYEE_PAYMENTS, JSON.stringify(updated));
    this.recalculateEmployeeBalance(target.employeeId);
    this.notify();
    return true;
  }

  public deleteEmployeePayment(id: string): boolean {
    const payments = this.getEmployeePayments();
    const target = payments.find(p => p.id === id);
    if (!target) return false;

    const updated = payments.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.EMPLOYEE_PAYMENTS, JSON.stringify(updated));
    this.recalculateEmployeeBalance(target.employeeId);
    this.notify();
    return true;
  }

  // MESAİ EKLEME (Katsayılı, Düzenlenebilir Normal Çalışma Saati, Manuel Ücret ve Nakit/Maaşa Aktarma)
  public addOvertime(params: {
    employeeId: string;
    date: string;
    normalDailyHours: number;
    overtimeHours: number;
    multiplier: number;
    hourlyRate: number;
    amount: number;
    isManualAmount: boolean;
    payoutType: 'CASH_IMMEDIATE' | 'SALARY_ACCRUAL';
    paymentMethod?: 'CASH' | 'BANK' | string;
    recordExpense?: boolean;
    description?: string;
  }): { success: boolean; message?: string } {
    const employees = this.getEmployees();
    const emp = employees.find(e => e.id === params.employeeId);
    if (!emp) return { success: false, message: 'Personel bulunamadı.' };

    const overtimeNote = params.description ? ` (${params.description})` : '';
    const methodLabel = params.payoutType === 'CASH_IMMEDIATE' 
      ? (params.paymentMethod === 'BANK' ? 'Banka Havalesi İle Gününde Ödendi' : 'Nakit Olarak Gününde Ödendi')
      : 'Maaş / Hakedişe Eklendi';

    const calculationDesc = params.isManualAmount
      ? `${params.overtimeHours} Saat Fazla Mesai [Manuel Tutar: ${params.amount.toFixed(2)} ₺] - ${methodLabel}${overtimeNote}`
      : `${params.overtimeHours} Saat Fazla Mesai [${params.multiplier}x Katsayı / Normal: ${params.normalDailyHours} Saat] - ${methodLabel}${overtimeNote}`;

    // 1. Her durumda mesai hakedişi kaydı oluştur (OVERTIME_ACCRUAL)
    this.addEmployeePayment(params.employeeId, {
      type: 'OVERTIME_ACCRUAL',
      amount: params.amount,
      paymentMethod: params.paymentMethod || 'CASH',
      date: params.date,
      description: calculationDesc,
      overtimeHours: params.overtimeHours,
      overtimeMultiplier: params.multiplier,
      normalDailyHours: params.normalDailyHours,
      hourlyRate: params.hourlyRate,
      isManualAmount: params.isManualAmount,
      payoutType: params.payoutType,
    });

    // 2. Eğer "Gününde Nakit / Elden Ödendi" seçildiyse anında ödeme hareketi ekle
    if (params.payoutType === 'CASH_IMMEDIATE') {
      this.addEmployeePayment(params.employeeId, {
        type: 'OVERTIME_PAYMENT',
        amount: params.amount,
        paymentMethod: params.paymentMethod || 'CASH',
        date: params.date,
        description: `Mesai Günü ${params.paymentMethod === 'BANK' ? 'Banka Havalesiyle' : 'Nakit'} Elden Ödendi (${params.overtimeHours} Saat Mesai Karşılığı)`,
        overtimeHours: params.overtimeHours,
        overtimeMultiplier: params.multiplier,
        normalDailyHours: params.normalDailyHours,
        hourlyRate: params.hourlyRate,
        isManualAmount: params.isManualAmount,
        payoutType: params.payoutType,
      });

      // İsteğe bağlı olarak genel restoran giderleri/kasa tablosuna da işle
      if (params.recordExpense !== false) {
        this.addExpense({
          title: `Personel Mesai Ödemesi - ${emp.fullName}`,
          category: 'Personel / Mesai',
          amount: params.amount,
          paymentMethod: params.paymentMethod === 'BANK' ? 'BANK' : 'CASH',
          date: params.date,
          description: `${emp.fullName} için ${params.overtimeHours} saat mesai ücreti ödendi.`,
        });
      }
    }

    this.recalculateEmployeeBalance(params.employeeId);
    return { success: true };
  }

  // TOPLU MAAŞ TAHAKKUKU
  public batchSalaryAccrual(periodDescription: string, date: string): { success: boolean; count: number } {
    const employees = this.getEmployees().filter(e => e.isActive !== false);
    if (employees.length === 0) return { success: false, count: 0 };

    let count = 0;
    employees.forEach(emp => {
      if (emp.salary > 0) {
        const salaryType = emp.salaryType || 'MONTHLY';
        let desc = '';
        if (salaryType === 'DAILY') {
          desc = `${periodDescription || 'Günlük'} Yevmiye Hakediş Tahakkuku`;
        } else if (salaryType === 'WEEKLY') {
          desc = `${periodDescription || 'Haftalık'} Maaş Hakedişi Tahakkuku`;
        } else {
          desc = `${periodDescription || 'Aylık'} Maaş Hakedişi Tahakkuku`;
        }

        this.addEmployeePayment(emp.id, {
          type: 'SALARY_ACCRUAL',
          amount: emp.salary,
          paymentMethod: 'BANK',
          date: date || new Date().toISOString().split('T')[0],
          description: desc,
        });
        count++;
      }
    });

    return { success: true, count };
  }

  // MAAŞ ÖDEME GÜNÜ VE TAHAKKUK KONTROLÜ (AYLIK, HAFTALIK, GÜNLÜK YEVMİYE)
  public getPendingSalaryAccruals(): PendingSalaryAccrual[] {
    const employees = this.getEmployees().filter(e => e.isActive !== false && (Number(e.salary) || 0) > 0);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentDay = now.getDate(); // Ayın bugünkü günü (1-31)
    const currentDayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1 (Pzt) - 7 (Paz)
    const todayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
    const currentYearMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const monthName = now.toLocaleString('tr-TR', { month: 'long', year: 'numeric' });

    // ISO Hafta Hesaplama
    const targetDate = new Date(now.valueOf());
    const dayNr = (now.getDay() + 6) % 7;
    targetDate.setDate(targetDate.getDate() - dayNr + 3);
    const firstThursday = targetDate.valueOf();
    targetDate.setMonth(0, 1);
    if (targetDate.getDay() !== 4) {
      targetDate.setMonth(0, 1 + ((4 - targetDate.getDay()) + 7) % 7);
    }
    const weekNum = 1 + Math.ceil((firstThursday - targetDate.valueOf()) / 604800000);
    const weekKey = `${currentYear}-W${String(weekNum).padStart(2, '0')}`;

    // Hafta başlangıç ve bitiş tarihleri
    const curr = new Date(now.getTime());
    const dayOfWeekIdx = curr.getDay();
    const diffToMonday = curr.getDate() - dayOfWeekIdx + (dayOfWeekIdx === 0 ? -6 : 1);
    const mondayDate = new Date(curr.setDate(diffToMonday));
    const sundayDate = new Date(curr.setDate(diffToMonday + 6));
    const mondayStr = mondayDate.toISOString().split('T')[0];
    const sundayStr = sundayDate.toISOString().split('T')[0];
    const weekRangeLabel = `${mondayDate.getDate()} ${mondayDate.toLocaleString('tr-TR', { month: 'short' })} - ${sundayDate.getDate()} ${sundayDate.toLocaleString('tr-TR', { month: 'short' })}`;

    const company = this.getCompanySettings();
    const defaultPayDay = company.defaultSalaryPaymentDay || 1;

    const pending: PendingSalaryAccrual[] = [];
    const allPayments = this.getEmployeePayments();

    employees.forEach(emp => {
      const salaryType: SalaryType = emp.salaryType || 'MONTHLY';
      const empSalary = Number(emp.salary) || 0;
      if (empSalary <= 0) return;

      if (salaryType === 'MONTHLY') {
        // 1. AYLIK MAAŞ SİSTEMİ
        const payDay = emp.salaryPaymentDay || defaultPayDay;
        const periodKey = currentYearMonth;
        const periodName = `${monthName}`;

        const alreadyAccruedThisMonth = allPayments.some(p => 
          p.employeeId === emp.id && 
          p.type === 'SALARY_ACCRUAL' && 
          (p.date?.startsWith(currentYearMonth) || p.description?.includes(periodName) || p.description?.includes(periodKey))
        );

        const isDue = currentDay >= payDay;

        if (isDue && !alreadyAccruedThisMonth) {
          const safeDay = Math.min(payDay, 28);
          const dueDate = `${currentYearMonth}-${String(safeDay).padStart(2, '0')}`;
          pending.push({
            employeeId: emp.id,
            employeeName: emp.fullName,
            salary: empSalary,
            salaryType: 'MONTHLY',
            salaryPaymentDay: payDay,
            dueDate,
            periodName,
            periodKey
          });
        }
      } else if (salaryType === 'WEEKLY') {
        // 2. HAFTALIK MAAŞ SİSTEMİ
        const payDayOfWeek = emp.salaryPaymentDay || 5; // Varsayılan: Cuma (5)
        const periodKey = weekKey;
        const dayLabel = WEEKDAY_LABELS[payDayOfWeek] || 'Cuma';
        const periodName = `${currentYear} - ${weekNum}. Hafta (${weekRangeLabel})`;

        const alreadyAccruedThisWeek = allPayments.some(p => 
          p.employeeId === emp.id && 
          p.type === 'SALARY_ACCRUAL' && 
          (
            p.description?.includes(weekKey) || 
            p.description?.includes(`${weekNum}. Hafta`) ||
            (p.date >= mondayStr && p.date <= sundayStr && p.description?.includes('Haftalık'))
          )
        );

        const isDue = currentDayOfWeek >= payDayOfWeek;

        if (isDue && !alreadyAccruedThisWeek) {
          pending.push({
            employeeId: emp.id,
            employeeName: emp.fullName,
            salary: empSalary,
            salaryType: 'WEEKLY',
            salaryPaymentDay: payDayOfWeek,
            dueDate: todayStr,
            periodName,
            periodKey
          });
        }
      } else if (salaryType === 'DAILY') {
        // 3. GÜNLÜK YEVMİYE SİSTEMİ
        const periodKey = todayStr;
        const periodName = `${currentDay} ${now.toLocaleString('tr-TR', { month: 'long', year: 'numeric' })} Günlük Yevmiye`;

        const alreadyAccruedToday = allPayments.some(p => 
          p.employeeId === emp.id && 
          p.type === 'SALARY_ACCRUAL' && 
          (p.date === todayStr || p.description?.includes(todayStr) || (p.description?.includes('Günlük Yevmiye') && p.date === todayStr))
        );

        if (!alreadyAccruedToday) {
          pending.push({
            employeeId: emp.id,
            employeeName: emp.fullName,
            salary: empSalary,
            salaryType: 'DAILY',
            salaryPaymentDay: 0,
            dueDate: todayStr,
            periodName,
            periodKey
          });
        }
      }
    });

    return pending;
  }

  public approveSalaryAccrual(item: PendingSalaryAccrual, accrualDate?: string): boolean {
    const employees = this.getEmployees();
    const emp = employees.find(e => e.id === item.employeeId);
    if (!emp) return false;

    const dateToUse = accrualDate || new Date().toISOString().split('T')[0];
    let description = '';

    if (item.salaryType === 'DAILY') {
      description = `${item.periodName} Hakediş Tahakkuku [${item.periodKey}]`;
    } else if (item.salaryType === 'WEEKLY') {
      const dayLabel = WEEKDAY_LABELS[item.salaryPaymentDay] || 'Hafta Sonu';
      description = `${item.periodName} Haftalık Maaş Hakedişi Tahakkuku (Ödeme: ${dayLabel}) [${item.periodKey}]`;
    } else {
      description = `${item.periodName} Aylık Maaş Hakedişi Tahakkuku (Maaş Günü: Ayın ${item.salaryPaymentDay}'i) [${item.periodKey}]`;
    }

    this.addEmployeePayment(item.employeeId, {
      type: 'SALARY_ACCRUAL',
      amount: item.salary,
      paymentMethod: 'BANK',
      date: dateToUse,
      description,
    });

    return true;
  }

  public approveAllSalaryAccruals(items: PendingSalaryAccrual[], accrualDate?: string): { success: boolean; count: number } {
    let count = 0;
    items.forEach(item => {
      const ok = this.approveSalaryAccrual(item, accrualDate);
      if (ok) count++;
    });
    return { success: count > 0, count };
  }

  // 5. KULLANICILAR & AYARLAR
  public getUsers(): User[] {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error(e);
      }
    }
    const defaultUsers: User[] = [
      { id: 'u-1', username: 'admin', fullName: 'Taha Usta', password: '1', role: 'ADMIN', roleName: 'Yönetici (Tam Yetkili)', permissions: ['ALL'], isActive: true },
      { id: 'u-2', username: 'kasa', fullName: 'Kasa Görevlisi', password: '123', role: 'CASHIER', roleName: 'Kasa Terminali', permissions: ['CUSTOMERS_VIEW', 'CUSTOMERS_TRANSACTION'], isActive: true },
      { id: 'u-3', username: 'garson', fullName: 'Garson Terminali', password: '123', role: 'WAITER', roleName: 'Garson', permissions: [], isActive: true },
    ];
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(defaultUsers));
    return defaultUsers;
  }

  public getCurrentUser(): User {
    const saved = localStorage.getItem('gtu_erp_current_user');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return this.getUsers()[0];
  }

  public setCurrentUser(user: User): void {
    localStorage.setItem('gtu_erp_current_user', JSON.stringify(user));
    this.notify();
  }

  public saveUser(user: Partial<User> & { username: string; fullName: string }): User {
    const users = this.getUsers();
    let savedUser: User;
    if (user.id) {
      const idx = users.findIndex(u => u.id === user.id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...user } as User;
        savedUser = users[idx];
      } else {
        savedUser = { ...user, id: user.id } as User;
        users.push(savedUser);
      }
    } else {
      savedUser = { ...user, id: `u-${Date.now()}` } as User;
      users.push(savedUser);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.notify();
    return savedUser;
  }

  public deleteUser(userId: string): boolean {
    const users = this.getUsers();
    if (users.length <= 1) return false;
    const updated = users.filter(u => u.id !== userId);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));
    this.notify();
    return true;
  }

  public hasPermission(perm: string): boolean {
    return true;
  }

  public getCompanySettings(): CompanySettings {
    const data = localStorage.getItem(STORAGE_KEYS.COMPANY);
    return data ? JSON.parse(data) : { companyName: 'Gaziantepli Taha Usta', phone: '0 (342) 555 00 27', dailyWorkHours: 10, overtimeMultiplier: 1.5 };
  }

  public saveCompanySettings(settings: CompanySettings): void {
    localStorage.setItem(STORAGE_KEYS.COMPANY, JSON.stringify(settings));
    this.notify();
  }
}

export const dataService = new DataService();
