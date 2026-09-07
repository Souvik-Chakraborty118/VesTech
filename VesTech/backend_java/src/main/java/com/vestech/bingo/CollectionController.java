package com.vestech.bingo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class CollectionController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PostMapping("/record")
    public ResponseEntity<Map<String, String>> recordScan(@RequestBody Map<String, Object> payload) {
        Map<String, String> response = new HashMap<>();

        try {
            // 1. Extract the exact data sent from your frontend AI Scanner
            String category = (String) payload.getOrDefault("category", "UNKNOWN");
            Double confidence = Double.valueOf(payload.getOrDefault("confidence", "0.0").toString());
            String systemAction = (String) payload.getOrDefault("action", "MANUAL_CHECK");

            // 2. Inject it directly into Neon SQL
            String sql = "INSERT INTO waste_scans (category, confidence, action, scan_time) VALUES (?, ?, ?, ?)";
            jdbcTemplate.update(sql, category, confidence, systemAction, LocalDateTime.now());

            // 3. Confirm success back to the frontend
            response.put("status", "Success");
            response.put("message", "Scan logged to Neon SQL database");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            // Catch any database errors so your server doesn't crash
            response.put("status", "Error");
            response.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
}
