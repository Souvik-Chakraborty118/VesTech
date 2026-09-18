import os
import io
import base64
import gc
import numpy as np
import cv2
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch

torch.set_num_threads(1)

from ultralytics import YOLO

app = FastAPI(title="VesTech BinGo Live CCTV")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

MODEL_CANDIDATES = [
    os.path.join(os.path.dirname(__file__), "model", "medical_waste_yolov8_best.pt"),
    os.path.join(os.path.dirname(__file__), "model", "best.pt"),
    "best.pt"
]

model_path = next((p for p in MODEL_CANDIDATES if os.path.exists(p)), None)
if not model_path:
    model_path = "best.pt"

print(f">>> Loading YOLO model from: {model_path}")
model = YOLO(model_path)

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

        with torch.no_grad():
            results = model.predict(source=pil_img, conf=0.10, imgsz=640, device='cpu', verbose=False)[0]

        detections = []
        bin_counts = {"RED": 0, "YELLOW": 0, "WHITE": 0, "BLUE": 0, "GREEN": 0}

        # 1. AI DETECTION (Medical Waste)
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

        # 2. OPENCV FALLBACK (Safe Waste / Unknown Objects)
        # If YOLO found nothing, scan for any physical object in the frame
        if len(detections) == 0:
            cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2GRAY)
            blurred = cv2.GaussianBlur(cv_img, (15, 15), 0)
            edges = cv2.Canny(blurred, 30, 150)
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if contours:
                # Sort by largest shape first
                contours = sorted(contours, key=cv2.contourArea, reverse=True)
                for c in contours:
                    area = cv2.contourArea(c)
                    # Ignore tiny camera noise, and ignore massive background shapes
                    if 3000 < area < (img_w * img_h * 0.5):
                        x, y, w, h = cv2.boundingRect(c)
                        detections.append({
                            "class_name": "Safe Waste (Unknown)",
                            "confidence": 1.0,
                            "bin": "GREEN",
                            "color": "#10B981",
                            "box": {"x1": int(x), "y1": int(y), "x2": int(x+w), "y2": int(y+h), "width": int(w), "height": int(h)}
                        })
                        bin_counts["GREEN"] += 1
                        break # Only box the single largest unrecognized object

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
