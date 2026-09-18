const BACKEND_URL = "https://bingo-backend-0qbr.onrender.com";

const video = document.getElementById("webcam");
const canvas = document.getElementById("cctv-overlay");
const ctx = canvas.getContext("2d");

const hudFps = document.getElementById("hud-fps");
const statusText = document.getElementById("status-text");
const sharpsAlarm = document.getElementById("sharps-alarm");

const countRed = document.getElementById("count-red");
const countYellow = document.getElementById("count-yellow");
const countWhite = document.getElementById("count-white");
const countBlue = document.getElementById("count-blue");
// NEW: Safely grab the Green Bin counter if you add it to the HTML later
const countGreen = document.getElementById("count-green"); 

const detectionList = document.getElementById("detection-list");

const toggleStreamBtn = document.getElementById("toggle-stream-btn");
const switchCamBtn = document.getElementById("switch-cam-btn");

let isStreaming = true;
let currentFacingMode = "environment";
let lastFrameTime = performance.now();
let scaleX = 1;
let scaleY = 1;

async function initCamera() {
  try {
    statusText.textContent = "ACTIVATING CAMERA...";
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });

    video.srcObject = stream;

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      document.getElementById("hud-res").textContent = `RES: ${video.videoWidth}x${video.videoHeight}`;
      statusText.textContent = "LIVE CCTV STREAMING";
      
      // CRITICAL FIX: This now points to the correct walkie-talkie loop
      runDetectionLoop(); 
    };

    await video.play();

  } catch (err) {
    console.error("[BinGo] Camera error:", err);
    statusText.textContent = "CAMERA ERROR / ACCESS DENIED";
  }
}

async function runDetectionLoop() {
  if (isStreaming && !video.paused && !video.ended) {
    await processCCTVFrame();
  }
  // Wait 150ms after Render replies before taking the next photo
  setTimeout(runDetectionLoop, 150);
}

const offscreenCanvas = document.createElement("canvas");
const offscreenCtx = offscreenCanvas.getContext("2d");

async function processCCTVFrame() {
  if (video.videoWidth === 0 || video.videoHeight === 0) return;

  const targetWidth = 640;
  const targetHeight = Math.round((video.videoHeight / video.videoWidth) * targetWidth);

  offscreenCanvas.width = targetWidth;
  offscreenCanvas.height = targetHeight;
  offscreenCtx.drawImage(video, 0, 0, targetWidth, targetHeight);

  scaleX = canvas.width / targetWidth;
  scaleY = canvas.height / targetHeight;

  const frameBase64 = offscreenCanvas.toDataURL("image/jpeg", 0.7);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  const requestStartTime = performance.now();

  try {
    const response = await fetch(`${BACKEND_URL}/detect_frame`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: frameBase64 }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      renderBoundingBoxes(data.detections);
      updateTelemetry(data.bin_summary, data.detections, data.has_sharps);
      statusText.textContent = "LIVE CCTV STREAMING";
    } else {
      statusText.textContent = `SERVER ERROR: HTTP ${response.status}`;
    }
  } catch (err) {
    if (err.name === "AbortError") {
      statusText.textContent = "WAKING UP SERVER...";
    } else {
      statusText.textContent = "BACKEND DISCONNECTED";
    }
  } finally {
    const now = performance.now();
    const timeTaken = now - requestStartTime;
    
    // Smooth out the FPS calculation so it doesn't say 0.0 during cold boots
    if (timeTaken > 5000) {
        hudFps.textContent = `FPS: WAKING UP...`;
    } else {
        const fps = (1000 / (now - lastFrameTime)).toFixed(1);
        hudFps.textContent = `FPS: ${fps}`;
    }
    lastFrameTime = performance.now();
  }
}

function renderBoundingBoxes(detections) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  detections.forEach((item) => {
    const { box, color, class_name, bin, confidence } = item;
    const x1 = box.x1 * scaleX;
    const y1 = box.y1 * scaleY;
    const width = box.width * scaleX;
    const height = box.height * scaleY;

    // Draw the green (or other color) bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x1, y1, width, height);

    const label = `${class_name} [${bin}] ${(confidence * 100).toFixed(0)}%`;
    ctx.font = "bold 15px 'Segoe UI', sans-serif";
    const textWidth = ctx.measureText(label).width;

    ctx.fillStyle = color;
    ctx.fillRect(x1, Math.max(0, y1 - 26), textWidth + 12, 26);

    ctx.fillStyle = bin === "WHITE" || bin === "YELLOW" ? "#000" : "#FFF";
    ctx.fillText(label, x1 + 6, Math.max(18, y1 - 8));
  });
}

function updateTelemetry(summary, detections, hasSharps) {
  if (countRed) countRed.textContent = summary.RED || 0;
  if (countYellow) countYellow.textContent = summary.YELLOW || 0;
  if (countWhite) countWhite.textContent = summary.WHITE || 0;
  if (countBlue) countBlue.textContent = summary.BLUE || 0;
  
  // Update Green bin if it exists in the HTML
  if (countGreen) countGreen.textContent = summary.GREEN || 0;

  if (hasSharps) {
    sharpsAlarm.classList.remove("hidden");
  } else {
    sharpsAlarm.classList.add("hidden");
  }

  if (detections.length === 0) {
    detectionList.innerHTML = `<li class="empty-state">Awaiting objects in CCTV view...</li>`;
  } else {
    detectionList.innerHTML = detections.slice(0, 5).map((d) => `
        <li class="log-entry" style="border-left: 4px solid ${d.color};">
          <span><strong>${d.class_name}</strong> &rarr; ${d.bin} Bin</span>
          <span style="color: ${d.color};">${(d.confidence * 100).toFixed(0)}%</span>
        </li>
      `).join("");
  }
}

toggleStreamBtn.addEventListener("click", () => {
  isStreaming = !isStreaming;
  if (!isStreaming) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    toggleStreamBtn.innerHTML = `<i class="fa-solid fa-play"></i> Resume CCTV`;
    statusText.textContent = "CCTV PAUSED";
  } else {
    toggleStreamBtn.innerHTML = `<i class="fa-solid fa-pause"></i> Pause CCTV`;
    statusText.textContent = "LIVE CCTV STREAMING";
    lastFrameTime = performance.now();
  }
});

switchCamBtn.addEventListener("click", async () => {
  currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
  if (video.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
  }
  await initCamera();
});

window.addEventListener("DOMContentLoaded", initCamera);
