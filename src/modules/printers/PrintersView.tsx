import React from 'react';
import { Printer, Flame, CheckCircle2 } from 'lucide-react';

export const PrintersView: React.FC = () => {
  const printers = [
    { id: '1', name: 'Kasa Termal Yazıcı', type: 'USB Port', target: 'Afanda 892E (USB)', role: 'Hesap Fişi / Z Raporu', status: 'ONLINE', isKitchen: false },
    { id: '2', name: 'Fırın Yazıcısı', type: 'Ethernet IP', target: '192.168.1.201:9100', role: 'Lahmacun & Pide Fişleri', status: 'ONLINE', isKitchen: true },
    { id: '3', name: 'Kebap Ocağı Yazıcısı', type: 'Ethernet IP', target: '192.168.1.202:9100', role: 'Kebap & Izgara Fişleri', status: 'ONLINE', isKitchen: true },
  ];

  const handleTestPrint = (pName: string) => {
    alert(`🖨️ [${pName}] için test fişi gönderildi! Bip sesi çalarak test kağıdı basılacaktır.`);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto select-none">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[#FAF7F2] tracking-tight">🖨️ Mutfak & Kasa Yazıcı Yönetimi</h1>
          <p className="text-xs text-[#A0A0AA] font-medium">Afanda 892E USB ve Ethernet IP yazıcılarının bağlantı durumları.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {printers.map((p) => (
          <div key={p.id} className="bg-[#1C1C20] rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                  p.isKitchen ? 'bg-orange-500 text-white' : 'bg-[#F5C877] text-[#141416] text-white'
                }`}>
                  {p.isKitchen ? <Flame className="w-5 h-5" /> : <Printer className="w-5 h-5" />}
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Aktif
                </span>
              </div>

              <h3 className="font-black text-sm text-[#FAF7F2]">{p.name}</h3>
              <p className="text-xs text-[#A0A0AA] font-medium mt-0.5">{p.role}</p>

              <div className="mt-4 p-3 bg-[#141416] rounded-2xl border border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between text-[#A0A0AA] font-bold">
                  <span>Bağlantı Türü:</span>
                  <span className="text-[#FAF7F2]">{p.type}</span>
                </div>
                <div className="flex justify-between text-[#A0A0AA] font-bold">
                  <span>Hedef / IP:</span>
                  <span className="font-mono text-[#F5C877]">{p.target}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleTestPrint(p.name)}
              className="w-full py-2.5 bg-[#141416] hover:bg-black text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Test Fişi Bas</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
