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
import { WaiterView, WaiterLoginView, WaiterPairingView, deviceService } from './modules/waiter';
import { GlobalModal } from './components/common/GlobalModal';
import { CallerIdPopup } from './components/common/CallerIdPopup';
import { dataService } from './services/dataService';
import { printerService } from './services/printerService';
import { parseAppRoute } from './utils/routeUtils';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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

  // 1. QR KOD EŞLEŞTİRME EKRANI (/pair veya /#/pair?token=...&userId=...)
  if (isPairingView) {
    return (
      <>
        <WaiterPairingView
          initialToken={routeState.token}
          initialUserId={routeState.userId}
          onPairedSuccess={(devInfo: any) => {
            setIsPairingView(false);
            setIsWaiterMode(true);
            setWaiterUser(devInfo);
            if (typeof window !== 'undefined' && window.location.hash.includes('pair')) {
              window.history.replaceState({}, document.title, window.location.pathname + '#/');
            }
          }}
          onGoToLogin={() => {
            setIsPairingView(false);
            setIsWaiterMode(true);
            if (typeof window !== 'undefined' && window.location.hash.includes('pair')) {
              window.history.replaceState({}, document.title, window.location.pathname + '#/');
            }
          }}
          onCancel={() => {
            setIsPairingView(false);
            if (!isGarsonSubdomain) setIsWaiterMode(false);
            if (typeof window !== 'undefined' && window.location.hash.includes('pair')) {
              window.history.replaceState({}, document.title, window.location.pathname + '#/');
            }
          }}
        />
        <GlobalModal />
      </>
    );
  }

  // 2. GARSON MOBİL TERMİNALİ (garson.rymedya.com.tr veya ?mode=waiter)
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
            onOpenPairingScreen={() => setIsPairingView(true)}
          />
          <GlobalModal />
        </>
      );
    }
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
