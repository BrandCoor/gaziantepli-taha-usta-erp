// Gaziantepli Taha Usta - ERP, Cari & Personel Servisi

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
  balance: number; // Pozitif = Müşteri Borçlu (Alacağımız Var)
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
  supplier?: string;
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
  EMPLOYEES: 'gtu_erp_employees',
  EMPLOYEE_PAYMENTS: 'gtu_erp_employee_payments',
  EXPENSES: 'gtu_erp_expenses',
  USERS: 'gtu_erp_users',
  COMPANY: 'gtu_erp_company_settings',
};

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

  public getCustomerTransactions(): CustomerTransaction[] {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOMER_TX);
    return data ? JSON.parse(data) : [];
  }

  public saveCustomerTransactions(txs: CustomerTransaction[]) {
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_TX, JSON.stringify(txs));
  }

  // CARİ BORÇLANDIRMA / TAHSİLAT (MÜŞTERİ BAKİYESİNİ GÜNCELLER)
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

    // BAKİYEYİ GÜNCELLE: DEBT (Borç) ise bakiye artar, COLLECTION (Tahsilat) ise düşer
    if (tx.type === 'DEBT') {
      customer.balance = (Number(customer.balance) || 0) + Number(tx.amount);
    } else if (tx.type === 'COLLECTION') {
      customer.balance = (Number(customer.balance) || 0) - Number(tx.amount);
    }
    customer.updatedAt = new Date().toISOString();

    this.saveCustomers(customers);
    return newTx;
  }

  // 2. PERSONELLER
  public getEmployees(): Employee[] {
    const data = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
    return data ? JSON.parse(data) : [];
  }

  public saveEmployees(emps: Employee[]) {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(emps));
    this.notify();
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

  public getPendingSalaryAccruals(): PendingSalaryAccrual[] {
    return [];
  }

  public approveSalaryAccrual(item: PendingSalaryAccrual) {}
  public approveAllSalaryAccruals(items: PendingSalaryAccrual[]) {}

  // 3. GİDERLER & HARCAMALAR
  public getExpenses(): Expense[] {
    const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    return data ? JSON.parse(data) : [];
  }

  public saveExpense(exp: Omit<Expense, 'id' | 'createdAt'>) {
    const expenses = this.getExpenses();
    const newExp: Expense = { ...exp, id: `exp-${Date.now()}`, createdAt: new Date().toISOString() };
    expenses.push(newExp);
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    this.notify();
  }

  public getSuppliers(): string[] {
    return ['Et ve Tavuk Tedarikçisi', 'Sebze & Hal Tedarikçisi', 'Meşrubat Bayii', 'Un & Fırın Malzemeleri'];
  }

  // 4. KULLANICILAR & AYARLAR
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
