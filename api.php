<?php
/**
 * API UNIVERSAL (Asistencias + Notas) - Versión PHP para Hostinger
 */

// --- CONFIGURACIÓN E INICIO ---
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Content-Type: application/json');

// Cabeceras de Seguridad
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('X-XSS-Protection: 1; mode=block');
header('Strict-Transport-Security: max-age=31536000; includeSubDomains');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

// Cargar variables
// Opción 1: leer de variables de entorno (si las configuras en Hostinger)
$GOOGLE_EMAIL = getenv('GOOGLE_SERVICE_ACCOUNT_EMAIL') ?: '';
$GOOGLE_KEY   = getenv('GOOGLE_PRIVATE_KEY') ?: '';
$SHEET_ID     = getenv('SPREADSHEET_ID') ?: '';

// Opción 2 (plan B): definir aquí directamente si no usas variables de entorno.
// IMPORTANTE: estos datos son sensibles; solo hazlo si el panel de Hostinger
// no te deja crear variables de entorno y la web es de uso interno.
if (!$GOOGLE_EMAIL) {
    $GOOGLE_EMAIL = 'academia-universal-worker@academia-universal-490517.iam.gserviceaccount.com';
}
if (!$GOOGLE_KEY) {
    $GOOGLE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VFXJoI6c6+Cq\nwwhG8knTU/YQiUeDdvxknqLBotcOjiKtfqxajS0rrL875T1inLfk88aefRhYqK/k\nPYPbdSL61IfaOAWrLR5MAEvjohnVGqgfZdUqjEz3SvcEZVtUbA8xfw4MAXH6WlT/\nKxO3iXrZFWk/VbutsEfYt4ix/mWneF8ZxrTNQZrBqUP2e+NcshAwENi6aaiuRGpI\nSpd63BSIynkPwfTzAGVJ5LVAmTllNDZqI3AZE0GyLyFu0aveVe9yzl3ZN0SptR/a\n2ZZjy/qZ17o+XzSRuWqbshaIdV3ei248WPHfial32phITRER+faGJ7doV86JemI3\nW2ww/0VzAgMBAAECggEAXO2+TPKQLLo6zptHvOIuy14IYDWpu0bIeCXV+ZcNdlP+\nUfDYEWedc+ATUeQrqoKyGyrvaeoGrNypvODjS3f1bVcHObK25S7Rq8Qt4XOluvip\nVEIRGDVXbQnMNmsNfnjIpLYxwrTo1NgA+EBnXJIf1hbwChI+szASxChv8FSSGxwa\nkxHlae47sg2OBWXJm/KlmtpjPTDabn7SaGGHg9HedlEuVvITO0o4z0scSDKnk8DD\nUeTEaxU54/ZE784wGGuRg4eBsxBlR0Gte5iX91k4IxOw8iFsrXikMgYOj4rkDoOU\n9meyI9cUjFMcPngYbrOwWyo5vStgsTkZRoMTzg7jGQKBgQDt/Y1U0JDrNW5tFSyV\n+AGCVFh6ysrXhEOKT3Ma5qoDgGkz5XZ/fTz/1ib5FJLV6yQIl6MVqg3xDuMCWBf5\nHTCYHtD9E44wJg8eEn7MsOKblXO4RN/h77NCJizrxWBxp9w2pt1ioCOWJVuwHhn/\nZBD2HbKK9Obw0rtd9gI1DQETjQKBgQDJgVt9hFO5pe/0YKFSDpUnvbAVHkJGHBx5\nlNrbjjE+0fCtyhuA0dddWG8REd3+0yhiRoEXSoK4e2u8xSuz2iIvHxET3hv6hikj\nl7DthvbC7mg2Xw5+ekOwq61mX5I4lznG1SAGX4Ia0r8X5uM9mH3A9Vrn5wSwy1rQ\nEVggUeb8/wKBgBGA2GgofsANyfVT3VeaSeIf+fHuAEUhgSYm+bw8wrxHMXWTpsdx\nmo7mXS9sh/AbvyayoFfzjdrw0VlWyUyVDQHjIlO6oHaCFhKMIa9EQyZWM5CV4DFp\nw7FVxXABsDorslKCqz2ZsYRVcwzc6eSSo3y2am8129ZSaV1bvoXQUwfxAoGANnPc\nc2jE71AmLdXHAlOqftjFso9AvY1vLHPLSLV+HUnCTlRlZkROfI0fRm+bm/cX3KbM\nz6x08sF3dcWab7msrysoBERrLyH+D/4385gbKsYeJ0M8uXT0wdNCwn1lGCHVnSOO\nyeoZUIJO3XipQ8XnhbNH448MN3Jckgl91Q4M66UCgYEAohGHdwsWM9xeZ0XnaffN\nm0PIf3WYH0EHmT/IXBft90M2OEM8ihofmHPtd+WJWTD0eIbbMXCLx0314RQg4/Sh\nEA2F1WCHd6AM0+ZwZJQWyPeqJhkE6np8oNarU6VBQLbHFPlF0pBAYSINyx75HDID\n2Nx6y1Rqr2/4UDu8B+ebMeI=\n-----END PRIVATE KEY-----\n";
}
if (!$SHEET_ID) {
    $SHEET_ID = '1u5e05TMsfuYoWSgDlORFt2pT_kEyvWYhjLq3pHxYU4E';
}

// Normalizar la clave privada (reemplazar \n literales por saltos reales)
$GOOGLE_KEY = str_replace('\n', "\n", $GOOGLE_KEY);

function ok($body) { 
    if (is_array($body)) {
        $body = array_merge(['success' => true], $body);
    }
    echo json_encode($body); 
    exit; 
}
function fail($msg, $status = 500) { http_response_code($status); echo json_encode(['error' => $msg]); exit; }

if (!$GOOGLE_EMAIL || !$GOOGLE_KEY || !$SHEET_ID) {
    fail("Faltan variables de configuración reales (EMAIL, KEY o ID).", 500);
}

// ── ENDPOINT DE SALUD ────────────────────────────────────────────────────────
$action = $_GET['action'] ?? '';
if ($action === 'health') {
    ok([
        'status' => 'ok',
        'env' => [
            'has_email' => !empty($GOOGLE_EMAIL),
            'has_key' => !empty($GOOGLE_KEY),
            'has_id' => !empty($SHEET_ID)
        ]
    ]);
}

// ── OBTENER TOKEN DE GOOGLE ──────────────────────────────────────────────────
function getAccessToken($email, $privateKey) {
    $header = base64url_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $now = time();
    $payload = base64url_encode(json_encode([
        'iss' => $email,
        'scope' => 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/contacts.readonly',
        'aud' => 'https://oauth2.googleapis.com/token',
        'exp' => $now + 3600,
        'iat' => $now
    ]));

    $signing_input = "$header.$payload";
    if (!openssl_sign($signing_input, $signature, $privateKey, 'SHA256')) {
        throw new Exception("Error al firmar JWT: " . openssl_error_string());
    }
    
    $jwt = "$signing_input." . base64url_encode($signature);

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt
    ]));
    
    $res = curl_exec($ch);
    if (curl_errno($ch)) throw new Exception(curl_error($ch));
    curl_close($ch);

    $data = json_decode($res, true);
    if (!isset($data['access_token'])) {
        throw new Exception("Google OAuth Error: " . ($data['error_description'] ?? $res));
    }
    return $data['access_token'];
}

function base64url_encode($data) {
    return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
}

// ── GOOGLE SHEETS API HELPERS ────────────────────────────────────────────────
function sheetsRequest($url, $method = 'GET', $body = null, $token) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer $token",
        "Content-Type: application/json"
    ]);
    if ($body) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $data = json_decode($res, true);
    if ($httpCode >= 400) {
        throw new Exception("Sheets API Error: " . ($data['error']['message'] ?? $res));
    }
    return $data;
}

function getGoogleContacts($token) {
    $url = 'https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=1000';
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer $token",
        "Accept: application/json"
    ]);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode >= 400) return [];
    $data = json_decode($res, true);
    
    $contacts = [];
    foreach ($data['connections'] ?? [] as $conn) {
        $name = $conn['names'][0]['displayName'] ?? '';
        $phone = $conn['phoneNumbers'][0]['value'] ?? '';
        if ($name && $phone) {
            $cleanPhone = preg_replace('/[^\d+]/', '', $phone);
            $contacts[trim($name)] = $cleanPhone;
        }
    }
    return $contacts;
}


// ── MANEJO DE ARCHIVO DE DATOS LOCAL (NOTAS Y ANULADOS) ──────────────────────
$DATA_FILE = __DIR__ . '/app_data.json';
file_put_contents(__DIR__ . '/path_debug.txt', "Server __DIR__: " . __DIR__ . "\nTime: " . date('Y-m-d H:i:s'));


function loadAppData() {
    global $DATA_FILE;
    $defaults = [
        'notas' => [],
        'anulados' => [],
        'trimester_checks' => [],
        'teacher_notes' => [],
        'snapshots' => [],
        'day_overrides' => [],
        'highlights' => [],
        'settings' => [
            'adminUser' => 'Admin',
            'adminPass' => 'Admin-1234',
            'teacherUsers' => 'teacher1,teacher2,teacher3,teacher4',
            'passA' => '2020',
            'passB' => 'certificados123',
            'masterKey' => 'admin99'
        ],
        'waiting_list' => [],
        'student_log' => [],
        'web_config' => [
            'attendance_pdf_note' => 'NOTA: Las clases a las que el alumnado no ha asistido tienen un plazo del mismo mes para recuperarlas.',
            'whatsapp_templates' => [
                'certificados' => "Hola, adjunto el certificado de la Agencia Tributaria correspondiente al alumno/a *{nombre}*, perteneciente al año fiscal *{año}*.\n\nEl PDF con el certificado detallado acaba de ser descargado en tu dispositivo. (Acuérdate de adjuntarlo en este chat usando el clip 📎). ¡Gracias!",
                'notas_exam_wow' => "WOW, *{nombre}*!!! Tus notas en *YES OF COURSE* son increíbles!! Tienes el PDF con el detalle adjunto.\n\n*\"The limit is the sky\"* y tú estás volando alto.\n\nEstamos súper orgullosos de tu nivel!!! Enjoy your success!!!",
                'notas_exam_good' => "Hi, *{nombre}*!! Vaya nota has sacado en *YES OF COURSE*!! Échale un vistazo al PDF con el detalle.\n\nEstás muy cerca de la cima. Recuerda: *\"Consistency is the key to success\"*\n\nSigue brillando así!!! Great job!!!",
                'notas_exam_path' => "Hey, *{nombre}*!! Ya tienes tu nota de *YES OF COURSE* disponibles en el PDF adjunto.\n\nVas por buen camino!!! Sigue dándole duro porque *\"Small steps, big results\"* es la clave.\n\nA por el siguiente nivel, you can do it!!",
                'notas_exam_error' => "Hello, *{nombre}*!!! Ya están aquí tus notas de *YES OF COURSE*. Te enviamos el PDF con el detalle.\n\nDon't worry!! *\"Every expert was once a beginner\"*\n\nEstamos aquí para ayudarte a darle la vuelta a este resultado!! Let's work together!!!",
                'notas_trim_wow' => "WOW, *{nombre}*!!! Tus notas en *YES OF COURSE* son increíbles!! Tienes el PDF con el detalle adjunto.\n\n*\"The limit is the sky\"* y tú estás volando alto.\n\nEstamos súper orgullosos de tu nivel!!! Enjoy your success!!!",
                'notas_trim_good' => "Hi, *{nombre}*!! Vaya nota has sacado en *YES OF COURSE*!! Échale un vistazo al PDF con el detalle.\n\nEstás muy cerca de la cima. Recuerda: *\"Consistency is the key to success\"*\n\nSigue brillando así!!! Great job!!!",
                'notas_trim_path' => "Hey, *{nombre}*!! Ya tienes tu nota de *YES OF COURSE* disponibles en el PDF adjunto.\n\nVas por buen camino!!! Sigue dándole duro porque *\"Small steps, big results\"* es la clave.\n\nA por el siguiente nivel, you can do it!!",
                'notas_trim_error' => "Hello, *{nombre}*!!! Ya están aquí tus notas de *YES OF COURSE*. Te enviamos el PDF con el detalle.\n\nDon't worry!! *\"Every expert was once a beginner\"*\n\nEstamos aquí para ayudarte a darle la vuelta a este resultado!! Let's work together!!!",
                'asistencias' => "Hola {nombre}, te recordamos tu horario de clase en YES OF COURSE. ¡Te esperamos!"
            ]
        ]
    ];
    if (file_exists($DATA_FILE)) {
        $existing = json_decode(file_get_contents($DATA_FILE), true);
        $data = array_merge($defaults, (array)$existing);
    } else {
        $data = $defaults;
    }

    // ── AUTO-MIGRACIÓN: Reparar IDs duplicados o vacíos en notas ─────────────
    $seenIds = [];
    $needsSave = false;
    if (!empty($data['notas'])) {
        foreach ($data['notas'] as &$nota) {
            $id = isset($nota[10]) ? (string)$nota[10] : '';
            // Reparar si el ID está vacío O ya fue visto (duplicado)
            if ($id === '' || isset($seenIds[$id])) {
                $nota[10] = uniqid('n', true);
                $needsSave = true;
            }
            $seenIds[(string)$nota[10]] = true;
        }
        unset($nota);
    }
    if ($needsSave) {
        file_put_contents($DATA_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    return $data;
}

function saveAppData($data) {
    global $DATA_FILE;
    if (!$data || !is_array($data)) return false;
    
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    $res = file_put_contents($DATA_FILE, $json);
    
    if ($res === false) {
        error_log("CRITICAL ERROR: No se pudo escribir en $DATA_FILE. Revisa los permisos de escritura del servidor.");
        return false;
    }
    return true;
}

// ── LÓGICA PRINCIPAL ─────────────────────────────────────────────────────────
try {
    $token = getAccessToken($GOOGLE_EMAIL, $GOOGLE_KEY);
    $method = $_SERVER['REQUEST_METHOD'];
    $p = $_GET;
    $body = json_decode(file_get_contents('php://input'), true);
    $action = $p['action'] ?? ($body['action'] ?? '');

    // --- ACCIONES DE NOTAS Y ALUMNOS ---
    $notasActions = ['get_notas', 'get_all_notas', 'get_cursos', 'get_portal_init', 'get_course_students_from_data', 'reset_course', 'search_students_with_notes', 'get_student_courses_with_notes', 'reset_student_course_grades', 'save_trimester_checks', 'save_teacher_note', 'get_server_info', 'delete_historical_student', 'get_statistics', 'reset_statistics', 'get_waiting_list', 'add_waiting_entry', 'update_waiting_entry', 'delete_waiting_entry', 'reset_waiting_list'];
    if (in_array($action, $notasActions) || ($body && in_array($body['action'] ?? '', ['add_nota', 'toggle_anulado', 'delete_nota', 'edit_nota']))) {
        handleNotas($token, $SHEET_ID, $p, $body);
    }

    // --- ACCIONES DE SESIÓN Y AJUSTES (SECURITY) ---
    if (in_array($action, ['global_login', 'verify_portal_password', 'get_portal_settings', 'save_portal_settings', 'get_web_config', 'save_web_config', 'get_backup_info', 'restore_backup', 'run_backup'])) {
        handleSettings($p, $body);
    }

    // --- ACCIONES DE ASISTENCIAS ---
    // También necesitamos saber el nombre de la hoja "Notas" aquí para excluirla de las listas
    $metaUrl = "https://sheets.googleapis.com/v4/spreadsheets/$SHEET_ID?fields=sheets.properties(title,sheetId)";
    $meta = sheetsRequest($metaUrl, 'GET', null, $token);
    $allSheetNames = [];
    $sheetGids = [];
    $notasSheetName = null;
    $ignorePatterns = ['/vacio/i', '/plantilla/i', '/config/i', '/asistencias/i'];

    foreach ($meta['sheets'] as $sh) {
        $n = $sh['properties']['title'];
        $skip = false;
        if (strcasecmp($n, 'Notas') === 0) {
            $notasSheetName = $n;
            $skip = true;
        } else {
            foreach ($ignorePatterns as $pattern) {
                if (preg_match($pattern, $n)) {
                    $skip = true;
                    break;
                }
            }
        }
        if (!$skip) {
            $allSheetNames[] = $n;
            $sheetGids[$n] = $sh['properties']['sheetId'];
        }
    }

    if ($action === 'get_icon') {
        $imgUrl = '';
        $gid = 0;
        
        // Si nos pasan la URL directamente, saltamos la consulta a Google y la traemos
        if (!empty($p['url']) && strpos($p['url'], 'http') === 0) {
            $imgUrl = $p['url'];
        } else {
            $sName = $p['sheetName'] ?? '';
            if (!$sName) fail('Falta sheetName o url', 400);
            
            // 1. Obtener metadatos de la celda
            $url = "https://sheets.googleapis.com/v4/spreadsheets/$SHEET_ID?includeGridData=true&ranges=" . urlencode("'$sName'!E2") . "&fields=sheets.data.rowData.values,sheets.properties.sheetId";
            $data = sheetsRequest($url, 'GET', null, $token);
            
            foreach ($data['sheets'] as $sh) {
                $gid = $sh['properties']['sheetId'];
                $cell = $sh['data'][0]['rowData'][0]['values'][0] ?? null;
                
                // Intentar encontrar una URL (fórmula IMAGE, metadato de imagen in-cell, etc.)
                $imgUrl = $cell['effectiveValue']['image'] ?? $cell['userEnteredValue']['image'] ?? '';
                
                // Si el valor de la celda es una fórmula IMAGE, intentar extraer la URL
                $formula = $cell['userEnteredValue']['formulaValue'] ?? '';
                if (!$imgUrl && preg_match('/=IMAGE\("([^"]+)"\)/i', $formula, $m)) {
                    $imgUrl = $m[1];
                }
                
                // Si es un simple texto con URL HTTP pegada
                if (!$imgUrl) {
                    $strVal = $cell['effectiveValue']['stringValue'] ?? $cell['userEnteredValue']['stringValue'] ?? '';
                    if ($strVal && strpos(trim($strVal), 'http') === 0) {
                        $imgUrl = trim($strVal);
                    }
                }
                
                // Si es un hipervínculo
                if (!$imgUrl) {
                    $hyperlink = $cell['hyperlink'] ?? '';
                    if ($hyperlink && strpos(trim($hyperlink), 'http') === 0) {
                        $imgUrl = trim($hyperlink);
                    }
                }
            }
        } // Fin de búsqueda de URL

        // Intentar descargar y servir de forma segura (Proxy local para evitar problemas CORS en HTML2PDF)
        if ($imgUrl && strpos($imgUrl, 'http') === 0) {
            $ch = curl_init($imgUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            $img = curl_exec($ch);
            $type = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
            curl_close($ch);
            if ($img) {
                header("Content-Type: $type");
                header("Access-Control-Allow-Origin: *");
                echo $img;
                exit;
            }
        }
        
        // 2. Fallback: Exportar rango E2 como PNG
        $exportUrl = "https://docs.google.com/spreadsheets/d/$SHEET_ID/export?format=png&range=E2&gid=$gid";
        $ch = curl_init($exportUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer $token"]);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $img = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $type = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        curl_close($ch);
        
        if ($httpCode === 200 && $img && strpos($type, 'image') !== false) {
            header("Content-Type: $type");
            echo $img;
            exit;
        }
        
        // Si no hay imagen, devolvemos 404 para que el frontend ponga el icono por defecto
        http_response_code(404);
        header("X-Proxy-Debug: No image found or export failed (Code $httpCode)");
        exit;
    }

    handleAsistencias($token, $SHEET_ID, $p, $body, $notasSheetName, $allSheetNames, $sheetGids);

} catch (Exception $e) {
    fail($e->getMessage());
}

// ── LÓGICA DE NOTAS ──────────────────────────────────────────────────────────
function handleNotas($token, $spreadsheetId, $p, $postBody) {
    $action = $p['action'] ?? ($postBody['action'] ?? '');

    // 1. Obtener nombres y GIDs de todas las hojas (excepto Notas y placeholders)
    $metaUrl = "https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId?fields=sheets.properties(title,sheetId)";
    $meta = sheetsRequest($metaUrl, 'GET', null, $token);
    $allSheetNames = [];
    $sheetGids = [];
    $notasSheetName = null;
    $ignorePatterns = ['/vacio/i', '/plantilla/i', '/config/i', '/asistencias/i'];

    foreach ($meta['sheets'] as $sh) {
        $n = $sh['properties']['title'];
        $id = $sh['properties']['sheetId'];
        $skip = false;
        if (strcasecmp($n, 'Notas') === 0) {
            $notasSheetName = $n;
            $skip = true;
        } else {
            foreach ($ignorePatterns as $pattern) {
                if (preg_match($pattern, $n)) {
                    $skip = true;
                    break;
                }
            }
        }
        if (!$skip) {
            $allSheetNames[] = $n;
            $sheetGids[$n] = $id;
        }
    }

    if ($action === 'get_server_info') {
        global $DATA_FILE;
        ok([
            'dir' => __DIR__,
            'mtime' => file_exists($DATA_FILE) ? date('Y-m-d H:i:s', filemtime($DATA_FILE)) : 'FILE_MISSING',
            'writable' => is_writable($DATA_FILE)
        ]);
    }

    // Removemos la lógica de Auto-crear la hoja "Notas" ya que ahora usamos app_data.json
    
    if ($action === 'get_cursos') {
        // Nueva lógica: leer automáticamente los E2 de TODAS las hojas
        // (excepto la de Notas detectada).
        $names = $allSheetNames;

        $allCursos = [];
        foreach ($names as $name) {
            if ($name === $notasSheetName) continue;
            $allCursos[$name] = true;
            $rangeUrl = "https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/'$name'!C2";
            try {
                $data = sheetsRequest($rangeUrl, 'GET', null, $token);
                $raw = $data['values'][0][0] ?? '';
                if ($raw) {
                    $parts = array_filter(array_map('trim', preg_split('/[,;\n]/', $raw)));
                    foreach ($parts as $c) $allCursos[$c] = true;
                }
            } catch (Exception $e) { continue; }
        }
        $cursos = array_values(array_keys($allCursos));
        $cursos = deduplicateCursos($cursos);
        sort($cursos, SORT_NATURAL | SORT_FLAG_CASE);
        ok(['cursos' => $cursos]);
    }

    if ($action === 'get_portal_init') {
        // 1. Usar nombres de hojas ya obtenidos
        $names = $allSheetNames;

        // 2. Preparar rangos para batchGet: C2 (curso) y C7:C (alumnos) de cada hoja, y Notas!A2:M1000
        $ranges = [];
        foreach ($names as $name) {
            if ($name === $notasSheetName) continue;
            $ranges[] = "'$name'!C2";
            $ranges[] = "'$name'!C4";
            $ranges[] = "'$name'!E2";
            $ranges[] = "'$name'!E4";
            $ranges[] = "'$name'!G2";
            $ranges[] = "'$name'!G4";
            $ranges[] = "'$name'!C7:C";
        }
        if ($notasSheetName) {
            $ranges[] = "'$notasSheetName'!A2:M1000";
        }

        // 3. Ejecutar batchGet
        // Se construye manualmente la query string para evitar el formato ?ranges[0]=... que PHP genera por defecto
        $queryParts = [];
        foreach ($ranges as $r) {
            $queryParts[] = 'ranges=' . urlencode($r);
        }
        $batchUrl = "https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values:batchGet?" . implode('&', $queryParts);
        $batchData = sheetsRequest($batchUrl, 'GET', null, $token);
        $valueRanges = $batchData['valueRanges'] ?? [];

        // 3b. Obtener rangos detallados (con formato) solo para E4 (Descripción)
        $formatRanges = [];
        foreach ($names as $name) {
            if ($name === $notasSheetName) continue;
            $formatRanges[] = 'ranges=' . urlencode("'$name'!E4");
        }
        $formatUrl = "https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId?" . implode('&', $formatRanges) . "&includeGridData=true&fields=sheets(properties(title),data(rowData(values(userEnteredValue,textFormatRuns))))";
        $formatData = sheetsRequest($formatUrl, 'GET', null, $token);
        $e4Formats = [];
        foreach ($formatData['sheets'] ?? [] as $s) {
            $title = $s['properties']['title'] ?? '';
            $cell = $s['data'][0]['rowData'][0]['values'][0] ?? null;
            if ($title && $cell) $e4Formats[$title] = $cell;
        }

        // 4. Procesar resultados
        $allCursos = [];
        $allStudents = [];
        $allNotas = [];
        $sheetMeta = []; // Nuevo: Info de C2 por cada hoja
        $vrIdx = 0;

        foreach ($names as $name) {
            if ($name === $notasSheetName) continue;
            
            // C2 (Curso)
            $c2Data = $valueRanges[$vrIdx++]['values'][0][0] ?? '';
            // C4 (Profesor)
            $c4Data = $valueRanges[$vrIdx++]['values'][0][0] ?? '';
            // E2 (Icono)
            $e2Data = $valueRanges[$vrIdx++]['values'][0][0] ?? '';
            // E4 (Nota/Observación)
            $vrIdx++; 
            $e4Data = isset($e4Formats[$name]) ? cellToHtml($e4Formats[$name]) : trim($valueRanges[$vrIdx-1]['values'][0][0] ?? '');
            // G2 (URL Video YouTube)
            $g2Data = trim($valueRanges[$vrIdx++]['values'][0][0] ?? '');
            // G4 (URL QR)
            $g4Data = trim($valueRanges[$vrIdx++]['values'][0][0] ?? '');
            
            // OPTIMIZACIÓN CRÍTICA: Si ya es un enlace directo en texto, pásalo al proxy local para evitar CORS en HTML2PDF y ahorrar la consulta a Google
            if (is_string($e2Data) && strpos(trim($e2Data), 'http') === 0) {
                $icon = "../api.php?action=get_icon&url=" . urlencode(trim($e2Data));
            } else {
                // Solo usar el proxy costoso (1 llamada a Google por curso) si es una fórmula compleja o imagen insertada
                $icon = "../api.php?action=get_icon&sheetName=" . urlencode($name);
            }
            
            $sheetMeta[$name] = [
                'c2' => $c2Data,
                'c4' => $c4Data,
                'icon' => $icon,
                'note' => $e4Data,
                'video' => $g2Data,
                'qr' => $g4Data
            ]; 
            
            $allCursos[$name] = true;

            // C7:C (Alumnos)
            $studentRows = $valueRanges[$vrIdx++]['values'] ?? [];
            foreach ($studentRows as $row) {
                $sName = $row[0] ?? '';
                if ($sName && isStudent($sName)) {
                    $allStudents[] = ['name' => trim($sName), 'course' => $name];
                }
            }
        }

        // Ya no cargamos Notas!A2:M1000 desde Google Sheets. Cargamos de app_data.json
        $appData = loadAppData();
        $allNotas = $appData['notas'] ?? [];
        $anulados = $appData['anulados'] ?? [];

        $rawCursosNames = array_keys($allCursos);
        $cursosList = deduplicateCursos($rawCursosNames);
        
        // CRITICAL: Mapear nombres de alumnos Y Meta al nombre deduplicado correcto
        $courseMapping = [];
        foreach ($rawCursosNames as $raw) {
            foreach ($cursosList as $final) {
                if (normCurso($raw) === normCurso($final)) {
                    $courseMapping[$raw] = $final;
                    break;
                }
            }
        }
        
        // Normalizar alumnos
        foreach ($allStudents as &$student) {
            if (isset($courseMapping[$student['course']])) {
                $student['course'] = $courseMapping[$student['course']];
            }
        }

        // Normalizar metadata (C2 y Icono)
        $finalMeta = [];
        foreach ($sheetMeta as $rawName => $data) {
            $fName = $courseMapping[$rawName] ?? $rawName;
            // Priorizar la metadata que tenga el C2 más largo (nombre completo)
            if (!isset($finalMeta[$fName]) || strlen($data['c2']) > strlen($finalMeta[$fName]['c2'] ?? '')) {
                $finalMeta[$fName] = $data;
            }
        }

        // Mantener el orden de las hojas del Google Sheets (NO ordenar alfabéticamente)
        // $cursosList ya viene en el mismo orden de las pestañas del spreadsheet

        ok([
            'cursos' => $cursosList,
            'students' => $allStudents,
            'notas' => $allNotas,
            'anulados' => $anulados,
            'trimester_checks' => $appData['trimester_checks'] ?? (object)[],
            'teacher_notes' => $appData['teacher_notes'] ?? (object)[],
            'snapshots' => $appData['snapshots'] ?? [],
            'meta' => $finalMeta,
            'sheets' => array_values(array_filter($names, function($n) use ($notasSheetName) { return $n !== $notasSheetName; }))
        ]);
    }

    if ($action === 'save_trimester_checks') {
        $appData = loadAppData();
        $studentId = $postBody['studentId'] ?? '';
        $checks = $postBody['checks'] ?? null;
        if ($studentId && $checks) {
            $appData['trimester_checks'][$studentId] = $checks;
            saveAppData($appData);
            ok(['status' => 'saved']);
        }
        fail('Faltan datos');
    }

    if ($action === 'search_students_with_notes') {
        $query = mb_strtolower($p['query'] ?? ($postBody['query'] ?? ''));
        $appData = loadAppData();
        $notas = $appData['notas'] ?? [];
        $results = [];
        $seen = [];
        
        foreach ($notas as $n) {
            $name = $n[1] ?? '';
            if ($query && strpos(mb_strtolower($name), $query) === false) continue;
            
            $id = $n[0] ?? '';
            if ($id && !isset($seen[$id])) {
                $results[] = ['id' => $id, 'name' => $name];
                $seen[$id] = true;
                if (count($results) >= 20) break; // Límite de resultados
            }
        }
        ok(['success' => true, 'results' => $results]);
    }

    if ($action === 'get_student_courses_with_notes') {
        $studentId = $p['studentId'] ?? ($postBody['studentId'] ?? '');
        if (!$studentId) fail('Falta ID del alumno');
        
        $appData = loadAppData();
        $notas = $appData['notas'] ?? [];
        $courses = [];
        
        foreach ($notas as $n) {
            if (($n[0] ?? '') === $studentId) {
                $c = $n[2] ?? '';
                if ($c && !in_array($c, $courses)) $courses[] = $c;
                $cAlt = $n[14] ?? '';
                if ($cAlt && !in_array($cAlt, $courses)) $courses[] = $cAlt;
            }
        }
        sort($courses);
        ok(['success' => true, 'courses' => $courses]);
    }

    if ($action === 'reset_student_course_grades') {
        $studentId = $postBody['studentId'] ?? '';
        $courseNames = $postBody['courseNames'] ?? []; // Array de nombres de cursos a borrar
        if (!$studentId || empty($courseNames)) fail('Faltan datos para el reseteo');

        $appData = loadAppData();
        $currentNotas = $appData['notas'] ?? [];
        $toArchive = [];
        $remaining = [];

        foreach ($currentNotas as $n) {
            $sId = $n[0] ?? '';
            $course = $n[2] ?? '';
            $courseAlt = $n[14] ?? '';
            
            $isTargetStudent = ($sId === $studentId);
            $isTargetCourse = in_array($course, $courseNames) || in_array($courseAlt, $courseNames);

            if ($isTargetStudent && $isTargetCourse) {
                $toArchive[] = $n;
            } else {
                $remaining[] = $n;
            }
        }

        if (!empty($toArchive)) {
            $appData['snapshots'][] = [
                'date' => date('Y-m-d H:i:s'),
                'student' => $studentId,
                'data' => $toArchive
            ];
            $appData['notas'] = $remaining;
            saveAppData($appData);
        }
        ok(['success' => true, 'status' => 'reset_done']);
    }

    if ($action === 'get_course_students_from_data') {
        $grado = $p['grado'] ?? ($postBody['grado'] ?? '');
        if (!$grado) fail('Falta el grado/curso');
        
        $appData = loadAppData();
        $notas = $appData['notas'] ?? [];
        $students = [];
        $seen = [];
        
        foreach ($notas as $n) {
            $c = $n[2] ?? '';
            $cAlt = $n[14] ?? '';
            if ($c === $grado || $cAlt === $grado) {
                $id = $n[0] ?? '';
                $name = $n[1] ?? '';
                if ($id && !isset($seen[$id])) {
                    $students[] = ['id' => $id, 'name' => $name];
                    $seen[$id] = true;
                }
            }
        }
        
        usort($students, function($a, $b) { return strcasecmp($a['name'], $b['name']); });
        ok(['success' => true, 'students' => $students]);
    }

    if ($action === 'save_teacher_note') {
        $appData = loadAppData();
        $studentId = $postBody['studentId'] ?? '';
        $note = $postBody['note'] ?? '';
        if ($studentId) {
            $appData['teacher_notes'][$studentId] = $note;
            saveAppData($appData);
            ok(['status' => 'saved']);
        }
        fail('Faltan datos');
    }

    if ($action === 'reset_course') {
        $appData = loadAppData();
        $grado = $postBody['grado'] ?? '';
        $excludedIds = $postBody['excludedIds'] ?? []; // Array de IDs a NO resetear
        if (!$grado) fail('Falta grado');

        // 1. Crear snapshot
        $currentNotas = $appData['notas'] ?? [];
        $toArchive = [];
        $remaining = [];
        foreach ($currentNotas as $n) {
            $course = $n[2] ?? '';
            $courseAlt = $n[14] ?? '';
            $sId = $n[0] ?? '';
            
            $isTargetCourse = ($course === $grado || $courseAlt === $grado);
            $isExcluded = in_array($sId, $excludedIds);

            if ($isTargetCourse && !$isExcluded) {
                $toArchive[] = $n;
            } else {
                $remaining[] = $n;
            }
        }

        if (!empty($toArchive)) {
            $snapshot = [
                'date' => date('Y-m-d H:i:s'),
                'course' => $grado,
                'data' => $toArchive
            ];
            $appData['snapshots'][] = $snapshot;
        }

        // 2. Limpiar notas activas
        $appData['notas'] = $remaining;

        // 3. Limpiar checks de ese curso
        foreach ($toArchive as $n) {
            $sId = $n[0];
            unset($appData['trimester_checks'][$sId]);
        }

        saveAppData($appData);
        ok(['status' => 'reset_done', 'snapshots' => $appData['snapshots']]);
    }

    if ($action === 'delete_historical_student') {
        $date = trim($p['date'] ?? ($postBody['date'] ?? ''));
        $studentName = trim($p['studentName'] ?? ($postBody['studentName'] ?? ''));
        $course = trim($p['course'] ?? ($postBody['course'] ?? ''));
        
        $appData = loadAppData();
        $snapshots = $appData['snapshots'] ?? [];
        $found = false;

        foreach ($snapshots as $idx => &$s) {
            $sDate = trim($s['date'] ?? '');
            $sCourse = trim($s['course'] ?? '');
            
            if ($sDate === $date && $sCourse === $course) {
                $initialCount = count($s['data']);
                $s['data'] = array_values(array_filter($s['data'], function($row) use ($studentName) {
                    $rowName = trim($row[1] ?? ($row[0] ?? ''));
                    return (mb_strtolower($rowName) === mb_strtolower($studentName)) ? false : true;
                }));
                
                if (count($s['data']) !== $initialCount) {
                    $found = true;
                }
            }
        }


        if ($found) {
            // Limpieza: si un snapshot se queda sin alumnos, eliminar el snapshot entero
            $appData['snapshots'] = array_values(array_filter($snapshots, function($s) {
                return !empty($s['data']);
            }));
            saveAppData($appData);
            ok(['status' => 'deleted', 'snapshots' => $appData['snapshots']]);
        }
        
        // Si no se encontró el estudiante pero sí el snapshot, devolvemos éxito para no romper la UI
        // pero avisamos que no hubo cambios.
        ok(['status' => 'no_changes', 'snapshots' => $snapshots]);
    }



    if ($action === 'get_notas') {
        $alumnoId = $p['alumno_id'] ?? '';
        $nombreAlumno = $p['nombre_alumno'] ?? '';
        $grado = $p['grado_academico'] ?? '';
        if (!$alumnoId && !$nombreAlumno) fail('Falta alumno_id o nombre_alumno', 400);
        
        $appData = loadAppData();
        $rows = $appData['notas'] ?? [];
        
        // 1. Filtrado inicial por Alumno ID
        $found = array_filter($rows, function($r) use ($alumnoId) {
            return isset($r[0]) && trim((string)$r[0]) === trim((string)$alumnoId);
        });

        // 2. Fallback: Si no hay por ID, buscar por nombre exacto
        if (empty($found) && $nombreAlumno) {
            $found = array_filter($rows, function($r) use ($nombreAlumno) {
                return isset($r[1]) && trim((string)$r[1]) === trim((string)$nombreAlumno);
            });
        }

        // 3. Filtrado por Grado (solo si se especifica y no es "TODOS")
        if ($grado && $grado !== 'TODOS') {
            $found = array_filter($found, function($r) use ($grado) {
                return isset($r[11]) && trim((string)$r[11]) === trim((string)$grado);
            });
        }
        
        ok(['notas' => array_values($found)]);
    }

    if ($action === 'get_all_notas') {
        $appData = loadAppData();
        $rows = $appData['notas'] ?? [];
        ok(['rows' => $rows]);
    }

    if ($action === 'add_nota') {
        $row = [
            $postBody['alumno_id'],
            $postBody['nombre_alumno'] ?? '',
            $postBody['curso'],
            $postBody['fecha_reading'] ?? '',
            $postBody['reading'] ?? '',
            $postBody['fecha_writing'] ?? '',
            $postBody['writing'] ?? '',
            $postBody['fecha_listening'] ?? '',
            $postBody['listening'] ?? '',
            isset($postBody['media']) ? $postBody['media'] : 0,
            uniqid('n', true), // ID único garantizado
            $postBody['grado_academico'] ?? ''
        ];
        
        $appData = loadAppData();
        $appData['notas'][] = $row;
        saveAppData($appData);
        ok(['message' => 'Nota añadida localmente']);
    }

    if ($action === 'delete_nota') {
        $notaId = $postBody['nota_id'] ?? '';
        if (!$notaId) fail('Falta nota_id', 400);

        $appData = loadAppData();
        if (!isset($appData['notas'])) $appData['notas'] = [];

        $initialCount = count($appData['notas']);
        $appData['notas'] = array_filter($appData['notas'], function($r) use ($notaId) {
            return ($r[10] ?? '') !== (string)$notaId;
        });
        $appData['notas'] = array_values($appData['notas']); // Reindex

        if (count($appData['notas']) === $initialCount) {
            fail('No se encontró la nota a eliminar', 404);
        }

        saveAppData($appData);
        ok(['message' => 'Nota eliminada correctamente']);
    }

    if ($action === 'edit_nota') {
        $notaId = $postBody['nota_id'] ?? '';
        if (!$notaId) fail('Falta nota_id', 400);

        $appData = loadAppData();
        if (!isset($appData['notas'])) $appData['notas'] = [];

        $found = false;
        foreach ($appData['notas'] as &$r) {
            if (($r[10] ?? '') === (string)$notaId) {
                // Usar array_key_exists para respetar valores vacios ('') correctamente
                $r[2]  = array_key_exists('curso', $postBody)           ? $postBody['curso']            : $r[2];
                $r[3]  = array_key_exists('fecha_reading', $postBody)    ? $postBody['fecha_reading']    : $r[3];
                $r[4]  = array_key_exists('reading', $postBody)          ? $postBody['reading']          : $r[4];
                $r[5]  = array_key_exists('fecha_writing', $postBody)    ? $postBody['fecha_writing']    : $r[5];
                $r[6]  = array_key_exists('writing', $postBody)          ? $postBody['writing']          : $r[6];
                $r[7]  = array_key_exists('fecha_listening', $postBody)  ? $postBody['fecha_listening']  : $r[7];
                $r[8]  = array_key_exists('listening', $postBody)        ? $postBody['listening']        : $r[8];
                $r[11] = array_key_exists('grado_academico', $postBody)  ? $postBody['grado_academico']  : $r[11];
                $found = true;
                break;
            }
        }

        if (!$found) fail('No se encontró la nota a editar', 404);

        saveAppData($appData);
        ok(['message' => 'Nota actualizada correctamente']);
    }

    if ($action === 'toggle_anulado') {
        $alumnoId = $postBody['alumno_id'] ?? '';
        $alumnoName = $postBody['alumno_name'] ?? '';
        $isAnulado = $postBody['anulado'] ?? false;
        if (!$alumnoId) fail('Falta alumno_id', 400);

        $appData = loadAppData();
        if (!isset($appData['anulados'])) $appData['anulados'] = [];
        if (!isset($appData['student_log'])) $appData['student_log'] = [];

        $idx = array_search($alumnoId, $appData['anulados']);
        if ($isAnulado && $idx === false) {
            $appData['anulados'][] = $alumnoId;
            $appData['student_log'][] = ['id' => $alumnoId, 'name' => $alumnoName, 'type' => 'baja', 'date' => date('Y-m-d')];
        } else if (!$isAnulado && $idx !== false) {
            array_splice($appData['anulados'], $idx, 1);
            $appData['student_log'][] = ['id' => $alumnoId, 'name' => $alumnoName, 'type' => 'alta', 'date' => date('Y-m-d')];
        }
        saveAppData($appData);
        ok(['message' => 'Estado de alumno actualizado']);
    }

    if ($action === 'get_statistics') {
        $appData = loadAppData();
        $notas = $appData['notas'] ?? [];
        $anulados = $appData['anulados'] ?? [];
        $studentLog = $appData['student_log'] ?? [];

        // 1. Primera aparicion de cada alumno en el sistema (alta implicita)
        $firstSeen = [];
        foreach ($notas as $nota) {
            $id = $nota[0] ?? '';
            if (!$id) continue;
            $dates = array_filter([$nota[3] ?? '', $nota[5] ?? '', $nota[7] ?? '']);
            if (empty($dates)) continue;
            $minDate = min($dates);
            if (!isset($firstSeen[$id]) || $minDate < $firstSeen[$id]['date']) {
                $firstSeen[$id] = [
                    'date' => $minDate, 
                    'name' => $nota[1] ?? '',
                    'course' => $nota[2] ?? ($nota[11] ?? 'Desconocido')
                ];
            }
        }

        // 2. Bajas del log real con timestamps
        $bajasByMonth = [];
        $loggedBajaIds = [];
        foreach ($studentLog as $entry) {
            if (($entry['type'] ?? '') === 'baja') {
                $id = $entry['id'] ?? '';
                $m = substr($entry['date'] ?? '', 0, 7);
                if (!$m) continue;
                $course = $entry['course'] ?? ($firstSeen[$id]['course'] ?? 'Desconocido');
                $bajasByMonth[$m][] = ['name' => ($entry['name'] ?? $id), 'course' => $course];
                if ($id) $loggedBajaIds[] = $id;
            }
        }

        // Backfill: alumnos en 'anulados' que no tienen log de baja (los ponemos en el mes actual)
        $currentMonth = date('Y-m');
        foreach ($anulados as $id) {
            if (!in_array($id, $loggedBajaIds)) {
                $name = $firstSeen[$id]['name'] ?? $id;
                $course = $firstSeen[$id]['course'] ?? 'Desconocido';
                $bajasByMonth[$currentMonth][] = ['name' => $name, 'course' => $course];
            }
        }

        // 3. Altas por mes (primera aparicion en notas)
        $altasByMonth = [];
        foreach ($firstSeen as $id => $data) {
            $m = substr($data['date'], 0, 7);
            if (!$m) continue;
            $altasByMonth[$m][] = ['name' => $data['name'], 'course' => $data['course']];
        }

        // 4. Union de todos los meses y calculo de series acumuladas
        $allMonths = array_unique(array_merge(array_keys($altasByMonth), array_keys($bajasByMonth)));
        sort($allMonths);

        $monthly = [];
        $runActive = 0;
        $runInactive = 0;
        foreach ($allMonths as $m) {
            $altas = $altasByMonth[$m] ?? [];
            $bajas = $bajasByMonth[$m] ?? [];
            
            // Agrupar por curso para el desglose
            $courseBreakdown = [];
            foreach ($altas as $a) {
                $c = $a['course'];
                if (!isset($courseBreakdown[$c])) $courseBreakdown[$c] = ['course' => $c, 'altas' => 0, 'bajas' => 0];
                $courseBreakdown[$c]['altas']++;
            }
            foreach ($bajas as $b) {
                $c = $b['course'];
                if (!isset($courseBreakdown[$c])) $courseBreakdown[$c] = ['course' => $c, 'altas' => 0, 'bajas' => 0];
                $courseBreakdown[$c]['bajas']++;
            }

            $altasCount = count($altas);
            $bajasCount = count($bajas);
            $runActive += $altasCount - $bajasCount;
            $runInactive += $bajasCount;
            
            $monthly[] = [
                'month'            => $m,
                'altas'            => $altasCount,
                'bajas'            => $bajasCount,
                'delta'            => $altasCount - $bajasCount,
                'running_active'   => $runActive,
                'running_inactive' => $runInactive,
                'altas_names'      => array_column($altas, 'name'),
                'bajas_names'      => array_column($bajas, 'name'),
                'breakdown'        => array_values($courseBreakdown)
            ];
        }

        ok([
            'monthly'        => $monthly,
            'total_students' => count($firstSeen),
            'total_active'   => count($firstSeen) - count($anulados),
            'total_inactive' => count($anulados),
        ]);
    }

    if ($action === 'reset_statistics') {
        $appData = loadAppData();
        $appData['student_log'] = [];
        saveAppData($appData);
        ok(['success' => true]);
    }

    if ($action === 'get_waiting_list') {
        $appData = loadAppData();
        ok(['success' => true, 'list' => $appData['waiting_list'] ?? []]);
    }

    if ($action === 'add_waiting_entry') {
        $appData = loadAppData();
        $entry = $postBody['entry'] ?? null;
        if (!$entry) fail('Datos de entrada vacíos');
        
        $entry['id'] = uniqid('w', true);
        $entry['timestamp'] = time();
        $entry['status'] = 'pendiente'; // pendiente, confirmado, nulo
        
        if (!isset($appData['waiting_list'])) $appData['waiting_list'] = [];
        $appData['waiting_list'][] = $entry;
        
        saveAppData($appData);
        ok(['success' => true, 'entry' => $entry]);
    }

    if ($action === 'update_waiting_entry') {
        $appData = loadAppData();
        $id = $postBody['id'] ?? '';
        $updates = $postBody['updates'] ?? [];
        
        if (!$id) fail('ID no proporcionado');
        
        $found = false;
        foreach ($appData['waiting_list'] as &$item) {
            if ($item['id'] === $id) {
                foreach ($updates as $k => $v) {
                    $item[$k] = $v;
                }
                $found = true;
                break;
            }
        }
        
        if ($found) {
            saveAppData($appData);
            ok(['success' => true]);
        } else {
            fail('Entrada no encontrada');
        }
    }

    if ($action === 'delete_waiting_entry') {
        $appData = loadAppData();
        $id = $postBody['id'] ?? '';
        if (!$id) fail('ID no proporcionado');

        $newList = [];
        $found = false;
        foreach ($appData['waiting_list'] as $item) {
            if ($item['id'] === $id) {
                $found = true;
                continue;
            }
            $newList[] = $item;
        }

        if ($found) {
            $appData['waiting_list'] = $newList;
            saveAppData($appData);
            ok(['success' => true]);
        } else {
            fail('Entrada no encontrada');
        }
    }

    if ($action === 'reset_waiting_list') {
        $appData = loadAppData();
        $type = $postBody['type'] ?? 'all'; // all, pendiente, nulo, confirmado

        if ($type === 'all') {
            $appData['waiting_list'] = [];
        } else {
            $newList = [];
            foreach ($appData['waiting_list'] as $item) {
                if ($item['status'] !== $type) {
                    $newList[] = $item;
                }
            }
            $appData['waiting_list'] = $newList;
        }

        saveAppData($appData);
        ok(['success' => true]);
    }
}

// ── LÓGICA DE AJUSTES Y SEGURIDAD ───────────────────────────────────────────
function handleSettings($p, $postBody) {
    $action = $p['action'] ?? ($postBody['action'] ?? '');
    $appData = loadAppData();

    if ($action === 'verify_portal_password') {
        $type = $p['type'] ?? ($postBody['type'] ?? '');
        $passInput = $p['password'] ?? ($postBody['password'] ?? '');
        
        $settings = $appData['settings'] ?? [];
        if ($type === 'B') {
            $correctPass = $settings['passB'] ?? 'certificados123';
        } elseif ($type === 'S') {
            $correctPass = $settings['passStats'] ?? 'Estadisticas123';
        } else {
            $correctPass = $settings['passA'] ?? '2020';
        }
        
        if ($passInput === $correctPass) {
            ok(['success' => true]);
        } else {
            ok(['success' => false, 'error' => 'Contraseña incorrecta']);
        }
    }

    if ($action === 'global_login') {
        $username = $postBody['username'] ?? '';
        $password = $postBody['password'] ?? '';
        $settings = $appData['settings'] ?? [];

        $adminU = $settings['adminUser'] ?? 'Admin';
        $adminP = $settings['adminPass'] ?? 'Admin-1234';

        if ($username === $adminU && $password === $adminP) {
            ok(['success' => true, 'role' => 'admin']);
        }

        // Listado de profesores configurado
        $teacherUsersStr = $settings['teacherUsers'] ?? 'teacher1,teacher2,teacher3,teacher4';
        $teacherUsers = array_map('trim', explode(',', $teacherUsersStr));
        $teacherPass = $settings['passA'] ?? '2020';

        if (in_array($username, $teacherUsers) && $password === $teacherPass) {
            ok(['success' => true, 'role' => 'teacher']);
        }

        ok(['success' => false, 'error' => 'Usuario o contraseña incorrectos']);
    }

    if ($action === 'get_portal_settings') {
        $masterKey = $p['masterKey'] ?? ($postBody['masterKey'] ?? '');
        $settings = $appData['settings'] ?? [];
        $correctMaster = $settings['masterKey'] ?? 'admin99';
        
        if ($masterKey === $correctMaster) {
            ok(['success' => true, 'settings' => $settings]);
        } else {
            fail('Clave Maestra incorrecta', 401);
        }
    }

    if ($action === 'save_portal_settings') {
        $masterKey = $postBody['masterKey'] ?? '';
        $newSettings = $postBody['settings'] ?? [];
        
        $settings = $appData['settings'] ?? [];
        $correctMaster = $settings['masterKey'] ?? 'admin99';
        
        if ($masterKey === $correctMaster) {
            $appData['settings'] = [
                'adminUser' => $newSettings['adminUser'] ?? ($settings['adminUser'] ?? 'Admin'),
                'adminPass' => $newSettings['adminPass'] ?? ($settings['adminPass'] ?? 'Admin-1234'),
                'teacherUsers' => $newSettings['teacherUsers'] ?? ($settings['teacherUsers'] ?? 'teacher1,teacher2,teacher3,teacher4'),
                'passA' => $newSettings['passA'] ?? $settings['passA'],
                'passB' => $newSettings['passB'] ?? $settings['passB'],
                'passStats' => $newSettings['passStats'] ?? ($settings['passStats'] ?? 'Estadisticas123'),
                'masterKey' => $newSettings['masterKey'] ?? $settings['masterKey']
            ];
            saveAppData($appData);
            ok(['success' => true, 'message' => 'Ajustes guardados correctamente']);
        } else {
            fail('Clave Maestra incorrecta', 401);
        }
    }

    if ($action === 'get_web_config') {
        // Las notas se guardan como arrays indexados: índice [11] = grado_academico
        $cursos = [];
        if (!empty($appData['notas'])) {
            foreach ($appData['notas'] as $nt) {
                // Formato indexado: r[11] = grado_academico
                $grado = is_array($nt) ? ($nt[11] ?? '') : '';
                if (!empty(trim((string)$grado))) {
                    $cursos[] = trim((string)$grado);
                }
            }
        }
        $cursos = array_values(array_unique($cursos));
        sort($cursos);

        ok([
            'success' => true, 
            'web_config' => $appData['web_config'] ?? [],
            'cursos' => $cursos
        ]);
    }

    if ($action === 'save_web_config') {
        $newConfig = $postBody['web_config'] ?? [];
        $appData['web_config'] = array_merge($appData['web_config'] ?? [], $newConfig);
        saveAppData($appData);
        ok(['success' => true, 'message' => 'Configuración web guardada']);
    }

    if ($action === 'get_backup_info') {
        $diariaDir = __DIR__ . '/backupdiaria';
        $semanalDir = __DIR__ . '/backupsemanal';
        
        $diariaFiles = glob($diariaDir . '/backup_diaria_*.zip');
        $semanalFiles = glob($semanalDir . '/backup_semanal_*.zip');
        
        // También buscar el archivo antiguo por si acaso
        if (file_exists($diariaDir . '/backup_web_completa.zip')) $diariaFiles[] = $diariaDir . '/backup_web_completa.zip';
        if (file_exists($semanalDir . '/backup_web_completa.zip')) $semanalFiles[] = $semanalDir . '/backup_web_completa.zip';

        $info = ['success' => true, 'diaria' => [], 'semanal' => []];
        
        foreach ($diariaFiles as $file) {
            $info['diaria'][] = [
                'filename' => basename($file),
                'date' => date('d/m/Y H:i:s', filemtime($file)),
                'size_mb' => round(filesize($file) / 1024 / 1024, 2)
            ];
        }
        foreach ($semanalFiles as $file) {
            $info['semanal'][] = [
                'filename' => basename($file),
                'date' => date('d/m/Y H:i:s', filemtime($file)),
                'size_mb' => round(filesize($file) / 1024 / 1024, 2)
            ];
        }
        
        // Ordenar por fecha descendente
        usort($info['diaria'], function($a, $b) { return filemtime(__DIR__ . '/backupdiaria/' . $b['filename']) - filemtime(__DIR__ . '/backupdiaria/' . $a['filename']); });
        usort($info['semanal'], function($a, $b) { return filemtime(__DIR__ . '/backupsemanal/' . $b['filename']) - filemtime(__DIR__ . '/backupsemanal/' . $a['filename']); });

        ok($info);
    }

    if ($action === 'restore_backup') {
        $type = $postBody['type'] ?? '';
        $filename = $postBody['filename'] ?? '';
        
        if ($type !== 'diaria' && $type !== 'semanal') {
            fail('Tipo de backup inválido', 400);
        }
        if (!$filename) {
            fail('Debes seleccionar un archivo de copia', 400);
        }

        // Seguridad: Evitar path traversal
        $filename = basename($filename);
        $backupFile = __DIR__ . "/backup$type/$filename";
        
        if (!file_exists($backupFile)) {
            fail("No existe la copia de seguridad: $filename", 404);
        }
        
        $zip = new ZipArchive;
        if ($zip->open($backupFile) === TRUE) {
            // Extraer en el directorio actual (raíz de la web)
            $zip->extractTo(__DIR__);
            $zip->close();
            ok(['success' => true, 'message' => "Datos restaurados correctamente desde $filename"]);
        } else {
            fail('Error al abrir el archivo de backup zip', 500);
        }
    }

    if ($action === 'run_backup') {
        // Esta acción solo debería permitirse a admins (ya filtrado por handleSettings caller si pusiéramos auth, 
        // pero aquí depende de cómo se llame. Para simplificar, asumimos que el frontend de admin lo llama).
        $type = $postBody['type'] ?? ''; // 'diaria' o 'semanal'
        if ($type !== 'diaria' && $type !== 'semanal') {
            fail('Tipo de backup inválido', 400);
        }

        $secret = 'academy_secure_backup_2026';
        $script = "auto_backup_$type.php";
        
        // Simular ejecución del script localmente
        $_GET['key'] = $secret;
        ob_start();
        include(__DIR__ . '/' . $script);
        $result = ob_get_clean();
        
        if (strpos($result, 'éxito') !== false || strpos($result, 'completada') !== false) {
            ok(['success' => true, 'message' => $result]);
        } else {
            fail("Error al ejecutar el backup: " . strip_tags($result));
        }
    }

    if ($action === 'reset_all_attendance') {
        $masterKey = $postBody['masterKey'] ?? '';
        $settings = $appData['settings'] ?? [];
        $correctMaster = $settings['masterKey'] ?? 'admin99';
        
        if ($masterKey === $correctMaster) {
            $appData['asistencias_historial'] = [];
            saveAppData($appData);
            ok(['success' => true, 'message' => 'Todas las faltas han sido reseteadas correctamente.']);
        } else {
            fail('Clave Maestra incorrecta', 401);
        }
    }
}

// ── LÓGICA DE ASISTENCIAS ────────────────────────────────────────────────────
function handleAsistencias($token, $spreadsheetId, $p, $postBody, $notasSheetName, $allSheetNames, $sheetGids = []) {
    $action = $p['action'] ?? ($postBody['action'] ?? '');
    $sheetName = $p['sheetName'] ?? ($postBody['sheetName'] ?? '');
    $appData = loadAppData();


    if ($action === 'get_sheets') {
        ok(['sheets' => array_values(array_filter($allSheetNames, function($s) use ($notasSheetName) { return $s !== $notasSheetName; }))]);
    }

    if ($action === 'get_historical_marks') {
        $marks = $appData['asistencias_historial'] ?? (object)[];
        $overrides = $appData['day_overrides'] ?? (object)[];
        $extraCols = $appData['extra_columns'] ?? (object)[];
        ok(['marks' => $marks, 'overrides' => $overrides, 'extra_columns' => $extraCols]);
    }

    if ($action === 'get_summary') {
        if (!$sheetName) fail('Falta el nombre de la hoja (sheetName)', 400);
        $url = "https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/'$sheetName'!A1:ZZ1000";
        $data = sheetsRequest($url, 'GET', null, $token);
        $rows = $data['values'] ?? [];
        
        $validDatesData = [];
        $studentCol = 2; // Col C
        $professor = '';
        $courseName = $sheetName;

        if (count($rows) >= 6) {
            $headersRow = $rows[5] ?? [];
            $studentCol = findStudentColumn($rows[4] ?? ($rows[5] ?? []));
            $validDatesData = parseMonthDates($headersRow);
            $professor = $rows[3][2] ?? '';
            $courseName = $rows[1][2] ?? $sheetName;
        } else {
            // Fallback: Hoja nueva, intentar obtener lista de alumnos de C
            $rangeFallback = "'$sheetName'!A1:C100";
            $dataFallback = sheetsRequest("https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/" . rawurlencode($rangeFallback), 'GET', null, $token);
            $rows = $dataFallback['values'] ?? [];
            $studentCol = findStudentColumn($rows[4] ?? ($rows[5] ?? []));
            $professor = $rows[3][2] ?? '';
            $courseName = $rows[1][2] ?? $sheetName;
        }

        $summaryByMonth = [];
        foreach ($validDatesData as $d) {
            $m = $d['monthStr'];
            if (!isset($summaryByMonth[$m])) $summaryByMonth[$m] = ['dates' => [], 'students' => []];
            if (!in_array($d['dateStr'], $summaryByMonth[$m]['dates'])) $summaryByMonth[$m]['dates'][] = $d['dateStr'];
        }

        for ($i = 6; $i < count($rows); $i++) {
            $sName = $rows[$i][$studentCol] ?? '';
            if (!isStudent($sName)) continue;
            $cleanName = trim($sName);
            
            $recs = [];
            foreach ($validDatesData as $d) {
                // User said "ya no tenemos ni x ni nada eso no lo toques". 
                // We keep the structure but don't try to parse flags.
                $recs[$d['dateStr']] = ''; 
            }

            foreach ($summaryByMonth as $month => &$mRef) {
                $studentRecords = (object)[];
                foreach ($mRef['dates'] as $ds) {
                    $val = $recs[$ds] ?? '';
                    // Override with JSON data if exists for this student/date
                    $jsonMarks = $appData['asistencias_historial'] ?? [];
                    $key = trim($cleanName) . '|' . $ds;
                    if (isset($jsonMarks[$key])) $val = $jsonMarks[$key];
                    
                    $studentRecords->$ds = $val;
                }
                $mRef['students'][] = ['name' => $cleanName, 'records' => $studentRecords];
            }
        }
        
        $summaryResponse = empty($summaryByMonth) ? (object)[] : $summaryByMonth;
        ok([
            'summaryByMonth' => $summaryResponse, 
            'totalDatesCount' => count($validDatesData),
            'professor' => $professor,
            'courseName' => $courseName
        ]);
    }

    if ($action === 'get_all_students') {
        $names = $allSheetNames;
        
        $ranges = [];
        foreach ($names as $name) {
            if ($name === $notasSheetName) continue;
            // Solo necesitamos la columna C a partir de la fila 7
            $ranges[] = 'ranges=' . urlencode("'$name'!C7:C");
        }
        
        if (empty($ranges)) {
            ok(['students' => []]);
        }
        
        $batchUrl = "https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values:batchGet?" . implode('&', $ranges);
        $batchData = sheetsRequest($batchUrl, 'GET', null, $token);
        $valueRanges = $batchData['valueRanges'] ?? [];
        
        $all = [];
        $vrIdx = 0;
        
        foreach ($names as $name) {
            if ($name === $notasSheetName) continue;
            
            $studentRows = $valueRanges[$vrIdx++]['values'] ?? [];
            foreach ($studentRows as $row) {
                $sName = $row[0] ?? '';
                if ($sName && isStudent($sName)) {
                    $all[] = [
                        'name' => trim($sName), 
                        'course' => $name,
                        'sheetName' => $name // Alias for backward compatibility
                    ];
                }
            }
        }
        
        ok(['students' => $all]);
    }

    if ($action === 'get_students_by_course') {
        if (!$sheetName) fail('Falta sheetName', 400);
        // En todas las hojas: el primer alumno está en C7 y continúa hacia abajo.
        // Leemos directamente esa columna para evitar problemas con merges/filas recortadas.
        $range = "'$sheetName'!C7:C";
        $url = "https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/" . rawurlencode($range);
        $data = sheetsRequest($url, 'GET', null, $token);
        $rows = $data['values'] ?? [];
        $students = [];
        foreach ($rows as $r) {
            $sName = $r[0] ?? '';
            if (isStudent($sName)) {
                $clean = trim((string)$sName);
                if ($clean) $students[$clean] = true;
            }
        }
        $out = array_values(array_keys($students));
        sort($out, SORT_NATURAL | SORT_FLAG_CASE);

        // También obtener profesor (C4) y curso (C2) para Notas
        $headerRange = "'$sheetName'!C2:C4";
        $headerUrl = "https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/" . rawurlencode($headerRange);
        $headerData = sheetsRequest($headerUrl, 'GET', null, $token);
        $courseName = $headerData['values'][0][0] ?? $sheetName;
        $professor = $headerData['values'][2][0] ?? '';

        $debug = ($p['debug'] ?? '') === '1';
        if ($debug) {
            ok([
                'sheetName' => $sheetName,
                'range' => $range,
                'rawCount' => count($rows),
                'rawSample' => array_slice($rows, 0, 20),
                'studentsCount' => count($out),
                'studentsSample' => array_slice($out, 0, 50),
                'courseName' => $courseName,
                'professor' => $professor
            ]);
        }
        ok(['students' => $out, 'sheetName' => $sheetName, 'courseName' => $courseName, 'professor' => $professor]);
    }

    // POST: bulk_save_summary y save_attendance
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $pAction = $postBody['action'] ?? '';
        $sName = $postBody['sheetName'] ?? '';

        if ($pAction === 'save_historical_marks') {
            $newMarks = $postBody['marks'] ?? [];
            if (!is_array($newMarks)) $newMarks = (array)$newMarks;
            
            $appData = loadAppData();
            if (!isset($appData['asistencias_historial'])) $appData['asistencias_historial'] = [];
            else $appData['asistencias_historial'] = (array)$appData['asistencias_historial'];
            
            // Merge new marks with existing ones
            foreach ($newMarks as $key => $val) {
                if ($val === '') unset($appData['asistencias_historial'][$key]);
                else $appData['asistencias_historial'][$key] = $val;
            }
            
            $res = saveAppData($appData);
            if ($res === false) fail('Error al escribir en app_data.json. Revisa permisos.');
            
            ok(['message' => 'Historial persistido', 'count' => count($appData['asistencias_historial'])]);
        }
        
        if ($pAction === 'save_day_override') {
            $key = $postBody['key'] ?? '';
            $label = $postBody['label'] ?? '';
            if (!$key) fail('Falta la clave (key) para el día', 400);

            $appData = loadAppData();
            if (!isset($appData['day_overrides'])) $appData['day_overrides'] = [];
            else $appData['day_overrides'] = (array)$appData['day_overrides'];

            if ($label === '') {
                unset($appData['day_overrides'][$key]);
            } else {
                $appData['day_overrides'][$key] = $label;
            }

            saveAppData($appData);
            ok(['message' => 'Etiqueta de día guardada', 'key' => $key, 'label' => $label]);
        }

        if ($pAction === 'save_extra_columns') {
            $monthKey = $postBody['monthKey'] ?? ''; // e.g. Course|ABRIL 2026
            $count = (int)($postBody['count'] ?? 0);
            if (!$monthKey) fail('Falta monthKey', 400);

            $appData = loadAppData();
            if (!isset($appData['extra_columns'])) $appData['extra_columns'] = [];
            else $appData['extra_columns'] = (array)$appData['extra_columns'];

            $appData['extra_columns'][$monthKey] = $count;
            saveAppData($appData);
            ok(['message' => 'Contador de columnas fijas guardado', 'count' => $count]);
        }

        if ($pAction === 'save_highlight') {
            $studentName = $postBody['studentName'] ?? '';
            $highlight = $postBody['highlight'] ?? false;
            if (!$studentName) fail('Falta studentName');
            
            if (!isset($appData['highlights'])) $appData['highlights'] = [];
            
            if ($highlight) {
                $appData['highlights'][$studentName] = true;
            } else {
                unset($appData['highlights'][$studentName]);
            }
            saveAppData($appData);
            ok(['message' => 'Destacado actualizado']);
        }

        if ($pAction === 'bulk_save_summary') {
            $summaryData = $postBody['summaryData'] ?? [];
            $url = "https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/'$sName'!A1:ZZ1000";
            $data = sheetsRequest($url, 'GET', null, $token);
            $rows = $data['values'] ?? [];
            while (count($rows) < 6) $rows[] = [];
            
            $headersRow = $rows[5] ?? [];
            $studentCol = findStudentColumn($rows[4] ?? ($rows[5] ?? []));
            $rowMap = []; $colMap = [];
            
            for ($i = 6; $i < count($rows); $i++) {
                $n = trim($rows[$i][$studentCol] ?? '');
                if ($n) $rowMap[$n] = $i;
            }
            for ($j = 5; $j < count($headersRow); $j++) {
                $d = trim($headersRow[$j] ?? '');
                if ($d) $colMap[$d] = $j;
            }

            foreach ($summaryData['summaryByMonth'] ?? [] as $month => $mDat) {
                foreach ($mDat['students'] ?? [] as $student) {
                    if (!isset($rowMap[$student['name']])) continue;
                    $ri = $rowMap[$student['name']];
                    foreach ($student['records'] ?? [] as $date => $val) {
                        if (!isset($colMap[$date])) {
                            $ci = 5; while (!empty($headersRow[$ci])) $ci++;
                            $headersRow[$ci] = $date; $colMap[$date] = $ci; $rows[5] = $headersRow;
                        } else $ci = $colMap[$date];
                        if (!isset($rows[$ri])) $rows[$ri] = [];
                        $rows[$ri][$ci] = $val;
                    }
                }
            }
            $updateUrl = "https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/'$sName'!A1?valueInputOption=USER_ENTERED";
            sheetsRequest($updateUrl, 'PUT', ['values' => $rows], $token);
            ok(['message' => 'Cambios guardados en resumen']);
        }

        // Guardar asistencia diaria
        $dDate = $postBody['date'] ?? '';
        $attendances = $postBody['attendances'] ?? [];
        $url = "https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/'$sName'!A1:ZZ500";
        $data = sheetsRequest($url, 'GET', null, $token);
        $rows = $data['values'] ?? [];
        $headersRow = $rows[5] ?? [];
        $dateCol = array_search($dDate, $headersRow);
        $studentCol = findStudentColumn($rows[4] ?? ($rows[5] ?? []));
        if ($dateCol === false) { $e = 5; while (!empty($headersRow[$e])) $e++; $dateCol = $e; }
        
        $colLetter = indexToLetter($dateCol);
        $updateData = [[$dDate]];
        for ($i = 6; $i < max(count($rows), count($attendances) + 6); $i++) {
            $sNameI = $rows[$i][$studentCol] ?? '';
            if (isStudent($sNameI)) {
                $found = false;
                foreach ($attendances as $a) {
                    if (trim($a['name']) === trim($sNameI)) { $updateData[] = [$a['status']]; $found = true; break; }
                }
                if (!$found) $updateData[] = [''];
            } else $updateData[] = [''];
        }
        $updateUrl = "https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/'$sName'!{$colLetter}6:{$colLetter}" . (5 + count($updateData)) . "?valueInputOption=USER_ENTERED";
        sheetsRequest($updateUrl, 'PUT', ['values' => $updateData], $token);
        ok(['message' => 'Asistencia guardada']);
    }

    // Default: Asistencia individual (GET)
    $date = $p['date'] ?? '';
    if (!$sheetName || !$date) fail('Falta sheetName o date para Asistencias', 400);
    $url = "https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/'$sheetName'!A1:ZZ1000";
    $data = sheetsRequest($url, 'GET', null, $token);
    $rows = $data['values'] ?? [];

    $contacts = getGoogleContacts($token);

    if (count($rows) < 6) {
        $range = "'$sheetName'!C7:C";
        $students = [];
        try {
            $sUrl = "https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/" . rawurlencode($range);
            $sData = sheetsRequest($sUrl, 'GET', null, $token);
            foreach ($sData['values'] ?? [] as $r) {
                if (isStudent($r[0] ?? '')) {
                    $cleanName = trim($r[0]);
                    $students[] = [
                        'name' => $cleanName,
                        'status' => '',
                        'phone' => $contacts[$cleanName] ?? ''
                    ];
                }
            }
        } catch(Exception $e) {}
        
        $headerRange = "'$sheetName'!C2:I4";
        $courseName = $sheetName;
        $professor = '';
        $horario = '';
        try {
            $hUrl = "https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/" . rawurlencode($headerRange);
            $hData = sheetsRequest($hUrl, 'GET', null, $token);
            $hRows = $hData['values'] ?? [];
            $courseName = $hRows[0][0] ?? $sheetName;
            $professor = $hRows[2][0] ?? '';
            $horario = $hRows[0][6] ?? ''; // Celda I2 (C es 0, D es 1, E es 2, F es 3, G es 4, H es 5, I es 6 relativo a C)
        } catch(Exception $e) {}
        
        ok(['date' => $date, 'students' => $students, 'sheetName' => $sheetName, 'professor' => $professor, 'courseName' => $courseName, 'horario' => $horario, 'anulados' => $appData['anulados'] ?? [], 'highlights' => $appData['highlights'] ?? []]);
    }

    $headersRow = $rows[5] ?? [];
    $studentCol = findStudentColumn($rows[4] ?? ($rows[5] ?? []));
    $dateIdx = array_search($date, $headersRow);
    $students = [];
    $professor = $rows[3][2] ?? ''; // Fila 4, Columna C (índice 2)
    for ($i = 6; $i < count($rows); $i++) {
        $sName = $rows[$i][$studentCol] ?? '';
        if (isStudent($sName)) {
            $cleanName = trim($sName);
            $students[] = [
                'name' => $cleanName,
                'status' => ($dateIdx !== false) ? ($rows[$i][$dateIdx] ?? '') : '',
                'phone' => $contacts[$cleanName] ?? ''
            ];
        }
    }
    $courseName = $rows[1][2] ?? $sheetName; // C2
    $horario = $rows[1][8] ?? ''; // I2
    ok(['date' => $date, 'students' => $students, 'sheetName' => $sheetName, 'professor' => $professor, 'courseName' => $courseName, 'horario' => $horario, 'anulados' => $appData['anulados'] ?? [], 'highlights' => $appData['highlights'] ?? []]);
}

function cellToHtml($cell) {
    if (!$cell) return "";
    $value = $cell['userEnteredValue']['stringValue'] ?? '';
    $runs = $cell['textFormatRuns'] ?? [];
    if (!$value) return "";
    if (empty($runs)) return nl2br(htmlspecialchars($value));

    // Asegurarse de que los runs estén ordenados por startIndex
    usort($runs, function($a, $b) {
        return ($a['startIndex'] ?? 0) - ($b['startIndex'] ?? 0);
    });

    $html = "";
    $isBold = false;
    $isItalic = false;
    $lastIdx = 0;

    foreach ($runs as $run) {
        $start = $run['startIndex'] ?? 0;
        if ($start > $lastIdx) {
            $chunk = mb_substr($value, $lastIdx, $start - $lastIdx);
            $text = htmlspecialchars($chunk);
            $text = str_replace("\n", "<br>", $text);
            $tags = ($isBold ? "<b>" : "") . ($isItalic ? "<i>" : "");
            $endTags = ($isItalic ? "</i>" : "") . ($isBold ? "</b>" : "");
            $html .= $tags . $text . $endTags;
        }
        $isBold = isset($run['format']['bold']) && $run['format']['bold'] === true;
        $isItalic = isset($run['format']['italic']) && $run['format']['italic'] === true;
        $lastIdx = $start;
    }

    // Procesar el resto del texto hasta el final
    $chunk = mb_substr($value, $lastIdx);
    if ($chunk !== "") {
        $text = htmlspecialchars($chunk);
        $text = str_replace("\n", "<br>", $text);
        $tags = ($isBold ? "<b>" : "") . ($isItalic ? "<i>" : "");
        $endTags = ($isItalic ? "</i>" : "") . ($isBold ? "</b>" : "");
        $html .= $tags . $text . $endTags;
    }

    return $html;
}

// ── HELPERS EXTRAS ───────────────────────────────────────────────────────────
function isStudent($name) {
    if (!$name || !is_string($name)) return false;
    $t = strtoupper(trim($name));
    if (!$t || $t === '0' || $t === 'FALSE') return false;

    // Filas/etiquetas que NO son alumnos (en vuestras hojas aparecen en la misma columna)
    $blocked = [
        'MEMORIA',
        'ASISTENCIA',
        'CLASE ONLINE',
        'CLASE RECUPERADA',
        'FACTURAR CLASE',
        'VIAJE O ENFERMEDAD',
    ];
    if (in_array($t, $blocked, true)) return false;

    // Bloqueo por palabras clave (por si varían ligeramente)
    if (str_contains($t, 'CLASE ')) return false;
    if (str_contains($t, 'FACTURAR')) return false;
    if (str_contains($t, 'VIAJE')) return false;
    if (str_contains($t, 'ENFERMEDAD')) return false;

    return true;
}

function findStudentColumn($row) {
    foreach ($row as $idx => $cell) {
        if ($cell && strpos(strtoupper($cell), 'ALUMNO') !== false) return $idx;
    }
    return 2; // Default a Col C (índice 2)
}

function indexToLetter($i) {
    $l = ''; while ($i >= 0) { $l = chr(($i % 26) + 65) . $l; $i = floor($i / 26) - 1; } return $l;
}

function normCurso($s) {
    if (!is_string($s)) return '';
    $s = mb_strtolower($s, 'UTF-8');
    
    // Mapeos específicos del usuario (Nombres largos prioritarios)
    // Usamos (?! [a-z]) para que coincida con "PRL" o "PRL2" pero no con "PRLargo"
    $s = preg_replace('/an(?![a-z])/i', 'anual', $s);
    $s = preg_replace('/ex(?![a-z])/i', 'exams', $s);
    $s = preg_replace('/pr(?![a-z])/i', 'prepare', $s);
    $s = preg_replace('/perso(?![a-z])/i', 'personalizadas', $s);
    $s = preg_replace('/prl(?![a-z])/i', 'prepare level', $s);
    
    $s = preg_replace('/[^a-z0-9]/', '', $s);
    return $s;
}

function deduplicateCursos($cursos) {
    if (empty($cursos)) return [];

    // Primero, encontrar el nombre más largo (representativo) para cada clave normalizada
    // manteniendo el orden de aparición del primero de cada grupo
    $normToLongest = []; // normKey => nombre más largo
    $normOrder = [];     // normKey => índice de primera aparición (para ordenar después)
    foreach ($cursos as $idx => $c) {
        $nC = normCurso($c);
        if (!$nC) continue;
        if (!isset($normToLongest[$nC])) {
            $normToLongest[$nC] = $c;
            $normOrder[$nC] = $idx;
        } elseif (strlen($c) > strlen($normToLongest[$nC])) {
            // Nombre más largo = más descriptivo, pero mantenemos la posición original
            $normToLongest[$nC] = $c;
        }
    }

    // Ordenar por primera aparición para preservar el orden del Sheets
    asort($normOrder);
    $result = [];
    foreach ($normOrder as $nC => $idx) {
        $result[] = $normToLongest[$nC];
    }
    return $result;
}


function parseMonthDates($headersRow) {
    $rawDates = [];
    $currentYear = date('Y');
    for ($j = 5; $j < count($headersRow); $j++) {
        $dateVal = trim($headersRow[$j] ?? '');
        if (!$dateVal) continue;
        if (strpos($dateVal, '/') !== false) {
            $p = explode('/', $dateVal);
            $d = (int)$p[0]; $m = (int)$p[1];
            $y = isset($p[2]) ? (strlen($p[2]) == 2 ? 2000 + (int)$p[2] : (int)$p[2]) : $currentYear;
            if ($d && $m) $rawDates[] = ['colIndex' => $j, 'dateStr' => $dateVal, 'day' => $d, 'month' => $m, 'year' => $y];
        }
    }
    $MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    $res = [];
    foreach ($rawDates as $rd) {
        $mIdx = $rd['month'] - 1;
        $monthStr = (isset($MONTHS[$mIdx])) ? "{$MONTHS[$mIdx]} {$rd['year']}" : 'Otros';
        $res[] = ['colIndex' => $rd['colIndex'], 'dateStr' => $rd['dateStr'], 'monthStr' => $monthStr];
    }
    return $res;
}
?>
