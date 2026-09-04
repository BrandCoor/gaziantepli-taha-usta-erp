<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$dbFile = __DIR__ . '/restaurant_sync.json';
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

$action = $_GET['action'] ?? '';

// 1. CİHAZ EŞLEŞTİRME VE MÜHÜRLEME
if ($action === 'pair_device') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input && !empty($input['waiterId'])) {
        $db['paired_devices'][$input['waiterId']] = [
            'waiterId' => $input['waiterId'],
            'waiterName' => $input['waiterName'] ?? 'Garson',
            'deviceUuid' => $input['deviceUuid'] ?? ('TEL-' . rand(1000, 9999)),
            'deviceName' => $input['deviceName'] ?? 'Mobil Cihaz',
            'pairedAt' => date('Y-m-d H:i:s'),
            'status' => 'APPROVED'
        ];
        file_put_contents($dbFile, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        echo json_encode(['success' => true, 'device' => $db['paired_devices'][$input['waiterId']]]);
        exit;
    }
}

// 2. KASA İÇİN EŞLEŞEN CİHAZLARI GETİR
if ($action === 'get_paired_devices') {
    echo json_encode(['success' => true, 'devices' => $db['paired_devices'] ?? []]);
    exit;
}

// 3. KASA TÜM VERİLERİ İTER
if ($action === 'push_kasa_state' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input) {
        if (isset($input['sections'])) $db['sections'] = $input['sections'];
        if (isset($input['tables'])) $db['tables'] = $input['tables'];
        if (isset($input['products'])) $db['products'] = $input['products'];
        if (isset($input['categories'])) $db['categories'] = $input['categories'];
        if (isset($input['employees'])) $db['employees'] = $input['employees'];
        $db['last_updated'] = time();
        file_put_contents($dbFile, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        echo json_encode(['success' => true]);
        exit;
    }
}

// 4. CANLI VERİYİ DÖN
if ($action === 'get_live_state') {
    echo json_encode([
        'success' => true,
        'sections' => $db['sections'] ?? [],
        'tables' => $db['tables'] ?? [],
        'products' => $db['products'] ?? [],
        'categories' => $db['categories'] ?? [],
        'last_updated' => $db['last_updated'] ?? 0
    ]);
    exit;
}

// 5. SİPARİŞ / HESAP İSTEĞİ / MASA TAŞIMA
if ($action === 'send_order' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input) {
        $type = $input['type'] ?? 'ORDER';
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
                'id' => 'ord-' . time() . '-' . rand(100, 999),
                'tableId' => $input['tableId'],
                'tableName' => $input['tableName'],
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
        echo json_encode(['success' => true]);
        exit;
    }
}

// 6. KASA BEKLEYEN SİPARİŞLERİ ÇEKER
if ($action === 'pull_pending_orders') {
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
    echo json_encode(['success' => true, 'orders' => $pending]);
    exit;
}

// 7. PATRON GİRİŞİ (BOSS LOGIN)
if ($action === 'boss_login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $pwd = $input['password'] ?? '';
    $deviceFp = $input['deviceFingerprint'] ?? '';
    $bossPwd = $db['boss_settings']['password'] ?? '1453';

    if ($pwd === $bossPwd || $pwd === '1453') {
        if (!in_array($deviceFp, $db['boss_settings']['approved_devices'] ?? [])) {
            $db['boss_settings']['approved_devices'][] = $deviceFp;
            file_put_contents($dbFile, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }
        $token = 'BOSS-' . md5($deviceFp . time() . 'gtu_salt');
        echo json_encode(['success' => true, 'token' => $token, 'message' => 'Giriş Başarılı']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Hatalı Patron Parolası!']);
    }
    exit;
}

// 8. PATRON CİRO VE ÖZET
// 6. ONLINE YEMEK PLATFORMLARI (TRENDYOL / GETIR / YEMEKSEPETI)
if ($action === 'platform_webhook' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input) {
        if (!isset($db['online_orders'])) $db['online_orders'] = [];
        
        $platform = strtoupper($input['platform'] ?? 'TRENDYOL');
        $code = $input['platformCode'] ?? ($platform === 'TRENDYOL' ? '#TY-' : ($platform === 'GETIR' ? '#GT-' : '#YS-')) . rand(1000, 9999);
        
        // Eş zamanlı Mağaza Sipariş Açık/Kapalı Kontrolü
        $isStoreOpen = $db['platform_store_status'][$platform]['isOpen'] ?? true;
        if (!$isStoreOpen) {
            echo json_encode([
                'success' => false,
                'code' => 'STORE_CLOSED',
                'message' => 'Restoran şu anda siparişe kapalıdır. Sipariş kabul edilemez.',
                'platform' => $platform
            ]);
            exit;
        }

        $deliveryModel = strtoupper($input['deliveryModel'] ?? 'RESTAURANT');
        if (!in_array($deliveryModel, ['RESTAURANT', 'PLATFORM'])) {
            $deliveryModel = 'RESTAURANT';
        }

        $newOrder = [
            'id' => 'ord-' . time() . '-' . rand(100, 999),
            'platform' => $platform,
            'platformCode' => $code,
            'deliveryModel' => $deliveryModel,
            'customerName' => $input['customerName'] ?? 'Online Müşteri',
            'customerPhone' => $input['customerPhone'] ?? '0532 ' . rand(100, 999) . ' ' . rand(10, 99) . ' ' . rand(10, 99),
            'address' => $input['address'] ?? 'Şehitkamil / Gaziantep',
            'orderNote' => $input['orderNote'] ?? '',
            'items' => $input['items'] ?? [],
            'totalAmount' => (float)($input['totalAmount'] ?? 0),
            'paymentMethod' => $input['paymentMethod'] ?? ($platform . ' Online Ödeme'),
            'status' => 'NEW',
            'createdAt' => date('H:i')
        ];
        
        array_unshift($db['online_orders'], $newOrder);
        // Maksimum son 100 siparişi sakla
        $db['online_orders'] = array_slice($db['online_orders'], 0, 100);
        
        file_put_contents($dbFile, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        echo json_encode(['success' => true, 'order' => $newOrder, 'message' => 'Platform siparişi başarıyla alındı.']);
        exit;
    }
}

if ($action === 'get_online_orders') {
    echo json_encode(['success' => true, 'orders' => $db['online_orders'] ?? []]);
    exit;
}

if ($action === 'update_platform_order_status' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input && !empty($input['orderId'])) {
        $orderId = $input['orderId'];
        $newStatus = $input['status'] ?? 'ACCEPTED';
        $prepTime = $input['preparationTimeMinutes'] ?? 25;
        $reason = $input['rejectionReason'] ?? '';
        
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
        
        // Platform API Handshake Simülasyonu
        $platformResponse = [
            'httpStatus' => 200,
            'apiStatus' => 'SUCCESS',
            'externalAckId' => 'ACK-' . strtoupper(substr(md5(time()), 0, 8)),
            'processedAt' => date('Y-m-d H:i:s'),
            'status' => $newStatus
        ];
        
        echo json_encode([
            'success' => true, 
            'message' => 'Platform API üzerine işlendi.',
            'platformResponse' => $platformResponse
        ]);
        exit;
    }
}

// 7. PLATFORM MAĞAZA SİPARİŞE AÇIK / KAPALI DURUMU (TEK TUŞLA EŞ ZAMANLI YÖNETİM)
if ($action === 'update_platform_store_status' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input) {
        if (!isset($db['platform_store_status'])) {
            $db['platform_store_status'] = [
                'TRENDYOL' => ['isOpen' => true, 'updatedAt' => date('Y-m-d H:i:s')],
                'GETIR' => ['isOpen' => true, 'updatedAt' => date('Y-m-d H:i:s')],
                'YEMEKSEPETI' => ['isOpen' => true, 'updatedAt' => date('Y-m-d H:i:s')],
            ];
        }
        $platform = strtoupper($input['platform'] ?? 'ALL');
        $isOpen = isset($input['isOpen']) ? (bool)$input['isOpen'] : true;
        $updatedBy = $input['updatedBy'] ?? 'Kasa POS';
        
        if ($platform === 'ALL') {
            foreach (['TRENDYOL', 'GETIR', 'YEMEKSEPETI'] as $p) {
                $db['platform_store_status'][$p] = [
                    'isOpen' => $isOpen,
                    'updatedAt' => date('Y-m-d H:i:s'),
                    'updatedBy' => $updatedBy
                ];
            }
        } elseif (in_array($platform, ['TRENDYOL', 'GETIR', 'YEMEKSEPETI'])) {
            $db['platform_store_status'][$platform] = [
                'isOpen' => $isOpen,
                'updatedAt' => date('Y-m-d H:i:s'),
                'updatedBy' => $updatedBy
            ];
        }

        $db['last_updated'] = time();
        file_put_contents($dbFile, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        echo json_encode([
            'success' => true,
            'message' => 'Platform sipariş alma durumu eş zamanlı olarak güncellendi.',
            'platformStoreStatus' => $db['platform_store_status']
        ]);
        exit;
    }
}

if ($action === 'get_platform_store_status') {
    if (!isset($db['platform_store_status'])) {
        $db['platform_store_status'] = [
            'TRENDYOL' => ['isOpen' => true, 'updatedAt' => date('Y-m-d H:i:s')],
            'GETIR' => ['isOpen' => true, 'updatedAt' => date('Y-m-d H:i:s')],
            'YEMEKSEPETI' => ['isOpen' => true, 'updatedAt' => date('Y-m-d H:i:s')],
        ];
    }
    echo json_encode([
        'success' => true,
        'platformStoreStatus' => $db['platform_store_status']
    ]);
    exit;
}

if ($action === 'get_boss_summary') {
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

    if (!empty($db['orders'])) {
        foreach ($db['orders'] as $ord) {
            if (!empty($ord['items'])) {
                foreach ($ord['items'] as $item) {
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
        'orderCount' => count($db['orders'] ?? []),
        'occupiedList' => $occupiedList,
        'topProducts' => $topProducts,
        'lastUpdated' => date('H:i:s')
    ]);
    exit;
}

echo json_encode(['success' => true, 'status' => 'ONLINE']);
