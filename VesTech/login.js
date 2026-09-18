const JAVA_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8080' : 'https://bingo-java-backend.onrender.com';

document.addEventListener("DOMContentLoaded", () => {
    const togglePassword = document.querySelector("#togglePassword");
    const passwordInput = document.querySelector("#loginPass");

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener("click", function () {
            const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
            passwordInput.setAttribute("type", type);
            this.classList.toggle("fa-eye-slash");
        });
    }
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', handleLogin);
    }
});

async function handleLogin(event) {
    event.preventDefault();
    const btn = document.getElementById('loginSubmitBtn');
    btn.innerText = "Authenticating...";

    const payload = {
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPass').value
    };

    try {
        const response = await fetch(`${JAVA_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            sessionStorage.setItem('isAuthenticated', 'true');
            sessionStorage.setItem('activeUserEmail', payload.email);
            window.location.href = 'dashboard.html';
        } else {
            alert("Authentication Error: ID not found or incorrect password.");
        }
    } catch (err) {
        alert("Error connecting to Neon SQL Database.");
        console.error(err);
    } finally {
        btn.innerText = "Login";
    }
}
