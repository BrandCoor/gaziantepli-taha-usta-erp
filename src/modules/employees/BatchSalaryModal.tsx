import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  Users, 
  AlertCircle 
} from 'lucide-react';
import { Employee, dataService } from '../../services/dataService';
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

  if (!isOpen) return null;

  const activeEmployees = employees.filter(e => e.isActive !== false);
  const totalPayroll = activeEmployees.reduce((sum, e) => sum + (Number(e.salary) || 0), 0);

  const handleExecute = () => {
    const res = dataService.batchSalaryAccrual(periodName, accrualDate);
    if (res.success) {
      notify.success(`${res.count} personelin ${periodName} maaş hakedişi başarıyla tahakkuk ettirildi.`);
      onSuccess();
      onClose();
    } else {
      notify.error('Maaş tahakkuku gerçekleştirilemedi.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#18181C] border border-[#2C2C34] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-[#FAF7F2]">
        <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Toplu Maaş Hakediş Tahakkuku</h3>
              <p className="text-xs text-[#8E8E98]">Ay başında veya sonunda personelin maaşını tek tıkla hakedişe ekleyin</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-[#8E8E98] hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3.5 bg-[#121214] border border-[#26262E] rounded-2xl space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#8E8E98]">Tahakkuk Yapılacak Personel:</span>
            <span className="font-bold text-white flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-purple-400" /> {activeEmployees.length} Kişi
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#8E8E98]">Toplam Hakediş Yükü:</span>
            <span className="font-mono font-black text-purple-400">
              {totalPayroll.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </span>
          </div>
        </div>

        <div className="space-y-3">
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

        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-200/90 leading-relaxed flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Bu işlem, aktif tüm çalışanların aylık maaş tutarını hesaplarına <strong>Hakediş (Alacak)</strong> olarak işler ve hakediş bakiyelerini artırır.
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
            className="px-5 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:brightness-110 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-500/20 cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Tahakkuku Onayla ({totalPayroll.toLocaleString('tr-TR')} ₺)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
