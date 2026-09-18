import os
import io
import base64
import gc
import zipfile
import numpy as np
import cv2
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch

# Prevent Render Free Tier from crashing
torch.set_num_threads(1)

from ultralytics import YOLO

# ==========================================
# 1. AUTO-UNZIP & DEEP SEARCH LOGIC
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")
ZIP_PATH = os.path.join(MODEL_DIR, "best.pt.zip")

# Unzip if the zip file exists
if os.path.exists(ZIP_PATH):
    print(f">>> Extracting model from {ZIP_PATH}...")
    with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
        zip_ref.extractall(MODEL_DIR)
    print(">>> Extraction complete. Hunting for best.pt...")

# Search every folder inside MODEL_DIR to find exactly where best.pt landed
PT_PATH = None
for root, dirs, files in os.walk(MODEL_DIR):
    if "best.pt" in files:
        PT_PATH = os.path.join(root, "best.pt")
        break

if not PT_PATH:
    print("CRITICAL WARNING: best.pt not found anywhere inside the model directory!")
    PT_PATH = "best.pt"  # Failsafe fallback

print(f">>> Successfully located and loading YOLO model from: {PT_PATH}")
model = YOLO(PT_PATH)

# ==========================================
# 2. FASTAPI SERVER SETUP
# ==========================================
app = FastAPI(title="VesTech BinGo Manual Scan")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

BIN_RULES = {
    "IV_Tube": {"bin": "RED", "color": "#EF4444", "category": "Contaminated Plastics", "action": "Autoclave"},
    "Medical_Glove": {"bin": "RED", "color": "#EF4444", "category": "Contaminated Plastics", "action": "Autoclave"},
    "Blood_Bag": {"bin": "YELLOW", "color": "#FACC15", "category": "Biohazard", "action": "Incineration"},
    "Blood_Soiled": {"bin": "YELLOW", "color": "#FACC15", "category": "Biohazard", "action": "Incineration"},
    "Anatomical_Tissue": {"bin": "YELLOW", "color": "#FACC15", "category": "Pathological", "action": "Incineration"},
    "Syringe_Sharps": {"bin": "WHITE", "color": "#F8FAFC", "category": "Sharps", "action": "Sharps Pit"},
    "Glass_Ampoule": {"bin": "BLUE", "color": "#3B82F6", "category": "Glassware", "action": "Decontamination"},
    "Broken_Glass": {"bin": "BLUE", "color": "#3B82F6", "category": "Glassware", "action": "Decontamination"}
}

class FramePayload(BaseModel):
    image: str

@app.get("/")
def health_check():
    return {"status": "online"}

@app.post("/detect_frame")
def detect_frame(payload: FramePayload):
    try:
        encoded_data = payload.image
        if "," in encoded_data:
            encoded_data = encoded_data.split(",")[1]

        image_bytes = base64.b64decode(encoded_data)
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_w, img_h = pil_img.size

        # High-res inference for photo click mode
        with torch.no_grad():
            results = model.predict(source=pil_img, conf=0.10, imgsz=640, device='cpu', verbose=False)[0]

        detections = []
        bin_counts = {"RED": 0, "YELLOW": 0, "WHITE": 0, "BLUE": 0, "GREEN": 0}

        # AI DETECTION
        for box in results.boxes:
            cls_id = int(box.cls[0])
            cls_name = model.names[cls_id]
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()

            rule = BIN_RULES.get(cls_name, {"bin": "GENERAL", "color": "#10B981", "category": "General", "action": "Bin"})
            bin_name = rule["bin"]
            if bin_name in bin_counts:
                bin_counts[bin_name] += 1

            detections.append({
                "class_name": cls_name,
                "confidence": round(conf, 2),
                "bin": bin_name,
                "color": rule["color"],
                "box": {"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2), "width": int(x2 - x1), "height": int(y2 - y1)}
            })

        # OPENCV FALLBACK (Safe Waste)
        if len(detections) == 0:
            cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2GRAY)
            blurred = cv2.GaussianBlur(cv_img, (7, 7), 0)
            edges = cv2.Canny(blurred, 15, 50) 
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if contours:
                contours = sorted(contours, key=cv2.contourArea, reverse=True)
                screen_area = img_w * img_h
                
                for c in contours:
                    x, y, w, h = cv2.boundingRect(c)
                    area = w * h
                    
                    if 1000 < area < (screen_area * 0.20):
                        detections.append({
                            "class_name": "Safe Waste",
                            "confidence": 1.0,
                            "bin": "GREEN",
                            "color": "#10B981",
                            "box": {"x1": int(x), "y1": int(y), "x2": int(x+w), "y2": int(y+h), "width": int(w), "height": int(h)}
                        })
                        bin_counts["GREEN"] += 1
                        break 

        del pil_img
        del image_bytes
        del results
        gc.collect()

        return {
            "success": True,
            "frame_dimensions": {"width": img_w, "height": img_h},
            "detections": detections,
            "bin_summary": bin_counts,
            "has_sharps": bin_counts["WHITE"] > 0
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
