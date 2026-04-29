<?php
/**
 * Script de copia de seguridad automática para la web completa - DIARIA
 * Se recomienda ejecutar mediante Tarea Cron de Hostinger cada día de madrugada.
 */

// Dar un poco más de tiempo de ejecución por si la web pesa mucho (5 minutos)
set_time_limit(300);

// Seguridad: Si se ejecuta desde el navegador, debe tener una clave válida
define('BACKUP_SECRET', 'academy_secure_backup_2026');
if (php_sapi_name() !== 'cli') {
    if (!isset($_GET['key']) || $_GET['key'] !== BACKUP_SECRET) {
        die("Acceso no autorizado.");
    }
}

// Rutas clave
$sourceDir = __DIR__; // Carpeta actual (normalmente public_html/webAdministrador)
$backupFolder = __DIR__ . '/backupdiaria'; 
$timestamp = date('Y-m-d_H-i');
$backupFile = $backupFolder . "/backup_diaria_$timestamp.zip";

// 1. Verificar si existe la carpeta 'backupdiaria', si no, intertar crearla
if (!file_exists($backupFolder)) {
    if (!mkdir($backupFolder, 0755, true)) {
        die("Error: No se pudo crear/acceder a la carpeta de backups en $backupFolder.\nPor favor, crea manualmente la carpeta 'backupdiaria'.");
    }
}

// 2. Iniciar la compresión Zip
$zip = new ZipArchive();
// Usamos OVERWRITE para que reemplace el archivo y siempre tengas solo UNA copia actualizada (para no llenar el servidor)
if ($zip->open($backupFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
    die("Error: No se pudo crear o sobrescribir el archivo zip.");
}

// 3. Explorar todos los archivos dentro de la carpeta de la web
$files = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($sourceDir, RecursiveDirectoryIterator::SKIP_DOTS),
    RecursiveIteratorIterator::LEAVES_ONLY
);

// 4. Agregar cada archivo al zip
foreach ($files as $name => $file) {
    $filePath = $file->getRealPath();
    
    // Ignorar archivos y carpetas específicas
    if (strpos($filePath, '.git') !== false) continue;
    if (strpos($filePath, 'backupdiaria') !== false) continue;
    if (strpos($filePath, 'backupsemanal') !== false) continue;
    
    // Tampoco guardar el backup anterior de 15m si existe (limpieza)
    if (strpos($filePath, 'app_data_backup.json') !== false) continue;
    
    // Sacamos la ruta relativa para que en el .zip todo esté ordenado
    $relativePath = substr($filePath, strlen($sourceDir) + 1);

    $zip->addFile($filePath, $relativePath);
}

// 5. Cerrar el zip
$zip->close();

// 6. Rotación de Backups: Mantener solo los últimos 7
$backups = glob($backupFolder . '/backup_diaria_*.zip');
if (count($backups) > 7) {
    // Ordenar por fecha de modificación (más antiguos primero)
    array_multisort(array_map('filemtime', $backups), SORT_ASC, $backups);
    $toDelete = count($backups) - 7;
    for ($i = 0; $i < $toDelete; $i++) {
        unlink($backups[$i]);
    }
}

$fileCount = $zip->numFiles;
$size = round(filesize($backupFile) / 1024 / 1024, 2);

// Mensaje de éxito
echo "✅ Backup DIARIA completada con éxito.\n";
echo "📊 Archivos procesados: $fileCount\n";
echo "📦 Tamaño total: $size MB\n";
echo "🕒 Fecha: " . date('Y-m-d H:i:s') . "\n";
echo "📂 Ruta: " . $backupFile . "\n";
?>
