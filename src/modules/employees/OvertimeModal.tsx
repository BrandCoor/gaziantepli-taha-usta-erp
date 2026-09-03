import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Clock, 
  Calculator, 
  DollarSign, 
  CreditCard, 
  Banknote, 
  Sparkles, 
  Calendar, 
  User, 
  FileText,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Percent
} from 'lucide-react';
import { Employee, dataService } from '../../services/dataService';
import { notify } from '../../services/notificationService';

interface OvertimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  initialEmployeeId?: string;
  onSuccess: () => void;
}

export const OvertimeModal: React.FC<OvertimeModalProps> = ({
  isOpen,
  onClose,
  employees,
  initialEmployeeId,
  onSuccess,
}) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // 1. Normal Çalışma Saati (Düzenlenebilir!)
  const [normalDailyHours, setNormalDailyHours] = useState<number>(8);
  
  // 2. Mesai Saati
  const [overtimeHours, setOvertimeHours] = useState<number>(2);
  
  // 3. Kat Sayı (Düzenlenebilir!)
  const [multiplier, setMultiplier] = useState<number>(1.5);
  
  // 4. Manuel Tutar Seçeneği (El ile belirlenebilme)
  const [isManualAmount, setIsManualAmount] = useState<boolean>(false);
  const [manualAmount, setManualAmount] = useState<string>('');
  
  // 5. Ödeme Yöntemi: Nakit Ödeme vs Maaşa Aktarma
  const [payoutType, setPayoutType] = useState<'CASH_IMMEDIATE' | 'SALARY_ACCRUAL'>('SALARY_ACCRUAL');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK'>('CASH');
  const [recordExpense, setRecordExpense] = useState<boolean>(true);
  
  // Not / Açıklama
  const [description, setDescription] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (initialEmployeeId && employees.some(e => e.id === initialEmployeeId)) {
        setSelectedEmployeeId(initialEmployeeId);
      } else if (employees.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(employees[0].id);
      }
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, initialEmployeeId, employees]);

  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  // Saatlik Ücret Hesabı (Aylık Maaş / (Normal Çalışma Saati * 26 Gün veya 225 Saat))
  const hourlyRate = useMemo(() => {
    if (!selectedEmployee || !selectedEmployee.salary) return 0;
    const monthlyHours = (Number(normalDailyHours) || 8) * 26;
    if (monthlyHours <= 0) return 0;
    return Math.round((Number(selectedEmployee.salary) / monthlyHours) * 100) / 100;
  }, [selectedEmployee, normalDailyHours]);

  // Otomatik Formülle Hesaplanan Tutar: Saatlik Ücret * Mesai Saati * Katsayı
  const calculatedAmount = useMemo(() => {
    const hours = Number(overtimeHours) || 0;
    const mult = Number(multiplier) || 0;
    return Math.round(hourlyRate * hours * mult * 100) / 100;
  }, [hourlyRate, overtimeHours, multiplier]);

  // Nihai Mesai Ücreti
  const finalAmount = useMemo(() => {
    if (isManualAmount) {
      return Number(manualAmount) || 0;
    }
    return calculatedAmount;
  }, [isManualAmount, manualAmount, calculatedAmount]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      notify.error('Lütfen bir personel seçin.');
      return;
    }
    if (finalAmount <= 0) {
      notify.error('Mesai tutarı sıfırdan büyük olmalıdır.');
      return;
    }
    if (overtimeHours <= 0) {
      notify.error('Mesai saati sıfırdan büyük olmalıdır.');
      return;
    }

    const res = dataService.addOvertime({
      employeeId: selectedEmployeeId,
      date,
      normalDailyHours: Number(normalDailyHours) || 8,
      overtimeHours: Number(overtimeHours) || 0,
      multiplier: Number(multiplier) || 1.5,
      hourlyRate,
      amount: finalAmount,
      isManualAmount,
      payoutType,
      paymentMethod: payoutType === 'CASH_IMMEDIATE' ? paymentMethod : undefined,
      recordExpense: payoutType === 'CASH_IMMEDIATE' ? recordExpense : false,
      description: description.trim(),
    });

    if (res.success) {
      notify.success(
        payoutType === 'CASH_IMMEDIATE'
          ? `${selectedEmployee?.fullName} için ${finalAmount.toLocaleString('tr-TR')} ₺ mesai ücreti günü nakit ödendi olarak kaydedildi.`
          : `${selectedEmployee?.fullName} için ${finalAmount.toLocaleString('tr-TR')} ₺ mesai ücreti maaş hakedişine eklendi.`
      );
      onSuccess();
      onClose();
    } else {
      notify.error(res.message || 'Mesai kaydedilirken hata oluştu.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-[#18181C] border border-[#2C2C34] rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 text-[#FAF7F2]">
        {/* Başlık */}
        <div className="flex items-center justify-between border-b border-[#2C2C34] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[#F5C877] flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                Fazla Mesai Ekle & Hesapla
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                  Akıllı Bordro
                </span>
              </h2>
              <p className="text-xs text-[#8E8E98]">
                Normal çalışma saati, esnek katsayı, el ile ücret belirleme ve nakit/maaşa aktarım seçenekleri.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8E8E98] hover:text-white rounded-xl hover:bg-[#282830] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Satır: Personel & Tarih */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-bold text-[#8E8E98] flex items-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5 text-[#F5C877]" /> Personel Seçimi
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                required
                className="w-full p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.position || 'Personel'}) - {emp.salary.toLocaleString('tr-TR')} ₺
                  </option>
                ))}
              </select>
              {selectedEmployee && (
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#A0A0AA] px-1">
                  <span>Aylık Maaş: <strong className="text-emerald-400">{selectedEmployee.salary.toLocaleString('tr-TR')} ₺</strong></span>
                  <span>Saatlik: <strong className="text-amber-300">{hourlyRate.toFixed(2)} ₺/saat</strong></span>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-[#8E8E98] flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-[#F5C877]" /> Mesai Tarihi
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none"
              >
              </input>
            </div>
          </div>

          {/* 2. Satır: Normal Günlük Çalışma Saati & Mesai Süresi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3.5 bg-[#141416] rounded-2xl border border-[#26262E]">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-[#8E8E98] flex items-center gap-1">
                  Normal Günlük Çalışma (Saat)
                </label>
                <span className="text-[10px] text-amber-400 font-mono">Düzenlenebilir</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="24"
                  value={normalDailyHours}
                  onChange={(e) => setNormalDailyHours(parseFloat(e.target.value) || 8)}
                  className="w-full p-2.5 bg-[#1C1C20] border border-[#2C2C34] rounded-xl text-xs font-mono font-black text-white focus:border-[#F5C877] focus:outline-none"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[#8E8E98] font-bold">Saat/Gün</span>
              </div>
              <div className="flex gap-1.5 mt-1.5">
                {[7.5, 8, 9, 10, 11].map((h) => (
                  <button
                    type="button"
                    key={h}
                    onClick={() => setNormalDailyHours(h)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                      normalDailyHours === h ? 'bg-[#F5C877] text-black' : 'bg-[#282830] text-[#8E8E98] hover:text-white'
                    }`}
                  >
                    {h}s
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-[#8E8E98]">Yapılan Fazla Mesai (Saat)</label>
                <span className="text-[10px] text-emerald-400 font-mono">Süre</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="48"
                  value={overtimeHours}
                  onChange={(e) => setOvertimeHours(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 bg-[#1C1C20] border border-[#2C2C34] rounded-xl text-xs font-mono font-black text-amber-400 focus:border-[#F5C877] focus:outline-none"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[#8E8E98] font-bold">Saat</span>
              </div>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {[1, 2, 3, 4, 5, 8].map((h) => (
                  <button
                    type="button"
                    key={h}
                    onClick={() => setOvertimeHours(h)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                      overtimeHours === h ? 'bg-amber-400 text-black' : 'bg-[#282830] text-[#8E8E98] hover:text-white'
                    }`}
                  >
                    {h === 8 ? '8s (Tam Gün)' : `${h} Saat`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Satır: Mesai Katsayısı (Düzenlenebilir!) */}
          <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#26262E] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#8E8E98] flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-amber-400" /> Mesai Katsayısı (Çarpan Oranı)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#8E8E98]">Katsayı:</span>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="10"
                  value={multiplier}
                  onChange={(e) => setMultiplier(parseFloat(e.target.value) || 1.5)}
                  className="w-18 p-1 text-center bg-[#1C1C20] border border-[#2C2C34] rounded-lg text-xs font-mono font-bold text-amber-300 focus:border-[#F5C877] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
              {[
                { val: 1.5, label: '1.5x Standart Mesai', desc: 'Haftaiçi %50 Zamlı' },
                { val: 2.0, label: '2.0x Hafta Sonu', desc: 'Pazar Tatili %100' },
                { val: 2.5, label: '2.5x Özel Vardiya', desc: 'Gece / Yoğun Gün' },
                { val: 3.0, label: '3.0x Resmi Bayram', desc: 'Dini & Resmi Tatil' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.val}
                  onClick={() => setMultiplier(item.val)}
                  className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                    multiplier === item.val
                      ? 'bg-amber-500/20 border-amber-400/80 text-white shadow-sm shadow-amber-500/20'
                      : 'bg-[#1C1C20] border-[#2C2C34] text-[#A0A0AA] hover:border-[#3C3C48] hover:text-white'
                  }`}
                >
                  <div className="text-[11px] font-black text-amber-300">{item.label}</div>
                  <div className="text-[10px] text-[#8E8E98] leading-tight">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Satır: Mesai Ücreti Belirleme Yöntemi (Otomatik vs El İle / Manuel) */}
          <div className="p-3.5 bg-gradient-to-br from-[#1C1C22] to-[#16161A] rounded-2xl border border-[#2C2C38] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-[#F5C877]" /> Mesai Ücreti Hesaplama Yöntemi
              </span>
              <div className="flex bg-[#121214] p-1 rounded-xl border border-[#2C2C34]">
                <button
                  type="button"
                  onClick={() => setIsManualAmount(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    !isManualAmount ? 'bg-[#F5C877] text-black shadow' : 'text-[#8E8E98] hover:text-white'
                  }`}
                >
                  Otomatik Hesapla
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsManualAmount(true);
                    if (!manualAmount) setManualAmount(calculatedAmount.toString());
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isManualAmount ? 'bg-amber-400 text-black shadow' : 'text-[#8E8E98] hover:text-white'
                  }`}
                >
                  El İle / Manuel Belirle
                </button>
              </div>
            </div>

            {/* Otomatik Detayı veya Manuel Giriş */}
            {!isManualAmount ? (
              <div className="flex items-center justify-between p-3 bg-[#121214] rounded-xl border border-[#2C2C34]">
                <div className="space-y-0.5">
                  <div className="text-[11px] text-[#8E8E98]">
                    Hesaplama: <strong>{hourlyRate.toFixed(2)} ₺/s</strong> × <strong>{overtimeHours} Saat</strong> × <strong>{multiplier}x</strong>
                  </div>
                  <div className="text-[10px] text-[#6E6E78]">
                    (Normal {normalDailyHours} saatlik güne göre belirlenen standart tarife)
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[#8E8E98]">Otomatik Tutar</div>
                  <div className="text-lg font-mono font-black text-[#F5C877]">
                    {calculatedAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#121214] rounded-xl border border-amber-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-300">
                    Manuel Mesai Ücreti Belirleyin (₺)
                  </label>
                  <span className="text-[10px] text-[#8E8E98]">
                    Önerilen Tutar: {calculatedAmount.toFixed(2)} ₺
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="Örn: 750.00"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    className="w-full p-2.5 bg-[#1C1C20] border border-amber-500/60 rounded-xl text-base font-mono font-black text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <span className="absolute right-3 top-2.5 font-bold text-amber-400">₺</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[250, 500, 750, 1000, 1500, 2000].map((quickAmt) => (
                    <button
                      type="button"
                      key={quickAmt}
                      onClick={() => setManualAmount(quickAmt.toString())}
                      className="px-2.5 py-1 bg-[#1C1C20] hover:bg-[#282830] text-[#FAF7F2] rounded-lg text-xs font-mono font-bold border border-[#2C2C34] cursor-pointer"
                    >
                      {quickAmt} ₺
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setManualAmount(calculatedAmount.toString())}
                    className="px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-xs font-mono font-bold border border-amber-500/30 cursor-pointer"
                  >
                    Formül Tutarını Al ({calculatedAmount.toFixed(0)} ₺)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 5. Satır: Mesai Ücreti Ödeme Şekli (Nakit vs Maaşa Aktarma) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#8E8E98]">Mesai Ücreti Nasıl Ödenecek?</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Maaşa Aktar */}
              <div
                onClick={() => setPayoutType('SALARY_ACCRUAL')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  payoutType === 'SALARY_ACCRUAL'
                    ? 'bg-amber-500/10 border-amber-400 text-white shadow-lg shadow-amber-500/10'
                    : 'bg-[#141416] border-[#2C2C34] text-[#8E8E98] hover:border-[#3C3C48]'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-[#F5C877] flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-black text-white">Maaşa / Hakedişe Ekle</div>
                </div>
                <p className="text-[11px] text-[#A0A0AA] leading-relaxed">
                  Mesai ücreti personelin hesap bakiyesine eklenir. Ay sonu maaş günü toplu olarak ödenir.
                </p>
                <div className="mt-2 text-[11px] font-bold text-amber-300 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Personele Borç +{finalAmount.toLocaleString('tr-TR')} ₺ Artar
                </div>
              </div>

              {/* Mesai Günü Nakit Öde */}
              <div
                onClick={() => setPayoutType('CASH_IMMEDIATE')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  payoutType === 'CASH_IMMEDIATE'
                    ? 'bg-emerald-500/10 border-emerald-400 text-white shadow-lg shadow-emerald-500/10'
                    : 'bg-[#141416] border-[#2C2C34] text-[#8E8E98] hover:border-[#3C3C48]'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Banknote className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-black text-white">Mesai Günü Nakit / Elden Ödendi</div>
                </div>
                <p className="text-[11px] text-[#A0A0AA] leading-relaxed">
                  Mesai ücreti mesai günü personele elden/nakit ödendi. Maaş bakiyesini etkilemez (0 ₺ net).
                </p>
                <div className="mt-2 text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Anında Ödendi Olarak Kapatılır
                </div>
              </div>
            </div>

            {/* Eğer Gününde Nakit Ödendiyse Ek Seçenekler */}
            {payoutType === 'CASH_IMMEDIATE' && (
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300">Ödeme Kanalı</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CASH')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        paymentMethod === 'CASH' ? 'bg-emerald-500 text-black' : 'bg-[#1C1C20] text-[#A0A0AA]'
                      }`}
                    >
                      Nakit Kasa
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('BANK')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        paymentMethod === 'BANK' ? 'bg-emerald-500 text-black' : 'bg-[#1C1C20] text-[#A0A0AA]'
                      }`}
                    >
                      Banka / Havale
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-[#C4C4CC] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recordExpense}
                    onChange={(e) => setRecordExpense(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-[#1C1C20] border-[#2C2C34]"
                  />
                  <span>Restoran İşletme Giderlerine (Kasa Çıkışı) otomatik kaydedilsin</span>
                </label>
              </div>
            )}
          </div>

          {/* 6. Satır: Açıklama */}
          <div>
            <label className="text-xs font-bold text-[#8E8E98] mb-1 block">Açıklama / Mesai Notu (İsteğe Bağlı)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Örn: Hafta sonu salon yoğunluğu, davet hazırlığı, gece kapanış"
              className="w-full p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-white focus:border-[#F5C877] focus:outline-none"
            />
          </div>

          {/* Alt Özet & Kaydet Butonu */}
          <div className="pt-4 border-t border-[#2C2C34] flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] text-[#8E8E98]">Kaydedilecek Toplam Tutar:</div>
              <div className="text-xl font-mono font-black text-amber-400">
                {finalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] hover:brightness-110 text-[#141416] rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mesaiyi Kaydet</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
