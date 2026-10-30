import React, { useEffect, useRef, useState } from 'react';
import { onlinePlatformService } from '../../services/onlinePlatformService';
import { restaurantDataService } from '../../services/restaurantDataService';
import { notify } from '../../services/notificationService';

/**
 * Online Siparişler ekranı açık olmasa da yeni platform siparişlerini fark eder:
 * sunucu platformları kasanın liste isteğiyle sorguladığı için bu izleme zorunludur.
 * Ekran açıkken alarmı o ekran yönetir.
 */
export const OnlineOrderWatcher: React.FC<{ active: boolean; onOpen: () => void }> = ({ active, onOpen }) => {
  const [pending, setPending] = useState(0);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!onlinePlatformService.isAnyPlatformEnabled()) { if (alive) setPending(0); return; }
      try {
        const list = await onlinePlatformService.fetchOrders('ACTIVE');
        if (!alive) return;
        const fresh = list.filter(o => o.status === 'BEKLIYOR');
        if (seen.current === null) seen.current = new Set(fresh.map(o => o.id));
        const added = fresh.filter(o => !seen.current!.has(o.id));
        fresh.forEach(o => seen.current!.add(o.id));
        setPending(fresh.length);
        if (added.length > 0 && !active) {
          notify.warning('Yeni Platform Siparişi', `${added.length} yeni sipariş geldi: ${added.map(o => o.platform).join(', ')}`);
          if (restaurantDataService.getFoodPlatformsConfig().continuousAlarmUntilAction) restaurantDataService.startContinuousAlarm('phone');
          else restaurantDataService.playAudioAlert('phone');
        }
        if (fresh.length === 0 && !active) restaurantDataService.stopContinuousAlarm();
      } catch { /* ağ hatası: bir sonraki turda tekrar denenir */ }
    };
    tick();
    const t = setInterval(tick, 7000);
    return () => { alive = false; clearInterval(t); };
  }, [active]);

  useEffect(() => { if (active) restaurantDataService.stopContinuousAlarm(); }, [active]);

  if (active || pending === 0) return null;
  return (
    <button
      onClick={onOpen}
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[9000] px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-sm font-black shadow-2xl animate-pulse cursor-pointer"
    >
      🔔 {pending} yeni platform siparişi — görmek için tıklayın
    </button>
  );
};
