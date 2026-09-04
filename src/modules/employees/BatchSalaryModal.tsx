import React, { useState, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  Users, 
  AlertCircle,
  Clock,
  Check
} from 'lucide-react';
import { Employee, PendingSalaryAccrual, dataService } from '../../services/dataService';
import { notify } from '../../services/notificationService';

interface BatchSalaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onSuccess: () => void;
}

export const BatchSalaryModal: React.FC<BatchSalaryModalProps> = ({
  isOpen,
  onClose,
  employees,
  onSuccess,
}) => {
  const currentMonthName = new Date().toLocaleString('tr-TR', { month: 'long', year: 'numeric' });
  const [periodName, setPeriodName] = useState<string>(`${currentMonthName}`);
  const [accrualDate, setAccrualDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Bekleyen tahakkukları al
  const pendingAccruals = useMemo(() => {
    return dataService.getPendingSalaryAccruals();
  }, [isOpen, employees]);

  // Seçili çalışan id'leri
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);

  // Modal açıldığında tüm bekleyenleri varsayılan olarak seç
  React.useEffect(() => {
    if (isOpen) {
      setSelectedEmpIds(pendingAccruals.map(p => p.employeeId));
    }
  }, [isOpen, pendingAccruals]);

  if (!isOpen) return null;

  const targetList = pendingAccruals.filter(p => selectedEmpIds.includes(p.employeeId));

  const totalSelectedSalary = targetList.reduce((sum, item) => {
    return sum + (Number(item.salary) || 0);
  }, 0);

  const toggleSelectEmp = (empId: string) => {
    setSelectedEmpIds(prev => 
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  const handleSelectAll = () => {
    setSelectedEmpIds(pendingAccruals.map(p => p.employeeId));
  };

  const handleDeselectAll = () => {
    setSelectedEmpIds([]);
  };

  const handleExecute = () => {
    if (selectedEmpIds.length === 0) {
      notify.warning('Seçim Yapılmadı', 'Lütfen en az bir personel seçin.');
      return;
    }

    const toApprove = pendingAccruals.filter(p => selectedEmpIds.includes(p.employeeId));
    const res = dataService.approveAllSalaryAccruals(toApprove, accrualDate);
    if (res.success) {
      notify.success('Maaş Tahakkuku Başarılı', `${res.count} personelin maaş hakedişi hesaplarına işlendi.`);
      onSuccess();
      onClose();
    } else {
      notify.error('Hata', 'Maaş tahakkuku gerçekleştirilemedi.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#18181C] border border-[#2C2C34] rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-[#FAF7F2] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Maaş Hakediş Tahakkuku</h3>
              <p className="text-xs text-[#8E8E98]">
                {pendingAccruals.length > 0 
                  ? `Maaş ödeme günü gelen ${pendingAccruals.length} personelin hakedişlerini işleyin`
                  : 'Aktif çalışanların aylık maaş hakedişini tek tıkla bakiyelerine ekleyin'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-[#8E8E98] hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dönem ve Tarih */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-[#8E8E98] mb-1 block">Dönem / Bordro Adı</label>
            <input
              type="text"
              value={periodName}
              onChange={(e) => setPeriodName(e.target.value)}
              placeholder="Örn: Mayıs 2026"
              className="w-full p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-white focus:border-purple-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#8E8E98] mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-purple-400" /> Tahakkuk Tarihi
            </label>
            <input
              type="date"
              value={accrualDate}
              onChange={(e) => setAccrualDate(e.target.value)}
              className="w-full p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-white focus:border-purple-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Personel Listesi ve Seçim */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-black text-white flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-400" />
              <span>Tahakkuk Yapılacak Personeller ({selectedEmpIds.length} seçili)</span>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-purple-400 hover:underline cursor-pointer"
              >
                Tümünü Seç
              </button>
              <span className="text-[#4E4E58]">|</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-[11px] text-[#8E8E98] hover:text-white cursor-pointer"
              >
                Temizle
              </button>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto border border-[#26262E] rounded-2xl divide-y divide-[#202028] bg-[#121214]">
            {pendingAccruals.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8E8E98] space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                <div className="font-bold text-white">Maaş Günü Gelmiş Tahakkuk Bekleyen Personel Yok</div>
                <div className="text-[11px] text-[#6C6C76]">Tüm personellerin maaş günü kontrol edildi. Maaş ödeme günü henüz gelmemiş personeller için tahakkuk işlemi yapılamaz.</div>
              </div>
            ) : (
              pendingAccruals.map((item) => {
                const empId = item.employeeId;
                const name = item.employeeName;
                const salary = item.salary;
                const day = item.salaryPaymentDay;
                const isSelected = selectedEmpIds.includes(empId);

                return (
                  <div
                    key={empId}
                    onClick={() => toggleSelectEmp(empId)}
                    className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected ? 'bg-purple-500/10' : 'hover:bg-[#18181F]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected ? 'bg-purple-600 border-purple-500 text-white' : 'border-[#3C3C46]'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="text-xs font-black text-white">{name}</div>
                        <div className="text-[10px] text-[#8E8E98] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>Maaş Günü: Ayın {day}'i</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-black text-xs text-purple-400">
                        {Number(salary).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </div>
                      <div className="text-[10px] text-emerald-400 font-bold">+ Hakediş</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Özet ve Bilgilendirme */}
        <div className="p-3.5 bg-[#121214] border border-[#26262E] rounded-2xl flex items-center justify-between">
          <span className="text-xs text-[#8E8E98]">Seçilen Toplam Hakediş Yükü:</span>
          <span className="font-mono font-black text-base text-purple-400">
            {totalSelectedSalary.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
          </span>
        </div>

        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-200/90 leading-relaxed flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Onaylandığında, seçilen personellerin aylık maaşı sisteme <strong>Hakediş (Alacak)</strong> olarak işlenir ve çalışanların alacak bakiyesi anında güncellenir.
          </span>
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
            type="button"
            onClick={handleExecute}
            disabled={pendingAccruals.length === 0 || selectedEmpIds.length === 0}
            className="px-5 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:brightness-110 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-500/20 cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Tahakkuku Onayla ({totalSelectedSalary.toLocaleString('tr-TR')} ₺)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
