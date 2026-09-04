import React, { useMemo, useState } from 'react';
import { 
  X, 
  Printer, 
  FileSpreadsheet, 
  Trash2, 
  Edit2,
  Clock, 
  DollarSign, 
  CreditCard, 
  CheckCircle2, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Employee, EmployeePayment, dataService } from '../../services/dataService';
import { exportService } from '../../services/exportService';
import { notify } from '../../services/notificationService';

interface EmployeeStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onUpdate: () => void;
}

export const EmployeeStatementModal: React.FC<EmployeeStatementModalProps> = ({
  isOpen,
  onClose,
  employee,
  onUpdate,
}) => {
  if (!isOpen || !employee) return null;

  // Düzenleme State'leri
  const [editingPayment, setEditingPayment] = useState<EmployeePayment | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState<EmployeePayment['type']>('SALARY_ACCRUAL');
  const [editPaymentMethod, setEditPaymentMethod] = useState<'CASH' | 'BANK'>('CASH');
  const [editDescription, setEditDescription] = useState('');

  const payments = useMemo(() => {
    return dataService.getEmployeePayments(employee.id).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [employee.id, isOpen]);

  const { totalAccrued, totalPaid, currentBalance } = useMemo(() => {
    let accrued = 0;
    let paid = 0;

    payments.forEach((p) => {
      const amt = Number(p.amount) || 0;
      if (
        p.type === 'SALARY_ACCRUAL' || 
        p.type === 'OVERTIME_ACCRUAL' || 
        p.type === 'BONUS' || 
        p.type === 'TERMINATION_SETTLEMENT'
      ) {
        accrued += amt;
      } else {
        paid += amt;
      }
    });

    return {
      totalAccrued: accrued,
      totalPaid: paid,
      currentBalance: accrued - paid,
    };
  }, [payments]);

  const employeeWithPayments: Employee = {
    ...employee,
    balance: currentBalance,
    payments,
  };

  const handleDeletePayment = (paymentId: string) => {
    notify.confirm({
      title: 'Hareketi Sil',
      message: 'Bu ödeme/mesai hareketini silmek istediğinize emin misiniz? Personel bakiyesi otomatik olarak yeniden hesaplanacaktır.',
      type: 'danger',
      confirmText: 'Evet, Sil',
      onConfirm: () => {
        dataService.deleteEmployeePayment(paymentId);
        notify.success('Kayıt Silindi', 'Hareket kaydı silindi ve personel bakiyesi güncellendi.');
        onUpdate();
      }
    });
  };

  const openEditModal = (p: EmployeePayment) => {
    setEditingPayment(p);
    setEditAmount(String(p.amount || 0));
    setEditDate(p.date ? p.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditType(p.type);
    setEditPaymentMethod(p.paymentMethod === 'BANK' ? 'BANK' : 'CASH');
    setEditDescription(p.description || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    const amountNum = parseFloat(editAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return notify.error('Geçersiz Tutar', 'Lütfen geçerli bir tutar girin.');
    }

    dataService.updateEmployeePayment(editingPayment.id, {
      amount: amountNum,
      date: editDate,
      type: editType,
      paymentMethod: editPaymentMethod,
      description: editDescription.trim(),
    });

    notify.success('Güncellendi', 'Hareket kaydı ve bakiye güncellendi.');
    setEditingPayment(null);
    onUpdate();
  };

  const handlePrintPdf = () => {
    exportService.exportSingleEmployeeStatementPdf(employeeWithPayments);
  };

  const handleExportExcel = () => {
    exportService.exportSingleEmployeeStatementExcel(employeeWithPayments);
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'OVERTIME_ACCRUAL':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Fazla Mesai (+Hakediş)</span>;
      case 'OVERTIME_PAYMENT':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Nakit Mesai Ödendi</span>;
      case 'SALARY_ACCRUAL':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">Maaş Hakedişi</span>;
      case 'SALARY_PAYMENT':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Maaş Ödemesi</span>;
      case 'ADVANCE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Avans</span>;
      case 'BONUS':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">Prim / Bahşiş</span>;
      case 'DEDUCTION':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">Kesinti</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/20 text-[#A0A0AA]">{type}</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-[#18181C] border border-[#2C2C34] rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-5 my-8 text-[#FAF7F2]">
        {/* Üst Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#2C2C34] pb-4 gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-black text-white">{employee.fullName}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#282830] text-amber-300">
                {employee.position || 'Personel'}
              </span>
            </div>
            <p className="text-xs text-[#8E8E98] mt-0.5">
              Sabit Maaş: <strong className="text-white">{employee.salary.toLocaleString('tr-TR')} ₺</strong> | Tel: {employee.phone || '-'}
              {employee.iban && ` | IBAN: ${employee.iban}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPdf}
              className="px-3.5 py-2 bg-[#282830] hover:bg-[#32323C] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Yazdır / PDF</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel İndir</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#8E8E98] hover:text-white rounded-xl hover:bg-[#282830] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3'lü Özet Kartları */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#26262E]">
            <div className="text-[11px] font-bold text-[#8E8E98]">Toplam Hakediş (+Mesai & Prim)</div>
            <div className="text-lg font-mono font-black text-purple-400 mt-1">
              {totalAccrued.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </div>
          </div>
          <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#26262E]">
            <div className="text-[11px] font-bold text-[#8E8E98]">Toplam Ödenen (Avans & Maaş)</div>
            <div className="text-lg font-mono font-black text-emerald-400 mt-1">
              {totalPaid.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </div>
          </div>
          <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#26262E]">
            <div className="text-[11px] font-bold text-[#8E8E98]">Güncel Kalan Hakediş / Borç</div>
            <div className={`text-lg font-mono font-black mt-1 ${currentBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {currentBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </div>
          </div>
        </div>

        {/* Hareket Tablosu */}
        <div className="border border-[#2C2C34] rounded-2xl overflow-hidden bg-[#121214]">
          <div className="p-3 bg-[#18181C] border-b border-[#2C2C34] flex items-center justify-between">
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              Maaş, Mesai ve Ödeme Hareketleri ({payments.length} Kayıt)
            </h3>
          </div>

          <div className="max-h-[350px] overflow-y-auto">
            {payments.length === 0 ? (
              <div className="p-8 text-center text-[#8E8E98] text-xs">
                Bu personele ait henüz herhangi bir mesai, hakediş veya ödeme kaydı bulunmuyor.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#26262E] text-[#8E8E98] bg-[#141416]">
                    <th className="p-2.5 font-bold">Tarih</th>
                    <th className="p-2.5 font-bold">İşlem Türü</th>
                    <th className="p-2.5 font-bold">Açıklama / Mesai Detayı</th>
                    <th className="p-2.5 font-bold">Kanal</th>
                    <th className="p-2.5 font-bold text-right">Hakediş (+)</th>
                    <th className="p-2.5 font-bold text-right">Ödenen (-)</th>
                    <th className="p-2.5 font-bold text-center w-10">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#202028]">
                  {payments.map((p) => {
                    const isAccrual = 
                      p.type === 'SALARY_ACCRUAL' || 
                      p.type === 'OVERTIME_ACCRUAL' || 
                      p.type === 'BONUS' || 
                      p.type === 'TERMINATION_SETTLEMENT';
                    
                    return (
                      <tr key={p.id} className="hover:bg-[#1A1A22] transition-colors">
                        <td className="p-2.5 font-mono text-[#C4C4CC] whitespace-nowrap">
                          {p.date}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          {getTypeBadge(p.type)}
                        </td>
                        <td className="p-2.5 text-white max-w-xs">
                          <div>{p.description || '-'}</div>
                          {p.overtimeHours && (
                            <div className="text-[10px] text-amber-300/80 font-mono mt-0.5">
                              ⏱️ {p.overtimeHours} Saat Mesai • Katsayı: {p.overtimeMultiplier || 1.5}x • Normal: {p.normalDailyHours || 8}s/gün
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-[#8E8E98] whitespace-nowrap">
                          {p.paymentMethod === 'BANK' ? 'Banka Havalesi' : 'Nakit Kasa'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-purple-400 whitespace-nowrap">
                          {isAccrual ? `+${p.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '-'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                          {!isAccrual ? `-${p.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '-'}
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditModal(p)}
                              className="p-1 text-[#8E8E98] hover:text-[#F5C877] hover:bg-amber-500/10 rounded cursor-pointer transition-colors"
                              title="Bu kaydı düzenle"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePayment(p.id)}
                              className="p-1 text-[#8E8E98] hover:text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer transition-colors"
                              title="Bu kaydı sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Alt Kapat */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#282830] text-[#FAF7F2] hover:bg-[#34343E] rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>

      {/* HAREKET DÜZENLEME MODALI */}
      {editingPayment && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#1C1C20] border border-[#383844] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#F5C877]" />
                <span>Personel Hareketini Düzenle</span>
              </h3>
              <button
                onClick={() => setEditingPayment(null)}
                className="p-1.5 text-[#8E8E98] hover:text-white rounded-lg hover:bg-[#282830] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#A0A0AA] font-bold mb-1">İşlem Türü</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-[#141416] border border-[#383844] rounded-xl text-white font-bold focus:outline-none focus:border-[#F5C877]"
                >
                  <option value="SALARY_ACCRUAL">Maaş Hakedişi (+)</option>
                  <option value="OVERTIME_ACCRUAL">Fazla Mesai Hakedişi (+)</option>
                  <option value="BONUS">Prim / Bahşiş (+)</option>
                  <option value="SALARY_PAYMENT">Maaş Ödemesi (-)</option>
                  <option value="OVERTIME_PAYMENT">Nakit Mesai Ödemesi (-)</option>
                  <option value="ADVANCE">Avans Ödemesi (-)</option>
                  <option value="DEDUCTION">Kesinti (-)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A0A0AA] font-bold mb-1">Tutar (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#141416] border border-[#383844] rounded-xl text-white font-mono font-bold focus:outline-none focus:border-[#F5C877]"
                  />
                </div>
                <div>
                  <label className="block text-[#A0A0AA] font-bold mb-1">Tarih</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#141416] border border-[#383844] rounded-xl text-white focus:outline-none focus:border-[#F5C877]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#A0A0AA] font-bold mb-1">Ödeme Kanalı</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditPaymentMethod('CASH')}
                    className={`py-2 px-3 rounded-xl border font-bold text-center transition-all cursor-pointer ${
                      editPaymentMethod === 'CASH'
                        ? 'bg-amber-500/20 border-[#F5C877] text-[#F5C877]'
                        : 'bg-[#141416] border-[#2C2C34] text-[#8E8E98]'
                    }`}
                  >
                    💵 Nakit Kasa
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPaymentMethod('BANK')}
                    className={`py-2 px-3 rounded-xl border font-bold text-center transition-all cursor-pointer ${
                      editPaymentMethod === 'BANK'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                        : 'bg-[#141416] border-[#2C2C34] text-[#8E8E98]'
                    }`}
                  >
                    🏦 Banka / Havale
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[#A0A0AA] font-bold mb-1">Açıklama</label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="İşlem açıklaması..."
                  className="w-full px-3.5 py-2.5 bg-[#141416] border border-[#383844] rounded-xl text-white focus:outline-none focus:border-[#F5C877]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#2C2C34]">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="px-4 py-2 bg-[#282830] hover:bg-[#34343E] text-[#A0A0AA] rounded-xl font-bold cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 rounded-xl font-black cursor-pointer shadow-md"
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
