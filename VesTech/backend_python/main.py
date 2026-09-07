from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import io
import os
from PIL import Image

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model", "medical_waste_yolov8_best.pt")

model = YOLO(MODEL_PATH)

@app.post("/api/scan")
async def scan_waste(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
        #YOLO inference
        results = model(image)
        
        category = "Safe Waste"
        confidence = 0.0
        action = "Standard Disposal"
        
        #bounding boxes were detected
        if len(results[0].boxes) > 0:
            # Extract the top detection
            best_box = results[0].boxes[0]
            cls_id = int(best_box.cls[0])
            confidence = float(best_box.conf[0])
            category = model.names[cls_id]
            action = f"Handle according to {category} protocol"
        
        return {
            "category": category,
            "confidence": round(confidence * 100, 2),
            "action": action
        }
        
    except Exception as e:
        return {"error": str(e)}
