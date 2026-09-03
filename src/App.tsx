import React, { useState } from 'react';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { PosView } from './modules/pos/PosView';
import { DeliveryView } from './modules/delivery/DeliveryView';
import { RestaurantSettingsView } from './modules/restaurant-settings/RestaurantSettingsView';
import { DashboardView } from './modules/dashboard/DashboardView';
import { CustomerListView } from './modules/customers/CustomerListView';
import { EmployeeListView } from './modules/employees/EmployeeListView';
import { ExpenseListView } from './modules/expenses/ExpenseListView';
import { ReportsView } from './modules/reports/ReportsView';
import { UserManagementView } from './modules/users/UserManagementView';
import { CompanySettingsView } from './modules/settings/CompanySettingsView';
import { GlobalModal } from './components/common/GlobalModal';
import { dataService } from './services/dataService';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [targetPosTableId, setTargetPosTableId] = useState<string | null>(null);

  const [customers, setCustomers] = useState(dataService.getCustomers());
  const [employees, setEmployees] = useState(dataService.getEmployees());
  const [expenses, setExpenses] = useState(dataService.getExpenses());

  const refreshAll = () => {
    setCustomers(dataService.getCustomers());
    setEmployees(dataService.getEmployees());
    setExpenses(dataService.getExpenses());
  };

  return (
    <div className="flex h-screen w-screen bg-[#141416] overflow-hidden font-sans text-[#FAF7F2] antialiased">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <Header onLockApp={() => setIsAuthenticated(false)} />

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
          {activeTab === 'restaurant-settings' && <RestaurantSettingsView />}
          {activeTab === 'dashboard' && <DashboardView onNavigate={setActiveTab} />}
          {activeTab === 'customers' && <CustomerListView />}
          {activeTab === 'expenses' && <ExpenseListView />}
          {activeTab === 'employees' && <EmployeeListView employees={employees} onRefresh={refreshAll} onOpenPaymentModal={() => {}} />}
          {activeTab === 'reports' && <ReportsView />}
          {activeTab === 'users' && <UserManagementView />}
          {activeTab === 'company-settings' && <CompanySettingsView onSettingsSaved={refreshAll} />}
        </main>
      </div>

      <GlobalModal />
    </div>
  );
}
