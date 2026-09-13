package com.vestech.bingo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*") 
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/register")
    public ResponseEntity<String> registerUser(@RequestBody User user) {
        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            return ResponseEntity.badRequest().body("Email already registered");
        }
        userRepository.save(user);
        return ResponseEntity.ok("User registered successfully");
    }

    @PostMapping("/login")
    public ResponseEntity<String> loginUser(@RequestBody User loginRequest) {
        Optional<User> user = userRepository.findByEmail(loginRequest.getEmail());
        
        if (user.isEmpty() || !user.get().getPassword().equals(loginRequest.getPassword())) {
            return ResponseEntity.status(401).body("ID not found or incorrect password");
        }
        return ResponseEntity.ok("Login successful");
    }
}
@PutMapping("/update")
    public ResponseEntity<String> updateUser(@RequestBody User updatedUser) {
        Optional<User> existingUserOpt = userRepository.findByEmail(updatedUser.getEmail());
        
        if (existingUserOpt.isEmpty()) {
            return ResponseEntity.status(404).body("User not found in database.");
        }
        
        User existingUser = existingUserOpt.get();
        existingUser.setFirstName(updatedUser.getFirstName());
        existingUser.setLastName(updatedUser.getLastName());
        existingUser.setRole(updatedUser.getRole());
        
        // Only update password if a new one was provided
        if (updatedUser.getPassword() != null && !updatedUser.getPassword().isEmpty()) {
            existingUser.setPassword(updatedUser.getPassword());
        }
        
        userRepository.save(existingUser);
        return ResponseEntity.ok("Profile updated in Neon SQL successfully.");
    }
