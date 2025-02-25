// Cookie Consent Management System

// Configuration
const CONFIG = {
    // Cookie settings
    cookieExpireDays: 180,
    consentCookieName: "cookieConsent",
    
    // Cookie categories and their associated cookies
    cookieTypes: {
        necessary: {
            required: true,
            description: "Essential cookies that enable basic functionality of the website"
        },
        functional: {
            required: false,
            description: "Cookies that enhance website functionality and personalization",
            cookies: ["preference", "settings", "language"]
        },
        analytics: {
            required: false,
            description: "Cookies that help us understand how visitors interact with our website",
            cookies: ["_ga", "_gat", "_gid", "AMP_TOKEN", "_gac"]
        },
        marketing: {
            required: false,
            description: "Cookies used for targeted advertising based on your browsing habits",
            cookies: ["_fbp", "_gcl_au", "IDE", "test_cookie", "VISITOR_INFO1_LIVE", "YSC"]
        }
    }
};

// Cookie Utility Functions
const CookieManager = {
    setCookie: function(name, value, days) {
        try {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            const expires = "expires=" + date.toUTCString();
            document.cookie = name + "=" + value + ";" + expires + ";path=/;SameSite=Lax";
            return true;
        } catch (error) {
            console.error("Error setting cookie:", error);
            return false;
        }
    },
    
    getCookie: function(name) {
        try {
            const nameEQ = name + "=";
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                let cookie = cookies[i];
                while (cookie.charAt(0) === ' ') {
                    cookie = cookie.substring(1);
                }
                if (cookie.indexOf(nameEQ) === 0) {
                    return cookie.substring(nameEQ.length, cookie.length);
                }
            }
            return null;
        } catch (error) {
            console.error("Error getting cookie:", error);
            return null;
        }
    },
    
    deleteCookie: function(name) {
        try {
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax";
            
            // Also try with different paths to ensure deletion
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname + ";SameSite=Lax";
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=." + window.location.hostname + ";SameSite=Lax";
            return true;
        } catch (error) {
            console.error("Error deleting cookie:", error);
            return false;
        }
    },
    
    getAllCookies: function() {
        try {
            const pairs = document.cookie.split(";");
            const cookies = {};
            for (let i = 0; i < pairs.length; i++) {
                const pair = pairs[i].split("=");
                cookies[(pair[0] + '').trim()] = unescape(pair.slice(1).join('='));
            }
            return cookies;
        } catch (error) {
            console.error("Error getting all cookies:", error);
            return {};
        }
    }
};

// Consent Manager
const ConsentManager = {
    // Get all consent types from config
    get consentTypes() {
        return Object.keys(CONFIG.cookieTypes);
    },
    
    // Initialization
    init: function() {
        this.setupEventListeners();
        this.setupAccessibility();
        
        // Check if consent has been given before
        const consentStatus = CookieManager.getCookie(CONFIG.consentCookieName);
        
        // Show consent UI based on previous selections or lack thereof
        if (!consentStatus) {
            this.showAppropriateConsentUI();
            
            // Preemptively disable all non-necessary tracking
            this.disableAllTracking();
        } else {
            // Consent already given, show settings button
            this.showSettingsButton();
            
            // Apply stored preferences
            try {
                const preferences = JSON.parse(consentStatus);
                this.applyConsentPreferences(preferences);
            } catch (e) {
                console.error("Error parsing stored consent:", e);
                // If error, reset consent and show UI
                this.showAppropriateConsentUI();
                this.disableAllTracking();
            }
        }
    },
    
    setupEventListeners: function() {
        // Safely add event listeners with error handling
        const addEventSafely = (elementId, eventType, handler) => {
            try {
                const element = document.getElementById(elementId);
                if (element) {
                    element.addEventListener(eventType, handler);
                } else {
                    console.warn(`Element with id '${elementId}' not found for event binding`);
                }
            } catch (error) {
                console.error(`Error setting event listener for '${elementId}'`, error);
            }
        };
        
        // Main consent banner buttons
        addEventSafely("acceptAllCookies", "click", () => this.acceptAll());
        addEventSafely("rejectAllCookies", "click", () => this.rejectAll());
        addEventSafely("saveCookiePreferences", "click", () => this.savePreferences());
        addEventSafely("cookieClose", "click", () => this.closeBanner());
        
        // Simple banner buttons
        addEventSafely("simpleAcceptBtn", "click", () => this.acceptAll());
        addEventSafely("simpleRejectBtn", "click", () => this.rejectAll());
        addEventSafely("viewPreferencesLink", "click", (e) => {
            e.preventDefault();
            this.showDetailedBanner();
        });
        
        // Cookie settings button
        addEventSafely("openCookieSettings", "click", () => this.showDetailedBanner());
        
        // Policy links
        addEventSafely("cookiePolicyLink", "click", (e) => {
            e.preventDefault();
            this.showCookiePolicy();
        });
        
        addEventSafely("privacyPolicyLink", "click", (e) => {
            e.preventDefault();
            // Redirect to privacy policy page or show modal
            window.location.href = "privacy-policy.html";  // Update with your actual page
        });
        
        // Close modals
        document.querySelectorAll(".cookie-modal-close").forEach(button => {
            try {
                button.addEventListener("click", () => {
                    document.querySelectorAll(".cookie-modal").forEach(modal => {
                        modal.style.display = "none";
                    });
                });
            } catch (error) {
                console.error("Error setting close modal event", error);
            }
        });
        
        // Close modal when clicking outside
        try {
            window.addEventListener("click", (e) => {
                document.querySelectorAll(".cookie-modal").forEach(modal => {
                    if (e.target === modal) {
                        modal.style.display = "none";
                    }
                });
            });
        } catch (error) {
            console.error("Error setting window click event", error);
        }
        
        // Handle ESC key to close modals
        try {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    document.querySelectorAll(".cookie-modal").forEach(modal => {
                        if (modal.style.display === 'block') {
                            modal.style.display = "none";
                        }
                    });
                }
            });
        } catch (error) {
            console.error("Error setting keydown event", error);
        }
    },
    
    setupAccessibility: function() {
        try {
            // Add proper ARIA attributes to cookie banners
            const setARIA = (elementId, role, label) => {
                const element = document.getElementById(elementId);
                if (element) {
                    if (role) element.setAttribute('role', role);
                    if (label) element.setAttribute('aria-label', label);
                }
            };
            
            setARIA("cookieConsentBanner", "dialog", "Cookie Consent Options");
            setARIA("simpleCookieBanner", "dialog", "Cookie Consent");
            setARIA("cookiePolicyModal", "dialog", "Cookie Policy Information");
            
            // Make sure all inputs have proper labels and are keyboard accessible
            document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                const id = checkbox.id;
                const label = document.querySelector(`label[for="${id}"]`);
                
                if (!label) {
                    console.warn(`Checkbox ${id} is missing a label`);
                }
                
                checkbox.setAttribute('tabindex', '0');
                checkbox.setAttribute('aria-checked', checkbox.checked.toString());
                
                // Update aria-checked on change
                checkbox.addEventListener('change', function() {
                    this.setAttribute('aria-checked', this.checked.toString());
                });
            });
            
            // Make buttons keyboard accessible
            document.querySelectorAll('button').forEach(button => {
                if (!button.getAttribute('tabindex')) {
                    button.setAttribute('tabindex', '0');
                }
            });
            
        } catch (error) {
            console.error("Error setting up accessibility features:", error);
        }
    },
    
    showAppropriateConsentUI: function() {
        // Check if we're on a mobile device
        const isMobile = window.innerWidth < 768;
        
        if (isMobile) {
            this.showSimpleBanner();
        } else {
            this.showDetailedBanner();
        }
    },
    
    showSimpleBanner: function() {
        const simpleBanner = document.getElementById("simpleCookieBanner");
        const detailedBanner = document.getElementById("cookieConsentBanner");
        
        if (simpleBanner) simpleBanner.style.display = "block";
        if (detailedBanner) detailedBanner.style.display = "none";
    },
    
    showDetailedBanner: function() {
        const simpleBanner = document.getElementById("simpleCookieBanner");
        const detailedBanner = document.getElementById("cookieConsentBanner");
        
        if (simpleBanner) simpleBanner.style.display = "none";
        if (detailedBanner) detailedBanner.style.display = "block";
        
        // Set checkbox states based on existing preferences
        const consentStatus = CookieManager.getCookie(CONFIG.consentCookieName);
        if (consentStatus) {
            try {
                const preferences = JSON.parse(consentStatus);
                this.consentTypes.forEach(type => {
                    const checkbox = document.getElementById(type + "Cookies");
                    if (checkbox && !checkbox.disabled) {
                        checkbox.checked = preferences[type] === true;
                        checkbox.setAttribute('aria-checked', preferences[type].toString());
                    }
                });
            } catch (e) {
                console.error("Error parsing stored consent:", e);
            }
        } else {
            // If no consent stored, set necessary as checked and disabled
            this.consentTypes.forEach(type => {
                const checkbox = document.getElementById(type + "Cookies");
                if (checkbox) {
                    const isRequired = CONFIG.cookieTypes[type].required;
                    checkbox.checked = isRequired;
                    checkbox.disabled = isRequired;
                    checkbox.setAttribute('aria-checked', isRequired.toString());
                }
            });
        }
    },
    
    showSettingsButton: function() {
        const settingsButton = document.getElementById("openCookieSettings");
        if (settingsButton) {
            settingsButton.style.display = "block";
        }
    },
    
    showCookiePolicy: function() {
        const policyModal = document.getElementById("cookiePolicyModal");
        if (policyModal) {
            policyModal.style.display = "block";
            
            // For accessibility, set focus to the modal
            policyModal.setAttribute('tabindex', '-1');
            policyModal.focus();
        }
    },
    
    acceptAll: function() {
        // Create consent object with all types enabled
        const preferences = {};
        this.consentTypes.forEach(type => {
            preferences[type] = true;
        });
        
        // Save preferences
        this.saveConsentToCookie(preferences);
        this.applyConsentPreferences(preferences);
        this.hideBanners();
        
        // Log consent for compliance
        this.logConsent("accepted_all");
    },
    
    rejectAll: function() {
        // Create consent object with only necessary cookies
        const preferences = {};
        this.consentTypes.forEach(type => {
            // Only necessary cookies are enabled
            preferences[type] = CONFIG.cookieTypes[type].required;
        });
        
        // Save preferences
        this.saveConsentToCookie(preferences);
        this.applyConsentPreferences(preferences);
        this.hideBanners();
        
        // Log consent for compliance
        this.logConsent("rejected_all");
    },
    
    savePreferences: function() {
        // Get preferences from checkboxes
        const preferences = {};
        this.consentTypes.forEach(type => {
            const checkbox = document.getElementById(type + "Cookies");
            // If checkbox exists and is not disabled, use its value. Otherwise, use the required setting.
            preferences[type] = checkbox && !checkbox.disabled ? checkbox.checked : CONFIG.cookieTypes[type].required;
        });
        
        // Ensure necessary cookies are always enabled
        preferences.necessary = true;
        
        // Save preferences
        this.saveConsentToCookie(preferences);
        this.applyConsentPreferences(preferences);
        this.hideBanners();
        
        // Log consent for compliance
        this.logConsent("custom_preferences");
    },
    
    saveConsentToCookie: function(preferences) {
        // Save preferences for the configured number of days
        CookieManager.setCookie(CONFIG.consentCookieName, JSON.stringify(preferences), CONFIG.cookieExpireDays);
    },
    
    applyConsentPreferences: function(preferences) {
        // We'll use a deferred approach - disable everything first, then enable what's consented
        this.disableAllTracking();
        
        // Now enable what user has consented to
        for (const type in preferences) {
            if (preferences[type] && type !== 'necessary') {
                switch(type) {
                    case 'functional':
                        this.enableFunctional();
                        break;
                    case 'analytics':
                        this.enableAnalytics();
                        break;
                    case 'marketing':
                        this.enableMarketing();
                        break;
                }
            }
        }
    },
    
    disableAllTracking: function() {
        // Disable all non-necessary tracking
        this.disableFunctional();
        this.disableAnalytics();
        this.disableMarketing();
    },
    
    enableFunctional: function() {
        // Functional cookies are kept/enabled by not removing them
        console.log("Functional cookies enabled");
    },
    
    disableFunctional: function() {
        // Find and remove functional cookies
        if (CONFIG.cookieTypes.functional && CONFIG.cookieTypes.functional.cookies) {
            CONFIG.cookieTypes.functional.cookies.forEach(cookie => {
                CookieManager.deleteCookie(cookie);
            });
        }
    },
    
    enableAnalytics: function() {
        try {
            // Enable Firebase Analytics if available
            if (typeof firebase !== 'undefined' && firebase.analytics) {
                firebase.analytics().setAnalyticsCollectionEnabled(true);
            }
            
            // Enable Google Analytics if available
            if (typeof gtag === 'function') {
                window['ga-disable-GA_MEASUREMENT_ID'] = false;
            }
            
            // Initialize analytics scripts that might have been deferred
            this.loadDeferredScripts('analytics');
            
            console.log("Analytics enabled");
        } catch (error) {
            console.error("Error enabling analytics:", error);
        }
    },
    
    disableAnalytics: function() {
        try {
            // Disable Firebase Analytics if available
            if (typeof firebase !== 'undefined' && firebase.analytics) {
                firebase.analytics().setAnalyticsCollectionEnabled(false);
            }
            
            // Disable Google Analytics if available
            if (typeof gtag === 'function') {
                window['ga-disable-GA_MEASUREMENT_ID'] = true;
            }
            
            // Remove analytics cookies
            if (CONFIG.cookieTypes.analytics && CONFIG.cookieTypes.analytics.cookies) {
                CONFIG.cookieTypes.analytics.cookies.forEach(cookie => {
                    CookieManager.deleteCookie(cookie);
                });
            }
            
            console.log("Analytics disabled");
        } catch (error) {
            console.error("Error disabling analytics:", error);
        }
    },
    
    enableMarketing: function() {
        try {
            // Enable marketing cookies & scripts
            // Load deferred marketing scripts
            this.loadDeferredScripts('marketing');
            
            console.log("Marketing enabled");
            
            // Example for Facebook Pixel
            if (typeof fbq === 'function') {
                fbq('consent', 'grant');
            }
            
            // Example for Google Ads
            if (typeof gtag === 'function') {
                gtag('consent', 'update', {
                    'ad_storage': 'granted',
                    'analytics_storage': 'granted'
                });
            }
        } catch (error) {
            console.error("Error enabling marketing:", error);
        }
    },
    
    disableMarketing: function() {
        try {
            // Disable marketing cookies & scripts
            if (CONFIG.cookieTypes.marketing && CONFIG.cookieTypes.marketing.cookies) {
                CONFIG.cookieTypes.marketing.cookies.forEach(cookie => {
                    CookieManager.deleteCookie(cookie);
                });
            }
            
            // Example for Facebook Pixel
            if (typeof fbq === 'function') {
                fbq('consent', 'revoke');
            }
            
            // Example for Google Ads
            if (typeof gtag === 'function') {
                gtag('consent', 'update', {
                    'ad_storage': 'denied',
                    'analytics_storage': 'denied'
                });
            }
            
            console.log("Marketing disabled");
        } catch (error) {
            console.error("Error disabling marketing:", error);
        }
    },
    
    loadDeferredScripts: function(type) {
        try {
            // Find scripts with data-cookie-category attribute matching the given type
            document.querySelectorAll(`script[data-cookie-category="${type}"]`).forEach(script => {
                if (script.getAttribute('data-src')) {
                    // Create a new script element
                    const newScript = document.createElement('script');
                    
                    // Copy all attributes from the original script
                    Array.from(script.attributes).forEach(attr => {
                        if (attr.name !== 'data-src') {
                            newScript.setAttribute(attr.name, attr.value);
                        }
                    });
                    
                    // Set the src to the data-src value
                    newScript.src = script.getAttribute('data-src');
                    
                    // Replace the original script element
                    script.parentNode.replaceChild(newScript, script);
                }
            });
        } catch (error) {
            console.error(`Error loading deferred ${type} scripts:`, error);
        }
    },
    
    hideBanners: function() {
        try {
            const elements = [
                document.getElementById("cookieConsentBanner"),
                document.getElementById("simpleCookieBanner")
            ];
            
            elements.forEach(el => {
                if (el) el.style.display = "none";
            });
            
            this.showSettingsButton();
        } catch (error) {
            console.error("Error hiding banners:", error);
        }
    },
    
    closeBanner: function() {
        // Don't save any preferences, just close the banner
        // Per GDPR, closing without choice is not consent
        this.hideBanners();
    },
    
    logConsent: function(action) {
        try {
            // Collect data for compliance logging (IP address is not collected for GDPR compliance)
            const consentLog = {
                action: action,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                cookieEnabled: navigator.cookieEnabled,
                language: navigator.language,
                screenWidth: window.screen.width,
                screenHeight: window.screen.height
            };
            
            console.log("Consent logged:", consentLog);
            
            // Send to server if needed (commented out - implement as needed)
            /*
            fetch('/api/log-consent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(consentLog),
            })
            .then(response => response.json())
            .then(data => console.log('Consent logged to server'))
            .catch(error => console.error('Error logging consent to server:', error));
            */
            
            // If analytics is enabled, log the consent action
            const consentStatus = CookieManager.getCookie(CONFIG.consentCookieName);
            if (consentStatus) {
                try {
                    const preferences = JSON.parse(consentStatus);
                    
                    // Firebase Analytics
                    if (preferences.analytics && typeof firebase !== 'undefined' && firebase.analytics) {
                        firebase.analytics().logEvent("cookie_consent", {
                            action: action,
                            timestamp: new Date().toISOString()
                        });
                    }
                    
                    // Google Analytics
                    if (preferences.analytics && typeof gtag === 'function') {
                        gtag('event', 'cookie_consent', {
                            'event_category': 'consent',
                            'event_label': action,
                            'value': 1
                        });
                    }
                } catch (e) {
                    console.error("Error parsing consent for analytics:", e);
                }
            }
        } catch (error) {
            console.error("Error logging consent:", error);
        }
    }
};

// Helper for detecting when DOM is fully loaded
function domReady(callback) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(callback, 1);
    } else {
        document.addEventListener("DOMContentLoaded", callback);
    }
}

// Initialize Consent Manager when DOM is ready
domReady(function() {
    try {
        ConsentManager.init();
    } catch (error) {
        console.error("Error initializing Consent Manager:", error);
    }
});

// Handle responsive UI changes
window.addEventListener("resize", function() {
    try {
        // Only adjust UI if consent hasn't been given yet
        const consentStatus = CookieManager.getCookie(CONFIG.consentCookieName);
        if (!consentStatus) {
            const isMobile = window.innerWidth < 768;
            
            // Show appropriate banner based on screen size
            if (isMobile) {
                ConsentManager.showSimpleBanner();
            } else {
                ConsentManager.showDetailedBanner();
            }
        }
    } catch (error) {
        console.error("Error handling resize event:", error);
    }
});