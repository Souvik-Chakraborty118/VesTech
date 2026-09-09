const video = document.getElementById('webcam');
const resultImage = document.getElementById('result-image');
const scanBtn = document.getElementById('scanBtn');
const scanLaser = document.getElementById('scan-laser');
const canvas = document.createElement('canvas');
//Connection URLs
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const AI_BACKEND_URL = isLocal ? 'http://localhost:8000' : 'https://bingo-backend-0qbr.onrender.com';
const JAVA_BACKEND_URL = isLocal ? 'http://localhost:8080' : 'https://bingo-java-backend.onrender.com';
//Start Camera
navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(stream => { video.srcObject = stream; })
    .catch(err => alert("Camera access denied or unavailable."));
scanBtn.addEventListener('click', () => {
    //Reset UI to scanning mode
    scanBtn.innerText = "ANALYZING AI DATA...";
    scanBtn.disabled = true;
    scanLaser.style.display = "block"; // Turn on laser
    resultImage.style.display = "none";
    video.style.display = "block"; 
    document.getElementById('res-category').innerText = "Processing...";
    document.getElementById('res-confidence').innerText = "--";
    document.getElementById('res-action').innerText = "--";
    document.getElementById('res-confidence').classList.remove('high-confidence');
    //Capture Frame
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    //Send to Python Backend
    canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('file', blob, 'capture.jpg');
        try {
            const response = await fetch(`${AI_BACKEND_URL}/api/scan`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            //Update UI with AI Results
            document.getElementById('res-category').innerText = data.category;
            document.getElementById('res-confidence').innerText = data.confidence + '%';
            document.getElementById('res-action').innerText = data.action;
            if (data.confidence > 50) {
                document.getElementById('res-confidence').classList.add('high-confidence');
            }
            //Show the Bounding Box Image
            if (data.image) {
                video.style.display = "none"; // Hide live feed
                resultImage.src = "data:image/jpeg;base64," + data.image; // Show boxed image
                resultImage.style.display = "block";
            }
            //Send Telemetry to Java Database 
            if(data.confidence > 0) {
                fetch(`${JAVA_BACKEND_URL}/api/record`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        category: data.category,
                        confidence: data.confidence,
                        action: "AI Logged: " + data.action
                    })
                }).catch(err => console.error("Database sync failed", err));
            }
        } catch (error) {
            alert("Scan failed to connect to AI server. Ensure Render is awake.");
        } finally {
            scanBtn.innerText = "SCAN NEXT ITEM";
            scanBtn.disabled = false;
            scanLaser.style.display = "none"; // Turn off laser
        }
    }, 'image/jpeg');
});
