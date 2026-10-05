package com.clashpro.backend.service;

import com.clashpro.backend.model.Schedule;
import com.clashpro.backend.repository.ScheduleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class TimetableService {

    @Autowired
    private ScheduleRepository scheduleRepository;

    public List<Schedule> saveAllSchedules(List<Schedule> schedules) {
        return scheduleRepository.saveAll(schedules);
    }

    public List<Schedule> getAllSchedules() {
        return scheduleRepository.findAll();
    }

    public void clearAllSchedules() {
        scheduleRepository.deleteAll();
    }

    // 🔥 CLASH DETECTION
    public List<String> findAdvancedClashes() {

        List<Schedule> schedules = scheduleRepository.findAll();
        List<String> clashes = new ArrayList<>();

        for (int i = 0; i < schedules.size(); i++) {
            for (int j = i + 1; j < schedules.size(); j++) {

                Schedule a = schedules.get(i);
                Schedule b = schedules.get(j);

                boolean sameDay = equalsIgnoreCase(a.getDay(), b.getDay());
                boolean sameTime = equalsIgnoreCase(a.getStartTime(), b.getStartTime());

                // 1. Section clash
                if (sameDay && sameTime && equalsIgnoreCase(a.getSection(), b.getSection())) {
                    String msg = "SECTION CLASH → " + a.getSection() + " | " + a.getSubjectName() + " vs " + b.getSubjectName();
                    clashes.add(msg);
                }

                // 2. Faculty clash
                if (sameDay && sameTime && equalsIgnoreCase(a.getFaculty(), b.getFaculty())) {
                    String msg = "FACULTY CLASH → " + a.getFaculty() + " | " + a.getSubjectName() + " vs " + b.getSubjectName();
                    clashes.add(msg);
                }

                // 3. Room clash
                if (sameDay && sameTime && equalsIgnoreCase(a.getRoom(), b.getRoom())) {
                    String msg = "ROOM CLASH → " + a.getRoom() + " | " + a.getSubjectName() + " vs " + b.getSubjectName();
                    clashes.add(msg);
                }
            }
        }

        // 🔥 PRINT IN TERMINAL
        System.out.println("\n===== CLASH REPORT =====");

        if (clashes.isEmpty()) {
            System.out.println("No clashes found");
        } else {
            int count = 1;
            for (String clash : clashes) {
                System.out.println(count++ + ". " + clash);
            }
        }

        System.out.println("========================\n");

        return clashes;
    }

    private boolean equalsIgnoreCase(String a, String b) {
        if (a == null || b == null) return false;
        return a.trim().equalsIgnoreCase(b.trim());
    }
}