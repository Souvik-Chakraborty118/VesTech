//Authentication Route Guard (Runs immediately)
if (sessionStorage.getItem('isAuthenticated') !== 'true') {
    window.location.href = 'login.html';
}

// Capacity Logic Function
function updateBinCapacity(binPrefix, currentGrams) {
    const maxGrams = 3000;
    const percentage = Math.min((currentGrams / maxGrams) * 100, 100);
    
    // Update Text
    document.getElementById(`${binPrefix}-weight`).innerHTML = `${currentGrams}g <span class="subtext">/ 3KG max</span>`;
    
    const bar = document.getElementById(`${binPrefix}-bar`);
    const alertText = document.getElementById(`${binPrefix}-alert`);
    const card = document.getElementById(`${binPrefix}-card`);

    // Clear old classes
    bar.className = '';
    alertText.className = 'alert-text';
    card.classList.remove('critical');

    // Apply Logic
    if (percentage <= 70) {
        bar.classList.add('fill-green');
        alertText.classList.add('text-optimal');
        alertText.innerText = 'OPTIMAL';
    } else if (percentage <= 89) {
        bar.classList.add('fill-yellow');
        alertText.classList.add('text-nearing');
        alertText.innerText = 'NEARING CAPACITY';
    } else {
        bar.classList.add('fill-red');
        alertText.classList.add('text-disposal');
        alertText.innerText = '⚠️ DISPOSAL REQUIRED';
        card.classList.add('critical');
    }
}

//Initialize Mock Data when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
    updateBinCapacity('yellow', 560);   // Optimal (Green)
    updateBinCapacity('red', 2990);     // Disposal Required (Red)
    updateBinCapacity('white', 2500);   // Nearing Capacity (Yellow)
    updateBinCapacity('blue', 1200);    // Optimal (Green)
});
