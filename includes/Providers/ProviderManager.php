<?php
/**
 * Resolves provider adapters based on settings.
 */

namespace Wpai\Chat\Providers;

use Wpai\Chat\SettingsRepository;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ProviderManager {
    /**
     * Settings repository instance.
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
     * Resolve provider adapter for the given slug.
     *
     * @param string $provider_slug Provider key.
     *
     * @throws ProviderException When provider cannot be resolved.
     */
    public function resolve( string $provider_slug ): ProviderInterface {
        $provider_slug = sanitize_key( $provider_slug );

        /**
         * Allow third parties to supply custom providers.
         */
        $custom = apply_filters( 'wpai_chat_provider_adapter', null, $provider_slug, $this->settings_repository );
        if ( $custom instanceof ProviderInterface ) {
            return $custom;
        }

        $config = $this->settings_repository->get_provider_settings( $provider_slug );

        switch ( $provider_slug ) {
            case 'openai':
                return new OpenAIAdapter( $config );
            case 'gemini':
                return new GeminiAdapter( $config );
            case 'groq':
                return new GroqAdapter( $config );
            case 'openrouter':
                return new OpenRouterAdapter( $config );
        }

        throw new ProviderException( sprintf( __( 'Desteklenmeyen saglayici: %s', 'wpai-chat' ), $provider_slug ), 400 );
    }

    /**
     * Return model catalog for provider.
     */
    public function list_models( string $provider_slug ): array {
        $adapter = $this->resolve( $provider_slug );

        if ( ! $adapter instanceof ModelCatalogInterface ) {
            throw new ProviderException( sprintf( __( 'Saglayici icin model listesi desteklenmiyor: %s', 'wpai-chat' ), sanitize_key( $provider_slug ) ), 400 );
        }

        return $adapter->list_models();
    }
}



