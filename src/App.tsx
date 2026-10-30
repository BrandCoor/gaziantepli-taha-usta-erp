import React, { useState, useEffect } from 'react';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { PosView } from './modules/pos/PosView';
import { DeliveryView } from './modules/delivery/DeliveryView';
import { OnlineOrdersView } from './modules/online-orders/OnlineOrdersView';
import { RestaurantSettingsView } from './modules/restaurant-settings/RestaurantSettingsView';
import { DashboardView } from './modules/dashboard/DashboardView';
import { CustomerListView } from './modules/customers/CustomerListView';
import { EmployeeListView } from './modules/employees/EmployeeListView';
import { ExpenseListView } from './modules/expenses/ExpenseListView';
import { ReportsView } from './modules/reports/ReportsView';
import { UserManagementView } from './modules/users/UserManagementView';
import { CompanySettingsView } from './modules/settings/CompanySettingsView';
import { LoginView } from './modules/auth/LoginView';
import { FirstRunSetupView } from './modules/auth/FirstRunSetupView';
import { WaiterView, WaiterLoginView, WaiterPairingView, deviceService } from './modules/waiter';
import { GlobalModal } from './components/common/GlobalModal';
import { CallerIdPopup } from './components/common/CallerIdPopup';
import { PrintQueueIndicator } from './components/common/PrintQueueIndicator';
import { UpdateBanner } from './components/common/UpdateBanner';
import { OnlineOrderWatcher } from './components/common/OnlineOrderWatcher';
import { fullBackupService } from './services/fullBackupService';
import { dataService } from './services/dataService';
import { printerService } from './services/printerService';
import { isApiSyncConfigured, getPublicBaseUrl } from './services/restaurantDataService';
import { getKasaApiKey } from './services/cloudAuth';
import { parseAppRoute } from './utils/routeUtils';

function NoAccess() {
  return (
    <div className="p-10 text-center space-y-2">
      <div className="text-4xl">🔒</div>
      <h2 className="text-lg font-black text-white">Bu bölüme erişim yetkiniz yok</h2>
      <p className="text-sm text-[#A0A0AA]">Gerekli yetki için yöneticinize başvurun.</p>
    </div>
  );
}

export default function App() {
  useEffect(() => { fullBackupService.startScheduler(); }, []);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsSetup, setNeedsSetup] = useState<boolean>(() => !dataService.hasUsers());
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [targetPosTableId, setTargetPosTableId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Rota ve Garson Eşleşme Durumu (Hem /pair hem #/pair destekli)
  const [routeState, setRouteState] = useState(() => parseAppRoute());
  const isGarsonSubdomain = typeof window !== 'undefined' && window.location.hostname.startsWith('garson.');

  const [isWaiterMode, setIsWaiterMode] = useState<boolean>(() => routeState.isWaiterMode);
  const [isPairingView, setIsPairingView] = useState<boolean>(() => (
    routeState.isPairRoute || (isGarsonSubdomain && !deviceService.hasPairedDevice() && !deviceService.getActiveSession())
  ));
  const [waiterUser, setWaiterUser] = useState<any>(() => deviceService.getActiveSession());

  useEffect(() => {
    const handleLocationChange = () => {
      const current = parseAppRoute();
      setRouteState(current);
      if (current.isPairRoute) {
        setIsPairingView(true);
        setIsWaiterMode(true);
      } else if (current.isWaiterMode) {
        setIsWaiterMode(true);
      }
    };

    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const [customers, setCustomers] = useState(dataService.getCustomers());
  const [employees, setEmployees] = useState(dataService.getEmployees());
  const [expenses, setExpenses] = useState(dataService.getExpenses());

  const refreshAll = () => {
    setCustomers(dataService.getCustomers());
    setEmployees(dataService.getEmployees());
    setExpenses(dataService.getExpenses());
  };

  useEffect(() => {
    refreshAll();
    const unsub = dataService.subscribe(refreshAll);
    return () => unsub();
  }, []);

  // 1-2. GARSON ARAYÜZÜ: tek resmi garson uygulaması /garson/ adresindeki PWA'dır (cihaz anahtarı + PIN oturumu).
  // Kasa uygulamasının içindeki eski garson/eşleştirme modu kapatıldı; ikisini birden sürdürmek çift mantık ve
  // güvenlik açığı demekti.
  if (isPairingView || isWaiterMode) {
    const base = (getPublicBaseUrl() || '').replace(/\/+$/, '');
    const target = base ? `${base}/garson/${typeof window !== 'undefined' ? window.location.search : ''}` : '';
    return (
      <div className="min-h-screen bg-[#141416] text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-4xl">📱</div>
          <h1 className="text-lg font-black">Garson uygulaması ayrı bir sayfadır</h1>
          <p className="text-sm text-[#C4C4CC]">
            Garson terminali artık sunucudaki <strong>/garson/</strong> sayfasından çalışır. Telefonunuzdan bu adresi açın ve kasadan aldığınız eşleştirme kodunu / QR'ı kullanın.
          </p>
          {target && <a href={target} className="inline-block px-5 py-3 bg-[#F5C877] text-slate-950 font-black rounded-xl">Garson sayfasını aç</a>}
        </div>
      </div>
    );
  }

  // 3a. İLK KURULUM: kullanıcı yoksa varsayılan hesap OLUŞTURULMAZ, yönetici hesabı kurulum ekranında açılır.
  if (needsSetup) {
    return (
      <>
        <FirstRunSetupView onCreated={() => { setNeedsSetup(false); setIsAuthenticated(true); }} />
        <GlobalModal />
      </>
    );
  }

  // 3. KASA GİRİŞİ (Desktop / Tablet Kasa Paneli)
  if (!isAuthenticated) {
    return (
      <>
        <LoginView 
          onLoginSuccess={() => setIsAuthenticated(true)} 
          onSwitchToWaiterMode={() => setIsWaiterMode(true)}
        />
        <GlobalModal />
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#141416] overflow-hidden font-sans text-[#FAF7F2] antialiased">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <Header 
          onLockApp={() => setIsAuthenticated(false)} 
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        {!isApiSyncConfigured() && (
          <div className="bg-rose-950/60 border-b border-rose-500/40 px-4 py-2.5 text-[11px] text-rose-200 font-bold flex items-center gap-2">
            <span className="text-base leading-none">⚠️</span>
            <span>
              Senkronizasyon sunucusu ayarlanmadı. Garson telefonları, QR menü ve patron paneli bu kasayla
              aynı veriyi göremez. Restoran &amp; Donanım Ayarları &gt; Bulut &amp; Yedekleme bölümünden kendi sunucu adresinizi girin
              (örnek: https://alanadiniz.com.tr/api/index.php).
            </span>
          </div>
        )}

        {isApiSyncConfigured() && !getKasaApiKey() && (
          <div className="bg-amber-950/60 border-b border-amber-500/40 px-4 py-2.5 text-[11px] text-amber-200 font-bold flex items-center gap-2">
            <span className="text-base leading-none">🔑</span>
            <span>
              Kasa API anahtarı girilmemiş: sunucu bu kasadan gelen istekleri reddeder (garson siparişleri kasaya ulaşmaz).
              Restoran &amp; Donanım Ayarları &gt; Bulut &amp; Yedekleme bölümünden sunucudaki KASA_API_KEY değerini girin.
            </span>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-[#141416] min-w-0">
          {activeTab === 'pos' && (
            <PosView autoOpenTableId={targetPosTableId} onClearAutoOpen={() => setTargetPosTableId(null)} />
          )}
          {activeTab === 'delivery' && (
            <DeliveryView onStartOrder={(tableId) => {
              setTargetPosTableId(tableId);
              setActiveTab('pos');
            }} />
          )}
          {activeTab === 'online-orders' && <OnlineOrdersView />}
          {activeTab === 'restaurant-settings' && (dataService.hasPermission('SETTINGS_MANAGE') ? <RestaurantSettingsView /> : <NoAccess />)}
          {activeTab === 'dashboard' && <DashboardView onNavigate={setActiveTab} />}
          {activeTab === 'customers' && (dataService.hasPermission('CUSTOMERS_VIEW') ? <CustomerListView customers={customers} onRefresh={refreshAll} /> : <NoAccess />)}
          {activeTab === 'expenses' && (dataService.hasPermission('EXPENSES_MANAGE') ? <ExpenseListView /> : <NoAccess />)}
          {activeTab === 'employees' && (dataService.hasPermission('EMPLOYEES_VIEW') ? <EmployeeListView employees={employees} onRefresh={refreshAll} onOpenPaymentModal={() => {}} /> : <NoAccess />)}
          {activeTab === 'reports' && (dataService.hasPermission('REPORTS_VIEW') ? <ReportsView /> : <NoAccess />)}
          {activeTab === 'users' && (dataService.hasPermission('USERS_MANAGE') ? <UserManagementView /> : <NoAccess />)}
          {activeTab === 'company-settings' && (dataService.hasPermission('SETTINGS_MANAGE') ? <CompanySettingsView onSettingsSaved={refreshAll} /> : <NoAccess />)}
        </main>
      </div>

      <GlobalModal />
      <CallerIdPopup onOpenOrder={(tableId) => {
        setTargetPosTableId(tableId);
        setActiveTab('pos');
      }} />
      <PrintQueueIndicator />
      <OnlineOrderWatcher active={activeTab === 'online-orders'} onOpen={() => setActiveTab('online-orders')} />
      <UpdateBanner />
    </div>
  );
}
