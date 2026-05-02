package com.aegis.project.service;

import com.aegis.project.model.User;
import com.aegis.project.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private UserRepository userRepository;

    public User findByUsername(String username) {
        return userRepository.findByUsername(username).orElse(null);
    }

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public User register(User user) {

        String username = user.getUsername().trim();

        // 🔥 CHECK DUPLICATE
        if (userRepository.findByUsername(username).isPresent()) {
            throw new RuntimeException("Username already exists ❌");
        }

        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setRole("USER");

        return userRepository.save(user);
    }

    public User updateUser(Long id, User newUser) {
        User user = userRepository.findById(id).orElseThrow();

        user.setUsername(newUser.getUsername());
        user.setPassword(passwordEncoder.encode(newUser.getPassword()));
        user.setRole(newUser.getRole());

        return userRepository.save(user);
    }

    public void deleteUser(Long id) {
        userRepository.deleteById(id);
    }

    public String toggleBlock(String username) {

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // 🔥 SAFE TOGGLE
        boolean current = Boolean.TRUE.equals(user.getBlocked());
        user.setBlocked(!current);

        userRepository.save(user);

        return user.getBlocked() ? "User Blocked 🚫" : "User Unblocked ✅";
    }
}

