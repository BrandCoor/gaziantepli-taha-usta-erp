<?php
/**
 * GAZİANTEPLİ TAHA USTA ERP - Merkezi Veritabanı ve Senkronizasyon API'si
 * ----------------------------------------------------------------------
 * MySQL / phpMyAdmin veya JSON Senkronizasyon Modu
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Device-UUID, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
$useMysql = false;

if ($pdo) {
    ensureDatabaseTables($pdo);
    $useMysql = true;
}

// Fallback JSON Dosyası
$dbFile = __DIR__ . '/restaurant_sync.json';
if (!$useMysql) {
    if (!file_exists($dbFile)) {
        $initialData = [
            'sections' => [],
            'tables' => [],
            'products' => [],
            'categories' => [],
            'orders' => [],
            'employees' => [],
            'paired_devices' => [],
            'boss_settings' => ['password' => '', 'approved_devices' => []],
            'last_updated' => time()
        ];
        file_put_contents($dbFile, json_encode($initialData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
    $db = json_decode(file_get_contents($dbFile), true) ?: [];
    if (!isset($db['paired_devices'])) $db['paired_devices'] = [];
    if (!isset($db['boss_settings'])) $db['boss_settings'] = ['password' => '', 'approved_devices' => []];
}

$action = $_GET['action'] ?? '';
$rawInput = file_get_contents('php://input');
$inputData = json_decode($rawInput, true) ?: [];
if (empty($action) && isset($inputData['action'])) {
    $action = $inputData['action'];
}

// Cihaz eşleme ve kimlik doğrulama işlemleri doğrudan auth.php tarafından ele alınır
if (in_array($action, ['create_pairing_token', 'generate_pairing_token', 'pair_device', 'pair_with_code', 'reset_device_pairing', 'login', 'waiter_login', 'check_device_status', 'device_lookup'])) {
    require __DIR__ . '/auth.php';
    exit;
}

// Online Yemek Platformları (Yemeksepeti, Trendyol Yemek, GetirYemek)
if (in_array($action, ['get_online_orders', 'list_online_orders', 'get_online_platforms', 'create_test_online_order'])) {
    require __DIR__ . '/online/orders.php';
    exit;
}
if (in_array($action, [
    'online_action', 'accept_online_order', 'reject_online_order', 'cancel_online_order',
    'dispatch_online_order', 'deliver_online_order', 'update_online_store_status',
    'update_platform_store_status', 'get_platform_store_status',
    'toggle_online_platform', 'save_online_platform_config', 'test_online_connection'
])) {
    // get_platform_store_status desteği
    if ($action === 'get_platform_store_status') {
        require __DIR__ . '/online/orders.php';
        exit;
    }
    require __DIR__ . '/online/action.php';
    exit;
}
if (in_array($action, ['platform_webhook', 'online_webhook'])) {
    require __DIR__ . '/online/webhook.php';
    exit;
}

/**
 * Masaları Küçükten Büyüğe (1, 2, 3... 10, 11) ve Salon Sırasına göre Doğal Sıralar
 */
function sort_tables_naturally_php(&$tables, $sections = []) {
    if (!is_array($tables)) return;
    $secOrder = [];
    if (!empty($sections)) {
        foreach ($sections as $idx => $s) {
            $secId = is_array($s) ? ($s['id'] ?? '') : '';
            if ($secId) {
                $secOrder[$secId] = isset($s['order']) ? (int)$s['order'] : (isset($s['sira']) ? (int)$s['sira'] : $idx);
            }
        }
    }
    usort($tables, function($a, $b) use ($secOrder) {
        $secA = $a['sectionId'] ?? '';
        $secB = $b['sectionId'] ?? '';
        if ($secA !== $secB) {
            $ordA = isset($secOrder[$secA]) ? $secOrder[$secA] : 999;
            $ordB = isset($secOrder[$secB]) ? $secOrder[$secB] : 999;
            if ($ordA !== $ordB) return $ordA - $ordB;
            $secComp = strcmp($secA, $secB);
            if ($secComp !== 0) return $secComp;
        }
        preg_match_all('/\d+/', $a['name'] ?? $a['id'] ?? '', $m1);
        preg_match_all('/\d+/', $b['name'] ?? $b['id'] ?? '', $m2);
        $n1 = !empty($m1[0]) ? (int)end($m1[0]) : 0;
        $n2 = !empty($m2[0]) ? (int)end($m2[0]) : 0;
        if ($n1 !== 0 && $n2 !== 0 && $n1 !== $n2) {
            return $n1 - $n2;
        }
        return strnatcasecmp($a['name'] ?? $a['id'] ?? '', $b['name'] ?? $b['id'] ?? '');
    });
}

// ========================================================
// 0. VERİTABANI BAĞLANTI TESTİ (test_db / health)
// ========================================================
if ($action === 'test_db' || $action === 'health') {
    if ($useMysql) {
        $tableCounts = [];
        try {
            $tables = ['bolumler', 'masalar', 'urunler', 'kategoriler', 'personeller', 'siparisler', 'online_siparisler', 'cihazlar'];
            foreach ($tables as $tbl) {
                $stmt = $pdo->query("SELECT COUNT(*) FROM `$tbl`");
                $tableCounts[$tbl] = (int)$stmt->fetchColumn();
            }
            echo json_encode([
                'success' => true,
                'mode' => 'MYSQL',
                'database' => DB_NAME,
                'host' => DB_HOST,
                'message' => 'MySQL / phpMyAdmin veritabanı başarıyla bağlı ve tüm tablolar aktif.',
                'tables' => $tableCounts,
                'serverTime' => date('Y-m-d H:i:s')
            ], JSON_UNESCAPED_UNICODE);
            exit;
        } catch (Exception $e) {
            echo json_encode([
                'success' => false,
                'mode' => 'MYSQL_ERROR',
                'error' => $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    } else {
        echo json_encode([
            'success' => true,
            'mode' => 'JSON_FALLBACK',
            'message' => 'MySQL config bilgileri henüz girilmediği için yerel JSON dosyası aktif. config.php dosyasından veritabanı kullanıcı ve şifrenizi tanımlayarak phpMyAdmin modunu aktif edebilirsiniz.',
            'serverTime' => date('Y-m-d H:i:s')
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ========================================================
// 1. CİHAZ EŞLEŞTİRME VE MÜHÜRLEME (pair_device)
// ========================================================
if ($action === 'pair_device' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input && !empty($input['waiterId'])) {
        $waiterId = $input['waiterId'];
        $waiterName = $input['waiterName'] ?? 'Garson';
        $deviceUuid = $input['deviceUuid'] ?? ('TEL-' . rand(1000, 9999));
        $deviceName = $input['deviceName'] ?? 'Mobil Cihaz';
        $status = 'APPROVED';

        if ($useMysql) {
            $stmt = $pdo->prepare("INSERT INTO `cihazlar` (`waiter_id`, `waiter_name`, `device_uuid`, `device_name`, `durum`, `eslesme_tarihi`) 
                                   VALUES (?, ?, ?, ?, ?, NOW()) 
                                   ON DUPLICATE KEY UPDATE `waiter_name` = VALUES(`waiter_name`), `device_uuid` = VALUES(`device_uuid`), `device_name` = VALUES(`device_name`), `durum` = VALUES(`durum`), `eslesme_tarihi` = NOW()");
            $stmt->execute([$waiterId, $waiterName, $deviceUuid, $deviceName, $status]);
        } else {
            $db['paired_devices'][$waiterId] = [
                'waiterId' => $waiterId,
                'waiterName' => $waiterName,
                'deviceUuid' => $deviceUuid,
                'deviceName' => $deviceName,
                'pairedAt' => date('Y-m-d H:i:s'),
                'status' => $status
            ];
            file_put_contents($dbFile, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }

        echo json_encode([
            'success' => true,
            'device' => [
                'waiterId' => $waiterId,
                'waiterName' => $waiterName,
                'deviceUuid' => $deviceUuid,
                'deviceName' => $deviceName,
                'status' => $status
            ]
        ]);
        exit;
    }
}

// ========================================================
// 2. KASA İÇİN EŞLEŞEN CİHAZLARI GETİR (get_paired_devices)
// ========================================================
if ($action === 'get_paired_devices') {
    if ($useMysql) {
        $stmt = $pdo->query("SELECT `waiter_id` as waiterId, `waiter_name` as waiterName, `device_uuid` as deviceUuid, `device_name` as deviceName, `durum` as status, `eslesme_tarihi` as pairedAt FROM `cihazlar`");
        $rows = $stmt->fetchAll();
        $devices = [];
        foreach ($rows as $r) {
            $devices[$r['waiterId']] = $r;
        }
        echo json_encode(['success' => true, 'devices' => $devices]);
    } else {
        echo json_encode(['success' => true, 'devices' => $db['paired_devices'] ?? []]);
    }
    exit;
}

// ========================================================
// 3. KASA TÜM VERİLERİ BULUTA / MYSQL'E İTER (push_kasa_state) & ERP TAM SENKRONİZASYON (sync_all_erp_data)
// ========================================================
if (($action === 'push_kasa_state' || $action === 'sync_all_erp_data') && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input) {
        if ($useMysql) {
            $pdo->beginTransaction();
            try {
                // Bölümler
                if (isset($input['sections']) && is_array($input['sections'])) {
                    $secIds = [];
                    $stmt = $pdo->prepare("INSERT INTO `bolumler` (`id`, `ad`, `masa_sayisi`, `kapasite_kisi`, `sira`) 
                                           VALUES (?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `ad` = VALUES(`ad`), `masa_sayisi` = VALUES(`masa_sayisi`), `kapasite_kisi` = VALUES(`kapasite_kisi`), `sira` = VALUES(`sira`)");
                    foreach ($input['sections'] as $idx => $sec) {
                        $secIds[] = $sec['id'];
                        $stmt->execute([
                            $sec['id'],
                            $sec['name'] ?? 'Bölüm',
                            $sec['tableCount'] ?? 12,
                            $sec['capacityPerTable'] ?? 4,
                            $idx + 1
                        ]);
                    }
                    if (!empty($secIds)) {
                        $inQ = implode(',', array_fill(0, count($secIds), '?'));
                        $pdo->prepare("DELETE FROM `bolumler` WHERE `id` NOT IN ($inQ)")->execute($secIds);
                    }
                }

                // Masalar
                if (isset($input['tables']) && is_array($input['tables'])) {
                    $tblIds = [];
                    $stmt = $pdo->prepare("INSERT INTO `masalar` (`id`, `bolum_id`, `ad`, `durum`, `aktif_siparis`, `toplam_tutar`) 
                                           VALUES (?, ?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `bolum_id` = VALUES(`bolum_id`), `ad` = VALUES(`ad`), `durum` = VALUES(`durum`), `aktif_siparis` = VALUES(`aktif_siparis`), `toplam_tutar` = VALUES(`toplam_tutar`)");
                    foreach ($input['tables'] as $tbl) {
                        $tblIds[] = $tbl['id'];
                        $orderJson = !empty($tbl['order']) ? json_encode($tbl['order'], JSON_UNESCAPED_UNICODE) : null;
                        $total = !empty($tbl['order']['totalAmount']) ? (float)$tbl['order']['totalAmount'] : 0.00;
                        $stmt->execute([
                            $tbl['id'],
                            $tbl['sectionId'] ?? 'sec-salon',
                            $tbl['name'] ?? 'Masa',
                            $tbl['status'] ?? 'EMPTY',
                            $orderJson,
                            $total
                        ]);
                    }
                    if (!empty($tblIds)) {
                        $inQ = implode(',', array_fill(0, count($tblIds), '?'));
                        $pdo->prepare("DELETE FROM `masalar` WHERE `id` NOT IN ($inQ)")->execute($tblIds);
                    }
                }

                // Kategoriler
                if (isset($input['categories']) && is_array($input['categories'])) {
                    $catIds = [];
                    $stmt = $pdo->prepare("INSERT INTO `kategoriler` (`id`, `ad`, `renk`, `yazici_id`, `sira`) 
                                           VALUES (?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `ad` = VALUES(`ad`), `renk` = VALUES(`renk`), `yazici_id` = VALUES(`yazici_id`), `sira` = VALUES(`sira`)");
                    foreach ($input['categories'] as $idx => $cat) {
                        $catIds[] = $cat['id'];
                        $stmt->execute([
                            $cat['id'],
                            $cat['name'] ?? 'Kategori',
                            $cat['color'] ?? '#ef4444',
                            $cat['printerId'] ?? null,
                            $idx + 1
                        ]);
                    }
                    if (!empty($catIds)) {
                        $inQ = implode(',', array_fill(0, count($catIds), '?'));
                        $pdo->prepare("DELETE FROM `kategoriler` WHERE `id` NOT IN ($inQ)")->execute($catIds);
                    }
                }

                // Ürünler
                if (isset($input['products']) && is_array($input['products'])) {
                    $prodIds = [];
                    $stmt = $pdo->prepare("INSERT INTO `urunler` (`id`, `kategori_id`, `ad`, `fiyat`, `hazirlik_dk`, `barkod`, `yazici_id`, `aktif`, `aciklama`, `resim_url`) 
                                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `kategori_id` = VALUES(`kategori_id`), `ad` = VALUES(`ad`), `fiyat` = VALUES(`fiyat`), `hazirlik_dk` = VALUES(`hazirlik_dk`), `barkod` = VALUES(`barkod`), `yazici_id` = VALUES(`yazici_id`), `aktif` = VALUES(`aktif`), `aciklama` = VALUES(`aciklama`), `resim_url` = VALUES(`resim_url`)");
                    foreach ($input['products'] as $prod) {
                        $prodIds[] = $prod['id'];
                        $stmt->execute([
                            $prod['id'],
                            $prod['categoryId'] ?? '',
                            $prod['name'] ?? 'Ürün',
                            (float)($prod['price'] ?? 0),
                            (int)($prod['preparationMin'] ?? 15),
                            $prod['barcode'] ?? null,
                            $prod['printerId'] ?? null,
                            isset($prod['isAvailable']) && !$prod['isAvailable'] ? 0 : 1,
                            $prod['description'] ?? null,
                            $prod['imageUrl'] ?? null
                        ]);
                    }
                    if (!empty($prodIds)) {
                        $inQ = implode(',', array_fill(0, count($prodIds), '?'));
                        $pdo->prepare("DELETE FROM `urunler` WHERE `id` NOT IN ($inQ)")->execute($prodIds);
                    }
                }

                // Personeller
                if (isset($input['employees']) && is_array($input['employees'])) {
                    $empIds = [];
                    $stmt = $pdo->prepare("INSERT INTO `personeller` (`id`, `ad`, `rol`, `pozisyon`, `telefon`, `maas`, `maas_gunu`, `calisma_saati`, `mesai_carpani`, `iban`, `bakiye`, `pin`, `qr_token`, `aktif`, `baslangic_tarihi`) 
                                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `ad` = VALUES(`ad`), `rol` = VALUES(`rol`), `pozisyon` = VALUES(`pozisyon`), `telefon` = VALUES(`telefon`), `maas` = VALUES(`maas`), `maas_gunu` = VALUES(`maas_gunu`), `calisma_saati` = VALUES(`calisma_saati`), `mesai_carpani` = VALUES(`mesai_carpani`), `iban` = VALUES(`iban`), `bakiye` = VALUES(`bakiye`), `pin` = VALUES(`pin`), `qr_token` = VALUES(`qr_token`), `aktif` = VALUES(`aktif`), `baslangic_tarihi` = VALUES(`baslangic_tarihi`)");
                    foreach ($input['employees'] as $emp) {
                        $empIds[] = $emp['id'];
                        $name = $emp['fullName'] ?? $emp['name'] ?? 'Personel';
                        $stmt->execute([
                            $emp['id'],
                            $name,
                            $emp['role'] ?? $emp['position'] ?? 'WAITER',
                            $emp['position'] ?? null,
                            $emp['phone'] ?? null,
                            (float)($emp['salary'] ?? 0),
                            (int)($emp['salaryPaymentDay'] ?? 1),
                            (float)($emp['dailyWorkHours'] ?? 8),
                            (float)($emp['overtimeMultiplier'] ?? 1.5),
                            $emp['iban'] ?? null,
                            (float)($emp['balance'] ?? 0),
                            $emp['pin'] ?? null,
                            $emp['qrToken'] ?? null,
                            isset($emp['isActive']) && !$emp['isActive'] ? 0 : 1,
                            $emp['startDate'] ?? null
                        ]);
                    }
                    if (!empty($empIds)) {
                        $inQ = implode(',', array_fill(0, count($empIds), '?'));
                        $pdo->prepare("DELETE FROM `personeller` WHERE `id` NOT IN ($inQ)")->execute($empIds);
                    }
                }

                // Personel Hareketleri (Maaş Tahakkuku, Avans, Mesai, Ödemeler)
                if (isset($input['employeePayments']) && is_array($input['employeePayments'])) {
                    $epIds = [];
                    $stmt = $pdo->prepare("INSERT INTO `personel_hareketler` (`id`, `personel_id`, `tip`, `tutar`, `odeme_yontemi`, `tarih`, `aciklama`, `mesai_saati`, `mesai_carpani`, `saatlik_ucret`, `odeme_turu`) 
                                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `personel_id` = VALUES(`personel_id`), `tip` = VALUES(`tip`), `tutar` = VALUES(`tutar`), `odeme_yontemi` = VALUES(`odeme_yontemi`), `tarih` = VALUES(`tarih`), `aciklama` = VALUES(`aciklama`), `mesai_saati` = VALUES(`mesai_saati`), `mesai_carpani` = VALUES(`mesai_carpani`), `saatlik_ucret` = VALUES(`saatlik_ucret`), `odeme_turu` = VALUES(`odeme_turu`)");
                    foreach ($input['employeePayments'] as $ep) {
                        $epIds[] = $ep['id'];
                        $stmt->execute([
                            $ep['id'],
                            $ep['employeeId'] ?? '',
                            $ep['type'] ?? 'SALARY_PAYMENT',
                            (float)($ep['amount'] ?? 0),
                            $ep['paymentMethod'] ?? 'CASH',
                            $ep['date'] ?? date('Y-m-d'),
                            $ep['description'] ?? null,
                            isset($ep['overtimeHours']) ? (float)$ep['overtimeHours'] : null,
                            isset($ep['overtimeMultiplier']) ? (float)$ep['overtimeMultiplier'] : null,
                            isset($ep['hourlyRate']) ? (float)$ep['hourlyRate'] : null,
                            $ep['payoutType'] ?? null
                        ]);
                    }
                    if (!empty($epIds)) {
                        $inQ = implode(',', array_fill(0, count($epIds), '?'));
                        $pdo->prepare("DELETE FROM `personel_hareketler` WHERE `id` NOT IN ($inQ)")->execute($epIds);
                    }
                }

                // Müşteriler (Cariler)
                if (isset($input['customers']) && is_array($input['customers'])) {
                    $custIds = [];
                    $stmt = $pdo->prepare("INSERT INTO `musteriler` (`id`, `ad`, `telefon`, `email`, `adres`, `notlar`, `bakiye`) 
                                           VALUES (?, ?, ?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `ad` = VALUES(`ad`), `telefon` = VALUES(`telefon`), `email` = VALUES(`email`), `adres` = VALUES(`adres`), `notlar` = VALUES(`notlar`), `bakiye` = VALUES(`bakiye`)");
                    foreach ($input['customers'] as $cust) {
                        $custIds[] = $cust['id'];
                        $stmt->execute([
                            $cust['id'],
                            $cust['name'] ?? 'Müşteri',
                            $cust['phone'] ?? null,
                            $cust['email'] ?? null,
                            $cust['address'] ?? null,
                            $cust['notes'] ?? null,
                            (float)($cust['balance'] ?? 0)
                        ]);
                    }
                    if (!empty($custIds)) {
                        $inQ = implode(',', array_fill(0, count($custIds), '?'));
                        $pdo->prepare("DELETE FROM `musteriler` WHERE `id` NOT IN ($inQ)")->execute($custIds);
                    }
                }

                // Cari Hareketler (Ekstreler)
                if (isset($input['customerTransactions']) && is_array($input['customerTransactions'])) {
                    $ctxIds = [];
                    $stmt = $pdo->prepare("INSERT INTO `cari_hareketler` (`id`, `musteri_id`, `tip`, `tutar`, `odeme_yontemi`, `tarih`, `aciklama`) 
                                           VALUES (?, ?, ?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `musteri_id` = VALUES(`musteri_id`), `tip` = VALUES(`tip`), `tutar` = VALUES(`tutar`), `odeme_yontemi` = VALUES(`odeme_yontemi`), `tarih` = VALUES(`tarih`), `aciklama` = VALUES(`aciklama`)");
                    foreach ($input['customerTransactions'] as $ctx) {
                        $ctxIds[] = $ctx['id'];
                        $stmt->execute([
                            $ctx['id'],
                            $ctx['customerId'] ?? '',
                            $ctx['type'] ?? 'DEBT',
                            (float)($ctx['amount'] ?? 0),
                            $ctx['paymentMethod'] ?? 'CASH',
                            $ctx['date'] ?? date('Y-m-d'),
                            $ctx['description'] ?? null
                        ]);
                    }
                    if (!empty($ctxIds)) {
                        $inQ = implode(',', array_fill(0, count($ctxIds), '?'));
                        $pdo->prepare("DELETE FROM `cari_hareketler` WHERE `id` NOT IN ($inQ)")->execute($ctxIds);
                    }
                }

                // Toptancılar
                if (isset($input['suppliers']) && is_array($input['suppliers'])) {
                    $supIds = [];
                    $stmt = $pdo->prepare("INSERT INTO `toptancilar` (`id`, `ad`, `yetkili`, `telefon`, `email`, `kategori`, `adres`, `bakiye`, `notlar`) 
                                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `ad` = VALUES(`ad`), `yetkili` = VALUES(`yetkili`), `telefon` = VALUES(`telefon`), `email` = VALUES(`email`), `kategori` = VALUES(`kategori`), `adres` = VALUES(`adres`), `bakiye` = VALUES(`bakiye`), `notlar` = VALUES(`notlar`)");
                    foreach ($input['suppliers'] as $sup) {
                        $supIds[] = $sup['id'];
                        $stmt->execute([
                            $sup['id'],
                            $sup['name'] ?? 'Toptancı',
                            $sup['contactPerson'] ?? null,
                            $sup['phone'] ?? null,
                            $sup['email'] ?? null,
                            $sup['category'] ?? 'Gıda',
                            $sup['address'] ?? null,
                            (float)($sup['balance'] ?? 0),
                            $sup['notes'] ?? null
                        ]);
                    }
                    if (!empty($supIds)) {
                        $inQ = implode(',', array_fill(0, count($supIds), '?'));
                        $pdo->prepare("DELETE FROM `toptancilar` WHERE `id` NOT IN ($inQ)")->execute($supIds);
                    }
                }

                // Toptancı Hareketleri
                if (isset($input['supplierTransactions']) && is_array($input['supplierTransactions'])) {
                    $stxIds = [];
                    $stmt = $pdo->prepare("INSERT INTO `toptanci_hareketler` (`id`, `toptanci_id`, `tip`, `tutar`, `odeme_yontemi`, `tarih`, `fatura_no`, `aciklama`) 
                                           VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `toptanci_id` = VALUES(`toptanci_id`), `tip` = VALUES(`tip`), `tutar` = VALUES(`tutar`), `odeme_yontemi` = VALUES(`odeme_yontemi`), `tarih` = VALUES(`tarih`), `fatura_no` = VALUES(`fatura_no`), `aciklama` = VALUES(`aciklama`)");
                    foreach ($input['supplierTransactions'] as $stx) {
                        $stxIds[] = $stx['id'];
                        $stmt->execute([
                            $stx['id'],
                            $stx['supplierId'] ?? '',
                            $stx['type'] ?? 'PAYMENT',
                            (float)($stx['amount'] ?? 0),
                            $stx['paymentMethod'] ?? 'CASH',
                            $stx['date'] ?? date('Y-m-d'),
                            $stx['invoiceNo'] ?? null,
                            $stx['description'] ?? null
                        ]);
                    }
                    if (!empty($stxIds)) {
                        $inQ = implode(',', array_fill(0, count($stxIds), '?'));
                        $pdo->prepare("DELETE FROM `toptanci_hareketler` WHERE `id` NOT IN ($inQ)")->execute($stxIds);
                    }
                }

                // Giderler
                if (isset($input['expenses']) && is_array($input['expenses'])) {
                    $expIds = [];
                    $stmt = $pdo->prepare("INSERT INTO `giderler` (`id`, `baslik`, `kategori`, `toptanci_id`, `toptanci_adi`, `tutar`, `odeme_yontemi`, `tarih`, `aciklama`) 
                                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `baslik` = VALUES(`baslik`), `kategori` = VALUES(`kategori`), `toptanci_id` = VALUES(`toptanci_id`), `toptanci_adi` = VALUES(`toptanci_adi`), `tutar` = VALUES(`tutar`), `odeme_yontemi` = VALUES(`odeme_yontemi`), `tarih` = VALUES(`tarih`), `aciklama` = VALUES(`aciklama`)");
                    foreach ($input['expenses'] as $exp) {
                        $expIds[] = $exp['id'];
                        $stmt->execute([
                            $exp['id'],
                            $exp['title'] ?? 'Gider',
                            $exp['category'] ?? 'Genel',
                            $exp['supplierId'] ?? null,
                            $exp['supplierName'] ?? $exp['supplier'] ?? null,
                            (float)($exp['amount'] ?? 0),
                            $exp['paymentMethod'] ?? 'CASH',
                            $exp['date'] ?? date('Y-m-d'),
                            $exp['description'] ?? null
                        ]);
                    }
                    if (!empty($expIds)) {
                        $inQ = implode(',', array_fill(0, count($expIds), '?'));
                        $pdo->prepare("DELETE FROM `giderler` WHERE `id` NOT IN ($inQ)")->execute($expIds);
                    }
                }

                // Z Raporları
                if (isset($input['zReports']) && is_array($input['zReports'])) {
                    $zIds = [];
                    $stmt = $pdo->prepare("INSERT INTO `z_raporlari` (`id`, `z_no`, `tarih`, `saat`, `kapanis_zamani`, `toplam_ciro`, `nakit`, `kredi_karti`, `veresiye`, `yemek_karti`, `ikram`, `indirim`, `iptal`, `adisyon_sayisi`, `kapatan`, `notlar`, `detay_json`) 
                                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `z_no` = VALUES(`z_no`), `tarih` = VALUES(`tarih`), `saat` = VALUES(`saat`), `kapanis_zamani` = VALUES(`kapanis_zamani`), `toplam_ciro` = VALUES(`toplam_ciro`), `nakit` = VALUES(`nakit`), `kredi_karti` = VALUES(`kredi_karti`), `veresiye` = VALUES(`veresiye`), `yemek_karti` = VALUES(`yemek_karti`), `ikram` = VALUES(`ikram`), `indirim` = VALUES(`indirim`), `iptal` = VALUES(`iptal`), `adisyon_sayisi` = VALUES(`adisyon_sayisi`), `kapatan` = VALUES(`kapatan`), `notlar` = VALUES(`notlar`), `detay_json` = VALUES(`detay_json`)");
                    foreach ($input['zReports'] as $z) {
                        $zIds[] = $z['id'];
                        $detailsJson = json_encode([
                            'hourlyDistribution' => $z['hourlyDistribution'] ?? [],
                            'categoryBreakdown' => $z['categoryBreakdown'] ?? [],
                            'topSellingProducts' => $z['topSellingProducts'] ?? [],
                            'orderIds' => $z['orderIds'] ?? []
                        ], JSON_UNESCAPED_UNICODE);
                        $stmt->execute([
                            $z['id'],
                            (int)($z['zNo'] ?? 1),
                            $z['date'] ?? date('Y-m-d'),
                            $z['time'] ?? date('H:i'),
                            $z['closedAt'] ?? null,
                            (float)($z['totalRevenue'] ?? 0),
                            (float)($z['cashTotal'] ?? 0),
                            (float)($z['posTotal'] ?? 0),
                            (float)($z['openAccountTotal'] ?? 0),
                            (float)($z['mealCardTotal'] ?? 0),
                            (float)($z['ikramTotal'] ?? 0),
                            (float)($z['discountTotal'] ?? 0),
                            (float)($z['cancelTotal'] ?? 0),
                            (int)($z['orderCount'] ?? 0),
                            $z['closedBy'] ?? 'Kasa',
                            $z['notes'] ?? null,
                            $detailsJson
                        ]);
                    }
                    if (!empty($zIds)) {
                        $inQ = implode(',', array_fill(0, count($zIds), '?'));
                        $pdo->prepare("DELETE FROM `z_raporlari` WHERE `id` NOT IN ($inQ)")->execute($zIds);
                    }
                }

                // Tamamlanan Adisyonlar
                if (isset($input['completedOrders']) && is_array($input['completedOrders'])) {
                    $coIds = [];
                    $stmt = $pdo->prepare("INSERT INTO `tamamlanan_adisyonlar` (`id`, `masa_id`, `masa_adi`, `garson_adi`, `toplam_tutar`, `indirim_tutari`, `ikram_tutari`, `odemeler_json`, `kalemler_json`, `z_raporu_id`, `durum`, `olusturma_tarihi`, `kapanis_tarihi`) 
                                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `masa_id` = VALUES(`masa_id`), `masa_adi` = VALUES(`masa_adi`), `garson_adi` = VALUES(`garson_adi`), `toplam_tutar` = VALUES(`toplam_tutar`), `indirim_tutari` = VALUES(`indirim_tutari`), `ikram_tutari` = VALUES(`ikram_tutari`), `odemeler_json` = VALUES(`odemeler_json`), `kalemler_json` = VALUES(`kalemler_json`), `z_raporu_id` = VALUES(`z_raporu_id`), `durum` = VALUES(`durum`), `kapanis_tarihi` = VALUES(`kapanis_tarihi`)");
                    foreach ($input['completedOrders'] as $co) {
                        $coIds[] = $co['id'];
                        $stmt->execute([
                            $co['id'],
                            $co['tableId'] ?? null,
                            $co['tableName'] ?? 'Masa',
                            $co['waiterName'] ?? 'Garson',
                            (float)($co['totalAmount'] ?? 0),
                            (float)($co['discountAmount'] ?? 0),
                            (float)($co['complimentaryAmount'] ?? 0),
                            json_encode($co['payments'] ?? [], JSON_UNESCAPED_UNICODE),
                            json_encode($co['items'] ?? [], JSON_UNESCAPED_UNICODE),
                            $co['zReportId'] ?? null,
                            $co['status'] ?? 'PAID',
                            $co['createdAt'] ?? date('c'),
                            $co['closedAt'] ?? date('c')
                        ]);
                    }
                    if (!empty($coIds)) {
                        $inQ = implode(',', array_fill(0, count($coIds), '?'));
                        $pdo->prepare("DELETE FROM `tamamlanan_adisyonlar` WHERE `id` NOT IN ($inQ)")->execute($coIds);
                    }
                }

                // Şirket Ayarları
                if (isset($input['companySettings']) && is_array($input['companySettings'])) {
                    $stmt = $pdo->prepare("INSERT INTO `ayarlar` (`anahtar`, `deger`, `aciklama`) VALUES ('company_settings', ?, 'Firma Bilgileri') ON DUPLICATE KEY UPDATE `deger` = VALUES(`deger`)");
                    $stmt->execute([json_encode($input['companySettings'], JSON_UNESCAPED_UNICODE)]);
                }

                // Donanım Yazıcıları
                if (isset($input['printers']) && is_array($input['printers'])) {
                    $prnStmt = $pdo->prepare("INSERT INTO `printers` (`id`, `ad`, `baglanti_turu`, `ip_adresi`, `port`, `driver_adi`, `kagit_genisligi`, `karakter_seti`, `auto_cut`, `buzzer`, `yedek_printer_id`, `aktif`)
                                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                              ON DUPLICATE KEY UPDATE `ad` = VALUES(`ad`), `baglanti_turu` = VALUES(`baglanti_turu`), `ip_adresi` = VALUES(`ip_adresi`), `port` = VALUES(`port`), `driver_adi` = VALUES(`driver_adi`), `kagit_genisligi` = VALUES(`kagit_genisligi`), `karakter_seti` = VALUES(`karakter_seti`), `auto_cut` = VALUES(`auto_cut`), `buzzer` = VALUES(`buzzer`), `yedek_printer_id` = VALUES(`yedek_printer_id`), `aktif` = VALUES(`aktif`)");
                    foreach ($input['printers'] as $prn) {
                        $prnStmt->execute([
                            $prn['id'],
                            $prn['name'] ?? 'Yazıcı',
                            $prn['type'] === 'SYSTEM_DRIVER' ? 'SYSTEM_DRIVER' : 'NETWORK_TCP',
                            $prn['ipAddress'] ?? null,
                            $prn['port'] ?? 9100,
                            $prn['usbName'] ?? ($prn['driverName'] ?? null),
                            $prn['paperWidth'] ?? 80,
                            $prn['codePage'] ?? 'PC857',
                            !empty($prn['autoCut']) ? 1 : 0,
                            !empty($prn['beepOnPrint']) ? 1 : 0,
                            $prn['failoverPrinterId'] ?? null,
                            ($prn['isActive'] ?? true) ? 1 : 0
                        ]);
                    }
                }

                // Yazıcı Rotaları
                if (isset($input['printerRoutes']) && is_array($input['printerRoutes'])) {
                    $routeStmt = $pdo->prepare("INSERT INTO `printer_routes` (`id`, `printer_id`, `hedef_tipi`, `hedef_id`)
                                                VALUES (?, ?, ?, ?)
                                                ON DUPLICATE KEY UPDATE `printer_id` = VALUES(`printer_id`), `hedef_tipi` = VALUES(`hedef_tipi`), `hedef_id` = VALUES(`hedef_id`)");
                    foreach ($input['printerRoutes'] as $rt) {
                        $routeStmt->execute([
                            $rt['id'],
                            $rt['printerId'],
                            $rt['targetType'],
                            $rt['targetId'] ?? '*'
                        ]);
                    }
                }

                // Son Güncelleme Zamanı
                $stmt = $pdo->prepare("INSERT INTO `ayarlar` (`anahtar`, `deger`) VALUES ('last_updated', ?) 
                                       ON DUPLICATE KEY UPDATE `deger` = VALUES(`deger`)");
                $stmt->execute([time()]);

                $pdo->commit();
                echo json_encode(['success' => true, 'mode' => 'MYSQL', 'message' => 'Tüm veriler MySQL veritabanı ile senkronize edildi.']);
                exit;
            } catch (Exception $e) {
                $pdo->rollBack();
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
                exit;
            }
        } else {
            // JSON Fallback
            if (isset($input['sections'])) $db['sections'] = $input['sections'];
            if (isset($input['tables'])) $db['tables'] = $input['tables'];
            if (isset($input['products'])) $db['products'] = $input['products'];
            if (isset($input['categories'])) $db['categories'] = $input['categories'];
            if (isset($input['employees'])) $db['employees'] = $input['employees'];
            if (isset($input['customers'])) $db['customers'] = $input['customers'];
            if (isset($input['customerTransactions'])) $db['customerTransactions'] = $input['customerTransactions'];
            if (isset($input['expenses'])) $db['expenses'] = $input['expenses'];
            if (isset($input['zReports'])) $db['zReports'] = $input['zReports'];
            $db['last_updated'] = time();
            file_put_contents($dbFile, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo json_encode(['success' => true, 'mode' => 'JSON']);
            exit;
        }
    }
}

// ========================================================
// 3.1 TÜM ERP VERİLERİNİ ÇEK (get_all_erp_data)
// ========================================================
if ($action === 'get_all_erp_data') {
    if ($useMysql) {
        $sections = $pdo->query("SELECT `id`, `ad` as name, `masa_sayisi` as tableCount, `kapasite_kisi` as capacityPerTable, `sira` as `order` FROM `bolumler` ORDER BY `sira` ASC")->fetchAll();
        
        $tableRows = $pdo->query("SELECT `id`, `bolum_id` as sectionId, `ad` as name, `durum` as status, `aktif_siparis` as activeOrder, `toplam_tutar` as totalAmount FROM `masalar` ORDER BY `id` ASC")->fetchAll();
        $tables = [];
        foreach ($tableRows as $tr) {
            $order = !empty($tr['activeOrder']) ? json_decode($tr['activeOrder'], true) : null;
            $tables[] = [
                'id' => $tr['id'],
                'sectionId' => $tr['sectionId'],
                'name' => $tr['name'],
                'status' => $tr['status'],
                'order' => $order
            ];
        }
        sort_tables_naturally_php($tables, $sections);

        $categories = $pdo->query("SELECT `id`, `ad` as name, `renk` as color, `yazici_id` as printerId, `sira` as `order` FROM `kategoriler` ORDER BY `sira` ASC")->fetchAll();
        
        $products = $pdo->query("SELECT `id`, `kategori_id` as categoryId, `ad` as name, `fiyat` as price, `hazirlik_dk` as preparationMin, `barkod` as barcode, `yazici_id` as printerId, `aktif` as isAvailable, `aciklama` as description, `resim_url` as imageUrl FROM `urunler`")->fetchAll();
        foreach ($products as &$p) {
            $p['price'] = (float)$p['price'];
            $p['preparationMin'] = (int)$p['preparationMin'];
            $p['isAvailable'] = (bool)$p['isAvailable'];
        }

        $empRows = $pdo->query("SELECT `id`, `ad` as fullName, `rol` as role, `pozisyon` as position, `telefon` as phone, `maas` as salary, `maas_gunu` as salaryPaymentDay, `calisma_saati` as dailyWorkHours, `mesai_carpani` as overtimeMultiplier, `iban`, `bakiye` as balance, `pin`, `qr_token` as qrToken, `aktif` as isActive, `baslangic_tarihi` as startDate FROM `personeller`")->fetchAll();
        foreach ($empRows as &$emp) {
            $emp['salary'] = (float)$emp['salary'];
            $emp['balance'] = (float)$emp['balance'];
            $emp['dailyWorkHours'] = (float)$emp['dailyWorkHours'];
            $emp['overtimeMultiplier'] = (float)$emp['overtimeMultiplier'];
            $emp['isActive'] = (bool)$emp['isActive'];
        }

        $epRows = $pdo->query("SELECT `id`, `personel_id` as employeeId, `tip` as type, `tutar` as amount, `odeme_yontemi` as paymentMethod, `tarih` as date, `aciklama` as description, `mesai_saati` as overtimeHours, `mesai_carpani` as overtimeMultiplier, `saatlik_ucret` as hourlyRate, `odeme_turu` as payoutType FROM `personel_hareketler` ORDER BY `tarih` DESC")->fetchAll();
        foreach ($epRows as &$ep) {
            $ep['amount'] = (float)$ep['amount'];
        }

        $custRows = $pdo->query("SELECT `id`, `ad` as name, `telefon` as phone, `email`, `adres` as address, `notlar` as notes, `bakiye` as balance FROM `musteriler` ORDER BY `ad` ASC")->fetchAll();
        foreach ($custRows as &$c) {
            $c['balance'] = (float)$c['balance'];
        }

        $ctxRows = $pdo->query("SELECT `id`, `musteri_id` as customerId, `tip` as type, `tutar` as amount, `odeme_yontemi` as paymentMethod, `tarih` as date, `aciklama` as description FROM `cari_hareketler` ORDER BY `tarih` DESC")->fetchAll();
        foreach ($ctxRows as &$ctx) {
            $ctx['amount'] = (float)$ctx['amount'];
        }

        $supRows = $pdo->query("SELECT `id`, `ad` as name, `yetkili` as contactPerson, `telefon` as phone, `email`, `kategori` as category, `adres` as address, `bakiye` as balance, `notlar` as notes FROM `toptancilar` ORDER BY `ad` ASC")->fetchAll();
        foreach ($supRows as &$s) {
            $s['balance'] = (float)$s['balance'];
        }

        $stxRows = $pdo->query("SELECT `id`, `toptanci_id` as supplierId, `tip` as type, `tutar` as amount, `odeme_yontemi` as paymentMethod, `tarih` as date, `fatura_no` as invoiceNo, `aciklama` as description FROM `toptanci_hareketler` ORDER BY `tarih` DESC")->fetchAll();
        foreach ($stxRows as &$stx) {
            $stx['amount'] = (float)$stx['amount'];
        }

        $expRows = $pdo->query("SELECT `id`, `baslik` as title, `kategori` as category, `toptanci_id` as supplierId, `toptanci_adi` as supplierName, `tutar` as amount, `odeme_yontemi` as paymentMethod, `tarih` as date, `aciklama` as description FROM `giderler` ORDER BY `tarih` DESC")->fetchAll();
        foreach ($expRows as &$exp) {
            $exp['amount'] = (float)$exp['amount'];
        }

        $zRows = $pdo->query("SELECT `id`, `z_no` as zNo, `tarih` as date, `saat` as time, `kapanis_zamani` as closedAt, `toplam_ciro` as totalRevenue, `nakit` as cashTotal, `kredi_karti` as posTotal, `veresiye` as openAccountTotal, `yemek_karti` as mealCardTotal, `ikram` as ikramTotal, `indirim` as discountTotal, `iptal` as cancelTotal, `adisyon_sayisi` as orderCount, `kapatan` as closedBy, `notlar` as notes, `detay_json` as details FROM `z_raporlari` ORDER BY `z_no` DESC")->fetchAll();
        foreach ($zRows as &$z) {
            $z['zNo'] = (int)$z['zNo'];
            $z['totalRevenue'] = (float)$z['totalRevenue'];
            $z['cashTotal'] = (float)$z['cashTotal'];
            $z['posTotal'] = (float)$z['posTotal'];
            $z['openAccountTotal'] = (float)$z['openAccountTotal'];
            $z['mealCardTotal'] = (float)$z['mealCardTotal'];
            $z['ikramTotal'] = (float)$z['ikramTotal'];
            $z['discountTotal'] = (float)$z['discountTotal'];
            $z['cancelTotal'] = (float)$z['cancelTotal'];
            $z['orderCount'] = (int)$z['orderCount'];
            $z['details'] = !empty($z['details']) ? json_decode($z['details'], true) : null;
        }

        $coRows = $pdo->query("SELECT `id`, `masa_id` as tableId, `masa_adi` as tableName, `garson_adi` as waiterName, `toplam_tutar` as totalAmount, `indirim_tutari` as discountAmount, `ikram_tutari` as complimentaryAmount, `odemeler_json` as payments, `kalemler_json` as items, `z_raporu_id` as zReportId, `durum` as status, `olusturma_tarihi` as createdAt, `kapanis_tarihi` as closedAt FROM `tamamlanan_adisyonlar` ORDER BY `olusturma_tarihi` DESC LIMIT 1000")->fetchAll();
        foreach ($coRows as &$co) {
            $co['totalAmount'] = (float)$co['totalAmount'];
            $co['discountAmount'] = (float)$co['discountAmount'];
            $co['complimentaryAmount'] = (float)$co['complimentaryAmount'];
            $co['payments'] = !empty($co['payments']) ? json_decode($co['payments'], true) : [];
            $co['items'] = !empty($co['items']) ? json_decode($co['items'], true) : [];
        }

        $compSettingsStmt = $pdo->query("SELECT `deger` FROM `ayarlar` WHERE `anahtar` = 'company_settings'");
        $compSettingsRaw = $compSettingsStmt ? $compSettingsStmt->fetchColumn() : null;
        $companySettings = $compSettingsRaw ? json_decode($compSettingsRaw, true) : null;

        $lastUpdatedStmt = $pdo->query("SELECT `deger` FROM `ayarlar` WHERE `anahtar` = 'last_updated'");
        $lastUpdated = (int)($lastUpdatedStmt->fetchColumn() ?: time());

        $printers = [];
        $printerRoutes = [];
        try {
            $prnRows = $pdo->query("SELECT `id`, `ad` as name, `baglanti_turu` as type, `ip_adresi` as ipAddress, `port`, `driver_adi` as usbName, `kagit_genisligi` as paperWidth, `karakter_seti` as codePage, `auto_cut` as autoCut, `buzzer` as beepOnPrint, `yedek_printer_id` as failoverPrinterId, `aktif` as isActive FROM `printers` ORDER BY `ad` ASC")->fetchAll();
            foreach ($prnRows as $pr) {
                $pr['autoCut'] = (bool)$pr['autoCut'];
                $pr['beepOnPrint'] = (bool)$pr['beepOnPrint'];
                $pr['isActive'] = (bool)$pr['isActive'];
                $pr['paperWidth'] = (int)$pr['paperWidth'];
                $pr['port'] = (int)$pr['port'];
                $printers[] = $pr;
            }
            $rtRows = $pdo->query("SELECT `id`, `printer_id` as printerId, `hedef_tipi` as targetType, `hedef_id` as targetId FROM `printer_routes`")->fetchAll();
            $printerRoutes = $rtRows;
        } catch (Exception $e) {}

        echo json_encode([
            'success' => true,
            'sections' => $sections,
            'tables' => $tables,
            'categories' => $categories,
            'products' => $products,
            'employees' => $empRows,
            'employeePayments' => $epRows,
            'customers' => $custRows,
            'customerTransactions' => $ctxRows,
            'suppliers' => $supRows,
            'supplierTransactions' => $stxRows,
            'expenses' => $expRows,
            'zReports' => $zRows,
            'completedOrders' => $coRows,
            'printers' => $printers,
            'printerRoutes' => $printerRoutes,
            'companySettings' => $companySettings,
            'last_updated' => $lastUpdated,
            'mode' => 'MYSQL'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        echo json_encode([
            'success' => true,
            'sections' => $db['sections'] ?? [],
            'tables' => $db['tables'] ?? [],
            'categories' => $db['categories'] ?? [],
            'products' => $db['products'] ?? [],
            'employees' => $db['employees'] ?? [],
            'employeePayments' => [],
            'customers' => $db['customers'] ?? [],
            'customerTransactions' => $db['customerTransactions'] ?? [],
            'suppliers' => [],
            'supplierTransactions' => [],
            'expenses' => $db['expenses'] ?? [],
            'zReports' => $db['zReports'] ?? [],
            'completedOrders' => [],
            'printers' => $db['printers'] ?? [],
            'printerRoutes' => $db['printerRoutes'] ?? [],
            'companySettings' => null,
            'last_updated' => $db['last_updated'] ?? 0,
            'mode' => 'JSON'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ========================================================
// 3.2 TEKİL SİLME (delete_item)
// ========================================================
if ($action === 'delete_item' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $table = $input['table'] ?? '';
    $id = $input['id'] ?? '';

    $allowedTables = [
        'urunler', 'kategoriler', 'bolumler', 'masalar', 
        'personeller', 'personel_hareketler', 'musteriler', 
        'cari_hareketler', 'toptancilar', 'toptanci_hareketler', 
        'giderler', 'z_raporlari', 'tamamlanan_adisyonlar',
        'printers', 'printer_routes', 'customers', 'suppliers', 'products', 'categories', 'tables', 'orders'
    ];

    if (in_array($table, $allowedTables) && !empty($id)) {
        if ($useMysql) {
            // TOPTANCI VEYA MÜŞTERİ BAKİYE KORUMASI
            if ($table === 'musteriler' || $table === 'customers') {
                try {
                    $chk = $pdo->prepare("SELECT `bakiye` FROM `musteriler` WHERE `id` = ?");
                    $chk->execute([$id]);
                    $bal = (float)$chk->fetchColumn();
                    if (abs($bal) > 0.005) {
                        echo json_encode(['success' => false, 'message' => "Bakiyesi 0 olmayan müşteri silinemez! Mevcut Bakiye: ₺" . number_format($bal, 2) . ". Lütfen önce cari hesabı sıfırlayınız."]);
                        exit;
                    }
                } catch (Exception $e) {}
            }
            if ($table === 'toptancilar' || $table === 'suppliers') {
                try {
                    $chk = $pdo->prepare("SELECT `bakiye` FROM `toptancilar` WHERE `id` = ?");
                    $chk->execute([$id]);
                    $bal = (float)$chk->fetchColumn();
                    if (abs($bal) > 0.005) {
                        echo json_encode(['success' => false, 'message' => "Bakiyesi 0 olmayan toptancı silinemez! Mevcut Bakiye: ₺" . number_format($bal, 2) . ". Lütfen önce cari hesabı sıfırlayınız."]);
                        exit;
                    }
                } catch (Exception $e) {}
            }

            $stmt = $pdo->prepare("DELETE FROM `$table` WHERE `id` = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true, 'message' => "Kayıt veritabanından başarıyla silindi."]);
            exit;
        }
    }
    echo json_encode(['success' => false, 'message' => 'Geçersiz parametre!']);
    exit;
}

// ========================================================
// 3.3 AKTİF GARSONLARI GETİR & PIN DOĞRULA (Garson Terminali)
// ========================================================
if ($action === 'get_active_waiters') {
    if ($useMysql) {
        $waiters = $pdo->query("SELECT `id`, `ad` as name, `rol` as role, `pozisyon` as position, `telefon` as phone, `pin`, `qr_token` as qrToken 
                                FROM `personeller` 
                                WHERE `aktif` = 1 AND `pin` IS NOT NULL AND `pin` != '' 
                                ORDER BY `ad` ASC")->fetchAll();
        echo json_encode(['success' => true, 'waiters' => $waiters], JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        $emps = $db['employees'] ?? [];
        $activeWaiters = array_values(array_filter($emps, function($e) {
            return ($e['isActive'] ?? true) && !empty($e['pin']);
        }));
        echo json_encode(['success' => true, 'waiters' => $activeWaiters], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

if ($action === 'verify_waiter_pin' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    // ====================================================================
    // GÜVENLİK: Giriş yalnızca DAHA ÖNCE EŞLEŞTİRİLMİŞ bir cihazdan ve
    // sisteme tanımlı, aktif bir garson hesabıyla yapılabilir.
    // Önceki kodda iki açık vardı:
    //   1) PIN '1234' her zaman kabul ediliyordu (herkesin bildiği atlama kodu).
    //   2) PIN doğruysa cihaz OTOMATİK olarak garsona bağlanıyordu; yani
    //      eşleştirme adımı tamamen atlanabiliyordu.
    // ====================================================================
    $input = json_decode(file_get_contents('php://input'), true);
    $pin = trim($input['pin'] ?? '');
    $waiterId = trim($input['waiterId'] ?? '');
    $deviceUuid = trim($input['device_uuid'] ?? ($_SERVER['HTTP_X_DEVICE_UUID'] ?? ''));
    $deviceTokenIn = trim($input['device_token'] ?? ($_SERVER['HTTP_X_DEVICE_TOKEN'] ?? ''));

    if ($pin === '') {
        echo json_encode(['success' => false, 'message' => 'Lütfen PIN kodunuzu girin!'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($deviceUuid === '' && $deviceTokenIn === '') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Bu cihaz tanımlı değil. Önce kasadan QR ile eşleştirin.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($useMysql) {
        // 1) Cihazı tanı: yalnızca eşleştirilmiş cihaz giriş yapabilir.
        $deviceOwnerId = null;
        try {
            if ($deviceTokenIn !== '') {
                $tokHash = hash('sha256', $deviceTokenIn);
                $dStmt = $pdo->prepare("SELECT `id` FROM `personeller` WHERE `device_token_hash` = ? AND `aktif` = 1 UNION SELECT `id` FROM `users` WHERE `device_token_hash` = ? AND `aktif` = 1 LIMIT 1");
                $dStmt->execute([$tokHash, $tokHash]);
                $deviceOwnerId = $dStmt->fetchColumn() ?: null;
            }
            if (!$deviceOwnerId && $deviceUuid !== '') {
                $dStmt = $pdo->prepare("SELECT `id` FROM `personeller` WHERE `device_uuid` = ? AND `aktif` = 1 UNION SELECT `id` FROM `users` WHERE `device_uuid` = ? AND `aktif` = 1 LIMIT 1");
                $dStmt->execute([$deviceUuid, $deviceUuid]);
                $deviceOwnerId = $dStmt->fetchColumn() ?: null;
            }
        } catch (Exception $e) {}

        if (!$deviceOwnerId) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Bu cihaz herhangi bir garsona tanımlı değil. Kasadan QR ile eşleştirin.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        if ($waiterId !== '' && $waiterId !== (string)$deviceOwnerId) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Bu cihaz başka bir garsona tanımlı.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // 2) Kaba kuvvete karşı kilit kontrolü
        try {
            $lockStmt = $pdo->prepare("SELECT `pin_denemesi`, `pin_kilit_bitis` FROM `personeller` WHERE `id` = ? LIMIT 1");
            $lockStmt->execute([$deviceOwnerId]);
            $lockRow = $lockStmt->fetch(PDO::FETCH_ASSOC);
            if ($lockRow && !empty($lockRow['pin_kilit_bitis']) && strtotime($lockRow['pin_kilit_bitis']) > time()) {
                $kalan = max(1, (int)ceil((strtotime($lockRow['pin_kilit_bitis']) - time()) / 60));
                http_response_code(429);
                echo json_encode(['success' => false, 'message' => "Çok fazla hatalı deneme. {$kalan} dakika sonra tekrar deneyin."], JSON_UNESCAPED_UNICODE);
                exit;
            }
        } catch (Exception $e) {}

        // 3) PIN doğrulaması: yalnızca cihazın sahibi olan garson için
        $stmt = $pdo->prepare("
            SELECT `id`, `ad` as name, `rol` as role, `pin`
            FROM `personeller`
            WHERE `id` = ? AND `aktif` = 1
            UNION
            SELECT `id`, `ad_soyad` as name, `rol` as role, `pin_kodu` as pin
            FROM `users`
            WHERE `id` = ? AND `aktif` = 1
            LIMIT 1
        ");
        $stmt->execute([$deviceOwnerId, $deviceOwnerId]);
        $w = $stmt->fetch(PDO::FETCH_ASSOC);

        // Sabit '1234' atlama kodu KALDIRILDI. PIN'i tanımsız olan hesap giriş yapamaz.
        if ($w && !empty($w['pin']) && hash_equals((string)$w['pin'], $pin)) {
            try {
                $pdo->prepare("UPDATE `personeller` SET `pin_denemesi` = 0, `pin_kilit_bitis` = NULL WHERE `id` = ?")->execute([$w['id']]);
                $pdo->prepare("UPDATE `cihazlar` SET `son_gorulme` = NOW() WHERE `waiter_id` = ?")->execute([$w['id']]);
            } catch (Exception $e) {}

            // PIN yanıtta döndürülmez.
            echo json_encode([
                'success' => true,
                'waiter' => [
                    'id' => $w['id'],
                    'name' => $w['name'],
                    'role' => $w['role'] ?? 'WAITER'
                ],
                'token' => 'WTR-' . bin2hex(random_bytes(16))
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // 4) Hatalı deneme: 5 denemeden sonra 10 dakika kilit
        try {
            $pdo->prepare("UPDATE `personeller` SET `pin_denemesi` = `pin_denemesi` + 1 WHERE `id` = ?")->execute([$deviceOwnerId]);
            $cntStmt = $pdo->prepare("SELECT `pin_denemesi` FROM `personeller` WHERE `id` = ? LIMIT 1");
            $cntStmt->execute([$deviceOwnerId]);
            $deneme = (int)$cntStmt->fetchColumn();
            if ($deneme >= 5) {
                $pdo->prepare("UPDATE `personeller` SET `pin_denemesi` = 0, `pin_kilit_bitis` = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE `id` = ?")->execute([$deviceOwnerId]);
                http_response_code(429);
                echo json_encode(['success' => false, 'message' => 'Çok fazla hatalı deneme. Giriş 10 dakika kilitlendi.'], JSON_UNESCAPED_UNICODE);
                exit;
            }
        } catch (Exception $e) {}

        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Geçersiz PIN kodu.'], JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        // JSON dosya modu: cihaz yine önceden eşleşmiş olmalı.
        $paired = $db['paired_devices'] ?? [];
        $ownerId = null;
        foreach ($paired as $wid => $info) {
            $uuidMatch = $deviceUuid !== '' && (($info['device_uuid'] ?? $info['deviceUuid'] ?? '') === $deviceUuid);
            $tokenMatch = $deviceTokenIn !== '' && !empty($info['device_token_hash']) && hash_equals($info['device_token_hash'], hash('sha256', $deviceTokenIn));
            if ($uuidMatch || $tokenMatch) { $ownerId = (string)$wid; break; }
        }
        if ($ownerId === null) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Bu cihaz tanımlı değil. Kasadan QR ile eşleştirin.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        foreach (($db['employees'] ?? []) as $e) {
            if ((string)($e['id'] ?? '') !== $ownerId) continue;
            if (!($e['isActive'] ?? true)) break;
            if (!empty($e['pin']) && hash_equals((string)$e['pin'], $pin)) {
                echo json_encode([
                    'success' => true,
                    'waiter' => [
                        'id' => $e['id'],
                        'name' => $e['name'] ?? $e['fullName'] ?? 'Garson',
                        'role' => 'WAITER'
                    ],
                    'token' => 'WTR-' . bin2hex(random_bytes(16))
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            break;
        }

        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Geçersiz PIN kodu.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ========================================================
// 4. CANLI VERİYİ DÖN (get_live_state - Garson & Kasa İçin)
// ========================================================
if ($action === 'get_live_state') {
    if ($useMysql) {
        $sections = $pdo->query("SELECT `id`, `ad` as name, `masa_sayisi` as tableCount, `kapasite_kisi` as capacityPerTable FROM `bolumler` ORDER BY `sira` ASC")->fetchAll();
        
        // Eğer bölümler boşsa varsayılan salonları yükle
        if (empty($sections)) {
            $defaultSecs = [
                ['id' => 'sec-salon', 'ad' => 'Ana Salon', 'masa_sayisi' => 12, 'kapasite_kisi' => 4, 'sira' => 1],
                ['id' => 'sec-bahce', 'ad' => 'Bahçe', 'masa_sayisi' => 10, 'kapasite_kisi' => 6, 'sira' => 2],
                ['id' => 'sec-paket', 'ad' => 'Paket Servis', 'masa_sayisi' => 8, 'kapasite_kisi' => 1, 'sira' => 3]
            ];
            $stmt = $pdo->prepare("INSERT IGNORE INTO `bolumler` (`id`, `ad`, `masa_sayisi`, `kapasite_kisi`, `sira`) VALUES (?, ?, ?, ?, ?)");
            foreach ($defaultSecs as $ds) {
                $stmt->execute([$ds['id'], $ds['ad'], $ds['masa_sayisi'], $ds['kapasite_kisi'], $ds['sira']]);
            }
            $sections = $pdo->query("SELECT `id`, `ad` as name, `masa_sayisi` as tableCount, `kapasite_kisi` as capacityPerTable FROM `bolumler` ORDER BY `sira` ASC")->fetchAll();
        }

        $tableRows = $pdo->query("SELECT `id`, `bolum_id` as sectionId, `ad` as name, `durum` as status, `aktif_siparis` as activeOrder, `toplam_tutar` as totalAmount FROM `masalar` ORDER BY `id` ASC")->fetchAll();
        
        // Eğer masalar tablosu boşsa veya bölümlerin masaları eksikse otomatik üret ve ekle
        if (empty($tableRows) && !empty($sections)) {
            $insertTbl = $pdo->prepare("INSERT IGNORE INTO `masalar` (`id`, `bolum_id`, `ad`, `durum`, `aktif_siparis`, `toplam_tutar`) VALUES (?, ?, ?, 'EMPTY', NULL, 0.00)");
            foreach ($sections as $s) {
                $count = (int)($s['tableCount'] ?: 10);
                for ($i = 1; $i <= $count; $i++) {
                    $tId = 'tbl-' . $s['id'] . '-' . $i;
                    $tName = $s['name'] . ' ' . $i;
                    $insertTbl->execute([$tId, $s['id'], $tName]);
                }
            }
            $tableRows = $pdo->query("SELECT `id`, `bolum_id` as sectionId, `ad` as name, `durum` as status, `aktif_siparis` as activeOrder, `toplam_tutar` as totalAmount FROM `masalar` ORDER BY `id` ASC")->fetchAll();
        }

        $tables = [];
        foreach ($tableRows as $tr) {
            $order = !empty($tr['activeOrder']) ? json_decode($tr['activeOrder'], true) : null;
            $secName = '';
            foreach ($sections as $s) {
                if ($s['id'] === $tr['sectionId']) {
                    $secName = $s['name'];
                    break;
                }
            }
            $tables[] = [
                'id' => $tr['id'],
                'sectionId' => $tr['sectionId'],
                'sectionName' => $secName,
                'name' => $tr['name'],
                'status' => $tr['status'],
                'order' => $order
            ];
        }
        sort_tables_naturally_php($tables, $sections);

        $categories = $pdo->query("SELECT `id`, `ad` as name, `renk` as color, `yazici_id` as printerId FROM `kategoriler` ORDER BY `sira` ASC")->fetchAll();
        $products = $pdo->query("SELECT `id`, `kategori_id` as categoryId, `ad` as name, `fiyat` as price, `hazirlik_dk` as preparationMin, `barkod` as barcode, `yazici_id` as printerId, `aktif` as isAvailable, `aciklama` as description, `resim_url` as imageUrl FROM `urunler` WHERE `aktif` = 1")->fetchAll();
        
        // Ürün fiyat ve boolean dönüşümleri
        foreach ($products as &$p) {
            $p['price'] = (float)$p['price'];
            $p['preparationMin'] = (int)$p['preparationMin'];
            $p['isAvailable'] = (bool)$p['isAvailable'];
        }

        $lastUpdatedStmt = $pdo->query("SELECT `deger` FROM `ayarlar` WHERE `anahtar` = 'last_updated'");
        $lastUpdated = (int)($lastUpdatedStmt->fetchColumn() ?: time());

        echo json_encode([
            'success' => true,
            'sections' => $sections,
            'tables' => $tables,
            'products' => $products,
            'categories' => $categories,
            'last_updated' => $lastUpdated,
            'mode' => 'MYSQL'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        $sections = !empty($db['sections']) ? $db['sections'] : [
            ['id' => 'sec-salon', 'name' => 'Ana Salon', 'tableCount' => 12, 'capacityPerTable' => 4],
            ['id' => 'sec-bahce', 'name' => 'Bahçe', 'tableCount' => 10, 'capacityPerTable' => 6],
            ['id' => 'sec-paket', 'name' => 'Paket Servis', 'tableCount' => 8, 'capacityPerTable' => 1]
        ];
        
        $tables = !empty($db['tables']) ? $db['tables'] : [];
        if (empty($tables) && !empty($sections)) {
            foreach ($sections as $s) {
                $count = (int)($s['tableCount'] ?? 10);
                for ($i = 1; $i <= $count; $i++) {
                    $tables[] = [
                        'id' => 'tbl-' . $s['id'] . '-' . $i,
                        'sectionId' => $s['id'],
                        'sectionName' => $s['name'],
                        'name' => $s['name'] . ' ' . $i,
                        'status' => 'EMPTY',
                        'order' => null
                    ];
                }
            }
        }

        $defaultCategories = [
            ['id' => 'cat-kebap', 'name' => 'Kebaplar & Izgaralar', 'color' => '#ef4444'],
            ['id' => 'cat-firin', 'name' => 'Pide & Lahmacun', 'color' => '#f59e0b'],
            ['id' => 'cat-corba', 'name' => 'Çorbalar & Mezeler', 'color' => '#3b82f6'],
            ['id' => 'cat-icecek', 'name' => 'İçecekler & Meşrubat', 'color' => '#10b981'],
            ['id' => 'cat-tatli', 'name' => 'Tatlılar & Meyve', 'color' => '#8b5cf6']
        ];
        $defaultProducts = [
            ['id' => 'p-1', 'name' => 'Adana Kebap (Porsiyon)', 'categoryId' => 'cat-kebap', 'price' => 320, 'isAvailable' => true, 'preparationMin' => 15],
            ['id' => 'p-2', 'name' => 'Urfa Kebap (Porsiyon)', 'categoryId' => 'cat-kebap', 'price' => 320, 'isAvailable' => true, 'preparationMin' => 15],
            ['id' => 'p-3', 'name' => 'Kuzu Şiş Kebap', 'categoryId' => 'cat-kebap', 'price' => 380, 'isAvailable' => true, 'preparationMin' => 18],
            ['id' => 'p-4', 'name' => 'Ali Nazik Kebap', 'categoryId' => 'cat-kebap', 'price' => 390, 'isAvailable' => true, 'preparationMin' => 20],
            ['id' => 'p-5', 'name' => 'Antep Lahmacun', 'categoryId' => 'cat-firin', 'price' => 110, 'isAvailable' => true, 'preparationMin' => 10],
            ['id' => 'p-6', 'name' => 'Kuşbaşılı Kaşarlı Pide', 'categoryId' => 'cat-firin', 'price' => 280, 'isAvailable' => true, 'preparationMin' => 15],
            ['id' => 'p-7', 'name' => 'Kıymalı Kaşarlı Pide', 'categoryId' => 'cat-firin', 'price' => 260, 'isAvailable' => true, 'preparationMin' => 15],
            ['id' => 'p-8', 'name' => 'Açık Yayık Ayranı', 'categoryId' => 'cat-icecek', 'price' => 40, 'isAvailable' => true, 'preparationMin' => 2],
            ['id' => 'p-9', 'name' => 'Kutu Meşrubat / Şalgam', 'categoryId' => 'cat-icecek', 'price' => 45, 'isAvailable' => true, 'preparationMin' => 2],
            ['id' => 'p-10', 'name' => 'Antep Fıstıklı Katmer', 'categoryId' => 'cat-tatli', 'price' => 220, 'isAvailable' => true, 'preparationMin' => 12]
        ];

        $categories = !empty($db['categories']) ? $db['categories'] : $defaultCategories;
        $products = !empty($db['products']) ? $db['products'] : $defaultProducts;

        echo json_encode([
            'success' => true,
            'sections' => $sections,
            'tables' => $tables,
            'products' => $products,
            'categories' => $categories,
            'last_updated' => $db['last_updated'] ?? 0,
            'mode' => 'JSON'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ========================================================
// 5. SİPARİŞ / HESAP İSTEĞİ / MASA TAŞIMA (send_order)
// ========================================================
if ($action === 'send_order' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input) {
        $type = $input['type'] ?? 'ORDER';
        $orderId = 'ord-' . time() . '-' . rand(100, 999);

        if ($useMysql) {
            if ($type === 'BILL_REQUEST') {
                $stmt = $pdo->prepare("UPDATE `masalar` SET `durum` = 'BILL_REQUESTED' WHERE `id` = ?");
                $stmt->execute([$input['tableId']]);

                $stmt = $pdo->prepare("INSERT INTO `siparisler` (`id`, `masa_id`, `masa_adi`, `siparis_turu`, `kalemler`, `toplam_tutar`, `yazdirildi`, `durum`) 
                                       VALUES (?, ?, ?, 'BILL_REQUEST', '[]', 0, 0, 'NEW')");
                $stmt->execute(['req-' . time(), $input['tableId'], $input['tableName'] ?? 'Masa']);
            } elseif ($type === 'TRANSFER_TABLE') {
                $srcId = $input['sourceTableId'];
                $tgtId = $input['targetTableId'];

                $stmt = $pdo->prepare("SELECT `aktif_siparis`, `toplam_tutar` FROM `masalar` WHERE `id` = ?");
                $stmt->execute([$srcId]);
                $src = $stmt->fetch();

                if ($src && !empty($src['aktif_siparis'])) {
                    // Kaynak masayı boşalt
                    $pdo->prepare("UPDATE `masalar` SET `durum` = 'EMPTY', `aktif_siparis` = NULL, `toplam_tutar` = 0 WHERE `id` = ?")->execute([$srcId]);
                    // Hedef masaya aktar
                    $pdo->prepare("UPDATE `masalar` SET `durum` = 'OCCUPIED', `aktif_siparis` = ?, `toplam_tutar` = ? WHERE `id` = ?")->execute([
                        $src['aktif_siparis'],
                        $src['toplam_tutar'],
                        $tgtId
                    ]);
                }
            } elseif ($type === 'WAITER_CALL') {
                $stmt = $pdo->prepare("INSERT INTO `siparisler` (`id`, `masa_id`, `masa_adi`, `garson_adi`, `siparis_turu`, `kalemler`, `toplam_tutar`, `yazdirildi`, `durum`, `olusturma_tarihi`) 
                                       VALUES (?, ?, ?, 'MÜŞTERİ', 'WAITER_CALL', '[]', 0, 0, 'NEW', NOW())");
                $stmt->execute(['call-' . time(), $input['tableId'], $input['tableName'] ?? 'Masa']);
            } else {
                // Standart Yemek Siparişi
                $newItems = $input['items'] ?? [];
                $orderTotal = 0;
                foreach ($newItems as $it) {
                    $orderTotal += ((float)($it['price'] ?? 0)) * ((int)($it['quantity'] ?? 1));
                }
                if (!empty($input['totalAmount'])) {
                    $orderTotal = (float)$input['totalAmount'];
                }

                // Masadaki mevcut açık adisyonu al ve birleştir
                $existingItems = [];
                $existingTotal = 0.0;
                $stmtExist = $pdo->prepare("SELECT `aktif_siparis`, `toplam_tutar` FROM `masalar` WHERE `id` = ?");
                $stmtExist->execute([$input['tableId']]);
                $curRow = $stmtExist->fetch();
                if ($curRow && !empty($curRow['aktif_siparis'])) {
                    $parsed = json_decode($curRow['aktif_siparis'], true);
                    if (isset($parsed['items']) && is_array($parsed['items'])) {
                        $existingItems = $parsed['items'];
                        $existingTotal = (float)($curRow['toplam_tutar'] ?? 0);
                    }
                }

                $combinedItems = array_merge($existingItems, $newItems);
                $combinedTotal = $existingTotal + $orderTotal;

                $orderData = [
                    'id' => $orderId,
                    'tableId' => $input['tableId'],
                    'tableName' => $input['tableName'] ?? 'Masa',
                    'waiterName' => $input['waiterName'] ?? 'Garson',
                    'items' => $combinedItems,
                    'totalAmount' => $combinedTotal,
                    'createdAt' => date('Y-m-d H:i:s'),
                    'printed' => false
                ];

                // Sipariş tablosuna sadece bu turda gelen kalemleri ekle (Mutfak fişi için)
                $stmt = $pdo->prepare("INSERT INTO `siparisler` (`id`, `masa_id`, `masa_adi`, `garson_adi`, `siparis_turu`, `kalemler`, `toplam_tutar`, `yazdirildi`, `durum`, `olusturma_tarihi`) 
                                       VALUES (?, ?, ?, ?, 'ORDER', ?, ?, 0, 'NEW', NOW())");
                $stmt->execute([
                    $orderId,
                    $input['tableId'],
                    $input['tableName'] ?? 'Masa',
                    $input['waiterName'] ?? 'Garson',
                    json_encode($newItems, JSON_UNESCAPED_UNICODE),
                    $orderTotal
                ]);

                // Masanın anlık durumunu güncelle (Birleştirilmiş tüm adisyon)
                $stmt = $pdo->prepare("UPDATE `masalar` SET `durum` = 'OCCUPIED', `aktif_siparis` = ?, `toplam_tutar` = ? WHERE `id` = ?");
                $stmt->execute([
                    json_encode($orderData, JSON_UNESCAPED_UNICODE),
                    $combinedTotal,
                    $input['tableId']
                ]);
            }

            $pdo->prepare("INSERT INTO `ayarlar` (`anahtar`, `deger`) VALUES ('last_updated', ?) ON DUPLICATE KEY UPDATE `deger` = VALUES(`deger`)")->execute([time()]);
            echo json_encode(['success' => true, 'orderId' => $orderId, 'mode' => 'MYSQL']);
            exit;
        } else {
            // JSON modu
            if ($type === 'BILL_REQUEST') {
                if (!empty($db['tables'])) {
                    foreach ($db['tables'] as &$tbl) {
                        if ($tbl['id'] === $input['tableId']) {
                            $tbl['status'] = 'BILL_REQUESTED';
                            break;
                        }
                    }
                }
                $input['id'] = 'req-' . time();
                $db['orders'][] = $input;
            } elseif ($type === 'TRANSFER_TABLE') {
                $srcId = $input['sourceTableId'];
                $tgtId = $input['targetTableId'];
                $savedOrder = null;
                if (!empty($db['tables'])) {
                    foreach ($db['tables'] as &$tbl) {
                        if ($tbl['id'] === $srcId) {
                            $savedOrder = $tbl['order'] ?? null;
                            $tbl['status'] = 'EMPTY';
                            $tbl['order'] = null;
                            break;
                        }
                    }
                    if ($savedOrder) {
                        foreach ($db['tables'] as &$tbl) {
                            if ($tbl['id'] === $tgtId) {
                                $tbl['status'] = 'OCCUPIED';
                                $tbl['order'] = $savedOrder;
                                break;
                            }
                        }
                    }
                }
                $db['orders'][] = $input;
            } else {
                $order = [
                    'id' => $orderId,
                    'tableId' => $input['tableId'],
                    'tableName' => $input['tableName'] ?? 'Masa',
                    'waiterName' => $input['waiterName'] ?? 'Garson',
                    'items' => $input['items'] ?? [],
                    'totalAmount' => $input['totalAmount'] ?? 0,
                    'createdAt' => date('Y-m-d H:i:s'),
                    'printed' => false
                ];
                $db['orders'][] = $order;
                if (!empty($db['tables'])) {
                    foreach ($db['tables'] as &$tbl) {
                        if ($tbl['id'] === $input['tableId']) {
                            $tbl['status'] = 'OCCUPIED';
                            $tbl['order'] = $order;
                            break;
                        }
                    }
                }
            }
            $db['last_updated'] = time();
            file_put_contents($dbFile, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo json_encode(['success' => true, 'orderId' => $orderId, 'mode' => 'JSON']);
            exit;
        }
    }
}

// ========================================================
// 6. KASA BEKLEYEN SİPARİŞLERİ ÇEKER (pull_pending_orders)
// ========================================================
if ($action === 'pull_pending_orders') {
    if ($useMysql) {
        $stmt = $pdo->query("SELECT `id`, `masa_id` as tableId, `masa_adi` as tableName, `garson_adi` as waiterName, `kalemler` as items, `toplam_tutar` as totalAmount, `siparis_turu` as type, `olusturma_tarihi` as createdAt 
                             FROM `siparisler` 
                             WHERE `yazdirildi` = 0 
                             ORDER BY `olusturma_tarihi` ASC");
        $rows = $stmt->fetchAll();
        $pending = [];
        $idsToMark = [];

        foreach ($rows as $r) {
            $r['items'] = json_decode($r['kalemler'], true) ?: [];
            unset($r['kalemler']);
            $r['totalAmount'] = (float)$r['totalAmount'];
            $pending[] = $r;
            $idsToMark[] = $r['id'];
        }

        if (!empty($idsToMark)) {
            $inClause = implode(',', array_fill(0, count($idsToMark), '?'));
            $updateStmt = $pdo->prepare("UPDATE `siparisler` SET `yazdirildi` = 1 WHERE `id` IN ($inClause)");
            $updateStmt->execute($idsToMark);
        }

        echo json_encode(['success' => true, 'orders' => $pending, 'mode' => 'MYSQL']);
        exit;
    } else {
        $pending = [];
        if (!empty($db['orders'])) {
            foreach ($db['orders'] as &$ord) {
                if (empty($ord['printed'])) {
                    $pending[] = $ord;
                    $ord['printed'] = true;
                }
            }
            file_put_contents($dbFile, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }
        echo json_encode(['success' => true, 'orders' => $pending, 'mode' => 'JSON']);
        exit;
    }
}

// ========================================================
// 7. ONLINE YEMEK PLATFORMLARI (Trendyol / Getir / Yemeksepeti)
// ========================================================
if ($action === 'platform_webhook' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input) {
        $platform = strtoupper($input['platform'] ?? 'TRENDYOL');
        $code = $input['platformCode'] ?? ($platform === 'TRENDYOL' ? '#TY-' : ($platform === 'GETIR' ? '#GT-' : '#YS-')) . rand(1000, 9999);
        $deliveryModel = strtoupper($input['deliveryModel'] ?? 'RESTAURANT');
        if (!in_array($deliveryModel, ['RESTAURANT', 'PLATFORM'])) $deliveryModel = 'RESTAURANT';

        $orderId = 'ord-' . time() . '-' . rand(100, 999);
        $totalAmount = (float)($input['totalAmount'] ?? 0);
        $itemsJson = json_encode($input['items'] ?? [], JSON_UNESCAPED_UNICODE);

        if ($useMysql) {
            $stmt = $pdo->prepare("INSERT INTO `online_siparisler` (`id`, `platform`, `platform_kodu`, `teslimat_modeli`, `musteri_adi`, `musteri_telefon`, `adres`, `siparis_notu`, `kalemler`, `toplam_tutar`, `odeme_yontemi`, `durum`, `olusturma_tarihi`) 
                                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', NOW())");
            $stmt->execute([
                $orderId,
                $platform,
                $code,
                $deliveryModel,
                $input['customerName'] ?? 'Online Müşteri',
                $input['customerPhone'] ?? '0532 555 00 00',
                $input['address'] ?? 'Şehitkamil / Gaziantep',
                $input['orderNote'] ?? '',
                $itemsJson,
                $totalAmount,
                $input['paymentMethod'] ?? ($platform . ' Online Ödeme')
            ]);

            echo json_encode([
                'success' => true,
                'order' => [
                    'id' => $orderId,
                    'platform' => $platform,
                    'platformCode' => $code,
                    'totalAmount' => $totalAmount,
                    'status' => 'NEW'
                ],
                'message' => 'Platform siparişi MySQL veritabanına işlendi.'
            ]);
            exit;
        } else {
            if (!isset($db['online_orders'])) $db['online_orders'] = [];
            $newOrder = [
                'id' => $orderId,
                'platform' => $platform,
                'platformCode' => $code,
                'deliveryModel' => $deliveryModel,
                'customerName' => $input['customerName'] ?? 'Online Müşteri',
                'customerPhone' => $input['customerPhone'] ?? '0532 555 00 00',
                'address' => $input['address'] ?? 'Şehitkamil / Gaziantep',
                'orderNote' => $input['orderNote'] ?? '',
                'items' => $input['items'] ?? [],
                'totalAmount' => $totalAmount,
                'paymentMethod' => $input['paymentMethod'] ?? ($platform . ' Online Ödeme'),
                'status' => 'NEW',
                'createdAt' => date('H:i')
            ];
            array_unshift($db['online_orders'], $newOrder);
            $db['online_orders'] = array_slice($db['online_orders'], 0, 100);
            file_put_contents($dbFile, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo json_encode(['success' => true, 'order' => $newOrder, 'message' => 'Platform siparişi alındı.']);
            exit;
        }
    }
}

if ($action === 'get_online_orders') {
    if ($useMysql) {
        $stmt = $pdo->query("SELECT `id`, `platform`, `platform_kodu` as platformCode, `teslimat_modeli` as deliveryModel, `musteri_adi` as customerName, `musteri_telefon` as customerPhone, `adres` as address, `siparis_notu` as orderNote, `kalemler` as items, `toplam_tutar` as totalAmount, `odeme_yontemi` as paymentMethod, `durum` as status, `red_nedeni` as rejectionReason, `hazirlik_suresi` as preparationTimeMinutes, `olusturma_tarihi` as createdAt 
                             FROM `online_siparisler` 
                             ORDER BY `olusturma_tarihi` DESC 
                             LIMIT 100");
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['items'] = json_decode($r['items'], true) ?: [];
            $r['totalAmount'] = (float)$r['totalAmount'];
        }
        echo json_encode(['success' => true, 'orders' => $rows, 'mode' => 'MYSQL']);
        exit;
    } else {
        echo json_encode(['success' => true, 'orders' => $db['online_orders'] ?? [], 'mode' => 'JSON']);
        exit;
    }
}

if ($action === 'update_platform_order_status' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input && !empty($input['orderId'])) {
        $orderId = $input['orderId'];
        $newStatus = $input['status'] ?? 'ACCEPTED';
        $prepTime = $input['preparationTimeMinutes'] ?? 25;
        $reason = $input['rejectionReason'] ?? '';

        if ($useMysql) {
            $stmt = $pdo->prepare("UPDATE `online_siparisler` SET `durum` = ?, `hazirlik_suresi` = ?, `red_nedeni` = ?, `guncelleme_tarihi` = NOW() WHERE `id` = ?");
            $stmt->execute([$newStatus, $prepTime, $reason, $orderId]);
        } else {
            if (!empty($db['online_orders'])) {
                foreach ($db['online_orders'] as &$ord) {
                    if ($ord['id'] === $orderId) {
                        $ord['status'] = $newStatus;
                        $ord['rejectionReason'] = $reason;
                        $ord['preparationTimeMinutes'] = $prepTime;
                        $ord['updatedAt'] = date('Y-m-d H:i:s');
                        break;
                    }
                }
                file_put_contents($dbFile, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            }
        }

        echo json_encode([
            'success' => true,
            'message' => 'Platform sipariş durumu güncellendi.',
            'status' => $newStatus
        ]);
        exit;
    }
}

// ========================================================
// 8. PATRON GİRİŞİ (boss_login) & PAROLA DEĞİŞTİRME & ÖZET RAPORLAR
// ========================================================
if ($action === 'boss_login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $pwd = trim($input['password'] ?? '');
    $deviceFp = $input['deviceFingerprint'] ?? '';

    $bossPwd = DEFAULT_BOSS_PASSWORD;
    if ($useMysql) {
        $stmt = $pdo->query("SELECT `deger` FROM `ayarlar` WHERE `anahtar` = 'boss_password'");
        $val = $stmt ? $stmt->fetchColumn() : null;
        if ($val && trim($val) !== '') {
            $bossPwd = trim($val);
        }
    }

    // Kesin doğrulama: Sadece kayıtlı patron parolası ile eşleşirse giriş verilir!
    if ($pwd !== '' && $pwd === $bossPwd) {
        $token = 'BOSS-' . md5($deviceFp . time() . 'gtu_salt_' . $bossPwd);
        echo json_encode([
            'success' => true, 
            'token' => $token, 
            'message' => 'Patron girişi başarılı'
        ]);
    } else {
        echo json_encode([
            'success' => false, 
            'message' => 'Hatalı Patron Parolası! Lütfen şifrenizi kontrol ediniz.'
        ]);
    }
    exit;
}

if ($action === 'change_boss_password' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $currentPwd = trim($input['currentPassword'] ?? '');
    $newPwd = trim($input['newPassword'] ?? '');

    $bossPwd = DEFAULT_BOSS_PASSWORD;
    if ($useMysql) {
        $stmt = $pdo->query("SELECT `deger` FROM `ayarlar` WHERE `anahtar` = 'boss_password'");
        $val = $stmt ? $stmt->fetchColumn() : null;
        if ($val && trim($val) !== '') $bossPwd = trim($val);

        if ($currentPwd !== $bossPwd) {
            echo json_encode(['success' => false, 'message' => 'Mevcut patron parolası hatalı!']);
            exit;
        }

        if (strlen($newPwd) < 4) {
            echo json_encode(['success' => false, 'message' => 'Yeni parola en az 4 karakter olmalıdır!']);
            exit;
        }

        $stmt = $pdo->prepare("INSERT INTO `ayarlar` (`anahtar`, `deger`, `aciklama`) VALUES ('boss_password', ?, 'Patron Parolası') ON DUPLICATE KEY UPDATE `deger` = VALUES(`deger`)");
        $stmt->execute([$newPwd]);

        echo json_encode(['success' => true, 'message' => 'Patron parolası başarıyla değiştirildi.']);
        exit;
    } else {
        echo json_encode(['success' => false, 'message' => 'MySQL veritabanı aktif değil!']);
        exit;
    }
}

// Z-Raporları Detaylı Filtreleme ve Ekstre Çekimi
if ($action === 'get_boss_z_reports') {
    $startDate = $_GET['startDate'] ?? '';
    $endDate = $_GET['endDate'] ?? '';

    if ($useMysql) {
        $sql = "SELECT * FROM `z_raporlari` WHERE 1=1";
        $params = [];
        if (!empty($startDate)) {
            $sql .= " AND `tarih` >= ?";
            $params[] = $startDate;
        }
        if (!empty($endDate)) {
            $sql .= " AND `tarih` <= ?";
            $params[] = $endDate;
        }
        $sql .= " ORDER BY `z_no` DESC, `tarih` DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $zList = [];
        $totalRev = 0; $totalCash = 0; $totalCard = 0; $totalOpen = 0;
        $totalMeal = 0; $totalIkram = 0; $totalDiscount = 0; $totalCancel = 0;
        $totalOrders = 0;

        foreach ($rows as $r) {
            $rev = (float)$r['toplam_ciro'];
            $cash = (float)$r['nakit'];
            $card = (float)$r['kredi_karti'];
            $open = (float)$r['veresiye'];
            $meal = (float)$r['yemek_karti'];
            $ikram = (float)$r['ikram'];
            $disc = (float)$r['indirim'];
            $canc = (float)$r['iptal'];
            $ords = (int)$r['adisyon_sayisi'];

            $totalRev += $rev;
            $totalCash += $cash;
            $totalCard += $card;
            $totalOpen += $open;
            $totalMeal += $meal;
            $totalIkram += $ikram;
            $totalDiscount += $disc;
            $totalCancel += $canc;
            $totalOrders += $ords;

            $zList[] = [
                'id' => $r['id'],
                'zNo' => (int)$r['z_no'],
                'date' => $r['tarih'],
                'time' => $r['saat'],
                'closedAt' => $r['kapanis_zamani'],
                'totalRevenue' => $rev,
                'cashTotal' => $cash,
                'posTotal' => $card,
                'openAccountTotal' => $open,
                'mealCardTotal' => $meal,
                'ikramTotal' => $ikram,
                'discountTotal' => $disc,
                'cancelTotal' => $canc,
                'orderCount' => $ords,
                'closedBy' => $r['kapatan'],
                'notes' => $r['notlar'],
                'details' => !empty($r['detay_json']) ? json_decode($r['detay_json'], true) : null
            ];
        }

        echo json_encode([
            'success' => true,
            'zReports' => $zList,
            'summary' => [
                'totalRevenue' => $totalRev,
                'cashTotal' => $totalCash,
                'posTotal' => $totalCard,
                'openAccountTotal' => $totalOpen,
                'mealCardTotal' => $totalMeal,
                'ikramTotal' => $totalIkram,
                'discountTotal' => $totalDiscount,
                'cancelTotal' => $totalCancel,
                'orderCount' => $totalOrders,
                'count' => count($zList)
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        $zList = $db['zReports'] ?? [];
        echo json_encode(['success' => true, 'zReports' => $zList, 'summary' => []]);
        exit;
    }
}

// Müşteri & Cari Genel Bakış (Patron için)
if ($action === 'get_customers_overview') {
    if ($useMysql) {
        $customers = $pdo->query("SELECT `id`, `ad` as name, `telefon` as phone, `email`, `adres` as address, `notlar` as notes, `bakiye` as balance FROM `musteriler` ORDER BY `ad` ASC")->fetchAll();
        foreach ($customers as &$c) {
            $c['balance'] = (float)$c['balance'];
        }
        $transactions = $pdo->query("SELECT `id`, `musteri_id` as customerId, `tip` as type, `tutar` as amount, `odeme_yontemi` as paymentMethod, `tarih` as date, `aciklama` as description FROM `cari_hareketler` ORDER BY `tarih` DESC LIMIT 500")->fetchAll();
        foreach ($transactions as &$tx) {
            $tx['amount'] = (float)$tx['amount'];
        }
        echo json_encode(['success' => true, 'customers' => $customers, 'transactions' => $transactions], JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        echo json_encode(['success' => true, 'customers' => $db['customers'] ?? [], 'transactions' => $db['customerTransactions'] ?? []]);
        exit;
    }
}

// Personel & Maaş Genel Bakış (Patron için)
if ($action === 'get_employees_overview') {
    if ($useMysql) {
        $employees = $pdo->query("SELECT `id`, `ad` as fullName, `rol` as role, `pozisyon` as position, `telefon` as phone, `maas` as salary, `maas_gunu` as salaryPaymentDay, `calisma_saati` as dailyWorkHours, `mesai_carpani` as overtimeMultiplier, `iban`, `bakiye` as balance, `pin`, `qr_token` as qrToken, `aktif` as isActive, `baslangic_tarihi` as startDate FROM `personeller` ORDER BY `ad` ASC")->fetchAll();
        foreach ($employees as &$emp) {
            $emp['salary'] = (float)$emp['salary'];
            $emp['balance'] = (float)$emp['balance'];
            $emp['dailyWorkHours'] = (float)$emp['dailyWorkHours'];
            $emp['overtimeMultiplier'] = (float)$emp['overtimeMultiplier'];
            $emp['isActive'] = (bool)$emp['isActive'];
        }
        $payments = $pdo->query("SELECT `id`, `personel_id` as employeeId, `tip` as type, `tutar` as amount, `odeme_yontemi` as paymentMethod, `tarih` as date, `aciklama` as description, `mesai_saati` as overtimeHours, `mesai_carpani` as overtimeMultiplier, `saatlik_ucret` as hourlyRate, `odeme_turu` as payoutType FROM `personel_hareketler` ORDER BY `tarih` DESC LIMIT 500")->fetchAll();
        foreach ($payments as &$p) {
            $p['amount'] = (float)$p['amount'];
        }
        echo json_encode(['success' => true, 'employees' => $employees, 'payments' => $payments], JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        echo json_encode(['success' => true, 'employees' => $db['employees'] ?? [], 'payments' => []]);
        exit;
    }
}

if ($action === 'get_boss_summary') {
    if ($useMysql) {
        $totalTurnover = 0;
        $occupiedTables = 0;
        $totalTables = (int)$pdo->query("SELECT COUNT(*) FROM `masalar`")->fetchColumn();
        
        $occupiedRows = $pdo->query("SELECT `id` as tableId, `ad` as tableName, `durum` as status, `toplam_tutar` as totalAmount, `aktif_siparis` as activeOrder 
                                     FROM `masalar` 
                                     WHERE `durum` IN ('OCCUPIED', 'BILL_REQUESTED')")->fetchAll();
        $occupiedList = [];
        foreach ($occupiedRows as $or) {
            $occupiedTables++;
            $amt = (float)$or['totalAmount'];
            $totalTurnover += $amt;
            $ord = !empty($or['activeOrder']) ? json_decode($or['activeOrder'], true) : [];
            $occupiedList[] = [
                'tableId' => $or['tableId'],
                'tableName' => $or['tableName'],
                'status' => $or['status'],
                'totalAmount' => $amt,
                'waiterName' => $ord['waiterName'] ?? 'Garson',
                'itemCount' => count($ord['items'] ?? []),
                'items' => $ord['items'] ?? []
            ];
        }

        $orderCount = (int)$pdo->query("SELECT COUNT(*) FROM `siparisler`")->fetchColumn();

        // En Çok Satan Ürünler
        $productStats = [];
        $orders = $pdo->query("SELECT `kalemler` FROM `siparisler` ORDER BY `olusturma_tarihi` DESC LIMIT 200")->fetchAll();
        foreach ($orders as $ord) {
            $items = json_decode($ord['kalemler'], true) ?: [];
            foreach ($items as $item) {
                $name = $item['productName'] ?? 'Ürün';
                $qty = (int)($item['quantity'] ?? 1);
                $price = (float)($item['price'] ?? 0);
                if (!isset($productStats[$name])) {
                    $productStats[$name] = ['name' => $name, 'quantity' => 0, 'revenue' => 0];
                }
                $productStats[$name]['quantity'] += $qty;
                $productStats[$name]['revenue'] += ($qty * $price);
            }
        }
        usort($productStats, function($a, $b) {
            return $b['quantity'] <=> $a['quantity'];
        });
        $topProducts = array_slice(array_values($productStats), 0, 5);

        // Son Z Raporu Özeti
        $lastZ = $pdo->query("SELECT `z_no`, `tarih`, `toplam_ciro`, `nakit`, `kredi_karti` FROM `z_raporlari` ORDER BY `z_no` DESC LIMIT 1")->fetch();

        echo json_encode([
            'success' => true,
            'totalTurnover' => $totalTurnover,
            'occupiedTables' => $occupiedTables,
            'totalTables' => $totalTables,
            'orderCount' => $orderCount,
            'occupiedList' => $occupiedList,
            'topProducts' => $topProducts,
            'lastZReport' => $lastZ ?: null,
            'lastUpdated' => date('H:i:s'),
            'mode' => 'MYSQL'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        // Fallback JSON hesabı
        $totalTurnover = 0;
        $occupiedTables = 0;
        $totalTables = count($db['tables'] ?? []);
        $occupiedList = [];

        if (!empty($db['tables'])) {
            foreach ($db['tables'] as $tbl) {
                $status = $tbl['status'] ?? '';
                if ($status === 'OCCUPIED' || $status === 'BILL_REQUESTED') {
                    $occupiedTables++;
                    $amt = !empty($tbl['order']['totalAmount']) ? (float)$tbl['order']['totalAmount'] : 0;
                    $totalTurnover += $amt;
                    $occupiedList[] = [
                        'tableId' => $tbl['id'],
                        'tableName' => $tbl['name'],
                        'status' => $status,
                        'totalAmount' => $amt,
                        'waiterName' => $tbl['order']['waiterName'] ?? 'Garson',
                        'itemCount' => count($tbl['order']['items'] ?? []),
                        'items' => $tbl['order']['items'] ?? []
                    ];
                }
            }
        }

        echo json_encode([
            'success' => true,
            'totalTurnover' => $totalTurnover,
            'occupiedTables' => $occupiedTables,
            'totalTables' => $totalTables,
            'orderCount' => count($db['orders'] ?? []),
            'occupiedList' => $occupiedList,
            'topProducts' => [],
            'lastZReport' => null,
            'lastUpdated' => date('H:i:s'),
            'mode' => 'JSON'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ========================================================
// 4. DİNAMİK DONANIM VE YAZICI YÖNETİMİ API UÇLARI
// ========================================================
if ($action === 'get_printers') {
    if ($useMysql) {
        $prnRows = $pdo->query("SELECT `id`, `ad` as name, `baglanti_turu` as type, `ip_adresi` as ipAddress, `port`, `driver_adi` as usbName, `kagit_genisligi` as paperWidth, `karakter_seti` as codePage, `auto_cut` as autoCut, `buzzer` as beepOnPrint, `yedek_printer_id` as failoverPrinterId, `aktif` as isActive FROM `printers` ORDER BY `ad` ASC")->fetchAll();
        $printers = [];
        foreach ($prnRows as $pr) {
            $pr['autoCut'] = (bool)$pr['autoCut'];
            $pr['beepOnPrint'] = (bool)$pr['beepOnPrint'];
            $pr['isActive'] = (bool)$pr['isActive'];
            $pr['paperWidth'] = (int)$pr['paperWidth'];
            $pr['port'] = (int)$pr['port'];
            $printers[] = $pr;
        }
        echo json_encode(['success' => true, 'printers' => $printers], JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        echo json_encode(['success' => true, 'printers' => $db['printers'] ?? []], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

if ($action === 'save_printer' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input && !empty($input['id'])) {
        if ($useMysql) {
            $stmt = $pdo->prepare("INSERT INTO `printers` (`id`, `ad`, `baglanti_turu`, `ip_adresi`, `port`, `driver_adi`, `kagit_genisligi`, `karakter_seti`, `auto_cut`, `buzzer`, `yedek_printer_id`, `aktif`)
                                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                   ON DUPLICATE KEY UPDATE `ad` = VALUES(`ad`), `baglanti_turu` = VALUES(`baglanti_turu`), `ip_adresi` = VALUES(`ip_adresi`), `port` = VALUES(`port`), `driver_adi` = VALUES(`driver_adi`), `kagit_genisligi` = VALUES(`kagit_genisligi`), `karakter_seti` = VALUES(`karakter_seti`), `auto_cut` = VALUES(`auto_cut`), `buzzer` = VALUES(`buzzer`), `yedek_printer_id` = VALUES(`yedek_printer_id`), `aktif` = VALUES(`aktif`)");
            $stmt->execute([
                $input['id'],
                $input['name'] ?? 'Yazıcı',
                $input['type'] === 'SYSTEM_DRIVER' ? 'SYSTEM_DRIVER' : 'NETWORK_TCP',
                $input['ipAddress'] ?? null,
                $input['port'] ?? 9100,
                $input['usbName'] ?? ($input['driverName'] ?? null),
                $input['paperWidth'] ?? 80,
                $input['codePage'] ?? 'PC857',
                !empty($input['autoCut']) ? 1 : 0,
                !empty($input['beepOnPrint']) ? 1 : 0,
                $input['failoverPrinterId'] ?? null,
                ($input['isActive'] ?? true) ? 1 : 0
            ]);
            echo json_encode(['success' => true, 'message' => 'Yazıcı başarıyla kaydedildi.']);
            exit;
        }
    }
}

if ($action === 'delete_printer' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? '';
    if (!empty($id)) {
        if ($useMysql) {
            $pdo->prepare("DELETE FROM `printer_routes` WHERE `printer_id` = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM `printers` WHERE `id` = ?")->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Yazıcı ve rotaları silindi.']);
            exit;
        }
    }
}

if ($action === 'get_printer_routes') {
    if ($useMysql) {
        $routes = $pdo->query("SELECT `id`, `printer_id` as printerId, `hedef_tipi` as targetType, `hedef_id` as targetId FROM `printer_routes`")->fetchAll();
        echo json_encode(['success' => true, 'routes' => $routes], JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        echo json_encode(['success' => true, 'routes' => $db['printerRoutes'] ?? []], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

if ($action === 'save_printer_routes' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (isset($input['routes']) && is_array($input['routes'])) {
        if ($useMysql) {
            $pdo->beginTransaction();
            try {
                $pdo->exec("DELETE FROM `printer_routes`");
                $stmt = $pdo->prepare("INSERT INTO `printer_routes` (`id`, `printer_id`, `hedef_tipi`, `hedef_id`) VALUES (?, ?, ?, ?)");
                foreach ($input['routes'] as $rt) {
                    $stmt->execute([
                        $rt['id'] ?? ('rt-' . uniqid()),
                        $rt['printerId'],
                        $rt['targetType'],
                        $rt['targetId'] ?? '*'
                    ]);
                }
                $pdo->commit();
                echo json_encode(['success' => true, 'message' => 'Yazıcı rota matrisi güncellendi.']);
                exit;
            } catch (Exception $e) {
                $pdo->rollBack();
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
                exit;
            }
        }
    }
}

// ========================================================
// 5. ATOMİK MASA İŞLEMLERİ (Masa Birleştirme, Taşıma, Adisyon Bölme)
// ========================================================
if ($action === 'merge_tables' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $srcId = $input['sourceTableId'] ?? '';
    $tgtId = $input['targetTableId'] ?? '';
    $userId = $input['userId'] ?? 'Kasa';

    if (!empty($srcId) && !empty($tgtId) && $srcId !== $tgtId) {
        if ($useMysql) {
            $pdo->beginTransaction();
            try {
                $srcStmt = $pdo->prepare("SELECT * FROM `masalar` WHERE `id` = ? FOR UPDATE");
                $srcStmt->execute([$srcId]);
                $srcRow = $srcStmt->fetch();

                $tgtStmt = $pdo->prepare("SELECT * FROM `masalar` WHERE `id` = ? FOR UPDATE");
                $tgtStmt->execute([$tgtId]);
                $tgtRow = $tgtStmt->fetch();

                if (!$srcRow || !$tgtRow) {
                    $pdo->rollBack();
                    echo json_encode(['success' => false, 'message' => 'Masalar bulunamadı.']);
                    exit;
                }

                $srcOrder = !empty($srcRow['aktif_siparis']) ? json_decode($srcRow['aktif_siparis'], true) : null;
                $tgtOrder = !empty($tgtRow['aktif_siparis']) ? json_decode($tgtRow['aktif_siparis'], true) : null;

                if (!$srcOrder || empty($srcOrder['items'])) {
                    $pdo->rollBack();
                    echo json_encode(['success' => false, 'message' => 'Kaynak masada birleştirilecek sipariş bulunamadı.']);
                    exit;
                }

                $combinedItems = $tgtOrder ? ($tgtOrder['items'] ?? []) : [];
                foreach ($srcOrder['items'] as $item) {
                    $combinedItems[] = $item;
                }

                $newTotal = 0;
                foreach ($combinedItems as $it) {
                    if (empty($it['isGift'])) {
                        $newTotal += (float)($it['price'] ?? 0) * (int)($it['quantity'] ?? 1);
                    }
                }

                $newOrder = [
                    'id' => $tgtOrder['id'] ?? $srcOrder['id'],
                    'orderNumber' => $tgtOrder['orderNumber'] ?? $srcOrder['orderNumber'],
                    'totalAmount' => round($newTotal, 2),
                    'orderTime' => $tgtOrder['orderTime'] ?? date('H:i'),
                    'waiterName' => $tgtOrder['waiterName'] ?? $srcOrder['waiterName'],
                    'items' => $combinedItems,
                    'notes' => trim(($tgtOrder['notes'] ?? '') . ' | ' . ($srcOrder['notes'] ?? ''), ' |')
                ];

                // Hedef masayı güncelle
                $updTgt = $pdo->prepare("UPDATE `masalar` SET `durum` = 'OCCUPIED', `aktif_siparis` = ?, `toplam_tutar` = ? WHERE `id` = ?");
                $updTgt->execute([json_encode($newOrder, JSON_UNESCAPED_UNICODE), round($newTotal, 2), $tgtId]);

                // Kaynak masayı boşalt
                $updSrc = $pdo->prepare("UPDATE `masalar` SET `durum` = 'EMPTY', `aktif_siparis` = NULL, `toplam_tutar` = 0.00 WHERE `id` = ?");
                $updSrc->execute([$srcId]);

                // Denetim Logu (audit_logs)
                $logStmt = $pdo->prepare("INSERT INTO `audit_logs` (`id`, `user_id`, `islem_tipi`, `detay`) VALUES (?, ?, 'MASA_BIRLESTIRME', ?)");
                $logStmt->execute([
                    'log-' . uniqid(),
                    $userId,
                    "{$srcRow['ad']} ({$srcId}) masası, {$tgtRow['ad']} ({$tgtId}) masasına birleştirildi. Yeni Toplam: ₺" . round($newTotal, 2)
                ]);

                $pdo->commit();
                echo json_encode(['success' => true, 'message' => 'Masalar başarıyla birleştirildi.', 'newTotal' => round($newTotal, 2)]);
                exit;
            } catch (Exception $e) {
                $pdo->rollBack();
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
                exit;
            }
        }
    }
}

if ($action === 'transfer_table' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $srcId = $input['sourceTableId'] ?? '';
    $tgtId = $input['targetTableId'] ?? '';
    $userId = $input['userId'] ?? 'Kasa';

    if (!empty($srcId) && !empty($tgtId) && $srcId !== $tgtId) {
        if ($useMysql) {
            $pdo->beginTransaction();
            try {
                $srcStmt = $pdo->prepare("SELECT * FROM `masalar` WHERE `id` = ? FOR UPDATE");
                $srcStmt->execute([$srcId]);
                $srcRow = $srcStmt->fetch();

                $tgtStmt = $pdo->prepare("SELECT * FROM `masalar` WHERE `id` = ? FOR UPDATE");
                $tgtStmt->execute([$tgtId]);
                $tgtRow = $tgtStmt->fetch();

                if (!$srcRow || !$tgtRow || empty($srcRow['aktif_siparis'])) {
                    $pdo->rollBack();
                    echo json_encode(['success' => false, 'message' => 'Kaynak masa veya taşınacak sipariş bulunamadı.']);
                    exit;
                }

                // Hedefe aktar
                $updTgt = $pdo->prepare("UPDATE `masalar` SET `durum` = 'OCCUPIED', `aktif_siparis` = ?, `toplam_tutar` = ? WHERE `id` = ?");
                $updTgt->execute([$srcRow['aktif_siparis'], $srcRow['toplam_tutar'], $tgtId]);

                // Kaynağı boşalt
                $updSrc = $pdo->prepare("UPDATE `masalar` SET `durum` = 'EMPTY', `aktif_siparis` = NULL, `toplam_tutar` = 0.00 WHERE `id` = ?");
                $updSrc->execute([$srcId]);

                // Audit Log
                $logStmt = $pdo->prepare("INSERT INTO `audit_logs` (`id`, `user_id`, `islem_tipi`, `detay`) VALUES (?, ?, 'MASA_TASIMA', ?)");
                $logStmt->execute([
                    'log-' . uniqid(),
                    $userId,
                    "{$srcRow['ad']} ({$srcId}) siparişi {$tgtRow['ad']} ({$tgtId}) masasına taşındı."
                ]);

                $pdo->commit();
                echo json_encode(['success' => true, 'message' => 'Masa siparişi başarıyla taşındı.']);
                exit;
            } catch (Exception $e) {
                $pdo->rollBack();
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
                exit;
            }
        }
    }
}

// ========================================================
// 6. YETKİLİ PIN KORUMALI İPTAL & İKRAM API UCU
// ========================================================
if ($action === 'cancel_item' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $tableId = $input['tableId'] ?? '';
    $itemIndex = $input['itemIndex'] ?? null;
    $reason = trim($input['reason'] ?? '');
    $pin = trim($input['pin'] ?? '');
    $userId = $input['userId'] ?? 'Yetkili';

    if (empty($reason)) {
        echo json_encode(['success' => false, 'message' => 'İptal sebebi girilmesi zorunludur!']);
        exit;
    }

    if ($useMysql) {
        // PIN Doğrulama: Patron şifresi veya yönetici personeli
        $pinOk = false;
        $bossStmt = $pdo->query("SELECT `deger` FROM `ayarlar` WHERE `anahtar` = 'boss_password'");
        $bossPass = $bossStmt ? (string)$bossStmt->fetchColumn() : '';
        // Sabit '1453' atlama kodu kaldırıldı: patron şifresi değiştirilse bile herkesin
        // bildiği bu kod yetkisiz ürün iptaline izin veriyordu. Patron şifresi tanımlı
        // değilse yalnızca yetkili personel PIN'i geçerlidir.
        if ($bossPass !== '' && hash_equals($bossPass, (string)$pin)) {
            $pinOk = true;
        } else {
            // PIN'i boş olan personel kaydının yetkilendirme yapmasına izin verilmez.
            $empChk = $pdo->prepare("SELECT COUNT(*) FROM `personeller` WHERE `pin` = ? AND `pin` <> '' AND `rol` IN ('ADMIN', 'CASHIER') AND `aktif` = 1");
            $empChk->execute([(string)$pin]);
            if ($empChk->fetchColumn() > 0) {
                $pinOk = true;
            }
        }

        if (!$pinOk) {
            echo json_encode(['success' => false, 'message' => 'Yetkisiz işlem! Geçersiz Yönetici PIN kodu.']);
            exit;
        }

        // Masayı güncelle
        $pdo->beginTransaction();
        try {
            $tStmt = $pdo->prepare("SELECT * FROM `masalar` WHERE `id` = ? FOR UPDATE");
            $tStmt->execute([$tableId]);
            $tRow = $tStmt->fetch();

            if ($tRow && !empty($tRow['aktif_siparis'])) {
                $ord = json_decode($tRow['aktif_siparis'], true);
                $items = $ord['items'] ?? [];
                
                $canceledItemName = 'Tüm Masa';
                if ($itemIndex !== null && isset($items[$itemIndex])) {
                    $canceledItemName = $items[$itemIndex]['productName'] ?? 'Ürün';
                    array_splice($items, $itemIndex, 1);
                } else {
                    $items = [];
                }

                $newTotal = 0;
                foreach ($items as $it) {
                    if (empty($it['isGift'])) {
                        $newTotal += (float)($it['price'] ?? 0) * (int)($it['quantity'] ?? 1);
                    }
                }

                $ord['items'] = $items;
                $ord['totalAmount'] = round($newTotal, 2);

                if (count($items) === 0) {
                    $pdo->prepare("UPDATE `masalar` SET `durum` = 'EMPTY', `aktif_siparis` = NULL, `toplam_tutar` = 0.00 WHERE `id` = ?")->execute([$tableId]);
                } else {
                    $pdo->prepare("UPDATE `masalar` SET `aktif_siparis` = ?, `toplam_tutar` = ? WHERE `id` = ?")->execute([
                        json_encode($ord, JSON_UNESCAPED_UNICODE),
                        round($newTotal, 2),
                        $tableId
                    ]);
                }

                // Audit Log kaydı
                $logStmt = $pdo->prepare("INSERT INTO `audit_logs` (`id`, `user_id`, `islem_tipi`, `detay`) VALUES (?, ?, 'IPTAL', ?)");
                $logStmt->execute([
                    'log-' . uniqid(),
                    $userId,
                    "İPTAL EDİLDİ: [{$canceledItemName}] - Masa: {$tRow['ad']}. Sebep: {$reason}. Onaylayan PIN: {$pin}"
                ]);

                $pdo->commit();
                echo json_encode(['success' => true, 'message' => 'İptal işlemi onaylandı ve denetim günlüğüne kaydedildi.', 'newTotal' => round($newTotal, 2)]);
                exit;
            }
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit;
        }
    }
}

// ========================================================
// 7. PARÇALI TAHSİLAT & KURUŞ HASSASİYETİ (process_split_payment)
// ========================================================
if ($action === 'process_split_payment' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $tableId = $input['tableId'] ?? '';
    $payments = $input['payments'] ?? []; // [{ method: 'NAKIT', amount: 250.00, customerId: '' }, ...]
    $discountAmount = round((float)($input['discountAmount'] ?? 0), 2);
    $userId = $input['userId'] ?? 'Kasa';

    if (!empty($tableId) && !empty($payments) && is_array($payments)) {
        if ($useMysql) {
            $pdo->beginTransaction();
            try {
                $tStmt = $pdo->prepare("SELECT * FROM `masalar` WHERE `id` = ? FOR UPDATE");
                $tStmt->execute([$tableId]);
                $tRow = $tStmt->fetch();

                if (!$tRow || empty($tRow['aktif_siparis'])) {
                    $pdo->rollBack();
                    echo json_encode(['success' => false, 'message' => 'Ödeme yapılacak masa bulunamadı.']);
                    exit;
                }

                $ord = json_decode($tRow['aktif_siparis'], true);
                $originalTotal = round((float)($ord['totalAmount'] ?? $tRow['toplam_tutar']), 2);
                $payableTotal = round(max(0, $originalTotal - $discountAmount), 2);

                $totalPaidThisSession = 0.00;
                foreach ($payments as $pay) {
                    $payAmt = round((float)($pay['amount'] ?? 0), 2);
                    $method = $pay['method'] ?? 'NAKIT';
                    $totalPaidThisSession += $payAmt;

                    // Payments tablosuna yaz
                    $pStmt = $pdo->prepare("INSERT INTO `payments` (`id`, `order_id`, `tutar`, `odeme_yontemi`, `musteri_id`, `kasa_user_id`, `aciklama`)
                                            VALUES (?, ?, ?, ?, ?, ?, ?)");
                    $pStmt->execute([
                        'pay-' . uniqid(),
                        $ord['id'] ?? ('ord-' . time()),
                        $payAmt,
                        $method,
                        $pay['customerId'] ?? null,
                        $userId,
                        "Masa: {$tRow['ad']} parçalı ödeme"
                    ]);

                    // Eğer CARİ (Veresiye) ise müşterinin bakiyesini artır
                    if ($method === 'CARI' && !empty($pay['customerId'])) {
                        $cUpd = $pdo->prepare("UPDATE `musteriler` SET `bakiye` = `bakiye` + ? WHERE `id` = ?");
                        $cUpd->execute([$payAmt, $pay['customerId']]);

                        $ctxStmt = $pdo->prepare("INSERT INTO `cari_hareketler` (`id`, `musteri_id`, `tip`, `tutar`, `odeme_yontemi`, `tarih`, `aciklama`)
                                                  VALUES (?, ?, 'DEBT', ?, 'CARI', ?, ?)");
                        $ctxStmt->execute([
                            'ctx-' . uniqid(),
                            $pay['customerId'],
                            $payAmt,
                            date('Y-m-d'),
                            "{$tRow['ad']} Masa Hesabı Borç Kaydı"
                        ]);
                    }
                }

                $totalPaidThisSession = round($totalPaidThisSession, 2);
                $remaining = round(max(0, $payableTotal - $totalPaidThisSession), 2);

                if ($remaining <= 0.005) {
                    // Tamamen ödendi -> Adisyonu tamamla ve masayı boşalt
                    $coStmt = $pdo->prepare("INSERT INTO `tamamlanan_adisyonlar` (`id`, `masa_id`, `masa_adi`, `garson_adi`, `toplam_tutar`, `indirim_tutari`, `odemeler_json`, `kalemler_json`, `durum`, `olusturma_tarihi`, `kapanis_tarihi`)
                                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PAID', ?, ?)");
                    $coStmt->execute([
                        'co-' . uniqid(),
                        $tableId,
                        $tRow['ad'],
                        $ord['waiterName'] ?? 'Garson',
                        $payableTotal,
                        $discountAmount,
                        json_encode($payments, JSON_UNESCAPED_UNICODE),
                        json_encode($ord['items'] ?? [], JSON_UNESCAPED_UNICODE),
                        $ord['orderTime'] ?? date('c'),
                        date('c')
                    ]);

                    $pdo->prepare("UPDATE `masalar` SET `durum` = 'EMPTY', `aktif_siparis` = NULL, `toplam_tutar` = 0.00 WHERE `id` = ?")->execute([$tableId]);

                    $pdo->commit();
                    echo json_encode(['success' => true, 'status' => 'CLOSED', 'message' => 'Hesap tamamen kapatıldı ve masa boşaltıldı.', 'remaining' => 0.00]);
                    exit;
                } else {
                    // Kalan bakiye var -> Masayı açık tut, toplam tutarı güncelle
                    $ord['totalAmount'] = $remaining;
                    $pdo->prepare("UPDATE `masalar` SET `aktif_siparis` = ?, `toplam_tutar` = ? WHERE `id` = ?")->execute([
                        json_encode($ord, JSON_UNESCAPED_UNICODE),
                        $remaining,
                        $tableId
                    ]);

                    $pdo->commit();
                    echo json_encode(['success' => true, 'status' => 'PARTIALLY_PAID', 'message' => "₺{$totalPaidThisSession} tahsil edildi. Kalan Tutar: ₺{$remaining}", 'remaining' => $remaining]);
                    exit;
                }
            } catch (Exception $e) {
                $pdo->rollBack();
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
                exit;
            }
        }
    }
}

// ========================================================
// 8. MÜŞTERİ GEÇMİŞ SİPARİŞLERİ (CALLER ID TEKRAR SİPARİŞ)
// ========================================================
if ($action === 'get_customer_history') {
    $phone = trim($_GET['phone'] ?? '');
    $customerId = trim($_GET['customerId'] ?? '');

    if ($useMysql) {
        $orders = [];
        try {
            if (!empty($phone)) {
                $custStmt = $pdo->prepare("SELECT `id`, `ad`, `telefon`, `adres`, `bakiye` FROM `musteriler` WHERE `telefon` LIKE ? LIMIT 1");
                $custStmt->execute(['%' . substr($phone, -7) . '%']);
                $cust = $custStmt->fetch();
                if ($cust) {
                    $customerId = $cust['id'];
                }
            }

            // Tamamlanan adisyonlardan son 5 siparişi çek
            $coStmt = $pdo->prepare("SELECT `id`, `toplam_tutar` as totalAmount, `kalemler_json` as itemsJson, `olusturma_tarihi` as createdAt 
                                     FROM `tamamlanan_adisyonlar` 
                                     ORDER BY `kapanis_tarihi` DESC LIMIT 5");
            $coStmt->execute();
            $rawOrders = $coStmt->fetchAll();
            foreach ($rawOrders as $ro) {
                $items = json_decode($ro['itemsJson'], true) ?: [];
                $orders[] = [
                    'id' => $ro['id'],
                    'totalAmount' => (float)$ro['totalAmount'],
                    'createdAt' => $ro['createdAt'],
                    'items' => $items
                ];
            }
        } catch (Exception $e) {}

        echo json_encode(['success' => true, 'history' => $orders], JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        echo json_encode(['success' => true, 'history' => []]);
        exit;
    }
}

// ========================================================
// GCALLERID 2HAT ÇAĞRI VE MÜŞTERİ YÖNETİM ENDPOINTLERİ
// ========================================================

// 1. Yeni Çağrı Kaydetme ve Müşteri Eşleştirme
if ($action === 'record_call') {
    $hatNo = (int)($input['hat_no'] ?? $_GET['hat_no'] ?? 1);
    $telefon = trim($input['telefon'] ?? $_GET['telefon'] ?? '');
    $durum = trim($input['durum'] ?? 'CEVAPLANDI');
    $callId = 'call_' . time() . '_' . substr(md5(uniqid()), 0, 4);

    if (empty($telefon)) {
        echo json_encode(['success' => false, 'message' => 'Telefon numarası eksik']);
        exit;
    }

    $customer = null;
    $recentOrders = [];

    if ($useMysql) {
        try {
            // Müşteriyi ara (telefonun son 7 veya 10 hanesi)
            $cleanPhone = preg_replace('/\D/', '', $telefon);
            $searchSuffix = substr($cleanPhone, -7);

            $cStmt = $pdo->prepare("SELECT * FROM `customers` WHERE REPLACE(REPLACE(REPLACE(`telefon`,' ',''),'-',''),'(','') LIKE ? LIMIT 1");
            $cStmt->execute(['%' . $searchSuffix]);
            $customer = $cStmt->fetch();

            if (!$customer) {
                // Eski musteriler tablosuna da bak
                $cStmt2 = $pdo->prepare("SELECT `id`, `ad` as ad_soyad, `telefon`, `adres`, `notlar`, `bakiye` as cari_bakiye FROM `musteriler` WHERE REPLACE(REPLACE(REPLACE(`telefon`,' ',''),'-',''),'(','') LIKE ? LIMIT 1");
                $cStmt2->execute(['%' . $searchSuffix]);
                $customer = $cStmt2->fetch();
            }

            $customerId = $customer ? $customer['id'] : null;

            // calls_history tablosuna ekle
            $insStmt = $pdo->prepare("INSERT INTO `calls_history` (`id`, `hat_no`, `telefon`, `customer_id`, `durum`, `zaman`) VALUES (?, ?, ?, ?, ?, NOW())");
            $insStmt->execute([$callId, $hatNo, $telefon, $customerId, $durum]);

            // Müşterinin son 5 siparişini çek
            if ($customerId) {
                $ordStmt = $pdo->prepare("SELECT `id`, `table_name`, `total_amount`, `created_at`, `notes` FROM `orders` WHERE `customer_id` = ? ORDER BY `created_at` DESC LIMIT 5");
                $ordStmt->execute([$customerId]);
                $recentOrders = $ordStmt->fetchAll();

                // Eğer orders'ta yoksa tamamlanan_adisyonlar'a bak
                if (empty($recentOrders)) {
                    $taStmt = $pdo->prepare("SELECT `id`, `toplam_tutar` as total_amount, `kalemler_json`, `olusturma_tarihi` as created_at FROM `tamamlanan_adisyonlar` ORDER BY `kapanis_tarihi` DESC LIMIT 5");
                    $taStmt->execute();
                    $raw = $taStmt->fetchAll();
                    foreach ($raw as $r) {
                        $recentOrders[] = [
                            'id' => $r['id'],
                            'table_name' => 'PAKET SERVİS',
                            'total_amount' => (float)$r['total_amount'],
                            'created_at' => $r['created_at'],
                            'items' => json_decode($r['kalemler_json'], true) ?: []
                        ];
                    }
                }
            }
        } catch (Exception $e) {
            error_log("Çağrı kaydetme hatası: " . $e->getMessage());
        }

        echo json_encode([
            'success' => true,
            'callId' => $callId,
            'line' => $hatNo,
            'phone' => $telefon,
            'customer' => $customer,
            'recentOrders' => $recentOrders
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        echo json_encode([
            'success' => true,
            'callId' => $callId,
            'line' => $hatNo,
            'phone' => $telefon,
            'customer' => null,
            'recentOrders' => []
        ]);
        exit;
    }
}

// 2. Çağrı Geçmişi Listesi
if ($action === 'get_calls_history') {
    $limit = (int)($_GET['limit'] ?? 50);

    if ($useMysql) {
        try {
            $stmt = $pdo->prepare("
                SELECT c.*, cust.ad_soyad as customer_name, cust.adres as customer_address, cust.adres_tarifi
                FROM `calls_history` c
                LEFT JOIN `customers` cust ON c.customer_id = cust.id
                ORDER BY c.zaman DESC
                LIMIT ?
            ");
            $stmt->bindValue(1, $limit, PDO::PARAM_INT);
            $stmt->execute();
            $calls = $stmt->fetchAll();
            echo json_encode(['success' => true, 'calls' => $calls], JSON_UNESCAPED_UNICODE);
            exit;
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit;
        }
    } else {
        echo json_encode(['success' => true, 'calls' => []]);
        exit;
    }
}

// 3. Çağrı Durumu Güncelleme (Siparişe Dönüştü / Kaçan Çağrı vb.)
if ($action === 'update_call_status') {
    $callId = trim($input['call_id'] ?? '');
    $durum = trim($input['durum'] ?? 'SIPARISE_DONUSTU');

    if ($useMysql && !empty($callId)) {
        try {
            $stmt = $pdo->prepare("UPDATE `calls_history` SET `durum` = ? WHERE `id` = ?");
            $stmt->execute([$durum, $callId]);
            echo json_encode(['success' => true, 'message' => 'Çağrı durumu güncellendi']);
            exit;
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit;
        }
    }
    echo json_encode(['success' => true]);
    exit;
}

// 4. Telefon ile İndeksli Hızlı Müşteri & Sipariş Geçmişi Arama
if ($action === 'search_customer_by_phone') {
    $phone = trim($_GET['phone'] ?? $input['phone'] ?? '');
    $cleanPhone = preg_replace('/\D/', '', $phone);
    $suffix = substr($cleanPhone, -7);

    if (empty($suffix)) {
        echo json_encode(['success' => false, 'message' => 'Geçerli numara girin']);
        exit;
    }

    if ($useMysql) {
        $customer = null;
        $orders = [];
        try {
            $stmt = $pdo->prepare("SELECT * FROM `customers` WHERE REPLACE(REPLACE(REPLACE(`telefon`,' ',''),'-',''),'(','') LIKE ? LIMIT 1");
            $stmt->execute(['%' . $suffix]);
            $customer = $stmt->fetch();

            if (!$customer) {
                $stmt2 = $pdo->prepare("SELECT `id`, `ad` as ad_soyad, `telefon`, `adres`, `notlar`, `bakiye` as cari_bakiye FROM `musteriler` WHERE REPLACE(REPLACE(REPLACE(`telefon`,' ',''),'-',''),'(','') LIKE ? LIMIT 1");
                $stmt2->execute(['%' . $suffix]);
                $customer = $stmt2->fetch();
            }

            if ($customer) {
                // Son 5 sipariş
                $coStmt = $pdo->prepare("SELECT `id`, `toplam_tutar` as totalAmount, `kalemler_json` as itemsJson, `olusturma_tarihi` as createdAt FROM `tamamlanan_adisyonlar` ORDER BY `kapanis_tarihi` DESC LIMIT 5");
                $coStmt->execute();
                $raw = $coStmt->fetchAll();
                foreach ($raw as $r) {
                    $orders[] = [
                        'id' => $r['id'],
                        'totalAmount' => (float)$r['totalAmount'],
                        'createdAt' => $r['createdAt'],
                        'items' => json_decode($r['itemsJson'], true) ?: []
                    ];
                }
            }
        } catch (Exception $e) {}

        echo json_encode([
            'success' => true,
            'customer' => $customer,
            'recentOrders' => $orders
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        echo json_encode(['success' => true, 'customer' => null, 'recentOrders' => []]);
        exit;
    }
}

// 5. Yazıcı Yönlendirme Matrisi (Routing Matrix) Kaydetme & Çekme
if ($action === 'save_printer_routes') {
    $routes = $input['routes'] ?? [];
    if ($useMysql) {
        try {
            $pdo->beginTransaction();
            $pdo->exec("DELETE FROM `printer_routes`");
            $stmt = $pdo->prepare("INSERT INTO `printer_routes` (`id`, `printer_id`, `hedef_tipi`, `hedef_id`) VALUES (?, ?, ?, ?)");
            foreach ($routes as $r) {
                $routeId = $r['id'] ?? ('rt_' . uniqid());
                $stmt->execute([
                    $routeId,
                    $r['printer_id'],
                    $r['hedef_tipi'],
                    $r['hedef_id'] ?? null
                ]);
            }
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Yazıcı yönlendirme matrisi kaydedildi']);
            exit;
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit;
        }
    }
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'get_printer_routes') {
    if ($useMysql) {
        try {
            $stmt = $pdo->query("SELECT * FROM `printer_routes`");
            $routes = $stmt->fetchAll();
            echo json_encode(['success' => true, 'routes' => $routes], JSON_UNESCAPED_UNICODE);
            exit;
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit;
        }
    }
    echo json_encode(['success' => true, 'routes' => []]);
    exit;
}

// Varsayılan Yanıt
echo json_encode([
    'success' => true, 
    'status' => 'ONLINE', 
    'mode' => $useMysql ? 'MYSQL' : 'JSON_FALLBACK',
    'version' => '3.3.0'
]);
