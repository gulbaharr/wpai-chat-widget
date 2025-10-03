<?php
/**
 * REST controller for managing logs.
 */

namespace Wpai\Chat\Rest;

use Wpai\Chat\LoggingRepository;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class LogsController {
    /**
     * REST namespace.
     */
    private const REST_NAMESPACE = 'wpai/v1';

    /**
     * Route base.
     */
    private const ROUTE = '/logs';

    /**
     * Logging repository instance.
     *
     * @var LoggingRepository
     */
    private $logging_repository;

    /**
     * Constructor.
     */
    public function __construct( LoggingRepository $logging_repository ) {
        $this->logging_repository = $logging_repository;
    }

    /**
     * Register REST routes.
     */
    public function register_routes(): void {
        register_rest_route(
            self::REST_NAMESPACE,
            self::ROUTE,
            [
                [
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => [ $this, 'list_logs' ],
                    'permission_callback' => [ $this, 'validate_request' ],
                    'args'                => [
                        'page' => [
                            'type'    => 'integer',
                            'default' => 1,
                            'minimum' => 1,
                        ],
                        'per_page' => [
                            'type'    => 'integer',
                            'default' => 20,
                            'minimum' => 1,
                            'maximum' => 100,
                        ],
                        'session_id' => [
                            'type'    => 'string',
                            'default' => '',
                        ],
                        'group_by_session' => [
                            'type'    => 'boolean',
                            'default' => false,
                        ],
                    ],
                ],
            ]
        );
    }

    /**
     * Return paginated logs.
     */
    public function list_logs( WP_REST_Request $request ) {
        $page              = max( 1, (int) $request->get_param( 'page' ) );
        $per_page          = (int) $request->get_param( 'per_page' );
        $session_id        = sanitize_text_field( (string) $request->get_param( 'session_id' ) );
        $group_by_session  = (bool) $request->get_param( 'group_by_session' );

        if ( $per_page <= 0 ) {
            $per_page = 20;
        }

        // Spesifik oturum istenmişse
        if ( ! empty( $session_id ) ) {
            $logs = $this->logging_repository->get_logs_by_session( $session_id );
            $items = array_map( [ $this, 'format_log' ], $logs );

            return new WP_REST_Response(
                [
                    'items'            => $items,
                    'total'            => count( $items ),
                    'session_id'       => $session_id,
                    'logging_enabled'  => $this->logging_repository->is_enabled(),
                    'retention_days'   => $this->logging_repository->get_retention_days(),
                ],
                200
            );
        }

        // Oturumlara göre gruplama istenmişse
        if ( $group_by_session ) {
            $sessions = $this->logging_repository->get_session_summary( $page, $per_page );

            return new WP_REST_Response(
                [
                    'items'            => $sessions['items'],
                    'total'            => $sessions['total'],
                    'page'             => $sessions['page'],
                    'per_page'         => $sessions['per_page'],
                    'total_pages'      => $sessions['total_pages'],
                    'logging_enabled'  => $this->logging_repository->is_enabled(),
                    'retention_days'   => $this->logging_repository->get_retention_days(),
                    'view_mode'        => 'sessions',
                ],
                200
            );
        }

        // Normal log listesi
        $logs = $this->logging_repository->get_logs( $page, $per_page );

        $items = array_map( [ $this, 'format_log' ], $logs['items'] );
        $total_pages = $logs['per_page'] > 0 ? (int) ceil( $logs['total'] / $logs['per_page'] ) : 0;

        return new WP_REST_Response(
            [
                'items'            => $items,
                'total'            => $logs['total'],
                'page'             => $logs['page'],
                'per_page'         => $logs['per_page'],
                'total_pages'      => $total_pages,
                'logging_enabled'  => $this->logging_repository->is_enabled(),
                'retention_days'   => $this->logging_repository->get_retention_days(),
                'view_mode'        => 'all',
            ],
            200
        );
    }

    /**
     * Ensure caller is authorised.
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

    /**
     * Shape a single row for REST output.
     */
    private function format_log( array $row ): array {
        $created_gmt   = isset( $row['created_at'] ) ? $row['created_at'] : gmdate( 'Y-m-d H:i:s' );
        $created_iso   = function_exists( 'mysql_to_rfc3339' ) ? mysql_to_rfc3339( $created_gmt ) : $created_gmt;
        $created_local = get_date_from_gmt( $created_gmt, 'Y-m-d H:i:s' );

        return [
            'id'                 => (int) ( $row['id'] ?? 0 ),
            'session_id'         => (string) ( $row['session_id'] ?? '' ),
            'provider'           => (string) ( $row['provider'] ?? '' ),
            'user_message'       => (string) ( $row['user_message'] ?? '' ),
            'assistant_message'  => (string) ( $row['assistant_message'] ?? '' ),
            'usage'              => $row['usage_data'] ?? [],
            'created_at_gmt'     => $created_gmt,
            'created_at_local'   => $created_local,
            'created_at_iso'     => $created_iso,
        ];
    }
}

