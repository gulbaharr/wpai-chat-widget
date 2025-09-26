<?php
/**
 * Main plugin bootstrap class.
 */

namespace Wpai\Chat;

use Wpai\Chat\Admin\AdminPage;
use Wpai\Chat\Providers\ProviderManager;
use Wpai\Chat\Rest\ChatController;
use Wpai\Chat\Rest\SettingsController;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Plugin {
    /**
     * Singleton instance.
     *
     * @var Plugin|null
     */
    private static $instance = null;

    /**
     * Settings repository.
     *
     * @var SettingsRepository
     */
    private $settings_repository;

    /**
     * Provider manager.
     *
     * @var ProviderManager
     */
    private $provider_manager;

    /**
     * Chat REST controller.
     *
     * @var ChatController
     */
    private $chat_controller;

    /**
     * Settings REST controller.
     *
     * @var SettingsController
     */
    private $settings_controller;

    /**
     * Admin page handler.
     *
     * @var AdminPage
     */
    private $admin_page;

    /**
     * Tracks whether widget container printed.
     *
     * @var bool
     */
    private $widget_rendered = false;

    /**
     * Initialise plugin singleton.
     */
    public static function init(): void {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
    }

    /**
     * Plugin constructor.
     */
    private function __construct() {
        $this->settings_repository = new SettingsRepository();
        $this->provider_manager    = new ProviderManager( $this->settings_repository );
        $this->chat_controller     = new ChatController( $this->settings_repository, $this->provider_manager );
        $this->settings_controller = new SettingsController( $this->settings_repository, $this->provider_manager );
        $this->admin_page          = new AdminPage( $this->settings_repository );

        add_action( 'init', [ $this, 'load_textdomain' ] );
        add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );
        add_action( 'wp_enqueue_scripts', [ $this, 'maybe_enqueue_frontend_assets' ] );
        add_action( 'wp_footer', [ $this, 'render_widget_container' ] );

        add_shortcode( 'wpai_chat', [ $this, 'render_widget_shortcode' ] );
    }

    /**
     * Load translation files.
     */
    public function load_textdomain(): void {
        load_plugin_textdomain( 'wpai-chat', false, dirname( plugin_basename( WPAI_CHAT_PLUGIN_FILE ) ) . '/languages' );
    }

    /**
     * Register REST API routes.
     */
    public function register_rest_routes(): void {
        $this->chat_controller->register_routes();
        $this->settings_controller->register_routes();
    }

    /**
     * Enqueue frontend assets and expose config when widget is enabled.
     */
    public function maybe_enqueue_frontend_assets(): void {
        $config = $this->settings_repository->get_widget_public_config();

        if ( empty( $config['general']['enabled'] ) ) {
            return;
        }

        $asset_handle = 'wpai-chat-widget';

        $css_relative = 'assets/css/widget.css';
        $js_relative  = 'assets/js/widget.js';
        $css_path     = plugin_dir_path( WPAI_CHAT_PLUGIN_FILE ) . $css_relative;
        $js_path      = plugin_dir_path( WPAI_CHAT_PLUGIN_FILE ) . $js_relative;
        $css_version  = file_exists( $css_path ) ? filemtime( $css_path ) : WPAI_CHAT_VERSION;
        $js_version   = file_exists( $js_path ) ? filemtime( $js_path ) : WPAI_CHAT_VERSION;

        wp_register_style(
            $asset_handle,
            plugins_url( $css_relative, WPAI_CHAT_PLUGIN_FILE ),
            [],
            $css_version
        );

        wp_register_script(
            $asset_handle,
            plugins_url( $js_relative, WPAI_CHAT_PLUGIN_FILE ),
            [ 'wp-api-fetch' ],
            $js_version,
            true
        );

        wp_enqueue_style( $asset_handle );
        wp_enqueue_script( $asset_handle );

        wp_localize_script(
            $asset_handle,
            'wpaiChatConfig',
            [
                'restUrl'   => esc_url_raw( rest_url( 'wpai/v1/' ) ),
                'endpoints' => [
                    'session' => esc_url_raw( rest_url( 'wpai/v1/session' ) ),
                    'chat'    => esc_url_raw( rest_url( 'wpai/v1/chat' ) ),
                ],
                'styleUrl' => esc_url_raw( add_query_arg( 'ver', $css_version, plugins_url( $css_relative, WPAI_CHAT_PLUGIN_FILE ) ) ),
                'nonce'    => wp_create_nonce( 'wp_rest' ),
                'settings' => $config,
                'provider' => $this->settings_repository->get_active_provider_slug(),
            ]
        );
    }

    /**
     * Output widget container in footer when enabled.
     */
    public function render_widget_container(): void {
        if ( $this->widget_rendered ) {
            return;
        }

        $config = $this->settings_repository->get_widget_public_config();
        if ( empty( $config['general']['enabled'] ) ) {
            return;
        }

        echo '<div id="wpai-chat-widget-root" class="wpai-chat-widget-root" aria-live="polite"></div>';
        $this->widget_rendered = true;
    }

    /**
     * Shortcode renderer for manual placement.
     */
    public function render_widget_shortcode(): string {
        ob_start();
        $this->render_widget_container();

        return ob_get_clean();
    }
}



