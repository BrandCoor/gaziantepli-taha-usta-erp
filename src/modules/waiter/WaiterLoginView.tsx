import React, { useState } from 'react';
import { Lock, Smartphone, ShieldAlert, ArrowRight, Delete, Sparkles, CheckCircle2, QrCode } from 'lucide-react';
import { deviceService } from '../../services/deviceService';

interface WaiterLoginViewProps {
  onLoginSuccess: (user: any) => void;
  onOpenPairingScreen?: () => void;
  onBackToKasa?: () => void;
}

export const WaiterLoginView: React.FC<WaiterLoginViewProps> = ({ onLoginSuccess, onOpenPairingScreen, onBackToKasa }) => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDeviceLocked, setIsDeviceLocked] = useState(false);

  const deviceUuid = deviceService.getOrCreateDeviceUuid();

  const handleDigitPress = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setErrorMessage('');
      setIsDeviceLocked(false);

      if (newPin.length === 4) {
        submitLogin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMessage('');
    setIsDeviceLocked(false);
  };

  const handleClear = () => {
    setPin('');
    setErrorMessage('');
    setIsDeviceLocked(false);
  };

  const submitLogin = async (pinToSubmit: string) => {
    setLoading(true);
    setErrorMessage('');
    setIsDeviceLocked(false);

    try {
      const res = await deviceService.waiterLogin(pinToSubmit);

      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        if (res.error_code === 'DEVICE_NOT_PAIRED') {
          setIsDeviceLocked(true);
          setErrorMessage(res.error || 'Bu cihaz bu hesapla eşleştirilmemiştir. Lütfen kasanızdan QR kod okutarak cihazınızı yetkilendirin.');
        } else {
          setErrorMessage(res.error || 'Hatalı PIN kodu. Lütfen tekrar deneyin.');
        }
        setPin('');
      }
    } catch (e: any) {
      setErrorMessage('Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#121214] text-white flex flex-col items-center justify-center p-4 select-none font-sans">
      <div className="w-full max-w-sm bg-[#18181C] border border-[#2C2C34] rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Üst Logo ve Başlık */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-2.5">
            <Smartphone className="w-7 h-7 text-[#F5C877]" />
          </div>
          <h1 className="text-lg font-black tracking-tight text-white">Gaziantepli Taha Usta</h1>
          <p className="text-xs text-[#8E8E98] mt-0.5">Garson Mobil Sipariş Terminali</p>
        </div>

        {/* PIN Gösterge Noktaları */}
        <div className="flex justify-center items-center gap-4 py-2">
          {[0, 1, 2, 3].map(idx => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                idx < pin.length
                  ? 'bg-[#F5C877] border-[#F5C877] scale-110 shadow-lg shadow-amber-500/30'
                  : 'bg-[#24242C] border-[#383844]'
              }`}
            />
          ))}
        </div>

        {/* Hata ve Sert Cihaz Kilidi Mesajı */}
        {errorMessage && (
          <div
            className={`p-3.5 rounded-2xl border text-xs leading-relaxed animate-fadeIn ${
              isDeviceLocked
                ? 'bg-red-500/15 border-red-500/40 text-red-200'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
            }`}
          >
            <div className="flex items-start gap-2">
              <ShieldAlert className={`w-4 h-4 shrink-0 mt-0.5 ${isDeviceLocked ? 'text-red-400' : 'text-amber-400'}`} />
              <div className="space-y-1">
                <div className="font-bold text-white">
                  {isDeviceLocked ? 'Cihaz Yetki Kilidi (Eşleşme Bulunamadı)' : 'Giriş Başarısız'}
                </div>
                <div className="text-[11px] text-[#E0E0E6]">{errorMessage}</div>
              </div>
            </div>
          </div>
        )}

        {/* Numpad (Sayısal Tuş Takımı) */}
        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button
              key={d}
              onClick={() => handleDigitPress(d)}
              disabled={loading}
              className="h-14 rounded-2xl bg-[#202026] hover:bg-[#2C2C36] active:scale-95 border border-[#30303C] text-xl font-black text-white cursor-pointer transition-all flex items-center justify-center shadow-sm"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleClear}
            disabled={loading}
            className="h-14 rounded-2xl bg-[#202026] hover:bg-slate-800 active:scale-95 border border-[#30303C] text-xs font-bold text-[#A0A0AA] cursor-pointer transition-all flex items-center justify-center"
          >
            Temizle
          </button>
          <button
            onClick={() => handleDigitPress('0')}
            disabled={loading}
            className="h-14 rounded-2xl bg-[#202026] hover:bg-[#2C2C36] active:scale-95 border border-[#30303C] text-xl font-black text-white cursor-pointer transition-all flex items-center justify-center shadow-sm"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={loading}
            className="h-14 rounded-2xl bg-[#202026] hover:bg-slate-800 active:scale-95 border border-[#30303C] text-white cursor-pointer transition-all flex items-center justify-center"
          >
            <Delete className="w-5 h-5 text-amber-400" />
          </button>
        </div>

        {/* Alt Cihaz Parmak İzi & QR Eşleme Yönlendirmesi */}
        <div className="pt-2 border-t border-[#26262E] space-y-2">
          {onOpenPairingScreen && (
            <button
              onClick={onOpenPairingScreen}
              className="w-full py-2.5 bg-[#202026] hover:bg-[#282832] border border-[#343440] text-amber-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR Kod ile Cihazı Eşleştir</span>
            </button>
          )}

          {onBackToKasa && (
            <button
              onClick={onBackToKasa}
              className="w-full py-2 bg-transparent hover:bg-[#202026] text-[#A0A0AA] hover:text-white font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>← Kasa Paneline Dön</span>
            </button>
          )}

          <div className="text-[10px] text-[#70707A] text-center font-mono truncate">
            Cihaz UUID: {deviceUuid.substring(0, 18)}...
          </div>
        </div>
      </div>
    </div>
  );
};
