(function (wp) {
    if (!wp || !wp.apiFetch) {
        return;
    }

    var apiFetch = wp.apiFetch;
    var config = window.wpaiChatConfig || {};
    var state = null;
    var ui = null;

    function bootstrap() {
        var root = document.getElementById('wpai-chat-widget-root');
        if (!root || !config.settings) {
            return;
        }

        ensureStylesheet(config.styleUrl);
        if (config.nonce) {
            apiFetch.use(apiFetch.createNonceMiddleware(config.nonce));
        }

        state = {
            settings: normalizeSettings(config.settings || {}),
            isOpen: false,
            isSending: false,
            sessionId: null,
            messages: [],
            status: '',
            error: '',
            unread: 0,
            initialized: false
        };

        applyAppearance(root, state.settings.appearance);

        ui = renderUI(root, state.settings);
        ui.root = root;

        bindEvents();
        autoResizeTextarea(ui.input);
        renderMessages();
        updateBadge();
        updateControls();
        updateStatus();

        var greeting = state.settings.persona && typeof state.settings.persona.greeting_message === 'string'
            ? state.settings.persona.greeting_message.trim()
            : '';
        if (greeting) {
            state.messages.push({ role: 'assistant', content: greeting });
            renderMessages();
        }

        state.initialized = true;
        root.classList.add('wpai-chat--ready');
    }

    function bindEvents() {
        if (!ui || !state) {
            return;
        }

        ui.button.addEventListener('click', function () {
            togglePanel();
        });

        ui.closeButton.addEventListener('click', function () {
            closePanel();
        });

        ui.form.addEventListener('submit', handleSubmit);

        ui.input.addEventListener('input', function () {
            autoResizeTextarea(ui.input);
        });

        ui.panel.addEventListener('keyup', function (event) {
            if (event.key === 'Escape') {
                closePanel();
            }
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && state.isOpen) {
                closePanel();
            }
        });
    }

    function handleSubmit(event) {
        if (event) {
            event.preventDefault();
        }

        if (!ui || !state || state.isSending) {
            return;
        }

        var value = ui.input.value.trim();
        if (!value) {
            return;
        }

        state.messages.push({ role: 'user', content: value });
        renderMessages();

        ui.input.value = '';
        autoResizeTextarea(ui.input);

        state.error = '';
        state.status = '';
        state.isSending = true;
        updateControls();
        updateStatus();

        ensureSession()
            .then(function () {
                return request('chat', {
                    method: 'POST',
                    data: {
                        session_id: state.sessionId,
                        provider: config.provider || '',
                        messages: state.messages
                    }
                });
            })
            .then(handleChatResponse)
            .catch(handleError)
            .finally(function () {
                state.isSending = false;
                updateControls();
                updateStatus();
            });
    }

    function togglePanel() {
        if (state.isOpen) {
            closePanel();
        } else {
            openPanel();
        }
    }

    function openPanel() {
        if (state.isOpen) {
            return;
        }

        state.isOpen = true;
        state.unread = 0;
        ui.root.classList.add('wpai-chat--open');
        ui.button.setAttribute('aria-expanded', 'true');
        ui.panel.setAttribute('aria-hidden', 'false');
        updateBadge();

        if (!state.sessionId) {
            ensureSession().catch(function (error) {
                handleError(error);
            });
        }

        setTimeout(function () {
            ui.panel.focus();
            ui.input.focus();
        }, 0);
    }

    function closePanel() {
        if (!state.isOpen) {
            return;
        }

        state.isOpen = false;
        ui.root.classList.remove('wpai-chat--open');
        ui.button.setAttribute('aria-expanded', 'false');
        ui.panel.setAttribute('aria-hidden', 'true');
        updateBadge();
        ui.button.focus();
    }

    function ensureSession() {
        if (state.sessionId) {
            return Promise.resolve(state.sessionId);
        }

        state.status = 'Baglanti kuruluyor...';
        updateStatus();

        return request('session', { method: 'POST' })
            .then(function (response) {
                if (response && response.session_id) {
                    state.sessionId = response.session_id;
                }

                state.status = '';
                return state.sessionId;
            })
            .catch(function (error) {
                handleError(error);
                throw error;
            });
    }

    function handleChatResponse(response) {
        if (!response) {
            return;
        }

        if (Array.isArray(response.messages)) {
            // Sadece user ve assistant mesajlarını göster, system mesajlarını filtrele
            state.messages = response.messages
                .filter(function (message) {
                    return message.role === 'user' || message.role === 'assistant';
                })
                .map(function (message) {
                    return {
                        role: message.role || 'assistant',
                        content: stringifyContent(message.content || '')
                    };
                });
        }

        if (response.assistant_message && response.assistant_message.content && !state.isOpen) {
            state.unread += 1;
        }

        state.sessionId = response.session_id || state.sessionId;
        state.status = '';
        state.error = '';

        renderMessages();
        updateBadge();
    }

    function handleError(error) {
        var message = 'Beklenmeyen bir hata olustu.';
        if (error && error.message) {
            message = error.message;
        } else if (typeof error === 'string') {
            message = error;
        }

        state.error = message;
        updateStatus();
    }

    function renderMessages() {
        if (!ui || !ui.body) {
            return;
        }

        ui.body.innerHTML = '';

        if (!state.messages.length) {
            ui.body.appendChild(renderEmptyState());
            return;
        }

        state.messages.forEach(function (message) {
            ui.body.appendChild(createMessageElement(message));
        });

        ui.body.scrollTop = ui.body.scrollHeight;
    }

    function createMessageElement(message) {
        var role = (message && message.role) ? message.role : 'assistant';
        var wrapper = document.createElement('div');
        wrapper.className = 'wpai-chat-message ' + (role === 'user' ? 'wpai-chat-message--user' : 'wpai-chat-message--assistant');

        var bubble = document.createElement('div');
        bubble.className = 'wpai-chat-bubble';
        bubble.innerHTML = formatMessageHtml(message && message.content ? message.content : '');

        wrapper.appendChild(bubble);
        return wrapper;
    }

    function updateBadge() {
        if (!ui || !ui.badge) {
            return;
        }

        if (state.unread > 0) {
            ui.badge.hidden = false;
            ui.badge.textContent = String(state.unread);
        } else {
            ui.badge.hidden = true;
            ui.badge.textContent = '';
        }
    }

    function updateControls() {
        if (!ui || !ui.sendButton) {
            return;
        }

        ui.sendButton.disabled = state.isSending;

        if (state.isSending) {
            ui.sendButton.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
            ui.sendButton.style.animation = 'spin 1s linear infinite';
        } else {
            ui.sendButton.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z"/></svg>';
            ui.sendButton.style.animation = '';
        }
    }

    function updateStatus() {
        if (!ui || !ui.status) {
            return;
        }

        var message = state.error || state.status || '';

        ui.status.classList.remove('is-error', 'is-info');

        if (!message) {
            ui.status.hidden = true;
            ui.status.textContent = '';
            ui.status.setAttribute('role', 'status');
            ui.status.setAttribute('aria-live', 'polite');
            return;
        }

        ui.status.hidden = false;
        ui.status.textContent = message;

        if (state.error) {
            ui.status.classList.add('is-error');
            ui.status.setAttribute('role', 'alert');
            ui.status.setAttribute('aria-live', 'assertive');
        } else {
            ui.status.classList.add('is-info');
            ui.status.setAttribute('role', 'status');
            ui.status.setAttribute('aria-live', 'polite');
        }
    }

    function request(endpoint, options) {
        var opts = options || {};
        var endpoints = config.endpoints || {};
        var url = endpoints[endpoint] || '';
        var requestArgs = {
            method: opts.method || 'GET'
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
        var panelResult = createPanel(settings);
        var panel = panelResult.element;
        container.appendChild(panel);
        container.appendChild(button);

        return {
            root: container,
            button: button,
            panel: panel,
            body: panel.querySelector('.wpai-chat-body'),
            form: panel.querySelector('.wpai-chat-form'),
            input: panel.querySelector('.wpai-chat-input'),
            sendButton: panel.querySelector('.wpai-chat-send'),
            status: panelResult.status,
            closeButton: panel.querySelector('.wpai-chat-close'),
            badge: button.querySelector('.wpai-chat-button__badge')
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

        var status = document.createElement('div');
        status.className = 'wpai-chat-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.hidden = true;
        footer.appendChild(status);

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
        sendButton.setAttribute('aria-label', 'Mesaj gonder');

        form.appendChild(input);
        form.appendChild(sendButton);
        footer.appendChild(form);

        panel.appendChild(footer);
        return {
            element: panel,
            status: status
        };
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

        if (!isObject(result.appearance.colors)) {
            result.appearance.colors = {};
        }
        if (typeof result.appearance.theme !== 'string' || !result.appearance.theme.trim()) {
            result.appearance.theme = 'classic';
        } else {
            result.appearance.theme = result.appearance.theme.trim();
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
        if (typeof colors.accent === 'string' && colors.accent) {
            container.style.setProperty('--wpai-accent', colors.accent);
        }

        var themePrefix = 'wpai-theme-';
        var themeSlug = (appearance && typeof appearance.theme === 'string' && appearance.theme) ? appearance.theme : 'classic';
        var classNames = Array.prototype.slice.call(container.classList || []);

        classNames.forEach(function (className) {
            if (className.indexOf(themePrefix) === 0) {
                container.classList.remove(className);
            }
        });

        container.classList.add(themePrefix + themeSlug);
        if (container.dataset) {
            container.dataset.wpaiTheme = themeSlug;
        }
    }

    function renderEmptyState() {
        var wrapper = document.createElement('div');
        wrapper.className = 'wpai-chat-empty';
        wrapper.innerHTML = '\n                <svg viewBox="0 0 24 24" aria-hidden="true">\n                    <path d="M5.25 4A2.25 2.25 0 0 0 3 6.25v7.5A2.25 2.25 0 0 0 5.25 16h.88c.3 0 .58.12.79.33l2.76 2.76A1.25 1.25 0 0 0 11.83 18h6.92A2.25 2.25 0 0 0 21 15.75v-9.5A2.25 2.25 0 0 0 18.75 4h-13.5Z"></path>\n                </svg>\n                <h3>Hazirsak baslayalim</h3>\n                <p>Kisa bir merhaba yazin, sohbet buradan devam etsin.</p>\n            ';
        return wrapper;
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})(window.wp || {});
