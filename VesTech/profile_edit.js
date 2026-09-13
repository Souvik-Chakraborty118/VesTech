const JAVA_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8080' : 'https://bingo-java-backend.onrender.com';

// 1. Session Guard (Using secure sessionStorage, strictly tied to the DB login)
const currentUserEmail = sessionStorage.getItem('activeUserEmail');
if (!currentUserEmail) {
    window.location.href = 'login.html';
}

document.addEventListener("DOMContentLoaded", () => {
    // Populate the form with the session data retrieved during the DB login
    document.getElementById('editFirst').value = sessionStorage.getItem('activeUserFirst') || '';
    document.getElementById('editLast').value = sessionStorage.getItem('activeUserLast') || '';
    document.getElementById('editEmail').value = currentUserEmail;
    document.getElementById('editEmail').readOnly = true; // Prevent changing the primary key email
    
    const savedRole = sessionStorage.getItem('activeUserRole');
    if(savedRole) document.getElementById('editRole').value = savedRole;

    // Logout logic
    document.getElementById('logoutBtn').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'login.html';
    });
});

// 2. Database Update Logic
async function saveProfile(event) {
    event.preventDefault();
    const btn = document.querySelector('button[type="submit"]');
    btn.innerText = "Syncing with Database...";

    const payload = {
        email: currentUserEmail, // Used to find the record in Neon SQL
        firstName: document.getElementById('editFirst').value,
        lastName: document.getElementById('editLast').value,
        role: document.getElementById('editRole').value,
        password: document.getElementById('editPass').value
    };

    try {
        const response = await fetch(`${JAVA_URL}/api/auth/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            // Update the active session data so the UI reflects the DB changes
            sessionStorage.setItem('activeUserFirst', payload.firstName);
            sessionStorage.setItem('activeUserLast', payload.lastName);
            sessionStorage.setItem('activeUserRole', payload.role);
            
            alert("Success: Profile updated in Neon SQL.");
            window.location.href = 'dashboard.html';
        } else {
            const errMsg = await response.text();
            alert("Database Error: " + errMsg);
        }
    } catch (err) {
        alert("Fatal Error: Could not connect to Java Backend.");
    } finally {
        btn.innerText = "Save Changes";
    }
}
