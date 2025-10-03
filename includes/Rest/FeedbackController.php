<?php
/**
 * REST controller for managing user feedback.
 */

namespace Wpai\Chat\Rest;

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class FeedbackController {
    /**
     * REST namespace.
     */
    private const REST_NAMESPACE = 'wpai/v1';

    /**
     * Register REST routes.
     */
    public function register_routes(): void {
        register_rest_route(
            self::REST_NAMESPACE,
            '/feedback',
            [
                [
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => [ $this, 'submit_feedback' ],
                    'permission_callback' => [ $this, 'validate_feedback_request' ],
                    'args'                => [
                        'session_id' => [
                            'required'          => true,
                            'type'              => 'string',
                            'description'       => 'Chat session ID',
                            'validate_callback' => function ( $value ) {
                                return is_string( $value ) && ! empty( $value );
                            },
                        ],
                        'rating'     => [
                            'required'          => true,
                            'type'              => 'integer',
                            'minimum'           => 1,
                            'maximum'           => 5,
                            'description'       => 'User rating (1-5 stars)',
                            'validate_callback' => function ( $value ) {
                                return is_numeric( $value ) && $value >= 1 && $value <= 5;
                            },
                        ],
                        'feedback'   => [
                            'type'              => 'string',
                            'description'       => 'Optional user feedback text',
                            'validate_callback' => function ( $value ) {
                                return is_string( $value ) && strlen( $value ) <= 500;
                            },
                        ],
                        'timestamp'  => [
                            'type'              => 'string',
                            'description'       => 'Feedback timestamp',
                            'validate_callback' => function ( $value ) {
                                return strtotime( $value ) !== false;
                            },
                        ],
                    ],
                ],
            ]
        );

        register_rest_route(
            self::REST_NAMESPACE,
            '/feedback/(?P<id>[\w-]+)',
            [
                [
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => [ $this, 'get_feedback' ],
                    'permission_callback' => [ $this, 'validate_admin_request' ],
                    'args'                => [
                        'id' => [
                            'required' => true,
                            'type'     => 'string',
                        ],
                    ],
                ],
            ]
        );

        register_rest_route(
            self::REST_NAMESPACE,
            '/feedback',
            [
                [
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => [ $this, 'get_feedback_list' ],
                    'permission_callback' => [ $this, 'validate_admin_request' ],
                    'args'                => [
                        'page'     => [
                            'type'              => 'integer',
                            'default'           => 1,
                            'minimum'           => 1,
                            'description'       => 'Page number',
                            'validate_callback' => function ( $value ) {
                                return is_numeric( $value ) && $value >= 1;
                            },
                        ],
                        'per_page' => [
                            'type'              => 'integer',
                            'default'           => 20,
                            'minimum'           => 1,
                            'maximum'           => 100,
                            'description'       => 'Items per page',
                            'validate_callback' => function ( $value ) {
                                return is_numeric( $value ) && $value >= 1 && $value <= 100;
                            },
                        ],
                        'rating'   => [
                            'type'              => 'integer',
                            'minimum'           => 1,
                            'maximum'           => 5,
                            'description'       => 'Filter by rating',
                            'validate_callback' => function ( $value ) {
                                return is_numeric( $value ) && $value >= 1 && $value <= 5;
                            },
                        ],
                        'start_date' => [
                            'type'        => 'string',
                            'format'      => 'date',
                            'description' => 'Start date filter',
                        ],
                        'end_date'   => [
                            'type'        => 'string',
                            'format'      => 'date',
                            'description' => 'End date filter',
                        ],
                    ],
                ],
            ]
        );
    }

    /**
     * Submit user feedback.
     */
    public function submit_feedback( WP_REST_Request $request ): WP_REST_Response {
        $session_id = sanitize_text_field( $request->get_param( 'session_id' ) );
        $rating     = (int) $request->get_param( 'rating' );
        $feedback   = sanitize_textarea_field( $request->get_param( 'feedback' ) ?? '' );
        $timestamp  = sanitize_text_field( $request->get_param( 'timestamp' ) ?? current_time( 'mysql' ) );

        // Validate session exists
        if ( ! $this->session_exists( $session_id ) ) {
            return new WP_Error(
                'wpai_invalid_session',
                __( 'Geçersiz oturum kimliği.', 'wpai-chat' ),
                [ 'status' => 400 ]
            );
        }

        // Save feedback to database
        $feedback_id = $this->save_feedback( $session_id, $rating, $feedback, $timestamp );

        if ( ! $feedback_id ) {
            return new WP_Error(
                'wpai_feedback_save_failed',
                __( 'Geri bildirim kaydedilemedi.', 'wpai-chat' ),
                [ 'status' => 500 ]
            );
        }

        // Update analytics if available
        $this->update_session_analytics( $session_id, $rating, $feedback );

        // Trigger feedback submitted action
        do_action( 'wpai_feedback_submitted', $feedback_id, $session_id, $rating, $feedback );

        return new WP_REST_Response(
            [
                'message'     => __( 'Geri bildiriminiz için teşekkür ederiz!', 'wpai-chat' ),
                'feedback_id' => $feedback_id,
            ],
            201
        );
    }

    /**
     * Get specific feedback.
     */
    public function get_feedback( WP_REST_Request $request ): WP_REST_Response {
        $feedback_id = $request->get_param( 'id' );

        global $wpdb;
        $table_name = $wpdb->prefix . 'wpai_feedback';

        $feedback = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$table_name} WHERE id = %s",
                $feedback_id
            ),
            ARRAY_A
        );

        if ( ! $feedback ) {
            return new WP_Error(
                'wpai_feedback_not_found',
                __( 'Geri bildirim bulunamadı.', 'wpai-chat' ),
                [ 'status' => 404 ]
            );
        }

        return new WP_REST_Response( $feedback, 200 );
    }

    /**
     * Get feedback list with pagination.
     */
    public function get_feedback_list( WP_REST_Request $request ): WP_REST_Response {
        $page       = (int) $request->get_param( 'page' );
        $per_page   = (int) $request->get_param( 'per_page' );
        $rating     = $request->get_param( 'rating' );
        $start_date = $request->get_param( 'start_date' );
        $end_date   = $request->get_param( 'end_date' );

        global $wpdb;
        $table_name = $wpdb->prefix . 'wpai_feedback';

        // Build query
        $where_conditions = [];
        $where_values     = [];

        if ( $rating ) {
            $where_conditions[] = 'rating = %d';
            $where_values[]     = $rating;
        }

        if ( $start_date ) {
            $where_conditions[] = 'DATE(created_at) >= %s';
            $where_values[]     = $start_date;
        }

        if ( $end_date ) {
            $where_conditions[] = 'DATE(created_at) <= %s';
            $where_values[]     = $end_date;
        }

        $where_clause = ! empty( $where_conditions )
            ? 'WHERE ' . implode( ' AND ', $where_conditions )
            : '';

        // Get total count
        $total_query = "SELECT COUNT(*) FROM {$table_name} {$where_clause}";
        if ( ! empty( $where_values ) ) {
            $total_query = $wpdb->prepare( $total_query, $where_values );
        }
        $total_items = (int) $wpdb->get_var( $total_query );

        // Calculate pagination
        $offset      = ( $page - 1 ) * $per_page;
        $total_pages = ceil( $total_items / $per_page );

        // Get feedback items
        $items_query = "SELECT * FROM {$table_name} {$where_clause}
                       ORDER BY created_at DESC LIMIT %d OFFSET %d";
        $query_values = array_merge( $where_values, [ $per_page, $offset ] );
        $items        = $wpdb->get_results(
            $wpdb->prepare( $items_query, $query_values ),
            ARRAY_A
        );

        return new WP_REST_Response(
            [
                'items'       => $items,
                'pagination'  => [
                    'page'        => $page,
                    'per_page'    => $per_page,
                    'total_items' => $total_items,
                    'total_pages' => $total_pages,
                ],
                'filters'     => [
                    'rating'     => $rating,
                    'start_date' => $start_date,
                    'end_date'   => $end_date,
                ],
            ],
            200
        );
    }

    /**
     * Validate feedback submission requests.
     */
    public function validate_feedback_request(): bool {
        // Allow public feedback submissions with rate limiting
        return $this->validate_rate_limit();
    }

    /**
     * Validate admin requests.
     */
    public function validate_admin_request(): bool {
        return current_user_can( 'manage_options' );
    }

    /**
     * Check if session exists.
     */
    private function session_exists( string $session_id ): bool {
        // Check if session exists in logs or active sessions
        // This is a simplified check - you might want to implement proper session validation
        return ! empty( $session_id );
    }

    /**
     * Save feedback to database.
     */
    private function save_feedback( string $session_id, int $rating, string $feedback, string $timestamp ): ?int {
        global $wpdb;
        $table_name = $wpdb->prefix . 'wpai_feedback';

        $result = $wpdb->insert(
            $table_name,
            [
                'session_id'  => $session_id,
                'rating'      => $rating,
                'feedback'    => $feedback,
                'created_at'  => $timestamp,
            ],
            [ '%s', '%d', '%s', '%s' ]
        );

        return $result ? $wpdb->insert_id : null;
    }

    /**
     * Update session analytics with feedback data.
     */
    private function update_session_analytics( string $session_id, int $rating, string $feedback ): void {
        // Update analytics repository if available
        if ( class_exists( 'Wpai\\Chat\\AnalyticsRepository' ) ) {
            $analytics_repo = new \Wpai\Chat\AnalyticsRepository();
            // Update session with feedback data
            // This would require additional methods in AnalyticsRepository
        }
    }

    /**
     * Validate rate limiting for feedback submissions.
     */
    private function validate_rate_limit(): bool {
        $user_ip = $this->get_user_ip();
        $transient_key = 'wpai_feedback_limit_' . md5( $user_ip );

        $attempts = get_transient( $transient_key );

        if ( false === $attempts ) {
            set_transient( $transient_key, 1, 3600 ); // 1 hour
            return true;
        }

        if ( $attempts >= 10 ) { // Max 10 feedback submissions per hour
            return false;
        }

        set_transient( $transient_key, $attempts + 1, 3600 );
        return true;
    }

    /**
     * Get user IP address.
     */
    private function get_user_ip(): string {
        if ( ! empty( $_SERVER['HTTP_CLIENT_IP'] ) ) {
            return sanitize_text_field( wp_unslash( $_SERVER['HTTP_CLIENT_IP'] ) );
        } elseif ( ! empty( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ) {
            return sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_FORWARDED_FOR'] ) );
        } else {
            return sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ?? '' ) );
        }
    }

    /**
     * Create feedback table.
     */
    public static function create_table(): void {
        global $wpdb;

        $table_name      = $wpdb->prefix . 'wpai_feedback';
        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE {$table_name} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            session_id varchar(100) NOT NULL,
            rating int(11) NOT NULL,
            feedback text DEFAULT '',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY session_id (session_id),
            KEY rating (rating),
            KEY created_at (created_at)
        ) {$charset_collate};";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta( $sql );
    }
}
