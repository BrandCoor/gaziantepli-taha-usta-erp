import ExcelJS from 'exceljs';
import { Customer, Employee, Expense, Supplier, dataService } from './dataService';
import { formatCurrency, formatDate } from '../utils/formatters';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export const exportService = {
  // === TEKİL PERSONEL MAAŞ, MESAİ & ÖDEME DÖKÜMÜ - PDF ===
  exportSingleEmployeeStatementPdf(employee: Employee) {
    const company = dataService.getCompanySettings();
    const today = formatDate(new Date());
    const printWindow = window.open('', '_blank', 'width=900,height=750');
    if (!printWindow) return alert('Yazdırma penceresi açılamadı');

    const logoHtml = company.logoBase64 
      ? `<img src="${company.logoBase64}" style="max-height: 60px; max-width: 140px; object-fit: contain; margin-right: 15px;" />` 
      : '';

    let totalAccrued = 0; let totalPaid = 0;
    (employee.payments || []).forEach(p => {
      if (p.type === 'SALARY_ACCRUAL' || p.type === 'BONUS' || p.type === 'TERMINATION_SETTLEMENT' || p.type === 'OVERTIME_ACCRUAL') totalAccrued += p.amount;
      else totalPaid += p.amount;
    });

    const paymentRows = (!employee.payments || employee.payments.length === 0)
      ? `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #94a3b8;">Hareket kaydı bulunmamaktadır.</td></tr>`
      : employee.payments.map((p, i) => {
          const isAdd = p.type==='SALARY_ACCRUAL'||p.type==='BONUS'||p.type==='TERMINATION_SETTLEMENT'||p.type==='OVERTIME_ACCRUAL';
          let typeName = '- Ödeme Yapıldı';
          if (p.type === 'SALARY_ACCRUAL') typeName = '+ Maaş Hak Edişi';
          else if (p.type === 'OVERTIME_ACCRUAL') typeName = '+ Fazla Mesai';
          else if (p.type === 'OVERTIME_PAYMENT') typeName = '- Mesai Ödendi';
          else if (p.type === 'TERMINATION_SETTLEMENT') typeName = '+ Çıkış / Tazminat';
          else if (p.type === 'SALARY_PAYMENT') typeName = '- Maaş Ödendi';
          else if (p.type === 'ADVANCE') typeName = '- Avans Verildi';
          else if (p.type === 'BONUS') typeName = '+ Prim';
          else if (p.type === 'DEDUCTION') typeName = '- Kesinti';

          return `
            <tr>
              <td>${i+1}</td>
              <td>${formatDate(p.date)}</td>
              <td class="font-bold ${isAdd?'text-rose':'text-emerald'}">${typeName}</td>
              <td>${p.description||'-'}</td>
              <td>${p.paymentMethod==='BANK'?'Banka':'Nakit Kasa'}</td>
              <td class="text-right font-bold ${isAdd?'text-rose':'text-emerald'}">${isAdd?'+':'-'}${formatCurrency(p.amount)}</td>
            </tr>
          `;
        }).join('');

    const html = `
      <!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${employee.fullName} - Maaş & Mesai Dökümü</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 25px; color: #1e293b; }
        .header { border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; }
        .brand-box { display: flex; align-items: center; }
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 18px; display: flex; justify-content: space-between; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
        th { background: #1e293b; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; }
        td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .text-rose { color: #e11d48; }
        .text-emerald { color: #059669; }
        .summary-container { margin-top: 20px; display: flex; justify-content: space-between; }
        .signature-box { width: 45%; display: flex; justify-content: space-between; margin-top: 25px; font-size: 11px; text-align: center; }
        .sign-line { border-top: 1px dashed #94a3b8; width: 130px; margin-top: 40px; }
        .total-box { width: 300px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; font-size: 12px; }
        .total-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .footer-note { clear: both; margin-top: 40px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
        @media print { body { padding: 0; } }
      </style></head>
      <body>
        <div class="header"><div class="brand-box">${logoHtml}<div><h1 style="margin:0;font-size:18px;font-weight:900;">${company.companyName.toUpperCase()}</h1><div style="font-size:11px;color:#64748b;">Personel Maaş, Mesai & Ödeme Dökümü</div></div></div><div style="text-align:right;font-size:11px;color:#475569;"><div>Tarih: <strong>${today}</strong></div></div></div>
        <div class="info-card"><div><div>Personel: <strong>${employee.fullName}</strong></div><div>Görev: <strong>${employee.position || '-'}</strong> | Tel: ${employee.phone || '-'}</div>${employee.iban ? `<div>IBAN: <code>${employee.iban}</code></div>` : ''}</div><div style="text-align:right;"><div style="color:#64748b;font-size:11px;">Giriş: ${formatDate(employee.startDate)}</div><div>Maaş: <strong>${formatCurrency(employee.salary)}</strong></div><div style="margin-top:4px;font-size:13px;font-weight:800;" class="${employee.balance > 0 ? 'text-rose' : 'text-emerald'}">Kalan: ${formatCurrency(employee.balance)}</div></div></div>
        <table><thead><tr><th>#</th><th>Tarih</th><th>Hareket Türü</th><th>Açıklama</th><th>Kanal</th><th class="text-right">Tutar</th></tr></thead>
        <tbody>${paymentRows}</tbody></table>
        <div class="summary-container"><div class="signature-box"><div><strong>İşveren Yetkili</strong><div class="sign-line">İmza</div></div><div><strong>Personel Teslim Alan</strong><div class="sign-line">İmza</div></div></div><div class="total-box"><div class="total-row"><span>Toplam Hakediş (+Mesai):</span><span class="font-bold text-rose">${formatCurrency(totalAccrued)}</span></div><div class="total-row"><span>Toplam Ödenen:</span><span class="font-bold text-emerald">${formatCurrency(totalPaid)}</span></div><div class="total-row" style="margin-top:6px;padding-top:6px;border-top:1px solid #cbd5e1;font-size:13px;font-weight:800;"><span>KALAN BORÇ:</span><span class="${employee.balance>0?'text-rose':'text-emerald'}">${formatCurrency(employee.balance)}</span></div></div></div>
        <div class="footer-note"><span>Bu döküm <strong>RYMedya Özel ERP Altyapısı</strong> ile Gaziantepli Taha Usta için üretilmiştir.</span><span>© 2026 RYMedya</span></div>
        <script>window.onload = function() { window.print(); };</script>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  },

  // Tekil Personel Dökümü Excel
  async exportSingleEmployeeStatementExcel(employee: Employee) {
    const company = dataService.getCompanySettings();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = company.companyName;
    const worksheet = workbook.addWorksheet(`${employee.fullName.substring(0, 25)} Dökümü`);

    worksheet.addRow([`${company.companyName.toUpperCase()} - PERSONEL MAAŞ & MESAİ DÖKÜMÜ`]);
    worksheet.getRow(1).font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
    worksheet.addRow([`Personel: ${employee.fullName}`, `Görev: ${employee.position || '-'}`, `Maaş: ${employee.salary} TL`, `Rapor Tarihi: ${formatDate(new Date())}`]);
    worksheet.getRow(2).font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
    worksheet.addRow([]);

    const headerRow = worksheet.addRow(['Tarih', 'Hareket Türü', 'Açıklama', 'Ödeme Kanalı', 'Hakediş / Mesai (+)', 'Ödenen / Avans (-)']);
    worksheet.columns = [{ key: 'date', width: 16 }, { key: 'type', width: 22 }, { key: 'desc', width: 34 }, { key: 'method', width: 18 }, { key: 'accrual', width: 20 }, { key: 'paid', width: 20 }];
    headerRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

    (employee.payments || []).forEach(p => {
      const isAdd = p.type === 'SALARY_ACCRUAL' || p.type === 'BONUS' || p.type === 'TERMINATION_SETTLEMENT' || p.type === 'OVERTIME_ACCRUAL';
      let typeText = 'Ödeme Yapıldı';
      if (p.type === 'SALARY_ACCRUAL') typeText = 'Maaş Hak Edişi';
      else if (p.type === 'OVERTIME_ACCRUAL') typeText = 'Fazla Mesai Hakedişi';
      else if (p.type === 'OVERTIME_PAYMENT') typeText = 'Günlük Mesai Ödendi';
      else if (p.type === 'TERMINATION_SETTLEMENT') typeText = 'Çıkış / Tazminat';
      else if (p.type === 'SALARY_PAYMENT') typeText = 'Maaş Ödendi';
      else if (p.type === 'ADVANCE') typeText = 'Avans Verildi';
      else if (p.type === 'BONUS') typeText = 'Prim';
      else if (p.type === 'DEDUCTION') typeText = 'Kesinti';

      const row = worksheet.addRow({
        date: formatDate(p.date),
        type: typeText,
        desc: p.description || '-',
        method: p.paymentMethod === 'BANK' ? 'Banka' : 'Nakit',
        accrual: isAdd ? p.amount : 0,
        paid: !isAdd ? p.amount : 0,
      });
      row.getCell(5).numFmt = '#,##0.00 "₺"';
      row.getCell(6).numFmt = '#,##0.00 "₺"';
    });

    const totalRow = worksheet.addRow(['GÜNCEL KALAN MAAŞ BORCU', '', '', '', employee.balance, '']);
    totalRow.font = { name: 'Segoe UI', size: 11, bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    totalRow.getCell(5).numFmt = '#,##0.00 "₺"';

    const buffer = await workbook.xlsx.writeBuffer();
    this.downloadFile(buffer, `${employee.fullName}_Maas_Mesai_Dokumu_${new Date().toISOString().split('T')[0]}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  },

  // Tekil Müşteri ve Toptancı Raporları
  exportSingleSupplierStatementPdf(supplier: Supplier) {
    const company = dataService.getCompanySettings();
    const today = formatDate(new Date());
    const printWindow = window.open('', '_blank', 'width=900,height=750');
    if (!printWindow) return alert('Yazdırma penceresi açılamadı');
    const logoHtml = company.logoBase64 ? `<img src="${company.logoBase64}" style="max-height: 60px; max-width: 140px; object-fit: contain; margin-right: 15px;" />` : '';
    let totalPurchase = 0; let totalPaid = 0;
    (supplier.transactions || []).forEach(t => { if (t.type === 'PURCHASE') totalPurchase += t.amount; else totalPaid += t.amount; });

    const txRows = (!supplier.transactions || supplier.transactions.length === 0)
      ? `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #94a3b8;">Hareket kaydı bulunmamaktadır.</td></tr>`
      : supplier.transactions.map((t, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${formatDate(t.date)}</td>
            <td class="font-bold ${t.type==='PURCHASE'?'text-rose':'text-emerald'}">${t.type==='PURCHASE'?'+ Mal Alışı':'- Ödeme Yapıldı'}</td>
            <td style="font-family: monospace;">${t.documentNumber || '-'}</td>
            <td>${t.description || '-'} ${t.dueDate ? `<br><small style="color:#d97706;font-weight:bold;">Vade: ${formatDate(t.dueDate)}</small>` : ''}</td>
            <td>${t.paymentMethod === 'CHECK' ? 'Çek' : t.paymentMethod === 'CREDIT_CARD' ? 'Kredi Kartı' : t.paymentMethod === 'BANK' ? 'Banka' : t.paymentMethod === 'CASH' ? 'Nakit' : '-'}</td>
            <td class="text-right font-bold ${t.type==='PURCHASE'?'text-rose':'text-emerald'}">${t.type==='PURCHASE'?'+':'-'}${formatCurrency(t.amount)}</td>
          </tr>
        `).join('');

    const html = `
      <!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${supplier.name} - Toptancı Ekstresi</title>
      <style>body { font-family: 'Segoe UI', sans-serif; padding: 25px; color: #1e293b; } .header { border-bottom: 2px solid #e11d48; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; } .brand-box { display: flex; align-items: center; } .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 18px; display: flex; justify-content: space-between; font-size: 12px; } table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; } th { background: #1e293b; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; } td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; } .text-right { text-align: right; } .font-bold { font-weight: bold; } .text-rose { color: #e11d48; } .text-emerald { color: #059669; } .summary-container { margin-top: 20px; display: flex; justify-content: space-between; } .signature-box { width: 45%; display: flex; justify-content: space-between; margin-top: 25px; font-size: 11px; text-align: center; } .sign-line { border-top: 1px dashed #94a3b8; width: 130px; margin-top: 40px; } .total-box { width: 290px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; font-size: 12px; } .total-row { display: flex; justify-content: space-between; margin-bottom: 4px; } .footer-note { clear: both; margin-top: 40px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; } @media print { body { padding: 0; } }</style></head>
      <body>
        <div class="header"><div class="brand-box">${logoHtml}<div><h1 style="margin:0;font-size:18px;font-weight:900;">${company.companyName.toUpperCase()}</h1><div style="font-size:11px;color:#64748b;">Toptancı & Tedarikçi Cari Hesap Ekstresi</div></div></div><div style="text-align:right;font-size:11px;color:#475569;"><div>Tarih: <strong>${today}</strong></div></div></div>
        <div class="info-card"><div><div>Toptancı: <strong>${supplier.name}</strong></div><div>Kategori: <strong>${supplier.category}</strong> | Tel: ${supplier.phone || '-'}</div></div><div style="text-align:right;"><div style="color:#64748b;font-size:11px;">Kayıt: ${formatDate(supplier.createdAt)}</div><div style="margin-top:4px;font-size:13px;font-weight:800;" class="${supplier.balance > 0 ? 'text-rose' : 'text-emerald'}">Kalan Borç: ${formatCurrency(supplier.balance)}</div></div></div>
        <table><thead><tr><th>#</th><th>Tarih</th><th>İşlem Türü</th><th>Belge No</th><th>Açıklama & Vade</th><th>Ödeme Kanalı</th><th class="text-right">Tutar</th></tr></thead>
        <tbody>${txRows}</tbody></table>
        <div class="summary-container"><div class="signature-box"><div><strong>Toptancı / Teslim Eden</strong><div class="sign-line">İmza / Kaşe</div></div><div><strong>İşletme Yetkilisi</strong><div class="sign-line">İmza</div></div></div><div class="total-box"><div class="total-row"><span>Toplam Mal Alışı:</span><span class="font-bold text-rose">${formatCurrency(totalPurchase)}</span></div><div class="total-row"><span>Toplam Yapılan Ödeme:</span><span class="font-bold text-emerald">${formatCurrency(totalPaid)}</span></div><div class="total-row" style="margin-top:6px;padding-top:6px;border-top:1px solid #cbd5e1;font-size:13px;font-weight:800;"><span>KALAN BORCUMUZ:</span><span class="${supplier.balance>0?'text-rose':'text-emerald'}">${formatCurrency(supplier.balance)}</span></div></div></div>
        <div class="footer-note"><span>Bu döküm <strong>RYMedya Özel ERP Altyapısı</strong> ile Gaziantepli Taha Usta için üretilmiştir.</span><span>© 2026 RYMedya</span></div>
        <script>window.onload = function() { window.print(); };</script>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  },

  async exportSingleSupplierStatementExcel(supplier: Supplier) {
    const company = dataService.getCompanySettings();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = company.companyName;
    const worksheet = workbook.addWorksheet(`${supplier.name.substring(0, 25)} Ekstresi`);
    worksheet.addRow([`${company.companyName.toUpperCase()} - TOPTANCI CARİ EKSTRESİ`]);
    worksheet.getRow(1).font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
    worksheet.addRow([`Toptancı: ${supplier.name}`, `Kategori: ${supplier.category}`, `Tel: ${supplier.phone || '-'}`, `Rapor Tarihi: ${formatDate(new Date())}`]);
    worksheet.getRow(2).font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
    worksheet.addRow([]);
    const headerRow = worksheet.addRow(['Tarih', 'İşlem Türü', 'Belge No', 'Açıklama & Vade', 'Ödeme Kanalı', 'Mal Alışı (+Borç)', 'Yapılan Ödeme (-Borç)']);
    worksheet.columns = [{ key: 'date', width: 16 }, { key: 'type', width: 20 }, { key: 'doc', width: 22 }, { key: 'desc', width: 34 }, { key: 'method', width: 18 }, { key: 'purchase', width: 20 }, { key: 'paid', width: 20 }];
    headerRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

    (supplier.transactions || []).forEach(t => {
      const isPurchase = t.type === 'PURCHASE';
      const row = worksheet.addRow({
        date: formatDate(t.date),
        type: isPurchase ? 'Mal Alışı (Borç)' : 'Ödeme Yapıldı',
        doc: t.documentNumber || '-',
        desc: `${t.description || '-'} ${t.dueDate ? `(Vade: ${formatDate(t.dueDate)})` : ''}`,
        method: t.paymentMethod === 'CHECK' ? 'Çek' : t.paymentMethod === 'CREDIT_CARD' ? 'Kredi Kartı' : t.paymentMethod === 'BANK' ? 'Banka' : t.paymentMethod === 'CASH' ? 'Nakit' : '-',
        purchase: isPurchase ? t.amount : 0,
        paid: !isPurchase ? t.amount : 0,
      });
      row.getCell(6).numFmt = '#,##0.00 "₺"';
      row.getCell(7).numFmt = '#,##0.00 "₺"';
    });

    const totalRow = worksheet.addRow(['TOPTANCIYA KALAN BORCUMUZ', '', '', '', '', supplier.balance, '']);
    totalRow.font = { name: 'Segoe UI', size: 11, bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    totalRow.getCell(6).numFmt = '#,##0.00 "₺"';

    const buffer = await workbook.xlsx.writeBuffer();
    this.downloadFile(buffer, `${supplier.name}_Toptanci_Ekstre_${new Date().toISOString().split('T')[0]}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  },

  async exportSuppliersExcel(suppliers: Supplier[], totalDebt: number, dateRange?: DateRange) {
    const company = dataService.getCompanySettings();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = `${company.companyName} (RYMedya)`;
    const worksheet = workbook.addWorksheet('Toptancı Borç Listesi');
    worksheet.addRow([`${company.companyName.toUpperCase()} - TOPTANCI & TEDARİKÇİ BORÇ RAPORU`]);
    worksheet.getRow(1).font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
    const periodText = dateRange?.startDate && dateRange?.endDate ? `Rapor Dönemi: ${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}` : 'Rapor Dönemi: Tüm Zamanlar';
    worksheet.addRow([periodText, '', '', '', `Rapor Tarihi: ${formatDate(new Date())}`]);
    worksheet.getRow(2).font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
    worksheet.addRow([]);
    const headerRow = worksheet.addRow(['Toptancı Ünvanı', 'Kategori', 'Telefon', 'Yetkili', 'Kalan Borç (TL)', 'Durum']);
    worksheet.columns = [{ key: 'name', width: 32 }, { key: 'category', width: 24 }, { key: 'phone', width: 18 }, { key: 'contact', width: 20 }, { key: 'balance', width: 26 }, { key: 'status', width: 16 }];
    headerRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    suppliers.forEach(s => {
      const row = worksheet.addRow({ name: s.name, category: s.category, phone: s.phone || '-', contact: s.contactPerson || '-', balance: s.balance, status: s.balance > 0 ? 'Borçlu' : 'Kapandı' });
      row.getCell(5).numFmt = '#,##0.00 "₺"';
      if (s.balance > 0) row.getCell(5).font = { color: { argb: 'FFE11D48' }, bold: true };
    });
    const totalRow = worksheet.addRow(['TOPLAM TOPTANCI BORCU', '', '', '', totalDebt, `${suppliers.length} Toptancı`]);
    totalRow.font = { name: 'Segoe UI', size: 11, bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    totalRow.getCell(5).numFmt = '#,##0.00 "₺"';
    const buffer = await workbook.xlsx.writeBuffer();
    this.downloadFile(buffer, `${company.companyName}_Toptanci_Borc_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  },

  exportSuppliersPdf(suppliers: Supplier[], totalDebt: number, dateRange?: DateRange) {
    const company = dataService.getCompanySettings();
    const today = formatDate(new Date());
    const periodText = dateRange?.startDate && dateRange?.endDate ? `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}` : 'Tüm Zamanlar';
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return alert('Yazdırma penceresi açılamadı');
    const logoHtml = company.logoBase64 ? `<img src="${company.logoBase64}" style="max-height: 55px; max-width: 140px; object-fit: contain; margin-right: 15px;" />` : '';
    const html = `
      <!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${company.companyName} - Toptancı Borç Raporu</title>
      <style>body { font-family: 'Segoe UI', sans-serif; padding: 25px; color: #1e293b; } .header { border-bottom: 2px solid #e11d48; padding-bottom: 12px; display: flex; justify-content: space-between; align-items: center; } .brand-box { display: flex; align-items: center; } table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; } th { background: #1e293b; color: #ffffff; text-align: left; padding: 8px 10px; } td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; } .total-box { margin-top: 25px; float: right; width: 320px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; } @media print { body { padding: 0; } }</style></head>
      <body>
        <div class="header"><div class="brand-box">${logoHtml}<div><h1 style="margin:0;font-size:18px;">${company.companyName.toUpperCase()}</h1><div style="font-size:11px;color:#64748b;">Toptancı & Tedarikçi Borç Raporu</div></div></div><div>Dönem: ${periodText}</div></div>
        <table><thead><tr><th>#</th><th>Toptancı</th><th>Kategori</th><th>Telefon</th><th>Yetkili</th><th style="text-align:right;">Kalan Borç</th></tr></thead>
        <tbody>${suppliers.map((s, i) => `<tr><td>${i+1}</td><td><b>${s.name}</b></td><td>${s.category}</td><td>${s.phone||'-'}</td><td>${s.contactPerson||'-'}</td><td style="text-align:right;color:#e11d48;font-weight:bold;">${formatCurrency(s.balance)}</td></tr>`).join('')}</tbody></table>
        <div class="total-box"><b>TOPLAM BORÇ: <span style="color:#e11d48;">${formatCurrency(totalDebt)}</span></b></div>
        <script>window.onload = function() { window.print(); };</script>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  },

  exportSingleCustomerStatementPdf(customer: Customer) {
    const company = dataService.getCompanySettings();
    const today = formatDate(new Date());
    const printWindow = window.open('', '_blank', 'width=900,height=750');
    if (!printWindow) return alert('Yazdırma penceresi açılamadı');
    const logoHtml = company.logoBase64 ? `<img src="${company.logoBase64}" style="max-height: 60px; max-width: 140px; object-fit: contain; margin-right: 15px;" />` : '';
    let totalDebt = 0; let totalCollection = 0;
    (customer.transactions || []).forEach(t => { if (t.type === 'DEBT') totalDebt += t.amount; else totalCollection += t.amount; });
    const txRows = (!customer.transactions || customer.transactions.length === 0)
      ? `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #94a3b8;">Hareket kaydı bulunmamaktadır.</td></tr>`
      : customer.transactions.map((t, i) => `<tr><td>${i+1}</td><td>${formatDate(t.date)}</td><td class="font-bold ${t.type==='DEBT'?'text-rose':'text-emerald'}">${t.type==='DEBT'?'+ Borçlandırma':'- Tahsilat'}</td><td>${t.description||'-'}</td><td>${t.paymentMethod==='BANK'?'Banka':t.paymentMethod==='CREDIT_CARD'?'Kredi Kartı':'Nakit'}</td><td class="text-right font-bold ${t.type==='DEBT'?'text-rose':'text-emerald'}">${t.type==='DEBT'?'+':'-'}${formatCurrency(t.amount)}</td></tr>`).join('');
    const html = `
      <!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${customer.name} - Müşteri Ekstresi</title>
      <style>body { font-family: 'Segoe UI', sans-serif; padding: 25px; color: #1e293b; } .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; display: flex; justify-content: space-between; align-items: center; } .brand-box { display: flex; align-items: center; } .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 18px; display: flex; justify-content: space-between; font-size: 12px; } table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; } th { background: #1e293b; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; } td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; } .text-right { text-align: right; } .font-bold { font-weight: bold; } .text-rose { color: #e11d48; } .text-emerald { color: #059669; } .summary-container { margin-top: 20px; display: flex; justify-content: space-between; } .signature-box { width: 45%; display: flex; justify-content: space-between; margin-top: 25px; font-size: 11px; text-align: center; } .sign-line { border-top: 1px dashed #94a3b8; width: 130px; margin-top: 40px; } .total-box { width: 280px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; } .total-row { display: flex; justify-content: space-between; margin-bottom: 4px; } .footer-note { clear: both; margin-top: 40px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; } @media print { body { padding: 0; } }</style></head>
      <body>
        <div class="header"><div class="brand-box">${logoHtml}<div><h1 style="margin:0;font-size:18px;font-weight:900;">${company.companyName.toUpperCase()}</h1><div style="font-size:11px;color:#64748b;">Müşteri Cari Hesap Ekstresi</div></div></div><div style="text-align:right;font-size:11px;color:#475569;"><div>Tarih: <strong>${today}</strong></div></div></div>
        <div class="info-card"><div><div>Müşteri: <strong>${customer.name}</strong></div><div>Telefon: <strong>${customer.phone || '-'}</strong></div>${customer.notes ? `<div>Adres: ${customer.notes}</div>` : ''}</div><div style="text-align:right;"><div style="color:#64748b;font-size:11px;">Kayıt: ${formatDate(customer.createdAt)}</div><div style="margin-top:4px;font-size:13px;font-weight:800;" class="${customer.balance > 0 ? 'text-rose' : 'text-emerald'}">Bakiye: ${formatCurrency(customer.balance)}</div></div></div>
        <table><thead><tr><th>#</th><th>Tarih</th><th>İşlem Türü</th><th>Açıklama</th><th>Kanal</th><th class="text-right">Tutar</th></tr></thead>
        <tbody>${txRows}</tbody></table>
        <div class="summary-container"><div class="signature-box"><div><strong>Teslim Eden</strong><div class="sign-line">İmza</div></div><div><strong>Teslim Alan</strong><div class="sign-line">İmza</div></div></div><div class="total-box"><div class="total-row"><span>Toplam Borç:</span><span class="font-bold text-rose">${formatCurrency(totalDebt)}</span></div><div class="total-row"><span>Toplam Tahsilat:</span><span class="font-bold text-emerald">${formatCurrency(totalCollection)}</span></div><div class="total-row" style="margin-top:6px;padding-top:6px;border-top:1px solid #cbd5e1;font-size:13px;font-weight:800;"><span>KALAN BAKİYE:</span><span class="${customer.balance>0?'text-rose':'text-emerald'}">${formatCurrency(customer.balance)}</span></div></div></div>
        <div class="footer-note"><span>Bu döküm <strong>RYMedya Özel ERP Altyapısı</strong> ile Gaziantepli Taha Usta için üretilmiştir.</span><span>© 2026 RYMedya</span></div>
        <script>window.onload = function() { window.print(); };</script>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  },

  async exportSingleCustomerStatementExcel(customer: Customer) {
    const company = dataService.getCompanySettings();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = company.companyName;
    const worksheet = workbook.addWorksheet(`${customer.name.substring(0, 25)} Ekstresi`);
    worksheet.addRow([`${company.companyName.toUpperCase()} - MÜŞTERİ HESAP EKSTRESİ`]);
    worksheet.getRow(1).font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
    worksheet.addRow([`Müşteri: ${customer.name}`, `Telefon: ${customer.phone || '-'}`, `Rapor Tarihi: ${formatDate(new Date())}`]);
    worksheet.getRow(2).font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
    worksheet.addRow([]);
    const headerRow = worksheet.addRow(['Tarih', 'İşlem Türü', 'Açıklama', 'Ödeme Kanalı', 'Borç Tutarı (+)', 'Tahsilat Tutarı (-)']);
    worksheet.columns = [{ key: 'date', width: 16 }, { key: 'type', width: 18 }, { key: 'desc', width: 34 }, { key: 'method', width: 18 }, { key: 'debt', width: 20 }, { key: 'coll', width: 20 }];
    headerRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    (customer.transactions || []).forEach(t => {
      const isDebt = t.type === 'DEBT';
      const row = worksheet.addRow({ date: formatDate(t.date), type: isDebt ? 'Borç Eklendi' : 'Tahsilat Alındı', desc: t.description || '-', method: t.paymentMethod === 'BANK' ? 'Banka' : t.paymentMethod === 'CREDIT_CARD' ? 'Kredi Kartı' : 'Nakit', debt: isDebt ? t.amount : 0, coll: !isDebt ? t.amount : 0 });
      row.getCell(5).numFmt = '#,##0.00 "₺"'; row.getCell(6).numFmt = '#,##0.00 "₺"';
    });
    const totalRow = worksheet.addRow(['GÜNCEL KALAN BAKİYE', '', '', '', customer.balance, '']);
    totalRow.font = { name: 'Segoe UI', size: 11, bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    totalRow.getCell(5).numFmt = '#,##0.00 "₺"';
    const buffer = await workbook.xlsx.writeBuffer();
    this.downloadFile(buffer, `${customer.name}_Ekstre_${new Date().toISOString().split('T')[0]}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  },

  async exportCustomersExcel(customers: Customer[], totalBalance: number, dateRange?: DateRange) {
    const company = dataService.getCompanySettings();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = company.companyName;
    const worksheet = workbook.addWorksheet('Müşteri Alacak Listesi');
    worksheet.addRow([`${company.companyName.toUpperCase()} - MÜŞTERİ ALACAK & BORÇ RAPORU`]);
    worksheet.getRow(1).font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
    const periodText = dateRange?.startDate && dateRange?.endDate ? `Rapor Dönemi: ${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}` : 'Rapor Dönemi: Tüm Zamanlar';
    worksheet.addRow([periodText, '', '', '', `Rapor Tarihi: ${formatDate(new Date())}`]);
    worksheet.getRow(2).font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
    worksheet.addRow([]);
    const headerRow = worksheet.addRow(['Müşteri Adı', 'Telefon', 'E-Posta', 'Kayıt Tarihi', 'Kalan Borç (TL)', 'Durum']);
    worksheet.columns = [{ key: 'name', width: 32 }, { key: 'phone', width: 18 }, { key: 'email', width: 28 }, { key: 'createdAt', width: 16 }, { key: 'balance', width: 26 }, { key: 'status', width: 16 }];
    headerRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    customers.forEach((c) => {
      const row = worksheet.addRow({ name: c.name, phone: c.phone || '-', email: c.email || '-', createdAt: formatDate(c.createdAt), balance: c.balance, status: c.balance > 0 ? 'Borçlu' : 'Bakiye Sıfır' });
      row.getCell(5).numFmt = '#,##0.00 "₺"';
      if (c.balance > 0) row.getCell(5).font = { color: { argb: 'FFE11D48' }, bold: true };
    });
    const totalRow = worksheet.addRow(['GENEL TOPLAM ALACAK', '', '', '', totalBalance, `${customers.length} Müşteri`]);
    totalRow.font = { name: 'Segoe UI', size: 11, bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    totalRow.getCell(5).numFmt = '#,##0.00 "₺"';
    const buffer = await workbook.xlsx.writeBuffer();
    this.downloadFile(buffer, `${company.companyName}_Musteri_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  },

  exportCustomersPdf(customers: Customer[], totalBalance: number, dateRange?: DateRange) {
    const company = dataService.getCompanySettings();
    const today = formatDate(new Date());
    const periodText = dateRange?.startDate && dateRange?.endDate ? `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}` : 'Tüm Zamanlar';
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return alert('Yazdırma penceresi açılamadı');
    const logoHtml = company.logoBase64 ? `<img src="${company.logoBase64}" style="max-height: 55px; max-width: 140px; object-fit: contain; margin-right: 15px;" />` : '';
    const html = `
      <!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${company.companyName} - Müşteri Alacak Raporu</title>
      <style>body { font-family: 'Segoe UI', sans-serif; padding: 25px; color: #1e293b; } .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; display: flex; justify-content: space-between; align-items: center; } .brand-box { display: flex; align-items: center; } table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; } th { background: #1e293b; color: #ffffff; text-align: left; padding: 8px 10px; } td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; } .total-box { margin-top: 25px; float: right; width: 320px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; } @media print { body { padding: 0; } }</style></head>
      <body>
        <div class="header"><div class="brand-box">${logoHtml}<div><h1 style="margin:0;font-size:18px;">${company.companyName.toUpperCase()}</h1><div style="font-size:11px;color:#64748b;">Müşteri Alacak & Borç Raporu</div></div></div><div>Dönem: ${periodText}</div></div>
        <table><thead><tr><th>#</th><th>Müşteri</th><th>Telefon</th><th>Adres/Not</th><th style="text-align:right;">Bakiye</th></tr></thead>
        <tbody>${customers.map((c, i) => `<tr><td>${i+1}</td><td><b>${c.name}</b></td><td>${c.phone||'-'}</td><td>${c.notes||'-'}</td><td style="text-align:right;color:#e11d48;font-weight:bold;">${formatCurrency(c.balance)}</td></tr>`).join('')}</tbody></table>
        <div class="total-box"><b>TOPLAM ALACAK: <span style="color:#e11d48;">${formatCurrency(totalBalance)}</span></b></div>
        <script>window.onload = function() { window.print(); };</script>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  },

  async exportEmployeesExcel(employees: Employee[], totalBalance: number, dateRange?: DateRange) {
    const company = dataService.getCompanySettings();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = company.companyName;
    const worksheet = workbook.addWorksheet('Personel Maaş Listesi');
    worksheet.addRow([`${company.companyName.toUpperCase()} - PERSONEL MAAŞ & ÖDEME RAPORU`]);
    worksheet.getRow(1).font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
    const periodText = dateRange?.startDate && dateRange?.endDate ? `Rapor Dönemi: ${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}` : 'Rapor Dönemi: Tüm Zamanlar';
    worksheet.addRow([periodText, '', '', '', '', `Rapor Tarihi: ${formatDate(new Date())}`]);
    worksheet.getRow(2).font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
    worksheet.addRow([]);
    const headerRow = worksheet.addRow(['Personel Ad Soyad', 'Görevi', 'Telefon', 'IBAN', 'Sabit Maaş (TL)', 'Kalan Borç (TL)']);
    worksheet.columns = [{ key: 'fullName', width: 28 }, { key: 'position', width: 24 }, { key: 'phone', width: 18 }, { key: 'iban', width: 34 }, { key: 'salary', width: 22 }, { key: 'balance', width: 26 }];
    headerRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    employees.forEach((e) => {
      const row = worksheet.addRow({ fullName: e.fullName, position: e.position || '-', phone: e.phone || '-', iban: e.iban || '-', salary: e.salary, balance: e.balance });
      row.getCell(5).numFmt = '#,##0.00 "₺"';
      row.getCell(6).numFmt = '#,##0.00 "₺"';
      if (e.balance > 0) row.getCell(6).font = { color: { argb: 'FFE11D48' }, bold: true };
    });
    const totalRow = worksheet.addRow(['GENEL TOPLAM PERSONEL BORCU', '', '', '', '', totalBalance]);
    totalRow.font = { name: 'Segoe UI', size: 11, bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    totalRow.getCell(6).numFmt = '#,##0.00 "₺"';
    const buffer = await workbook.xlsx.writeBuffer();
    this.downloadFile(buffer, `${company.companyName}_Personel_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  },

  exportEmployeesPdf(employees: Employee[], totalBalance: number, dateRange?: DateRange) {
    const company = dataService.getCompanySettings();
    const today = formatDate(new Date());
    const periodText = dateRange?.startDate && dateRange?.endDate ? `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}` : 'Tüm Zamanlar';
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return alert('Yazdırma penceresi açılamadı');
    const logoHtml = company.logoBase64 ? `<img src="${company.logoBase64}" style="max-height: 55px; max-width: 140px; object-fit: contain; margin-right: 15px;" />` : '';
    const html = `
      <!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${company.companyName} - Personel Maaş Raporu</title>
      <style>body { font-family: 'Segoe UI', sans-serif; padding: 25px; color: #1e293b; } .header { border-bottom: 2px solid #4f46e5; padding-bottom: 12px; display: flex; justify-content: space-between; align-items: center; } .brand-box { display: flex; align-items: center; } table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; } th { background: #1e293b; color: #ffffff; text-align: left; padding: 8px 10px; } td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; } .total-box { margin-top: 25px; float: right; width: 330px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; } @media print { body { padding: 0; } }</style></head>
      <body>
        <div class="header"><div class="brand-box">${logoHtml}<div><h1 style="margin:0;font-size:18px;">${company.companyName.toUpperCase()}</h1><div style="font-size:11px;color:#64748b;">Personel Maaş & Ödeme Raporu</div></div></div><div>Dönem: ${periodText}</div></div>
        <table><thead><tr><th>#</th><th>Personel</th><th>Görev</th><th>Maaş</th><th style="text-align:right;">Kalan Borç</th></tr></thead>
        <tbody>${employees.map((e, i) => `<tr><td>${i+1}</td><td><b>${e.fullName}</b></td><td>${e.position||'-'}</td><td>${formatCurrency(e.salary)}</td><td style="text-align:right;color:#e11d48;font-weight:bold;">${formatCurrency(e.balance)}</td></tr>`).join('')}</tbody></table>
        <div class="total-box"><b>TOPLAM MAAŞ BORCU: <span style="color:#e11d48;">${formatCurrency(totalBalance)}</span></b></div>
        <script>window.onload = function() { window.print(); };</script>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  },

  async exportExpensesExcel(expenses: Expense[], totalAmount: number, dateRange?: DateRange) {
    const company = dataService.getCompanySettings();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = company.companyName;
    const worksheet = workbook.addWorksheet('Gider Listesi');
    worksheet.addRow([`${company.companyName.toUpperCase()} - İŞLETME GİDER & HARCAMA RAPORU`]);
    worksheet.getRow(1).font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
    const periodText = dateRange?.startDate && dateRange?.endDate ? `Rapor Dönemi: ${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}` : 'Rapor Dönemi: Tüm Zamanlar';
    worksheet.addRow([periodText, '', '', '', `Rapor Tarihi: ${formatDate(new Date())}`]);
    worksheet.getRow(2).font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
    worksheet.addRow([]);
    const headerRow = worksheet.addRow(['Tarih', 'Gider / Malzeme Adı', 'Kategori', 'Tedarikçi / Yer', 'Ödeme Kanalı', 'Tutar (TL)']);
    worksheet.columns = [{ key: 'date', width: 16 }, { key: 'title', width: 30 }, { key: 'cat', width: 24 }, { key: 'supp', width: 24 }, { key: 'method', width: 20 }, { key: 'amount', width: 22 }];
    headerRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    expenses.forEach(exp => {
      const row = worksheet.addRow({ date: formatDate(exp.date), title: exp.title, cat: exp.category, supp: exp.supplierName || exp.supplier || '-', method: exp.paymentMethod === 'CASH' ? 'Nakit' : exp.paymentMethod === 'CREDIT_CARD' ? 'Kredi Kartı' : 'Banka', amount: exp.amount });
      row.getCell(6).numFmt = '#,##0.00 "₺"';
      row.getCell(6).font = { color: { argb: 'FFE11D48' }, bold: true };
    });
    const totalRow = worksheet.addRow(['TOPLAM İŞLETME GİDERİ', '', '', '', `${expenses.length} Harcama`, totalAmount]);
    totalRow.font = { name: 'Segoe UI', size: 11, bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    totalRow.getCell(6).numFmt = '#,##0.00 "₺"';
    const buffer = await workbook.xlsx.writeBuffer();
    this.downloadFile(buffer, `${company.companyName}_Gider_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  },

  exportExpensesPdf(expenses: Expense[], totalAmount: number, dateRange?: DateRange) {
    const company = dataService.getCompanySettings();
    const today = formatDate(new Date());
    const periodText = dateRange?.startDate && dateRange?.endDate ? `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}` : 'Tüm Zamanlar';
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return alert('Yazdırma penceresi açılamadı');
    const logoHtml = company.logoBase64 ? `<img src="${company.logoBase64}" style="max-height: 55px; max-width: 140px; object-fit: contain; margin-right: 15px;" />` : '';
    const html = `
      <!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${company.companyName} - Gider Raporu</title>
      <style>body { font-family: 'Segoe UI', sans-serif; padding: 25px; color: #1e293b; } .header { border-bottom: 2px solid #e11d48; padding-bottom: 12px; display: flex; justify-content: space-between; align-items: center; } .brand-box { display: flex; align-items: center; } table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; } th { background: #1e293b; color: #ffffff; text-align: left; padding: 8px 10px; } td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; } .total-box { margin-top: 25px; float: right; width: 320px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; } @media print { body { padding: 0; } }</style></head>
      <body>
        <div class="header"><div class="brand-box">${logoHtml}<div><h1 style="margin:0;font-size:18px;">${company.companyName.toUpperCase()}</h1><div style="font-size:11px;color:#64748b;">İşletme Gider & Harcama Raporu</div></div></div><div>Dönem: ${periodText}</div></div>
        <table><thead><tr><th>#</th><th>Tarih</th><th>Gider / Malzeme</th><th>Kategori</th><th>Tedarikçi</th><th>Kanal</th><th style="text-align:right;">Tutar</th></tr></thead>
        <tbody>${expenses.map((exp, i) => `<tr><td>${i+1}</td><td>${formatDate(exp.date)}</td><td><b>${exp.title}</b></td><td>${exp.category}</td><td>${exp.supplierName||exp.supplier||'-'}</td><td>${exp.paymentMethod==='CASH'?'Nakit':exp.paymentMethod==='CREDIT_CARD'?'Kredi Kartı':'Banka'}</td><td style="text-align:right;color:#e11d48;font-weight:bold;">${formatCurrency(exp.amount)}</td></tr>`).join('')}</tbody></table>
        <div class="total-box"><b>TOPLAM GİDER: <span style="color:#e11d48;">${formatCurrency(totalAmount)}</span></b></div>
        <script>window.onload = function() { window.print(); };</script>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  },

  downloadFile(buffer: any, fileName: string, mimeType: string) {
    const blob = new Blob([buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
};