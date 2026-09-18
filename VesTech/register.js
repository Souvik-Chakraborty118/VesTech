const JAVA_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8080' : 'https://bingo-java-backend.onrender.com';

document.addEventListener("DOMContentLoaded", () => {
    const toggleRegPassword = document.querySelector("#togglePassword");
    const regPasswordInput = document.querySelector("#regPass");

    if (toggleRegPassword && regPasswordInput) {
        toggleRegPassword.addEventListener("click", function () {
            const type = regPasswordInput.getAttribute("type") === "password" ? "text" : "password";
            regPasswordInput.setAttribute("type", type);
            this.classList.toggle("fa-eye-slash");
        });
    }

    const toggleConfirmPassword = document.querySelector("#toggleConfirmPassword");
    const confirmPasswordInput = document.querySelector("#regConfirmPass");

    if (toggleConfirmPassword && confirmPasswordInput) {
        toggleConfirmPassword.addEventListener("click", function () {
            const type = confirmPasswordInput.getAttribute("type") === "password" ? "text" : "password";
            confirmPasswordInput.setAttribute("type", type);
            this.classList.toggle("fa-eye-slash");
        });
    }

    const regForm = document.getElementById("regForm");
    if (regForm) {
        regForm.addEventListener("submit", handleRegister);
    }
});

async function handleRegister(event) {
    event.preventDefault();
    
    const regPasswordInput = document.querySelector("#regPass");
    const confirmPasswordInput = document.querySelector("#regConfirmPass");
    
    if (regPasswordInput.value !== confirmPasswordInput.value) {
        alert("Passwords do not match!");
        return;
    }

    const btn = document.getElementById('regSubmitBtn');
    btn.innerText = "Registering...";

    const payload = {
        name: `${document.getElementById('regFirstName').value.trim()} ${document.getElementById('regLastName').value.trim()}`,
        email: document.getElementById('regEmail').value,
        role: document.getElementById('regRole').value,
        password: regPasswordInput.value
    };

    try {
        const response = await fetch(`${JAVA_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("Registration successful! Please login.");
            window.location.href = 'login.html';
        } else {
            alert("Registration Error: Could not create account.");
        }
    } catch (err) {
        alert("Error connecting to Neon SQL Database.");
        console.error(err);
    } finally {
        btn.innerText = "Create Account";
    }
}
