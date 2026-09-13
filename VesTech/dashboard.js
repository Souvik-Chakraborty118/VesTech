//Authentication Route Guard
if (sessionStorage.getItem('isAuthenticated') !== 'true') {
    window.location.href = 'login.html';
}

function updateBinCapacity(binPrefix, currentGrams) {
    const maxGrams = 3000;
    const percentage = Math.min((currentGrams / maxGrams) * 100, 100);
    
    document.getElementById(`${binPrefix}-weight`).innerHTML = `${currentGrams}g <span class="subtext">/ 3KG max</span>`;
    
    const bar = document.getElementById(`${binPrefix}-bar`);
    const alertText = document.getElementById(`${binPrefix}-alert`);
    const card = document.getElementById(`${binPrefix}-card`);

    bar.className = '';
    alertText.className = 'alert-text';
    card.classList.remove('critical');

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

document.addEventListener("DOMContentLoaded", () => {
    // Set initial bin weights
    updateBinCapacity('yellow', 560);   
    updateBinCapacity('red', 2990);     
    updateBinCapacity('white', 2500);   
    updateBinCapacity('blue', 1200);    

    const historyModal = document.getElementById('historyModal');
    const closeHistoryModal = document.getElementById('closeModal');
    
    const dummyHistory = [
        { id: '#ORD-9480', loc: 'Ward 1 - General', type: 'Red Bin', status: 'Completed', time: '10:30 AM' },
        { id: '#ORD-9481', loc: 'Operation Theatre', type: 'Yellow Bin', status: 'Completed', time: '11:45 AM' },
        { id: '#ORD-9482', loc: 'Ward 3 - ICU', type: 'Mixed Waste', status: 'En Route', time: 'In Progress' }
    ];

    document.getElementById('historyBtn').addEventListener('click', () => {
        const list = document.getElementById('historyList');
        list.innerHTML = dummyHistory.map(item => `
            <div class="history-item">
                <div>
                    <strong style="color:#1e293b;">${item.id}</strong> - ${item.loc} (${item.type})<br>
                    <small style="color: #64748b; margin-top:5px; display:block;">Time: ${item.time}</small>
                </div>
                <div class="${item.status === 'Completed' ? 'status-completed' : 'status-pending'}">${item.status}</div>
            </div>
        `).join('');
        historyModal.classList.add('active');
    });

    closeHistoryModal.addEventListener('click', () => historyModal.classList.remove('active'));
    
    const pickupModal = document.getElementById('pickupModal');
    const closePickupModal = document.getElementById('closePickupModal');

    document.getElementById('requestPickupBtn').addEventListener('click', () => {
        pickupModal.classList.add('active');
    });

    closePickupModal.addEventListener('click', () => pickupModal.classList.remove('active'));

    document.getElementById('pickupForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const loc = document.getElementById('pickupLocation').value;
        const bin = document.getElementById('pickupBin').value;
        alert(`Success! Robot Unit Alpha-2 has been dispatched to ${loc} for ${bin} collection.`);
        pickupModal.classList.remove('active');
    });

    // Close Modals if user clicks outside of them
    window.addEventListener('click', (e) => {
        if (e.target === historyModal) historyModal.classList.remove('active');
        if (e.target === pickupModal) pickupModal.classList.remove('active');
    });
});
