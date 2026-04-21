package com.aegis.project.service;

import com.aegis.project.model.Message;
import com.aegis.project.repository.MessageRepository;
import com.aegis.project.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class MessageService {

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    public Message sendMessage(Message message) {
        message.setTimestamp(LocalDateTime.now());
        message.setIsRead(false); // 🔥 ADD THIS LINE
        return messageRepository.save(message);
    }

    // 🔥 USER HISTORY
    public List<Message> getAllMessages(String username) {
        return messageRepository.findBySenderOrReceiverOrderByIdAsc(username, username);
    }

    // 🔥 ADMIN ALL
    public List<Message> getAllMessagesForAdmin() {
        return messageRepository.findAll();
    }

    // 🔥 NORMAL USER CHAT LIST
    public List<String> getChatUsers(String username) {
        return messageRepository.findChatUsers(username);
    }

    // 🔥 ADMIN ALL USERS
    public List<String> getAllUsers() {

        return userRepository.findAll()
                .stream()
                .map(user -> user.getUsername())
                .toList();
    }

    public Map<String, Long> getUnreadCounts(String currentUser) {

        List<Object[]> result = messageRepository.countUnreadByReceiver(currentUser);

        Map<String, Long> map = new HashMap<>();

        for (Object[] row : result) {
            String sender = (String) row[0];
            Long count = (Long) row[1];
            map.put(sender, count);
        }

        return map;
    }

    @Transactional
    public void markAsRead(String sender, String receiver) {
        messageRepository.markAsRead(sender, receiver);
    }
}