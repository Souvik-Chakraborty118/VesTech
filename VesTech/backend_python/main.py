import os
import io
import base64
import numpy as np
import cv2
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --- CRITICAL RENDER FREE TIER OPTIMIZATIONS ---
import torch
torch.set_num_threads(1)  # Prevents CPU thread exhaustion on Render
# -----------------------------------------------

from ultralytics import YOLO

app = FastAPI(title="VesTech BinGo Live CCTV Detection Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_CANDIDATES = [
    os.path.join(os.path.dirname(__file__), "model", "best.pt"),
    os.path.join(os.path.dirname(__file__), "model", "medical_waste_yolov8_best.pt"),
    os.path.join(os.path.dirname(__file__), "best.pt"),
    "best.pt"
]

model_path = next((p for p in MODEL_CANDIDATES if os.path.exists(p)), None)
if not model_path:
    model_path = os.path.join(os.path.dirname(__file__), "model", "medical_waste_yolov8_best.pt")

print(f">>> Loading YOLO model from: {model_path}")
model = YOLO(model_path)

BIN_RULES = {
    "IV_Tube": {"bin": "RED", "color": "#EF4444", "category": "Contaminated Recyclable Plastics", "action": "Route to Autoclave"},
    "Medical_Glove": {"bin": "RED", "color": "#EF4444", "category": "Contaminated Recyclable Plastics", "action": "Route to Autoclave"},
    "Blood_Bag": {"bin": "YELLOW", "color": "#FACC15", "category": "Infectious Biohazard", "action": "Incineration"},
    "Blood_Soiled": {"bin": "YELLOW", "color": "#FACC15", "category": "Infectious Biohazard", "action": "Incineration"},
    "Anatomical_Tissue": {"bin": "YELLOW", "color": "#FACC15", "category": "Pathological Waste", "action": "Incineration"},
    "Syringe_Sharps": {"bin": "WHITE", "color": "#F8FAFC", "category": "Puncture-Proof Sharps", "action": "Sharps Pit"},
    "Glass_Ampoule": {"bin": "BLUE", "color": "#3B82F6", "category": "Disinfected Glassware", "action": "Decontamination"},
    "Broken_Glass": {"bin": "BLUE", "color": "#3B82F6", "category": "Disinfected Glassware", "action": "Decontamination"}
}

class FramePayload(BaseModel):
    image: str

@app.get("/")
def health_check():
    return {"status": "online", "service": "VesTech BinGo CCTV Backend"}

@app.post("/detect_frame")
async def detect_frame(payload: FramePayload):
    try:
        encoded_data = payload.image
        if "," in encoded_data:
            encoded_data = encoded_data.split(",")[1]

        image_bytes = base64.b64decode(encoded_data)
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_w, img_h = pil_img.size

        # EXTREME OPTIMIZATION: imgsz=320, cpu execution to save RAM
        results = model.predict(source=pil_img, conf=0.15, imgsz=320, device='cpu', verbose=False)[0]

        detections = []
        bin_counts = {"RED": 0, "YELLOW": 0, "WHITE": 0, "BLUE": 0}

        for box in results.boxes:
            cls_id = int(box.cls[0])
            cls_name = model.names[cls_id]
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()

            rule = BIN_RULES.get(cls_name, {
                "bin": "GENERAL", "color": "#10B981", "category": "General", "action": "Bin"
            })

            bin_name = rule["bin"]
            if bin_name in bin_counts:
                bin_counts[bin_name] += 1

            detections.append({
                "class_name": cls_name,
                "confidence": round(conf, 2),
                "bin": bin_name,
                "color": rule["color"],
                "box": {
                    "x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2),
                    "width": int(x2 - x1), "height": int(y2 - y1)
                }
            })

        return {
            "success": True,
            "frame_dimensions": {"width": img_w, "height": img_h},
            "detections": detections,
            "bin_summary": bin_counts,
            "has_sharps": bin_counts["WHITE"] > 0
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
