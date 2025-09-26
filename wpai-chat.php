<?php
/**
 * Plugin Name: WpAI Chat Widget
 * Plugin URI:  https://www.linkedin.com/in/besir-gulbahar/
 * Description: Sag alt kosede ozellestirilebilir AI chat widget saglayan WordPress eklentisi.
 * Version:     0.1.0
 * Author:      Besir GULBAHAR
 * Author URI:  https://www.linkedin.com/in/besir-gulbahar/
 * License:     GPLv2 or later
 * Text Domain: wpai-chat
 * Domain Path: /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

if ( ! defined( 'WPAI_CHAT_VERSION' ) ) {
    define( 'WPAI_CHAT_VERSION', '0.1.0' );
}

if ( ! defined( 'WPAI_CHAT_PLUGIN_FILE' ) ) {
    define( 'WPAI_CHAT_PLUGIN_FILE', __FILE__ );
}

$bootstrap_path = __DIR__ . '/includes/bootstrap.php';

if ( ! file_exists( $bootstrap_path ) ) {
    error_log( '[WpAI Chat] Bootstrap file missing: ' . $bootstrap_path );
    return;
}

require_once $bootstrap_path;



