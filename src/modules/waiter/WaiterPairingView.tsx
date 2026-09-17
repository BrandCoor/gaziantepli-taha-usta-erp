import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, AlertTriangle, Smartphone, ArrowRight, RefreshCw, CheckCircle2, Lock } from 'lucide-react';
import { deviceService, PairResponse } from '../../services/deviceService';
import { parseAppRoute } from '../../utils/routeUtils';
import { BrowserQRCodeReader } from '@zxing/browser';

interface WaiterPairingViewProps {
  onPairedSuccess: (user: any) => void;
  onGoToLogin?: () => void;
  onCancel?: () => void;
  initialToken?: string;
  initialUserId?: string;
}

export const WaiterPairingView: React.FC<WaiterPairingViewProps> = ({ 
  onPairedSuccess, 
  onGoToLogin, 
  onCancel,
  initialToken,
  initialUserId
}) => {
  const [status, setStatus] = useState<'IDLE' | 'PAIRING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState('');
  const [pairedInfo, setPairedInfo] = useState<PairResponse | null>(null);
  const [scanError, setScanError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  const deviceUuid = deviceService.getOrCreateDeviceUuid();

  useEffect(() => {
    const routeInfo = parseAppRoute();
    const token = initialToken || routeInfo.token;
    const userId = initialUserId || routeInfo.userId;
    const pin = routeInfo.params['pin'];
    const name = routeInfo.params['name'];

    if (token && userId) {
      executePairing(userId, token, pin, name);
    }
  }, [initialToken, initialUserId]);

  useEffect(() => {
    const routeInfo = parseAppRoute();
    if (routeInfo.token && routeInfo.userId || initialToken && initialUserId || status !== 'IDLE' || !videoRef.current) {
      return;
    }

    const reader = new BrowserQRCodeReader();
    let controls: { stop: () => void } | undefined;
    let handled = false;

    reader.decodeFromVideoDevice(undefined, videoRef.current, (result, error) => {
      if (!result || handled) return;
      handled = true;
      const scannedValue = result.getText();
      try {
        let token = '';
        let userId = '';
        let pin: string | undefined = undefined;
        let name: string | undefined = undefined;

        // 1. JSON kontrolü
        try {
          const parsed = JSON.parse(scannedValue);
          token = parsed.token || parsed.pairingToken || parsed.pairing_token || '';
          userId = parsed.userId || parsed.user_id || parsed.id || parsed.waiterId || '';
          pin = parsed.pin || undefined;
          name = parsed.name || parsed.ad || undefined;
        } catch {}

        // 2. URL veya Query String kontrolü
        if (!token || !userId) {
          try {
            const scannedUrl = new URL(scannedValue, window.location.origin);
            const queryParams = new URLSearchParams(scannedUrl.search);
            const hashQuery = scannedUrl.hash.includes('?') ? scannedUrl.hash.split('?')[1] : '';
            const hashParams = new URLSearchParams(hashQuery);

            token = queryParams.get('token') || hashParams.get('token') || '';
            userId = queryParams.get('userId') || hashParams.get('userId') || queryParams.get('id') || hashParams.get('id') || '';
            pin = queryParams.get('pin') || hashParams.get('pin') || undefined;
            name = queryParams.get('name') || hashParams.get('name') || undefined;
          } catch {}
        }

        if (!token || !userId) throw new Error('QR token bilgisi eksik');
        controls?.stop();
        executePairing(userId, token, pin, name);
      } catch {
        handled = false;
        setScanError('Bu QR kod geçerli bir garson eşleştirme kodu değil.');
      }
    }).then((nextControls) => {
      controls = nextControls;
    }).catch(() => {
      setScanError('Kamera açılamadı. Tarayıcı kamera iznini etkinleştirin ve HTTPS bağlantısı kullanın.');
    });

    return () => controls?.stop();
  }, [initialToken, initialUserId, status]);

  const executePairing = async (userId: string, token: string, pin?: string, name?: string) => {
    setStatus('PAIRING');
    setErrorMessage('');

    try {
      const res = await deviceService.pairDevice(userId, token, pin, name);
      if (res.success) {
        setStatus('SUCCESS');
        setPairedInfo(res);
      } else {
        setStatus('ERROR');
        setErrorMessage(res.error || 'Cihaz eşleştirilemedi. QR kodunun 5 dakikalık süresi dolmuş olabilir.');
      }
    } catch (e: any) {
      setStatus('ERROR');
      setErrorMessage('Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#121214] text-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans select-none">
      <div className="w-full max-w-sm bg-[#18181C] border border-[#2C2C34] rounded-3xl p-6 shadow-2xl text-center space-y-6">
        {/* Üst Logo ve Başlık */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
            <Smartphone className="w-8 h-8 text-[#F5C877]" />
          </div>
          <h1 className="text-lg font-black tracking-tight text-white">Gaziantepli Taha Usta</h1>
          <p className="text-xs text-[#90909A] mt-0.5">Garson Terminali Cihaz Yetkilendirme</p>
        </div>

        {/* Durum Göstergesi */}
        {status === 'PAIRING' && (
          <div className="py-8 space-y-3">
            <RefreshCw className="w-10 h-10 text-[#F5C877] animate-spin mx-auto" />
            <div className="text-sm font-bold text-white">Cihazınız Mühürleniyor...</div>
            <p className="text-xs text-[#80808A]">Kasa ile güvenli parmak izi eşleşmesi yapılıyor.</p>
          </div>
        )}

        {status === 'IDLE' && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-[#383844] bg-black aspect-square">
              <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
            </div>
            <div className="text-sm font-bold text-white">Kasa QR kodunu okutun</div>
            <p className="text-xs text-[#80808A]">Kasa ekranındaki güncel eşleştirme kodunu kameraya gösterin.</p>
            {scanError && <p className="text-xs text-red-300">{scanError}</p>}
          </div>
        )}

        {status === 'SUCCESS' && (
          <div className="py-4 space-y-4 animate-fadeIn">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-base font-black text-emerald-400">Cihazınız Başarıyla Eşleştirildi!</h2>
              <p className="text-xs text-[#A0A0AA] mt-1">
                Bu telefon <strong>{pairedInfo?.user?.ad || 'Garson'}</strong> hesabına mühürlendi.
              </p>
            </div>

            <div className="p-3 bg-[#141416] rounded-2xl border border-[#2C2C34] text-left text-[11px] space-y-1.5 font-mono text-[#90909A]">
              <div className="flex justify-between">
                <span>Cihaz Kimliği:</span>
                <span className="text-white font-bold truncate max-w-[170px]">{deviceUuid}</span>
              </div>
              <div className="flex justify-between">
                <span>Eşleşme Durumu:</span>
                <span className="text-emerald-400 font-bold">✓ KİLİTLENDİ (MÜHÜRLÜ)</span>
              </div>
            </div>

            <button
              onClick={onGoToLogin}
              className="w-full py-3.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] hover:brightness-110 text-slate-950 font-black text-sm rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 transition-all"
            >
              <span>PIN ile Giriş Yap</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {status === 'ERROR' && (
          <div className="py-4 space-y-4 animate-fadeIn">
            <div className="w-16 h-16 bg-red-500/20 border border-red-500/40 rounded-full flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-base font-black text-red-400">Cihaz Eşleştirilemedi</h2>
              <p className="text-xs text-[#A0A0AA] mt-1.5 leading-relaxed">{errorMessage}</p>
            </div>

            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-left text-xs space-y-1 text-amber-200">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <Lock className="w-3.5 h-3.5" />
                <span>Ne Yapmalısınız?</span>
              </div>
              <p className="text-[11px] text-amber-200/80">
                Kasa bilgisayarından <strong>Personeller & Garsonlar</strong> bölümünü açıp adınızın yanındaki <strong>"Cihazı QR ile Eşle"</strong> butonuna basın ve oluşan güncel QR kodu telefonunuza tekrar okutun.
              </p>
            </div>

            <button
              onClick={onGoToLogin || onCancel}
              className="w-full py-3 bg-[#26262E] hover:bg-[#30303A] text-white font-bold text-xs rounded-2xl cursor-pointer transition-all"
            >
              Giriş Ekranına Dön
            </button>
          </div>
        )}

        {/* Alt Bilgi */}
        <div className="pt-2 border-t border-[#26262E] text-[10px] text-[#70707A] flex items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>Donanım Korumalı Güvenlik Sistemi</span>
        </div>
      </div>
    </div>
  );
};
