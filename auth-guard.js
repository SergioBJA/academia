(function() {
    // Verificar si hay una sesión activa (creada en index.html al entrar con contraseña)
    // La sesión expira después de 2 horas de inactividad
    const sessionTime = localStorage.getItem('admin_session');
    const MAX_SESSION_AGE = 2 * 60 * 60 * 1000; // 2 horas en ms

    if (!sessionTime || (Date.now() - parseInt(sessionTime)) > MAX_SESSION_AGE) {
        console.warn('Acceso denegado: Sesión no válida o expirada.');
        // Redirigir al portal raíz. Intentamos varias rutas comunes si falla la relativa.
        // En Cloudflare Pages, si está en una subcarpeta, ../index.html suele ser correcto.
        window.location.href = '../index.html';
    } else {
        // Actualizar el timestamp de la sesión para mantenerla viva mientras navega
        localStorage.setItem('admin_session', Date.now());
    }
})();
