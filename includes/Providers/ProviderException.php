<?php
/**
 * Exception type for provider errors.
 */

namespace Wpai\Chat\Providers;

use RuntimeException;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ProviderException extends RuntimeException {
}



