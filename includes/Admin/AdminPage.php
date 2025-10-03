<?php

namespace Wpai\Chat\Admin;

use Wpai\Chat\SettingsRepository;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Admin menu page for plugin settings.
 */
class AdminPage {
    /**
     * Menu slug constant.
     */
    private const MENU_SLUG = 'wpai-chat';

    /**
     * Settings repository instance.
     *
     * @var SettingsRepository
     */
    private $settings_repository;

    /**
     * Constructor.
     */
    public function __construct( SettingsRepository $settings_repository ) {
        $this->settings_repository = $settings_repository;

        add_action( 'admin_menu', [ $this, 'register_menu' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_assets' ] );
    }

    /**
     * Register admin menu page.
     */
    public function register_menu(): void {
        add_menu_page(
            __( 'WpAI Chat', 'wpai-chat' ),
            __( 'WpAI Chat', 'wpai-chat' ),
            'manage_options',
            self::MENU_SLUG,
            [ $this, 'render_page' ],
            'dashicons-format-chat',
            58
        );
    }

    /**
     * Enqueue admin assets.
     */
    public function enqueue_assets( string $hook_suffix ): void {
        if ( 'toplevel_page_' . self::MENU_SLUG !== $hook_suffix ) {
            return;
        }

        $asset_handle = 'wpai-chat-admin';

        $css_file = plugin_dir_path( WPAI_CHAT_PLUGIN_FILE ) . 'assets/css/admin.css';
        $js_file  = plugin_dir_path( WPAI_CHAT_PLUGIN_FILE ) . 'assets/js/admin.js';
        $css_ver  = file_exists( $css_file ) ? filemtime( $css_file ) : WPAI_CHAT_VERSION;
        $js_ver   = file_exists( $js_file ) ? filemtime( $js_file ) : WPAI_CHAT_VERSION;

        wp_enqueue_style(
            $asset_handle,
            plugins_url( 'assets/css/admin.css', WPAI_CHAT_PLUGIN_FILE ),
            [],
            $css_ver
        );

        wp_enqueue_script(
            $asset_handle,
            plugins_url( 'assets/js/admin.js', WPAI_CHAT_PLUGIN_FILE ),
            [ 'wp-api-fetch' ],
            $js_ver,
            true
        );

        wp_localize_script(
            $asset_handle,
            'wpaiChatSettings',
            [
                'settings'   => $this->settings_repository->get_settings(),
                'apiPath'    => 'wpai/v1/settings',
                'modelsPath' => 'wpai/v1/models',
                'logsPath'   => 'wpai/v1/logs',
                'nonce'      => wp_create_nonce( 'wp_rest' ),
            ]
        );
    }

    /**
     * Render admin page container.
     */
    public function render_page(): void {
        echo '<div class="wrap wpai-chat-admin">';
        echo '<h1>' . esc_html__( 'WpAI Chat Ayarlari', 'wpai-chat' ) . '</h1>';
        echo '<div id="wpai-chat-admin-root" class="wpai-chat-admin__root"></div>';
        echo '</div>';
    }
}
