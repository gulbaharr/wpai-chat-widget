<?php
/**
 * Google Gemini adapter implementation.
 */

namespace Wpai\Chat\Providers;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class GeminiAdapter implements ProviderInterface, ModelCatalogInterface {
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
     * Endpoint base URL.
     *
     * @var string
     */
    private $endpoint;

    /**
     * Constructor.
     */
    public function __construct( array $config ) {
        $this->api_key  = $config['api_key'] ?? '';
        $this->model    = $config['model'] ?? 'gemini-pro';
        $this->endpoint = isset( $config['endpoint'] ) ? untrailingslashit( $config['endpoint'] ) : 'https://generativelanguage.googleapis.com/v1beta/models';
        if ( '' === $this->endpoint ) {
            $this->endpoint = 'https://generativelanguage.googleapis.com/v1beta/models';
        }
    }

    /**
     * {@inheritdoc}
     */
    public function generate_reply( array $messages, array $context = [] ): array {
        if ( empty( $this->api_key ) ) {
            throw new ProviderException( __( 'Gemini API anahtari tanimli degil.', 'wpai-chat' ), 400 );
        }

        $payload = $this->build_payload( $messages, $context );
        $endpoint = $this->endpoint . '/' . rawurlencode( $this->model ) . ':generateContent?key=' . rawurlencode( $this->api_key );

        $args = [
            'headers' => [
                'Content-Type' => 'application/json',
            ],
            'body'    => wp_json_encode( $payload ),
            'timeout' => apply_filters( 'wpai_chat_gemini_timeout', 30, $payload, $context ),
        ];

        $response = wp_remote_post( $endpoint, $args );

        if ( is_wp_error( $response ) ) {
            throw new ProviderException( $response->get_error_message(), 500 );
        }

        $status_code = (int) wp_remote_retrieve_response_code( $response );
        $body        = wp_remote_retrieve_body( $response );
        $data        = json_decode( $body, true );

        if ( $status_code >= 400 ) {
            $message = isset( $data['error']['message'] ) ? (string) $data['error']['message'] : __( 'Gemini istegi basarisiz oldu.', 'wpai-chat' );
            throw new ProviderException( $message, $status_code );
        }

        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
        if ( '' === trim( (string) $text ) ) {
            throw new ProviderException( __( 'Gemini gecerli bir yanit dondurmedi.', 'wpai-chat' ), 500 );
        }

        $usage = [];
        if ( isset( $data['usageMetadata'] ) && is_array( $data['usageMetadata'] ) ) {
            $usage = [
                'prompt_tokens'     => $data['usageMetadata']['promptTokenCount'] ?? 0,
                'completion_tokens' => $data['usageMetadata']['candidatesTokenCount'] ?? 0,
                'total_tokens'      => $data['usageMetadata']['totalTokenCount'] ?? 0,
            ];
        }

        return [
            'assistant_message' => [
                'role'    => 'assistant',
                'content' => (string) $text,
            ],
            'usage'             => $usage,
            'raw'               => $data,
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function list_models(): array {
        if ( empty( $this->api_key ) ) {
            throw new ProviderException( __( 'Gemini API anahtari tanimli degil.', 'wpai-chat' ), 400 );
        }

        $endpoint = $this->endpoint . '?key=' . rawurlencode( $this->api_key );
        $args     = [
            'headers' => [
                'Content-Type' => 'application/json',
            ],
            'timeout' => apply_filters( 'wpai_chat_gemini_models_timeout', 15 ),
        ];

        $response = wp_remote_get( $endpoint, $args );

        if ( is_wp_error( $response ) ) {
            throw new ProviderException( $response->get_error_message(), 500 );
        }

        $status_code = (int) wp_remote_retrieve_response_code( $response );
        $body        = wp_remote_retrieve_body( $response );
        $data        = json_decode( $body, true );

        if ( $status_code >= 400 ) {
            $message = isset( $data['error']['message'] ) ? (string) $data['error']['message'] : __( 'Gemini modelleri alinamadi.', 'wpai-chat' );
            throw new ProviderException( $message, $status_code );
        }

        $models = [];
        if ( isset( $data['models'] ) && is_array( $data['models'] ) ) {
            foreach ( $data['models'] as $item ) {
                if ( empty( $item['name'] ) ) {
                    continue;
                }

                $models[] = [
                    'id'          => (string) $item['name'],
                    'name'        => (string) $item['displayName'] ?? (string) $item['name'],
                    'description' => isset( $item['description'] ) ? (string) $item['description'] : '',
                ];
            }
        }

        return $models;
    }

    /**
     * Build request payload for Gemini.
     */
    private function build_payload( array $messages, array $context ): array {
        $system_instruction = null;
        $contents           = [];

        foreach ( $messages as $message ) {
            if ( ! is_array( $message ) || empty( $message['content'] ) ) {
                continue;
            }

            $role    = isset( $message['role'] ) ? $message['role'] : 'user';
            $content = (string) $message['content'];

            if ( 'system' === $role ) {
                $system_instruction = $system_instruction ? $system_instruction . "\n" . $content : $content;
                continue;
            }

            $mapped_role = 'user';
            if ( 'assistant' === $role ) {
                $mapped_role = 'model';
            }

            $contents[] = [
                'role'  => $mapped_role,
                'parts' => [
                    [ 'text' => $content ],
                ],
            ];
        }

        $payload = [
            'contents' => $contents,
        ];

        if ( $system_instruction ) {
            $payload['system_instruction'] = [
                'parts' => [
                    [ 'text' => $system_instruction ],
                ],
            ];
        }

        $temperature = isset( $context['behavior']['temperature'] ) ? (float) $context['behavior']['temperature'] : 0.7;
        $payload['generationConfig'] = [
            'temperature' => $temperature,
        ];

        if ( isset( $context['behavior']['max_tokens'] ) ) {
            $payload['generationConfig']['maxOutputTokens'] = max( 1, (int) $context['behavior']['max_tokens'] );
        }

        return apply_filters( 'wpai_chat_gemini_payload', $payload, $messages, $context );
    }
}





