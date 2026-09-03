import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Smartphone, Plus } from 'lucide-react';

export const WaitersView: React.FC = () => {
  const [selectedWaiter, setSelectedWaiter] = useState<{ name: string; pin: string; token: string }>({
    name: 'Ahmet Yılmaz (Garson)',
    pin: '1111',
    token: 'WAITER-AHMET-TOKEN-8912'
  });

  const waiters = [
    { id: '1', name: 'Ahmet Yılmaz', role: 'Garson', pin: '1111', token: 'WAITER-AHMET-TOKEN-8912', status: 'ONLINE', device: 'iPhone 13' },
    { id: '2', name: 'Mehmet Demir', role: 'Garson', pin: '2222', token: 'WAITER-MEHMET-TOKEN-4421', status: 'OFFLINE', device: 'Samsung S22' },
    { id: '3', name: 'Taha Usta', role: 'Yönetici / Kasa', pin: '1234', token: 'ADMIN-SECRET-QR-2026', status: 'ONLINE', device: 'Ana Kasa Terminali' },
  ];

  const qrConnectUrl = `http://192.168.1.50:4545/garson?token=${selectedWaiter.token}`;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto select-none">
      <div>
        <h1 className="text-xl font-black text-[#FAF7F2] tracking-tight">📱 Garson Telefon & QR Eşleştirme</h1>
        <p className="text-xs text-[#A0A0AA] font-medium">Garsonların telefonlarından masalara sipariş girebilmesi için QR kod tanımlayın.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-[#1C1C20] rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-[#FAF7F2]">Kayıtlı Garsonlar & Cihazlar</h2>
            <button className="px-4 py-2 bg-[#F5C877] text-[#141416] hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer">
              <Plus className="w-4 h-4" />
              <span>Yeni Garson Ekle</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {waiters.map((w) => (
              <div
                key={w.id}
                onClick={() => setSelectedWaiter({ name: w.name, pin: w.pin, token: w.token })}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                  selectedWaiter.token === w.token ? 'bg-amber-50/50 border-amber-400 shadow-md' : 'bg-[#141416] border-slate-200 hover:bg-[#141416]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F5C877] text-[#141416] font-black flex items-center justify-center font-black">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-black text-xs text-[#FAF7F2]">{w.name}</div>
                    <div className="text-[11px] text-[#A0A0AA] font-medium">{w.device} • PIN: <strong className="text-slate-800">{w.pin}</strong></div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                    w.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-[#A0A0AA]'
                  }`}>
                    {w.status === 'ONLINE' ? '● Bağlı' : '○ Çevrimdışı'}
                  </span>
                  <span className="text-xs font-bold text-amber-600">QR Göster →</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white rounded-3xl p-6 border border-[#2C2C34] shadow-2xl flex flex-col items-center justify-between text-center">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-[#F5C877] text-[#141416] font-black flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-white">{selectedWaiter.name}</h3>
            <p className="text-[11px] text-[#C4C4CC] mt-1">Telefon kamerasından bu QR kodu okutun</p>
          </div>

          <div className="p-4 bg-[#1C1C20] rounded-3xl shadow-xl my-4">
            <QRCodeSVG value={qrConnectUrl} size={180} level="H" />
          </div>

          <div className="w-full space-y-2">
            <div className="p-2.5 bg-slate-800/80 rounded-xl text-[11px] text-amber-300 font-mono">
              Giriş PIN Kodu: <strong>{selectedWaiter.pin}</strong>
            </div>
            <div className="text-[10px] text-[#C4C4CC]">
              Uygulama yüklemeden tarayıcı üzerinden anında açılır.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
