import React, { useState, useMemo } from 'react';
import { X, Lock, Calculator, CheckCircle2, AlertTriangle, ArrowRight, Wallet, Coins } from 'lucide-react';
import { restaurantDataService, ZReport } from '../../services/restaurantDataService';
import { notify } from '../../services/notificationService';

interface ZCloseModalProps {
  xReport: any;
  onClose: () => void;
  onSuccess: (closedZ: ZReport) => void;
}

export const ZCloseModal: React.FC<ZCloseModalProps> = ({ xReport, onClose, onSuccess }) => {
  const [openingFloat, setOpeningFloat] = useState<number>(1000);
  const [useCashCounter, setUseCashCounter] = useState<boolean>(true);
  const [manualCountedTotal, setManualCountedTotal] = useState<string>('');
  const [transferredFloat, setTransferredFloat] = useState<number>(1000);
  const [closingNote, setClosingNote] = useState<string>('');
  const [closedByName, setClosedByName] = useState<string>('Taha Usta');

  // Banknot ve madeni para adetleri
  const [denominations, setDenominations] = useState<{ [val: number]: number }>({
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    1: 0,
  });

  const formatMoney = (val: number = 0) => {
    return Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  // Banknot sayım toplamı
  const billCountTotal = useMemo(() => {
    return Object.entries(denominations).reduce((sum, [val, count]) => {
      return sum + Number(val) * (Number(count) || 0);
    }, 0);
  }, [denominations]);

  // Efektif fiili sayılan nakit
  const countedCash = useCashCounter ? billCountTotal : (parseFloat(manualCountedTotal) || 0);

  // Nakit akışı
  const cashSales = xReport?.paymentBreakdown?.['Nakit'] || 0;
  const cashExpenses = xReport?.cashExpenses || 0;
  const supplierCash = xReport?.supplierCashPayments || 0;

  // Teorik Kasa = Açılış Avansı + Nakit Satış - Nakit Gider - Toptancı Nakit
  const theoreticalCashInDrawer = openingFloat + cashSales - cashExpenses - supplierCash;

  // Kasa Farkı = Sayılan - Teorik
  const cashDifference = countedCash - theoreticalCashInDrawer;

  // Kasadan Şirkete / Bankaya Çekilecek Net Tutar
  const bankDepositAmount = Math.max(0, countedCash - transferredFloat);

  const handleDenominationChange = (val: number, count: number) => {
    setDenominations(prev => ({
      ...prev,
      [val]: Math.max(0, count)
    }));
  };

  const handleExecuteClose = (e: React.FormEvent) => {
    e.preventDefault();

    if (useCashCounter && billCountTotal === 0 && (manualCountedTotal === '' || manualCountedTotal === '0')) {
      notify.warning('Sayım Uyarısı', 'Lütfen kasadaki banknot adetlerini giriniz veya sayılan toplam tutarı belirtiniz.');
      return;
    }

    notify.confirm({
      title: 'Mali Z Raporu Kapanış Onayı',
      message: `Net Ciro: ${formatMoney(xReport?.netTotal || 0)}\nTeorik Kasa: ${formatMoney(theoreticalCashInDrawer)}\nFiili Sayılan: ${formatMoney(countedCash)}\nKasa Farkı: ${cashDifference >= 0 ? '+' : ''}${formatMoney(cashDifference)}\n\nGünü kapatıp resmi Z raporu numarasını onaylıyor musunuz?`,
      confirmText: 'Evet, Günü Kapat & Fiş Bas',
      type: cashDifference < 0 ? 'warning' : 'info',
      onConfirm: () => {
        try {
          const zReport = restaurantDataService.closeDailyZReport(closingNote, closedByName, {
            openingCashFloat: openingFloat,
            countedCash: countedCash,
            cashDifference: cashDifference,
            transferredCash: transferredFloat,
          });
          notify.success('Gün Sonu Başarıyla Kapatıldı', `Z No #${zReport.zNo} oluşturuldu. Termal kasa fişi basılmaya hazır.`);
          onSuccess(zReport);
        } catch (err) {
          console.error(err);
          notify.error('Hata', 'Z raporu kapatılırken bir hata oluştu.');
        }
      }
    });
  };

  return (
    <div id="z-close-modal" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#1C1C20] border border-[#2C2C34] rounded-3xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Başlığı */}
        <div className="p-5 border-b border-[#2C2C34] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F5C877]/10 border border-[#F5C877]/30 text-[#F5C877] flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>Resmi Z Raporu ve Kasa Nakit Mutabakatı</span>
                <span className="px-2 py-0.5 bg-[#F5C877]/20 text-[#F5C877] border border-[#F5C877]/30 rounded-full text-[10px] font-bold">
                  GÜN SONU
                </span>
              </h3>
              <p className="text-xs text-[#8E8E98]">Kasa sayımı, teorik bakiye kontrolü ve resmi mali kapanış.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#141416] text-[#8E8E98] hover:text-white flex items-center justify-center border border-[#2C2C34] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleExecuteClose} className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* 1. KASA NAKİT MATRİSİ (ÖZET KARTLAR) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#2C2C34]">
              <span className="text-[10px] font-bold text-[#8E8E98] block">Açılış Kasa Avansı</span>
              <div className="mt-1 flex items-center gap-1">
                <input 
                  type="number" 
                  value={openingFloat} 
                  onChange={(e) => setOpeningFloat(Number(e.target.value) || 0)}
                  className="w-20 bg-slate-900 border border-slate-700 rounded-lg p-1 text-white font-mono font-bold text-xs"
                />
                <span className="text-[#8E8E98]">₺</span>
              </div>
            </div>

            <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#2C2C34]">
              <span className="text-[10px] font-bold text-[#8E8E98] block">Nakit Satış Hasılatı</span>
              <span className="font-mono font-black text-emerald-400 text-sm mt-1 block">+{formatMoney(cashSales)}</span>
            </div>

            <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#2C2C34]">
              <span className="text-[10px] font-bold text-[#8E8E98] block">Nakit Gider & Toptancı</span>
              <span className="font-mono font-black text-rose-400 text-sm mt-1 block">-{formatMoney(cashExpenses + supplierCash)}</span>
            </div>

            <div className="p-3.5 bg-[#141416] rounded-2xl border-2 border-[#F5C877]/50 shadow-md">
              <span className="text-[10px] font-black text-[#F5C877] uppercase block">Teorik Kasa (Hedef)</span>
              <span className="font-mono font-black text-white text-base mt-0.5 block">{formatMoney(theoreticalCashInDrawer)}</span>
            </div>
          </div>

          {/* 2. FİİLİ NAKİT SAYIMI ARACI */}
          <div className="p-4 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-3">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-2.5">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-[#F5C877]" />
                <h4 className="text-xs font-black text-white uppercase tracking-wider">Fiili Kasa Nakit Sayımı</h4>
              </div>

              <div className="flex bg-[#1C1C20] p-1 rounded-xl border border-[#2C2C34] text-[11px]">
                <button
                  type="button"
                  onClick={() => setUseCashCounter(true)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${useCashCounter ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#8E8E98]'}`}
                >
                  Banknot Sayacı
                </button>
                <button
                  type="button"
                  onClick={() => setUseCashCounter(false)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${!useCashCounter ? 'bg-[#F5C877] text-slate-950 font-black' : 'text-[#8E8E98]'}`}
                >
                  Hızlı Tutar
                </button>
              </div>
            </div>

            {useCashCounter ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                {[200, 100, 50, 20, 10, 5, 1].map((val) => (
                  <div key={val} className="p-2.5 bg-[#1C1C20] rounded-xl border border-[#2C2C34] flex items-center justify-between">
                    <span className="font-mono font-bold text-[#F5C877]">{val} ₺</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#8E8E98] text-[10px]">x</span>
                      <input 
                        type="number"
                        min="0"
                        value={denominations[val] || ''}
                        placeholder="0"
                        onChange={(e) => handleDenominationChange(val, parseInt(e.target.value, 10) || 0)}
                        className="w-14 p-1 bg-[#141416] border border-slate-700 rounded text-center text-white font-mono font-bold text-xs focus:border-[#F5C877] outline-none"
                      />
                    </div>
                  </div>
                ))}
                
                <div className="p-2.5 bg-gradient-to-r from-emerald-950/40 to-[#1C1C20] rounded-xl border border-emerald-500/30 flex flex-col justify-center">
                  <span className="text-[10px] text-emerald-400 font-bold">Sayım Toplamı</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">{formatMoney(billCountTotal)}</span>
                </div>
              </div>
            ) : (
              <div className="pt-2">
                <label className="text-xs text-[#8E8E98] block mb-1.5 font-bold">Kasada Sayılan Toplam Nakit Tutar (TL)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Örn: 8500"
                    value={manualCountedTotal}
                    onChange={(e) => setManualCountedTotal(e.target.value)}
                    className="w-full p-3 bg-[#1C1C20] border border-[#2C2C34] rounded-xl text-white font-mono font-black text-lg focus:border-[#F5C877] outline-none pl-4 pr-10"
                  />
                  <span className="absolute right-3 top-3.5 text-[#8E8E98] font-bold">₺</span>
                </div>
              </div>
            )}
          </div>

          {/* 3. KASA MUTABAKAT VE FARK ANALİZİ */}
          <div className="p-4 rounded-2xl border bg-[#141416] space-y-3">
            <h4 className="text-xs font-black text-[#8E8E98] uppercase tracking-wider">Kasa Mutabakat Durumu</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-[#1C1C20] rounded-xl border border-[#2C2C34]">
                <span className="text-[10px] text-[#8E8E98] block">Teorik Olması Gereken</span>
                <span className="font-mono font-bold text-slate-200 text-sm mt-0.5 block">{formatMoney(theoreticalCashInDrawer)}</span>
              </div>

              <div className="p-3 bg-[#1C1C20] rounded-xl border border-[#2C2C34]">
                <span className="text-[10px] text-[#8E8E98] block">Fiili Sayılan Nakit</span>
                <span className="font-mono font-black text-emerald-400 text-sm mt-0.5 block">{formatMoney(countedCash)}</span>
              </div>

              <div className={`p-3 rounded-xl border ${
                cashDifference === 0 
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400' 
                  : cashDifference > 0 
                  ? 'bg-blue-950/30 border-blue-500/40 text-blue-400' 
                  : 'bg-rose-950/30 border-rose-500/40 text-rose-400'
              }`}>
                <span className="text-[10px] font-bold block">Kasa Farkı</span>
                <span className="font-mono font-black text-sm mt-0.5 block">
                  {cashDifference === 0 ? '0.00 ₺ (DENK)' : `${cashDifference > 0 ? '+' : ''}${formatMoney(cashDifference)}`}
                </span>
              </div>
            </div>

            {cashDifference !== 0 && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                cashDifference > 0 ? 'bg-blue-950/20 border-blue-500/30 text-blue-300' : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
              }`}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {cashDifference > 0 
                    ? `Kasada ${formatMoney(cashDifference)} tutarında KASA FAZLASI tespit edildi.` 
                    : `Kasada ${formatMoney(Math.abs(cashDifference))} tutarında KASA AÇIĞI tespit edildi. Lütfen fiş ve masaları kontrol ediniz.`}
                </span>
              </div>
            )}
          </div>

          {/* 4. ERTESİ GÜNE DEVİR & BANKA YATIRIMI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#2C2C34]">
              <label className="text-[10px] font-bold text-[#8E8E98] block mb-1">Ertesi Güne Devredecek Kasa Avansı</label>
              <div className="flex items-center gap-1.5">
                <input 
                  type="number"
                  value={transferredFloat}
                  onChange={(e) => setTransferredFloat(Number(e.target.value) || 0)}
                  className="w-full p-2 bg-[#1C1C20] border border-slate-700 rounded-lg text-white font-mono font-bold text-xs outline-none"
                />
                <span className="text-[#8E8E98] font-bold">₺</span>
              </div>
            </div>

            <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#2C2C34]">
              <span className="text-[10px] font-bold text-[#8E8E98] block">Kasadan Çekilecek / Bankaya Yatacak</span>
              <span className="font-mono font-black text-[#F5C877] text-base mt-1 block">
                {formatMoney(bankDepositAmount)}
              </span>
            </div>
          </div>

          {/* 5. KAPANIŞ NOTU VE YETKİLİ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[#8E8E98] font-bold block mb-1">Kapatan Yetkili</label>
              <input 
                type="text" 
                value={closedByName} 
                onChange={(e) => setClosedByName(e.target.value)}
                className="w-full p-2.5 bg-[#141416] border border-[#2C2C34] rounded-xl text-white font-medium outline-none focus:border-[#F5C877]"
              />
            </div>

            <div>
              <label className="text-[#8E8E98] font-bold block mb-1">Kapanış Notu / Açıklama</label>
              <input 
                type="text" 
                placeholder="Örn: Gün sonu sayımı denk, kasa devredildi."
                value={closingNote} 
                onChange={(e) => setClosingNote(e.target.value)}
                className="w-full p-2.5 bg-[#141416] border border-[#2C2C34] rounded-xl text-white font-medium outline-none focus:border-[#F5C877]"
              />
            </div>
          </div>

          {/* Onay Butonu */}
          <button
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-[#F5C877] via-amber-500 to-orange-500 hover:from-amber-600 text-slate-950 font-black text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-98"
          >
            <Lock className="w-5 h-5" />
            <span>Günü Kapat & Resmi Z Raporunu Onayla</span>
          </button>

        </form>

      </div>
    </div>
  );
};
