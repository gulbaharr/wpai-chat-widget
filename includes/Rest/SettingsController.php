<?php
/**
 * REST controller for managing admin settings.
 */

namespace Wpai\Chat\Rest;

use Wpai\Chat\Providers\ProviderManager;
use Wpai\Chat\Providers\ProviderException;
use Wpai\Chat\SettingsRepository;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class SettingsController {
    /**
     * REST namespace.
     */
    private const REST_NAMESPACE = 'wpai/v1';

    /**
     * Route base.
     */
    private const ROUTE = '/settings';

    /**
     * Settings repository instance.
     *
     * @var SettingsRepository
     */
    private $settings_repository;

    /**
     * Provider manager instance.
     *
     * @var ProviderManager
     */
    private $provider_manager;

    /**
     * Constructor.
     */
    public function __construct( SettingsRepository $settings_repository, ProviderManager $provider_manager ) {
        $this->settings_repository = $settings_repository;
        $this->provider_manager    = $provider_manager;
    }

    /**
     * Register routes.
     */
    public function register_routes(): void {
        register_rest_route(
            self::REST_NAMESPACE,
            self::ROUTE,
            [
                [
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => [ $this, 'get_settings' ],
                    'permission_callback' => [ $this, 'validate_request' ],
                ],
                [
                    'methods'             => WP_REST_Server::EDITABLE,
                    'callback'            => [ $this, 'update_settings' ],
                    'permission_callback' => [ $this, 'validate_request' ],
                ],
            ]
        );

        register_rest_route(
            self::REST_NAMESPACE,
            '/models',
            [
                [
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => [ $this, 'get_models' ],
                    'permission_callback' => [ $this, 'validate_request' ],
                    'args'                => [
                        'provider' => [
                            'required' => true,
                            'type'     => 'string',
                        ],
                    ],
                ],
            ]
        );
    }

    /**
     * Return settings payload.
     */
    public function get_settings(): WP_REST_Response {
        $settings = $this->settings_repository->get_settings();

        return new WP_REST_Response( $settings, 200 );
    }

    /**
     * Update settings payload.
     */
    public function update_settings( WP_REST_Request $request ) {
        $params = $request->get_json_params();

        if ( ! is_array( $params ) ) {
            return new WP_Error( 'wpai_invalid_payload', __( 'Gecersiz istek govdesi.', 'wpai-chat' ), [ 'status' => 400 ] );
        }

        $result = $this->settings_repository->update_settings( $params );

        if ( ! $result ) {
            return new WP_Error( 'wpai_settings_persist_failed', __( 'Ayarlar kaydedilemedi.', 'wpai-chat' ), [ 'status' => 500 ] );
        }

        $settings = $this->settings_repository->get_settings();

        return new WP_REST_Response( $settings, 200 );
    }

    /**
     * Return model catalog.
     */
    public function get_models( WP_REST_Request $request ) {
        $provider = (string) $request->get_param( 'provider' );

        try {
            $models = $this->provider_manager->list_models( $provider );
        } catch ( ProviderException $exception ) {
            return new WP_Error( 'wpai_models_error', $exception->getMessage(), [ 'status' => $exception->getCode() ?: 500 ] );
        }

        return new WP_REST_Response( [ 'models' => $models ], 200 );
    }

    /**
     * Validate admin capability & nonce.
     */
    public function validate_request() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return new WP_Error( 'wpai_forbidden', __( 'Bu kaynaga erisim yetkiniz yok.', 'wpai-chat' ), [ 'status' => 403 ] );
        }

        $nonce = '';
        if ( isset( $_SERVER['HTTP_X_WP_NONCE'] ) ) {
            $nonce = sanitize_text_field( wp_unslash( (string) $_SERVER['HTTP_X_WP_NONCE'] ) );
        } elseif ( isset( $_REQUEST['_wpnonce'] ) ) {
            $nonce = sanitize_text_field( wp_unslash( (string) $_REQUEST['_wpnonce'] ) );
        }

        if ( empty( $nonce ) || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
            return new WP_Error( 'wpai_invalid_nonce', __( 'Gecersiz guvenlik dogrulamasi.', 'wpai-chat' ), [ 'status' => 403 ] );
        }

        return true;
    }
}



