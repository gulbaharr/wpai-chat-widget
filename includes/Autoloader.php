<?php
/**
 * Simple PSR-4 autoloader for the plugin classes.
 */

namespace Wpai\Chat;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Autoloader {
    /**
     * Namespace prefix for plugin classes.
     */
    private const PREFIX = 'Wpai\\Chat\\';

    /**
     * Base directory for the namespace prefix.
     *
     * @var string
     */
    private static $base_dir;

    /**
     * Register the autoloader.
     */
    public static function register(): void {
        if ( isset( self::$base_dir ) ) {
            return;
        }

        self::$base_dir = __DIR__ . DIRECTORY_SEPARATOR;

        spl_autoload_register( [ __CLASS__, 'autoload' ] );
    }

    /**
     * Autoload callback.
     *
     * @param string $class Class name.
     */
    private static function autoload( string $class ): void {
        if ( 0 !== strpos( $class, self::PREFIX ) ) {
            return;
        }

        $relative_class = substr( $class, strlen( self::PREFIX ) );
        $relative_path  = str_replace( '\\', DIRECTORY_SEPARATOR, $relative_class ) . '.php';
        $file           = self::$base_dir . $relative_path;

        if ( is_readable( $file ) ) {
            require_once $file;
        }
    }
}



