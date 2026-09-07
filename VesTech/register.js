document.getElementById('registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    alert("Registration submitted. Routing to login.");
    window.location.href = "login.html";
});