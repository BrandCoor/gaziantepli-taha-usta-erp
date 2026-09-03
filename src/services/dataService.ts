// Gaziantepli Taha Usta - ERP, Cari, Personel, Toptancı & Gider Servisi

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
  createdAt: string;
  updatedAt: string;
}

// TOPTANCI & TEDARİKÇİ MODELLERİ
export interface SupplierTransaction {
  id: string;
  supplierId: string;
  type: 'INVOICE' | 'PAYMENT'; // INVOICE = Alış Faturası, PAYMENT = Ödeme Çıkışı
  amount: number;
  paymentMethod: 'CASH' | 'BANK' | 'CREDIT_CARD';
  date: string;
  invoiceNo?: string;
  description?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  category: string; // Et & Tavuk, Hal / Sebze, Un / Fırın, Meşrubat / İçecek, Ambalaj / Sarf, Diğer
  address?: string;
  balance: number; // Pozitif = Toptancıya Borcumuz Var
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeePayment {
  id: string;
  employeeId: string;
  type: 'SALARY_ACCRUAL' | 'ADVANCE' | 'SALARY_PAYMENT' | 'BONUS' | 'DEDUCTION';
  amount: number;
  paymentMethod: 'CASH' | 'BANK';
  date: string;
  description?: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  fullName: string;
  phone?: string;
  position?: string;
  salary: number;
  iban?: string;
  balance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  title: string;
  category: string;
  supplierId?: string;
  supplierName?: string;
  amount: number;
  paymentMethod: 'CASH' | 'CREDIT_CARD' | 'BANK';
  date: string;
  description?: string;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: 'ADMIN' | 'CASHIER' | 'WAITER';
}

export interface CompanySettings {
  companyName: string;
  logoBase64?: string;
  phone?: string;
  address?: string;
}

export interface PendingSalaryAccrual {
  employeeId: string;
  employeeName: string;
  salary: number;
  dueDate: string;
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

const DEFAULT_SUPPLIERS: Supplier[] = [
  { id: 'sup-1', name: 'Antep Et & Kasap Dünyası', contactPerson: 'Mustafa Usta', phone: '0532 222 33 44', category: 'Et & Tavuk', address: 'Gaziantep Kasaplar Hali', balance: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'sup-2', name: 'Hal Sebze & Meyve Tedarik', contactPerson: 'Ali Bey', phone: '0544 333 44 55', category: 'Hal / Sebze', address: 'Şehitkamil Toptancılar Hali', balance: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'sup-3', name: 'Gaziantep Un & Fırın Malzemeleri', contactPerson: 'Hasan Bey', phone: '0342 555 11 22', category: 'Un / Fırın', address: 'Sanayi Sitesi', balance: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const DEFAULT_CUSTOMERS: Customer[] = [
  { id: 'cust-1', name: 'Ahmet Demir (Cari Müşteri)', phone: '0532 111 22 33', address: 'Şehitkamil / Gaziantep', balance: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cust-2', name: 'Gaziantep İnşaat A.Ş.', phone: '0342 222 33 44', address: 'İncilipınar Mah. No:12', balance: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

class DataService {
  private listeners: Set<() => void> = new Set();

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // 1. MÜŞTERİLER VE CARİ İŞLEMLER
  public getCustomers(): Customer[] {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    return data ? JSON.parse(data) : DEFAULT_CUSTOMERS;
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

  public deleteCustomer(id: string) {
    const customers = this.getCustomers().filter(c => c.id !== id);
    this.saveCustomers(customers);
  }

  public getCustomerTransactions(): CustomerTransaction[] {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOMER_TX);
    return data ? JSON.parse(data) : [];
  }

  public saveCustomerTransactions(txs: CustomerTransaction[]) {
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_TX, JSON.stringify(txs));
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

  // 2. TOPTANCILAR & TEDARİKÇİLER
  public getSuppliers(): Supplier[] {
    const data = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
    return data ? JSON.parse(data) : DEFAULT_SUPPLIERS;
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

  public deleteSupplier(id: string) {
    const suppliers = this.getSuppliers().filter(s => s.id !== id);
    this.saveSuppliers(suppliers);
  }

  public getSupplierTransactions(): SupplierTransaction[] {
    const data = localStorage.getItem(STORAGE_KEYS.SUPPLIER_TX);
    return data ? JSON.parse(data) : [];
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

  public getSupplierStatement(supplierId: string): SupplierTransaction[] {
    const all = this.getSupplierTransactions();
    return all.filter(t => t.supplierId === supplierId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // 3. İŞLETME GİDERLERİ
  public getExpenses(): Expense[] {
    const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    return data ? JSON.parse(data) : [];
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

  public updateExpense(id: string, partial: Partial<Expense>) {
    const expenses = this.getExpenses().map(e => e.id === id ? { ...e, ...partial } : e);
    this.saveExpensesList(expenses);
  }

  public deleteExpense(id: string) {
    const expenses = this.getExpenses().filter(e => e.id !== id);
    this.saveExpensesList(expenses);
  }

  // 4. PERSONELLER
  public getEmployees(): Employee[] {
    const data = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
    return data ? JSON.parse(data) : [];
  }

  public saveEmployees(emps: Employee[]) {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(emps));
    this.notify();
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

  public deleteEmployee(id: string) {
    const employees = this.getEmployees().filter(e => e.id !== id);
    this.saveEmployees(employees);
  }

  public getEmployeePayments(): EmployeePayment[] {
    const data = localStorage.getItem(STORAGE_KEYS.EMPLOYEE_PAYMENTS);
    return data ? JSON.parse(data) : [];
  }

  public addEmployeePayment(employeeId: string, payment: Omit<EmployeePayment, 'id' | 'employeeId' | 'createdAt'>) {
    const employees = this.getEmployees();
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    const payments = this.getEmployeePayments();
    const newPay: EmployeePayment = { ...payment, id: `ep-${Date.now()}`, employeeId, createdAt: new Date().toISOString() };
    payments.push(newPay);
    localStorage.setItem(STORAGE_KEYS.EMPLOYEE_PAYMENTS, JSON.stringify(payments));

    if (payment.type === 'SALARY_ACCRUAL') {
      emp.balance = (Number(emp.balance) || 0) + Number(payment.amount);
    } else {
      emp.balance = (Number(emp.balance) || 0) - Number(payment.amount);
    }
    this.saveEmployees(employees);
  }

  public getPendingSalaryAccruals(): PendingSalaryAccrual[] { return []; }
  public approveSalaryAccrual(item: PendingSalaryAccrual) {}
  public approveAllSalaryAccruals(items: PendingSalaryAccrual[]) {}

  // 5. KULLANICILAR & AYARLAR
  public getUsers(): User[] {
    return [{ id: 'u-1', username: 'admin', fullName: 'Taha Usta', role: 'ADMIN' }];
  }

  public getCurrentUser(): User {
    return { id: 'u-1', username: 'admin', fullName: 'Taha Usta', role: 'ADMIN' };
  }

  public hasPermission(perm: string): boolean {
    return true;
  }

  public getCompanySettings(): CompanySettings {
    const data = localStorage.getItem(STORAGE_KEYS.COMPANY);
    return data ? JSON.parse(data) : { companyName: 'Gaziantepli Taha Usta', phone: '0 (342) 555 00 27' };
  }
}

export const dataService = new DataService();
