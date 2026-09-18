// Backend endpoint pointing to your live Render Python backend
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
const detectionList = document.getElementById("detection-list");

const toggleStreamBtn = document.getElementById("toggle-stream-btn");
const switchCamBtn = document.getElementById("switch-cam-btn");

let isStreaming = true;
let currentFacingMode = "environment"; // "user" for laptop, "environment" for phone back camera
let lastFrameTime = performance.now();
let isRequestPending = false;
let scaleX = 1;
let scaleY = 1;

// Initialize CCTV Stream
async function initCamera() {
  try {
    statusText.textContent = "ACTIVATING CAMERA...";
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: currentFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    video.srcObject = stream;

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      document.getElementById("hud-res").textContent = `RES: ${video.videoWidth}x${video.videoHeight}`;
      statusText.textContent = "LIVE CCTV STREAMING";
      console.log(`[BinGo CCTV] Camera ready: ${video.videoWidth}x${video.videoHeight}`);
      startAutoDetectionLoop();
    };

    await video.play();

  } catch (err) {
    console.error("[BinGo CCTV] Camera access error:", err);
    statusText.textContent = "CAMERA ERROR / ACCESS DENIED";
  }
}

// Automated Continuous Detection Loop
function startAutoDetectionLoop() {
  console.log("[BinGo CCTV] Detection loop initialized.");
  setInterval(async () => {
    if (!isStreaming || isRequestPending || video.paused || video.ended) return;
    await processCCTVFrame();
  }, 250); // Polling every 250ms (4 FPS) to avoid crashing Render's Free CPU
}

// Offscreen buffer canvas 
const offscreenCanvas = document.createElement("canvas");
const offscreenCtx = offscreenCanvas.getContext("2d");

async function processCCTVFrame() {
  if (video.videoWidth === 0 || video.videoHeight === 0) return;

  isRequestPending = true;

  // DOWNGRADE to 480px wide. YOLO works fine at this resolution and Render will process it 2x faster
  const targetWidth = 480;
  const targetHeight = Math.round((video.videoHeight / video.videoWidth) * targetWidth);
  
  offscreenCanvas.width = targetWidth;
  offscreenCanvas.height = targetHeight;
  offscreenCtx.drawImage(video, 0, 0, targetWidth, targetHeight);

  // Coordinate ratio to scale boxes back up to display canvas size
  scaleX = canvas.width / targetWidth;
  scaleY = canvas.height / targetHeight;

  // Compress to lightweight JPEG
  const frameBase64 = offscreenCanvas.toDataURL("image/jpeg", 0.6);

  // EXTENDED TIMEOUT: Give Render a full 60 seconds to wake up from cold start
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

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
      console.warn(`[BinGo CCTV] Backend returned HTTP ${response.status}`);
    }
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("[BinGo CCTV] Request timed out after 60s. Server might be struggling.");
      statusText.textContent = "SERVER TIMEOUT...";
    } else {
      console.error("[BinGo CCTV] Network error:", err);
      statusText.textContent = "BACKEND DISCONNECTED";
    }
  } finally {
    const now = performance.now();
    const fps = (1000 / (now - lastFrameTime)).toFixed(1);
    lastFrameTime = now;
    hudFps.textContent = `FPS: ${fps}`;
    isRequestPending = false;
  }
}

// Draw real-time bounding boxes directly on top of the live video
function renderBoundingBoxes(detections) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  detections.forEach((item) => {
    const { box, color, class_name, bin, confidence } = item;

    // Scale coordinates from 480px model space back to display canvas size
    const x1 = box.x1 * scaleX;
    const y1 = box.y1 * scaleY;
    const width = box.width * scaleX;
    const height = box.height * scaleY;

    // Draw outer bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x1, y1, width, height);

    // Draw label pill
    const label = `${class_name} [${bin}] ${(confidence * 100).toFixed(0)}%`;
    ctx.font = "bold 15px 'Segoe UI', sans-serif";
    const textWidth = ctx.measureText(label).width;

    ctx.fillStyle = color;
    ctx.fillRect(x1, Math.max(0, y1 - 26), textWidth + 12, 26);

    // Draw label text
    ctx.fillStyle = bin === "WHITE" || bin === "YELLOW" ? "#000" : "#FFF";
    ctx.fillText(label, x1 + 6, Math.max(18, y1 - 8));
  });
}

// Update Dashboard Numbers & Log
function updateTelemetry(summary, detections, hasSharps) {
  countRed.textContent = summary.RED || 0;
  countYellow.textContent = summary.YELLOW || 0;
  countWhite.textContent = summary.WHITE || 0;
  countBlue.textContent = summary.BLUE || 0;

  if (hasSharps) {
    sharpsAlarm.classList.remove("hidden");
  } else {
    sharpsAlarm.classList.add("hidden");
  }

  if (detections.length === 0) {
    detectionList.innerHTML = `<li class="empty-state">Awaiting objects in CCTV view...</li>`;
  } else {
    detectionList.innerHTML = detections
      .slice(0, 5)
      .map(
        (d) => `
        <li class="log-entry" style="border-left: 4px solid ${d.color};">
          <span><strong>${d.class_name}</strong> &rarr; ${d.bin} Bin</span>
          <span style="color: ${d.color};">${(d.confidence * 100).toFixed(0)}%</span>
        </li>
      `
      )
      .join("");
  }
}

// Control Event Listeners
toggleStreamBtn.addEventListener("click", () => {
  isStreaming = !isStreaming;
  if (!isStreaming) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    toggleStreamBtn.innerHTML = `<i class="fa-solid fa-play"></i> Resume CCTV`;
    statusText.textContent = "CCTV PAUSED";
  } else {
    toggleStreamBtn.innerHTML = `<i class="fa-solid fa-pause"></i> Pause CCTV`;
    statusText.textContent = "LIVE CCTV STREAMING";
  }
});

switchCamBtn.addEventListener("click", async () => {
  currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
  if (video.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
  }
  await initCamera();
});

// Launch on page load
window.addEventListener("DOMContentLoaded", initCamera);
