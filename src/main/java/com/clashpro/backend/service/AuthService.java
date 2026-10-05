package com.clashpro.backend.service;

import com.clashpro.backend.model.OtpRecord;
import com.clashpro.backend.model.User;
import com.clashpro.backend.repository.OtpRepository;
import com.clashpro.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Random;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepo;

    @Autowired
    private OtpRepository otpRepo;

    @Autowired
    private EmailService emailService;

    public String login(String email, String password) {
        User user = userRepo.findByEmail(email).orElse(null);

        if (user == null) return "User not found";
        if (!user.getPassword().equals(password)) return "Wrong password";

        if (user.getRole() == null || user.getRole().isBlank()) {
            return "Role not assigned";
        }

        return user.getRole();
    }

    public String sendOtp(String email) {
        User user = userRepo.findByEmail(email).orElse(null);
        if (user == null) return "Email not registered";

        String otp = String.valueOf(100000 + new Random().nextInt(900000));

        OtpRecord record = new OtpRecord();
        record.setEmail(email);
        record.setOtp(otp);
        record.setExpiryTime(LocalDateTime.now().plusMinutes(5));
        record.setUsed(false);

        otpRepo.save(record);

        // Send OTP to real email
        emailService.sendOtpEmail(email, otp);

        // Optional terminal confirmation
        System.out.println("OTP sent to email: " + email);

        return "OTP SENT";
    }

    public String verifyOtp(String email, String otp) {
        OtpRecord record = otpRepo.findTopByEmailOrderByIdDesc(email).orElse(null);

        if (record == null) return "No OTP found";
        if (record.isUsed()) return "OTP already used";
        if (record.getExpiryTime().isBefore(LocalDateTime.now())) return "OTP expired";
        if (!record.getOtp().equals(otp)) return "Invalid OTP";

        record.setUsed(true);
        otpRepo.save(record);

        return "VERIFIED";
    }

    public String resetPassword(String email, String newPassword) {
        User user = userRepo.findByEmail(email).orElse(null);
        if (user == null) return "User not found";

        user.setPassword(newPassword);
        userRepo.save(user);

        return "PASSWORD UPDATED";
    }
}