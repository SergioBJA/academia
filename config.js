// config.js
window.ACADEMY_CONFIG = {
    API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
             ? 'http://localhost:8000/api' 
             : 'https://TU-URL-DE-VERCEL.vercel.app/api'
};
