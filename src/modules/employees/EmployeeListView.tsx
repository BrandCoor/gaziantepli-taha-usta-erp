import React, { useState, useMemo } from 'react';
import { 
  UserCheck, 
  Search, 
  Plus, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Edit2, 
  Trash2, 
  Phone, 
  DollarSign, 
  CreditCard, 
  X,
  Lock
} from 'lucide-react';
import { Employee, dataService } from '../../services/dataService';
import { notify } from '../../services/notificationService';

interface EmployeeListViewProps {
  employees: Employee[];
  onRefresh: () => void;
  onOpenPaymentModal?: (employeeId?: string) => void;
}

type SortField = 'fullName' | 'position' | 'salary' | 'balance';
type SortOrder = 'asc' | 'desc';

export const EmployeeListView: React.FC<EmployeeListViewProps> = ({ employees, onRefresh, onOpenPaymentModal }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('balance');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Modallar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPosition, setFormPosition] = useState('Garson');
  const [formSalary, setFormSalary] = useState('');
  const [formIban, setFormIban] = useState('');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const processedEmployees = useMemo(() => {
    let list = employees.filter(e => {
      const matchSearch = e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (e.phone && e.phone.includes(searchQuery)) ||
                          (e.position && e.position.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchSearch;
    });

    list.sort((a, b) => {
      let valA: any = a[sortField] || '';
      let valB: any = b[sortField] || '';

      if (sortField === 'salary' || sortField === 'balance') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [employees, searchQuery, sortField, sortOrder]);

  const totalSalarySum = useMemo(() => employees.reduce((s, e) => s + (Number(e.salary) || 0), 0), [employees]);
  const totalEmployeeBalance = useMemo(() => employees.reduce((s, e) => s + Math.max(0, Number(e.balance) || 0), 0), [employees]);

  const formatMoney = (val: number) => {
    return (Number(val) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  const handleOpenAddModal = () => {
    setEditingEmployee(null);
    setFormName('');
    setFormPhone('');
    setFormPosition('Garson');
    setFormSalary('');
    setFormIban('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormName(emp.fullName);
    setFormPhone(emp.phone || '');
    setFormPosition(emp.position || 'Garson');
    setFormSalary(String(emp.salary || ''));
    setFormIban(emp.iban || '');
    setIsModalOpen(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return notify.error('Eksik Bilgi', 'Personel adını giriniz.');
    const salaryNum = parseFloat(formSalary) || 0;

    if (editingEmployee) {
      dataService.updateEmployee(editingEmployee.id, {
        fullName: formName.trim(),
        phone: formPhone.trim(),
        position: formPosition.trim(),
        salary: salaryNum,
        iban: formIban.trim(),
      });
      notify.success('Personel Güncellendi', `${formName} bilgileri kaydedildi.`);
    } else {
      dataService.addEmployee({
        fullName: formName.trim(),
        phone: formPhone.trim(),
        position: formPosition.trim(),
        salary: salaryNum,
        iban: formIban.trim(),
        isActive: true,
      });
      notify.success('Personel Eklendi', `${formName} sisteme eklendi.`);
    }

    setIsModalOpen(false);
    onRefresh();
  };

  // BAKİYELİ PERSONEL SİLME KİLİDİ
  const handleDeleteEmployee = (emp: Employee) => {
    if (Math.abs(Number(emp.balance) || 0) > 0.01) {
      return notify.error(
        'Personel Silinemez!',
        `Bu personelin ${formatMoney(emp.balance)} hesap bakiyesi bulunmaktadır.\nBakiye sıfırlanmadan personel kaydı silinemez!`
      );
    }

    notify.confirm({
      title: 'Personeli Sil',
      message: `"${emp.fullName}" personelini silmek istediğinize emin misiniz?`,
      type: 'danger',
      confirmText: 'Evet, Sil',
      onConfirm: () => {
        const res = dataService.deleteEmployee(emp.id);
        if (res.success) {
          notify.success('Personel Silindi', `${emp.fullName} kaydı silindi.`);
          onRefresh();
        } else {
          notify.error('Hata', res.message || 'Silinemedi.');
        }
      }
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans text-[#FAF7F2] bg-[#141416] min-h-screen">
      
      {/* ÜST BAŞLIK & İSTATİSTİK */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#8E8E98]">Aylık Toplam Maaş Bütçesi</div>
            <div className="text-3xl font-black text-rose-400 font-mono mt-1">{formatMoney(totalSalarySum)}</div>
            <div className="text-[11px] text-[#8E8E98] mt-0.5">{employees.length} Kayıtlı Personel</div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-black">
            <DollarSign className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#8E8E98]">Personele Kalan Maaş Borcumuz</div>
            <div className="text-3xl font-black text-[#F5C877] font-mono mt-1">{formatMoney(totalEmployeeBalance)}</div>
            <div className="text-[11px] text-[#F5C877] mt-0.5">Ödenmeyi bekleyen hakedişler</div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-[#F5C877]/10 text-[#F5C877] flex items-center justify-center font-black">
            <UserCheck className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* ARAMA VE BUTON BARI */}
      <div className="bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8E8E98] absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Personel adı, pozisyon veya telefon ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none"
          />
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-5 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] font-black text-xs rounded-2xl shadow-lg shadow-[#F5C877]/15 flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4 text-[#141416]" />
          <span>Yeni Personel Ekle</span>
        </button>
      </div>

      {/* PERSONEL LİSTESİ TABLOSU */}
      <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#18181C] border-b border-[#2C2C34] text-[#8E8E98] font-black uppercase text-[10px] tracking-wider">
                <th onClick={() => toggleSort('fullName')} className="py-4 px-6 cursor-pointer hover:text-white select-none">
                  <div className="flex items-center gap-2">
                    <span>PERSONEL ADI SOYADI</span>
                    {sortField === 'fullName' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F5C877]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F5C877]" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#5A5A66]" />
                    )}
                  </div>
                </th>

                <th className="py-4 px-6">GÖREV / POZİSYON</th>
                <th className="py-4 px-6">TELEFON</th>

                <th onClick={() => toggleSort('salary')} className="py-4 px-6 text-right cursor-pointer hover:text-white select-none">
                  <div className="flex items-center justify-end gap-2">
                    <span>AYLIK MAAŞ</span>
                    {sortField === 'salary' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F5C877]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F5C877]" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#5A5A66]" />
                    )}
                  </div>
                </th>

                <th onClick={() => toggleSort('balance')} className="py-4 px-6 text-right cursor-pointer hover:text-white select-none">
                  <div className="flex items-center justify-end gap-2">
                    <span>HAKEDİŞ BAKİYESİ</span>
                    {sortField === 'balance' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F5C877]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F5C877]" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#5A5A66]" />
                    )}
                  </div>
                </th>

                <th className="py-4 px-6 text-center">İŞLEMLER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2C2C34]/60 font-medium">
              {processedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[#8E8E98]">
                    Kayıtlı personel bulunamadı.
                  </td>
                </tr>
              ) : (
                processedEmployees.map((emp) => {
                  const hasBalance = Math.abs(Number(emp.balance) || 0) > 0.01;

                  return (
                    <tr key={emp.id} className="hover:bg-[#222228]/60 transition-colors">
                      <td className="py-4 px-6 font-black text-white">
                        {emp.fullName}
                      </td>

                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 bg-[#282830] border border-[#383844] text-[#F5C877] rounded-lg text-[10px] font-black uppercase">
                          {emp.position || 'Personel'}
                        </span>
                      </td>

                      <td className="py-4 px-6 font-mono text-[#F5C877]">
                        {emp.phone || '—'}
                      </td>

                      <td className="py-4 px-6 text-right font-mono font-bold text-[#FAF7F2]">
                        {formatMoney(emp.salary)}
                      </td>

                      <td className="py-4 px-6 text-right font-black font-mono text-sm">
                        <span className={emp.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                          {formatMoney(emp.balance)}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(emp)}
                            className="p-1.5 text-[#8E8E98] hover:text-[#F5C877] hover:bg-[#282830] rounded-lg transition-colors cursor-pointer"
                            title="Düzenle"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* BAKİYELİ PERSONELDE KİLİT SİMGESİ VE SİLME KORUMASI */}
                          <button
                            onClick={() => handleDeleteEmployee(emp)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              hasBalance ? 'text-[#8E8E98] hover:text-amber-400 hover:bg-amber-500/10' : 'text-rose-400 hover:bg-rose-500/10'
                            }`}
                            title={hasBalance ? 'Hesap bakiyesi olduğu için silinemez' : 'Sil'}
                          >
                            {hasBalance ? <Lock className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PERSONEL EKLE / DÜZENLE MODALI */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white">{editingEmployee ? 'Personeli Düzenle' : 'Yeni Personel Ekle'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#8E8E98] hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Personel Adı Soyadı</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Örn: Serkan Kaya"
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Görevi / Pozisyonu</label>
                  <input
                    type="text"
                    required
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                    placeholder="Örn: Garson / Aşçı"
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Aylık Maaşı (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formSalary}
                    onChange={(e) => setFormSalary(e.target.value)}
                    placeholder="25000.00"
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono font-bold text-rose-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Telefon Numarası</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="0532..."
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono font-bold text-[#F5C877]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">IBAN Numarası</label>
                <input
                  type="text"
                  value={formIban}
                  onChange={(e) => setFormIban(e.target.value)}
                  placeholder="TR..."
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono text-[#FAF7F2]"
                />
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl text-xs font-bold">Vazgeç</button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] rounded-xl text-xs font-black shadow-lg">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
