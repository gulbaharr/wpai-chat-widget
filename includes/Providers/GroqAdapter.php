<?php
/**
 * Groq adapter implementation using OpenAI-compatible API.
 */

namespace Wpai\Chat\Providers;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class GroqAdapter implements ProviderInterface, ModelCatalogInterface {
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
     * Base URL for Groq endpoint.
     *
     * @var string
     */
    private $base_url;

    /**
     * Constructor.
     */
    public function __construct( array $config ) {
        $this->api_key  = $config['api_key'] ?? '';
        $this->model    = $config['model'] ?? 'llama3-8b-8192';
        $this->base_url = isset( $config['base_url'] ) ? untrailingslashit( $config['base_url'] ) : 'https://api.groq.com/openai/v1';
        if ( '' === $this->base_url ) {
            $this->base_url = 'https://api.groq.com/openai/v1';
        }
    }

    /**
     * {@inheritdoc}
     */
    public function generate_reply( array $messages, array $context = [] ): array {
        if ( empty( $this->api_key ) ) {
            throw new ProviderException( __( 'Groq API anahtari tanimli degil.', 'wpai-chat' ), 400 );
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
            'headers' => [
                'Authorization' => 'Bearer ' . $this->api_key,
                'Content-Type'  => 'application/json',
            ],
            'body'    => wp_json_encode( apply_filters( 'wpai_chat_groq_payload', $payload, $context ) ),
            'timeout' => apply_filters( 'wpai_chat_groq_timeout', 30, $payload, $context ),
        ];

        $endpoint = $this->base_url . '/chat/completions';
        $response = wp_remote_post( $endpoint, $args );

        if ( is_wp_error( $response ) ) {
            throw new ProviderException( $response->get_error_message(), 500 );
        }

        $status_code = (int) wp_remote_retrieve_response_code( $response );
        $body        = wp_remote_retrieve_body( $response );
        $data        = json_decode( $body, true );

        if ( $status_code >= 400 ) {
            $message = isset( $data['error']['message'] ) ? (string) $data['error']['message'] : __( 'Groq istegi basarisiz oldu.', 'wpai-chat' );
            throw new ProviderException( $message, $status_code );
        }

        $assistant_message = $data['choices'][0]['message'] ?? [];
        if ( empty( $assistant_message['content'] ) ) {
            throw new ProviderException( __( 'Groq gecerli bir yanit dondurmedi.', 'wpai-chat' ), 500 );
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
            throw new ProviderException( __( 'Groq API anahtari tanimli degil.', 'wpai-chat' ), 400 );
        }

        $endpoint = $this->base_url . '/models';
        $args     = [
            'headers' => [
                'Authorization' => 'Bearer ' . $this->api_key,
                'Content-Type'  => 'application/json',
            ],
            'timeout' => apply_filters( 'wpai_chat_groq_models_timeout', 15 ),
        ];

        $response = wp_remote_get( $endpoint, $args );

        if ( is_wp_error( $response ) ) {
            throw new ProviderException( $response->get_error_message(), 500 );
        }

        $status_code = (int) wp_remote_retrieve_response_code( $response );
        $body        = wp_remote_retrieve_body( $response );
        $data        = json_decode( $body, true );

        if ( $status_code >= 400 ) {
            $message = isset( $data['error']['message'] ) ? (string) $data['error']['message'] : __( 'Groq modelleri alinamadi.', 'wpai-chat' );
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



