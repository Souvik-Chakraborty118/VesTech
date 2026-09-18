const BACKEND_URL = "https://bingo-backend-0qbr.onrender.com";

const video = document.getElementById("webcam");
const uploadedPreview = document.getElementById("uploaded-preview");
const canvas = document.getElementById("cctv-overlay");
const ctx = canvas.getContext("2d");

const hudFps = document.getElementById("hud-fps");
const statusText = document.getElementById("status-text");
const sharpsAlarm = document.getElementById("sharps-alarm");

const countRed = document.getElementById("count-red");
const countYellow = document.getElementById("count-yellow");
const countWhite = document.getElementById("count-white");
const countBlue = document.getElementById("count-blue");
const countGreen = document.getElementById("count-green");
const detectionList = document.getElementById("detection-list");

const toggleStreamBtn = document.getElementById("toggle-stream-btn");
const uploadBtn = document.getElementById("upload-btn");
const fileUpload = document.getElementById("file-upload");
const switchCamBtn = document.getElementById("switch-cam-btn");

let currentFacingMode = "environment";
let scaleX = 1;
let scaleY = 1;

async function initCamera() {
  try {
    statusText.textContent = "CAMERA READY. CLICK SCAN OR UPLOAD.";
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });

    video.srcObject = stream;

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      document.getElementById("hud-res").textContent = `RES: ${video.videoWidth}x${video.videoHeight}`;
      hudFps.textContent = `MANUAL MODE`;
    };

    await video.play();

  } catch (err) {
    console.error("[BinGo] Camera error:", err);
    statusText.textContent = "CAMERA ERROR / ACCESS DENIED";
  }
}

// ----------------------------------------------------
// 1. REUSABLE BACKEND FETCH
// ----------------------------------------------------
async function sendToBackend(frameBase64) {
  try {
    const response = await fetch(`${BACKEND_URL}/detect_frame`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: frameBase64 })
    });

    if (response.ok) {
      const data = await response.json();
      renderBoundingBoxes(data.detections);
      updateTelemetry(data.bin_summary, data.detections, data.has_sharps);
      statusText.textContent = "SCAN COMPLETE.";
    } else {
      statusText.textContent = `SERVER ERROR: HTTP ${response.status}`;
    }
  } catch (err) {
    statusText.textContent = "BACKEND DISCONNECTED. TRY AGAIN.";
    console.error(err);
  } finally {
    toggleStreamBtn.disabled = false;
    uploadBtn.disabled = false;
  }
}

// ----------------------------------------------------
// 2. WEBCAM SCAN LOGIC
// ----------------------------------------------------
async function takePhotoAndScan() {
  if (video.videoWidth === 0 || video.videoHeight === 0) return;

  // Restore video view if we were on the uploaded image
  uploadedPreview.classList.add("hidden");
  video.classList.remove("hidden");

  statusText.textContent = "SCANNING WEBCAM... PLEASE WAIT...";
  toggleStreamBtn.disabled = true;
  uploadBtn.disabled = true;
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height); 

  const targetWidth = 640;
  const targetHeight = Math.round((video.videoHeight / video.videoWidth) * targetWidth);

  const offscreenCanvas = document.createElement("canvas");
  const offscreenCtx = offscreenCanvas.getContext("2d");
  offscreenCanvas.width = targetWidth;
  offscreenCanvas.height = targetHeight;
  offscreenCtx.drawImage(video, 0, 0, targetWidth, targetHeight);

  scaleX = canvas.width / targetWidth;
  scaleY = canvas.height / targetHeight;

  const frameBase64 = offscreenCanvas.toDataURL("image/jpeg", 0.8);
  await sendToBackend(frameBase64);
}

// ----------------------------------------------------
// 3. IMAGE UPLOAD LOGIC
// ----------------------------------------------------
uploadBtn.addEventListener("click", () => fileUpload.click());

fileUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    statusText.textContent = "SCANNING UPLOADED IMAGE...";
    toggleStreamBtn.disabled = true;
    uploadBtn.disabled = true;

    // Hide webcam, show uploaded image
    video.classList.add("hidden");
    uploadedPreview.classList.remove("hidden");
    uploadedPreview.src = event.target.result;

    uploadedPreview.onload = async () => {
      // Scale canvas to match the uploaded image's real size
      canvas.width = uploadedPreview.naturalWidth;
      canvas.height = uploadedPreview.naturalHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const targetWidth = 640;
      const targetHeight = Math.round((canvas.height / canvas.width) * targetWidth);

      const offscreenCanvas = document.createElement("canvas");
      const offscreenCtx = offscreenCanvas.getContext("2d");
      offscreenCanvas.width = targetWidth;
      offscreenCanvas.height = targetHeight;
      offscreenCtx.drawImage(uploadedPreview, 0, 0, targetWidth, targetHeight);

      scaleX = canvas.width / targetWidth;
      scaleY = canvas.height / targetHeight;

      const frameBase64 = offscreenCanvas.toDataURL("image/jpeg", 0.8);
      await sendToBackend(frameBase64);
    };
  };
  reader.readAsDataURL(file);
});

// ----------------------------------------------------
// 4. RENDERING & TELEMETRY
// ----------------------------------------------------
function renderBoundingBoxes(detections) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  detections.forEach((item) => {
    const { box, color, class_name, bin, confidence } = item;
    const x1 = box.x1 * scaleX;
    const y1 = box.y1 * scaleY;
    const width = box.width * scaleX;
    const height = box.height * scaleY;

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(x1, y1, width, height);

    const label = `${class_name} [${bin}] ${(confidence * 100).toFixed(0)}%`;
    ctx.font = "bold 20px 'Segoe UI', sans-serif";
    const textWidth = ctx.measureText(label).width;

    ctx.fillStyle = color;
    ctx.fillRect(x1, Math.max(0, y1 - 32), textWidth + 12, 32);

    ctx.fillStyle = bin === "WHITE" || bin === "YELLOW" ? "#000" : "#FFF";
    ctx.fillText(label, x1 + 6, Math.max(22, y1 - 8));
  });
}

function updateTelemetry(summary, detections, hasSharps) {
  if (countRed) countRed.textContent = summary.RED || 0;
  if (countYellow) countYellow.textContent = summary.YELLOW || 0;
  if (countWhite) countWhite.textContent = summary.WHITE || 0;
  if (countBlue) countBlue.textContent = summary.BLUE || 0;
  if (countGreen) countGreen.textContent = summary.GREEN || 0;

  if (hasSharps) {
    sharpsAlarm.classList.remove("hidden");
  } else {
    sharpsAlarm.classList.add("hidden");
  }

  if (detections.length === 0) {
    detectionList.innerHTML = `<li class="empty-state">No medical waste detected.</li>`;
  } else {
    detectionList.innerHTML = detections.slice(0, 5).map((d) => `
        <li class="log-entry" style="border-left: 4px solid ${d.color};">
          <span><strong>${d.class_name}</strong> &rarr; ${d.bin} Bin</span>
          <span style="color: ${d.color};">${(d.confidence * 100).toFixed(0)}%</span>
        </li>
      `).join("");
  }
}

toggleStreamBtn.addEventListener("click", takePhotoAndScan);

switchCamBtn.addEventListener("click", async () => {
  currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
  if (video.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
  }
  await initCamera();
});

window.addEventListener("DOMContentLoaded", initCamera);
