package com.aegis.project.controller;

import com.aegis.project.dto.ApiResponse;
import com.aegis.project.model.Message;
import com.aegis.project.security.JwtUtil;
import com.aegis.project.service.MessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/message")
public class MessageController {

    @Autowired
    private MessageService messageService;

    @Autowired
    private JwtUtil jwtUtil;

    @PostMapping("/send")
    public Object sendMessage(@RequestBody Message message,
                              @RequestHeader("Authorization") String token) {

        if (message.getContent() == null || message.getContent().isEmpty()) {
            return new ApiResponse("Message cannot be empty", null);
        }

        String username = jwtUtil.extractUsername(token.substring(7));

// ❌ USER → ADMIN BLOCK
        if (!username.equals("admin") && message.getReceiver().equals("admin")) {
            return new ApiResponse("You cannot message admin ❌", null);
        }

        message.setSender(username);

        return new ApiResponse("Message sent successfully", messageService.sendMessage(message));
    }

    @GetMapping("/history")
    public List<Message> getAllMyMessages(@RequestHeader("Authorization") String token) {

        String username = jwtUtil.extractUsername(token.substring(7));

        return messageService.getAllMessages(username);
    }

    @GetMapping("/admin/all")
    public Object getAllMessages(@RequestHeader("Authorization") String token) {

        String username = jwtUtil.extractUsername(token.substring(7));

        if (!username.equals("admin")) {
            return "Access Denied ❌ (Admin only)";
        }

        return messageService.getAllMessagesForAdmin();
    }

    @GetMapping("/chats")
    public List<String> getChats(@RequestHeader("Authorization") String token) {

        String username = jwtUtil.extractUsername(token.substring(7));

        return messageService.getAllUsers()
                .stream()
                .filter(u -> !u.equals(username))   // remove self
                .toList();
    }

    @GetMapping("/unread")
    public Map<String, Long> getUnread(@RequestHeader("Authorization") String token) {
        String username = jwtUtil.extractUsername(token.substring(7));
        return messageService.getUnreadCounts(username);
    }

    @PostMapping("/read/{sender}")
    public void markRead(@PathVariable String sender,
                         @RequestHeader("Authorization") String token) {

        String receiver = jwtUtil.extractUsername(token.substring(7));
        messageService.markAsRead(sender, receiver);
    }
}
