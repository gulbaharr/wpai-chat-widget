<?php
/**
 * Manages persistent settings for the plugin.
 */

namespace Wpai\Chat;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class SettingsRepository {
    /**
     * Option key used to persist settings.
     */
    private const OPTION_KEY = 'wpai_chat_settings_v1';

    /**
     * Retrieve settings merged with defaults.
     */
    public function get_settings(): array {
        $stored = get_option( self::OPTION_KEY, [] );

        if ( ! is_array( $stored ) ) {
            $stored = [];
        }

        $defaults = $this->get_default_settings();
        $settings = wp_parse_args( $stored, $defaults );

        $settings['provider']['providers'] = $this->sanitize_provider_configs(
            $settings['provider']['providers'] ?? [],
            $defaults['provider']['providers']
        );

        $settings['provider']['active'] = $this->sanitize_provider_slug(
            $settings['provider']['active'] ?? 'openai',
            array_keys( $defaults['provider']['providers'] )
        );

        return $settings;
    }

    /**
     * Update settings safely.
     */
    public function update_settings( array $settings ): bool {
        $sanitized = $this->sanitize_settings( $settings );
        $existing  = get_option( self::OPTION_KEY, null );

        if ( null !== $existing && false !== $existing && is_array( $existing ) ) {
            if ( $existing === $sanitized ) {
                return true;
            }
        }

        $updated = update_option( self::OPTION_KEY, $sanitized, false );

        if ( ! $updated ) {
            $current = get_option( self::OPTION_KEY, null );
            if ( is_array( $current ) && $current === $sanitized ) {
                return true;
            }
        }

        return $updated;
    }

    /**
     * Public widget configuration consumed by frontend.
     */
    public function get_widget_public_config(): array {
        $settings = $this->get_settings();

        return [
            'general'    => [
                'widget_name' => $settings['general']['widget_name'] ?? '',
                'enabled'     => ! empty( $settings['general']['enabled'] ),
            ],
            'persona'    => $settings['persona'],
            'appearance' => $settings['appearance'],
            'behavior'   => $settings['behavior'],
        ];
    }

    /**
     * Get active provider slug.
     */
    public function get_active_provider_slug(): string {
        $settings = $this->get_settings();
        $defaults = $this->get_default_provider_configs();

        return $this->sanitize_provider_slug( $settings['provider']['active'] ?? 'openai', array_keys( $defaults ) );
    }

    /**
     * Return provider configuration for a slug.
     */
    public function get_provider_settings( string $provider ): array {
        $provider = $this->sanitize_provider_slug( $provider, array_keys( $this->get_default_provider_configs() ) );
        $settings = $this->get_settings();

        return $settings['provider']['providers'][ $provider ] ?? [];
    }

    /**
     * Default configuration scaffold.
     */
    public function get_default_settings(): array {
        $palettes      = $this->get_theme_palettes();
        $default_theme = 'classic';

        if ( ! isset( $palettes[ $default_theme ] ) ) {
            $keys          = array_keys( $palettes );
            $default_theme = $keys[0] ?? 'classic';
        }

        return [
            'schema_version' => '1.0.0',
            'general'        => [
                'widget_name'      => __( 'WpAI Chat', 'wpai-chat' ),
                'enabled'          => true,
                'visibility_rules' => [],
            ],
            'persona'        => [
                'system_prompt'    => '',
                'persona_label'    => __( 'AI Assistant', 'wpai-chat' ),
                'greeting_message' => __( 'Merhaba! Size nasil yardimci olabilirim?', 'wpai-chat' ),
                'initial_messages' => [],
            ],
            'appearance'     => [
                'theme'        => $default_theme,
                'colors'       => $palettes[ $default_theme ] ?? [
                    'primary'   => '#4C6FFF',
                    'secondary' => '#1F2937',
                    'accent'    => '#FACC15',
                ],
                'avatar_url'   => '',
                'position'     => 'bottom-right',
                'button_style' => 'rounded',
            ],
            'provider'       => [
                'active'    => 'openai',
                'providers' => $this->get_default_provider_configs(),
            ],
            'behavior'       => [
                'temperature'     => 0.7,
                'max_tokens'      => 1024,
                'language'        => 'auto',
                'message_limit'   => 20,
                'session_timeout' => 900,
            ],
            'logging'        => [
                'enabled'        => false,
                'retention_days' => 30,
            ],
        ];
    }

    /**
     * Sanitize settings before persisting.
     */
    private function sanitize_settings( array $settings ): array {
        $defaults = $this->get_default_settings();
        $merged   = wp_parse_args( $settings, $defaults );
        $palettes = $this->get_theme_palettes();

        $merged['general']['widget_name']      = sanitize_text_field( $merged['general']['widget_name'] );
        $merged['general']['enabled']          = ! empty( $merged['general']['enabled'] );

        $merged['persona']['system_prompt']    = wp_kses_post( $merged['persona']['system_prompt'] );
        $merged['persona']['persona_label']    = sanitize_text_field( $merged['persona']['persona_label'] );
        $merged['persona']['greeting_message'] = wp_kses_post( $merged['persona']['greeting_message'] );

        if ( isset( $merged['persona']['initial_messages'] ) && is_array( $merged['persona']['initial_messages'] ) ) {
            $merged['persona']['initial_messages'] = array_map( 'sanitize_text_field', $merged['persona']['initial_messages'] );
        } else {
            $merged['persona']['initial_messages'] = [];
        }

        $theme_slug = sanitize_key( $merged['appearance']['theme'] ?? $defaults['appearance']['theme'] );
        if ( ! isset( $palettes[ $theme_slug ] ) ) {
            $theme_slug = $defaults['appearance']['theme'];
        }

        $merged['appearance']['theme']  = $theme_slug;
        $merged['appearance']['colors'] = $palettes[ $theme_slug ];

        $allowed_positions = [ 'bottom-right', 'bottom-left' ];
        $merged['appearance']['position'] = in_array( $merged['appearance']['position'], $allowed_positions, true )
            ? $merged['appearance']['position']
            : $defaults['appearance']['position'];

        $merged['appearance']['button_style'] = sanitize_text_field( $merged['appearance']['button_style'] );

        $merged['behavior']['temperature']     = min( 2, max( 0, (float) $merged['behavior']['temperature'] ) );
        $merged['behavior']['max_tokens']      = max( 1, (int) $merged['behavior']['max_tokens'] );
        $merged['behavior']['language']        = sanitize_key( $merged['behavior']['language'] );
        $merged['behavior']['message_limit']   = max( 1, (int) $merged['behavior']['message_limit'] );
        $merged['behavior']['session_timeout'] = max( 60, (int) $merged['behavior']['session_timeout'] );


        $merged['logging']['enabled']        = ! empty( $merged['logging']['enabled'] );
        $merged['logging']['retention_days'] = max( 1, (int) $merged['logging']['retention_days'] );

        $merged['provider']['providers'] = $this->sanitize_provider_configs(
            $merged['provider']['providers'],
            $defaults['provider']['providers']
        );

        $merged['provider']['active'] = $this->sanitize_provider_slug(
            $merged['provider']['active'],
            array_keys( $defaults['provider']['providers'] )
        );

        return $merged;
    }

    /**
     * Available theme palettes.
     */
    private function get_theme_palettes(): array {
        return [
            'classic'  => [
                'primary'   => '#4C6FFF',
                'secondary' => '#1F2937',
                'accent'    => '#FACC15',
            ],
            'midnight' => [
                'primary'   => '#6366F1',
                'secondary' => '#0F172A',
                'accent'    => '#22D3EE',
            ],
            'sunset'   => [
                'primary'   => '#F97316',
                'secondary' => '#1F2937',
                'accent'    => '#FDE68A',
            ],
            'forest'   => [
                'primary'   => '#16A34A',
                'secondary' => '#0B1120',
                'accent'    => '#BBF7D0',
            ],
        ];
    }

    /**
     * Sanitize provider configurations.
     */
    private function sanitize_provider_configs( $providers, array $default_providers ): array {
        if ( ! is_array( $providers ) ) {
            $providers = [];
        }

        $sanitized = [];

        foreach ( $default_providers as $slug => $default_config ) {
            $config = $providers[ $slug ] ?? [];

            if ( ! is_array( $config ) ) {
                $config = [];
            }

            $config = wp_parse_args( $config, $default_config );

            switch ( $slug ) {
                case 'openai':
                    $base_url = $this->sanitize_base_url( $config['base_url'] ?? $default_config['base_url'] );
                    if ( '' === $base_url ) {
                        $base_url = $default_config['base_url'];
                    }

                    $sanitized[ $slug ] = [
                        'api_key'      => isset( $config['api_key'] ) ? trim( (string) $config['api_key'] ) : '',
                        'model'        => sanitize_text_field( $config['model'] ?? $default_config['model'] ),
                        'base_url'     => $base_url,
                        'organization' => sanitize_text_field( $config['organization'] ?? '' ),
                    ];
                    break;
                case 'gemini':
                    $endpoint = $this->sanitize_base_url( $config['endpoint'] ?? $default_config['endpoint'] );
                    if ( '' === $endpoint ) {
                        $endpoint = $default_config['endpoint'];
                    }

                    $sanitized[ $slug ] = [
                        'api_key'  => isset( $config['api_key'] ) ? trim( (string) $config['api_key'] ) : '',
                        'model'    => sanitize_text_field( $config['model'] ?? $default_config['model'] ),
                        'endpoint' => $endpoint,
                    ];
                    break;
                case 'groq':
                    $base_url = $this->sanitize_base_url( $config['base_url'] ?? $default_config['base_url'] );
                    if ( '' === $base_url ) {
                        $base_url = $default_config['base_url'];
                    }

                    $sanitized[ $slug ] = [
                        'api_key'  => isset( $config['api_key'] ) ? trim( (string) $config['api_key'] ) : '',
                        'model'    => sanitize_text_field( $config['model'] ?? $default_config['model'] ),
                        'base_url' => $base_url,
                    ];
                    break;
                case 'openrouter':
                    $base_url = $this->sanitize_base_url( $config['base_url'] ?? $default_config['base_url'] );
                    if ( '' === $base_url ) {
                        $base_url = $default_config['base_url'];
                    }

                    $sanitized[ $slug ] = [
                        'api_key'        => isset( $config['api_key'] ) ? trim( (string) $config['api_key'] ) : '',
                        'model'          => sanitize_text_field( $config['model'] ?? $default_config['model'] ),
                        'base_url'       => $base_url,
                        'fallback_model' => sanitize_text_field( $config['fallback_model'] ?? '' ),
                    ];
                    break;
                default:
                    $sanitized[ $slug ] = apply_filters( 'wpai_chat_sanitize_provider_config', $config, $slug, $default_config );
                    break;
            }
        }

        return wp_parse_args( $sanitized, $default_providers );
    }

    /**
     * Sanitize provider slug.
     */
    private function sanitize_provider_slug( string $slug, array $allowed ): string {
        $slug = sanitize_key( $slug );

        if ( ! in_array( $slug, $allowed, true ) ) {
            return $allowed[0] ?? 'openai';
        }

        return $slug;
    }

    /**
     * Default provider configurations.
     */
    private function get_default_provider_configs(): array {
        return [
            'openai'     => [
                'api_key'      => '',
                'model'        => 'gpt-3.5-turbo',
                'base_url'     => 'https://api.openai.com/v1',
                'organization' => '',
            ],
            'gemini'     => [
                'api_key'  => '',
                'model'    => 'gemini-pro',
                'endpoint' => 'https://generativelanguage.googleapis.com/v1beta/models',
            ],
            'groq'       => [
                'api_key'  => '',
                'model'    => 'llama3-8b-8192',
                'base_url' => 'https://api.groq.com/openai/v1',
            ],
            'openrouter' => [
                'api_key'        => '',
                'model'          => 'openrouter/auto',
                'base_url'       => 'https://openrouter.ai/api/v1',
                'fallback_model' => '',
            ],
        ];
    }

    /**
     * Ensure base URL is a safe string.
     */
    private function sanitize_base_url( string $url ): string {
        $url = trim( $url );
        $url = esc_url_raw( $url );

        if ( empty( $url ) ) {
            return '';
        }

        return untrailingslashit( $url );
    }
}




