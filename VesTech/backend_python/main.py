import os
import io
import base64
import gc
import shutil
import requests
import numpy as np
import cv2
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch

torch.set_num_threads(1)
from ultralytics import YOLO

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "YOUR_GROQ_API_KEY_HERE")
GROQ_VISION_MODEL = "llama-3.2-11b-vision-preview"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")
ZIP_PATH = os.path.join(MODEL_DIR, "best.pt.zip")
PT_PATH = os.path.join(MODEL_DIR, "best_working.pt")

if os.path.exists(ZIP_PATH) and not os.path.exists(PT_PATH):
    print(f">>> Renaming {ZIP_PATH} to {PT_PATH} to bypass extension check...")
    shutil.copy(ZIP_PATH, PT_PATH)

if not os.path.exists(PT_PATH):
    PT_PATH = "best.pt"

print(f">>> Loading YOLO model from: {PT_PATH}")
model = YOLO(PT_PATH)

app = FastAPI(title="VesTech BinGo Smart Scanner")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

BIN_RULES = {
    "IV_Tube": {"bin": "RED", "color": "#EF4444"},
    "Medical_Glove": {"bin": "RED", "color": "#EF4444"},
    "Blood_Bag": {"bin": "YELLOW", "color": "#FACC15"},
    "Blood_Soiled": {"bin": "YELLOW", "color": "#FACC15"},
    "Anatomical_Tissue": {"bin": "YELLOW", "color": "#FACC15"},
    "Syringe_Sharps": {"bin": "WHITE", "color": "#F8FAFC"},
    "Glass_Ampoule": {"bin": "BLUE", "color": "#3B82F6"},
    "Broken_Glass": {"bin": "BLUE", "color": "#3B82F6"}
}

COLOR_MAP = {"RED": "#EF4444", "YELLOW": "#FACC15", "WHITE": "#F8FAFC", "BLUE": "#3B82F6", "GREEN": "#10B981"}

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

        # YOLO inference dialed to 25% sweet spot
        with torch.no_grad():
            results = model.predict(source=pil_img, conf=0.25, imgsz=640, device='cpu', verbose=False)[0]

        detections = []
        bin_counts = {"RED": 0, "YELLOW": 0, "WHITE": 0, "BLUE": 0, "GREEN": 0}

        # LAYER 1: YOLO AI DETECTION
        for box in results.boxes:
            cls_id = int(box.cls[0])
            cls_name = model.names[cls_id]
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()

            rule = BIN_RULES.get(cls_name, {"bin": "GREEN", "color": "#10B981"})
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

       # LAYER 2: HYBRID OPENCV + GROQ FALLBACK
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
                    
                    if 8000 < area < (screen_area * 0.40):
                        
                        # 1. Crop and RESIZE for Groq (Prevents payload size limits)
                        cropped_img = pil_img.crop((int(x), int(y), int(x+w), int(y+h)))
                        cropped_img.thumbnail((300, 300)) # Compress image to ensure API accepts it
                        buffered = io.BytesIO()
                        cropped_img.save(buffered, format="JPEG", quality=80)
                        cropped_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
                        
                        final_bin = "GREEN"
                        label_name = "Unknown Safe Waste"
                        
                        # 2. Interrogate Groq API
                        if GROQ_API_KEY and GROQ_API_KEY != "YOUR_GROQ_API_KEY_HERE":
                            try:
                                headers = {
                                    "Authorization": f"Bearer {GROQ_API_KEY}",
                                    "Content-Type": "application/json"
                                }
                                prompt = "Is this medical item a RED (plastic/glove), YELLOW (biohazard/blood), WHITE (sharp syringe), BLUE (glassware), or GREEN (general) bin item? Reply ONLY with the color word."
                                # Updated Payload formatting to satisfy Groq's strict API rules
                                groq_payload = {
                                    "model": "llama-3.2-11b-vision-instruct",  # <-- CHANGED: Removed '-preview', added '-instruct'
                                    "messages": [
                                        {
                                            "role": "user",
                                            "content": [
                                                {"type": "text", "text": prompt},
                                                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{cropped_b64}"}}
                                            ]
                                        }
                                    ],
                                    "temperature": 0.1,
                                    "max_tokens": 150
                                }
                                resp = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=groq_payload, timeout=12)
                                
                                if resp.status_code == 200:
                                    reply = resp.json()["choices"][0]["message"]["content"].strip().upper()
                                    if "BLUE" in reply or "GLASS" in reply:
                                        final_bin = "BLUE"
                                        label_name = "Groq: Glassware"
                                    elif "RED" in reply or "GLOVE" in reply:
                                        final_bin = "RED"
                                        label_name = "Groq: Plastics"
                                    elif "YELLOW" in reply or "BLOOD" in reply:
                                        final_bin = "YELLOW"
                                        label_name = "Groq: Biohazard"
                                    elif "WHITE" in reply or "SHARP" in reply or "SYRINGE" in reply:
                                        final_bin = "WHITE"
                                        label_name = "Groq: Sharps"
                                    else:
                                        label_name = "Groq: General Waste"
                                else:
                                    # THIS WILL PRINT THE EXACT API COMPLAINT IN YOUR RENDER LOGS
                                    print(f"GROQ 400 ERROR DETAILS: {resp.text}")
                                    label_name = f"Groq Error: HTTP {resp.status_code}"
                            except Exception as e:
                                # This will print Python connection errors on your app screen!
                                print(f"Groq API Error: {e}")
                                label_name = f"API Timeout/Err"
                        else:
                            label_name = "API Key Missing!"
                            
                        # Append the final result ONCE and break the loop
                        detections.append({
                            "class_name": label_name,
                            "confidence": 0.99, # High confidence mark indicating LLM override
                            "bin": final_bin,
                            "color": COLOR_MAP.get(final_bin, "#10B981"),
                            "box": {"x1": int(x), "y1": int(y), "x2": int(x+w), "y2": int(y+h), "width": int(w), "height": int(h)}
                        })
                        bin_counts[final_bin] += 1
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
