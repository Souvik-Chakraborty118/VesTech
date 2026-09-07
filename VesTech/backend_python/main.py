from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import io
import os
from PIL import Image

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "..", "model", "medical_waste_yolov8_best.pt")

model = YOLO(MODEL_PATH) 

@app.post("/api/scan")
async def scan_waste(image: UploadFile = File(...)):
    img_bytes = await image.read()
    img = Image.open(io.BytesIO(img_bytes))   
    results = model(img)
    top_pred = results[0].probs.top1
    confidence = float(results[0].probs.top1conf)
    category = model.names[top_pred]     
    return {"category": category, "confidence": confidence}