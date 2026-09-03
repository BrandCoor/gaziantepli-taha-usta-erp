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
  CreditCard,
  Building2,
  DollarSign,
  TrendingUp,
  X,
  QrCode,
  Lock
} from 'lucide-react';
import { Employee, dataService } from '../../services/dataService';
import { notify } from '../../services/notificationService';

interface EmployeeListViewProps {
  employees: Employee[];
  onRefresh: () => void;
  onOpenPaymentModal?: (employeeId: string) => void;
}

type SortField = 'fullName' | 'position' | 'salary' | 'balance';
type SortOrder = 'asc' | 'desc';

export const EmployeeListView: React.FC<EmployeeListViewProps> = ({ employees, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('fullName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Modallar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [payModalEmployee, setPayModalEmployee] = useState<Employee | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payType, setPayType] = useState('AVANS');
  const [payDesc, setPayDesc] = useState('');

  // Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPosition, setFormPosition] = useState('Garson');
  const [formSalary, setFormSalary] = useState('25000');
  const [formIban, setFormIban] = useState('');
  const [formPinCode, setFormPinCode] = useState('1234');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const processedEmployees = useMemo(() => {
    let list = employees.filter(e => {
      const matchSearch = e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || (e.phone && e.phone.includes(searchQuery));
      if (!matchSearch) return false;
      if (roleFilter !== 'ALL' && e.position !== roleFilter) return false;
      return true;
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
  }, [employees, searchQuery, roleFilter, sortField, sortOrder]);

  const totalPayroll = useMemo(() => employees.reduce((s, e) => s + (Number(e.salary) || 0), 0), [employees]);
  const totalDebt = useMemo(() => employees.reduce((s, e) => s + ((e.balance || 0) > 0 ? (e.balance || 0) : 0), 0), [employees]);

  const formatMoney = (val: number) => {
    return (Number(val) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  const handleOpenAddModal = () => {
    setEditingEmployee(null);
    setFormName('');
    setFormPhone('');
    setFormPosition('Garson');
    setFormSalary('25000');
    setFormIban('');
    setFormPinCode('1234');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (e: Employee) => {
    setEditingEmployee(e);
    setFormName(e.fullName);
    setFormPhone(e.phone || '');
    setFormPosition(e.position || 'Garson');
    setFormSalary(String(e.salary || 0));
    setFormIban(e.iban || '');
    setFormPinCode((e as any).pinCode || '1234');
    setIsModalOpen(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return notify.error('Eksik Bilgi', 'Personel adı giriniz.');

    if (editingEmployee) {
      dataService.updateEmployee(editingEmployee.id, {
        fullName: formName,
        phone: formPhone,
        position: formPosition,
        salary: parseFloat(formSalary) || 0,
        iban: formIban,
      });
      notify.success('Personel Güncellendi', `${formName} başarıyla güncellendi.`);
    } else {
      dataService.addEmployee({
        fullName: formName,
        phone: formPhone,
        position: formPosition,
        salary: parseFloat(formSalary) || 0,
        iban: formIban,
      });
      notify.success('Personel Eklendi', `${formName} kadroya başarıyla eklendi.`);
    }

    setIsModalOpen(false);
    onRefresh();
  };

  const handleDeleteEmployee = (e: Employee) => {
    notify.confirm({
      title: 'Personel Kaydını Sil',
      message: `"${e.fullName}" adlı personeli ve maaş/avans geçmişini silmek istediğinize emin misiniz?`,
      type: 'danger',
      confirmText: 'Evet, Sil',
      onConfirm: () => {
        dataService.deleteEmployee(e.id);
        notify.success('Personel Silindi', `${e.fullName} sistemden kaldırıldı.`);
        onRefresh();
      }
    });
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalEmployee) return;
    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) return notify.error('Geçersiz Tutar', 'Geçerli bir tutar giriniz.');

    dataService.addEmployeePayment({
      employeeId: payModalEmployee.id,
      type: payType as any,
      amount: amountNum,
      paymentMethod: 'Banka',
      description: payDesc || `${payType} Ödemesi`
    });

    notify.success('Ödeme Kaydedildi', `${payModalEmployee.fullName} için ${formatMoney(amountNum)} ${payType} işlemi yapıldı.`);
    setPayModalEmployee(null);
    setPayAmount('');
    setPayDesc('');
    onRefresh();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans text-[#FAF7F2] bg-[#141416] min-h-screen">
      
      {/* ÜST BAŞLIK & İSTATİSTİK KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#8E8E98]">Toplam Kadro</div>
            <div className="text-2xl font-black text-white mt-1">{employees.length} Personel</div>
            <div className="text-[11px] text-[#F5C877] mt-0.5">Garson, Kasiyer & Ustalar</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#F5C877]/10 text-[#F5C877] flex items-center justify-center font-black">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#8E8E98]">Aylık Maaş Yükü</div>
            <div className="text-2xl font-black text-[#F5C877] font-mono mt-1">{formatMoney(totalPayroll)}</div>
            <div className="text-[11px] text-[#8E8E98] mt-0.5">Net bordro toplamı</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-[#F5C877] flex items-center justify-center font-black">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#8E8E98]">Kalan Personel Avansları</div>
            <div className="text-2xl font-black text-rose-400 font-mono mt-1">{formatMoney(totalDebt)}</div>
            <div className="text-[11px] text-[#8E8E98] mt-0.5">Maaştan kesilecek</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-black">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ARAMA VE BUTON BARI */}
      <div className="bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8E8E98] absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Personel adı, unvan veya telefon ile ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] font-black text-xs rounded-2xl shadow-lg shadow-[#F5C877]/15 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#141416]" />
            <span>Yeni Personel Ekle</span>
          </button>
        </div>
      </div>

      {/* DİNAMİK SIRALANABİLİR PERSONEL TABLOSU (KOYU ERP) */}
      <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#18181C] border-b border-[#2C2C34] text-[#8E8E98] font-black uppercase text-[10px] tracking-wider">
                
                {/* Personel Ad Soyad Sıralama */}
                <th onClick={() => toggleSort('fullName')} className="py-4 px-6 cursor-pointer hover:text-white select-none">
                  <div className="flex items-center gap-2">
                    <span>PERSONEL AD SOYAD</span>
                    {sortField === 'fullName' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F5C877]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F5C877]" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#5A5A66]" />
                    )}
                  </div>
                </th>

                {/* Görevi Sıralama */}
                <th onClick={() => toggleSort('position')} className="py-4 px-6 cursor-pointer hover:text-white select-none">
                  <div className="flex items-center gap-2">
                    <span>GÖREVİ / UNVAN</span>
                    {sortField === 'position' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F5C877]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F5C877]" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#5A5A66]" />
                    )}
                  </div>
                </th>

                {/* Maaş Sıralama */}
                <th onClick={() => toggleSort('salary')} className="py-4 px-6 cursor-pointer hover:text-white select-none">
                  <div className="flex items-center gap-2">
                    <span>MAAŞ & ÖDEME</span>
                    {sortField === 'salary' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F5C877]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F5C877]" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#5A5A66]" />
                    )}
                  </div>
                </th>

                <th className="py-4 px-6">İLETİŞİM & IBAN</th>

                {/* Bakiye Sıralama */}
                <th onClick={() => toggleSort('balance')} className="py-4 px-6 text-right cursor-pointer hover:text-white select-none">
                  <div className="flex items-center justify-end gap-2">
                    <span>PERSONELE KALAN BORÇ</span>
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
            <tbody className="divide-y divide-[#2C2C34]/60">
              {processedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[#8E8E98]">
                    Bu filtreye uygun personel bulunamadı.
                  </td>
                </tr>
              ) : (
                processedEmployees.map((e) => (
                  <tr key={e.id} className="hover:bg-[#222228]/60 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#282830] border border-[#383844] flex items-center justify-center font-black text-[#F5C877] text-xs">
                          {e.fullName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-black text-white text-xs">{e.fullName}</div>
                          <div className="text-[10px] text-[#F5C877] font-mono">PIN: {(e as any).pinCode || '1234'}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 bg-[#282830] border border-[#383844] text-[#FAF7F2] rounded-lg font-bold text-[11px]">
                        {e.position || 'Personel'}
                      </span>
                    </td>

                    <td className="py-4 px-6 font-mono font-black text-[#FAF7F2]">
                      {formatMoney(e.salary || 0)}
                    </td>

                    <td className="py-4 px-6 text-[#8E8E98] text-[11px]">
                      <div>{e.phone || '-'}</div>
                      <div className="font-mono text-[10px] truncate max-w-[140px] text-[#A0A0AA]">{e.iban || 'IBAN Yok'}</div>
                    </td>

                    <td className="py-4 px-6 text-right font-mono font-black text-sm text-[#F5C877]">
                      {formatMoney(e.balance || 0)}
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => { setPayModalEmployee(e); setPayType('AVANS'); }}
                          className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-[#F5C877] border border-[#F5C877]/30 rounded-lg font-bold text-[11px] cursor-pointer"
                        >
                          + Avans
                        </button>
                        <button
                          onClick={() => { setPayModalEmployee(e); setPayType('MAAS'); }}
                          className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg font-bold text-[11px] cursor-pointer"
                        >
                          Maaş Öde
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(e)}
                          className="p-1.5 bg-[#282830] hover:bg-[#32323D] text-[#FAF7F2] border border-[#2C2C34] rounded-lg cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(e)}
                          className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* YENİ PERSONEL EKLE MODALI */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#2C2C34] space-y-5 text-[#FAF7F2]">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3.5">
              <h3 className="text-base font-black text-white">{editingEmployee ? 'Personel Düzenle' : 'Yeni Personel Kartı'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#8E8E98] hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEmployee} className="space-y-4 text-xs">
              <div>
                <label className="text-[#FAF7F2] font-bold block mb-1.5">Personel Ad Soyad *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Ahmet Usta"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-3 bg-[#121214] border border-[#2C2C34] rounded-2xl text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#FAF7F2] font-bold block mb-1.5">Görevi / Unvan</label>
                  <select
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                    className="w-full p-3 bg-[#121214] border border-[#2C2C34] rounded-2xl text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none"
                  >
                    <option value="Garson">Garson</option>
                    <option value="Kebap Ustası">Kebap Ustası</option>
                    <option value="Fırın / Pide Ustası">Fırın / Pide Ustası</option>
                    <option value="Kasiyer">Kasiyer</option>
                    <option value="Paket Kurye">Paket Kurye</option>
                    <option value="Müdür">Müdür</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#FAF7F2] font-bold block mb-1.5">Maaş (TL)</label>
                  <input
                    type="number"
                    placeholder="25000"
                    value={formSalary}
                    onChange={(e) => setFormSalary(e.target.value)}
                    className="w-full p-3 bg-[#121214] border border-[#2C2C34] rounded-2xl text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#FAF7F2] font-bold block mb-1.5">Telefon</label>
                  <input
                    type="text"
                    placeholder="05XX XXX XX XX"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full p-3 bg-[#121214] border border-[#2C2C34] rounded-2xl text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[#FAF7F2] font-bold block mb-1.5">Garson Giriş PIN Kodu</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="1234"
                    value={formPinCode}
                    onChange={(e) => setFormPinCode(e.target.value)}
                    className="w-full p-3 bg-[#121214] border border-[#2C2C34] rounded-2xl text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none font-mono font-bold tracking-widest text-center"
                  />
                </div>
              </div>
              <div>
                <label className="text-[#FAF7F2] font-bold block mb-1.5">IBAN Numarası</label>
                <input
                  type="text"
                  placeholder="TRXX 0000 ..."
                  value={formIban}
                  onChange={(e) => setFormIban(e.target.value)}
                  className="w-full p-3 bg-[#121214] border border-[#2C2C34] rounded-2xl text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none font-mono"
                />
              </div>
              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2.5">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-[#282830] text-[#FAF7F2] rounded-xl font-bold">Vazgeç</button>
                <button type="submit" className="px-6 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] font-black rounded-xl shadow-lg">{editingEmployee ? 'Güncelle' : 'Kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MAAŞ / AVANS ÖDEME MODALI */}
      {payModalEmployee && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-5 text-[#FAF7F2]">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3.5">
              <h3 className="text-base font-black text-white">{payType === 'AVANS' ? 'Avans Ödemesi' : 'Maaş Ödemesi'}</h3>
              <button onClick={() => setPayModalEmployee(null)} className="text-[#8E8E98] hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSavePayment} className="space-y-4 text-xs">
              <div>
                <label className="text-[#FAF7F2] font-bold block mb-1.5">Ödenecek Tutar (TL) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full p-3.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xl font-mono font-black text-[#F5C877] focus:border-[#F5C877] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[#FAF7F2] font-bold block mb-1.5">Açıklama</label>
                <input
                  type="text"
                  placeholder="Örn: Eylül ayı avansı..."
                  value={payDesc}
                  onChange={(e) => setPayDesc(e.target.value)}
                  className="w-full p-3 bg-[#121214] border border-[#2C2C34] rounded-2xl text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none"
                />
              </div>
              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2.5">
                <button type="button" onClick={() => setPayModalEmployee(null)} className="px-5 py-2.5 bg-[#282830] text-[#FAF7F2] rounded-xl font-bold">Vazgeç</button>
                <button type="submit" className="px-6 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] font-black rounded-xl shadow-lg">Ödemeyi Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};