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
import { WaiterView, WaiterLoginView, deviceService } from './modules/waiter';
import { GlobalModal } from './components/common/GlobalModal';
import { CallerIdPopup } from './components/common/CallerIdPopup';
import { dataService } from './services/dataService';
import { printerService } from './services/printerService';
import { isApiSyncConfigured } from './services/restaurantDataService';
import { parseAppRoute } from './utils/routeUtils';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [targetPosTableId, setTargetPosTableId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Rota durumu. Garson girisi yalnizca PIN ile yapilir, QR eslestirme
  // ekrani kaldirilmistir.
  const [, setRouteState] = useState(() => parseAppRoute());

  const [isWaiterMode, setIsWaiterMode] = useState<boolean>(() => parseAppRoute().isWaiterMode);
  const [waiterUser, setWaiterUser] = useState<any>(() => deviceService.getActiveSession());

  useEffect(() => {
    const handleLocationChange = () => {
      const current = parseAppRoute();
      setRouteState(current);
      if (current.isWaiterMode) {
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

  // 1. GARSON MOBİL TERMİNALİ (garson.rymedya.com.tr veya ?mode=waiter)
  // Garson terminali kapalı bir alandır: yalnızca masa görme ve sipariş alma.
  // Kasa paneline geçiş bilerek verilmez, aksi halde garson telefonundan ciro,
  // personel ve kasa ekranlarına erişilebiliyordu.
  if (isWaiterMode) {
    if (waiterUser) {
      return (
        <>
          <WaiterView
            waiterUser={waiterUser}
            onLogout={() => {
              deviceService.logout();
              setWaiterUser(null);
            }}
          />
          <GlobalModal />
        </>
      );
    } else {
      return (
        <>
          <WaiterLoginView
            onLoginSuccess={(user) => {
              setWaiterUser(user);
            }}
          />
          <GlobalModal />
        </>
      );
    }
  }

  // 2. KASA GİRİŞİ (Desktop / Tablet Kasa Paneli)
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
              aynı veriyi göremez. Ayarlar &gt; Sistem &amp; Yedekleme bölümünden kendi sunucu adresinizi girin
              (örnek: https://alanadiniz.com.tr/api/index.php).
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
          {activeTab === 'restaurant-settings' && <RestaurantSettingsView />}
          {activeTab === 'dashboard' && <DashboardView onNavigate={setActiveTab} />}
          {activeTab === 'customers' && <CustomerListView customers={customers} onRefresh={refreshAll} />}
          {activeTab === 'expenses' && <ExpenseListView />}
          {activeTab === 'employees' && <EmployeeListView employees={employees} onRefresh={refreshAll} onOpenPaymentModal={() => {}} />}
          {activeTab === 'reports' && <ReportsView />}
          {activeTab === 'users' && <UserManagementView />}
          {activeTab === 'company-settings' && <CompanySettingsView onSettingsSaved={refreshAll} />}
        </main>
      </div>

      <GlobalModal />
      <CallerIdPopup onOpenOrder={(tableId) => {
        setTargetPosTableId(tableId);
        setActiveTab('pos');
      }} />
    </div>
  );
}
