<?php namespace Wpai\Chat;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class LoggingRepository {
    /**
     * Database table suffix.
     */
    private const TABLE_SUFFIX = 'wpai_chat_logs';

    /**
     * Cached result of table existence check.
     *
     * @var bool|null
     */
    private static $table_exists = null;

    /**
     * Settings repository reference.
     *
     * @var SettingsRepository
     */
    private $settings_repository;

    /**
     * Constructor.
     */
    public function __construct( SettingsRepository $settings_repository ) {
        $this->settings_repository = $settings_repository;
    }

    /**
     * Return the fully qualified table name.
     */
    public static function get_table_name(): string {
        global $wpdb;

        return $wpdb->prefix . self::TABLE_SUFFIX;
    }

    /**
     * Ensure logging table exists.
     */
    public static function install(): void {
        global $wpdb;

        $table_name      = self::get_table_name();
        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE {$table_name} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            session_id VARCHAR(64) NOT NULL,
            provider VARCHAR(64) NOT NULL DEFAULT '',
            user_message LONGTEXT NULL,
            assistant_message LONGTEXT NULL,
            usage_data LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            KEY session_id (session_id),
            KEY created_at (created_at)
        ) {$charset_collate};";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta( $sql );

        self::$table_exists = true;
    }

    /**
     * Write interaction to log store.
     */
    public function log_interaction( string $session_id, string $provider, array $messages, array $assistant_message, array $usage = [] ): void {
        if ( ! $this->is_enabled() ) {
            return;
        }

        $user_message = $this->extract_last_user_message( $messages );
        $assistant    = $this->sanitize_message( $assistant_message['content'] ?? '' );

        if ( '' === $user_message && '' === $assistant ) {
            return;
        }

        $this->ensure_table_ready();
        if ( ! self::$table_exists ) {
            return;
        }

        global $wpdb;

        $wpdb->insert(
            self::get_table_name(),
            [
                'session_id'        => substr( sanitize_text_field( $session_id ), 0, 64 ),
                'provider'          => substr( sanitize_text_field( $provider ), 0, 64 ),
                'user_message'      => $user_message,
                'assistant_message' => $assistant,
                'usage_data'        => ! empty( $usage ) ? wp_json_encode( $usage ) : '',
                'created_at'        => current_time( 'mysql', true ),
            ],
            [ '%s', '%s', '%s', '%s', '%s', '%s' ]
        );

        $this->purge_expired();
    }

    /**
     * Retrieve paginated logs.
     */
    public function get_logs( int $page = 1, int $per_page = 20 ): array {
        $this->ensure_table_ready();

        $page     = max( 1, $page );
        $per_page = max( 1, min( 100, $per_page ) );
        $offset   = ( $page - 1 ) * $per_page;

        if ( ! self::$table_exists ) {
            return [
                'items'     => [],
                'total'     => 0,
                'page'      => $page,
                'per_page'  => $per_page,
            ];
        }

        global $wpdb;
        $table = self::get_table_name();

        $items = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT id, session_id, provider, user_message, assistant_message, usage_data, created_at
                 FROM {$table}
                 ORDER BY created_at DESC
                 LIMIT %d OFFSET %d",
                $per_page,
                $offset
            ),
            ARRAY_A
        );

        $total = (int) $wpdb->get_var( "SELECT COUNT(1) FROM {$table}" );

        foreach ( $items as &$item ) {
            $item['usage_data'] = $this->decode_usage( $item['usage_data'] ?? '' );
        }

        return [
            'items'     => $items,
            'total'     => $total,
            'page'      => $page,
            'per_page'  => $per_page,
        ];
    }

    /**
     * Get all logs for a specific session.
     */
    public function get_logs_by_session( string $session_id ): array {
        $this->ensure_table_ready();

        if ( ! self::$table_exists || empty( $session_id ) ) {
            return [];
        }

        global $wpdb;
        $table = self::get_table_name();

        $items = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT id, session_id, provider, user_message, assistant_message, usage_data, created_at
                 FROM {$table}
                 WHERE session_id = %s
                 ORDER BY created_at ASC",
                $session_id
            ),
            ARRAY_A
        );

        foreach ( $items as &$item ) {
            $item['usage_data'] = $this->decode_usage( $item['usage_data'] ?? '' );
        }

        return $items;
    }

    /**
     * Get session summary (grouped by session_id).
     */
    public function get_session_summary( int $page = 1, int $per_page = 20 ): array {
        $this->ensure_table_ready();

        $page     = max( 1, $page );
        $per_page = max( 1, min( 100, $per_page ) );
        $offset   = ( $page - 1 ) * $per_page;

        if ( ! self::$table_exists ) {
            return [
                'items'       => [],
                'total'       => 0,
                'page'        => $page,
                'per_page'    => $per_page,
                'total_pages' => 0,
            ];
        }

        global $wpdb;
        $table = self::get_table_name();

        // Her oturumun özeti
        $sessions = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT session_id,
                        provider,
                        COUNT(*) as message_count,
                        MIN(created_at) as first_message,
                        MAX(created_at) as last_message
                 FROM {$table}
                 GROUP BY session_id
                 ORDER BY last_message DESC
                 LIMIT %d OFFSET %d",
                $per_page,
                $offset
            ),
            ARRAY_A
        );

        $total = (int) $wpdb->get_var(
            "SELECT COUNT(DISTINCT session_id) FROM {$table}"
        );

        $total_pages = $per_page > 0 ? (int) ceil( $total / $per_page ) : 0;

        return [
            'items'       => $sessions,
            'total'       => $total,
            'page'        => $page,
            'per_page'    => $per_page,
            'total_pages' => $total_pages,
        ];
    }

    /**
     * Determine whether logging is enabled.
     */
    public function is_enabled(): bool {
        $settings = $this->settings_repository->get_settings();

        return ! empty( $settings['logging']['enabled'] );
    }

    /**
     * Return retention window in days.
     */
    public function get_retention_days(): int {
        $settings = $this->settings_repository->get_settings();
        $days     = isset( $settings['logging']['retention_days'] ) ? (int) $settings['logging']['retention_days'] : 30;

        return max( 1, $days );
    }

    /**
     * Remove rows older than retention window.
     */
    public function purge_expired(): void {
        if ( ! $this->is_enabled() ) {
            return;
        }

        $days = $this->get_retention_days();
        $this->ensure_table_ready();

        if ( ! self::$table_exists ) {
            return;
        }

        $threshold = gmdate( 'Y-m-d H:i:s', time() - ( $days * DAY_IN_SECONDS ) );

        global $wpdb;
        $wpdb->query( $wpdb->prepare( 'DELETE FROM ' . self::get_table_name() . ' WHERE created_at < %s', $threshold ) );
    }

    /**
     * Ensure table is ready for operations.
     */
    private function ensure_table_ready(): void {
        if ( null !== self::$table_exists ) {
            return;
        }

        global $wpdb;
        $table   = self::get_table_name();
        $results = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );

        if ( $results === $table ) {
            self::$table_exists = true;
            return;
        }

        self::install();
    }

    /**
     * Extract last user-authored message.
     */
    private function extract_last_user_message( array $messages ): string {
        for ( $index = count( $messages ) - 1; $index >= 0; $index-- ) {
            $message = $messages[ $index ];

            if ( ! is_array( $message ) ) {
                continue;
            }

            $role = isset( $message['role'] ) ? sanitize_key( $message['role'] ) : '';
            if ( 'user' !== $role ) {
                continue;
            }

            $content = $this->sanitize_message( $message['content'] ?? '' );
            if ( '' === $content ) {
                continue;
            }

            return $content;
        }

        return '';
    }

    /**
     * Normalise and clean message content.
     */
    private function sanitize_message( $content ): string {
        if ( is_array( $content ) || is_object( $content ) ) {
            $content = wp_json_encode( $content );
        }

        $content = wp_kses_post( (string) $content );
        $content = trim( $content );

        return $content;
    }

    /**
     * Decode usage payload.
     */
    private function decode_usage( string $usage ): array {
        if ( '' === $usage ) {
            return [];
        }

        $decoded = json_decode( $usage, true );

        return is_array( $decoded ) ? $decoded : [];
    }
}
