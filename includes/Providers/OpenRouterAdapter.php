<?php
/**
 * OpenRouter adapter implementation.
 */

namespace Wpai\Chat\Providers;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class OpenRouterAdapter implements ProviderInterface, ModelCatalogInterface {
    /**
     * API key value.
     *
     * @var string
     */
    private $api_key;

    /**
     * Model identifier.
     *
     * @var string
     */
    private $model;

    /**
     * Base URL for API calls.
     *
     * @var string
     */
    private $base_url;

    /**
     * Optional fallback model.
     *
     * @var string
     */
    private $fallback_model;

    /**
     * Constructor.
     */
    public function __construct( array $config ) {
        $this->api_key        = $config['api_key'] ?? '';
        $this->model          = $config['model'] ?? 'openrouter/auto';
        $this->base_url       = isset( $config['base_url'] ) ? untrailingslashit( $config['base_url'] ) : 'https://openrouter.ai/api/v1';
        if ( '' === $this->base_url ) {
            $this->base_url = 'https://openrouter.ai/api/v1';
        }
        $this->fallback_model = $config['fallback_model'] ?? '';
    }

    /**
     * {@inheritdoc}
     */
    public function generate_reply( array $messages, array $context = [] ): array {
        if ( empty( $this->api_key ) ) {
            throw new ProviderException( __( 'OpenRouter API anahtari tanimli degil.', 'wpai-chat' ), 400 );
        }

        $payload = [
            'model'       => $this->model,
            'messages'    => $messages,
            'temperature' => isset( $context['behavior']['temperature'] ) ? (float) $context['behavior']['temperature'] : 0.7,
        ];

        if ( isset( $context['behavior']['max_tokens'] ) ) {
            $payload['max_tokens'] = (int) $context['behavior']['max_tokens'];
        }

        if ( ! empty( $this->fallback_model ) ) {
            $payload['fallbacks'] = [ (string) $this->fallback_model ];
        }

        $args = $this->build_request_args( $payload );
        $endpoint = $this->base_url . '/chat/completions';
        $response = wp_remote_post( $endpoint, $args );

        if ( is_wp_error( $response ) ) {
            throw new ProviderException( $response->get_error_message(), 500 );
        }

        $status_code = (int) wp_remote_retrieve_response_code( $response );
        $body        = wp_remote_retrieve_body( $response );
        $data        = json_decode( $body, true );

        if ( $status_code >= 400 ) {
            $message = isset( $data['error']['message'] ) ? (string) $data['error']['message'] : __( 'OpenRouter istegi basarisiz oldu.', 'wpai-chat' );
            throw new ProviderException( $message, $status_code );
        }

        $assistant_message = $data['choices'][0]['message'] ?? [];
        if ( empty( $assistant_message['content'] ) ) {
            throw new ProviderException( __( 'OpenRouter gecerli bir yanit dondurmedi.', 'wpai-chat' ), 500 );
        }

        return [
            'assistant_message' => [
                'role'    => $assistant_message['role'] ?? 'assistant',
                'content' => (string) $assistant_message['content'],
            ],
            'usage'             => $data['usage'] ?? [],
            'raw'               => $data,
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function list_models(): array {
        if ( empty( $this->api_key ) ) {
            throw new ProviderException( __( 'OpenRouter API anahtari tanimli degil.', 'wpai-chat' ), 400 );
        }

        $endpoint = $this->base_url . '/models';
        $args     = $this->build_request_args();
        unset( $args['body'] );

        $response = wp_remote_get( $endpoint, $args );

        if ( is_wp_error( $response ) ) {
            throw new ProviderException( $response->get_error_message(), 500 );
        }

        $status_code = (int) wp_remote_retrieve_response_code( $response );
        $body        = wp_remote_retrieve_body( $response );
        $data        = json_decode( $body, true );

        if ( $status_code >= 400 ) {
            $message = isset( $data['error']['message'] ) ? (string) $data['error']['message'] : __( 'OpenRouter modelleri alinamadi.', 'wpai-chat' );
            throw new ProviderException( $message, $status_code );
        }

        $models = [];
        if ( isset( $data['data'] ) && is_array( $data['data'] ) ) {
            foreach ( $data['data'] as $item ) {
                if ( empty( $item['id'] ) ) {
                    continue;
                }

                $models[] = [
                    'id'          => (string) $item['id'],
                    'name'        => (string) $item['id'],
                    'description' => isset( $item['description'] ) ? (string) $item['description'] : '',
                ];
            }
        }

        return $models;
    }

    /**
     * Build request arguments for OpenRouter HTTP calls.
     */
    private function build_request_args( array $payload = [] ): array {
        $referer = function_exists( 'home_url' ) ? home_url( '/' ) : site_url( '/' );
        $title   = function_exists( 'get_bloginfo' ) ? get_bloginfo( 'name', 'display' ) : 'WordPress';

        $args = [
            'headers' => [
                'Authorization' => 'Bearer ' . $this->api_key,
                'Content-Type'  => 'application/json',
                'HTTP-Referer'  => esc_url_raw( $referer ),
                'X-Title'       => sanitize_text_field( $title ),
            ],
            'timeout' => apply_filters( 'wpai_chat_openrouter_timeout', 30, $payload ),
        ];

        if ( ! empty( $payload ) ) {
            $args['body'] = wp_json_encode( $payload );
        }

        return $args;
    }
}



