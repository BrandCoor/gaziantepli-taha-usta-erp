import React, { useState } from 'react';
import { 
  Grid, 
  Plus, 
  Trash2, 
  Edit3, 
  Users, 
  Layers, 
  CheckCircle2, 
  ChevronRight,
  Armchair
} from 'lucide-react';
import { SectionConfig, restaurantDataService } from '../../../services/restaurantDataService';
import { notify } from '../../../services/notificationService';

interface SectionsTablesTabProps {
  sections: SectionConfig[];
  onRefresh: () => void;
}

export const SectionsTablesTab: React.FC<SectionsTablesTabProps> = ({ sections, onRefresh }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    tableCount: 10,
    capacity: 4,
  });

  const totalTables = sections.reduce((acc, s) => acc + s.tableCount, 0);
  const totalCapacity = sections.reduce((acc, s) => acc + (s.tableCount * (s.capacityPerTable || s.capacity || 4)), 0);

  const openNewSectionModal = () => {
    setEditingId(null);
    setForm({ name: '', tableCount: 10, capacity: 4 });
    setModalOpen(true);
  };

  const openEditSectionModal = (s: SectionConfig) => {
    setEditingId(s.id);
    setForm({ name: s.name, tableCount: s.tableCount, capacity: s.capacityPerTable || s.capacity || 4 });
    setModalOpen(true);
  };

  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return notify.error('Eksik Bilgi', 'Salon/bölüm adını giriniz.');

    if (editingId) {
      restaurantDataService.updateSection(editingId, {
        name: form.name,
        tableCount: Number(form.tableCount),
        capacityPerTable: Number(form.capacity),
        capacity: Number(form.capacity),
      });
      notify.success('Bölüm Güncellendi', `[${form.name}] güncellendi.`);
    } else {
      restaurantDataService.addSection({
        name: form.name,
        tableCount: Number(form.tableCount),
        capacityPerTable: Number(form.capacity),
        capacity: Number(form.capacity),
      });
      notify.success('Yeni Bölüm Eklendi', `[${form.name}] salona dahil edildi.`);
    }
    setModalOpen(false);
    onRefresh();
  };

  const handleDeleteSection = (id: string, name: string) => {
    if (sections.length <= 1) {
      return notify.error('İşlem Engellendi', 'En az 1 aktif salon/bölüm bulunmalıdır.');
    }
    notify.confirm({
      title: 'Bölümü Sil',
      message: `[${name}] ve bu bölüme ait tüm masaları silmek istediğinize emin misiniz?`,
      type: 'danger',
      onConfirm: () => {
        restaurantDataService.deleteSection(id);
        notify.success('Bölüm Silindi', `[${name}] silindi.`);
        onRefresh();
      }
    });
  };

  const handleQuickAdjustTables = (s: SectionConfig, delta: number) => {
    const newCount = Math.max(1, s.tableCount + delta);
    restaurantDataService.updateSection(s.id, { tableCount: newCount });
    restaurantDataService.playAudioAlert('beep');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* ÜST BİLGİ & TOPLAM İSTATİSTİK BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-sm">
        <div>
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <Grid className="w-4 h-4 text-[#F5C877]" />
            <span>Salon, Bölüm & Masa Yerleşimi</span>
          </h2>
          <p className="text-xs text-[#C4C4CC] mt-0.5">
            Ana Salon, Bahçe, Teras ve Paket Servis masalarını ve sandalye kapasitelerini yönetin.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-4 px-4 py-2 bg-[#141416] rounded-2xl border border-[#2C2C34] text-xs">
            <div>
              <span className="text-[#A0A0AA] block text-[10px]">Toplam Masa</span>
              <strong className="text-white font-mono text-sm">{totalTables} Masa</strong>
            </div>
            <div className="w-px h-6 bg-[#2C2C34]"></div>
            <div>
              <span className="text-[#A0A0AA] block text-[10px]">Toplam Kapasite</span>
              <strong className="text-amber-400 font-mono text-sm">~{totalCapacity} Kişi</strong>
            </div>
          </div>

          <button
            onClick={openNewSectionModal}
            className="px-4 py-2.5 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Yeni Bölüm / Salon Ekle</span>
          </button>
        </div>
      </div>

      {/* BÖLÜMLER KARTLARI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sections.map((sec) => (
          <div key={sec.id} className="bg-[#1C1C20] rounded-3xl p-5 border border-[#2C2C34] shadow-lg space-y-4 hover:border-[#3E3E4A] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#2C2C34]">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#F5C877]/10 text-[#F5C877] border border-[#F5C877]/30 flex items-center justify-center font-black">
                    <Armchair className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-white">{sec.name}</h3>
                    <span className="text-[10px] text-[#A0A0AA] font-mono">Bölüm ID: {sec.id}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditSectionModal(sec)}
                    className="p-1.5 text-[#C4C4CC] hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                    title="Düzenle"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSection(sec.id, sec.name)}
                    className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg cursor-pointer transition-colors"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bilgi Kutusu */}
              <div className="mt-4 p-3 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-2 text-xs">
                <div className="flex justify-between text-[#C4C4CC]">
                  <span>Masa Numaralandırması:</span>
                  <strong className="text-white font-mono">1'den {sec.tableCount}'a kadar</strong>
                </div>

                <div className="flex justify-between text-[#C4C4CC]">
                  <span>Masa Başına Ortalama Sandalye:</span>
                  <strong className="text-amber-300 font-mono">{sec.capacityPerTable || sec.capacity || 4} Kişilik</strong>
                </div>

                <div className="flex justify-between text-[#C4C4CC] pt-1 border-t border-[#2C2C34]/80">
                  <span>Bölüm Toplam Kapasitesi:</span>
                  <strong className="text-emerald-400 font-mono font-black">
                    {(sec.tableCount * (sec.capacityPerTable || sec.capacity || 4))} Müşteri
                  </strong>
                </div>
              </div>

              {/* Hızlı Masa Sayısı Ayarlayıcı */}
              <div className="mt-4 p-3 bg-[#141416] rounded-2xl border border-[#2C2C34] flex items-center justify-between">
                <span className="text-xs font-bold text-white">Masa Sayısı:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleQuickAdjustTables(sec, -1)}
                    className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm flex items-center justify-center cursor-pointer transition-colors"
                  >
                    -
                  </button>
                  <span className="font-mono font-black text-amber-300 text-base min-w-[28px] text-center">
                    {sec.tableCount}
                  </span>
                  <button
                    onClick={() => handleQuickAdjustTables(sec, 1)}
                    className="w-8 h-8 rounded-xl bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 font-black text-sm flex items-center justify-center cursor-pointer transition-colors"
                  >
                    +
                  </button>
                  <button
                    onClick={() => handleQuickAdjustTables(sec, 5)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-black text-xs cursor-pointer transition-colors"
                    title="+5 Masa Ekle"
                  >
                    +5
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-[#A0A0AA] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Adisyon & POS ekranında anlık aktif</span>
            </div>
          </div>
        ))}
      </div>

      {/* BÖLÜM EKLE / DÜZENLE MODALI */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#141416] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Grid className="w-5 h-5 text-[#F5C877]" />
                <span>{editingId ? 'Bölümü Düzenle' : 'Yeni Salon / Bölüm Ekle'}</span>
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-[#A0A0AA] hover:text-white text-xs font-bold cursor-pointer">✕ Kapat</button>
            </div>

            <form onSubmit={handleSaveSection} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Salon / Bölüm Adı</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Örn: VIP Teras / Ön Bahçe"
                  className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#F5C877]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#C4C4CC]">Masa Sayısı</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={form.tableCount}
                    onChange={(e) => setForm({ ...form, tableCount: Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-mono font-bold text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#C4C4CC]">Masa Başı Kapasite</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    required
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-mono font-bold text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-[#E4E4E8] rounded-xl text-xs font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
