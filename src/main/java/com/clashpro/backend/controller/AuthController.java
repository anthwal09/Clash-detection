package com.clashpro.backend.controller;

import com.clashpro.backend.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/login")
    public String login(@RequestBody Map<String, String> data) {
        return authService.login(data.get("email"), data.get("password"));
    }

    @PostMapping("/forgot-password")
    public String forgot(@RequestBody Map<String, String> data) {
        return authService.sendOtp(data.get("email"));
    }

    @PostMapping("/verify-otp")
    public String verify(@RequestBody Map<String, String> data) {
        return authService.verifyOtp(data.get("email"), data.get("otp"));
    }

    @PostMapping("/reset-password")
    public String reset(@RequestBody Map<String, String> data) {
        return authService.resetPassword(data.get("email"), data.get("newPassword"));
    }
}