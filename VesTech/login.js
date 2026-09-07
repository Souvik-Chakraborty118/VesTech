document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const role = document.getElementById('role').value;
    localStorage.setItem('bingo_user_role', role);
    //Route based on role access levels
    if (role === 'ADMIN' || role === 'TECHNICIAN' || role === 'WASTE_STAFF') {
        window.location.href = "dashboard.html";
    } else {
        window.location.href = "camera.html";
    }
});