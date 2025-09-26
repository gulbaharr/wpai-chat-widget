<?php
/**
 * REST controller handling chat interactions.
 */

namespace Wpai\Chat\Rest;

use Wpai\Chat\Providers\ProviderException;
use Wpai\Chat\Providers\ProviderManager;
use Wpai\Chat\SettingsRepository;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ChatController {
    /**
     * REST namespace.
     */
    private const REST_NAMESPACE = 'wpai/v1';

    /**
     * Settings repository reference.
     *
     * @var SettingsRepository
     */
    private $settings_repository;

    /**
     * Provider manager reference.
     *
     * @var ProviderManager
     */
    private $provider_manager;

    /**
     * Constructor.
     */
    public function __construct( SettingsRepository $settings_repository, ProviderManager $provider_manager ) {
        $this->settings_repository = $settings_repository;
        $this->provider_manager    = $provider_manager;
    }

    /**
     * Register REST routes.
     */
    public function register_routes(): void {
        register_rest_route(
            self::REST_NAMESPACE,
            '/session',
            [
                [
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => [ $this, 'create_session' ],
                    'permission_callback' => [ $this, 'validate_public_request' ],
                ],
            ]
        );

        register_rest_route(
            self::REST_NAMESPACE,
            '/session/(?P<id>[\w-]+)',
            [
                [
                    'methods'             => WP_REST_Server::DELETABLE,
                    'callback'            => [ $this, 'delete_session' ],
                    'permission_callback' => [ $this, 'validate_public_request' ],
                    'args'                => [
                        'id' => [
                            'required' => true,
                            'type'     => 'string',
                        ],
                    ],
                ],
            ]
        );

        register_rest_route(
            self::REST_NAMESPACE,
            '/chat',
            [
                [
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => [ $this, 'send_message' ],
                    'permission_callback' => [ $this, 'validate_public_request' ],
                ],
            ]
        );
    }

    /**
     * Create a chat session.
     */
    public function create_session( WP_REST_Request $request ) {
        $consent = (bool) $request->get_param( 'consent' );

        $session = [
            'session_id' => wp_generate_uuid4(),
            'expires_at' => time() + (int) apply_filters( 'wpai_chat_session_ttl', 3600 ),
            'consent'    => $consent,
        ];

        do_action( 'wpai_chat_session_created', $session, $request );

        return new WP_REST_Response( $session, 201 );
    }

    /**
     * Handle chat message exchange.
     */
    public function send_message( WP_REST_Request $request ) {
        $session_id = sanitize_text_field( (string) $request->get_param( 'session_id' ) );
        $messages   = $request->get_param( 'messages' );

        if ( empty( $session_id ) ) {
            return new WP_Error( 'wpai_missing_session', __( 'Session kimligi gerekli.', 'wpai-chat' ), [ 'status' => 400 ] );
        }

        if ( ! is_array( $messages ) ) {
            return new WP_Error( 'wpai_invalid_payload', __( 'Gecersiz istek govdesi.', 'wpai-chat' ), [ 'status' => 400 ] );
        }

        $settings      = $this->settings_repository->get_settings();
        $context       = $this->build_context( $settings );
        $prepared      = $this->prepare_messages( $messages, $settings['persona'] ?? [], $context['behavior'] ?? [] );
        $provider_slug = $this->resolve_provider_slug( $request );

        try {
            $adapter = $this->provider_manager->resolve( $provider_slug );
            $result  = $adapter->generate_reply( $prepared, $context );
        } catch ( ProviderException $exception ) {
            $status = $exception->getCode() ?: 500;

            return new WP_Error( 'wpai_provider_error', $exception->getMessage(), [ 'status' => $status ] );
        }

        $assistant_message = $result['assistant_message'] ?? [];
        if ( empty( $assistant_message ) ) {
            return new WP_Error( 'wpai_empty_reply', __( 'Saglayici bir yanit dondurmedi.', 'wpai-chat' ), [ 'status' => 502 ] );
        }

        $conversation = array_merge( $prepared, [ $assistant_message ] );

        $response = [
            'messages'          => $conversation,
            'assistant_message' => $assistant_message,
            'usage'             => $result['usage'] ?? [],
            'provider'          => $provider_slug,
            'session_id'        => $session_id,
        ];

        $response = apply_filters( 'wpai_chat_response', $response, $request, $result );

        do_action( 'wpai_chat_message_processed', $response, $request );

        return new WP_REST_Response( $response, 200 );
    }

    /**
     * Delete session placeholder.
     */
    public function delete_session( WP_REST_Request $request ) {
        $session_id = sanitize_text_field( (string) $request->get_param( 'id' ) );

        do_action( 'wpai_chat_session_deleted', $session_id );

        return new WP_REST_Response( [ 'session_id' => $session_id, 'deleted' => true ] );
    }

    /**
     * Validate public requests using nonce & rate limit stubs.
     */
    public function validate_public_request() {
        $nonce = isset( $_SERVER['HTTP_X_WP_NONCE'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_WP_NONCE'] ) ) : '';

        if ( empty( $nonce ) || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
            return new WP_Error( 'wpai_invalid_nonce', __( 'Gecersiz guvenlik dogrulamasi.', 'wpai-chat' ), [ 'status' => 403 ] );
        }

        $allowed = apply_filters( 'wpai_chat_validate_public_request', true, $nonce );

        if ( ! $allowed ) {
            return new WP_Error( 'wpai_rate_limited', __( 'Cok fazla istek gonderildi, lutfen kisa bir sure sonra tekrar deneyin.', 'wpai-chat' ), [ 'status' => 429 ] );
        }

        return true;
    }

    /**
     * Resolve provider slug using request override when allowed.
     */
    private function resolve_provider_slug( WP_REST_Request $request ): string {
        $active          = $this->settings_repository->get_active_provider_slug();
        $requested       = sanitize_key( (string) $request->get_param( 'provider' ) );
        $has_request     = ! empty( $requested );
        $has_configuration = $has_request ? $this->settings_repository->get_provider_settings( $requested ) : [];
        $allow_override  = apply_filters( 'wpai_chat_allow_provider_override', true, $requested, $request );

        if ( $has_request && ! empty( $has_configuration ) && $allow_override ) {
            return $requested;
        }

        return $active ?: 'openai';
    }

    /**
     * Prepare messages by injecting persona prompt and sanitizing user input.
     */
    private function prepare_messages( array $messages, array $persona, array $behavior ): array {
        $prepared = [];

        $system_prompt = trim( (string) ( $persona['system_prompt'] ?? '' ) );
        if ( '' !== $system_prompt ) {
            $label = sanitize_text_field( $persona['persona_label'] ?? '' );
            if ( '' !== $label ) {
                $system_prompt = sprintf( '%s: %s', $label, $system_prompt );
            }

            $prepared[] = [
                'role'    => 'system',
                'content' => wp_kses_post( $system_prompt ),
            ];
        }

        $initial_messages = $persona['initial_messages'] ?? [];
        if ( is_array( $initial_messages ) ) {
            foreach ( $initial_messages as $initial_message ) {
                $text = trim( (string) $initial_message );
                if ( '' === $text ) {
                    continue;
                }

                $prepared[] = [
                    'role'    => 'assistant',
                    'content' => wp_kses_post( $text ),
                ];
            }
        }

        foreach ( $messages as $message ) {
            if ( ! is_array( $message ) ) {
                continue;
            }

            $role = isset( $message['role'] ) ? sanitize_key( $message['role'] ) : 'user';
            if ( ! in_array( $role, [ 'system', 'user', 'assistant' ], true ) ) {
                $role = 'user';
            }

            $content = isset( $message['content'] ) ? $message['content'] : '';
            if ( is_array( $content ) ) {
                $content = wp_json_encode( $content );
            }

            $content = (string) apply_filters( 'wpai_chat_message_content', (string) $content, $role, $message );

            if ( '' === trim( $content ) ) {
                continue;
            }

            $prepared[] = [
                'role'    => $role,
                'content' => wp_kses_post( $content ),
            ];
        }

        $limit = isset( $behavior['message_limit'] ) ? (int) $behavior['message_limit'] : 0;
        if ( $limit > 0 && count( $prepared ) > $limit ) {
            $prepared = array_slice( $prepared, -1 * $limit );
        }

        return apply_filters( 'wpai_chat_prepared_messages', $prepared, $messages, $persona, $behavior );
    }

    /**
     * Build provider context data.
     */
    private function build_context( array $settings ): array {
        $context = [
            'behavior' => $settings['behavior'] ?? [],
            'general'  => $settings['general'] ?? [],
            'persona'  => $settings['persona'] ?? [],
            'provider' => $settings['provider'] ?? [],
        ];

        return apply_filters( 'wpai_chat_context', $context, $settings );
    }
}




