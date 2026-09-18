package com.vestech.bingo;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    @GetMapping("/")
    public String healthCheck() {
        return "VesTech BinGo Java Backend is Online and Running!";
    }
}
