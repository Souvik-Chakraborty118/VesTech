const video = document.getElementById('webcam'); 
const canvas = document.getElementById('canvas'); 

//Auto-Detect Environment 
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

//dynamic API URLs
const AI_BACKEND_URL = isLocal 
    ? 'http://localhost:8000' 
    : 'https://bingo-backend-0qbr.onrender.com';

//Init camera 
navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => video.srcObject = stream)
    .catch(err => alert("Camera access required for AI verification.")); 

document.getElementById('captureBtn').addEventListener('click', () => {
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth; 
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
         
    canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('image', blob, 'waste.jpg');
        try {
            //Use the dynamic URL here instead of hardcoding localhost
            const res = await fetch(`${AI_BACKEND_URL}/api/scan`, { 
                method: 'POST', 
                body: formData 
            });
            
            const data = await res.json();
                         
            document.getElementById('category').innerText = data.category;
            document.getElementById('confidence').innerText = (data.confidence * 100).toFixed(1);
                         
            //Action based on AI confidence
            if(data.confidence >= 0.95) {
                document.getElementById('action').innerText = "PROCEED (Automated Segregation)";
            } else if (data.confidence >= 0.80) {
                document.getElementById('action').innerText = "RE-SCAN REQUIRED";
            } else {
                document.getElementById('action').innerText = "STOP - Human Intervention Required";
            }
        } catch (e) {
            console.error(e);
            alert("Backend connection failed.");
        }
    }, 'image/jpeg');
});
