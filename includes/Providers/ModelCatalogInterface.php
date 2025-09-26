<?php
/**
 * Interface for providers that expose a model catalog.
 */

namespace Wpai\Chat\Providers;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

interface ModelCatalogInterface {
    /**
     * Return available models for this provider.
     *
     * @return array<int, array<string, mixed>>
     */
    public function list_models(): array;
}



