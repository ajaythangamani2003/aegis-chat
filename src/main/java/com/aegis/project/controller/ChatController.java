package com.aegis.project.controller;

import com.aegis.project.model.Message;
import com.aegis.project.model.User;
import com.aegis.project.repository.MessageRepository;
import com.aegis.project.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.LocalDateTime;
import java.util.List;

@Controller
public class ChatController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MessageRepository messageRepository;

    // 🔥 1️⃣ SEND MESSAGE (PRIVATE CHAT + BLOCK CHECK)
    @MessageMapping("/send")
    public void sendMessage(Message message) {

        User sender = userRepository.findByUsername(message.getSender()).orElse(null);

        if (sender != null && Boolean.TRUE.equals(sender.getBlocked())) {
            System.out.println("Blocked user ❌");
            return;
        }

        message.setTimestamp(LocalDateTime.now());

        // 🔥 FIX (THIS WAS MISSING)
        message.setIsRead(false);

        // 🔥 BROADCAST
        if ("ALL".equalsIgnoreCase(message.getReceiver())) {

            List<User> users = userRepository.findAll();

            for (User u : users) {

                if (u.getUsername().equals(message.getSender())) continue;

                Message copy = new Message();
                copy.setSender(message.getSender());
                copy.setReceiver(u.getUsername());
                copy.setContent(message.getContent());
                copy.setTimestamp(LocalDateTime.now());

                // 🔥 ALSO ADD HERE
                copy.setIsRead(false);

                messagingTemplate.convertAndSend(
                        "/topic/private/" + u.getUsername(),
                        copy
                );

                messageRepository.save(copy);
            }

            return;
        }

        // ✅ send to receiver
        messagingTemplate.convertAndSend(
                "/topic/private/" + message.getReceiver(),
                message
        );

        // ✅ send back to sender
        messagingTemplate.convertAndSend(
                "/topic/private/" + message.getSender(),
                message
        );

        // 🔥 SAVE
        messageRepository.save(message);
    }

    // 🔥 3️⃣ TYPING INDICATOR
    @MessageMapping("/typing")
    public void typing(Message message) {

        messagingTemplate.convertAndSend(
                "/topic/typing/" + message.getReceiver(),
                message.getSender()
        );
    }

    // 🔥 4️⃣ SEEN ✔✔
    @MessageMapping("/seen")
    public void seen(Message message) {

        messagingTemplate.convertAndSend(
                "/topic/seen/" + message.getSender(),
                message.getReceiver()
        );
    }
}