import os
import io
import base64
import numpy as np
import cv2
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO

app = FastAPI(title="VesTech BinGo Live CCTV Detection Server")

#Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#Automatic Model Path Resolution
MODEL_CANDIDATES = [
    os.path.join(os.path.dirname(__file__), "model", "best.pt"),
    os.path.join(os.path.dirname(__file__), "model", "medical_waste_yolov8_best.pt"),
    os.path.join(os.path.dirname(__file__), "best.pt"),
    "best.pt"
]

model_path = next((p for p in MODEL_CANDIDATES if os.path.exists(p)), None)
if not model_path:
    # Default fallback to model folder
    model_path = os.path.join(os.path.dirname(__file__), "model", "medical_waste_yolov8_best.pt")

print(f">>> Loading YOLO model from: {model_path}")
model = YOLO(model_path)

#Biomedical Segregation Mapping & Color Rules
BIN_RULES = {
    "IV_Tube": {
        "bin": "RED",
        "color": "#EF4444",
        "category": "Contaminated Recyclable Plastics",
        "action": "Route to Autoclave / Shredding"
    },
    "Medical_Glove": {
        "bin": "RED",
        "color": "#EF4444",
        "category": "Contaminated Recyclable Plastics",
        "action": "Route to Autoclave / Shredding"
    },
    "Blood_Bag": {
        "bin": "YELLOW",
        "color": "#FACC15",
        "category": "Infectious Biohazard",
        "action": "Route to High-Temp Incineration"
    },
    "Blood_Soiled": {
        "bin": "YELLOW",
        "color": "#FACC15",
        "category": "Infectious Biohazard",
        "action": "Route to High-Temp Incineration"
    },
    "Anatomical_Tissue": {
        "bin": "YELLOW",
        "color": "#FACC15",
        "category": "Pathological Waste",
        "action": "Deep Burial / Incineration"
    },
    "Syringe_Sharps": {
        "bin": "WHITE",
        "color": "#F8FAFC",
        "category": "Puncture-Proof Sharps",
        "action": "Sharps Pit / Autoclave Encapsulation"
    },
    "Glass_Ampoule": {
        "bin": "BLUE",
        "color": "#3B82F6",
        "category": "Disinfected Glassware",
        "action": "Sodium Hypochlorite Decontamination"
    },
    "Broken_Glass": {
        "bin": "BLUE",
        "color": "#3B82F6",
        "category": "Disinfected Glassware",
        "action": "Sodium Hypochlorite Decontamination"
    }
}

class FramePayload(BaseModel):
    image: str  # Base64 data URL from browser canvas

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "VesTech BinGo CCTV Backend",
        "model_loaded": os.path.basename(model_path),
        "total_classes": len(model.names)
    }

@app.post("/detect_frame")
async def detect_frame(payload: FramePayload):
    """
    Continuous CCTV detection endpoint.
    """
    try:
        # Strip header if present: 'data:image/jpeg;base64,...'
        encoded_data = payload.image
        if "," in encoded_data:
            encoded_data = encoded_data.split(",")[1]

        image_bytes = base64.b64decode(encoded_data)
        # Load as PIL Image (RGB)
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_w, img_h = pil_img.size

        # Pass PIL image DIRECTLY to YOLO. It handles RGB formatting automatically.
        # Dropped confidence to 0.15 to better catch webcam motion blur
        results = model.predict(source=pil_img, conf=0.15, imgsz=640, verbose=False)[0]

        detections = []
        bin_counts = {"RED": 0, "YELLOW": 0, "WHITE": 0, "BLUE": 0}

        for box in results.boxes:
            cls_id = int(box.cls[0])
            cls_name = model.names[cls_id]
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()

            rule = BIN_RULES.get(cls_name, {
                "bin": "GENERAL",
                "color": "#10B981",
                "category": "General Waste",
                "action": "Municipal Solid Waste Bin"
            })

            bin_name = rule["bin"]
            if bin_name in bin_counts:
                bin_counts[bin_name] += 1

            detections.append({
                "class_name": cls_name,
                "confidence": round(conf, 2),
                "bin": bin_name,
                "color": rule["color"],
                "category": rule["category"],
                "action": rule["action"],
                "box": {
                    "x1": int(x1),
                    "y1": int(y1),
                    "x2": int(x2),
                    "y2": int(y2),
                    "width": int(x2 - x1),
                    "height": int(y2 - y1)
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
