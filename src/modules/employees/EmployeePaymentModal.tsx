import React, { useState, useEffect } from 'react';
import { 
  X, 
  DollarSign, 
  CreditCard, 
  Banknote, 
  Calendar, 
  User, 
  CheckCircle2, 
  ArrowDownCircle, 
  ArrowUpCircle,
  Gift,
  AlertTriangle
} from 'lucide-react';
import { Employee, dataService } from '../../services/dataService';
import { notify } from '../../services/notificationService';

interface EmployeePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  initialEmployeeId?: string;
  initialType?: 'ADVANCE' | 'SALARY_PAYMENT' | 'BONUS' | 'DEDUCTION' | 'SALARY_ACCRUAL';
  onSuccess: () => void;
}

export const EmployeePaymentModal: React.FC<EmployeePaymentModalProps> = ({
  isOpen,
  onClose,
  employees,
  initialEmployeeId,
  initialType = 'ADVANCE',
  onSuccess,
}) => {
  const [employeeId, setEmployeeId] = useState<string>('');
  const [type, setType] = useState<'ADVANCE' | 'SALARY_PAYMENT' | 'BONUS' | 'DEDUCTION' | 'SALARY_ACCRUAL'>('ADVANCE');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK'>('CASH');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');
  const [recordExpense, setRecordExpense] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      if (initialEmployeeId && employees.some(e => e.id === initialEmployeeId)) {
        setEmployeeId(initialEmployeeId);
      } else if (employees.length > 0 && !employeeId) {
        setEmployeeId(employees[0].id);
      }
      if (initialType) setType(initialType);
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, initialEmployeeId, initialType, employees]);

  const selectedEmployee = employees.find(e => e.id === employeeId);

  // Otomatik önerilen tutar
  useEffect(() => {
    if (selectedEmployee) {
      if (type === 'SALARY_PAYMENT') {
        // Eğer personelin bakiyesi varsa doğrudan kalan bakiyeyi öner
        if (selectedEmployee.balance > 0) {
          setAmount(selectedEmployee.balance.toString());
        } else if (selectedEmployee.salary > 0) {
          setAmount(selectedEmployee.salary.toString());
        }
      } else if (type === 'SALARY_ACCRUAL') {
        setAmount(selectedEmployee.salary.toString());
      }
    }
  }, [type, selectedEmployee]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!employeeId) {
      notify.error('Lütfen bir personel seçin.');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      notify.error('Lütfen geçerli bir tutar girin.');
      return;
    }

    const isAccrual = type === 'SALARY_ACCRUAL' || type === 'BONUS';

    let defaultDesc = '';
    if (type === 'ADVANCE') defaultDesc = 'Maaş Avansı Verildi';
    else if (type === 'SALARY_PAYMENT') defaultDesc = 'Maaş / Hakediş Ödemesi';
    else if (type === 'BONUS') defaultDesc = 'Prim / Bahşiş Hakedişi';
    else if (type === 'DEDUCTION') defaultDesc = 'Maaş Kesintisi';
    else if (type === 'SALARY_ACCRUAL') defaultDesc = 'Aylık Maaş Hakediş Tahakkuku';

    const finalDesc = description.trim() || defaultDesc;

    dataService.addEmployeePayment(employeeId, {
      type,
      amount: numAmount,
      paymentMethod,
      date,
      description: finalDesc,
    });

    // İsteğe bağlı gider kaydı oluştur (Avans veya Maaş Ödemesi nakit/banka olarak ödendiğinde)
    if (!isAccrual && recordExpense && type !== 'DEDUCTION') {
      dataService.addExpense({
        title: `Personel Ödemesi (${type === 'ADVANCE' ? 'Avans' : 'Maaş'}) - ${selectedEmployee?.fullName}`,
        category: 'Personel / Maaş & Avans',
        amount: numAmount,
        paymentMethod: paymentMethod === 'BANK' ? 'BANK' : 'CASH',
        date,
        description: `${selectedEmployee?.fullName} - ${finalDesc}`,
      });
    }

    notify.success(`${selectedEmployee?.fullName} için işlem başarıyla kaydedildi.`);
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#18181C] border border-[#2C2C34] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-[#FAF7F2]">
        <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Avans & Maaş Ödemesi</h3>
              <p className="text-xs text-[#8E8E98]">Avans verme, maaş kapatma, prim ve kesinti işlemleri</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-[#8E8E98] hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* İşlem Türü Butonları */}
          <div>
            <label className="text-xs font-bold text-[#8E8E98] mb-1.5 block">İşlem Türü</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'ADVANCE', label: 'Avans Ver', icon: ArrowDownCircle, color: 'text-amber-400', desc: 'Bakiyeden düşer' },
                { id: 'SALARY_PAYMENT', label: 'Maaş Öde', icon: Banknote, color: 'text-emerald-400', desc: 'Bakiyeden düşer' },
                { id: 'BONUS', label: 'Prim / Bahşiş', icon: Gift, color: 'text-blue-400', desc: 'Bakiyeyi artırır' },
                { id: 'DEDUCTION', label: 'Kesinti', icon: AlertTriangle, color: 'text-rose-400', desc: 'Bakiyeden düşer' },
                { id: 'SALARY_ACCRUAL', label: 'Maaş Tahakkuku', icon: ArrowUpCircle, color: 'text-purple-400', desc: 'Hakedişe ekler' },
              ].map((item) => {
                const Icon = item.icon;
                const active = type === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setType(item.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-[#24242C] border-amber-400 text-white shadow-md'
                        : 'bg-[#121214] border-[#2C2C34] text-[#8E8E98] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                      <span className="text-xs font-bold">{item.label}</span>
                    </div>
                    <div className="text-[10px] text-[#6E6E78] mt-0.5">{item.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Personel Seçimi */}
          <div>
            <label className="text-xs font-bold text-[#8E8E98] mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#F5C877]" /> Personel
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
              className="w-full p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-white focus:border-[#F5C877] focus:outline-none"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.position || 'Personel'}) - Bakiye: {emp.balance.toLocaleString('tr-TR')} ₺
                </option>
              ))}
            </select>
            {selectedEmployee && (
              <div className="mt-1 flex items-center justify-between text-[11px] text-[#8E8E98] px-1">
                <span>Sabit Maaş: <strong className="text-white">{selectedEmployee.salary.toLocaleString('tr-TR')} ₺</strong></span>
                <span>Ödenecek Bakiye: <strong className={selectedEmployee.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}>{selectedEmployee.balance.toLocaleString('tr-TR')} ₺</strong></span>
              </div>
            )}
          </div>

          {/* Tutar & Tarih */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#8E8E98] mb-1 block">Tutar (₺)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-sm font-mono font-black text-amber-400 focus:border-[#F5C877] focus:outline-none"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[#8E8E98] font-bold">₺</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#8E8E98] mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#F5C877]" /> Tarih
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-white focus:border-[#F5C877] focus:outline-none"
              />
            </div>
          </div>

          {/* Ödeme Kanalı */}
          {type !== 'SALARY_ACCRUAL' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#8E8E98]">Ödeme Kanalı</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                      paymentMethod === 'CASH' ? 'bg-[#F5C877] text-black shadow' : 'bg-[#121214] text-[#8E8E98]'
                    }`}
                  >
                    Nakit Kasa
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BANK')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                      paymentMethod === 'BANK' ? 'bg-[#F5C877] text-black shadow' : 'bg-[#121214] text-[#8E8E98]'
                    }`}
                  >
                    Banka Havalesi
                  </button>
                </div>
              </div>

              {(type === 'ADVANCE' || type === 'SALARY_PAYMENT') && (
                <label className="flex items-center gap-2 text-xs text-[#A0A0AA] cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={recordExpense}
                    onChange={(e) => setRecordExpense(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-[#121214] border-[#2C2C34]"
                  />
                  <span>İşletme kasasından / giderlerinden çıkış olarak düşülsün</span>
                </label>
              )}
            </div>
          )}

          {/* Açıklama */}
          <div>
            <label className="text-xs font-bold text-[#8E8E98] mb-1 block">Açıklama (İsteğe Bağlı)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Örn: 15 Günlük Avans, Mayıs Maaşı Kapatma vb."
              className="w-full p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-white focus:border-[#F5C877] focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>İşlemi Kaydet</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
