/**
 * WPAI Chat Conversion Tracker
 * Tracks conversions and user actions after chat interactions
 */

(function() {
    'use strict';

    // Conversion Tracker Class
    class ConversionTracker {
        constructor(options = {}) {
            this.sessionId = options.sessionId || '';
            this.apiUrl = options.apiUrl || '/wp-json/wpai/v1/conversions';
            this.nonce = options.nonce || '';
            this.cookieExpiry = options.cookieExpiry || 30; // days
            this.trackWooCommerce = options.trackWooCommerce !== false;
            this.trackCustomEvents = options.trackCustomEvents || [];

            this.init();
        }

        /**
         * Initialize tracking
         */
        init() {
            this.setChatCookie();
            this.trackPageViews();
            this.trackWooCommerceEvents();
            this.trackCustomEvents.forEach(event => {
                this.trackCustomEvent(event);
            });
        }

        /**
         * Set chat session cookie for attribution
         */
        setChatCookie() {
            const cookieName = 'wpai_chat_session';
            const cookieValue = JSON.stringify({
                sessionId: this.sessionId,
                timestamp: Date.now(),
                source: window.location.href
            });

            this.setCookie(cookieName, cookieValue, this.cookieExpiry);
        }

        /**
         * Track page views with chat attribution
         */
        trackPageViews() {
            // Track current page view
            this.trackEvent('page_view', {
                url: window.location.href,
                title: document.title,
                referrer: document.referrer
            });

            // Track future page views
            let currentUrl = window.location.href;
            const trackNavigation = () => {
                if (currentUrl !== window.location.href) {
                    currentUrl = window.location.href;
                    this.trackEvent('page_view', {
                        url: window.location.href,
                        title: document.title,
                        referrer: document.referrer
                    });
                }
            };

            // Track navigation changes
            window.addEventListener('popstate', trackNavigation);

            // Track SPA navigation (if using frameworks like React/Vue)
            const originalPushState = history.pushState;
            history.pushState = function() {
                originalPushState.apply(this, arguments);
                setTimeout(trackNavigation, 100);
            };
        }

        /**
         * Track WooCommerce events
         */
        trackWooCommerceEvents() {
            if (!this.trackWooCommerce || typeof jQuery === 'undefined') {
                return;
            }

            // Track add to cart
            jQuery(document).on('added_to_cart', (event, fragments, cart_hash, button) => {
                this.trackConversion('add_to_cart', {
                    product_id: button.data('product_id'),
                    quantity: button.data('quantity') || 1,
                    price: button.data('price')
                });
            });

            // Track checkout started
            jQuery(document).on('checkout_started', () => {
                this.trackConversion('checkout_started');
            });

            // Track purchase completed
            jQuery(document).on('purchase_completed', (event, orderId, orderData) => {
                this.trackConversion('purchase', {
                    order_id: orderId,
                    total: orderData.total,
                    currency: orderData.currency,
                    items: orderData.items
                });
            });

            // Track view product
            jQuery(document).on('view_product', (event, productId) => {
                this.trackEvent('view_product', {
                    product_id: productId
                });
            });
        }

        /**
         * Track custom events
         */
        trackCustomEvent(eventConfig) {
            const { selector, event, eventType, data } = eventConfig;

            if (!selector || !event) {
                return;
            }

            document.addEventListener('DOMContentLoaded', () => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    element.addEventListener(event, () => {
                        this.trackConversion(eventType || event, data || {});
                    });
                });
            });
        }

        /**
         * Track general events
         */
        trackEvent(eventType, eventData = {}) {
            this.sendTrackingData({
                type: 'event',
                event_type: eventType,
                data: eventData,
                timestamp: new Date().toISOString(),
                url: window.location.href
            });
        }

        /**
         * Track conversions
         */
        trackConversion(conversionType, conversionData = {}) {
            const conversion = {
                type: 'conversion',
                conversion_type: conversionType,
                value: conversionData.value || 0,
                currency: conversionData.currency || 'TRY',
                data: conversionData,
                timestamp: new Date().toISOString(),
                url: window.location.href
            };

            // Update session analytics
            this.updateSessionAnalytics(conversion);

            // Send to server
            this.sendTrackingData(conversion);

            // Track in Google Analytics if available
            this.trackGoogleAnalytics(conversionType, conversionData);
        }

        /**
         * Send tracking data to server
         */
        async sendTrackingData(data) {
            try {
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': this.nonce
                    },
                    body: JSON.stringify({
                        session_id: this.sessionId,
                        ...data
                    })
                });

                if (!response.ok) {
                    console.warn('WPAI Conversion tracking failed:', response.status);
                }
            } catch (error) {
                console.warn('WPAI Conversion tracking error:', error);
            }
        }

        /**
         * Update session analytics
         */
        updateSessionAnalytics(conversion) {
            // Send custom event to update analytics
            window.dispatchEvent(new CustomEvent('wpaiConversionTracked', {
                detail: conversion
            }));
        }

        /**
         * Track in Google Analytics
         */
        trackGoogleAnalytics(eventType, eventData) {
            // Google Analytics 4
            if (window.gtag) {
                window.gtag('event', `wpai_${eventType}`, {
                    event_category: 'wpai_chat',
                    event_label: this.sessionId,
                    value: eventData.value || 0,
                    custom_map: {
                        dimension1: eventData.product_id || '',
                        dimension2: eventData.order_id || ''
                    }
                });
            }

            // Google Analytics Universal (legacy)
            if (window.ga) {
                window.ga('send', 'event', 'WPAI Chat', eventType, this.sessionId, eventData.value || 0);
            }

            // Facebook Pixel
            if (window.fbq) {
                window.fbq('trackCustom', `WPAI${eventType}`, {
                    session_id: this.sessionId,
                    value: eventData.value || 0
                });
            }
        }

        /**
         * Get chat attribution data from cookie
         */
        getChatAttribution() {
            const cookieName = 'wpai_chat_session';
            const cookieData = this.getCookie(cookieName);

            if (cookieData) {
                try {
                    return JSON.parse(cookieData);
                } catch (e) {
                    return null;
                }
            }

            return null;
        }

        /**
         * Check if current session should be attributed to chat
         */
        isAttributableToChat() {
            const attribution = this.getChatAttribution();
            if (!attribution) {
                return false;
            }

            // Check if attribution is within time window (default 30 days)
            const attributionTime = new Date(attribution.timestamp);
            const now = new Date();
            const daysDiff = (now - attributionTime) / (1000 * 60 * 60 * 24);

            return daysDiff <= this.cookieExpiry;
        }

        /**
         * Set cookie helper
         */
        setCookie(name, value, days) {
            const expires = new Date();
            expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
            document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
        }

        /**
         * Get cookie helper
         */
        getCookie(name) {
            const nameEQ = `${name}=`;
            const ca = document.cookie.split(';');

            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') {
                    c = c.substring(1, c.length);
                }
                if (c.indexOf(nameEQ) === 0) {
                    return decodeURIComponent(c.substring(nameEQ.length, c.length));
                }
            }
            return null;
        }

        /**
         * Clear chat attribution cookie
         */
        clearAttribution() {
            this.setCookie('wpai_chat_session', '', -1);
        }
    }

    // Auto-initialize with session data
    document.addEventListener('DOMContentLoaded', function() {
        // Listen for chat session start
        window.addEventListener('wpaiChatSessionStart', function(e) {
            const sessionData = e.detail || {};

            const tracker = new ConversionTracker({
                sessionId: sessionData.sessionId,
                apiUrl: window.wpaiChatSettings?.apiUrl + '/conversions',
                nonce: window.wpaiChatSettings?.nonce,
                trackWooCommerce: window.wpaiChatSettings?.trackWooCommerce !== false,
                trackCustomEvents: window.wpaiChatSettings?.customConversionEvents || []
            });

            // Store tracker instance for later use
            window.wpaiConversionTracker = tracker;
        });

        // Initialize with existing session if available
        if (window.wpaiChatSettings?.currentSession) {
            const tracker = new ConversionTracker({
                sessionId: window.wpaiChatSettings.currentSession,
                apiUrl: window.wpaiChatSettings.apiUrl + '/conversions',
                nonce: window.wpaiChatSettings.nonce,
                trackWooCommerce: window.wpaiChatSettings.trackWooCommerce !== false,
                trackCustomEvents: window.wpaiChatSettings.customConversionEvents || []
            });

            window.wpaiConversionTracker = tracker;
        }
    });

    // Export for manual usage
    window.WPAIConversionTracker = ConversionTracker;

})();

