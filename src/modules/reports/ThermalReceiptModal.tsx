import React from 'react';
import { Printer, X } from 'lucide-react';
import { ZReport } from '../../services/restaurantDataService';

interface ThermalReceiptModalProps {
  receiptData: {
    type: 'Z_REPORT' | 'X_REPORT' | 'FILTERED';
    title: string;
    zNo?: number;
    openedAt?: string;
    closedAt?: string;
    closedBy?: string;
    grossTotal: number;
    discountTotal: number;
    giftTotal: number;
    cancelTotal: number;
    netTotal: number;
    totalOrders: number;
    paymentBreakdown: { [key: string]: number };
    totalExpenses?: number;
    cashExpenses?: number;
    supplierPaymentsTotal?: number;
    supplierCashPayments?: number;
    netCashInRegister?: number;
    openingCashFloat?: number;
    countedCash?: number;
    cashDifference?: number;
    transferredCash?: number;
    vatBreakdown?: Array<{ rate: number; baseAmount: number; vatAmount: number; total: number }>;
    productSales?: { [key: string]: { quantity: number; total: number } };
    note?: string;
  };
  onClose: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({ receiptData, onClose }) => {
  const formatMoney = (val: number = 0) => {
    return Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  const handlePrint = () => {
    window.print();
  };

  const vatBase = (receiptData.netTotal || 0) / 1.10;
  const vatAmount = (receiptData.netTotal || 0) - vatBase;

  // Top 5 products
  const topProducts = Object.entries(receiptData.productSales || {})
    .sort((a, b) => (b[1].total || 0) - (a[1].total || 0))
    .slice(0, 5);

  return (
    <div id="thermal-receipt-modal" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1C1C20] border border-[#2C2C34] rounded-3xl max-w-md w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Başlık */}
        <div className="p-4 border-b border-[#2C2C34] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#F5C877]/10 border border-[#F5C877]/30 text-[#F5C877] flex items-center justify-center font-bold">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">80mm Termal Kasa Fişi Önizleme</h3>
              <p className="text-[11px] text-[#8E8E98]">Afanda 892E ESC/POS Termal Çıktı Formatı</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#141416] text-[#8E8E98] hover:text-white flex items-center justify-center border border-[#2C2C34] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fiş Kağıt Görünümü */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#141416]/50">
          <div 
            id="printable-thermal-receipt" 
            className="bg-white text-black p-5 rounded-lg shadow-inner font-mono text-[11px] leading-relaxed mx-auto max-w-[340px] border border-slate-300"
            style={{ width: '80mm', maxWidth: '100%' }}
          >
            {/* Üst Bilgi */}
            <div className="text-center pb-2 border-b border-dashed border-slate-400">
              <div className="font-bold text-sm tracking-wider">GAZİANTEPLİ TAHA USTA</div>
              <div className="text-[10px]">Kebap & Lahmacun Salonu</div>
              <div className="text-[9px] text-slate-700">Şehitkamil / Gaziantep</div>
              <div className="text-[9px] text-slate-700">Tel: 0 (342) 555 00 27</div>
              <div className="text-[9px] text-slate-700">V.D: Şehitkamil • V.No: 1234567890</div>
            </div>

            {/* Belge Türü & Z No */}
            <div className="py-2 border-b border-dashed border-slate-400 text-center">
              <div className="font-black text-xs uppercase tracking-wide">
                {receiptData.type === 'Z_REPORT' 
                  ? `MALİ GÜN SONU (Z RAPORU)` 
                  : receiptData.type === 'X_REPORT' 
                  ? `GÜN İÇİ ARA RAPOR (X RAPORU)` 
                  : `ÖZEL DÖNEM MALİ RAPORU`}
              </div>
              {receiptData.zNo && (
                <div className="font-bold text-sm text-slate-900 mt-0.5">
                  Z RAPOR NO: #{String(receiptData.zNo).padStart(4, '0')}
                </div>
              )}
            </div>

            {/* Tarih & Kasiyer */}
            <div className="py-2 border-b border-dashed border-slate-400 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>Açılış Tarihi:</span>
                <span>{receiptData.openedAt || '09:00'}</span>
              </div>
              <div className="flex justify-between">
                <span>Kapanış / Rapor:</span>
                <span>{receiptData.closedAt || new Date().toLocaleString('tr-TR')}</span>
              </div>
              <div className="flex justify-between">
                <span>Yetkili / Kasiyer:</span>
                <span className="font-bold">{receiptData.closedBy || 'Taha Usta'}</span>
              </div>
              <div className="flex justify-between">
                <span>Kapatılan Adisyon:</span>
                <span className="font-bold">{receiptData.totalOrders} Adet</span>
              </div>
            </div>

            {/* Mali Satış Dökümü */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>BRÜT SATIŞ HASILATI:</span>
                <span className="font-bold">{formatMoney(receiptData.grossTotal)}</span>
              </div>
              {receiptData.discountTotal > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>- İndirim / İskonto:</span>
                  <span>-{formatMoney(receiptData.discountTotal)}</span>
                </div>
              )}
              {receiptData.giftTotal > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>- İkram Toplamı:</span>
                  <span>-{formatMoney(receiptData.giftTotal)}</span>
                </div>
              )}
              {receiptData.cancelTotal > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>- İptal / Zayi:</span>
                  <span>-{formatMoney(receiptData.cancelTotal)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-300">
                <span>NET SATIŞ CİROSU:</span>
                <span>{formatMoney(receiptData.netTotal)}</span>
              </div>
            </div>

            {/* KDV Detayı */}
            <div className="py-2 border-b border-dashed border-slate-400 text-[10px] space-y-0.5">
              <div className="font-bold text-[9px] uppercase tracking-wider text-slate-600 mb-1">KDV Dağılımı</div>
              <div className="flex justify-between">
                <span>Gıda (%10) Matrah:</span>
                <span>{formatMoney(vatBase)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Hesaplanan KDV (%10):</span>
                <span>{formatMoney(vatAmount)}</span>
              </div>
            </div>

            {/* Ödeme Türleri */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-1">
              <div className="font-bold text-[9px] uppercase tracking-wider text-slate-600 mb-1">Ödeme Türleri Dağılımı</div>
              {Object.entries(receiptData.paymentBreakdown || {}).map(([type, amount]) => (
                <div key={type} className="flex justify-between">
                  <span>{type}:</span>
                  <span className="font-bold">{formatMoney(amount)}</span>
                </div>
              ))}
            </div>

            {/* Kasa Nakit Akışı ve Mutabakatı */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-1">
              <div className="font-bold text-[9px] uppercase tracking-wider text-slate-600 mb-1">Kasa Nakit Mutabakatı</div>
              {receiptData.openingCashFloat !== undefined && (
                <div className="flex justify-between text-[10px]">
                  <span>Açılış Kasa Avansı:</span>
                  <span>{formatMoney(receiptData.openingCashFloat)}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px]">
                <span>Nakit Satış Tahsilatı (+):</span>
                <span>{formatMoney(receiptData.paymentBreakdown?.['Nakit'] || 0)}</span>
              </div>
              {receiptData.cashExpenses !== undefined && receiptData.cashExpenses > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span>Kasadan Gider Çıkışı (-):</span>
                  <span>-{formatMoney(receiptData.cashExpenses)}</span>
                </div>
              )}
              {receiptData.supplierCashPayments !== undefined && receiptData.supplierCashPayments > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span>Toptancı Nakit Ödeme (-):</span>
                  <span>-{formatMoney(receiptData.supplierCashPayments)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-1 border-t border-slate-200">
                <span>Teorik Kasa Mevcudu:</span>
                <span>{formatMoney(receiptData.netCashInRegister || 0)}</span>
              </div>
              {receiptData.countedCash !== undefined && (
                <div className="flex justify-between">
                  <span>Fiili Sayılan Nakit:</span>
                  <span className="font-bold">{formatMoney(receiptData.countedCash)}</span>
                </div>
              )}
              {receiptData.cashDifference !== undefined && (
                <div className="flex justify-between font-bold text-[10px]">
                  <span>Kasa Farkı:</span>
                  <span className={receiptData.cashDifference === 0 ? 'text-green-700' : receiptData.cashDifference > 0 ? 'text-blue-700' : 'text-red-700'}>
                    {receiptData.cashDifference === 0 ? '0.00 ₺ (DENK)' : `${receiptData.cashDifference > 0 ? '+' : ''}${formatMoney(receiptData.cashDifference)}`}
                  </span>
                </div>
              )}
              {receiptData.transferredCash !== undefined && (
                <div className="flex justify-between text-[10px] text-slate-700">
                  <span>Ertesi Güne Devir Avans:</span>
                  <span>{formatMoney(receiptData.transferredCash)}</span>
                </div>
              )}
            </div>

            {/* En Çok Satan Ürünler */}
            {topProducts.length > 0 && (
              <div className="py-2 border-b border-dashed border-slate-400 space-y-1">
                <div className="font-bold text-[9px] uppercase tracking-wider text-slate-600 mb-1">En Çok Satan İlk 5 Ürün</div>
                {topProducts.map(([pName, stat], idx) => (
                  <div key={pName} className="flex justify-between text-[10px]">
                    <span className="truncate max-w-[180px]">{idx + 1}. {pName}</span>
                    <span>{stat.quantity} Adet • {formatMoney(stat.total)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Not */}
            {receiptData.note && (
              <div className="py-2 border-b border-dashed border-slate-400 text-[10px]">
                <div className="text-slate-500 font-bold">Kapanış Notu:</div>
                <div className="italic text-slate-800">{receiptData.note}</div>
              </div>
            )}

            {/* Alt Bilgi */}
            <div className="text-center pt-3 text-[9px] text-slate-500">
              <div>AFANDA 892E TERMAL YAZICI SİSTEMİ</div>
              <div>Bilgi amaçlı resmi mali gün sonu çıktısıdır.</div>
              <div className="font-mono mt-1">*** MALİ MÜHÜR VE DENETİM KAYDI ***</div>
            </div>
          </div>
        </div>

        {/* Modal Alt Butonlar */}
        <div className="p-4 border-t border-[#2C2C34] flex items-center justify-end gap-3 bg-[#1C1C20]">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#2C2C34] text-xs font-bold text-[#8E8E98] hover:text-white hover:bg-[#282830] transition-colors cursor-pointer"
          >
            Kapat
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-[#F5C877] hover:bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Yazıcıya Gönder (Baskı Al)</span>
          </button>
        </div>

      </div>
    </div>
  );
};
