package com.aegis.project.controller;

import com.aegis.project.model.User;
import com.aegis.project.repository.MessageRepository;
import com.aegis.project.security.JwtUtil;
import com.aegis.project.service.UserService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private UserService userService;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private MessageRepository messageRepository;

    // 🔐 LOGIN
    @PostMapping("/login")
    public String login(@RequestBody User user) {
        String username = user.getUsername().trim();
        String password = user.getPassword().trim();

        User existingUser = userService.findByUsername(username);

        if (existingUser != null &&
                passwordEncoder.matches(password, existingUser.getPassword())) {

            // 🔥 BLOCKED CHECK — return special response
            if (Boolean.TRUE.equals(existingUser.getBlocked())) {
                return "BLOCKED";
            }

            return existingUser.getRole() + ":" + jwtUtil.generateToken(username);
        } else {
            return "Invalid Credentials";
        }
    }

    // 👤 GET ALL USERS
    @GetMapping("/users")
    public List<User> getAllUsers() {
        return userService.getAllUsers();
    }

    // 📝 REGISTER
    @PostMapping("/register")
    public Object register(@RequestBody User user) {
        try {
            return userService.register(user);
        } catch (Exception e) {
            return e.getMessage(); // 🔥 send error to frontend
        }
    }

    // ✏️ UPDATE USER (ADMIN ONLY)
    @PutMapping("/update/{id}")
    public Object updateUser(@PathVariable Long id,
                             @RequestBody User user,
                             @RequestHeader("Authorization") String token,
                             HttpServletResponse response) {

        String username = jwtUtil.extractUsername(token.substring(7));
        User existingUser = userService.findByUsername(username);

        if (!existingUser.getRole().equals("ADMIN")) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            return "Access Denied";
        }

        return userService.updateUser(id, user);
    }

    // ❌ DELETE USER (ADMIN ONLY)
    @DeleteMapping("/delete/{id}")
    public Object deleteUser(@PathVariable Long id,
                             @RequestHeader("Authorization") String token,
                             HttpServletResponse response) {

        String username = jwtUtil.extractUsername(token.substring(7));
        User existingUser = userService.findByUsername(username);

        if (!existingUser.getRole().equals("ADMIN")) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            return "Access Denied";
        }

        userService.deleteUser(id);
        return "User deleted successfully";
    }

    // 🚫 BLOCK / UNBLOCK
    @PostMapping("/block/{username}")
    public String blockUser(@PathVariable String username,
                            @RequestHeader("Authorization") String token) {

        String admin = jwtUtil.extractUsername(token.substring(7));
        User adminUser = userService.findByUsername(admin);

        if (adminUser == null || !adminUser.getRole().equalsIgnoreCase("ADMIN")) {
            return "Access Denied ❌";
        }

        return userService.toggleBlock(username);
    }

    // 🔍 BLOCK STATUS
    @GetMapping("/status/{username}")
    public Boolean getUserStatus(@PathVariable String username) {
        User user = userService.findByUsername(username);
        if (user == null) return false;
        return Boolean.TRUE.equals(user.getBlocked());
    }

    // 📊 ADMIN STATS — total users, messages, blocked count
    @GetMapping("/stats")
    public Object getStats(@RequestHeader("Authorization") String token) {

        String username = jwtUtil.extractUsername(token.substring(7));
        User user = userService.findByUsername(username);

        if (user == null || !user.getRole().equalsIgnoreCase("ADMIN")) {
            return "Access Denied ❌";
        }

        List<User> allUsers = userService.getAllUsers();
        long totalUsers    = allUsers.stream().filter(u -> !u.getRole().equalsIgnoreCase("ADMIN")).count();
        long blockedUsers  = allUsers.stream().filter(u -> Boolean.TRUE.equals(u.getBlocked())).count();
        long totalMessages = messageRepository.count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers",    totalUsers);
        stats.put("blockedUsers",  blockedUsers);
        stats.put("totalMessages", totalMessages);

        return stats;
    }

    // 📋 ALL REGISTERED USERS (for admin chat list)
    @GetMapping("/allUsers")
    public Object getAllRegisteredUsers(@RequestHeader("Authorization") String token) {

        String username = jwtUtil.extractUsername(token.substring(7));
        User user = userService.findByUsername(username);

        if (user == null || !user.getRole().equalsIgnoreCase("ADMIN")) {
            return "Access Denied ❌";
        }

        return userService.getAllUsers()
                .stream()
                .filter(u -> !u.getRole().equalsIgnoreCase("ADMIN"))
                .map(u -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("username", u.getUsername());
                    m.put("blocked", Boolean.TRUE.equals(u.getBlocked()));
                    return m;
                })
                .toList();
    }
}