package com.clashpro.backend.controller;

import com.clashpro.backend.model.Schedule;
import com.clashpro.backend.service.TimetableService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/timetable")
@CrossOrigin(origins = "*")
public class TimetableController {

    @Autowired
    private TimetableService timetableService;

    @PostMapping("/save")
    public List<Schedule> saveTimetable(@RequestBody List<Schedule> schedules) {
        return timetableService.saveAllSchedules(schedules);
    }

    @GetMapping("/all")
    public List<Schedule> getAllTimetableData() {
        return timetableService.getAllSchedules();
    }

    @GetMapping("/clashes")
    public List<String> getClashes() {
        return timetableService.findAdvancedClashes();
    }

    @DeleteMapping("/clear")
    public String clearAllTimetableData() {
        timetableService.clearAllSchedules();
        return "Old timetable data cleared successfully.";
    }
}