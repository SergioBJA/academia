/**
 * GOOGLE AUTH CENTRAL v3 - Robustness & Debugging Edition
 * Centralized manager for Google Identity Services (GIS) across all academy portal modules.
 */

window.GoogleAuthCentral = {
    clientId: '862884316906-q5gs2ta79bg7v16vdnduddtsc0iirqqg.apps.googleusercontent.com',
    scope: 'https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    tokenClient: null,
    _onTokenReceived: null,
    _alpineComponent: null,
    _silentRefreshInProgress: false,

    /**
     * Initialize the Google Token Client
     * @param {Function} onTokenReceived - Callback when a new valid token is obtained/confirmed
     */
    init(onTokenReceived) {
        if (!window.google) {
            console.error("[GoogleAuthCentral] Google GIS library not loaded. Check script include.");
            return;
        }

        console.log("[GoogleAuthCentral] Initializing GIS client...");
        this._onTokenReceived = onTokenReceived;

        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.clientId,
            scope: this.scope,
            callback: (response) => {
                console.log("[GoogleAuthCentral] GIS Callback received:", response);
                
                if (response.error) {
                    console.warn("[GoogleAuthCentral] GIS Error:", response.error);
                    if (response.error !== 'user_cancel') {
                        this._updateState(false);
                    }
                    return;
                }

                if (response.access_token) {
                    console.log("[GoogleAuthCentral] Success: Access token received.");
                    const expiresAt = Date.now() + ((response.expires_in || 3600) * 1000);
                    localStorage.setItem('google_access_token', response.access_token);
                    localStorage.setItem('google_token_expires_at', String(expiresAt));
                    
                    this._updateState(true, response.access_token);
                }
            },
        });

        // Try silent refresh on init (if user previously connected)
        const existingToken = localStorage.getItem('google_access_token');
        if (existingToken) {
            console.log("[GoogleAuthCentral] Found existing token in localStorage. Validating...");
            this._trySilentRefreshOrValidate(existingToken);
        } else {
            console.log("[GoogleAuthCentral] No existing token found.");
        }
    },

    /**
     * Internal helper to update state across Alpine and Vanilla JS
     */
    _updateState(isConnected, token = null) {
        console.log("[GoogleAuthCentral] Updating global state. Connected:", isConnected);
        
        if (this._alpineComponent) {
            this._alpineComponent.isGoogleConnected = isConnected;
        }

        if (isConnected && token && this._onTokenReceived) {
            this._onTokenReceived(token);
        }

        // Global notification
        window.dispatchEvent(new Event('google-auth-changed'));
    },

    async _trySilentRefreshOrValidate(token) {
        if (this._silentRefreshInProgress) return;
        this._silentRefreshInProgress = true;

        const expiresAt = parseInt(localStorage.getItem('google_token_expires_at') || '0', 10);
        const isExpired = Date.now() > expiresAt - 60000; 

        let isValid = false;
        if (!isExpired) {
            isValid = await this.validateToken(token);
        }

        if (isValid) {
            console.log("[GoogleAuthCentral] Token is still valid.");
            this._updateState(true, token);
        } else {
            console.log("[GoogleAuthCentral] Token invalid/expired. Attempting background reconnect (silent refresh)...");
            this._silentRefresh();
        }

        this._silentRefreshInProgress = false;
    },

    _silentRefresh() {
        if (!this.tokenClient) return;
        try {
            this.tokenClient.requestAccessToken({ prompt: '' });
        } catch (e) {
            console.warn("[GoogleAuthCentral] Silent refresh failed exception:", e);
            this._updateState(false);
        }
    },

    connect() {
        if (!this.tokenClient) {
            console.error("[GoogleAuthCentral] Client not initialized. Calling init()...");
            this.init();
            return;
        }
        console.log("[GoogleAuthCentral] Launching Google Account Picker...");
        this.tokenClient.requestAccessToken({ prompt: 'select_account' });
    },

    logout() {
        console.log("[GoogleAuthCentral] Logging out...");
        const token = localStorage.getItem('google_access_token');
        if (token && window.google) {
            google.accounts.oauth2.revoke(token, () => console.log("[GoogleAuthCentral] Token revoked."));
        }
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_token_expires_at');
        localStorage.removeItem('google_user_email');
        this._updateState(false);
    },

    async validateToken(token) {
        if (!token) return false;
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.email) {
                    console.log("[GoogleAuthCentral] User info retrieved:", data.email);
                    localStorage.setItem('google_user_email', data.email);
                }
            }
            return res.ok;
        } catch (e) {
            console.error("[GoogleAuthCentral] Validation fetch error:", e);
            return false;
        }
    },

    setupAlpineSync(alpineComponent) {
        console.log("[GoogleAuthCentral] Setting up Alpine sync...");
        this._alpineComponent = alpineComponent;

        const sync = async () => {
            const token = localStorage.getItem('google_access_token');
            const email = localStorage.getItem('google_user_email');
            
            if (email && 'googleUserEmail' in alpineComponent) {
                alpineComponent.googleUserEmail = email;
            }

            if (token) {
                if (!alpineComponent.isGoogleConnected) {
                    console.log("[GoogleAuthCentral] Sync: Token found but UI disconnected. Validating...");
                    const isValid = await this.validateToken(token);
                    if (isValid) {
                        alpineComponent.isGoogleConnected = true;
                    } else {
                        this._silentRefresh();
                    }
                }
            } else {
                alpineComponent.isGoogleConnected = false;
                if ('googleUserEmail' in alpineComponent) alpineComponent.googleUserEmail = '';
            }
        };

        window.addEventListener('google-auth-changed', sync);
        window.addEventListener('storage', (e) => {
            if (e.key === 'google_access_token') {
                console.log("[GoogleAuthCentral] Sync from other tab detected.");
                sync();
            }
        });

        sync();
        setInterval(sync, 5 * 60 * 1000); // 5 min heartbeat
    }
};
