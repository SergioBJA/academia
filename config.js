// Configuration for the Academy Portal
window.ACADEMY_CONFIG = {
    // Change this to your production API URL (e.g. 'https://academia-api.onrender.com/api')
    API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
             ? 'http://localhost:8000/api' 
             : '/api' 
};
