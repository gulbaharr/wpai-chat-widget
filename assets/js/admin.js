(function (wp) {
    if (!wp || !wp.apiFetch) {
        return;
    }

    const apiFetch = wp.apiFetch;
    const providerOptions = [
        { value: 'openai', label: 'OpenAI' },
        { value: 'gemini', label: 'Google Gemini' },
        { value: 'groq', label: 'Groq' },
        { value: 'openrouter', label: 'OpenRouter' }
    ];
    const providerLabels = providerOptions.reduce(function (map, option) {
        map[option.value] = option.label;
        return map;
    }, {});
    const tabs = [
        { id: 'general', label: 'Genel' },
        { id: 'persona', label: 'Persona' },
        { id: 'appearance', label: 'Gorunum' },
        { id: 'provider', label: 'Saglayicilar' },
        { id: 'behavior', label: 'Davranis' },
        { id: 'compliance', label: 'Uyumluluk' },
        { id: 'logging', label: 'Kayit' }
    ];

    function bootstrap() {
        const container = document.getElementById('wpai-chat-admin-root');
        if (!container || !window.wpaiChatSettings) {
            return;
        }

        const config = window.wpaiChatSettings;
        let state = JSON.parse(JSON.stringify(config.settings || {}));
        let activeTab = 'general';
        let isSaving = false;
        let notice = null;
        const modelsCache = {};
        const modelsLoading = {};

        apiFetch.use(apiFetch.createNonceMiddleware(config.nonce));

        ensureStateShape();
        render();
        loadModels(state.provider.active, { silent: true });

        function ensureStateShape() {
            state.general = isObject(state.general) ? state.general : {};
            state.persona = isObject(state.persona) ? state.persona : {};
            state.appearance = isObject(state.appearance) ? state.appearance : {};
            state.behavior = isObject(state.behavior) ? state.behavior : {};
            state.compliance = isObject(state.compliance) ? state.compliance : {};
            state.logging = isObject(state.logging) ? state.logging : {};
            state.provider = isObject(state.provider) ? state.provider : {};
            state.provider.providers = isObject(state.provider.providers) ? state.provider.providers : {};

            state.general.enabled = !!state.general.enabled;
            if (typeof state.general.widget_name !== 'string') {
                state.general.widget_name = '';
            }

            if (typeof state.persona.persona_label !== 'string') {
                state.persona.persona_label = '';
            }
            if (typeof state.persona.system_prompt !== 'string') {
                state.persona.system_prompt = '';
            }
            if (typeof state.persona.greeting_message !== 'string') {
                state.persona.greeting_message = '';
            }

            if (!isObject(state.appearance.colors)) {
                state.appearance.colors = {};
            }
            ['primary', 'secondary', 'accent'].forEach(function (key) {
                if (typeof state.appearance.colors[key] !== 'string') {
                    state.appearance.colors[key] = '';
                }
            });
            if (typeof state.appearance.avatar_url !== 'string') {
                state.appearance.avatar_url = '';
            }
            if (typeof state.appearance.position !== 'string') {
                state.appearance.position = 'bottom-right';
            }
            if (typeof state.appearance.button_style !== 'string') {
                state.appearance.button_style = 'rounded';
            }

            state.behavior.max_tokens = typeof state.behavior.max_tokens === 'number' ? state.behavior.max_tokens : 1024;
            state.behavior.temperature = typeof state.behavior.temperature === 'number' ? state.behavior.temperature : 0.7;
            state.behavior.language = typeof state.behavior.language === 'string' ? state.behavior.language : 'auto';
            state.behavior.message_limit = typeof state.behavior.message_limit === 'number' ? state.behavior.message_limit : 20;
            state.behavior.session_timeout = typeof state.behavior.session_timeout === 'number' ? state.behavior.session_timeout : 900;

            state.compliance.require_consent = !!state.compliance.require_consent;
            if (typeof state.compliance.cookie_notice !== 'string') {
                state.compliance.cookie_notice = '';
            }
            if (typeof state.compliance.privacy_notice !== 'string') {
                state.compliance.privacy_notice = '';
            }

            state.logging.enabled = !!state.logging.enabled;
            state.logging.retention_days = typeof state.logging.retention_days === 'number' ? state.logging.retention_days : 30;

            providerOptions.forEach(function (option) {
                if (!isObject(state.provider.providers[option.value])) {
                    state.provider.providers[option.value] = {};
                }
            });

            if (typeof state.provider.active !== 'string' || !state.provider.providers[state.provider.active]) {
                state.provider.active = 'openai';
            }
        }
        function loadModels(provider, options) {
            const opts = options || {};
            if (!provider || modelsLoading[provider]) {
                return;
            }

            if (!config.modelsPath) {
                if (!opts.silent) {
                    notice = {
                        type: 'error',
                        message: 'Model listesi icin gerekli REST endpoint bilgisi bulunamadi.'
                    };
                    render({ preserveFocus: false });
                }
                return;
            }

            modelsLoading[provider] = true;
            if (!opts.silent) {
                render({ preserveFocus: true });
            }

            apiFetch({
                path: config.modelsPath + '?provider=' + encodeURIComponent(provider),
                method: 'GET'
            })
                .then(function (response) {
                    modelsCache[provider] = Array.isArray(response && response.models) ? response.models : [];
                })
                .catch(function (error) {
                    notice = {
                        type: 'error',
                        message: error && error.message ? error.message : 'Modeller alinirken hata olustu.'
                    };
                })
                .finally(function () {
                    modelsLoading[provider] = false;
                    render({ preserveFocus: true });
                });
        }

        function render(options) {
            const opts = options || {};
            ensureStateShape();

            let activeElementId = null;
            let selectionStart = null;
            let selectionEnd = null;

            if (opts.preserveFocus !== false && document.activeElement && container.contains(document.activeElement)) {
                activeElementId = document.activeElement.id;
                if (typeof document.activeElement.selectionStart === 'number') {
                    selectionStart = document.activeElement.selectionStart;
                    selectionEnd = document.activeElement.selectionEnd;
                }
            }

            container.innerHTML = '';

            const form = document.createElement('form');
            form.className = 'wpai-admin';
            form.addEventListener('submit', handleSubmit);

            form.appendChild(renderHeader());
            form.appendChild(renderTabs());
            form.appendChild(renderActiveTab());
            form.appendChild(renderFooter());

            container.appendChild(form);

            if (activeElementId) {
                const next = document.getElementById(activeElementId);
                if (next) {
                    next.focus();
                    if (selectionStart !== null && next.setSelectionRange) {
                        next.setSelectionRange(selectionStart, selectionEnd || selectionStart);
                    }
                }
            }
        }

        function renderHeader() {
            const header = document.createElement('div');
            header.className = 'wpai-admin__header';

            const intro = document.createElement('div');
            intro.className = 'wpai-admin__intro';

            const title = document.createElement('h2');
            title.textContent = 'WpAI Chat Kontrol Paneli';
            intro.appendChild(title);

            const description = document.createElement('p');
            description.textContent = 'Widget davranisini, saglayici baglantilarini ve kullanici deneyimini tek yerden yonetin.';
            intro.appendChild(description);

            header.appendChild(intro);

            const stats = document.createElement('div');
            stats.className = 'wpai-admin__stats';

            stats.appendChild(renderStat('Widget durumu', state.general.enabled ? 'Aktif' : 'Kapali', state.general.enabled ? 'is-positive' : 'is-negative'));

            const activeProvider = providerLabels[state.provider.active] || state.provider.active;
            stats.appendChild(renderStat('Aktif saglayici', activeProvider, ''));
            const providerModel = state.provider.providers[state.provider.active] && state.provider.providers[state.provider.active].model;
            stats.appendChild(renderStat('Secili model', providerModel || 'Belirtilmedi', providerModel ? '' : 'is-muted'));

            header.appendChild(stats);

            return header;
        }

        function renderStat(label, value, modifier) {
            const item = document.createElement('div');
            item.className = 'wpai-admin__stat' + (modifier ? ' ' + modifier : '');

            const labelEl = document.createElement('span');
            labelEl.className = 'wpai-admin__stat-label';
            labelEl.textContent = label;
            item.appendChild(labelEl);

            const valueEl = document.createElement('strong');
            valueEl.className = 'wpai-admin__stat-value';
            valueEl.textContent = value;
            item.appendChild(valueEl);

            return item;
        }

        function renderTabs() {
            const nav = document.createElement('div');
            nav.className = 'wpai-admin-tabs';

            tabs.forEach(function (tab) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'wpai-admin-tabs__item' + (tab.id === activeTab ? ' is-active' : '');
                button.textContent = tab.label;
                button.addEventListener('click', function () {
                    if (activeTab === tab.id) {
                        return;
                    }

                    activeTab = tab.id;
                    render({ preserveFocus: false });

                    if (tab.id === 'provider' && !modelsCache[state.provider.active]) {
                        loadModels(state.provider.active);
                    }
                });

                nav.appendChild(button);
            });

            return nav;
        }
        function renderActiveTab() {
            const card = document.createElement('section');
            card.className = 'wpai-card';

            switch (activeTab) {
                case 'general':
                    card.appendChild(renderSectionIntro('Genel Ayarlar', 'Widget adini ve durumunu ayarlayin.'));
                    card.appendChild(renderCheckboxField({
                        id: 'wpai-enabled',
                        label: 'Widget aktif',
                        checked: !!state.general.enabled,
                        onChange: function (checked) {
                            state.general.enabled = checked;
                        }
                    }));
                    card.appendChild(renderTextField({
                        id: 'wpai-widget-name',
                        label: 'Widget adi',
                        value: state.general.widget_name || '',
                        onChange: function (value) {
                            state.general.widget_name = value;
                        }
                    }));
                    break;
                case 'persona':
                    card.appendChild(renderSectionIntro('Persona & Iletisim', 'AI asistani nasil tanimlanacagini belirleyin.'));
                    card.appendChild(renderTextField({
                        id: 'wpai-persona-label',
                        label: 'Persona etiketi',
                        value: state.persona.persona_label || '',
                        onChange: function (value) {
                            state.persona.persona_label = value;
                        }
                    }));
                    card.appendChild(renderTextareaField({
                        id: 'wpai-system-prompt',
                        label: 'Sistem promptu',
                        rows: 6,
                        value: state.persona.system_prompt || '',
                        onChange: function (value) {
                            state.persona.system_prompt = value;
                        }
                    }));
                    card.appendChild(renderTextareaField({
                        id: 'wpai-greeting',
                        label: 'Karsilama mesaji',
                        rows: 3,
                        value: state.persona.greeting_message || '',
                        onChange: function (value) {
                            state.persona.greeting_message = value;
                        }
                    }));
                    break;
                case 'appearance':
                    card.appendChild(renderSectionIntro('Gorunum', 'Widgetin renklerini ve ikonunu ozellestirin.'));
                    card.appendChild(renderFieldGrid([
                        renderTextField({
                            id: 'wpai-color-primary',
                            label: 'Birincil renk',
                            type: 'color',
                            value: state.appearance.colors.primary || '#4C6FFF',
                            onChange: function (value) {
                                state.appearance.colors.primary = value;
                            }
                        }),
                        renderTextField({
                            id: 'wpai-color-secondary',
                            label: 'Ikincil renk',
                            type: 'color',
                            value: state.appearance.colors.secondary || '#1F2937',
                            onChange: function (value) {
                                state.appearance.colors.secondary = value;
                            }
                        }),
                        renderTextField({
                            id: 'wpai-color-accent',
                            label: 'Vurgu rengi',
                            type: 'color',
                            value: state.appearance.colors.accent || '#FACC15',
                            onChange: function (value) {
                                state.appearance.colors.accent = value;
                            }
                        })
                    ]));
                    card.appendChild(renderTextField({
                        id: 'wpai-avatar-url',
                        label: 'Avatar URL',
                        type: 'url',
                        value: state.appearance.avatar_url || '',
                        onChange: function (value) {
                            state.appearance.avatar_url = value.trim();
                        }
                    }));
                    card.appendChild(renderFieldGrid([
                        renderSelectField({
                            id: 'wpai-widget-position',
                            label: 'Pozisyon',
                            value: state.appearance.position || 'bottom-right',
                            options: [
                                { value: 'bottom-right', label: 'Sag alt' },
                                { value: 'bottom-left', label: 'Sol alt' }
                            ],
                            onChange: function (value) {
                                state.appearance.position = value;
                            }
                        }),
                        renderSelectField({
                            id: 'wpai-button-style',
                            label: 'Buton stili',
                            value: state.appearance.button_style || 'rounded',
                            options: [
                                { value: 'rounded', label: 'Yuvarlatilmis' },
                                { value: 'circle', label: 'Daire' },
                                { value: 'square', label: 'Kose' }
                            ],
                            onChange: function (value) {
                                state.appearance.button_style = value;
                            }
                        })
                    ]));
                    break;
                case 'provider':
                    card.appendChild(renderSectionIntro('Saglayici Baglantilari', 'API anahtarlarini ve modelleri yonetin.'));
                    card.appendChild(renderSelectField({
                        id: 'wpai-provider-active',
                        label: 'Saglayici',
                        value: state.provider.active,
                        options: providerOptions,
                        onChange: function (value) {
                            state.provider.active = value;
                            render({ preserveFocus: false });
                            loadModels(value);
                        }
                    }));
                    card.appendChild(renderProviderFields());
                    break;
                case 'behavior':
                    card.appendChild(renderSectionIntro('Davranis', 'AI cevaplarinin tonunu ve limitlerini belirleyin.'));
                    card.appendChild(renderFieldGrid([
                        renderNumberField({
                            id: 'wpai-max-tokens',
                            label: 'Max tokens',
                            min: 1,
                            value: typeof state.behavior.max_tokens === 'number' ? state.behavior.max_tokens : 1024,
                            onChange: function (value) {
                                state.behavior.max_tokens = value === '' ? 1024 : value;
                            }
                        }),
                        renderNumberField({
                            id: 'wpai-temperature',
                            label: 'Temperature (0-2)',
                            min: 0,
                            max: 2,
                            step: 0.1,
                            value: typeof state.behavior.temperature === 'number' ? state.behavior.temperature : 0.7,
                            onChange: function (value) {
                                state.behavior.temperature = value === '' ? 0.7 : value;
                            }
                        }),
                        renderNumberField({
                            id: 'wpai-message-limit',
                            label: 'Mesaj siniri',
                            min: 1,
                            value: typeof state.behavior.message_limit === 'number' ? state.behavior.message_limit : 20,
                            onChange: function (value) {
                                state.behavior.message_limit = value === '' ? 20 : value;
                            }
                        }),
                        renderNumberField({
                            id: 'wpai-session-timeout',
                            label: 'Oturum zaman asimi (sn)',
                            min: 60,
                            step: 30,
                            value: typeof state.behavior.session_timeout === 'number' ? state.behavior.session_timeout : 900,
                            onChange: function (value) {
                                state.behavior.session_timeout = value === '' ? 900 : value;
                            }
                        })
                    ]));
                    card.appendChild(renderSelectField({
                        id: 'wpai-language',
                        label: 'Dil',
                        value: state.behavior.language || 'auto',
                        options: [
                            { value: 'auto', label: 'Otomatik' },
                            { value: 'tr', label: 'Turkce' },
                            { value: 'en', label: 'Ingilizce' }
                        ],
                        onChange: function (value) {
                            state.behavior.language = value;
                        }
                    }));
                    break;
                case 'compliance':
                    card.appendChild(renderSectionIntro('Uyumluluk & Gizlilik', 'Kullanici onaylari ve bildirim metinlerini girin.'));
                    card.appendChild(renderCheckboxField({
                        id: 'wpai-consent-required',
                        label: 'Kullanicidan onay iste',
                        checked: !!state.compliance.require_consent,
                        onChange: function (checked) {
                            state.compliance.require_consent = checked;
                        }
                    }));
                    card.appendChild(renderTextareaField({
                        id: 'wpai-cookie-notice',
                        label: 'Onay metni',
                        rows: 4,
                        value: state.compliance.cookie_notice || '',
                        onChange: function (value) {
                            state.compliance.cookie_notice = value;
                        }
                    }));
                    card.appendChild(renderTextareaField({
                        id: 'wpai-privacy-notice',
                        label: 'Gizlilik metni',
                        rows: 4,
                        value: state.compliance.privacy_notice || '',
                        onChange: function (value) {
                            state.compliance.privacy_notice = value;
                        }
                    }));
                    break;
                case 'logging':
                    card.appendChild(renderSectionIntro('Kayit & Izleme', 'Destek ekibi icin sohbet kayitlarini tutun.'));
                    card.appendChild(renderCheckboxField({
                        id: 'wpai-logging-enabled',
                        label: 'Konusmalari kaydet',
                        checked: !!state.logging.enabled,
                        onChange: function (checked) {
                            state.logging.enabled = checked;
                        }
                    }));
                    card.appendChild(renderNumberField({
                        id: 'wpai-logging-retention',
                        label: 'Kayit saklama suresi (gun)',
                        min: 1,
                        value: typeof state.logging.retention_days === 'number' ? state.logging.retention_days : 30,
                        onChange: function (value) {
                            state.logging.retention_days = value === '' ? 30 : value;
                        }
                    }));
                    break;
            }

            return card;
        }

        function renderSectionIntro(title, description) {
            const header = document.createElement('div');
            header.className = 'wpai-card__header';

            const heading = document.createElement('h2');
            heading.textContent = title;
            header.appendChild(heading);

            if (description) {
                const paragraph = document.createElement('p');
                paragraph.textContent = description;
                header.appendChild(paragraph);
            }

            return header;
        }

        function renderFieldGrid(items) {
            const grid = document.createElement('div');
            grid.className = 'wpai-field-grid';
            items.forEach(function (item) {
                grid.appendChild(item);
            });
            return grid;
        }

        function renderProviderFields() {
            const wrapper = document.createElement('div');
            wrapper.className = 'wpai-provider-fields';

            const active = state.provider.active;
            const providerConfig = state.provider.providers[active] || {};
            const models = modelsCache[active] || [];
            const loading = !!modelsLoading[active];

            switch (active) {
                case 'openai':
                    wrapper.appendChild(renderSecretField('API Key', 'wpai-openai-key', providerConfig.api_key, function (value) {
                        state.provider.providers.openai.api_key = value.trim();
                    }));
                    wrapper.appendChild(renderModelPicker('openai', providerConfig, models));
                    wrapper.appendChild(renderTextField({
                        id: 'wpai-openai-base',
                        label: 'Base URL',
                        value: providerConfig.base_url || 'https://api.openai.com/v1',
                        onChange: function (value) {
                            state.provider.providers.openai.base_url = value.trim();
                        }
                    }));
                    wrapper.appendChild(renderTextField({
                        id: 'wpai-openai-org',
                        label: 'Organization ID (opsiyonel)',
                        value: providerConfig.organization || '',
                        onChange: function (value) {
                            state.provider.providers.openai.organization = value.trim();
                        }
                    }));
                    break;
                case 'gemini':
                    wrapper.appendChild(renderSecretField('API Key', 'wpai-gemini-key', providerConfig.api_key, function (value) {
                        state.provider.providers.gemini.api_key = value.trim();
                    }));
                    wrapper.appendChild(renderModelPicker('gemini', providerConfig, models));
                    wrapper.appendChild(renderTextField({
                        id: 'wpai-gemini-endpoint',
                        label: 'Endpoint',
                        value: providerConfig.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models',
                        onChange: function (value) {
                            state.provider.providers.gemini.endpoint = value.trim();
                        }
                    }));
                    break;
                case 'groq':
                    wrapper.appendChild(renderSecretField('API Key', 'wpai-groq-key', providerConfig.api_key, function (value) {
                        state.provider.providers.groq.api_key = value.trim();
                    }));
                    wrapper.appendChild(renderModelPicker('groq', providerConfig, models));
                    wrapper.appendChild(renderTextField({
                        id: 'wpai-groq-base',
                        label: 'Base URL',
                        value: providerConfig.base_url || 'https://api.groq.com/openai/v1',
                        onChange: function (value) {
                            state.provider.providers.groq.base_url = value.trim();
                        }
                    }));
                    break;
                case 'openrouter':
                    wrapper.appendChild(renderSecretField('API Key', 'wpai-openrouter-key', providerConfig.api_key, function (value) {
                        state.provider.providers.openrouter.api_key = value.trim();
                    }));
                    wrapper.appendChild(renderModelPicker('openrouter', providerConfig, models));
                    wrapper.appendChild(renderTextField({
                        id: 'wpai-openrouter-base',
                        label: 'Base URL',
                        value: providerConfig.base_url || 'https://openrouter.ai/api/v1',
                        onChange: function (value) {
                            state.provider.providers.openrouter.base_url = value.trim();
                        }
                    }));
                    wrapper.appendChild(renderTextField({
                        id: 'wpai-openrouter-fallback',
                        label: 'Fallback model (opsiyonel)',
                        value: providerConfig.fallback_model || '',
                        onChange: function (value) {
                            state.provider.providers.openrouter.fallback_model = value.trim();
                        }
                    }));
                    break;
            }

            const refreshRow = document.createElement('div');
            refreshRow.className = 'wpai-provider-actions';

            const refreshButton = document.createElement('button');
            refreshButton.type = 'button';
            refreshButton.className = 'button';
            refreshButton.textContent = loading ? 'Modeller yukleniyor...' : 'Modelleri yenile';
            refreshButton.disabled = loading || !config.modelsPath;
            refreshButton.addEventListener('click', function () {
                loadModels(active);
            });
            refreshRow.appendChild(refreshButton);
            wrapper.appendChild(refreshRow);

            if (loading) {
                const loadingHint = document.createElement('div');
                loadingHint.className = 'wpai-provider-loading';
                loadingHint.textContent = 'Modeller yukleniyor...';
                wrapper.appendChild(loadingHint);
            } else if (!loading && (!models || !models.length)) {
                const emptyHint = document.createElement('div');
                emptyHint.className = 'wpai-provider-loading';
                emptyHint.textContent = config.modelsPath ? 'Modeller bulunamadi, el ile model giriniz.' : 'Model listesi endpointi tanimlanamadi.';
                wrapper.appendChild(emptyHint);
            }

            return wrapper;
        }

        function renderModelPicker(providerSlug, providerConfig, models) {
            const wrapper = document.createElement('div');
            wrapper.className = 'wpai-field-group';

            if (Array.isArray(models) && models.length) {
                wrapper.appendChild(renderSelectField({
                    id: 'wpai-' + providerSlug + '-model-select',
                    label: 'Model sec (listeden)',
                    value: providerConfig.model || '',
                    options: models.map(function (item) {
                        return {
                            value: item.id,
                            label: item.name || item.id
                        };
                    }),
                    placeholder: 'Model sec',
                    onChange: function (value) {
                        state.provider.providers[providerSlug].model = value;
                    }
                }));
            }

            wrapper.appendChild(renderTextField({
                id: 'wpai-' + providerSlug + '-model',
                label: 'Model (manuel)',
                value: providerConfig.model || '',
                onChange: function (value) {
                    state.provider.providers[providerSlug].model = value.trim();
                }
            }));

            return wrapper;
        }
        function renderFooter() {
            const footer = document.createElement('div');
            footer.className = 'wpai-admin-footer';

            const actions = document.createElement('div');
            actions.className = 'wpai-admin-footer__actions';

            const saveButton = document.createElement('button');
            saveButton.type = 'submit';
            saveButton.className = 'button button-primary';
            saveButton.textContent = isSaving ? 'Kaydediliyor...' : 'Ayarlarini Kaydet';
            saveButton.disabled = isSaving;
            actions.appendChild(saveButton);

            const hint = document.createElement('span');
            hint.className = 'wpai-admin-footer__hint';
            hint.textContent = 'Degisikliklerin aktif olmasi icin kaydedin.';
            actions.appendChild(hint);

            footer.appendChild(actions);

            if (notice) {
                const noticeEl = document.createElement('div');
                noticeEl.className = 'wpai-notice wpai-notice--' + notice.type;
                noticeEl.textContent = notice.message;
                footer.appendChild(noticeEl);
            }

            return footer;
        }

        function handleSubmit(event) {
            if (event) {
                event.preventDefault();
            }

            if (isSaving) {
                return;
            }

            isSaving = true;
            notice = { type: 'info', message: 'Kaydediliyor...' };
            render({ preserveFocus: false });

            apiFetch({
                path: config.apiPath,
                method: 'POST',
                data: state
            })
                .then(function (response) {
                    state = JSON.parse(JSON.stringify(response || {}));
                    ensureStateShape();
                    notice = { type: 'success', message: 'Ayarlar basariyla kaydedildi.' };
                })
                .catch(function (error) {
                    notice = { type: 'error', message: error && error.message ? error.message : 'Beklenmeyen bir hata olustu.' };
                })
                .finally(function () {
                    isSaving = false;
                    render({ preserveFocus: false });
                });
        }

        function renderCheckboxField(opts) {
            const field = document.createElement('div');
            field.className = 'wpai-field';

            const label = document.createElement('label');
            label.className = 'wpai-toggle';
            label.htmlFor = opts.id;

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = opts.id;
            input.checked = !!opts.checked;
            input.addEventListener('change', function (event) {
                opts.onChange(event.target.checked);
            });

            const span = document.createElement('span');
            span.textContent = opts.label;

            label.appendChild(input);
            label.appendChild(span);
            field.appendChild(label);

            return field;
        }

        function renderTextField(opts) {
            const field = document.createElement('div');
            field.className = 'wpai-field';

            const label = document.createElement('label');
            label.htmlFor = opts.id;
            label.textContent = opts.label;

            const input = document.createElement('input');
            input.type = opts.type || 'text';
            input.id = opts.id;
            input.value = opts.value || '';
            input.autocomplete = opts.autocomplete || 'off';
            if (typeof opts.placeholder === 'string') {
                input.placeholder = opts.placeholder;
            }
            input.addEventListener('input', function (event) {
                opts.onChange(event.target.value);
            });

            field.appendChild(label);
            field.appendChild(input);

            return field;
        }

        function renderSecretField(label, id, value, onChange) {
            return renderTextField({
                id: id,
                label: label,
                type: 'password',
                autocomplete: 'new-password',
                value: value || '',
                onChange: onChange
            });
        }

        function renderNumberField(opts) {
            const field = document.createElement('div');
            field.className = 'wpai-field';

            const label = document.createElement('label');
            label.htmlFor = opts.id;
            label.textContent = opts.label;

            const input = document.createElement('input');
            input.type = 'number';
            input.id = opts.id;
            if (typeof opts.min !== 'undefined') {
                input.min = opts.min;
            }
            if (typeof opts.max !== 'undefined') {
                input.max = opts.max;
            }
            if (typeof opts.step !== 'undefined') {
                input.step = opts.step;
            }
            if (typeof opts.placeholder === 'string') {
                input.placeholder = opts.placeholder;
            }
            input.value = typeof opts.value === 'number' ? opts.value : '';
            input.addEventListener('input', function (event) {
                const result = event.target.value === '' ? '' : Number(event.target.value);
                opts.onChange(result);
            });

            field.appendChild(label);
            field.appendChild(input);

            return field;
        }

        function renderTextareaField(opts) {
            const field = document.createElement('div');
            field.className = 'wpai-field';

            const label = document.createElement('label');
            label.htmlFor = opts.id;
            label.textContent = opts.label;

            const textarea = document.createElement('textarea');
            textarea.id = opts.id;
            textarea.rows = opts.rows || 4;
            textarea.value = opts.value || '';
            if (typeof opts.placeholder === 'string') {
                textarea.placeholder = opts.placeholder;
            }
            textarea.addEventListener('input', function (event) {
                opts.onChange(event.target.value);
            });

            field.appendChild(label);
            field.appendChild(textarea);

            return field;
        }

        function renderSelectField(opts) {
            const field = document.createElement('div');
            field.className = 'wpai-field';

            const label = document.createElement('label');
            label.htmlFor = opts.id;
            label.textContent = opts.label;

            const select = document.createElement('select');
            select.id = opts.id;

            if (opts.placeholder) {
                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = opts.placeholder;
                placeholder.disabled = true;
                placeholder.selected = !opts.value;
                select.appendChild(placeholder);
            }

            opts.options.forEach(function (option) {
                const optionEl = document.createElement('option');
                optionEl.value = option.value;
                optionEl.textContent = option.label;
                if (option.value === opts.value) {
                    optionEl.selected = true;
                }
                select.appendChild(optionEl);
            });

            select.addEventListener('change', function (event) {
                opts.onChange(event.target.value);
            });

            field.appendChild(label);
            field.appendChild(select);
            return field;
        }

        function isObject(value) {
            return value && typeof value === 'object';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})(window.wp || {});




