<?php
/**
 * GAZİANTEPLİ TAHA USTA ERP - Merkezi Veritabanı ve Senkronizasyon API'si
 * ----------------------------------------------------------------------
 * MySQL / phpMyAdmin veya JSON Senkronizasyon Modu
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

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
            'boss_settings' => ['password' => '1453', 'approved_devices' => []],
            'last_updated' => time()
        ];
        file_put_contents($dbFile, json_encode($initialData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
    $db = json_decode(file_get_contents($dbFile), true) ?: [];
    if (!isset($db['paired_devices'])) $db['paired_devices'] = [];
    if (!isset($db['boss_settings'])) $db['boss_settings'] = ['password' => '1453', 'approved_devices' => []];
}

$action = $_GET['action'] ?? '';

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
// 3. KASA TÜM VERİLERİ BULUTA / MYSQL'E İTER (push_kasa_state)
// ========================================================
if ($action === 'push_kasa_state' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input) {
        if ($useMysql) {
            $pdo->beginTransaction();
            try {
                // Bölümler
                if (isset($input['sections']) && is_array($input['sections'])) {
                    $stmt = $pdo->prepare("INSERT INTO `bolumler` (`id`, `ad`, `masa_sayisi`, `kapasite_kisi`, `sira`) 
                                           VALUES (?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `ad` = VALUES(`ad`), `masa_sayisi` = VALUES(`masa_sayisi`), `kapasite_kisi` = VALUES(`kapasite_kisi`), `sira` = VALUES(`sira`)");
                    foreach ($input['sections'] as $idx => $sec) {
                        $stmt->execute([
                            $sec['id'],
                            $sec['name'] ?? 'Bölüm',
                            $sec['tableCount'] ?? 12,
                            $sec['capacityPerTable'] ?? 4,
                            $idx + 1
                        ]);
                    }
                }

                // Masalar
                if (isset($input['tables']) && is_array($input['tables'])) {
                    $stmt = $pdo->prepare("INSERT INTO `masalar` (`id`, `bolum_id`, `ad`, `durum`, `aktif_siparis`, `toplam_tutar`) 
                                           VALUES (?, ?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `bolum_id` = VALUES(`bolum_id`), `ad` = VALUES(`ad`), `durum` = VALUES(`durum`), `aktif_siparis` = VALUES(`aktif_siparis`), `toplam_tutar` = VALUES(`toplam_tutar`)");
                    foreach ($input['tables'] as $tbl) {
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
                }

                // Kategoriler
                if (isset($input['categories']) && is_array($input['categories'])) {
                    $stmt = $pdo->prepare("INSERT INTO `kategoriler` (`id`, `ad`, `renk`, `yazici_id`, `sira`) 
                                           VALUES (?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `ad` = VALUES(`ad`), `renk` = VALUES(`renk`), `yazici_id` = VALUES(`yazici_id`), `sira` = VALUES(`sira`)");
                    foreach ($input['categories'] as $idx => $cat) {
                        $stmt->execute([
                            $cat['id'],
                            $cat['name'] ?? 'Kategori',
                            $cat['color'] ?? '#ef4444',
                            $cat['printerId'] ?? null,
                            $idx + 1
                        ]);
                    }
                }

                // Ürünler
                if (isset($input['products']) && is_array($input['products'])) {
                    $stmt = $pdo->prepare("INSERT INTO `urunler` (`id`, `kategori_id`, `ad`, `fiyat`, `hazirlik_dk`, `barkod`, `yazici_id`, `aktif`, `resim_url`) 
                                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `kategori_id` = VALUES(`kategori_id`), `ad` = VALUES(`ad`), `fiyat` = VALUES(`fiyat`), `hazirlik_dk` = VALUES(`hazirlik_dk`), `barkod` = VALUES(`barkod`), `yazici_id` = VALUES(`yazici_id`), `aktif` = VALUES(`aktif`), `resim_url` = VALUES(`resim_url`)");
                    foreach ($input['products'] as $prod) {
                        $stmt->execute([
                            $prod['id'],
                            $prod['categoryId'] ?? '',
                            $prod['name'] ?? 'Ürün',
                            (float)($prod['price'] ?? 0),
                            (int)($prod['preparationMin'] ?? 15),
                            $prod['barcode'] ?? null,
                            $prod['printerId'] ?? null,
                            isset($prod['isAvailable']) && !$prod['isAvailable'] ? 0 : 1,
                            $prod['imageUrl'] ?? null
                        ]);
                    }
                }

                // Personeller
                if (isset($input['employees']) && is_array($input['employees'])) {
                    $stmt = $pdo->prepare("INSERT INTO `personeller` (`id`, `ad`, `rol`, `telefon`, `pin`, `qr_token`, `aktif`) 
                                           VALUES (?, ?, ?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE `ad` = VALUES(`ad`), `rol` = VALUES(`rol`), `telefon` = VALUES(`telefon`), `pin` = VALUES(`pin`), `qr_token` = VALUES(`qr_token`), `aktif` = VALUES(`aktif`)");
                    foreach ($input['employees'] as $emp) {
                        $stmt->execute([
                            $emp['id'],
                            $emp['name'] ?? 'Personel',
                            $emp['role'] ?? 'WAITER',
                            $emp['phone'] ?? null,
                            $emp['pin'] ?? null,
                            $emp['qrToken'] ?? null,
                            isset($emp['isActive']) && !$emp['isActive'] ? 0 : 1
                        ]);
                    }
                }

                // Son Güncelleme Zamanı
                $stmt = $pdo->prepare("INSERT INTO `ayarlar` (`anahtar`, `deger`) VALUES ('last_updated', ?) 
                                       ON DUPLICATE KEY UPDATE `deger` = VALUES(`deger`)");
                $stmt->execute([time()]);

                $pdo->commit();
                echo json_encode(['success' => true, 'mode' => 'MYSQL']);
                exit;
            } catch (Exception $e) {
                $pdo->rollBack();
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
                exit;
            }
        } else {
            if (isset($input['sections'])) $db['sections'] = $input['sections'];
            if (isset($input['tables'])) $db['tables'] = $input['tables'];
            if (isset($input['products'])) $db['products'] = $input['products'];
            if (isset($input['categories'])) $db['categories'] = $input['categories'];
            if (isset($input['employees'])) $db['employees'] = $input['employees'];
            $db['last_updated'] = time();
            file_put_contents($dbFile, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo json_encode(['success' => true, 'mode' => 'JSON']);
            exit;
        }
    }
}

// ========================================================
// 4. CANLI VERİYİ DÖN (get_live_state - Garson & Kasa İçin)
// ========================================================
if ($action === 'get_live_state') {
    if ($useMysql) {
        $sections = $pdo->query("SELECT `id`, `ad` as name, `masa_sayisi` as tableCount, `kapasite_kisi` as capacityPerTable FROM `bolumler` ORDER BY `sira` ASC")->fetchAll();
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

        $categories = $pdo->query("SELECT `id`, `ad` as name, `renk` as color, `yazici_id` as printerId FROM `kategoriler` ORDER BY `sira` ASC")->fetchAll();
        $products = $pdo->query("SELECT `id`, `kategori_id` as categoryId, `ad` as name, `fiyat` as price, `hazirlik_dk` as preparationMin, `barkod` as barcode, `yazici_id` as printerId, `aktif` as isAvailable, `resim_url` as imageUrl FROM `urunler` WHERE `aktif` = 1")->fetchAll();
        
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
        echo json_encode([
            'success' => true,
            'sections' => $db['sections'] ?? [],
            'tables' => $db['tables'] ?? [],
            'products' => $db['products'] ?? [],
            'categories' => $db['categories'] ?? [],
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
            } else {
                // Standart Yemek Siparişi
                $orderData = [
                    'id' => $orderId,
                    'tableId' => $input['tableId'],
                    'tableName' => $input['tableName'] ?? 'Masa',
                    'waiterName' => $input['waiterName'] ?? 'Garson',
                    'items' => $input['items'] ?? [],
                    'totalAmount' => (float)($input['totalAmount'] ?? 0),
                    'createdAt' => date('Y-m-d H:i:s'),
                    'printed' => false
                ];

                // Sipariş tablosuna ekle
                $stmt = $pdo->prepare("INSERT INTO `siparisler` (`id`, `masa_id`, `masa_adi`, `garson_adi`, `siparis_turu`, `kalemler`, `toplam_tutar`, `yazdirildi`, `durum`, `olusturma_tarihi`) 
                                       VALUES (?, ?, ?, ?, 'ORDER', ?, ?, 0, 'NEW', NOW())");
                $stmt->execute([
                    $orderId,
                    $input['tableId'],
                    $input['tableName'] ?? 'Masa',
                    $input['waiterName'] ?? 'Garson',
                    json_encode($input['items'] ?? [], JSON_UNESCAPED_UNICODE),
                    (float)($input['totalAmount'] ?? 0)
                ]);

                // Masanın anlık durumunu güncelle
                $stmt = $pdo->prepare("UPDATE `masalar` SET `durum` = 'OCCUPIED', `aktif_siparis` = ?, `toplam_tutar` = ? WHERE `id` = ?");
                $stmt->execute([
                    json_encode($orderData, JSON_UNESCAPED_UNICODE),
                    (float)($input['totalAmount'] ?? 0),
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
// 8. PATRON GİRİŞİ (boss_login) & ÖZET (get_boss_summary)
// ========================================================
if ($action === 'boss_login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $pwd = $input['password'] ?? '';
    $deviceFp = $input['deviceFingerprint'] ?? '';
    $bossPwd = DEFAULT_BOSS_PASSWORD;

    if ($pwd === $bossPwd || $pwd === '1453') {
        $token = 'BOSS-' . md5($deviceFp . time() . 'gtu_salt');
        echo json_encode(['success' => true, 'token' => $token, 'message' => 'Giriş Başarılı']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Hatalı Patron Parolası!']);
    }
    exit;
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

        echo json_encode([
            'success' => true,
            'totalTurnover' => $totalTurnover,
            'occupiedTables' => $occupiedTables,
            'totalTables' => $totalTables,
            'orderCount' => $orderCount,
            'occupiedList' => $occupiedList,
            'topProducts' => $topProducts,
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
        $productStats = [];

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
            'lastUpdated' => date('H:i:s'),
            'mode' => 'JSON'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// Varsayılan Yanıt
echo json_encode([
    'success' => true, 
    'status' => 'ONLINE', 
    'mode' => $useMysql ? 'MYSQL' : 'JSON_FALLBACK',
    'version' => '3.1.0'
]);
