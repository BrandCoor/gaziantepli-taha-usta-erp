export type Permission = 
  | 'ALL'
  | 'CUSTOMERS_VIEW'
  | 'CUSTOMERS_MANAGE'
  | 'CUSTOMERS_TRANSACTION'
  | 'SUPPLIERS_VIEW'
  | 'SUPPLIERS_MANAGE'
  | 'EMPLOYEES_VIEW'
  | 'EMPLOYEES_MANAGE'
  | 'EMPLOYEES_PAYMENT'
  | 'EXPENSES_VIEW'
  | 'EXPENSES_MANAGE'
  | 'REPORTS_VIEW'
  | 'USERS_MANAGE';

export type RoleType = 'ADMIN' | 'ACCOUNTANT' | 'HR' | 'VIEWER';
export type EmployeeStatus = 'ACTIVE' | 'LEAVING_SOON' | 'TERMINATED';

export interface CompanySettings {
  companyName: string;
  subTitle: string;
  phone: string;
  email: string;
  address: string;
  taxOffice: string;
  taxNumber: string;
  logoBase64: string;
  dailyWorkHours: number;      // Günlük Çalışma Saati (Örn: 10)
  overtimeMultiplier: number;  // Mesai Ücreti Çarpanı (Örn: 1.5)
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  password: string;
  role: RoleType;
  roleName: string;
  permissions: Permission[];
  isActive: boolean;
  createdAt: string;
}

export interface CustomerTransaction {
  id: string;
  customerId: string;
  type: 'DEBT' | 'COLLECTION';
  amount: number;
  paymentMethod: 'CASH' | 'BANK' | 'CREDIT_CARD';
  date: string;
  description: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  balance: number;
  createdAt: string;
  transactions: CustomerTransaction[];
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  type: 'PURCHASE' | 'PAYMENT';
  amount: number;
  paymentMethod?: 'CASH' | 'BANK' | 'CREDIT_CARD' | 'CHECK';
  documentNumber?: string;
  dueDate?: string;
  date: string;
  description: string;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  phone: string;
  contactPerson?: string;
  notes?: string;
  balance: number;
  createdAt: string;
  transactions: SupplierTransaction[];
}

export interface Expense {
  id: string;
  title: string;
  category: string;
  supplier?: string;
  amount: number;
  paymentMethod: 'CASH' | 'CREDIT_CARD' | 'BANK';
  date: string;
  description?: string;
  createdAt: string;
}

export interface EmployeePayment {
  id: string;
  employeeId: string;
  type: 'SALARY_ACCRUAL' | 'ADVANCE' | 'SALARY_PAYMENT' | 'BONUS' | 'DEDUCTION' | 'TERMINATION_SETTLEMENT' | 'OVERTIME_ACCRUAL' | 'OVERTIME_PAYMENT';
  amount: number;
  paymentMethod: 'CASH' | 'BANK';
  date: string;
  description: string;
}

export interface Employee {
  id: string;
  fullName: string;
  phone: string;
  position: string;
  salary: number;
  iban: string;
  startDate: string;
  leaveDate?: string;
  leaveReason?: string;
  status: EmployeeStatus;
  payday: number;
  balance: number;
  isActive: boolean;
  createdAt: string;
  payments: EmployeePayment[];
}

export interface PendingSalaryAccrual {
  employeeId: string;
  employeeName: string;
  position: string;
  salary: number;
  dueDate: string;
  periodText: string;
  workedDays: number;
}

const STORAGE_COMPANY_KEY = 'erp_company_settings_v1';
const STORAGE_USERS_KEY = 'erp_users_v5';
const STORAGE_CURRENT_USER_KEY = 'erp_current_user_v5';
const STORAGE_CUSTOMERS_KEY = 'erp_customers_clean_v1';
const STORAGE_EMPLOYEES_KEY = 'erp_employees_clean_v1';
const STORAGE_SUPPLIERS_KEY = 'erp_suppliers_clean_v1';
const STORAGE_EXPENSES_KEY = 'erp_expenses_clean_v1';

const defaultCompanySettings: CompanySettings = {
  companyName: 'Gaziantepli Taha Usta',
  subTitle: 'Cari, Finans & Personel Yönetim Sistemi',
  phone: '',
  email: '',
  address: '',
  taxOffice: '',
  taxNumber: '',
  logoBase64: '',
  dailyWorkHours: 10,        // Taha Usta Varsayılan: 10 Saat
  overtimeMultiplier: 1.5    // Standart Mesai Çarpanı: 1.5x
};

const defaultUsers: User[] = [
  {
    id: 'u_admin',
    username: 'admin',
    fullName: '👑 Süper Yönetici (Admin)',
    password: '123',
    role: 'ADMIN',
    roleName: 'Yönetici (Tam Yetkili)',
    permissions: ['ALL'],
    isActive: true,
    createdAt: '2026-08-01'
  }
];

export const dataService = {
  getCompanySettings(): CompanySettings {
    try {
      const raw = localStorage.getItem(STORAGE_COMPANY_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_COMPANY_KEY, JSON.stringify(defaultCompanySettings));
        return { ...defaultCompanySettings };
      }
      const parsed = JSON.parse(raw);
      // Eski ayarlarda çalışma saati yoksa varsayılanları ekleyerek döndür
      return {
        ...defaultCompanySettings,
        ...parsed,
        dailyWorkHours: parsed.dailyWorkHours || 10,
        overtimeMultiplier: parsed.overtimeMultiplier || 1.5
      };
    } catch {
      return { ...defaultCompanySettings };
    }
  },

  saveCompanySettings(settings: Partial<CompanySettings>): CompanySettings {
    const current = this.getCompanySettings();
    const updated: CompanySettings = { ...current, ...settings };
    localStorage.setItem(STORAGE_COMPANY_KEY, JSON.stringify(updated));
    return updated;
  },

  getUsers(): User[] {
    try {
      const raw = localStorage.getItem(STORAGE_USERS_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(defaultUsers));
        return [...defaultUsers];
      }
      return JSON.parse(raw);
    } catch {
      return [...defaultUsers];
    }
  },

  saveUser(user: { id?: string; username: string; fullName: string; password: string; role: RoleType; roleName: string; permissions: Permission[]; isActive: boolean }): User {
    const currentUsers = this.getUsers();
    if (user.id) {
      const index = currentUsers.findIndex(u => u.id === user.id);
      if (index !== -1) {
        currentUsers[index] = { ...currentUsers[index], ...user };
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(currentUsers));
        return currentUsers[index];
      }
    }
    const newUser: User = { id: 'u_' + Date.now(), ...user, createdAt: new Date().toISOString().split('T')[0] };
    currentUsers.push(newUser);
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(currentUsers));
    return newUser;
  },

  deleteUser(userId: string): boolean {
    const currentUsers = this.getUsers();
    const filtered = currentUsers.filter(u => u.id !== userId);
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(filtered));
    return true;
  },

  getCurrentUser(): User {
    try {
      const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
      if (raw) {
        const u = JSON.parse(raw);
        if (u && u.id) return u;
      }
    } catch {}
    const users = this.getUsers();
    const admin = users[0] || defaultUsers[0];
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(admin));
    return admin;
  },

  setCurrentUser(user: User): void {
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
  },

  hasPermission(permission: Permission): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (user.role === 'ADMIN' || user.permissions.includes('ALL')) return true;
    return user.permissions.includes(permission);
  },

  getCustomers(): Customer[] {
    const raw = localStorage.getItem(STORAGE_CUSTOMERS_KEY);
    if (!raw) return [];
    try {
      const list: Customer[] = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list.map(c => ({ ...c, balance: Number(c.balance) || 0, transactions: Array.isArray(c.transactions) ? c.transactions : [] }));
    } catch { return []; }
  },

  saveCustomer(customer: Omit<Customer, 'id' | 'balance' | 'createdAt' | 'transactions'> & { id?: string }): Customer {
    const customers = this.getCustomers();
    if (customer.id) {
      const index = customers.findIndex(c => c.id === customer.id);
      if (index !== -1) {
        customers[index] = { ...customers[index], name: customer.name, phone: customer.phone, email: customer.email, notes: customer.notes };
        localStorage.setItem(STORAGE_CUSTOMERS_KEY, JSON.stringify(customers));
        return customers[index];
      }
    }
    const newCustomer: Customer = { ...customer, id: 'c_' + Date.now(), balance: 0, createdAt: new Date().toISOString().split('T')[0], transactions: [] };
    customers.unshift(newCustomer);
    localStorage.setItem(STORAGE_CUSTOMERS_KEY, JSON.stringify(customers));
    return newCustomer;
  },

  importCustomersFromList(importedList: Array<{ name: string; phone?: string; notes?: string; balance?: number }>) {
    let customers = this.getCustomers();
    let added = 0; let updated = 0; let totalImportedBalance = 0;
    const today = new Date().toISOString().split('T')[0];

    importedList.forEach(item => {
      const cleanName = (item.name || '').trim();
      if (!cleanName) return;
      const cleanPhone = (item.phone || '').toString().trim();
      const balance = Number(item.balance) || 0;
      totalImportedBalance += balance;

      const existingIndex = customers.findIndex(c => {
        const cPhone = (c.phone || '').replace(/[^0-9]/g, '');
        const itemPhoneClean = cleanPhone.replace(/[^0-9]/g, '');
        if (itemPhoneClean.length >= 7 && cPhone.length >= 7 && itemPhoneClean === cPhone) return true;
        return c.name.trim().toLowerCase() === cleanName.toLowerCase();
      });

      if (existingIndex !== -1) {
        if (cleanPhone) customers[existingIndex].phone = cleanPhone;
        if (item.notes) customers[existingIndex].notes = item.notes.toString().trim();
        if (customers[existingIndex].balance === 0 && balance > 0) {
          customers[existingIndex].balance = balance;
          if (!Array.isArray(customers[existingIndex].transactions)) customers[existingIndex].transactions = [];
          customers[existingIndex].transactions.unshift({
            id: 'ctx_init_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            customerId: customers[existingIndex].id, type: 'DEBT', amount: balance, paymentMethod: 'CASH', date: today, description: 'Menufay Devir / Açılış Borç Bakiyesi'
          });
        }
        updated++;
      } else {
        const newCustomerId = 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const initialTx: CustomerTransaction[] = [];
        if (balance > 0) initialTx.push({ id: 'ctx_init_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4), customerId: newCustomerId, type: 'DEBT', amount: balance, paymentMethod: 'CASH', date: today, description: 'Menufay Devir / Açılış Borç Bakiyesi' });
        customers.push({ id: newCustomerId, name: cleanName, phone: cleanPhone, email: '', notes: item.notes ? item.notes.toString().trim() : '', balance: balance, createdAt: today, transactions: initialTx });
        added++;
      }
    });

    localStorage.setItem(STORAGE_CUSTOMERS_KEY, JSON.stringify(customers));
    return { added, updated, total: customers.length, totalImportedBalance };
  },

  deleteCustomer(customerId: string): boolean {
    let customers = this.getCustomers();
    customers = customers.filter(c => c.id !== customerId);
    localStorage.setItem(STORAGE_CUSTOMERS_KEY, JSON.stringify(customers));
    return true;
  },

  addCustomerTransaction(customerId: string, tx: { type: 'DEBT' | 'COLLECTION', amount: number, paymentMethod: 'CASH' | 'BANK' | 'CREDIT_CARD', date: string, description: string }): void {
    const customers = this.getCustomers();
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    if (!Array.isArray(customer.transactions)) customer.transactions = [];
    customer.transactions.unshift({ id: 'ctx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4), customerId, ...tx, amount: Number(tx.amount) || 0 });
    customer.balance = customer.transactions.reduce((acc, t) => t.type === 'DEBT' ? acc + t.amount : acc - t.amount, 0);
    localStorage.setItem(STORAGE_CUSTOMERS_KEY, JSON.stringify(customers));
  },

  updateCustomerTransaction(customerId: string, txId: string, updated: { type: 'DEBT' | 'COLLECTION', amount: number, paymentMethod: 'CASH' | 'BANK' | 'CREDIT_CARD', date: string, description: string }): Customer | null {
    const customers = this.getCustomers();
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return null;
    if (!Array.isArray(customer.transactions)) customer.transactions = [];
    const txIndex = customer.transactions.findIndex(t => t.id === txId);
    if (txIndex === -1) return null;
    customer.transactions[txIndex] = { ...customer.transactions[txIndex], ...updated, amount: Number(updated.amount) || 0 };
    customer.balance = customer.transactions.reduce((acc, t) => t.type === 'DEBT' ? acc + t.amount : acc - t.amount, 0);
    localStorage.setItem(STORAGE_CUSTOMERS_KEY, JSON.stringify(customers));
    return customer;
  },

  deleteCustomerTransaction(customerId: string, txId: string): Customer | null {
    const customers = this.getCustomers();
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return null;
    if (!Array.isArray(customer.transactions)) customer.transactions = [];
    customer.transactions = customer.transactions.filter(t => t.id !== txId);
    customer.balance = customer.transactions.reduce((acc, t) => t.type === 'DEBT' ? acc + t.amount : acc - t.amount, 0);
    localStorage.setItem(STORAGE_CUSTOMERS_KEY, JSON.stringify(customers));
    return customer;
  },

  getSuppliers(): Supplier[] {
    const raw = localStorage.getItem(STORAGE_SUPPLIERS_KEY);
    if (!raw) return [];
    try {
      const list: Supplier[] = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list.map(s => ({ ...s, balance: Number(s.balance) || 0, transactions: Array.isArray(s.transactions) ? s.transactions : [] }));
    } catch { return []; }
  },

  saveSupplier(supplier: Omit<Supplier, 'id' | 'balance' | 'createdAt' | 'transactions'> & { id?: string }): Supplier {
    const suppliers = this.getSuppliers();
    if (supplier.id) {
      const index = suppliers.findIndex(s => s.id === supplier.id);
      if (index !== -1) {
        suppliers[index] = { ...suppliers[index], name: supplier.name.trim(), category: supplier.category, phone: supplier.phone ? supplier.phone.trim() : '', contactPerson: supplier.contactPerson ? supplier.contactPerson.trim() : '', notes: supplier.notes ? supplier.notes.trim() : '' };
        localStorage.setItem(STORAGE_SUPPLIERS_KEY, JSON.stringify(suppliers));
        return suppliers[index];
      }
    }
    const newSupplier: Supplier = { ...supplier, id: 'sup_' + Date.now(), balance: 0, createdAt: new Date().toISOString().split('T')[0], transactions: [] };
    suppliers.unshift(newSupplier);
    localStorage.setItem(STORAGE_SUPPLIERS_KEY, JSON.stringify(suppliers));
    return newSupplier;
  },

  deleteSupplier(supplierId: string): boolean {
    let suppliers = this.getSuppliers();
    suppliers = suppliers.filter(s => s.id !== supplierId);
    localStorage.setItem(STORAGE_SUPPLIERS_KEY, JSON.stringify(suppliers));
    return true;
  },

  addSupplierTransaction(supplierId: string, tx: { type: 'PURCHASE' | 'PAYMENT', amount: number, paymentMethod?: 'CASH' | 'BANK' | 'CREDIT_CARD' | 'CHECK', documentNumber?: string, dueDate?: string, date: string, description: string }): void {
    const suppliers = this.getSuppliers();
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    if (!Array.isArray(supplier.transactions)) supplier.transactions = [];
    supplier.transactions.unshift({ id: 'stx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4), supplierId, ...tx, amount: Number(tx.amount) || 0 });
    supplier.balance = supplier.transactions.reduce((acc, t) => t.type === 'PURCHASE' ? acc + t.amount : acc - t.amount, 0);
    localStorage.setItem(STORAGE_SUPPLIERS_KEY, JSON.stringify(suppliers));
  },

  updateSupplierTransaction(supplierId: string, txId: string, updated: { type: 'PURCHASE' | 'PAYMENT', amount: number, paymentMethod?: 'CASH' | 'BANK' | 'CREDIT_CARD' | 'CHECK', documentNumber?: string, dueDate?: string, date: string, description: string }): Supplier | null {
    const suppliers = this.getSuppliers();
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return null;
    if (!Array.isArray(supplier.transactions)) supplier.transactions = [];
    const txIndex = supplier.transactions.findIndex(t => t.id === txId);
    if (txIndex === -1) return null;
    supplier.transactions[txIndex] = { ...supplier.transactions[txIndex], ...updated, amount: Number(updated.amount) || 0 };
    supplier.balance = supplier.transactions.reduce((acc, t) => t.type === 'PURCHASE' ? acc + t.amount : acc - t.amount, 0);
    localStorage.setItem(STORAGE_SUPPLIERS_KEY, JSON.stringify(suppliers));
    return supplier;
  },

  deleteSupplierTransaction(supplierId: string, txId: string): Supplier | null {
    const suppliers = this.getSuppliers();
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return null;
    if (!Array.isArray(supplier.transactions)) supplier.transactions = [];
    supplier.transactions = supplier.transactions.filter(t => t.id !== txId);
    supplier.balance = supplier.transactions.reduce((acc, t) => t.type === 'PURCHASE' ? acc + t.amount : acc - t.amount, 0);
    localStorage.setItem(STORAGE_SUPPLIERS_KEY, JSON.stringify(suppliers));
    return supplier;
  },

  getExpenses(): Expense[] {
    const raw = localStorage.getItem(STORAGE_EXPENSES_KEY);
    if (!raw) return [];
    try {
      const list: Expense[] = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list.map(e => ({ ...e, amount: Number(e.amount) || 0 }));
    } catch { return []; }
  },

  saveExpense(expense: Omit<Expense, 'id' | 'createdAt'> & { id?: string }): Expense {
    const expenses = this.getExpenses();
    const today = new Date().toISOString().split('T')[0];
    if (expense.id) {
      const index = expenses.findIndex(e => e.id === expense.id);
      if (index !== -1) {
        expenses[index] = { ...expenses[index], title: expense.title.trim(), category: expense.category, supplier: expense.supplier ? expense.supplier.trim() : '', amount: Number(expense.amount) || 0, paymentMethod: expense.paymentMethod, date: expense.date || today, description: expense.description ? expense.description.trim() : '' };
        localStorage.setItem(STORAGE_EXPENSES_KEY, JSON.stringify(expenses));
        return expenses[index];
      }
    }
    const newExpense: Expense = { id: 'exp_' + Date.now(), title: expense.title.trim(), category: expense.category, supplier: expense.supplier ? expense.supplier.trim() : '', amount: Number(expense.amount) || 0, paymentMethod: expense.paymentMethod, date: expense.date || today, description: expense.description ? expense.description.trim() : '', createdAt: today };
    expenses.unshift(newExpense);
    localStorage.setItem(STORAGE_EXPENSES_KEY, JSON.stringify(expenses));
    return newExpense;
  },

  deleteExpense(expenseId: string): boolean {
    let expenses = this.getExpenses();
    expenses = expenses.filter(e => e.id !== expenseId);
    localStorage.setItem(STORAGE_EXPENSES_KEY, JSON.stringify(expenses));
    return true;
  },

  getEmployees(): Employee[] {
    const raw = localStorage.getItem(STORAGE_EMPLOYEES_KEY);
    if (!raw) return [];
    try {
      const list: Employee[] = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list.map(e => ({
        ...e,
        salary: Number(e.salary) || 0,
        balance: Number(e.balance) || 0,
        startDate: e.startDate || e.createdAt || new Date().toISOString().split('T')[0],
        status: e.status || (e.isActive === false ? 'TERMINATED' : 'ACTIVE'),
        payday: Number(e.payday) || 1,
        payments: Array.isArray(e.payments) ? e.payments : []
      }));
    } catch {
      return [];
    }
  },

  saveEmployee(employee: { id?: string; fullName: string; phone?: string; position?: string; salary: number; iban?: string; startDate?: string; leaveDate?: string; leaveReason?: string; status?: EmployeeStatus; payday?: number; initialBalance?: number }): Employee {
    const employees = this.getEmployees();
    const today = new Date().toISOString().split('T')[0];
    const sDate = employee.startDate || today;
    const pDay = Number(employee.payday) || 1;
    const empStatus = employee.status || 'ACTIVE';

    if (employee.id) {
      const index = employees.findIndex(e => e.id === employee.id);
      if (index !== -1) {
        employees[index] = {
          ...employees[index],
          fullName: employee.fullName,
          phone: employee.phone || '',
          position: employee.position || '',
          salary: Number(employee.salary) || 0,
          iban: employee.iban || '',
          startDate: sDate,
          leaveDate: employee.leaveDate || employees[index].leaveDate,
          leaveReason: employee.leaveReason || employees[index].leaveReason,
          status: empStatus,
          isActive: empStatus === 'ACTIVE',
          payday: pDay
        };
        const pList = Array.isArray(employees[index].payments) ? employees[index].payments : [];
        employees[index].balance = pList.reduce((acc, p) => (p.type === 'SALARY_ACCRUAL' || p.type === 'BONUS' || p.type === 'TERMINATION_SETTLEMENT' || p.type === 'OVERTIME_ACCRUAL') ? acc + p.amount : acc - p.amount, 0);
        localStorage.setItem(STORAGE_EMPLOYEES_KEY, JSON.stringify(employees));
        return employees[index];
      }
    }

    const initBal = Number(employee.initialBalance) || 0;
    const initialPayments: EmployeePayment[] = [];
    if (initBal > 0) {
      initialPayments.push({
        id: 'ep_init_' + Date.now(),
        employeeId: 'e_' + Date.now(),
        type: 'SALARY_ACCRUAL',
        amount: initBal,
        paymentMethod: 'BANK',
        date: sDate,
        description: 'Geçmişten Devreden Hak Ediş / Maaş Borcu'
      });
    }

    const newEmployee: Employee = {
      id: 'e_' + Date.now(),
      fullName: employee.fullName,
      phone: employee.phone || '',
      position: employee.position || '',
      salary: Number(employee.salary) || 0,
      iban: employee.iban || '',
      startDate: sDate,
      leaveDate: employee.leaveDate,
      leaveReason: employee.leaveReason,
      status: empStatus,
      payday: pDay,
      balance: initBal,
      isActive: empStatus === 'ACTIVE',
      createdAt: today,
      payments: initialPayments
    };
    employees.unshift(newEmployee);
    localStorage.setItem(STORAGE_EMPLOYEES_KEY, JSON.stringify(employees));
    return newEmployee;
  },

  terminateEmployee(employeeId: string, leaveDate: string, leaveReason: string, settlementAmount?: number, settlementDesc?: string): Employee | null {
    const employees = this.getEmployees();
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return null;

    employee.status = 'TERMINATED';
    employee.isActive = false;
    employee.leaveDate = leaveDate;
    employee.leaveReason = leaveReason || 'İşten Ayrılış';
    if (!Array.isArray(employee.payments)) employee.payments = [];
    if (settlementAmount && settlementAmount > 0) {
      employee.payments.unshift({
        id: 'ep_term_' + Date.now(),
        employeeId: employee.id,
        type: 'TERMINATION_SETTLEMENT',
        amount: Number(settlementAmount),
        paymentMethod: 'BANK',
        date: leaveDate,
        description: settlementDesc || `İşten Çıkış Hakedişi / Tazminat (${leaveReason})`
      });
    }
    employee.balance = employee.payments.reduce((acc, p) => (p.type === 'SALARY_ACCRUAL' || p.type === 'BONUS' || p.type === 'TERMINATION_SETTLEMENT' || p.type === 'OVERTIME_ACCRUAL') ? acc + p.amount : acc - p.amount, 0);
    localStorage.setItem(STORAGE_EMPLOYEES_KEY, JSON.stringify(employees));
    return employee;
  },

  reactivateEmployee(employeeId: string): Employee | null {
    const employees = this.getEmployees();
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return null;
    employee.status = 'ACTIVE';
    employee.isActive = true;
    employee.leaveDate = undefined;
    employee.leaveReason = undefined;
    localStorage.setItem(STORAGE_EMPLOYEES_KEY, JSON.stringify(employees));
    return employee;
  },

  deleteEmployee(employeeId: string): boolean {
    let employees = this.getEmployees();
    employees = employees.filter(e => e.id !== employeeId);
    localStorage.setItem(STORAGE_EMPLOYEES_KEY, JSON.stringify(employees));
    return true;
  },

  addEmployeePayment(employeeId: string, payment: { type: 'SALARY_ACCRUAL' | 'ADVANCE' | 'SALARY_PAYMENT' | 'BONUS' | 'DEDUCTION' | 'TERMINATION_SETTLEMENT' | 'OVERTIME_ACCRUAL' | 'OVERTIME_PAYMENT', amount: number, paymentMethod: 'CASH' | 'BANK', date: string, description: string }): void {
    const employees = this.getEmployees();
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    if (!Array.isArray(employee.payments)) employee.payments = [];
    employee.payments.unshift({ id: 'epay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4), employeeId, ...payment, amount: Number(payment.amount) || 0 });
    employee.balance = employee.payments.reduce((acc, p) => (p.type === 'SALARY_ACCRUAL' || p.type === 'BONUS' || p.type === 'TERMINATION_SETTLEMENT' || p.type === 'OVERTIME_ACCRUAL') ? acc + p.amount : acc - p.amount, 0);
    localStorage.setItem(STORAGE_EMPLOYEES_KEY, JSON.stringify(employees));
  },

  updateEmployeePayment(employeeId: string, paymentId: string, updated: { type: 'SALARY_ACCRUAL' | 'ADVANCE' | 'SALARY_PAYMENT' | 'BONUS' | 'DEDUCTION' | 'TERMINATION_SETTLEMENT' | 'OVERTIME_ACCRUAL' | 'OVERTIME_PAYMENT', amount: number, paymentMethod: 'CASH' | 'BANK', date: string, description: string }): Employee | null {
    const employees = this.getEmployees();
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return null;
    if (!Array.isArray(employee.payments)) employee.payments = [];
    const pIndex = employee.payments.findIndex(p => p.id === paymentId);
    if (pIndex === -1) return null;
    employee.payments[pIndex] = { ...employee.payments[pIndex], ...updated, amount: Number(updated.amount) || 0 };
    employee.balance = employee.payments.reduce((acc, p) => (p.type === 'SALARY_ACCRUAL' || p.type === 'BONUS' || p.type === 'TERMINATION_SETTLEMENT' || p.type === 'OVERTIME_ACCRUAL') ? acc + p.amount : acc - p.amount, 0);
    localStorage.setItem(STORAGE_EMPLOYEES_KEY, JSON.stringify(employees));
    return employee;
  },

  deleteEmployeePayment(employeeId: string, paymentId: string): Employee | null {
    const employees = this.getEmployees();
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return null;
    if (!Array.isArray(employee.payments)) employee.payments = [];
    employee.payments = employee.payments.filter(p => p.id !== paymentId);
    employee.balance = employee.payments.reduce((acc, p) => (p.type === 'SALARY_ACCRUAL' || p.type === 'BONUS' || p.type === 'TERMINATION_SETTLEMENT' || p.type === 'OVERTIME_ACCRUAL') ? acc + p.amount : acc - p.amount, 0);
    localStorage.setItem(STORAGE_EMPLOYEES_KEY, JSON.stringify(employees));
    return employee;
  },

  // === FAZLA MESAİ MOTORU (GÜNLÜK ÇALIŞMA SAATİNE VE ÇARPANA GÖRE HESAPLANIR) ===
  addEmployeeOvertime(employeeId: string, overtime: {
    amount: number;
    date: string;
    description: string;
    payoutType: 'INSTANT_CASH' | 'INSTANT_BANK' | 'ACCRUE_TO_SALARY';
  }): void {
    const employees = this.getEmployees();
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;

    if (!Array.isArray(employee.payments)) employee.payments = [];
    const amount = Number(overtime.amount) || 0;

    if (overtime.payoutType === 'ACCRUE_TO_SALARY') {
      employee.payments.unshift({
        id: 'ep_ot_' + Date.now(),
        employeeId: employee.id,
        type: 'OVERTIME_ACCRUAL',
        amount: amount,
        paymentMethod: 'BANK',
        date: overtime.date,
        description: `${overtime.description} (Maaşa Yansıtıldı)`
      });
    } else {
      const method = overtime.payoutType === 'INSTANT_CASH' ? 'CASH' : 'BANK';
      const methodText = method === 'CASH' ? 'Nakit Kasa' : 'Banka / Havale';

      employee.payments.unshift({
        id: 'ep_ot_acc_' + Date.now(),
        employeeId: employee.id,
        type: 'OVERTIME_ACCRUAL',
        amount: amount,
        paymentMethod: method,
        date: overtime.date,
        description: `${overtime.description} (Günlük Hak Edildi)`
      });

      employee.payments.unshift({
        id: 'ep_ot_pay_' + (Date.now() + 1),
        employeeId: employee.id,
        type: 'OVERTIME_PAYMENT',
        amount: amount,
        paymentMethod: method,
        date: overtime.date,
        description: `${overtime.description} (Günlük Ödendi - ${methodText})`
      });
    }

    employee.balance = employee.payments.reduce((acc, p) => (p.type === 'SALARY_ACCRUAL' || p.type === 'BONUS' || p.type === 'TERMINATION_SETTLEMENT' || p.type === 'OVERTIME_ACCRUAL') ? acc + p.amount : acc - p.amount, 0);
    localStorage.setItem(STORAGE_EMPLOYEES_KEY, JSON.stringify(employees));
  },

  getPendingSalaryAccruals(): PendingSalaryAccrual[] {
    try {
      const employees = this.getEmployees();
      const pendingList: PendingSalaryAccrual[] = [];
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const currentDay = now.getDate();
      const todayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

      employees.forEach(emp => {
        if (emp.status === 'TERMINATED' && emp.leaveDate) return;
        if (!emp.salary || emp.salary <= 0 || !emp.startDate) return;

        const parts = emp.startDate.split('-');
        if (parts.length !== 3) return;

        const startYear = parseInt(parts[0], 10);
        const startMonth = parseInt(parts[1], 10) - 1;
        const startDay = parseInt(parts[2], 10);
        const pDay = Number(emp.payday) || 1;
        const paymentsList = Array.isArray(emp.payments) ? emp.payments : [];

        let curYear = startYear;
        let curMonth = startMonth;

        while (true) {
          let payYear = curYear;
          let payMonth = curMonth + 1;
          if (payMonth > 11) { payMonth = 0; payYear++; }

          const maxDaysInPayMonth = new Date(payYear, payMonth + 1, 0).getDate();
          const effectivePayDay = Math.min(pDay, maxDaysInPayMonth);
          const dueDateStr = `${payYear}-${String(payMonth + 1).padStart(2, '0')}-${String(effectivePayDay).padStart(2, '0')}`;

          if (dueDateStr > todayStr) break;

          const maxDaysInWorkMonth = new Date(curYear, curMonth + 1, 0).getDate();
          let firstWorkDay = (curYear === startYear && curMonth === startMonth) ? startDay : 1;
          const workedDays = (maxDaysInWorkMonth - firstWorkDay + 1);

          let isFullMonth = (firstWorkDay === 1);
          let calculatedSalary = emp.salary;

          if (!isFullMonth) {
            calculatedSalary = Math.round(((emp.salary / 30) * workedDays) * 100) / 100;
          }

          const workMonthName = new Date(curYear, curMonth, 1).toLocaleDateString('tr-TR', { month: 'long' });
          const periodText = isFullMonth
            ? `${workMonthName} ${curYear} Maaş Hakedişi (Tam Ay)`
            : `${workMonthName} ${curYear} Maaş Hakedişi (${workedDays} Günlük Kıst Maaş)`;

          const alreadyAccrued = paymentsList.some(p => 
            p && p.type === 'SALARY_ACCRUAL' && (
              (p.description && p.description.includes(`${workMonthName} ${curYear} Maaş Hakedişi`)) || p.date === dueDateStr
            )
          );

          if (!alreadyAccrued) {
            pendingList.push({
              employeeId: emp.id,
              employeeName: emp.fullName,
              position: emp.position || 'Personel',
              salary: calculatedSalary,
              dueDate: dueDateStr,
              periodText: periodText,
              workedDays: workedDays
            });
          }

          curMonth++;
          if (curMonth > 11) { curMonth = 0; curYear++; }
        }
      });
      return pendingList;
    } catch {
      return [];
    }
  },

  approveSalaryAccrual(pending: PendingSalaryAccrual): void {
    this.addEmployeePayment(pending.employeeId, {
      type: 'SALARY_ACCRUAL',
      amount: pending.salary,
      paymentMethod: 'BANK',
      date: pending.dueDate,
      description: `${pending.periodText} (Onaylandı)`
    });
  },

  approveAllSalaryAccruals(pendingList: PendingSalaryAccrual[]): void {
    pendingList.forEach(item => { this.approveSalaryAccrual(item); });
  },

  getSummaryStats() {
    const customers = this.getCustomers();
    const employees = this.getEmployees();
    const suppliers = this.getSuppliers();
    const expenses = this.getExpenses();

    let totalReceivables = 0; let totalCustomerCollections = 0;
    customers.forEach(c => {
      totalReceivables += (Number(c.balance) || 0);
      if (Array.isArray(c.transactions)) {
        c.transactions.forEach(t => { if (t && t.type === 'COLLECTION') totalCustomerCollections += (Number(t.amount) || 0); });
      }
    });

    let totalSupplierPayables = 0; let totalSupplierPayments = 0;
    suppliers.forEach(s => {
      totalSupplierPayables += (Number(s.balance) || 0);
      if (Array.isArray(s.transactions)) {
        s.transactions.forEach(t => { if (t && t.type === 'PAYMENT') totalSupplierPayments += (Number(t.amount) || 0); });
      }
    });

    let totalPersonnelDebt = 0; let totalPersonnelPaid = 0;
    employees.forEach(e => {
      totalPersonnelDebt += (Number(e.balance) || 0);
      if (Array.isArray(e.payments)) {
        e.payments.forEach(p => {
          if (p && (p.type === 'SALARY_PAYMENT' || p.type === 'ADVANCE' || p.type === 'OVERTIME_PAYMENT')) {
            totalPersonnelPaid += (Number(p.amount) || 0);
          }
        });
      }
    });

    let totalExpenses = 0;
    expenses.forEach(exp => { totalExpenses += (Number(exp.amount) || 0); });

    return {
      totalReceivables, totalSupplierPayables, totalPersonnelDebt, totalCustomerCollections,
      totalPersonnelPaid, totalExpenses, totalSupplierPayments,
      netCashFlow: totalCustomerCollections - (totalPersonnelPaid + totalExpenses + totalSupplierPayments)
    };
  }
};