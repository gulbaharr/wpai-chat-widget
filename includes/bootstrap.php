<?php
/**
 * Bootstrap for WpAI Chat Widget plugin.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/Autoloader.php';

Wpai\Chat\Autoloader::register();

add_action( 'plugins_loaded', [ Wpai\Chat\Plugin::class, 'init' ] );



