const JAVA_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8080' : 'https://bingo-java-backend.onrender.com';

async function handleRegister(event) {
    event.preventDefault(); 
    const btn = document.getElementById('regSubmitBtn');
    btn.innerText = "Connecting to Database...";
    
    const payload = {
        firstName: document.getElementById('regFirst').value,
        lastName: document.getElementById('regLast').value,
        email: document.getElementById('regEmail').value,
        password: document.getElementById('regPass').value,
        role: document.getElementById('regRole').value
    };

    try {
        const response = await fetch(`${JAVA_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // THIS IS WHERE IT GOES
        if (response.ok) {
            sessionStorage.setItem('isAuthenticated', 'true');
            sessionStorage.setItem('activeUserEmail', payload.email);
            sessionStorage.setItem('activeUserFirst', payload.firstName);
            sessionStorage.setItem('activeUserLast', payload.lastName);
            sessionStorage.setItem('activeUserRole', payload.role);
            
            window.location.href = 'dashboard.html';
        } else {
            const errMsg = await response.text();
            alert("Registration Failed: " + errMsg);
        }
    } catch (err) {
        alert("Error connecting to Neon SQL Database.");
    } finally {
        btn.innerText = "Create Account";
    }
}
document.getElementById('authForm').addEventListener('submit', handleRegister);
