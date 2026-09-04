import React, { useState } from 'react';
import { 
  FileText, 
  Printer, 
  Save, 
  Check, 
  Copy, 
  Wifi, 
  Instagram, 
  ShieldCheck, 
  Sparkles,
  Sliders,
  RotateCcw
} from 'lucide-react';
import { ReceiptSettingsConfig, restaurantDataService } from '../../../services/restaurantDataService';
import { printerService } from '../../../services/printerService';
import { notify } from '../../../services/notificationService';

interface ReceiptTemplateTabProps {
  settings: ReceiptSettingsConfig;
  onSave: (updated: ReceiptSettingsConfig) => void;
}

export const ReceiptTemplateTab: React.FC<ReceiptTemplateTabProps> = ({ settings, onSave }) => {
  const [form, setForm] = useState<ReceiptSettingsConfig>({
    title: settings.title || 'GAZİANTEPLİ TAHA USTA',
    subtitle: settings.subtitle || 'Kebap & Lahmacun Salonu',
    phone: settings.phone || '0 (342) 555 00 27',
    address: settings.address || 'Şehitkamil / Gaziantep',
    taxNumber: settings.taxNumber || '1234567890',
    taxOffice: settings.taxOffice || 'Şehitkamil V.D.',
    mersisNo: settings.mersisNo || '012345678900001',
    wifiName: settings.wifiName || 'TahaUsta_Misafir',
    wifiPassword: settings.wifiPassword || 'anteplilezzetleri',
    instagram: settings.instagram || '@gazianteplitahausta',
    footerMessage: settings.footerMessage || 'Afiyet Olsun. Yine Bekleriz!',
    showWaiterName: settings.showWaiterName ?? true,
    showTableNumber: settings.showTableNumber ?? true,
    showVatDetails: settings.showVatDetails ?? true,
    showOrderTime: settings.showOrderTime ?? true,
    showBarcode: settings.showBarcode ?? true,
    printLogo: settings.printLogo ?? true,
    paperWidth: settings.paperWidth || 80,
  });

  const [copied, setCopied] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    notify.success('Adisyon Şablonu Kaydedildi', 'Termal yazıcı fiş tasarımı güncellendi.');
  };

  const handleTestThermalPrint = async () => {
    restaurantDataService.playAudioAlert('beep');
    const result = await printerService.printTestBill(form);
    setTimeout(() => {
      restaurantDataService.playAudioAlert('register');
    }, 250);
    if (result.success) {
      notify.success('Test Fişi İletildi', result.message || 'Varsayılan kasa yazıcısına test adisyonu gönderildi.');
    } else {
      notify.warning('Yazıcı Uyarısı', result.message);
    }
  };

  const handleCopyReceiptText = () => {
    const text = printerService.generatePlainTextReceipt('BILL', {
      settings: form,
      tableName: 'Ana Salon / Masa 4',
      waiterName: 'Mehmet Usta',
      orderTime: `${new Date().toLocaleDateString('tr-TR')} - 19:42`,
      orderNumber: 841,
      items: [
        { name: 'Adana Kebap (Porsiyon)', quantity: 1, price: 280, totalPrice: 280, note: 'Acılı, köz biberli' },
        { name: 'Lahmacun (Antep Usulü)', quantity: 2, price: 90, totalPrice: 180 },
        { name: 'Yayık Ayran (300ml)', quantity: 2, price: 40, totalPrice: 80 },
        { name: 'Antep Katmeri', quantity: 1, price: 160, totalPrice: 160 },
      ],
      subtotal: 700,
      discountAmount: 35,
      totalAmount: 665,
      vatBase: 604.55,
      vatAmount: 60.45,
    });
    navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    notify.info('Panoya Kopyalandı', 'Fiş metni panoya kopyalandı.');
  };

  return (
    <div className="space-y-6">
      {/* ÜST BİLGİ & AKSİYON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-sm">
        <div>
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#F5C877]" />
            <span>Fiş, Adisyon & Fatura Şablon Tasarımcısı</span>
          </h2>
          <p className="text-xs text-[#C4C4CC] mt-0.5">
            Termal kasa yazıcıları için başlık, logo, Wi-Fi bilgisi, KDV kırılımları ve canlı önizleme.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestThermalPrint}
            className="px-4 py-2.5 bg-[#141416] hover:bg-slate-800 text-[#FAF7F2] border border-[#383844] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-md"
          >
            <Printer className="w-3.5 h-3.5 text-[#F5C877]" />
            <span>Test Çıktısı Al</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2.5 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg cursor-pointer transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Şablonu Kaydet</span>
          </button>
        </div>
      </div>

      {/* İKİ KOLONLU DÜZEN: SOL AYARLAR FORMU, SAĞ TERMAL CANLI ÖNİZLEME */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SOL FORM (7 KOLON) */}
        <div className="lg:col-span-7 bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* 1. Kurumsal Bilgiler */}
            <div className="space-y-3">
              <span className="text-[11px] font-black uppercase text-[#C4C4CC] tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#F5C877]" /> İşletme Bilgileri & Başlık
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#C4C4CC]">Fiş Üst Başlığı (Firma Adı)</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#F5C877]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#C4C4CC]">Alt Başlık / Slogan</label>
                  <input
                    type="text"
                    value={form.subtitle}
                    onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#F5C877]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#C4C4CC]">Sipariş & Rezervasyon Telefonu</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#C4C4CC]">Adres & İlçe / İl</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 2. Mali & Resmi Bilgiler */}
            <div className="space-y-3 pt-3 border-t border-[#2C2C34]">
              <span className="text-[11px] font-black uppercase text-[#C4C4CC] tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Mali & Vergi Kimliği
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Vergi Dairesi</label>
                  <input
                    type="text"
                    value={form.taxOffice || ''}
                    onChange={(e) => setForm({ ...form, taxOffice: e.target.value })}
                    placeholder="Şehitkamil V.D."
                    className="w-full mt-1 p-2 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Vergi Kimlik No (VKN / TCKN)</label>
                  <input
                    type="text"
                    value={form.taxNumber}
                    onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
                    placeholder="1234567890"
                    className="w-full mt-1 p-2 bg-[#141416] border border-[#383844] rounded-xl text-xs font-mono font-bold text-amber-300"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">MERSİS No (Opsiyonel)</label>
                  <input
                    type="text"
                    value={form.mersisNo || ''}
                    onChange={(e) => setForm({ ...form, mersisNo: e.target.value })}
                    placeholder="012345678900001"
                    className="w-full mt-1 p-2 bg-[#141416] border border-[#383844] rounded-xl text-xs font-mono font-bold text-white"
                  />
                </div>
              </div>
            </div>

            {/* 3. Müşteri Kolaylıkları: Wi-Fi & Sosyal Medya */}
            <div className="space-y-3 pt-3 border-t border-[#2C2C34]">
              <span className="text-[11px] font-black uppercase text-[#C4C4CC] tracking-wider flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-sky-400" /> Müşteri Wi-Fi & Sosyal Medya
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Wi-Fi Ağ Adı (SSID)</label>
                  <input
                    type="text"
                    value={form.wifiName || ''}
                    onChange={(e) => setForm({ ...form, wifiName: e.target.value })}
                    placeholder="TahaUsta_Misafir"
                    className="w-full mt-1 p-2 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Wi-Fi Şifresi</label>
                  <input
                    type="text"
                    value={form.wifiPassword || ''}
                    onChange={(e) => setForm({ ...form, wifiPassword: e.target.value })}
                    placeholder="anteplilezzetleri"
                    className="w-full mt-1 p-2 bg-[#141416] border border-[#383844] rounded-xl text-xs font-mono font-bold text-sky-300"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Instagram Hesabı</label>
                  <input
                    type="text"
                    value={form.instagram || ''}
                    onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                    placeholder="@gazianteplitahausta"
                    className="w-full mt-1 p-2 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-pink-400"
                  />
                </div>
              </div>
            </div>

            {/* 4. Alt Mesaj & Teşekkür */}
            <div className="pt-3 border-t border-[#2C2C34]">
              <label className="text-xs font-bold text-[#C4C4CC]">Fiş Altı Kapanış & Teşekkür Mesajı</label>
              <input
                type="text"
                value={form.footerMessage}
                onChange={(e) => setForm({ ...form, footerMessage: e.target.value })}
                placeholder="Afiyet Olsun. Yine Bekleriz!"
                className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none"
              />
            </div>

            {/* 5. Baskı Anahtarları (Toggles) */}
            <div className="p-4 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#C4C4CC]">Kağıt Rulo Genişliği</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, paperWidth: 80 })}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      form.paperWidth === 80 
                        ? 'bg-[#F5C877] text-slate-950 shadow-md' 
                        : 'bg-[#1C1C20] text-[#A0A0AA] hover:text-white'
                    }`}
                  >
                    80 mm (Geniş)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, paperWidth: 58 })}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      form.paperWidth === 58 
                        ? 'bg-[#F5C877] text-slate-950 shadow-md' 
                        : 'bg-[#1C1C20] text-[#A0A0AA] hover:text-white'
                    }`}
                  >
                    58 mm (Kompakt)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#2C2C34]/80">
                <label className="flex items-center justify-between p-2 rounded-xl bg-[#1C1C20] cursor-pointer">
                  <span className="text-[11px] font-bold text-white">Masa Numarası & Salon Basılsın</span>
                  <input
                    type="checkbox"
                    checked={form.showTableNumber}
                    onChange={(e) => setForm({ ...form, showTableNumber: e.target.checked })}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded-xl bg-[#1C1C20] cursor-pointer">
                  <span className="text-[11px] font-bold text-white">Garson Adı Basılsın</span>
                  <input
                    type="checkbox"
                    checked={form.showWaiterName}
                    onChange={(e) => setForm({ ...form, showWaiterName: e.target.checked })}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded-xl bg-[#1C1C20] cursor-pointer">
                  <span className="text-[11px] font-bold text-white">Sipariş Tarihi ve Saati</span>
                  <input
                    type="checkbox"
                    checked={form.showOrderTime}
                    onChange={(e) => setForm({ ...form, showOrderTime: e.target.checked })}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded-xl bg-[#1C1C20] cursor-pointer">
                  <span className="text-[11px] font-bold text-white">KDV Dağılım Tablosu</span>
                  <input
                    type="checkbox"
                    checked={form.showVatDetails}
                    onChange={(e) => setForm({ ...form, showVatDetails: e.target.checked })}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded-xl bg-[#1C1C20] cursor-pointer">
                  <span className="text-[11px] font-bold text-white">Adisyon Takip Barkodu</span>
                  <input
                    type="checkbox"
                    checked={form.showBarcode}
                    onChange={(e) => setForm({ ...form, showBarcode: e.target.checked })}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded-xl bg-[#1C1C20] cursor-pointer">
                  <span className="text-[11px] font-bold text-white">Üst Kısımda Logo İkonu</span>
                  <input
                    type="checkbox"
                    checked={form.printLogo}
                    onChange={(e) => setForm({ ...form, printLogo: e.target.checked })}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 font-black text-xs rounded-xl shadow-lg cursor-pointer transition-all"
            >
              Şablon Yapılandırmasını Kaydet
            </button>
          </form>
        </div>

        {/* SAĞ KOLON: GERÇEKÇİ CANLI TERMAL FİŞ ÖNİZLEMESİ (5 KOLON) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-3 px-2">
            <span className="text-xs font-black text-[#C4C4CC] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#F5C877]" />
              Canlı Termal Fiş Önizlemesi ({form.paperWidth || 80}mm)
            </span>

            <button
              onClick={handleCopyReceiptText}
              className="text-[11px] text-[#A0A0AA] hover:text-white flex items-center gap-1 cursor-pointer bg-[#1C1C20] px-2.5 py-1 rounded-lg border border-[#2C2C34]"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Kopyalandı' : 'Metni Kopyala'}</span>
            </button>
          </div>

          {/* TERMAL KAĞIT RULOSU SİMÜLASYONU */}
          <div className={`w-full ${form.paperWidth === 58 ? 'max-w-[280px]' : 'max-w-[340px]'} bg-[#FAFAFA] text-slate-900 rounded-t-xl shadow-2xl p-6 font-mono text-[11px] leading-tight select-none border-t-8 border-slate-300 relative transition-all duration-300`}>
            
            {/* Tırtıklı üst görsel simülasyonu */}
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-400">
              {form.printLogo && (
                <div className="w-8 h-8 mx-auto bg-slate-900 text-[#F5C877] rounded-full flex items-center justify-center font-black text-sm mb-1">
                  TU
                </div>
              )}
              <div className="font-black text-xs tracking-wider uppercase text-slate-950">{form.title}</div>
              <div className="text-[10px] text-slate-600 font-bold">{form.subtitle}</div>
              <div className="text-[9px] text-slate-600">{form.address}</div>
              <div className="text-[9px] text-slate-600">Tel: {form.phone}</div>
              <div className="text-[8.5px] text-slate-500 pt-0.5">
                {form.taxOffice} • VKN: {form.taxNumber}
                {form.mersisNo ? ` • MERSİS: ${form.mersisNo}` : ''}
              </div>
            </div>

            {/* Masa, Garson ve Tarih */}
            <div className="py-2.5 space-y-0.5 border-b border-dashed border-slate-400 text-[10px]">
              {form.showTableNumber && (
                <div className="flex justify-between font-bold">
                  <span>MASA:</span>
                  <span className="text-slate-950 font-black">Ana Salon / Masa 4</span>
                </div>
              )}
              {form.showWaiterName && (
                <div className="flex justify-between text-slate-700">
                  <span>GARSON:</span>
                  <span>Mehmet Usta</span>
                </div>
              )}
              {form.showOrderTime && (
                <div className="flex justify-between text-slate-600 text-[9px]">
                  <span>TARİH & SAAT:</span>
                  <span>{new Date().toLocaleDateString('tr-TR')} - 19:42</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600 text-[9px]">
                <span>ADİSYON NO:</span>
                <span className="font-bold">#GTU-2026-0841</span>
              </div>
            </div>

            {/* Kalem Kalem Ürünler Tablosu */}
            <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1.5">
              <div className="flex justify-between font-black text-[9.5px] text-slate-500 pb-1 border-b border-slate-200">
                <span>ÜRÜN AÇIKLAMASI</span>
                <span>TUTAR</span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <div>
                    <div className="font-bold">1x Adana Kebap (Porsiyon)</div>
                    <div className="text-[8.5px] text-slate-500">* Acılı, köz biberli</div>
                  </div>
                  <span className="font-bold">₺280.00</span>
                </div>

                <div className="flex justify-between">
                  <div>
                    <div className="font-bold">2x Lahmacun (Antep Usulü)</div>
                    <div className="text-[8.5px] text-slate-500">2 x ₺90.00</div>
                  </div>
                  <span className="font-bold">₺180.00</span>
                </div>

                <div className="flex justify-between">
                  <div className="font-bold">2x Yayık Ayran (300ml)</div>
                  <span className="font-bold">₺80.00</span>
                </div>

                <div className="flex justify-between">
                  <div className="font-bold">1x Antep Katmeri</div>
                  <span className="font-bold">₺160.00</span>
                </div>
              </div>
            </div>

            {/* Toplam Tutar */}
            <div className="py-3 border-b-2 border-slate-900 space-y-1">
              <div className="flex justify-between text-xs text-slate-700">
                <span>Ara Toplam:</span>
                <span>₺700.00</span>
              </div>
              <div className="flex justify-between text-xs text-emerald-700">
                <span>İkram & İndirim (%5):</span>
                <span>-₺35.00</span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-950 pt-1 border-t border-slate-300">
                <span>GENEL TOPLAM:</span>
                <span className="text-base">₺665.00</span>
              </div>
            </div>

            {/* KDV Tablosu */}
            {form.showVatDetails && (
              <div className="py-2 border-b border-dashed border-slate-400 text-[8.5px] text-slate-600">
                <div className="flex justify-between font-bold text-slate-700 pb-0.5">
                  <span>KDV ORANI</span>
                  <span>MATRAH</span>
                  <span>KDV TUTARI</span>
                </div>
                <div className="flex justify-between">
                  <span>%10 Yiyecek & İçecek</span>
                  <span>₺604.55</span>
                  <span>₺60.45</span>
                </div>
              </div>
            )}

            {/* Wi-Fi & Sosyal Medya */}
            {(form.wifiName || form.instagram) && (
              <div className="py-2 border-b border-dashed border-slate-400 text-center space-y-0.5 text-[9px] text-slate-700">
                {form.wifiName && (
                  <div className="font-bold">
                    📶 Wi-Fi: <span className="font-black text-slate-950">{form.wifiName}</span> | Şifre: <span className="font-mono font-black">{form.wifiPassword}</span>
                  </div>
                )}
                {form.instagram && (
                  <div>
                    📸 Instagram: <span className="font-bold text-slate-900">{form.instagram}</span>
                  </div>
                )}
              </div>
            )}

            {/* Kapanış Mesajı */}
            <div className="text-center pt-3 pb-2 font-bold text-[10px] text-slate-900">
              {form.footerMessage}
            </div>

            {/* Barkod Görseli */}
            {form.showBarcode && (
              <div className="pt-1 pb-2 flex flex-col items-center">
                <div className="flex gap-[2px] items-end h-7">
                  {[2,1,3,1,2,4,1,2,1,3,2,1,4,2,1,3,1,2,1,4,1,2,3,1].map((w, i) => (
                    <div key={i} className="bg-slate-900 h-full" style={{ width: `${w}px` }}></div>
                  ))}
                </div>
                <div className="text-[8px] font-mono tracking-widest text-slate-600 mt-0.5">
                  GTU-2026-0841-KASA
                </div>
              </div>
            )}

            {/* Fiş Kesim Tırtığı (Zigzag Serrated Edge) */}
            <div className="absolute -bottom-3 left-0 right-0 h-3 overflow-hidden flex">
              {Array.from({ length: 28 }).map((_, i) => (
                <div
                  key={i}
                  className="w-3 h-3 bg-[#FAFAFA] transform rotate-45 -translate-y-1.5 shrink-0"
                />
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
