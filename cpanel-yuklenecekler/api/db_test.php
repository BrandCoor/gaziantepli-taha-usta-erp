<?php
/**
 * GAZİANTEPLİ TAHA USTA ERP - phpMyAdmin & MySQL Canlı Tanı ve Test Aracı
 */
require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
$errorMsg = null;
$tableStats = [];

if ($pdo) {
    ensureDatabaseTables($pdo);
    try {
        $tables = ['bolumler', 'masalar', 'kategoriler', 'urunler', 'personeller', 'siparisler', 'online_siparisler', 'cihazlar', 'ayarlar'];
        foreach ($tables as $t) {
            $stmt = $pdo->query("SELECT COUNT(*) FROM `$t`");
            $tableStats[$t] = (int)$stmt->fetchColumn();
        }
    } catch (Exception $e) {
        $errorMsg = $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MySQL & phpMyAdmin Veritabanı Teşhis Paneli</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="bg-[#121214] text-[#FAF7F2] font-sans min-h-screen p-4 sm:p-8 flex flex-col justify-center items-center">

  <div class="max-w-2xl w-full space-y-6">
    <!-- BAŞLIK -->
    <div class="text-center space-y-2">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-2xl mb-2">
        <i class="fa-solid fa-database"></i>
      </div>
      <h1 class="text-2xl font-black tracking-tight text-white uppercase">phpMyAdmin / MySQL Veritabanı Testi</h1>
      <p class="text-xs text-[#8E8E98]">Gaziantepli Taha Usta ERP Bulut ve Hosting Entegrasyon Kontrolü</p>
    </div>

    <!-- BAĞLANTI DURUM KARTI -->
    <div class="bg-[#1C1C20] border <?php echo $pdo ? 'border-emerald-500/40 shadow-emerald-500/5' : 'border-rose-500/40 shadow-rose-500/5'; ?> rounded-3xl p-6 shadow-2xl space-y-5">
      <div class="flex items-center justify-between pb-4 border-b border-[#2C2C34]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl <?php echo $pdo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'; ?> flex items-center justify-center text-lg font-bold">
            <i class="fa-solid <?php echo $pdo ? 'fa-circle-check' : 'fa-circle-xmark'; ?>"></i>
          </div>
          <div>
            <div class="text-sm font-black text-white">
              <?php echo $pdo ? 'MySQL Bağlantısı BAŞARILI' : 'MySQL Bağlantısı Kurulamadı'; ?>
            </div>
            <div class="text-xs text-[#8E8E98]">
              <?php echo $pdo ? 'phpMyAdmin veritabanı aktif ve veri alışverişine hazır.' : 'Lütfen api/config.php dosyasındaki bağlantı bilgilerini kontrol ediniz.'; ?>
            </div>
          </div>
        </div>
        <span class="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider <?php echo $pdo ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'; ?>">
          <?php echo $pdo ? 'ONLINE' : 'OFFLINE'; ?>
        </span>
      </div>

      <!-- BİLGİ DETAYLARI -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div class="bg-[#141416] p-3 rounded-2xl border border-[#2C2C34]">
          <div class="text-[#8E8E98] text-[10px] uppercase font-bold">Sunucu (Host)</div>
          <div class="text-white font-mono font-bold mt-0.5 truncate"><?php echo DB_HOST; ?></div>
        </div>
        <div class="bg-[#141416] p-3 rounded-2xl border border-[#2C2C34]">
          <div class="text-[#8E8E98] text-[10px] uppercase font-bold">Veritabanı Adı</div>
          <div class="text-amber-400 font-mono font-bold mt-0.5 truncate"><?php echo DB_NAME; ?></div>
        </div>
        <div class="bg-[#141416] p-3 rounded-2xl border border-[#2C2C34]">
          <div class="text-[#8E8E98] text-[10px] uppercase font-bold">Kullanıcı</div>
          <div class="text-white font-mono font-bold mt-0.5 truncate"><?php echo DB_USER; ?></div>
        </div>
        <div class="bg-[#141416] p-3 rounded-2xl border border-[#2C2C34]">
          <div class="text-[#8E8E98] text-[10px] uppercase font-bold">Karakter Seti</div>
          <div class="text-emerald-400 font-mono font-bold mt-0.5"><?php echo DB_CHARSET; ?></div>
        </div>
      </div>

      <?php if ($pdo && !empty($tableStats)): ?>
        <!-- TABLOLAR VE KAYIT SAYILARI -->
        <div>
          <div class="text-xs font-black text-white uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>phpMyAdmin Tabloları ve Canlı Kayıtlar</span>
            <span class="text-emerald-400 text-[10px] font-mono"><i class="fa-solid fa-arrows-rotate mr-1"></i>Senkronize</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <?php foreach ($tableStats as $tableName => $cnt): ?>
              <div class="bg-[#141416] p-3 rounded-2xl border border-[#2C2C34] flex items-center justify-between">
                <span class="text-xs font-mono text-[#A0A0AA]"><?php echo $tableName; ?></span>
                <span class="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-xs font-bold rounded-lg">
                  <?php echo $cnt; ?>
                </span>
              </div>
            <?php endforeach; ?>
          </div>
        </div>
      <?php else: ?>
        <!-- KURULUM YARDIM REHBERİ -->
        <div class="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-3 text-xs text-amber-200">
          <div class="font-bold flex items-center gap-2 text-amber-300">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>phpMyAdmin Bağlantısı İçin 3 Basit Adım:</span>
          </div>
          <ol class="list-decimal list-inside space-y-1 text-amber-100/80">
            <li>cPanel'e girip <strong>MySQL Veritabanları</strong> menüsünden yeni bir veritabanı ve kullanıcı oluşturun.</li>
            <li>Kullanıcıyı veritabanına ekleyip <strong>Tüm Yetkileri (All Privileges)</strong> verin.</li>
            <li><strong>cpanel-yuklenecekler/api/config.php</strong> dosyasını açıp oluşturduğunuz DB_NAME, DB_USER ve DB_PASS bilgilerini kaydedin.</li>
          </ol>
        </div>
      <?php endif; ?>

      <div class="flex items-center justify-between pt-3 border-t border-[#2C2C34] text-xs">
        <a href="index.php?action=health" target="_blank" class="text-[#8E8E98] hover:text-white flex items-center gap-1.5 transition">
          <i class="fa-solid fa-code"></i>
          <span>Ham JSON API Yanıtı</span>
        </a>
        <button onclick="window.location.reload()" class="px-4 py-2 bg-[#2C2C34] hover:bg-[#3C3C44] text-white font-bold rounded-xl active:scale-95 transition flex items-center gap-2">
          <i class="fa-solid fa-rotate-right"></i>
          <span>Yeniden Test Et</span>
        </button>
      </div>
    </div>
  </div>

</body>
</html>
