<?php
/**
 * REST controller for managing analytics data.
 */

namespace Wpai\Chat\Rest;

use Wpai\Chat\AnalyticsRepository;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AnalyticsController {
    /**
     * REST namespace.
     */
    private const REST_NAMESPACE = 'wpai/v1';

    /**
     * Analytics repository reference.
     *
     * @var AnalyticsRepository
     */
    private $analytics_repository;

    /**
     * Constructor.
     */
    public function __construct( AnalyticsRepository $analytics_repository ) {
        $this->analytics_repository = $analytics_repository;
    }

    /**
     * Register REST routes.
     */
    public function register_routes(): void {
        register_rest_route(
            self::REST_NAMESPACE,
            '/analytics',
            [
                [
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => [ $this, 'get_analytics' ],
                    'permission_callback' => [ $this, 'validate_admin_request' ],
                    'args'                => [
                        'start_date' => [
                            'type'        => 'string',
                            'format'      => 'date',
                            'description' => 'Start date for analytics (Y-m-d)',
                        ],
                        'end_date'   => [
                            'type'        => 'string',
                            'format'      => 'date',
                            'description' => 'End date for analytics (Y-m-d)',
                        ],
                        'provider'   => [
                            'type'        => 'string',
                            'description' => 'Filter by provider slug',
                        ],
                        'persona'    => [
                            'type'        => 'string',
                            'description' => 'Filter by persona',
                        ],
                    ],
                ],
            ]
        );

        register_rest_route(
            self::REST_NAMESPACE,
            '/analytics/export',
            [
                [
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => [ $this, 'export_analytics' ],
                    'permission_callback' => [ $this, 'validate_admin_request' ],
                ],
            ]
        );

        register_rest_route(
            self::REST_NAMESPACE,
            '/analytics/cleanup',
            [
                [
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => [ $this, 'cleanup_analytics' ],
                    'permission_callback' => [ $this, 'validate_admin_request' ],
                    'args'                => [
                        'days_to_keep' => [
                            'type'              => 'integer',
                            'default'           => 90,
                            'minimum'           => 1,
                            'maximum'           => 365,
                            'description'       => 'Number of days to keep analytics data',
                            'validate_callback' => function ( $value ) {
                                return is_numeric( $value ) && $value >= 1 && $value <= 365;
                            },
                        ],
                    ],
                ],
            ]
        );
    }

    /**
     * Get analytics data.
     */
    public function get_analytics( WP_REST_Request $request ): WP_REST_Response {
        $filters = [
            'start_date' => $request->get_param( 'start_date' ),
            'end_date'   => $request->get_param( 'end_date' ),
            'provider'   => $request->get_param( 'provider' ),
            'persona'    => $request->get_param( 'persona' ),
        ];

        // Remove empty filters
        $filters = array_filter( $filters, function ( $value ) {
            return ! empty( $value );
        } );

        $analytics_data = $this->analytics_repository->get_analytics( $filters );

        return new WP_REST_Response( $analytics_data, 200 );
    }

    /**
     * Export analytics data.
     */
    public function export_analytics( WP_REST_Request $request ): WP_REST_Response {
        $filters = [
            'start_date' => $request->get_param( 'start_date' ),
            'end_date'   => $request->get_param( 'end_date' ),
            'provider'   => $request->get_param( 'provider' ),
            'persona'    => $request->get_param( 'persona' ),
        ];

        // Remove empty filters
        $filters = array_filter( $filters, function ( $value ) {
            return ! empty( $value );
        } );

        $export_data = $this->analytics_repository->export_data( $filters );

        // Add CSV headers for download
        $filename = 'wpai-analytics-' . date( 'Y-m-d-H-i-s' ) . '.csv';

        header( 'Content-Type: text/csv; charset=utf-8' );
        header( 'Content-Disposition: attachment; filename="' . $filename . '"' );

        // Create CSV content
        $csv_content = $this->array_to_csv( $export_data );

        return new WP_REST_Response(
            [
                'filename' => $filename,
                'data'     => base64_encode( $csv_content ),
                'mime_type' => 'text/csv',
            ],
            200
        );
    }

    /**
     * Clean up old analytics data.
     */
    public function cleanup_analytics( WP_REST_Request $request ): WP_REST_Response {
        $days_to_keep = $request->get_param( 'days_to_keep' );

        $deleted_count = $this->analytics_repository->cleanup_old_data( $days_to_keep );

        return new WP_REST_Response(
            [
                'message'       => sprintf(
                    __( '%d eski kayıt başarıyla temizlendi.', 'wpai-chat' ),
                    $deleted_count
                ),
                'deleted_count' => $deleted_count,
            ],
            200
        );
    }

    /**
     * Validate admin requests.
     */
    public function validate_admin_request(): bool {
        return current_user_can( 'manage_options' );
    }

    /**
     * Convert array to CSV string.
     */
    private function array_to_csv( array $data ): string {
        if ( empty( $data ) ) {
            return '';
        }

        $output = fopen( 'php://temp', 'r+' );

        // Write headers
        fputcsv( $output, array_keys( $data[0] ) );

        // Write data
        foreach ( $data as $row ) {
            fputcsv( $output, $row );
        }

        rewind( $output );
        $csv = stream_get_contents( $output );
        fclose( $output );

        return $csv;
    }
}
