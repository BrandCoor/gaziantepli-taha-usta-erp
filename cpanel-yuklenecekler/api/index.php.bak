<?php
// Gaziantepli Taha Usta - Bulut Senkronizasyon & Sipariş Köprüsü (Hatasız Sürüm)
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$dbFile = __DIR__ . '/restaurant_sync.json';
if (!file_exists($dbFile)) {
    $initialData = [
        'sections' => [],
        'tables' => [],
        'products' => [],
        'categories' => [],
        'orders' => [],
        'paired_devices' => [],
        'last_updated' => time()
    ];
    file_put_contents($dbFile, json_encode($initialData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

$db = json_decode(file_get_contents($dbFile), true) ?: [];
$action = $_GET['action'] ?? '';

// 1. KASA TÜM MASA VE MENÜYÜ BULUTA GÖNDERİR
if ($action === 'push_kasa_state' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input) {
        if (isset($input['sections'])) $db['sections'] = $input['sections'];
        if (isset($input['tables'])) $db['tables'] = $input['tables'];
        if (isset($input['products'])) $db['products'] = $input['products'];
        if (isset($input['categories'])) $db['categories'] = $input['categories'];
        $db['last_updated'] = time();
        file_put_contents($dbFile, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        echo json_encode(['success' => true]);
        exit;
    }
}

// 2. GARSON TELEFONU CANLI VERİYİ ALIR
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

// 3. GARSON TELEFONDAN SİPARİŞ / FİŞ İSTEĞİ / MASA TAŞIMA
if ($action === 'send_order' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input) {
        $type = $input['type'] ?? 'ORDER';

        if ($type === 'BILL_REQUEST') {
            // ADİSYONU SİLME! Sadece masayı HESAP İSTENDİ yap
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
            // Masa Taşıma
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
            // Normal Sipariş
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

// 4. KASA BEKLEYEN İŞLEMLERİ ÇEKER
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

// 5. CİHAZ EŞLEŞTİRME
if ($action === 'pair_device' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input && !empty($input['waiterId'])) {
        $db['paired_devices'][$input['waiterId']] = [
            'waiterId' => $input['waiterId'],
            'waiterName' => $input['waiterName'] ?? 'Garson',
            'deviceUuid' => $input['deviceUuid'] ?? 'MOB-' . rand(1000, 9999),
            'deviceName' => $input['deviceName'] ?? 'Mobil Telefon',
            'pairedAt' => date('Y-m-d H:i:s'),
            'status' => 'APPROVED'
        ];
        file_put_contents($dbFile, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        echo json_encode(['success' => true]);
        exit;
    }
}

if ($action === 'get_paired_devices') {
    echo json_encode(['success' => true, 'devices' => $db['paired_devices'] ?? []]);
    exit;
}

echo json_encode(['success' => true, 'status' => 'ONLINE']);
