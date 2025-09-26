(function (wp) {
    if (!wp || !wp.apiFetch) {
        return;
    }

    var PANEL_TRANSITION_MS = 200;

    function bootstrap() {
        var config = window.wpaiChatConfig || {};
        var settings = config.settings || {};
        var general = settings.general || {};

        if (!general.enabled) {
            return;
        }

        ensureStylesheet(config.styleUrl);

        var root = document.getElementById('wpai-chat-widget-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'wpai-chat-widget-root';
            document.body.appendChild(root);
        }
        root.className = 'wpai-chat-widget-root';
        root.innerHTML = '';

        var apiFetch = wp.apiFetch;
        apiFetch.use(apiFetch.createNonceMiddleware(config.nonce));

        var normalized = normalizeSettings(settings);
        var state = {
            isOpen: false,
            isSending: false,
            sessionId: null,
            consentGiven: !normalized.compliance.require_consent,
            status: '',
            error: null,
            uiMessages: [],
            messages: [],
            greetingShown: false,
            hasUnread: false,
        };

        var closeTimer = null;

        applyAppearance(root, normalized.appearance);
        root.classList.add('wpai-chat--ready');

        var ui = renderUI(root, normalized);
        bindEvents();
        updateControls();
        updateStatus();
        renderMessages();

        function bindEvents() {
            ui.button.addEventListener('click', function () {
                toggleWidget(!state.isOpen);
            });

            ui.closeButton.addEventListener('click', function () {
                toggleWidget(false);
            });

            ui.form.addEventListener('submit', function (event) {
                event.preventDefault();
                sendMessage();
            });

            ui.input.addEventListener('input', function () {
                autoResizeTextarea(ui.input);
            });

            // Consent is always given since we removed the checkbox
            state.consentGiven = true;

            document.addEventListener('click', handleDocumentClick, true);
            window.addEventListener('keydown', handleKeyDown);
        }

        function handleDocumentClick(event) {
            if (!state.isOpen) {
                return;
            }

            if (root.contains(event.target)) {
                return;
            }

            toggleWidget(false);
        }

        function handleKeyDown(event) {
            if (!state.isOpen) {
                return;
            }

            if (event.key === 'Escape') {
                toggleWidget(false);
            }
        }

        function toggleWidget(shouldOpen) {
            if (shouldOpen === state.isOpen) {
                return;
            }

            state.isOpen = shouldOpen;

            if (closeTimer) {
                clearTimeout(closeTimer);
                closeTimer = null;
            }

            if (shouldOpen) {
                root.classList.add('wpai-chat--open');
                root.classList.remove('wpai-chat--unread');
                ui.panel.setAttribute('aria-hidden', 'false');
                ui.panel.tabIndex = 0;
                ui.button.setAttribute('aria-expanded', 'true');

                state.hasUnread = false;
                if (ui.badge) {
                    ui.badge.hidden = true;
                }

                if (normalized.persona.greeting_message && !state.greetingShown) {
                    pushMessage({ role: 'assistant', content: normalized.persona.greeting_message }, { localOnly: true });
                    state.greetingShown = true;
                }

                requestAnimationFrame(function () {
                    ui.panel.focus({ preventScroll: true });
                });
            } else {
                root.classList.remove('wpai-chat--open');
                ui.panel.setAttribute('aria-hidden', 'true');
                ui.panel.tabIndex = -1;
                ui.button.setAttribute('aria-expanded', 'false');

                closeTimer = setTimeout(function () {
                    closeTimer = null;
                    ui.panel.scrollTop = 0;
                }, PANEL_TRANSITION_MS);
            }
        }

        function ensureSession() {
            if (state.sessionId) {
                return Promise.resolve(state.sessionId);
            }

            state.status = 'Baglanti kuruluyor...';
            updateStatus();

            return request('session', {
                method: 'POST',
                data: {
                    consent: !!state.consentGiven,
                },
            }).then(function (response) {
                var sessionId = response && response.session_id ? response.session_id : null;
                if (!sessionId) {
                    throw new Error('Oturum olusturulamadi.');
                }

                state.sessionId = sessionId;
                return sessionId;
            });
        }

        function sendMessage() {
            var text = (ui.input.value || '').trim();
            if (!text || state.isSending) {
                return;
            }

            if (!state.consentGiven && normalized.compliance.require_consent) {
                state.error = 'Sohbeti baslatmak icin onay vermelisiniz.';
                updateStatus();
                return;
            }

            state.isSending = true;
            state.error = null;
            state.status = 'Yanit hazirlaniyor...';
            updateControls();
            updateStatus();

            var userMessage = { role: 'user', content: text };
            pushMessage(userMessage);
            ui.input.value = '';
            autoResizeTextarea(ui.input);

            ensureSession()
                .then(function () {
                    return request('chat', {
                        method: 'POST',
                        data: {
                            session_id: state.sessionId,
                            messages: state.messages,
                            provider: config.provider || '',
                        },
                    });
                })
                .then(function (response) {
                    state.status = '';
                    if (response && response.assistant_message) {
                        var assistant = response.assistant_message;
                        var content = typeof assistant.content === 'string'
                            ? assistant.content
                            : JSON.stringify(assistant.content || '');
                        pushMessage({
                            role: assistant.role || 'assistant',
                            content: content,
                        });
                    }
                })
                .catch(function (error) {
                    var message = (error && error.message) ? error.message : 'Mesaj gonderilemedi.';
                    state.error = message;
                })
                .finally(function () {
                    state.isSending = false;
                    if (!state.error) {
                        state.status = '';
                    }
                    updateControls();
                    updateStatus();
                });
        }

        function pushMessage(message, options) {
            var normalizedMessage = {
                role: message.role || 'assistant',
                content: stringifyContent(message.content),
                localOnly: options && options.localOnly,
            };

            state.uiMessages.push(normalizedMessage);

            if (!normalizedMessage.localOnly) {
                state.messages.push({
                    role: normalizedMessage.role,
                    content: normalizedMessage.content,
                });
            }

            if (!state.isOpen && normalizedMessage.role === 'assistant' && !normalizedMessage.localOnly) {
                markUnread();
            }

            renderMessages();
        }

        function markUnread() {
            if (state.hasUnread) {
                return;
            }

            state.hasUnread = true;
            root.classList.add('wpai-chat--unread');
            if (ui.badge) {
                ui.badge.hidden = false;
            }
        }

        function renderMessages() {
            ui.body.innerHTML = '';

            if (!state.uiMessages.length) {
                ui.body.appendChild(renderEmptyState());
                return;
            }

            state.uiMessages.forEach(function (message) {
                var row = document.createElement('div');
                row.className = 'wpai-chat-message ' + (message.role === 'assistant'
                    ? 'wpai-chat-message--assistant'
                    : 'wpai-chat-message--user');

                var bubble = document.createElement('div');
                bubble.className = 'wpai-chat-bubble';
                bubble.innerHTML = formatMessageHtml(message.content);

                row.appendChild(bubble);
                ui.body.appendChild(row);
            });

            ui.body.scrollTop = ui.body.scrollHeight;
        }

        function renderEmptyState() {
            var wrapper = document.createElement('div');
            wrapper.className = 'wpai-chat-empty';
            wrapper.innerHTML = '\n                <svg viewBox="0 0 24 24" aria-hidden="true">\n                    <path d="M5.25 4A2.25 2.25 0 0 0 3 6.25v7.5A2.25 2.25 0 0 0 5.25 16h.88c.3 0 .58.12.79.33l2.76 2.76A1.25 1.25 0 0 0 11.83 18h6.92A2.25 2.25 0 0 0 21 15.75v-9.5A2.25 2.25 0 0 0 18.75 4h-13.5Z"></path>\n                </svg>\n                <h3>Hazirsak baslayalim</h3>\n                <p>Kisa bir merhaba yazin, sohbet buradan devam etsin.</p>\n            ';
            return wrapper;
        }

        function updateControls() {
            var canSend = state.consentGiven || !normalized.compliance.require_consent;
            ui.sendButton.disabled = state.isSending || !canSend;
            
            if (state.isSending) {
                ui.sendButton.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
                ui.sendButton.style.animation = 'spin 1s linear infinite';
            } else {
                ui.sendButton.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z"/></svg>';
                ui.sendButton.style.animation = '';
            }
        }

        function updateStatus() {
            // Status display removed for cleaner UI
            return;
        }

        function request(endpoint, options) {
            var opts = options || {};
            var endpoints = config.endpoints || {};
            var url = endpoints[endpoint] || '';
            var requestArgs = {
                method: opts.method || 'GET',
            };

            if (opts.data) {
                requestArgs.data = opts.data;
            }

            var restRoot = (config.restUrl || '').replace(/\/$/, '');
            if (url && restRoot && url.indexOf(restRoot) === 0) {
                var relative = url.substring(restRoot.length);
                if (relative.charAt(0) === '/') {
                    relative = relative.substring(1);
                }
                requestArgs.path = relative;
            } else {
                requestArgs.url = url;
            }

            if (requestArgs.path && requestArgs.path.indexOf('wpai/v1/') !== 0) {
                requestArgs.path = 'wpai/v1/' + requestArgs.path.replace(/^wpai\/v1\//, '');
            }

            return apiFetch(requestArgs);
        }

        function renderUI(container, settings) {
            var button = createButton(settings);
            var panel = createPanel(settings);
            container.appendChild(panel);
            container.appendChild(button);

            return {
                button: button,
                panel: panel,
                body: panel.querySelector('.wpai-chat-body'),
                form: panel.querySelector('.wpai-chat-form'),
                input: panel.querySelector('.wpai-chat-input'),
                sendButton: panel.querySelector('.wpai-chat-send'),
                status: null,
                consentCheckbox: null,
                closeButton: panel.querySelector('.wpai-chat-close'),
                badge: button.querySelector('.wpai-chat-button__badge'),
            };
        }

        function createButton(settings) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'wpai-chat-button';
            var label = (typeof settings.general.widget_name === 'string' && settings.general.widget_name.trim())
                ? settings.general.widget_name
                : 'WpAI Chat';
            button.setAttribute('aria-expanded', 'false');
            button.setAttribute('aria-controls', 'wpai-chat-panel');
            button.setAttribute('aria-label', label + ' sohbetini ac');

            button.innerHTML = '\n                <span class="wpai-chat-button__icon" aria-hidden="true">\n                    <svg viewBox="0 0 24 24">\n                        <path d="M4.5 3h15A1.5 1.5 0 0 1 21 4.5v9A1.5 1.5 0 0 1 19.5 15H13l-3.7 3.7a.75.75 0 0 1-1.3-.53V15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3Z"></path>\n                    </svg>\n                </span>\n                <span class="wpai-chat-button__badge" hidden></span>\n            ';

            return button;
        }

        function createPanel(settings) {
            var personaLabel = (typeof settings.persona.persona_label === 'string' && settings.persona.persona_label.trim())
                ? settings.persona.persona_label
                : 'WpAI Chat';
            var subtitleCopy = (typeof settings.persona.prompt_hint === 'string' && settings.persona.prompt_hint.trim())
                ? settings.persona.prompt_hint
                : 'Sorularinizi burada iletebilirsiniz.';

            var panel = document.createElement('section');
            panel.className = 'wpai-chat-panel';
            panel.id = 'wpai-chat-panel';
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-hidden', 'true');
            panel.setAttribute('aria-label', personaLabel + ' sohbet penceresi');
            panel.tabIndex = -1;

            var header = document.createElement('header');
            header.className = 'wpai-chat-header';

            var headerText = document.createElement('div');
            headerText.className = 'wpai-chat-header__text';

            var title = document.createElement('h2');
            title.className = 'wpai-chat-header__title';
            title.textContent = personaLabel;

            var subtitle = document.createElement('p');
            subtitle.className = 'wpai-chat-header__subtitle';
            subtitle.textContent = subtitleCopy;

            var online = document.createElement('span');
            online.className = 'wpai-chat-header__status';
            online.textContent = 'Cevrimici';

            headerText.appendChild(title);
            headerText.appendChild(subtitle);
            headerText.appendChild(online);

            var closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.className = 'wpai-chat-close';
            closeButton.setAttribute('aria-label', 'Sohbet penceresini kapat');
            closeButton.innerHTML = '&times;';

            header.appendChild(headerText);
            header.appendChild(closeButton);
            panel.appendChild(header);

            var body = document.createElement('div');
            body.className = 'wpai-chat-body';
            panel.appendChild(body);

            var footer = document.createElement('footer');
            footer.className = 'wpai-chat-footer';

            var form = document.createElement('form');
            form.className = 'wpai-chat-form';

            var input = document.createElement('textarea');
            input.className = 'wpai-chat-input';
            input.rows = 2;
            input.placeholder = (typeof settings.persona.input_placeholder === 'string' && settings.persona.input_placeholder.trim())
                ? settings.persona.input_placeholder
                : 'Mesajinizi yazin...';

            var sendButton = document.createElement('button');
            sendButton.type = 'submit';
            sendButton.className = 'wpai-chat-send';
            sendButton.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z"/></svg>';
            sendButton.setAttribute('aria-label', 'Mesaj gönder');

            form.appendChild(input);
            form.appendChild(sendButton);
            footer.appendChild(form);

            panel.appendChild(footer);
            return panel;
        }

        function ensureStylesheet(url) {
            if (!url) {
                return;
            }

            var head = document.head || document.getElementsByTagName('head')[0];
            if (!head) {
                return;
            }

            if (document.querySelector('link[data-wpai-widget-style="1"]')) {
                return;
            }

            var baseUrl = url.split('?')[0];
            if (document.querySelector('link[href*="' + baseUrl + '"]')) {
                return;
            }

            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.dataset.wpaiWidgetStyle = '1';
            head.appendChild(link);
        }

        function normalizeSettings(raw) {
            var result = isObject(raw) ? Object.assign({}, raw) : {};
            result.general = isObject(raw.general) ? raw.general : {};
            result.persona = isObject(raw.persona) ? raw.persona : {};
            result.appearance = isObject(raw.appearance) ? raw.appearance : {};
            result.behavior = isObject(raw.behavior) ? raw.behavior : {};
            result.compliance = isObject(raw.compliance) ? raw.compliance : {};

            if (!isObject(result.appearance.colors)) {
                result.appearance.colors = {};
            }

            return result;
        }

        function applyAppearance(container, appearance) {
            var colors = appearance && appearance.colors ? appearance.colors : {};
            if (typeof colors.primary === 'string' && colors.primary) {
                container.style.setProperty('--wpai-primary', colors.primary);
            }
            if (typeof colors.secondary === 'string' && colors.secondary) {
                container.style.setProperty('--wpai-secondary', colors.secondary);
            }
        }

        function stringifyContent(content) {
            if (typeof content === 'string') {
                return content;
            }

            if (Array.isArray(content)) {
                return content.join(' ');
            }

            if (content && typeof content === 'object') {
                try {
                    return JSON.stringify(content);
                } catch (error) {
                    return '';
                }
            }

            return content ? String(content) : '';
        }

        function formatMessageHtml(content) {
            return stringifyContent(content).replace(/\n/g, '<br>');
        }

        function isObject(value) {
            return value && typeof value === 'object';
        }

        function autoResizeTextarea(textarea) {
            textarea.style.height = 'auto';
            var scrollHeight = textarea.scrollHeight;
            var maxHeight = 120;
            var minHeight = 24;
            
            var newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
            textarea.style.height = newHeight + 'px';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})(window.wp || {});
