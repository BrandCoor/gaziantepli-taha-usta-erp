import React from 'react';
import { X, Receipt, User, Clock, MapPin, CreditCard, CheckCircle } from 'lucide-react';
import { CompletedOrderArchive } from '../../services/restaurantDataService';

interface OrderAuditDetailModalProps {
  order: CompletedOrderArchive;
  onClose: () => void;
}

export const OrderAuditDetailModal: React.FC<OrderAuditDetailModalProps> = ({ order, onClose }) => {
  const formatMoney = (val: number = 0) => {
    return Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  return (
    <div id="order-audit-detail-modal" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#1C1C20] border border-[#2C2C34] rounded-3xl max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Başlık */}
        <div className="p-5 border-b border-[#2C2C34] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>Adisyon Fişi #{order.orderNumber}</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                  KAPATILDI
                </span>
              </h3>
              <p className="text-xs text-[#8E8E98]">{order.tableName} • {order.sectionName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#141416] text-[#8E8E98] hover:text-white flex items-center justify-center border border-[#2C2C34] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bilgi Kartları */}
        <div className="p-5 border-b border-[#2C2C34] grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs bg-[#141416]/40">
          <div className="p-2.5 bg-[#141416] rounded-xl border border-[#2C2C34]">
            <span className="text-[10px] text-[#8E8E98] block flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#F5C877]" /> Açılış Saati
            </span>
            <span className="font-bold text-slate-200 mt-0.5 block">{order.orderTime || '-'}</span>
          </div>

          <div className="p-2.5 bg-[#141416] rounded-xl border border-[#2C2C34]">
            <span className="text-[10px] text-[#8E8E98] block flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-400" /> Kapanış Saati
            </span>
            <span className="font-bold text-slate-200 mt-0.5 block">{order.closedTime || '-'}</span>
          </div>

          <div className="p-2.5 bg-[#141416] rounded-xl border border-[#2C2C34]">
            <span className="text-[10px] text-[#8E8E98] block flex items-center gap-1">
              <User className="w-3 h-3 text-cyan-400" /> Garson
            </span>
            <span className="font-bold text-slate-200 mt-0.5 block truncate">{order.waiterName || 'Kasiyer'}</span>
          </div>

          <div className="p-2.5 bg-[#141416] rounded-xl border border-[#2C2C34]">
            <span className="text-[10px] text-[#8E8E98] block flex items-center gap-1">
              <MapPin className="w-3 h-3 text-rose-400" /> Bölge
            </span>
            <span className="font-bold text-slate-200 mt-0.5 block truncate">{order.sectionName}</span>
          </div>
        </div>

        {/* Sipariş Kalemleri */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <h4 className="text-xs font-black text-[#8E8E98] uppercase tracking-wider mb-2">Adisyon Kalemleri</h4>
            <div className="bg-[#141416] rounded-2xl border border-[#2C2C34] overflow-hidden divide-y divide-[#2C2C34]">
              {(order.items || []).map((item, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[#282830] text-[#F5C877] font-bold font-mono text-[11px] flex items-center justify-center">
                      {item.quantity}x
                    </span>
                    <span className="font-bold text-slate-200">{item.productName}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-[#F5C877]">
                      {formatMoney((item.price || 0) * (item.quantity || 1))}
                    </span>
                    <span className="text-[10px] text-[#8E8E98] block font-mono">
                      @{formatMoney(item.price || 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tahsilat / Ödeme Kayıtları */}
          <div>
            <h4 className="text-xs font-black text-[#8E8E98] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#F5C877]" />
              <span>Tahsilat & Ödeme Kayıtları</span>
            </h4>
            <div className="space-y-1.5">
              {(order.payments || []).map((p, pIdx) => (
                <div key={pIdx} className="p-3 bg-[#141416] rounded-xl border border-[#2C2C34] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-md font-bold text-[10px]">
                      {p.type}
                    </span>
                    {p.customerName && (
                      <span className="text-slate-400 text-[11px] font-medium">({p.customerName})</span>
                    )}
                    {p.time && (
                      <span className="text-[#8E8E98] text-[10px] font-mono">{p.time}</span>
                    )}
                  </div>
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    {formatMoney(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Toplam Özeti */}
          <div className="p-4 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Toplam Tutar:</span>
              <span className="font-mono font-black text-white text-base">{formatMoney(order.totalAmount)}</span>
            </div>
            {order.zReportId && (
              <div className="flex justify-between text-[#8E8E98] pt-2 border-t border-[#2C2C34] text-[11px]">
                <span>Bağlı Z Raporu:</span>
                <span className="font-mono text-[#F5C877] font-bold">Z-{order.zReportId.replace('z-', '')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Alt Kısım */}
        <div className="p-4 border-t border-[#2C2C34] flex justify-end bg-[#1C1C20]">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#282830] hover:bg-[#343440] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
};
