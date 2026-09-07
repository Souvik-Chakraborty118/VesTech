document.getElementById('profileForm').addEventListener('submit', (e) => {
    e.preventDefault();
    alert("Profile updated successfully.");
    window.history.back();
});