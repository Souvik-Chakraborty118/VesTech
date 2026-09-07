const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const JAVA_BACKEND_URL = isLocal 
    ? 'http://localhost:8080' 
    : 'https://bingo-java-backend.onrender.com';

console.log("Dashboard loaded. Connected to Java backend:", JAVA_BACKEND_URL);

//DUMMY DATA FOR HISTORY
let orderHistory = [
    { id: "ORD-9482-MED", loc: "Ward 3 - ICU", time: "Today, 10:45 AM", status: "Pending" },
    { id: "ORD-9481-BIO", loc: "Ward 1 - General", time: "Today, 08:15 AM", status: "Completed" },
    { id: "ORD-9480-REC", loc: "Pathology Lab", time: "Yesterday, 04:30 PM", status: "Completed" }
];

//REQUEST PICKUP 
document.getElementById('requestBtn').addEventListener('click', async () => {
    const loc = prompt("Enter pickup location (e.g., 'Ward 4'):");
    if (loc) {
        //Generate a random Order ID
        const newId = "ORD-" + Math.floor(1000 + Math.random() * 9000) + "-REQ";
        
        // Update the Active Order Card on the dashboard
        document.getElementById('activeOrderId').innerText = "#" + newId;
        document.getElementById('activeLocation').innerText = loc;
        document.getElementById('activeRobot').innerText = "Awaiting Assignment...";
        document.getElementById('activeStatus').innerText = "Processing Request";
        document.getElementById('activeEta').innerText = "Calculating...";

        //Add to history array
        orderHistory.unshift({
            id: newId,
            loc: loc,
            time: "Just Now",
            status: "Pending"
        });

        // Send telemetry payload to your live Java backend
        try {
            await fetch(`${JAVA_BACKEND_URL}/api/record`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: "PICKUP_REQUEST",
                    confidence: 1.0,
                    action: `Location: ${loc} [ID: ${newId}]`
                })
            });
        } catch (error) {
            console.error("Failed to sync telemetry with Java backend:", error);
        }

        alert(`Pickup requested successfully! Tracking ID: ${newId}`);
    }
});


//FORCE DISPATCH 
document.getElementById('dispatchBtn').addEventListener('click', () => {
    const btn = document.getElementById('dispatchBtn');
    btn.innerText = "⏳ Dispatching...";
    btn.style.opacity = "0.7";
    
    setTimeout(() => {
        alert("Success: Collection unit dispatched.");
        btn.innerText = "🚀 Force Dispatch";
        btn.style.opacity = "1";
        
        document.getElementById('activeRobot').innerText = "Robot Unit Beta-2";
        document.getElementById('activeStatus').innerText = "En route";
        document.getElementById('activeEta').innerText = "2 mins";

        // Reset the red bin visually for the demo
        document.getElementById('red-weight').innerHTML = '0g <span style="opacity:0.7; font-size:14px;">/ 1000g</span>';
        document.querySelector('.critical').classList.remove('critical');
    }, 1500);
});


//EMERGENCY STOP
document.getElementById('stopBtn').addEventListener('click', () => {
    const confirmStop = confirm("WARNING: Are you sure you want to halt all active robot collection units?");
    if (confirmStop) {
        document.querySelector('.dot').style.background = "#FF4D6D"; 
        document.querySelector('.dot').style.boxShadow = "0 0 10px #FF4D6D";
        document.querySelector('.live-indicator').innerHTML = '<div class="dot" style="background:#FF4D6D; box-shadow:0 0 10px #FF4D6D;"></div> HALTED';
        
        document.getElementById('activeStatus').innerHTML = "<strong style='color:#FF4D6D'>EMERGENCY HALT</strong>";
        alert("All units stopped. System requires manual override to resume.");
    }
});


//ORDER HISTORY MODAL
const modal = document.getElementById('historyModal');
const historyBtn = document.getElementById('historyBtn');
const closeBtn = document.getElementById('closeModal');
const historyList = document.getElementById('historyList');

// Open Modal & Populate Data
historyBtn.addEventListener('click', () => {
    historyList.innerHTML = ''; // Clear old data

    orderHistory.forEach(order => {
        const statusClass = order.status === 'Completed' ? 'status-completed' : 'status-pending';
        
        const itemHtml = `
            <div class="history-item">
                <div class="history-info">
                    <strong>#${order.id}</strong>
                    <p>${order.loc} • ${order.time}</p>
                </div>
                <div class="history-status ${statusClass}">${order.status}</div>
            </div>
        `;
        historyList.innerHTML += itemHtml;
    });

    modal.classList.add('active');
});

//Close Modal
closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
});

//Close Modal when clicking outside the box
modal.addEventListener('click', (e) => {
    if(e.target === modal) {
        modal.classList.remove('active');
    }
});
