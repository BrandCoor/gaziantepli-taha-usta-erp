import React, { useState } from 'react';
import { Plus, Search, Phone, Edit2, Trash2, ArrowDownLeft, ArrowUpRight, Upload, FileSpreadsheet, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown, Printer, Download, AlertTriangle } from 'lucide-react';
import { dataService, Customer, CustomerTransaction } from '../../services/dataService';
import { exportService } from '../../services/exportService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import ExcelJS from 'exceljs';

interface CustomerListViewProps {
  customers: Customer[];
  onRefresh: () => void;
  onOpenTxModal: (customerId?: string, defaultType?: 'DEBT' | 'COLLECTION') => void;
}

type SortField = 'name' | 'phone' | 'balance' | 'createdAt';
type SortOrder = 'asc' | 'desc' | null;

export const CustomerListView: React.FC<CustomerListViewProps> = ({ customers, onRefresh, onOpenTxModal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  const [sortField, setSortField] = useState<SortField>('balance');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Müşteri Modal
  const [showModal, setShowModal] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  // Özel Silme Onay Modalları
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [txToDeleteId, setTxToDeleteId] = useState<string | null>(null);

  // Döküm İçi Hareket Düzenleme
  const [editingTx, setEditingTx] = useState<CustomerTransaction | null>(null);
  const [txType, setTxType] = useState<'DEBT' | 'COLLECTION'>('DEBT');
  const [txAmount, setTxAmount] = useState('');
  const [txMethod, setTxMethod] = useState<'CASH' | 'BANK' | 'CREDIT_CARD'>('BANK');
  const [txDate, setTxDate] = useState('');
  const [txDesc, setTxDesc] = useState('');

  // Menufay İçe Aktarma
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedRows, setImportedRows] = useState<Array<{ name: string; phone: string; notes: string; balance: number }>>([]);
  const [importFileName, setImportFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; updated: number; total: number; totalImportedBalance: number } | null>(null);

  const canManage = dataService.hasPermission('CUSTOMERS_MANAGE');
  const canTransact = dataService.hasPermission('CUSTOMERS_TRANSACTION');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else if (sortOrder === 'desc') {
        setSortField('name');
        setSortOrder(null);
      } else {
        setSortOrder('asc');
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleOpenAdd = () => {
    setEditingCustomerId(null);
    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setShowModal(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomerId(c.id);
    setName(c.name);
    setPhone(c.phone || '');
    setEmail(c.email || '');
    setNotes(c.notes || '');
    setShowModal(true);
  };

  const handleConfirmDeleteCustomer = () => {
    if (!customerToDelete) return;
    dataService.deleteCustomer(customerToDelete.id);
    setCustomerToDelete(null);
    onRefresh();
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('Müşteri adı zorunludur');
    dataService.saveCustomer({
      id: editingCustomerId || undefined,
      name,
      phone,
      email,
      notes
    });
    setShowModal(false);
    onRefresh();
  };

  const handleOpenEditTx = (tx: CustomerTransaction) => {
    setEditingTx(tx);
    setTxType(tx.type);
    setTxAmount(tx.amount.toString());
    setTxMethod(tx.paymentMethod);
    setTxDate(tx.date);
    setTxDesc(tx.description || '');
  };

  const handleConfirmDeleteTx = () => {
    if (!selectedCustomer || !txToDeleteId) return;
    const updatedCust = dataService.deleteCustomerTransaction(selectedCustomer.id, txToDeleteId);
    if (updatedCust) {
      setSelectedCustomer({ ...updatedCust });
      setTxToDeleteId(null);
      onRefresh();
    }
  };

  const handleSaveTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !editingTx) return;
    if (!txAmount || Number(txAmount) <= 0) return alert('Lütfen geçerli bir tutar girin');

    const updatedCust = dataService.updateCustomerTransaction(selectedCustomer.id, editingTx.id, {
      type: txType,
      amount: Number(txAmount),
      paymentMethod: txMethod,
      date: txDate || new Date().toISOString().split('T')[0],
      description: txDesc
    });

    if (updatedCust) {
      setSelectedCustomer({ ...updatedCust });
      setEditingTx(null);
      onRefresh();
    }
  };

  const extractCellText = (cell: any): string => {
    if (!cell) return '';
    const v = cell.value;
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') {
      if (v.richText && Array.isArray(v.richText)) return v.richText.map((r: any) => r.text || '').join('').trim();
      if (v.text !== undefined) return String(v.text).trim();
      if (v.result !== undefined) return String(v.result).trim();
    }
    return String(v).trim();
  };

  const extractCellBalance = (cell: any): number => {
    if (!cell) return 0;
    const v = cell.value;
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    if (!v) return 0;
    const rawStr = String(v).trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(rawStr);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleExcelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setIsProcessing(true);
    setImportResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];
      const parsedCustomers: Array<{ name: string; phone: string; notes: string; balance: number }> = [];

      worksheet.eachRow({ includeEmpty: false }, (row) => {
        const col1 = extractCellText(row.getCell(1));
        const col2 = extractCellText(row.getCell(2));
        const col3 = extractCellText(row.getCell(3));
        const col4 = extractCellText(row.getCell(4));
        const col5Balance = extractCellBalance(row.getCell(5));

        const col1Lower = col1.toLowerCase();
        if (col1Lower.includes('müşteri adı') || col1Lower === 'menufay' || col2.toLowerCase().includes('telefon')) return;

        if (col1 || col2 || col3 || col5Balance > 0) {
          let finalName = col1;
          if (!finalName || finalName === '.' || finalName === '..' || finalName === '...' || finalName.length <= 2) {
            if (col2) finalName = `Müşteri (${col2})`;
            else if (col3) finalName = col3.substring(0, 25) + ' Müşteri';
            else finalName = 'İsimsiz Müşteri';
          }

          let fullNotes = '';
          if (col3 && col4 && col3 !== col4 && col4 !== '.') fullNotes = `Adres: ${col3} | Not: ${col4}`;
          else if (col3) fullNotes = `Adres: ${col3}`;
          else if (col4 && col4 !== '.') fullNotes = `Not: ${col4}`;

          parsedCustomers.push({ name: finalName, phone: col2, notes: fullNotes, balance: col5Balance });
        }
      });

      if (parsedCustomers.length === 0) alert('Seçilen Excel dosyasında müşteri kaydı tespit edilemedi.');
      else setImportedRows(parsedCustomers);
    } catch (err) {
      alert('Excel dosyası okunurken hata oluştu.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteImport = () => {
    if (importedRows.length === 0) return;
    try {
      const result = dataService.importCustomersFromList(importedRows);
      setImportResult(result);
      onRefresh();
    } catch (err) {
      alert('Kayıt sırasında bir hata oluştu.');
    }
  };

  const processedCustomers = [...customers]
    .filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.notes && c.notes.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      if (!sortOrder || !sortField) return 0;
      let comp = 0;
      if (sortField === 'name') comp = a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' });
      else if (sortField === 'phone') comp = (a.phone || '').localeCompare(b.phone || '', 'tr');
      else if (sortField === 'balance') comp = a.balance - b.balance;
      else if (sortField === 'createdAt') comp = (a.createdAt || '').localeCompare(b.createdAt || '');
      return sortOrder === 'asc' ? comp : -comp;
    });

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field || sortOrder === null) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-600 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600 font-bold" />;
  };

  const totalPreviewDebt = importedRows.reduce((acc, row) => acc + row.balance, 0);

  return (
    <div className="p-10 space-y-8 max-w-[1700px] mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Müşteriler & Cari Hesaplar</h2>
          <p className="text-xs text-slate-500">Müşteri kartları, adres bilgileri ve borç/tahsilat takibi ({customers.length} Kayıtlı Müşteri)</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Müşteri, telefon veya adres ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm select-text cursor-text"
            />
          </div>

          {canManage && (
            <>
              <button
                onClick={() => { setImportedRows([]); setImportFileName(''); setImportResult(null); setShowImportModal(true); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
              >
                <Upload className="w-4 h-4" />
                <span>Excel'den Yükle (Menufay)</span>
              </button>

              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Müşteri Ekle</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase select-none">
            <tr>
              <th onClick={() => handleSort('name')} className="py-4 px-6 cursor-pointer hover:bg-slate-100/80 group">
                <div className="flex items-center gap-1.5">
                  <span className={sortField === 'name' ? 'text-blue-600 font-black' : ''}>Müşteri / Şirket Adı</span>
                  {renderSortIcon('name')}
                </div>
              </th>
              <th onClick={() => handleSort('phone')} className="py-4 px-6 cursor-pointer hover:bg-slate-100/80 group">
                <div className="flex items-center gap-1.5">
                  <span className={sortField === 'phone' ? 'text-blue-600 font-black' : ''}>Telefon</span>
                  {renderSortIcon('phone')}
                </div>
              </th>
              <th className="py-4 px-6">Adres & Açıklama Notları</th>
              <th onClick={() => handleSort('balance')} className="py-4 px-6 text-right cursor-pointer hover:bg-slate-100/80 group">
                <div className="flex items-center justify-end gap-1.5">
                  <span className={sortField === 'balance' ? 'text-blue-600 font-black' : ''}>Kalan Borç Bakiyesi</span>
                  {renderSortIcon('balance')}
                </div>
              </th>
              <th className="py-4 px-6 text-center">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {processedCustomers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center text-slate-400">
                  <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-600 text-sm">Henüz kayıtlı müşteri bulunmuyor.</p>
                </td>
              </tr>
            ) : (
              processedCustomers.map(customer => (
                <tr key={customer.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-4 px-6 font-bold text-slate-900 text-sm">{customer.name}</td>
                  <td className="py-4 px-6 text-slate-600 font-medium">{customer.phone || '-'}</td>
                  <td className="py-4 px-6 text-slate-500 max-w-md truncate">{customer.notes || '-'}</td>
                  <td className="py-4 px-6 text-right font-black text-sm">
                    <span className={customer.balance > 0 ? 'text-rose-600' : 'text-slate-700'}>{formatCurrency(customer.balance)}</span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-center gap-1.5">
                      {canTransact && (
                        <>
                          <button onClick={() => onOpenTxModal(customer.id, 'DEBT')} className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-[11px] border border-rose-200 cursor-pointer">+ Borç</button>
                          <button onClick={() => onOpenTxModal(customer.id, 'COLLECTION')} className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-[11px] border border-emerald-200 cursor-pointer">+ Tahsilat</button>
                        </>
                      )}
                      <button onClick={() => setSelectedCustomer(customer)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-[11px] border border-blue-200 cursor-pointer">Ekstre</button>
                      {canManage && (
                        <>
                          <button onClick={() => handleOpenEdit(customer)} className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl text-xs border border-slate-200 cursor-pointer" title="Düzenle"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setCustomerToDelete(customer)} className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl text-xs border border-slate-200 cursor-pointer" title="Sil"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MÜŞTERİ EKSTRE DÖKÜMÜ MODALI */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-7 shadow-2xl border border-slate-200 max-h-[88vh] flex flex-col relative z-50">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900">{selectedCustomer.name} - Hesap Ekstresi</h3>
                <p className="text-xs text-slate-500">Tüm hareketleri inceleyin, düzenleyin, silin veya resmi çıktı alın</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => exportService.exportSingleCustomerStatementPdf(selectedCustomer)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 cursor-pointer"
                  title="Resmi PDF / Yazıcı Çıktısı Al"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Yazdır / PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportService.exportSingleCustomerStatementExcel(selectedCustomer)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
                  title="Excel (.xlsx) Tablosu Olarak İndir"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel (.xlsx)</span>
                </button>

                <div className="text-right pl-3 border-l border-slate-200">
                  <div className="text-[11px] text-slate-400 font-medium">Güncel Bakiye</div>
                  <div className="text-base font-black text-rose-600">{formatCurrency(selectedCustomer.balance)}</div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Tarih</th>
                    <th className="py-2.5 px-3">İşlem Türü</th>
                    <th className="py-2.5 px-3">Açıklama</th>
                    <th className="py-2.5 px-3">Ödeme Kanalı</th>
                    <th className="py-2.5 px-3 text-right">Tutar</th>
                    <th className="py-2.5 px-3 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedCustomer.transactions.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-slate-400">Ekstrede hareket kaydı bulunmuyor.</td></tr>
                  ) : (
                    selectedCustomer.transactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{formatDate(t.date)}</td>
                        <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                          {t.type === 'DEBT' ? <span className="text-rose-600">+ Borç Eklendi</span> : <span className="text-emerald-600">- Tahsilat Alındı</span>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{t.description || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{t.paymentMethod === 'BANK' ? 'Banka / Havale' : t.paymentMethod === 'CREDIT_CARD' ? 'Kredi Kartı' : 'Nakit Kasa'}</td>
                        <td className={`py-2.5 px-3 text-right font-black whitespace-nowrap ${t.type === 'DEBT' ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {t.type === 'DEBT' ? '+' : '-'}{formatCurrency(t.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleOpenEditTx(t)} className="p-1 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg border border-slate-200 cursor-pointer" title="Düzenle"><Edit2 className="w-3 h-3" /></button>
                            <button onClick={() => setTxToDeleteId(t.id)} className="p-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg border border-slate-200 cursor-pointer" title="Sil"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button onClick={() => setSelectedCustomer(null)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs cursor-pointer">Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* ÖZEL MÜŞTERİ SİLME ONAY MODALI */}
      {customerToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 mb-1">Müşteriyi Sil</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              <strong>"{customerToDelete.name}"</strong> müşterisini ve tüm borç/tahsilat kayıtlarını silmek istediğinize emin misiniz?
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCustomer}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 cursor-pointer"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÖZEL EKSTRE HAREKETİ SİLME ONAY MODALI */}
      {txToDeleteId && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 mb-1">Hareketi Sil</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Bu borç/tahsilat hareketini ekstre dökümünden silmek istediğinize emin misiniz? Müşteri bakiyesi otomatik güncellenecektir.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setTxToDeleteId(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTx}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 cursor-pointer"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTx && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Ekstre Hareketini Düzenle</h3>
            <p className="text-xs text-slate-500 mb-4">Borç veya tahsilat kaydını değiştirin</p>

            <form onSubmit={handleSaveTx} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">İşlem Türü</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setTxType('DEBT')} className={`py-2 rounded-xl text-xs font-bold border ${txType === 'DEBT' ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>Borç Ekle (+)</button>
                  <button type="button" onClick={() => setTxType('COLLECTION')} className={`py-2 rounded-xl text-xs font-bold border ${txType === 'COLLECTION' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>Tahsilat (-)</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tutar (TL) *</label>
                <input type="number" step="0.01" required value={txAmount} onChange={e => setTxAmount(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-sm font-bold bg-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tarih</label>
                <input type="date" required value={txDate} onChange={e => setTxDate(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs font-semibold bg-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Açıklama</label>
                <input type="text" value={txDesc} onChange={e => setTxDesc(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs bg-white" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingTx(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Vazgeç</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20 cursor-pointer">Değişikliği Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Menufay Excel'den Müşteri ve Borç Yükle</h3>
                <p className="text-xs text-slate-500">Müşteri adları, telefonlar, adresler ve güncel borç bakiyeleri aktarılır</p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
            </div>

            <div className="py-4 space-y-4 flex-1 overflow-y-auto">
              <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-6 text-center transition-colors bg-slate-50/50">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <label className="block text-xs font-bold text-slate-800 cursor-pointer">
                  <span className="text-emerald-600 hover:underline">Menufay.xlsx Dosyasını Seçin</span>
                  <input type="file" accept=".xlsx, .xls" onChange={handleExcelFileUpload} className="hidden" />
                </label>
                <p className="text-[11px] text-slate-400 mt-1">İsim, Telefon, Adres, Açıklama ve Borç Bakiyesi (E Sütunu) otomatik aktarılır</p>
                {importFileName && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{importFileName}</span>
                  </div>
                )}
              </div>

              {importResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs space-y-1">
                  <div className="font-bold text-sm mb-1 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> İçe Aktarma Tamamlandı!</div>
                  <div>• <strong>{importResult.added}</strong> müşteri eklendi.</div>
                  <div>• <strong>{importResult.updated}</strong> müşteri güncellendi.</div>
                  <div className="font-bold text-rose-700 pt-1">• Toplam Borç/Alacak: {formatCurrency(importResult.totalImportedBalance)}</div>
                </div>
              )}

              {importedRows.length > 0 && !importResult && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">Okunan Müşteriler ({importedRows.length} Kişi)</span>
                    <span className="text-xs font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">Toplam: {formatCurrency(totalPreviewDebt)}</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                    {importedRows.map((row, idx) => (
                      <div key={idx} className="p-2.5 text-xs flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <div className="font-bold text-slate-800">{row.name}</div>
                          {row.notes && <div className="text-[10px] text-slate-500 mt-0.5">{row.notes}</div>}
                        </div>
                        <div className="text-slate-600 font-mono text-[11px] whitespace-nowrap">{row.phone || '-'}</div>
                        <div className="text-right whitespace-nowrap">
                          <span className={`font-black text-xs ${row.balance > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>{formatCurrency(row.balance)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button type="button" onClick={() => { setShowImportModal(false); onRefresh(); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">{importResult ? 'Listeyi Görüntüle & Kapat' : 'Vazgeç'}</button>
              {importedRows.length > 0 && !importResult && (
                <button type="button" onClick={handleExecuteImport} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"><CheckCircle2 className="w-4 h-4" /><span>{importedRows.length} Müşteriyi ve {formatCurrency(totalPreviewDebt)} Borcu Aktar</span></button>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">{editingCustomerId ? 'Müşteri Bilgilerini Düzenle' : 'Yeni Müşteri Kartı Oluştur'}</h3>
            <p className="text-xs text-slate-500 mb-4">Temel cari ve adres bilgilerini güncelleyin</p>
            <form onSubmit={handleSaveCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Müşteri / Şirket Adı *</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Örn: Müşteri / Firma Adı" className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs bg-white font-medium select-text cursor-text" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Telefon</label>
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="05XX XXX XX XX" className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs bg-white select-text cursor-text" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-posta</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="info@firma.com" className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs bg-white select-text cursor-text" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Adres / Açıklama</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Adres veya müşteri notu..." className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs bg-white select-text cursor-text" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Vazgeç</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20 cursor-pointer">{editingCustomerId ? 'Değişiklikleri Kaydet' : 'Müşteriyi Kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};