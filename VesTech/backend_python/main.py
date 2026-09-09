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
#Biomedical Waste Color Coding Logic
def assign_waste_bin(detected_class):
    label = detected_class.lower()
    
    #YELLOW
    if any(x in label for x in ["blood", "organ", "tissue", "cotton", "anatomical", "bandage"]):
        return "🟡 YELLOW BIN", "Deep Burial / Incineration"   
    #RED
    elif any(x in label for x in ["tube", "catheter", "syringe", "iv", "glove", "plastic"]):
        return "🔴 RED BIN", "Autoclaving & Recycling"      
    #WHITE
    elif any(x in label for x in ["needle", "scalpel", "blade", "sharp"]):
        return "⚪ WHITE BIN", "Puncture-proof container -> Shredding"        
    #BLUE
    elif any(x in label for x in ["glass", "vial", "ampoule", "bottle"]):
        return "🔵 BLUE BIN", "Disinfection & Recycling"      
    #Default fallback
    else:
        return f"Unknown: {detected_class.upper()}", "Manual Inspection Required"

@app.post("/api/scan")
async def scan_waste(file: UploadFile = File(None), image: UploadFile = File(None)):
    try:
        active_file = file or image
        if not active_file:
            return {"error": "No image file provided."}

        contents = await active_file.read()
        image_obj = Image.open(io.BytesIO(contents)).convert("RGB")
        
        # Make the AI more sensitive (conf=0.15 means it will report matches it is at least 15% sure of)
        results = model(image_obj, conf=0.15) 
        
        category = "Safe Waste / Not Recognized"
        confidence = 9.7
        action = "Standard Disposal"
        
        if len(results[0].boxes) > 0:
            best_box = results[0].boxes[0]
            cls_id = int(best_box.cls[0])
            confidence = float(best_box.conf[0])
            raw_class_name = model.names[cls_id]
            
            #Raw AI name to the official Color Bin
            category, action = assign_waste_bin(raw_class_name)

        #Draw Bounding Boxes
        annotated_frame = results[0].plot()
        annotated_frame = annotated_frame[..., ::-1] # BGR to RGB
        annotated_pil = Image.fromarray(annotated_frame)
        
        buffered = io.BytesIO()
        annotated_pil.save(buffered, format="JPEG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        return {
            "category": category,
            "confidence": round(confidence * 100, 2),
            "action": action,
            "image": img_base64 
        }
        
    except Exception as e:
        return {"error": str(e)}
