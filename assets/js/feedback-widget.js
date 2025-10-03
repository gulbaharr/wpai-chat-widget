/**
 * WPAI Chat Feedback Widget
 * Provides user feedback collection after chat sessions
 */

(function() {
    'use strict';

    // Feedback Widget Class
    class FeedbackWidget {
        constructor(options = {}) {
            this.sessionId = options.sessionId || '';
            this.apiUrl = options.apiUrl || '/wp-json/wpai/v1/feedback';
            this.nonce = options.nonce || '';
            this.onComplete = options.onComplete || function() {};

            this.rating = 0;
            this.feedback = '';
            this.container = null;
        }

        /**
         * Initialize the feedback widget
         */
        init() {
            this.createWidget();
            this.attachEventListeners();
        }

        /**
         * Create the feedback widget HTML
         */
        createWidget() {
            const widgetHTML = `
                <div class="wpai-feedback-widget" id="wpai-feedback-widget">
                    <div class="wpai-feedback-title">
                        Bu sohbet nasıl geçti?
                    </div>

                    <div class="wpai-feedback-rating">
                        ${this.createStarRating()}
                    </div>

                    <textarea
                        class="wpai-feedback-textarea"
                        placeholder="İsterseniz görüşlerinizi bizimle paylaşın..."
                        maxlength="500"
                    ></textarea>

                    <div class="wpai-feedback-buttons">
                        <button class="wpai-feedback-skip" type="button">
                            Geç
                        </button>
                        <button class="wpai-feedback-submit" type="button" disabled>
                            Gönder
                        </button>
                    </div>
                </div>
            `;

            // Create container element
            this.container = document.createElement('div');
            this.container.innerHTML = widgetHTML;
            this.container.style.display = 'none';

            // Append to body
            document.body.appendChild(this.container);
        }

        /**
         * Create star rating HTML
         */
        createStarRating() {
            let starsHTML = '';
            for (let i = 1; i <= 5; i++) {
                starsHTML += `<span class="wpai-feedback-star" data-rating="${i}">★</span>`;
            }
            return starsHTML;
        }

        /**
         * Attach event listeners
         */
        attachEventListeners() {
            const widget = this.container.querySelector('#wpai-feedback-widget');

            // Star rating events
            const stars = widget.querySelectorAll('.wpai-feedback-star');
            stars.forEach(star => {
                star.addEventListener('click', (e) => {
                    this.handleStarClick(e);
                });
                star.addEventListener('mouseover', (e) => {
                    this.handleStarHover(e);
                });
            });

            widget.addEventListener('mouseleave', () => {
                this.updateStarDisplay();
            });

            // Textarea events
            const textarea = widget.querySelector('.wpai-feedback-textarea');
            textarea.addEventListener('input', (e) => {
                this.feedback = e.target.value;
                this.updateSubmitButton();
            });

            // Button events
            const submitBtn = widget.querySelector('.wpai-feedback-submit');
            const skipBtn = widget.querySelector('.wpai-feedback-skip');

            submitBtn.addEventListener('click', () => {
                this.submitFeedback();
            });

            skipBtn.addEventListener('click', () => {
                this.skipFeedback();
            });
        }

        /**
         * Handle star click
         */
        handleStarClick(e) {
            const rating = parseInt(e.target.dataset.rating);
            this.rating = rating;
            this.updateStarDisplay();
            this.updateSubmitButton();
        }

        /**
         * Handle star hover
         */
        handleStarHover(e) {
            const rating = parseInt(e.target.dataset.rating);
            this.updateStarDisplay(rating);
        }

        /**
         * Update star display
         */
        updateStarDisplay(hoverRating = null) {
            const stars = this.container.querySelectorAll('.wpai-feedback-star');
            const displayRating = hoverRating !== null ? hoverRating : this.rating;

            stars.forEach((star, index) => {
                if (index < displayRating) {
                    star.classList.add('active');
                } else {
                    star.classList.remove('active');
                }
            });
        }

        /**
         * Update submit button state
         */
        updateSubmitButton() {
            const submitBtn = this.container.querySelector('.wpai-feedback-submit');
            const hasRating = this.rating > 0;
            const hasFeedback = this.feedback.trim().length > 0;

            submitBtn.disabled = !hasRating;
            submitBtn.textContent = hasFeedback ? 'Gönder' : 'Değerlendir';
        }

        /**
         * Show the feedback widget
         */
        show() {
            if (this.container) {
                this.container.style.display = 'block';
                // Animate in
                this.container.style.opacity = '0';
                this.container.style.transform = 'translateY(20px)';

                requestAnimationFrame(() => {
                    this.container.style.transition = 'all 0.3s ease';
                    this.container.style.opacity = '1';
                    this.container.style.transform = 'translateY(0)';
                });
            }
        }

        /**
         * Hide the feedback widget
         */
        hide() {
            if (this.container) {
                this.container.style.opacity = '0';
                this.container.style.transform = 'translateY(20px)';

                setTimeout(() => {
                    this.container.style.display = 'none';
                    this.onComplete();
                }, 300);
            }
        }

        /**
         * Submit feedback
         */
        async submitFeedback() {
            if (this.rating === 0) {
                return;
            }

            const submitBtn = this.container.querySelector('.wpai-feedback-submit');
            const originalText = submitBtn.textContent;

            // Disable button and show loading
            submitBtn.disabled = true;
            submitBtn.textContent = 'Gönderiliyor...';

            try {
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': this.nonce
                    },
                    body: JSON.stringify({
                        session_id: this.sessionId,
                        rating: this.rating,
                        feedback: this.feedback.trim(),
                        timestamp: new Date().toISOString()
                    })
                });

                if (response.ok) {
                    submitBtn.textContent = 'Gönderildi! ✓';
                    setTimeout(() => {
                        this.hide();
                    }, 1000);
                } else {
                    throw new Error('Feedback submission failed');
                }
            } catch (error) {
                console.error('Feedback submission error:', error);
                submitBtn.textContent = 'Hata oluştu';
                submitBtn.disabled = false;

                setTimeout(() => {
                    submitBtn.textContent = originalText;
                }, 2000);
            }
        }

        /**
         * Skip feedback
         */
        skipFeedback() {
            this.hide();
        }

        /**
         * Destroy the widget
         */
        destroy() {
            if (this.container && this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
            }
        }
    }

    // Auto-initialize if session data is available
    document.addEventListener('DOMContentLoaded', function() {
        // Listen for chat session end events
        window.addEventListener('wpaiChatSessionEnd', function(e) {
            const sessionData = e.detail || {};

            // Only show feedback for sessions longer than 30 seconds
            if (sessionData.duration > 30) {
                const feedbackWidget = new FeedbackWidget({
                    sessionId: sessionData.sessionId,
                    apiUrl: window.wpaiChatSettings?.apiUrl + '/feedback',
                    nonce: window.wpaiChatSettings?.nonce,
                    onComplete: function() {
                        // Optional: Track feedback completion
                        if (window.gtag) {
                            window.gtag('event', 'chat_feedback_completed', {
                                event_category: 'engagement',
                                event_label: 'chat_feedback'
                            });
                        }
                    }
                });

                feedbackWidget.init();
                feedbackWidget.show();
            }
        });
    });

    // Export for manual usage
    window.WPAIFeedbackWidget = FeedbackWidget;

})();

