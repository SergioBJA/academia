(function() {
    // Configuración de tiempos
    const MAX_SESSION_AGE = 2 * 60 * 60 * 1000; // 2 horas (límite máximo absoluto)
    const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutos de inactividad
    
    let inactivityTimer;

    function logout() {
        console.warn('Sesión expirada por inactividad.');
        // Redirigir al portal raíz
        window.location.href = '../index.html';
    }

    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(logout, INACTIVITY_TIMEOUT);
        // Actualizar el timestamp de la sesión para mantenerla viva mientras haya actividad
        localStorage.setItem('admin_session', Date.now());
    }

    const sessionTime = localStorage.getItem('admin_session');
    if (!sessionTime || (Date.now() - parseInt(sessionTime)) > MAX_SESSION_AGE) {
        console.warn('Acceso denegado: Sesión no válida o expirada.');
        logout();
    } else {
        // Inicializar el temporizador y los escuchadores de eventos
        resetInactivityTimer();

        // Lista de eventos que cuentan como actividad del usuario
        const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        
        activityEvents.forEach(eventName => {
            window.addEventListener(eventName, resetInactivityTimer, { passive: true });
        });
    }
})();
