<?php
/**
 * Script de copia de seguridad automática para la web completa
 * Se recomienda ejecutar mediante Tarea Cron de Hostinger cada hora.
 */

// Dar un poco más de tiempo de ejecución por si la web pesa mucho (5 minutos)
set_time_limit(300);

// Rutas clave
$sourceDir = __DIR__; // Carpeta actual (normalmente public_html)
$backupFolder = dirname(__DIR__) . '/backups'; // Carpeta 'backups' al mismo nivel que public_html
$backupFile = $backupFolder . '/backup_web_completa.zip';

// 1. Verificar si existe la carpeta 'backups', si no, intertar crearla
if (!file_exists($backupFolder)) {
    if (!mkdir($backupFolder, 0755, true)) {
        die("Error: No se pudo crear/acceder a la carpeta de backups en $backupFolder.\nPor favor, crea manualmente la carpeta 'backups' junto a public_html.");
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
    
    // Ignorar las carpetas ocultas del sistema (como .git si hubiera) o el propio script de backup
    if (strpos($filePath, '.git') !== false) continue;
    
    // Sacamos la ruta relativa para que en el .zip todo esté ordenado
    $relativePath = substr($filePath, strlen($sourceDir) + 1);

    $zip->addFile($filePath, $relativePath);
}

// 5. Cerrar el zip
$zip->close();

// Mensaje de éxito
echo "✅ Backup completado y sobrescrito con éxito.\n";
echo "🕒 Fecha y hora: " . date('Y-m-d H:i:s') . "\n";
echo "📂 Archivo guardado en: " . $backupFile . "\n";
?>
