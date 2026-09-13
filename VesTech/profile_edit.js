//Authentication Route Guard (Runs immediately)
if (localStorage.getItem('isAuthenticated') !== 'true') {
    window.location.href = 'login.html';
}

//Load data and attach listeners when the page is ready
document.addEventListener("DOMContentLoaded", () => {
    // Pull existing data or set fallbacks if missing
    document.getElementById('editFirst').value = localStorage.getItem('userFirst') || '';
    document.getElementById('editLast').value = localStorage.getItem('userLast') || '';
    document.getElementById('editEmail').value = localStorage.getItem('userEmail') || '';
    
    const savedRole = localStorage.getItem('userRole');
    if(savedRole) document.getElementById('editRole').value = savedRole;

    // Logout logic
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('isAuthenticated');
        window.location.href = 'login.html';
    });
});

//Save data when form is submitted
function saveProfile(event) {
    event.preventDefault();
    
    // Save to browser local storage
    localStorage.setItem('userFirst', document.getElementById('editFirst').value);
    localStorage.setItem('userLast', document.getElementById('editLast').value);
    localStorage.setItem('userEmail', document.getElementById('editEmail').value);
    localStorage.setItem('userRole', document.getElementById('editRole').value);
    
    // If they typed a password, save it
    const newPass = document.getElementById('editPass').value;
    if(newPass.length > 0) {
        localStorage.setItem('userPass', newPass);
    }

    alert("Profile successfully updated!");
    window.location.href = 'dashboard.html';
}
