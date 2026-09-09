import base64
import io
import os
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
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
async def scan_waste(file: UploadFile = File(None), image: UploadFile = File(None)):
    try:
        active_file = file or image
        if not active_file:
            return {"error": "No image file provided."}

        contents = await active_file.read()
        image_obj = Image.open(io.BytesIO(contents)).convert("RGB")
        
        #AI inference
        results = model(image_obj)
        category = "Safe Waste"
        confidence = 97.0
        action = "Standard Disposal"
        if len(results[0].boxes) > 0:
            best_box = results[0].boxes[0]
            cls_id = int(best_box.cls[0])
            confidence = float(best_box.conf[0])
            category = model.names[cls_id]
            action = f"Handle according to {category} protocol"
        #DRAW BOUNDING BOXES
        annotated_frame = results[0].plot()
        annotated_frame = annotated_frame[..., ::-1] # Convert BGR to RGB
        annotated_pil = Image.fromarray(annotated_frame) 
        buffered = io.BytesIO()
        annotated_pil.save(buffered, format="JPEG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return {
            "category": category,
            "confidence": round(confidence * 100, 2),
            "action": action,
            "image": img_base64  # Send boxed image to frontend
        }
    except Exception as e:
        return {"error": str(e)}
