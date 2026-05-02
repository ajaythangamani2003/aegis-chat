package com.aegis.project.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    // 🔥 Endpoint for frontend connection
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/chat")
                .setAllowedOriginPatterns("*")   // allow all origins (dev use)
                .withSockJS();                  // fallback support
    }

    // 🔥 Message routing config
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {

        // 👇 Broker (frontend subscribe pannum)
        config.enableSimpleBroker("/topic");

        // 👇 App destination (frontend send pannum)
        config.setApplicationDestinationPrefixes("/app");
    }
}