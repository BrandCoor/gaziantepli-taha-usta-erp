/**
 * Cari ekstre ekranlarını GERÇEK tarayıcıda doğrulayan kontrol betiği.
 *
 * Ne yapar: Örnek bir müşteri ve toptancı verisi yazar, panele giriş yapar,
 * kartların içine girer, ekstre filtrelerini tek tek dener ve yürüyen bakiyenin
 * cari karttaki bakiyeye oturduğunu kontrol eder. Ekran görüntülerini de kaydeder.
 *
 * Çalıştırmak için:
 *   npm install --no-save playwright
 *   npm run build && npx vite preview --port 4317 --strictPort &
 *   SP=./ops/ekran_goruntuleri node ops/ekstre_dogrula.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const URL = 'http://127.0.0.1:4317/';
const SP = process.env.SP || './ops/ekran_goruntuleri';
mkdirSync(SP, { recursive: true });

const musteri = {
  id: 'test-m1', name: 'Mehmet Yılmaz Lokantası', phone: '05321112233',
  address: 'Şahinbey / Gaziantep, Atatürk Bulvarı No:12', notes: 'Haftalık veresiye çalışır',
  balance: 0, createdAt: '2026-01-10T09:00:00.000Z', updatedAt: '2026-01-10T09:00:00.000Z',
};
const mTx = [
  ['2026-06-05', 'DEBT', 1500, 'CASH', 'Masa 4 veresiye hesap'],
  ['2026-06-20', 'COLLECTION', 500, 'CASH', 'Elden nakit tahsilat'],
  ['2026-07-02', 'DEBT', 2750.5, 'CASH', 'Paket servis veresiye'],
  ['2026-08-11', 'COLLECTION', 2000, 'BANK', 'Havale ile ödeme'],
  ['2026-09-01', 'DEBT', 980, 'CASH', 'Düğün siparişi bakiye'],
  ['2026-09-18', 'COLLECTION', 1200, 'CREDIT_CARD', 'Kredi kartı ile tahsilat'],
  ['2026-10-03', 'DEBT', 3400, 'CASH', 'Toplu sipariş faturası'],
  ['2026-10-09', 'COLLECTION', 900, 'BANK', 'Kısmi havale'],
].map(([date, type, amount, paymentMethod, description], i) => ({
  id: `test-mtx-${i}`, customerId: 'test-m1', type, amount, paymentMethod, date,
  description, createdAt: `${date}T10:00:00.000Z`,
}));
musteri.balance = mTx.reduce((t, x) => t + (x.type === 'DEBT' ? x.amount : -x.amount), 0);

const tedarikci = {
  id: 'test-t1', name: 'Gaziantep Et Toptancısı', contactPerson: 'Hasan Kaya',
  phone: '05339998877', category: 'Et & Tavuk', address: 'Toptancılar Sitesi B Blok No:7',
  balance: 0, createdAt: '2026-02-01T09:00:00.000Z', updatedAt: '2026-02-01T09:00:00.000Z',
};
const tTx = [
  ['2026-07-04', 'INVOICE', 18500, 'CASH', 'Dana kuşbaşı alımı', 'FTR-2026-115'],
  ['2026-07-15', 'PAYMENT', 10000, 'BANK', 'Havale ile ödeme', ''],
  ['2026-08-08', 'INVOICE', 22400, 'CASH', 'Kuzu ve tavuk alımı', 'FTR-2026-144'],
  ['2026-09-02', 'PAYMENT', 15000, 'CASH', 'Elden nakit ödeme', ''],
  ['2026-09-27', 'INVOICE', 9750, 'CASH', 'Kıyma alımı', 'FTR-2026-201'],
  ['2026-10-07', 'PAYMENT', 12000, 'CHECK', 'Çek ile ödeme', ''],
].map(([date, type, amount, paymentMethod, description, invoiceNo], i) => ({
  id: `test-ttx-${i}`, supplierId: 'test-t1', type, amount, paymentMethod, date,
  description, invoiceNo: invoiceNo || undefined, createdAt: `${date}T10:00:00.000Z`,
}));
tedarikci.balance = tTx.reduce((t, x) => t + (x.type === 'INVOICE' ? x.amount : -x.amount), 0);

const tarayici = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const sayfa = await tarayici.newPage({ viewport: { width: 1600, height: 1100 } });
const hatalar = [];
sayfa.on('console', m => { if (m.type() === 'error') hatalar.push(m.text()); });
sayfa.on('pageerror', e => hatalar.push('PAGEERROR: ' + e.message));

await sayfa.goto(URL);
await sayfa.evaluate(([m, mtx, t, ttx]) => {
  localStorage.setItem('gtu_erp_customers', JSON.stringify([m]));
  localStorage.setItem('gtu_erp_customer_transactions', JSON.stringify(mtx));
  localStorage.setItem('gtu_erp_suppliers', JSON.stringify([t]));
  localStorage.setItem('gtu_erp_supplier_transactions', JSON.stringify(ttx));
}, [musteri, mTx, tedarikci, tTx]);
await sayfa.goto(URL);

// Giriş
await sayfa.waitForTimeout(800);
const kullanici = sayfa.locator('input').first();
await kullanici.fill('admin');
await sayfa.locator('input[type="password"]').fill('1');
await sayfa.locator('button[type="submit"], button:has-text("Giriş")').first().click();
await sayfa.waitForTimeout(1500);

const kontrol = async (ad, beklenen) => {
  const govde = await sayfa.locator('body').innerText();
  const eksik = beklenen.filter(b => !govde.includes(b));
  console.log(`${eksik.length === 0 ? 'GEÇTİ' : 'BAŞARISIZ'}  ${ad}${eksik.length ? '  — eksik: ' + JSON.stringify(eksik) : ''}`);
  return eksik.length === 0;
};

// ---- MÜŞTERİ ----
await sayfa.locator('text=Müşteriler').first().click();
await sayfa.waitForTimeout(900);
await sayfa.screenshot({ path: `${SP}/01-musteri-listesi.png`, fullPage: true });

await sayfa.locator("button:has-text(\"Detay & Ekstre\")").first().click();
await sayfa.waitForTimeout(900);
await sayfa.screenshot({ path: `${SP}/02-musteri-detay.png`, fullPage: true });
await kontrol('Müşteri detayı: kimlik + ekstre + filtre çubuğu', [
  'MÜŞTERİ CARİ KARTI', 'GÜNCEL CARİ BAKİYE', 'DEVREDEN BAKİYE', 'Dönem Sonu Bakiye',
  'YÜRÜYEN BAKİYE', 'Detaylı Filtre', 'SON HAREKET', '8 / 8 hareket',
]);
const musteriBaslik = await sayfa.locator('table thead').first().innerText();
console.log(!musteriBaslik.includes('BELGE NO')
  ? 'GEÇTİ  Müşteri ekstresinde boş "Belge No" kolonu gösterilmiyor'
  : 'BAŞARISIZ  Müşteri ekstresinde boş Belge No kolonu var');

// Yürüyen bakiyenin son satırı cari bakiyeye oturuyor mu?
const beklenenBakiye = musteri.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
await kontrol(`Yürüyen bakiye cari bakiyeye oturuyor (${beklenenBakiye})`, [beklenenBakiye]);

// Tür filtresi: sadece tahsilatlar
await sayfa.locator('button:has-text("TAHSİLAT")').first().click();
await sayfa.waitForTimeout(600);
await kontrol('Tür filtresi (sadece Tahsilat) 4 hareket bırakıyor', ['4 / 8 hareket']);
await sayfa.screenshot({ path: `${SP}/03-musteri-tur-filtresi.png`, fullPage: true });

// Filtre temizle + dönem filtresi
await sayfa.locator('button:has-text("Filtreleri Temizle")').first().click();
await sayfa.waitForTimeout(500);
await sayfa.locator('button:has-text("Son 3 Ay")').first().click();
await sayfa.waitForTimeout(600);
await sayfa.screenshot({ path: `${SP}/04-musteri-donem-filtresi.png`, fullPage: true });
const govde4 = await sayfa.locator('body').innerText();
console.log('Son 3 Ay sonucu:', (govde4.match(/\d+ \/ 8 hareket/) || ['bulunamadı'])[0]);

// Metin aramasi
await sayfa.locator('button:has-text("Filtreleri Temizle")').first().click();
await sayfa.waitForTimeout(400);
await sayfa.locator('input[placeholder*="Ekstre içinde ara"]').fill('havale');
await sayfa.waitForTimeout(600);
await kontrol('Metin aramasi ("havale") 2 hareket bırakıyor', ['2 / 8 hareket']);
// Arama kutusunun gerçekten yerinde olduğunu da doğrula
console.log((await sayfa.locator('input[placeholder*="Ekstre içinde ara"]').count()) === 1
  ? 'GEÇTİ  Ekstre içi arama kutusu var'
  : 'BAŞARISIZ  Ekstre içi arama kutusu yok');

// ---- TEDARİKÇİ ----
await sayfa.locator('text=Giderler').first().click();
await sayfa.waitForTimeout(900);
await sayfa.locator('button:has-text("Toptancılar")').first().click();
await sayfa.waitForTimeout(700);
await sayfa.screenshot({ path: `${SP}/05-toptanci-listesi.png`, fullPage: true });

await sayfa.locator('button:has-text("Detay & Ekstre")').first().click();
await sayfa.waitForTimeout(900);
await sayfa.screenshot({ path: `${SP}/06-toptanci-detay.png`, fullPage: true });
await kontrol('Toptancı detayı: kimlik + ekstre + filtre çubuğu', [
  'Toptancı Listesine Dön', 'KALAN NET BORCUMUZ', 'Hasan Kaya', 'DEVREDEN BAKİYE',
  'YÜRÜYEN BAKİYE', 'FATURA NO', 'FTR-2026-115', 'Detaylı Filtre', '6 / 6 hareket',
]);

const toptanciBaslik = await sayfa.locator('table thead').first().innerText();
console.log(toptanciBaslik.includes('FATURA NO')
  ? 'GEÇTİ  Toptancı ekstresinde "Fatura No" kolonu var'
  : 'BAŞARISIZ  Toptancı ekstresinde Fatura No kolonu yok');

const beklenenBorc = tedarikci.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
await kontrol(`Toptancı yürüyen bakiyesi karta oturuyor (${beklenenBorc})`, [beklenenBorc]);

// Ödeme kanalı filtresi (Çek)
await sayfa.locator('button:has-text("Detaylı Filtre")').first().click();
await sayfa.waitForTimeout(400);
await sayfa.locator('select').last().selectOption('CHECK');
await sayfa.waitForTimeout(600);
await kontrol('Ödeme kanalı filtresi (Çek) 1 hareket bırakıyor', ['1 / 6 hareket']);
await sayfa.screenshot({ path: `${SP}/07-toptanci-kanal-filtresi.png`, fullPage: true });

// Listeye dönüş
await sayfa.locator('button:has-text("Filtreleri Temizle")').first().click();
await sayfa.waitForTimeout(300);
await sayfa.locator('button:has-text("Toptancı Listesine Dön")').first().click();
await sayfa.waitForTimeout(600);
await kontrol('Geri dönüş toptancı listesine gidiyor', ['Yeni Toptancı Ekle', 'Detay & Ekstre']);

// Caller-ID köprüsü (ws://127.0.0.1:4545) sadece Electron'da çalışır, tarayıcı testinde
// bağlanamaması beklenen durumdur; bizim değişikliğimizle ilgisi yok.
const bizimHatalar = hatalar.filter(h => !h.includes('4545') && !h.includes('404'));
console.log(bizimHatalar.length === 0
  ? 'GEÇTİ  Ekranlarda JavaScript hatası yok (caller-id websocket hariç)'
  : 'BAŞARISIZ  Konsol hataları: ' + JSON.stringify(bizimHatalar.slice(0, 5)));
await tarayici.close();
