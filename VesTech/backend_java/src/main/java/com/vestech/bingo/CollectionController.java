package com.vestech.bingo;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class CollectionController {

    @PostMapping("/record")
    public ResponseEntity<Map<String, String>> recordScan(@RequestBody Map<String, Object> payload) {
        // Will connect to Neon SQL here later
        Map<String, String> response = new HashMap<>();
        response.put("status", "Logged to database successfully");
        return ResponseEntity.ok(response);
    }
}