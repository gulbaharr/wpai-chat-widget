<?php
/**
 * Base interface for AI provider implementations.
 */

namespace Wpai\Chat\Providers;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

interface ProviderInterface {
    /**
     * Generate a reply from the provider.
     *
     * @param array $messages Conversation messages ready for the provider.
     * @param array $context  Additional context such as behavior or metadata.
     *
     * @return array
     */
    public function generate_reply( array $messages, array $context = [] ): array;
}



