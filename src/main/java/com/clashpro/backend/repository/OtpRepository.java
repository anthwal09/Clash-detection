package com.clashpro.backend.repository;

import com.clashpro.backend.model.OtpRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OtpRepository extends JpaRepository<OtpRecord, Long> {
    Optional<OtpRecord> findTopByEmailOrderByIdDesc(String email);
}