<?php namespace Wpai\Chat;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Analytics repository for chat data and insights.
 */
class AnalyticsRepository {
    /**
     * Analytics table name.
     */
    private const TABLE_NAME = 'wpai_chat_analytics';

    /**
     * Get chat analytics data.
     */
    public function get_analytics( array $filters = [] ): array {
        global $wpdb;

        $table_name = $wpdb->prefix . self::TABLE_NAME;

        // Default date range (last 30 days)
        $start_date = $filters['start_date'] ?? date( 'Y-m-d', strtotime( '-30 days' ) );
        $end_date   = $filters['end_date'] ?? date( 'Y-m-d' );

        // Build base query
        $query = $wpdb->prepare(
            "SELECT
                DATE(created_at) as date,
                COUNT(*) as total_sessions,
                COUNT(DISTINCT user_ip) as unique_users,
                AVG(messages_count) as avg_messages_per_session,
                AVG(session_duration) as avg_session_duration,
                SUM(total_tokens) as total_tokens_used,
                AVG(user_satisfaction) as avg_satisfaction
            FROM {$table_name}
            WHERE DATE(created_at) BETWEEN %s AND %s",
            $start_date,
            $end_date
        );

        // Add provider filter
        if ( ! empty( $filters['provider'] ) ) {
            $query .= $wpdb->prepare( " AND provider_slug = %s", $filters['provider'] );
        }

        // Add persona filter
        if ( ! empty( $filters['persona'] ) ) {
            $query .= $wpdb->prepare( " AND persona_used LIKE %s", '%' . $wpdb->esc_like( $filters['persona'] ) . '%' );
        }

        $query .= " GROUP BY DATE(created_at) ORDER BY date DESC";

        $daily_stats = $wpdb->get_results( $query, ARRAY_A );

        // Get overall stats
        $overall_query = $wpdb->prepare(
            "SELECT
                COUNT(*) as total_sessions,
                COUNT(DISTINCT user_ip) as total_unique_users,
                AVG(messages_count) as overall_avg_messages,
                AVG(session_duration) as overall_avg_duration,
                SUM(total_tokens) as total_tokens_all_time,
                AVG(user_satisfaction) as overall_satisfaction,
                COUNT(CASE WHEN conversion_happened = 1 THEN 1 END) as conversions,
                COUNT(CASE WHEN user_feedback IS NOT NULL THEN 1 END) as feedback_count
            FROM {$table_name}
            WHERE DATE(created_at) BETWEEN %s AND %s",
            $start_date,
            $end_date
        );

        $overall_stats = $wpdb->get_row( $overall_query, ARRAY_A );

        // Get top performing content
        $top_content = $this->get_top_performing_content( $start_date, $end_date );

        // Get user satisfaction distribution
        $satisfaction_dist = $this->get_satisfaction_distribution( $start_date, $end_date );

        // Get popular conversation topics
        $popular_topics = $this->get_popular_topics( $start_date, $end_date );

        return [
            'daily_stats'         => $daily_stats,
            'overall_stats'       => $overall_stats,
            'top_content'         => $top_content,
            'satisfaction_dist'   => $satisfaction_dist,
            'popular_topics'      => $popular_topics,
            'date_range'          => [
                'start' => $start_date,
                'end'   => $end_date,
            ],
            'filters_applied'     => $filters,
        ];
    }

    /**
     * Get top performing content/questions.
     */
    private function get_top_performing_content( string $start_date, string $end_date ): array {
        global $wpdb;

        $table_name = $wpdb->prefix . self::TABLE_NAME;

        $query = $wpdb->prepare(
            "SELECT
                initial_question,
                COUNT(*) as frequency,
                AVG(user_satisfaction) as avg_satisfaction,
                AVG(session_duration) as avg_duration
            FROM {$table_name}
            WHERE DATE(created_at) BETWEEN %s AND %s
            AND initial_question IS NOT NULL
            AND initial_question != ''
            GROUP BY initial_question
            ORDER BY frequency DESC, avg_satisfaction DESC
            LIMIT 10",
            $start_date,
            $end_date
        );

        return $wpdb->get_results( $query, ARRAY_A );
    }

    /**
     * Get user satisfaction distribution.
     */
    private function get_satisfaction_distribution( string $start_date, string $end_date ): array {
        global $wpdb;

        $table_name = $wpdb->prefix . self::TABLE_NAME;

        $query = $wpdb->prepare(
            "SELECT
                ROUND(user_satisfaction) as rating,
                COUNT(*) as count
            FROM {$table_name}
            WHERE DATE(created_at) BETWEEN %s AND %s
            AND user_satisfaction IS NOT NULL
            GROUP BY ROUND(user_satisfaction)
            ORDER BY rating",
            $start_date,
            $end_date
        );

        $results = $wpdb->get_results( $query, ARRAY_A );

        // Create distribution array (1-5 stars)
        $distribution = [];
        for ( $i = 1; $i <= 5; $i++ ) {
            $distribution[ $i ] = 0;
        }

        foreach ( $results as $result ) {
            $rating = (int) $result['rating'];
            if ( $rating >= 1 && $rating <= 5 ) {
                $distribution[ $rating ] = (int) $result['count'];
            }
        }

        return $distribution;
    }

    /**
     * Get popular conversation topics.
     */
    private function get_popular_topics( string $start_date, string $end_date ): array {
        global $wpdb;

        $table_name = $wpdb->prefix . self::TABLE_NAME;

        $query = $wpdb->prepare(
            "SELECT
                conversation_topics,
                COUNT(*) as frequency
            FROM {$table_name}
            WHERE DATE(created_at) BETWEEN %s AND %s
            AND conversation_topics IS NOT NULL
            GROUP BY conversation_topics
            ORDER BY frequency DESC
            LIMIT 10",
            $start_date,
            $end_date
        );

        return $wpdb->get_results( $query, ARRAY_A );
    }

    /**
     * Log analytics data for a chat session.
     */
    public function log_session_analytics( array $session_data ): bool {
        global $wpdb;

        $table_name = $wpdb->prefix . self::TABLE_NAME;

        $data = [
            'session_id'           => $session_data['session_id'] ?? '',
            'user_ip'              => $session_data['user_ip'] ?? '',
            'provider_slug'        => $session_data['provider_slug'] ?? '',
            'persona_used'         => $session_data['persona_used'] ?? '',
            'messages_count'       => $session_data['messages_count'] ?? 0,
            'session_duration'     => $session_data['session_duration'] ?? 0,
            'total_tokens'         => $session_data['total_tokens'] ?? 0,
            'user_satisfaction'    => $session_data['user_satisfaction'] ?? null,
            'conversion_happened'  => $session_data['conversion_happened'] ? 1 : 0,
            'initial_question'     => $session_data['initial_question'] ?? '',
            'conversation_topics'  => $session_data['conversation_topics'] ?? '',
            'user_feedback'        => $session_data['user_feedback'] ?? null,
            'device_type'          => $session_data['device_type'] ?? '',
            'browser_info'         => $session_data['browser_info'] ?? '',
            'referrer_url'         => $session_data['referrer_url'] ?? '',
            'created_at'           => current_time( 'mysql' ),
        ];

        $result = $wpdb->insert( $table_name, $data );

        return $result !== false;
    }

    /**
     * Create analytics table.
     */
    public static function create_table(): void {
        global $wpdb;

        $table_name      = $wpdb->prefix . self::TABLE_NAME;
        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE {$table_name} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            session_id varchar(100) NOT NULL,
            user_ip varchar(45) DEFAULT '',
            provider_slug varchar(50) DEFAULT '',
            persona_used text DEFAULT '',
            messages_count int(11) DEFAULT 0,
            session_duration int(11) DEFAULT 0,
            total_tokens int(11) DEFAULT 0,
            user_satisfaction decimal(2,1) DEFAULT NULL,
            conversion_happened tinyint(1) DEFAULT 0,
            initial_question text DEFAULT '',
            conversation_topics text DEFAULT '',
            user_feedback text DEFAULT NULL,
            device_type varchar(20) DEFAULT '',
            browser_info varchar(255) DEFAULT '',
            referrer_url text DEFAULT '',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY session_id (session_id),
            KEY created_at (created_at),
            KEY provider_slug (provider_slug),
            KEY user_satisfaction (user_satisfaction)
        ) {$charset_collate};";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta( $sql );
    }

    /**
     * Clean up old analytics data.
     */
    public function cleanup_old_data( int $days_to_keep = 90 ): int {
        global $wpdb;

        $table_name = $wpdb->prefix . self::TABLE_NAME;
        $cutoff_date = date( 'Y-m-d H:i:s', strtotime( "-{$days_to_keep} days" ) );

        return $wpdb->query(
            $wpdb->prepare(
                "DELETE FROM {$table_name} WHERE created_at < %s",
                $cutoff_date
            )
        );
    }

    /**
     * Export analytics data.
     */
    public function export_data( array $filters = [] ): array {
        global $wpdb;

        $table_name = $wpdb->prefix . self::TABLE_NAME;

        $start_date = $filters['start_date'] ?? date( 'Y-m-d', strtotime( '-30 days' ) );
        $end_date   = $filters['end_date'] ?? date( 'Y-m-d' );

        $query = $wpdb->prepare(
            "SELECT * FROM {$table_name}
            WHERE DATE(created_at) BETWEEN %s AND %s
            ORDER BY created_at DESC",
            $start_date,
            $end_date
        );

        return $wpdb->get_results( $query, ARRAY_A );
    }
}
