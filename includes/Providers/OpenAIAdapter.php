<?php
/**
 * OpenAI chat completions adapter.
 */

namespace Wpai\Chat\Providers;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class OpenAIAdapter implements ProviderInterface, ModelCatalogInterface {
    /**
     * API base URL.
     *
     * @var string
     */
    private $base_url;

    /**
     * API key.
     *
     * @var string
     */
    private $api_key;

    /**
     * Organization identifier.
     *
     * @var string
     */
    private $organization;

    /**
     * Model identifier.
     *
     * @var string
     */
    private $model;

    /**
     * Create adapter instance.
     */
    public function __construct( array $config ) {
        $this->base_url     = isset( $config['base_url'] ) ? untrailingslashit( $config['base_url'] ) : 'https://api.openai.com/v1';
        if ( '' === $this->base_url ) {
            $this->base_url = 'https://api.openai.com/v1';
        }

        $this->api_key      = $config['api_key'] ?? '';
        $this->organization = $config['organization'] ?? '';
        $this->model        = $config['model'] ?? 'gpt-3.5-turbo';
    }

    /**
     * {@inheritdoc}
     */
    public function generate_reply( array $messages, array $context = [] ): array {
        if ( empty( $this->api_key ) ) {
            throw new ProviderException( __( 'OpenAI API anahtari tanimli degil.', 'wpai-chat' ), 400 );
        }

        $payload = [
            'model'       => $this->model,
            'messages'    => $messages,
            'temperature' => isset( $context['behavior']['temperature'] ) ? (float) $context['behavior']['temperature'] : 0.7,
        ];

        if ( isset( $context['behavior']['max_tokens'] ) ) {
            $payload['max_tokens'] = (int) $context['behavior']['max_tokens'];
        }

        $args = [
            'timeout' => apply_filters( 'wpai_chat_openai_timeout', 30, $payload, $context ),
            'headers' => [
                'Authorization' => 'Bearer ' . $this->api_key,
                'Content-Type'  => 'application/json',
            ],
            'body'    => wp_json_encode( apply_filters( 'wpai_chat_openai_payload', $payload, $context ) ),
        ];

        if ( ! empty( $this->organization ) ) {
            $args['headers']['OpenAI-Organization'] = $this->organization;
        }

        $endpoint = trailingslashit( $this->base_url ) . 'chat/completions';
        $response = wp_remote_post( $endpoint, $args );

        if ( is_wp_error( $response ) ) {
            throw new ProviderException( $response->get_error_message(), 500 );
        }

        $status_code = (int) wp_remote_retrieve_response_code( $response );
        $body        = wp_remote_retrieve_body( $response );
        $data        = json_decode( $body, true );

        if ( $status_code >= 400 ) {
            $message = isset( $data['error']['message'] ) ? (string) $data['error']['message'] : __( 'OpenAI istegi basarisiz oldu.', 'wpai-chat' );
            throw new ProviderException( $message, $status_code );
        }

        if ( empty( $data['choices'][0]['message']['content'] ) ) {
            throw new ProviderException( __( 'OpenAI gecerli bir yanit dondurmedi.', 'wpai-chat' ), 500 );
        }

        $assistant_message = [
            'role'    => $data['choices'][0]['message']['role'] ?? 'assistant',
            'content' => (string) $data['choices'][0]['message']['content'],
        ];

        return [
            'assistant_message' => $assistant_message,
            'usage'             => isset( $data['usage'] ) ? $data['usage'] : [],
            'raw'               => $data,
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function list_models(): array {
        if ( empty( $this->api_key ) ) {
            throw new ProviderException( __( 'OpenAI API anahtari tanimli degil.', 'wpai-chat' ), 400 );
        }

        $endpoint = trailingslashit( $this->base_url ) . 'models';
        $args     = [
            'headers' => [
                'Authorization' => 'Bearer ' . $this->api_key,
                'Content-Type'  => 'application/json',
            ],
            'timeout' => apply_filters( 'wpai_chat_openai_models_timeout', 15 ),
        ];

        if ( ! empty( $this->organization ) ) {
            $args['headers']['OpenAI-Organization'] = $this->organization;
        }

        $response = wp_remote_get( $endpoint, $args );

        if ( is_wp_error( $response ) ) {
            throw new ProviderException( $response->get_error_message(), 500 );
        }

        $status_code = (int) wp_remote_retrieve_response_code( $response );
        $body        = wp_remote_retrieve_body( $response );
        $data        = json_decode( $body, true );

        if ( $status_code >= 400 ) {
            $message = isset( $data['error']['message'] ) ? (string) $data['error']['message'] : __( 'OpenAI modelleri alinamadi.', 'wpai-chat' );
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
                    'description' => isset( $item['owned_by'] ) ? (string) $item['owned_by'] : '',
                ];
            }
        }

        return $models;
    }
}



