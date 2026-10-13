import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  History,
  ArrowDownUp,
} from 'lucide-react';

/**
 * Tek ve ortak "Cari Hesap Ekstresi" bileşeni.
 * Hem müşteri (alacak) hem toptancı (borç) ekranında aynı bileşen kullanılır,
 * böylece iki ekran birbirinden farklı davranmaz.
 *
 * - Ekstre kendi içinde filtrelenir (tarih, tür, ödeme kanalı, tutar, metin).
 * - Her satırda yürüyen (devreden dahil) bakiye gösterilir.
 * - Özet rakamlar HER ZAMAN ekranda görünen (filtrelenmiş) kümeyi anlatır.
 */

/** BORC: bakiyeyi artıran hareket (müşteriye borç yazma / bizim aldığımız fatura)
 *  ALACAK: bakiyeyi azaltan hareket (tahsilat / bizim yaptığımız ödeme) */
export type EkstreYonu = 'BORC' | 'ALACAK';

export interface EkstreHareketi {
  id: string;
  tarih: string;
  yon: EkstreYonu;
  tutar: number;
  tur: string;
  belgeNo?: string;
  odemeKanali?: string;
  aciklama?: string;
  /** Çağıran ekranın kendi nesnesi (düzenle/sil/dışa aktar için geri verilir) */
  kaynak?: any;
}

type YonFiltresi = 'TUMU' | 'BORC' | 'ALACAK';
type Siralama = 'ESKI_YENI' | 'YENI_ESKI';

interface CariEkstreProps {
  hareketler: EkstreHareketi[];
  /** Borç kolonunun başlığı. Örn: "BORÇ (+)" veya "FATURA (+)" */
  borcBasligi: string;
  /** Alacak kolonunun başlığı. Örn: "TAHSİLAT (−)" veya "ÖDEME (−)" */
  alacakBasligi: string;
  /** Cari kartta yazan güncel bakiye. Ekstrenin sonu buna oturur. */
  guncelBakiye: number;
  belgeBasligi?: string;
  baslik?: string;
  bosMesaj?: string;
  /** Tablo başlığının sağ tarafına konacak butonlar (yazdır, excel vb.) */
  ustEylemler?: React.ReactNode;
  onDuzenle?: (hareket: EkstreHareketi) => void;
  onSil?: (hareket: EkstreHareketi) => void;
  /** Ekranda görünen (filtrelenmiş) hareketler değiştiğinde haber verir. */
  onGorunenDegisti?: (gorunen: EkstreHareketi[]) => void;
}

export const paraBicimle = (deger: any) =>
  (Number(deger) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';

export const tarihBicimle = (deger?: string) => {
  if (!deger) return '—';
  const d = new Date(deger);
  if (isNaN(d.getTime())) return deger;
  return d.toLocaleDateString('tr-TR');
};

const gunBasi = (deger: string) => {
  const d = new Date(deger);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

export const KANAL_ETIKETLERI: Record<string, string> = {
  CASH: '💵 Nakit',
  BANK: '🏦 Banka / Havale',
  CREDIT_CARD: '💳 Kredi Kartı',
  CHECK: '📑 Çek / Senet',
};

const kanalEtiketi = (kanal?: string) => (kanal && KANAL_ETIKETLERI[kanal]) || '—';

const isoGun = (d: Date) => {
  const yil = d.getFullYear();
  const ay = String(d.getMonth() + 1).padStart(2, '0');
  const gun = String(d.getDate()).padStart(2, '0');
  return `${yil}-${ay}-${gun}`;
};

type HizliAralik = 'TUMU' | 'BU_AY' | 'GECEN_AY' | 'SON_3_AY' | 'BU_YIL';

const HIZLI_ARALIKLAR: { kod: HizliAralik; etiket: string }[] = [
  { kod: 'TUMU', etiket: 'Tümü' },
  { kod: 'BU_AY', etiket: 'Bu Ay' },
  { kod: 'GECEN_AY', etiket: 'Geçen Ay' },
  { kod: 'SON_3_AY', etiket: 'Son 3 Ay' },
  { kod: 'BU_YIL', etiket: 'Bu Yıl' },
];

const aralikHesapla = (kod: HizliAralik): { bas: string; bit: string } => {
  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);

  if (kod === 'BU_AY') {
    return {
      bas: isoGun(new Date(bugun.getFullYear(), bugun.getMonth(), 1)),
      bit: isoGun(new Date(bugun.getFullYear(), bugun.getMonth() + 1, 0)),
    };
  }
  if (kod === 'GECEN_AY') {
    return {
      bas: isoGun(new Date(bugun.getFullYear(), bugun.getMonth() - 1, 1)),
      bit: isoGun(new Date(bugun.getFullYear(), bugun.getMonth(), 0)),
    };
  }
  if (kod === 'SON_3_AY') {
    return {
      bas: isoGun(new Date(bugun.getFullYear(), bugun.getMonth() - 2, 1)),
      bit: isoGun(bugun),
    };
  }
  if (kod === 'BU_YIL') {
    return {
      bas: isoGun(new Date(bugun.getFullYear(), 0, 1)),
      bit: isoGun(new Date(bugun.getFullYear(), 11, 31)),
    };
  }
  return { bas: '', bit: '' };
};

export const CariEkstre: React.FC<CariEkstreProps> = ({
  hareketler,
  borcBasligi,
  alacakBasligi,
  guncelBakiye,
  belgeBasligi = 'BELGE NO',
  baslik = 'Hesap Hareketleri',
  bosMesaj = 'Bu cari hesaba ait hareket bulunmuyor.',
  ustEylemler,
  onDuzenle,
  onSil,
  onGorunenDegisti,
}) => {
  const [metin, setMetin] = useState('');
  const [yonFiltresi, setYonFiltresi] = useState<YonFiltresi>('TUMU');
  const [kanalFiltresi, setKanalFiltresi] = useState<string>('TUMU');
  const [hizli, setHizli] = useState<HizliAralik>('TUMU');
  const [baslangic, setBaslangic] = useState('');
  const [bitis, setBitis] = useState('');
  const [enAz, setEnAz] = useState('');
  const [enCok, setEnCok] = useState('');
  const [siralama, setSiralama] = useState<Siralama>('YENI_ESKI');
  const [detayliAcik, setDetayliAcik] = useState(false);

  const hizliSec = (kod: HizliAralik) => {
    setHizli(kod);
    const { bas, bit } = aralikHesapla(kod);
    setBaslangic(bas);
    setBitis(bit);
  };

  const filtreleriTemizle = () => {
    setMetin('');
    setYonFiltresi('TUMU');
    setKanalFiltresi('TUMU');
    setHizli('TUMU');
    setBaslangic('');
    setBitis('');
    setEnAz('');
    setEnCok('');
  };

  const filtreAktif =
    !!metin.trim() ||
    yonFiltresi !== 'TUMU' ||
    kanalFiltresi !== 'TUMU' ||
    !!baslangic ||
    !!bitis ||
    !!enAz ||
    !!enCok;

  /** Kronolojik sıralı tüm hareketler + her satırın yürüyen bakiyesi.
   *  Yürüyen bakiye ekstrenin sonunda cari karttaki bakiyeye oturur. */
  const kronolojik = useMemo(() => {
    const liste = [...(hareketler || [])].filter(Boolean).sort((a, b) => {
      const ta = new Date(a.tarih || 0).getTime();
      const tb = new Date(b.tarih || 0).getTime();
      if (ta !== tb) return ta - tb;
      return String(a.id).localeCompare(String(b.id));
    });

    const netToplam = liste.reduce(
      (toplam, h) => toplam + (h.yon === 'BORC' ? Number(h.tutar) || 0 : -(Number(h.tutar) || 0)),
      0
    );

    // Hareketlerle açıklanamayan açılış farkı (varsa) başlangıç noktası olur.
    let yuruyen = (Number(guncelBakiye) || 0) - netToplam;

    return liste.map(h => {
      yuruyen += h.yon === 'BORC' ? Number(h.tutar) || 0 : -(Number(h.tutar) || 0);
      return { ...h, yuruyenBakiye: yuruyen };
    });
  }, [hareketler, guncelBakiye]);

  const acilisFarki = useMemo(() => {
    const netToplam = (hareketler || []).reduce(
      (toplam, h) => toplam + (h.yon === 'BORC' ? Number(h.tutar) || 0 : -(Number(h.tutar) || 0)),
      0
    );
    return (Number(guncelBakiye) || 0) - netToplam;
  }, [hareketler, guncelBakiye]);

  const filtreUygula = (h: EkstreHareketi) => {
    const q = metin.toLowerCase().trim();
    if (q) {
      const havuz = `${h.aciklama || ''} ${h.belgeNo || ''} ${h.tur || ''}`.toLowerCase();
      if (!havuz.includes(q)) return false;
    }

    if (yonFiltresi !== 'TUMU' && h.yon !== yonFiltresi) return false;
    if (kanalFiltresi !== 'TUMU' && (h.odemeKanali || '') !== kanalFiltresi) return false;

    const tarih = gunBasi(h.tarih);
    if (baslangic) {
      const bas = gunBasi(baslangic);
      if (bas && (!tarih || tarih < bas)) return false;
    }
    if (bitis) {
      const bit = gunBasi(bitis);
      if (bit && (!tarih || tarih > bit)) return false;
    }

    const tutar = Number(h.tutar) || 0;
    const az = parseFloat(enAz);
    const cok = parseFloat(enCok);
    if (!isNaN(az) && tutar < az) return false;
    if (!isNaN(cok) && tutar > cok) return false;

    return true;
  };

  const filtrelenmisKronolojik = useMemo(
    () => kronolojik.filter(filtreUygula),
    [kronolojik, metin, yonFiltresi, kanalFiltresi, baslangic, bitis, enAz, enCok]
  );

  const gorunenler = useMemo(
    () => (siralama === 'YENI_ESKI' ? [...filtrelenmisKronolojik].reverse() : filtrelenmisKronolojik),
    [filtrelenmisKronolojik, siralama]
  );

  useEffect(() => {
    if (onGorunenDegisti) onGorunenDegisti(filtrelenmisKronolojik);
  }, [filtrelenmisKronolojik]);

  /** Filtrelenmiş dönemin rakamları: devreden + dönem borç/alacak + dönem sonu */
  const ozet = useMemo(() => {
    let donemBorc = 0;
    let donemAlacak = 0;
    filtrelenmisKronolojik.forEach(h => {
      if (h.yon === 'BORC') donemBorc += Number(h.tutar) || 0;
      else donemAlacak += Number(h.tutar) || 0;
    });

    const ilk = filtrelenmisKronolojik[0];
    const son = filtrelenmisKronolojik[filtrelenmisKronolojik.length - 1];

    // Devreden = ilk görünen hareketten hemen önceki bakiye
    const devreden = ilk
      ? (ilk as any).yuruyenBakiye - (ilk.yon === 'BORC' ? Number(ilk.tutar) || 0 : -(Number(ilk.tutar) || 0))
      : acilisFarki;

    const donemSonu = son ? (son as any).yuruyenBakiye : devreden;

    return { donemBorc, donemAlacak, devreden, donemSonu };
  }, [filtrelenmisKronolojik, acilisFarki]);

  // Hiçbir harekette belge/fatura no yoksa o kolonu hiç gösterme (gereksiz boş kolon olmasın)
  const belgeKolonuVar = useMemo(
    () => (hareketler || []).some(h => !!(h && h.belgeNo)),
    [hareketler]
  );

  const kolonSayisi = 7 + (belgeKolonuVar ? 1 : 0) + (onDuzenle || onSil ? 1 : 0);

  const bakiyeRengi = (deger: number) =>
    deger > 0.01 ? 'text-rose-400' : deger < -0.01 ? 'text-sky-400' : 'text-emerald-400';

  const girdiStili =
    'w-full py-2.5 px-3.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none';

  return (
    <div className="space-y-4">
      {/* ----------------------------------------------------------------- */}
      {/* EKSTRE FİLTRE ÇUBUĞU                                              */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] shadow-xl overflow-hidden">
        <div className="p-4 space-y-3">
          {/* 1. satır: arama + tür + detay anahtarı */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-[#8E8E98] absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={metin}
                onChange={e => setMetin(e.target.value)}
                placeholder="Ekstre içinde ara: açıklama, belge / fatura no..."
                className={`${girdiStili} pl-10`}
              />
            </div>

            <div className="flex items-center gap-1 bg-[#121214] p-1 rounded-2xl border border-[#2C2C34]">
              {([
                { kod: 'TUMU', etiket: 'Tümü' },
                { kod: 'BORC', etiket: borcBasligi.replace(/\s*\(.*\)\s*/, '') },
                { kod: 'ALACAK', etiket: alacakBasligi.replace(/\s*\(.*\)\s*/, '') },
              ] as { kod: YonFiltresi; etiket: string }[]).map(s => (
                <button
                  key={s.kod}
                  onClick={() => setYonFiltresi(s.kod)}
                  className={`px-3.5 py-2 rounded-xl text-[11px] font-black whitespace-nowrap transition-all cursor-pointer ${
                    yonFiltresi === s.kod
                      ? 'bg-[#F5C877] text-[#141416] shadow-md'
                      : 'text-[#8E8E98] hover:text-[#FAF7F2] hover:bg-[#282830]'
                  }`}
                >
                  {s.etiket}
                </button>
              ))}
            </div>

            <button
              onClick={() => setDetayliAcik(v => !v)}
              className="px-3.5 py-2.5 bg-[#282830] hover:bg-[#32323D] text-[#FAF7F2] text-[11px] font-black rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Filter className="w-3.5 h-3.5 text-[#F5C877]" />
              <span>Detaylı Filtre</span>
              {detayliAcik ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* 2. satır: hızlı tarih aralıkları + sıralama + temizle */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase text-[#8E8E98] mr-1">Dönem:</span>
            {HIZLI_ARALIKLAR.map(a => (
              <button
                key={a.kod}
                onClick={() => hizliSec(a.kod)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                  hizli === a.kod
                    ? 'bg-[#F5C877]/15 border-[#F5C877]/50 text-[#F5C877]'
                    : 'bg-[#121214] border-[#2C2C34] text-[#8E8E98] hover:text-[#FAF7F2]'
                }`}
              >
                {a.etiket}
              </button>
            ))}

            <div className="flex-1" />

            <button
              onClick={() => setSiralama(s => (s === 'YENI_ESKI' ? 'ESKI_YENI' : 'YENI_ESKI'))}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#121214] border border-[#2C2C34] text-[#8E8E98] hover:text-[#FAF7F2] flex items-center gap-1.5 cursor-pointer"
              title="Tarih sıralamasını çevir"
            >
              <ArrowDownUp className="w-3.5 h-3.5 text-[#F5C877]" />
              <span>{siralama === 'YENI_ESKI' ? 'Yeniden Eskiye' : 'Eskiden Yeniye'}</span>
            </button>

            {filtreAktif && (
              <button
                onClick={filtreleriTemizle}
                className="px-3 py-1.5 rounded-xl text-[11px] font-black bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Filtreleri Temizle</span>
              </button>
            )}
          </div>

          {/* 3. satır: detaylı filtreler (gerektiğinde açılır) */}
          {detayliAcik && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-3 border-t border-[#2C2C34]">
              <div>
                <label className="text-[10px] font-black uppercase text-[#8E8E98]">Başlangıç Tarihi</label>
                <input
                  type="date"
                  value={baslangic}
                  onChange={e => {
                    setBaslangic(e.target.value);
                    setHizli('TUMU');
                  }}
                  className={`${girdiStili} mt-1`}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-[#8E8E98]">Bitiş Tarihi</label>
                <input
                  type="date"
                  value={bitis}
                  onChange={e => {
                    setBitis(e.target.value);
                    setHizli('TUMU');
                  }}
                  className={`${girdiStili} mt-1`}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-[#8E8E98]">Ödeme Kanalı</label>
                <select
                  value={kanalFiltresi}
                  onChange={e => setKanalFiltresi(e.target.value)}
                  className={`${girdiStili} mt-1`}
                >
                  <option value="TUMU">Tüm Kanallar</option>
                  {Object.entries(KANAL_ETIKETLERI).map(([kod, etiket]) => (
                    <option key={kod} value={kod}>
                      {etiket}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-[#8E8E98]">En Az Tutar (₺)</label>
                <input
                  type="number"
                  step="0.01"
                  value={enAz}
                  onChange={e => setEnAz(e.target.value)}
                  placeholder="0,00"
                  className={`${girdiStili} mt-1 font-mono`}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-[#8E8E98]">En Çok Tutar (₺)</label>
                <input
                  type="number"
                  step="0.01"
                  value={enCok}
                  onChange={e => setEnCok(e.target.value)}
                  placeholder="Sınırsız"
                  className={`${girdiStili} mt-1 font-mono`}
                />
              </div>
            </div>
          )}
        </div>

        {/* FİLTRELENMİŞ DÖNEM ÖZETİ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-[#2C2C34] divide-x divide-[#2C2C34]">
          <div className="p-4">
            <div className="text-[10px] font-black uppercase text-[#8E8E98]">Devreden Bakiye</div>
            <div className={`text-base font-black font-mono mt-0.5 ${bakiyeRengi(ozet.devreden)}`}>
              {paraBicimle(ozet.devreden)}
            </div>
            <div className="text-[10px] text-[#7A7A88] mt-0.5">Seçilen dönemden önceki bakiye</div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-black uppercase text-[#8E8E98]">Dönem {borcBasligi.replace(/\s*\(.*\)\s*/, '')}</div>
            <div className="text-base font-black font-mono text-rose-400 mt-0.5">{paraBicimle(ozet.donemBorc)}</div>
            <div className="text-[10px] text-[#7A7A88] mt-0.5">Sadece ekranda görünen hareketler</div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-black uppercase text-[#8E8E98]">Dönem {alacakBasligi.replace(/\s*\(.*\)\s*/, '')}</div>
            <div className="text-base font-black font-mono text-emerald-400 mt-0.5">{paraBicimle(ozet.donemAlacak)}</div>
            <div className="text-[10px] text-[#7A7A88] mt-0.5">Sadece ekranda görünen hareketler</div>
          </div>
          <div className="p-4 bg-[#18181C]">
            <div className="text-[10px] font-black uppercase text-[#8E8E98]">Dönem Sonu Bakiye</div>
            <div className={`text-base font-black font-mono mt-0.5 ${bakiyeRengi(ozet.donemSonu)}`}>
              {paraBicimle(ozet.donemSonu)}
            </div>
            <div className="text-[10px] text-[#7A7A88] mt-0.5">
              {gorunenler.length} / {kronolojik.length} hareket gösteriliyor
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* HAREKET TABLOSU                                                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-[#2C2C34] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <History className="w-4 h-4 text-[#F5C877]" />
            <span>{baslik}</span>
          </h3>
          {ustEylemler && <div className="flex flex-wrap items-center gap-2">{ustEylemler}</div>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#18181C] border-b border-[#2C2C34] text-[#8E8E98] font-black uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4 whitespace-nowrap">TARİH</th>
                <th className="py-3.5 px-4 whitespace-nowrap">İŞLEM TÜRÜ</th>
                {belgeKolonuVar && <th className="py-3.5 px-4 whitespace-nowrap">{belgeBasligi}</th>}
                <th className="py-3.5 px-4">AÇIKLAMA</th>
                <th className="py-3.5 px-4 whitespace-nowrap">ÖDEME KANALI</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">{borcBasligi}</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">{alacakBasligi}</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">YÜRÜYEN BAKİYE</th>
                {(onDuzenle || onSil) && <th className="py-3.5 px-4 text-center w-24">İŞLEM</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2C2C34]/60 font-medium">
              {gorunenler.length === 0 ? (
                <tr>
                  <td colSpan={kolonSayisi} className="py-12 text-center text-xs text-[#8E8E98]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <History className="w-8 h-8 text-[#5A5A66]" />
                      <span>
                        {kronolojik.length === 0
                          ? bosMesaj
                          : 'Seçtiğiniz filtrelere uyan hareket bulunamadı.'}
                      </span>
                      {kronolojik.length > 0 && filtreAktif && (
                        <button
                          onClick={filtreleriTemizle}
                          className="mt-1 px-3 py-1.5 rounded-xl text-[11px] font-black bg-[#282830] hover:bg-[#32323D] text-[#F5C877] cursor-pointer"
                        >
                          Filtreleri Temizle
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                gorunenler.map(h => {
                  const borcMu = h.yon === 'BORC';
                  const yuruyen = (h as any).yuruyenBakiye as number;

                  return (
                    <tr key={h.id} className="hover:bg-[#222228]/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-[#FAF7F2] whitespace-nowrap">{tarihBicimle(h.tarih)}</td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black border ${
                            borcMu
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {borcMu ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {h.tur}
                        </span>
                      </td>

                      {belgeKolonuVar && (
                        <td className="py-3.5 px-4 font-mono text-[#C4C4CC]">{h.belgeNo || '—'}</td>
                      )}

                      <td className="py-3.5 px-4 text-[#FAF7F2] max-w-xs">
                        <span className="font-bold">{h.aciklama || '—'}</span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#141416] text-[#C4C4CC] border border-[#2C2C34]">
                          {kanalEtiketi(h.odemeKanali)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-black text-rose-400 whitespace-nowrap">
                        {borcMu ? paraBicimle(h.tutar) : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-400 whitespace-nowrap">
                        {!borcMu ? paraBicimle(h.tutar) : '—'}
                      </td>

                      <td className={`py-3.5 px-4 text-right font-mono font-black whitespace-nowrap ${bakiyeRengi(yuruyen)}`}>
                        {paraBicimle(yuruyen)}
                      </td>

                      {(onDuzenle || onSil) && (
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {onDuzenle && (
                              <button
                                onClick={() => onDuzenle(h)}
                                className="p-1.5 text-[#8E8E98] hover:text-[#F5C877] hover:bg-[#282830] rounded-lg transition-colors cursor-pointer"
                                title="Hareketi Düzenle"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onSil && (
                              <button
                                onClick={() => onSil(h)}
                                className="p-1.5 text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Hareketi Sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {gorunenler.length > 0 && (
          <div className="px-4 py-3 border-t border-[#2C2C34] bg-[#18181C] flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="text-[#8E8E98] font-bold">
              {siralama === 'YENI_ESKI'
                ? 'En yeni hareket en üstte. Yürüyen bakiye her zaman tarih sırasına göre hesaplanır.'
                : 'En eski hareket en üstte. Yürüyen bakiye satır satır ilerler.'}
            </span>
            <span className="font-black text-[#FAF7F2]">
              Dönem Sonu Bakiye:{' '}
              <span className={`font-mono ${bakiyeRengi(ozet.donemSonu)}`}>{paraBicimle(ozet.donemSonu)}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CariEkstre;
