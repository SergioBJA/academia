from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import json
import time
import datetime
import uuid
import re
from google.oauth2 import service_account
from googleapiclient.discovery import build
import google.auth.transport.requests

app = FastAPI(title="Academia Admin API - Python Edition")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURATION ---
# In production, these should be environment variables
GOOGLE_SERVICE_ACCOUNT_EMAIL = os.getenv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'academia-universal-worker@academia-universal-490517.iam.gserviceaccount.com')
GOOGLE_PRIVATE_KEY = os.getenv('GOOGLE_PRIVATE_KEY', '').replace('\\n', '\n')
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID', '1u5e05TMsfuYoWSgDlORFt2pT_kEyvWYhjLq3pHxYU4E')

# Fallback for local testing if env vars are missing
if not GOOGLE_PRIVATE_KEY:
    # Note: In a real scenario, never hardcode private keys. 
    # This is for the migration demonstration.
    GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VFXJoI6c6+Cq\nwwhG8knTU/YQiUeDdvxknqLBotcOjiKtfqxajS0rrL875T1inLfk88aefRhYqK/k\nPYPbdSL61IfaOAWrLR5MAEvjohnVGqgfZdUqjEz3SvcEZVtUbA8xfw4MAXH6WlT/\nKxO3iXrZFWk/VbutsEfYt4ix/mWneF8ZxrTNQZrBqUP2e+NcshAwENi6aaiuRGpI\nSpd63BSIynkPwfTzAGVJ5LVAmTllNDZqI3AZE0GyLyFu0aveVe9yzl3ZN0SptR/a\n2ZZjy/qZ17o+XzSRuWqbshaIdV3ei248WPHfial32phITRER+faGJ7doV86JemI3\nW2ww/0VzAgMBAAECggEAXO2+TPKQLLo6zptHvOIuy14IYDWpu0bIeCXV+ZcNdlP+\nUfDYEWedc+ATUeQrqoKyGyrvaeoGrNypvODjS3f1bVcHObK25S7Rq8Qt4XOluvip\nVEIRGDVXbQnMNmsNfnjIpLYxwrTo1NgA+EBnXJIf1hbwChI+szASxChv8FSSGxwa\nkxHlae47sg2OBWXJm/KlmtpjPTDabn7SaGGHg9HedlEuVvITO0o4z0scSDKnk8DD\nUeTEaxU54/ZE784wGGuRg4eBsxBlR0Gte5iX91k4IxOw8iFsrXikMgYOj4rkDoOU\n9meyI9cUjFMcPngYbrOwWyo5vStgsTkZRoMTzg7jGQKBgQDt/Y1U0JDrNW5tFSyV\n+AGCVFh6ysrXhEOKT3Ma5qoDgGkz5XZ/fTz/1ib5FJLV6yQIl6MVqg3xDuMCWBf5\nHTCYHtD9E44wJg8eEn7MsOKblXO4RN/h77NCJizrxWBxp9w2pt1ioCOWJVuwHhn/\nZBD2HbKK9Obw0rtd9gI1DQETjQKBgQDJgVt9hFO5pe/0YKFSDpUnvbAVHkJGHBx5\nlNrbjjE+0fCtyhuA0dddWG8REd3+0yhiRoEXSoK4e2u8xSuz2iIvHxET3hv6hikj\nl7DthvbC7mg2Xw5+ekOwq61mX5I4lznG1SAGX4Ia0r8X5uM9mH3A9Vrn5wSwy1rQ\nEVggUeb8/wKBgBGA2GgofsANyfVT3VeaSeIf+fHuAEUhgSYm+bw8wrxHMXWTpsdx\nmo7mXS9sh/AbvyayoFfzjdrw0VlWyUyVDQHjIlO6oHaCFhKMIa9EQyZWM5CV4DFp\nw7FVxXABsDorslKCqz2ZsYRVcwzc6eSSo3y2am8129ZSaV1bvoXQUwfxAoGANnPc\nc2jE71AmLdXHAlOqftjFso9AvY1vLHPLSLV+HUnCTlRlZkROfI0fRm+bm/cX3KbM\nz6x08sF3dcWab7msrysoBERrLyH+D/4385gbKsYeJ0M8uXT0wdNCwn1lGCHVnSOO\nyeoZUIJO3XipQ8XnhbNH448MN3Jckgl91Q4M66UCgYEAohGHdwsWM9xeZ0XnaffN\nm0PIf3WYH0EHmT/IXBft90M2OEM8ihofmHPtd+WJWTD0eIbbMXCLx0314RQg4/Sh\nEA2F1WCHd6AM0+ZwZJQWyPeqJhkE6np8oNarU6VBQLbHFPlF0pBAYSINyx75HDID\n2Nx6y1Rqr2/4UDu8B+ebMeI=\n-----END PRIVATE KEY-----\n".replace('\\n', '\n')

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/contacts.readonly'
]

# --- GOOGLE SHEETS CLIENT ---
def get_sheets_service():
    creds_dict = {
        "type": "service_account",
        "project_id": "academia-universal-490517",
        "private_key_id": "f8a0a8b9e6e4a8b9e6e4a8b9e6e4a8b9e6e4a8b9", # Placeholder
        "private_key": GOOGLE_PRIVATE_KEY,
        "client_email": GOOGLE_SERVICE_ACCOUNT_EMAIL,
        "client_id": "111111111111111111111",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{GOOGLE_SERVICE_ACCOUNT_EMAIL}"
    }
    creds = service_account.Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
    return build('sheets', 'v4', credentials=creds)

# --- DATA MANAGEMENT (JSON Database) ---
DATA_FILE = 'app_data.json'

def load_app_data():
    defaults = {
        'notas': [],
        'anulados': [],
        'trimester_checks': {},
        'teacher_notes': {},
        'snapshots': [],
        'day_overrides': {},
        'highlights': [],
        'settings': {
            'adminUser': 'Admin',
            'adminPass': 'Admin-1234',
            'teacherUsers': 'teacher1,teacher2,teacher3,teacher4',
            'passA': '2020',
            'passB': 'certificados123',
            'masterKey': 'admin99'
        },
        'waiting_list': [],
        'student_log': [],
        'web_config': {
            'attendance_pdf_note': 'NOTA: Las clases a las que el alumnado no ha asistido tienen un plazo del mismo mes para recuperarlas.',
            'whatsapp_templates': {
                'certificados': "Hola, adjunto el certificado...",
                'notas_exam_wow': "WOW, *{nombre}*!!!...",
                # ... other templates ...
            }
        }
    }
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
                # Merge with defaults to ensure all keys exist
                for k, v in defaults.items():
                    if k not in data:
                        data[k] = v
                return data
            except:
                return defaults
    return defaults

def save_app_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

# --- HELPERS ---
def ok(body):
    if isinstance(body, dict):
        return {"success": True, **body}
    return body

# --- API ENDPOINTS ---

# --- REUSABLE UTILS ---
def cell_to_html(cell):
    # Port of PHP cellToHtml logic
    # This converts Google Sheets formatted cells (bold, italic, colors) to HTML
    text = cell.get('userEnteredValue', {}).get('stringValue', '')
    runs = cell.get('textFormatRuns', [])
    if not runs:
        return text
    
    html = ""
    for i in range(len(runs)):
        start = runs[i].get('startIndex', 0)
        end = runs[i+1].get('startIndex', len(text)) if i+1 < len(runs) else len(text)
        chunk = text[start:end]
        
        fmt = runs[i].get('format', {})
        styles = []
        if fmt.get('bold'): styles.append("font-weight:bold")
        if fmt.get('italic'): styles.append("font-style:italic")
        if fmt.get('underline'): styles.append("text-decoration:underline")
        if fmt.get('foregroundColor'):
            rgb = fmt['foregroundColor']
            r = int(rgb.get('red', 0) * 255)
            g = int(rgb.get('green', 0) * 255)
            b = int(rgb.get('blue', 0) * 255)
            styles.append(f"color:rgb({r},{g},{b})")
            
        if styles:
            html += f"<span style='{';'.join(styles)}'>{chunk}</span>"
        else:
            html += chunk
    return html

# --- DATA MODELS ---
class LoginRequest(BaseModel):
    username: str
    password: str

class SaveTrimesterChecks(BaseModel):
    studentId: str
    checks: Dict[str, Any]

class SaveTeacherNote(BaseModel):
    studentId: str
    note: str

class GenericAction(BaseModel):
    action: str
    data: Optional[Dict[str, Any]] = None

# --- AUTH ENDPOINTS ---

@app.post("/api/global_login")
async def global_login(req: LoginRequest):
    data = load_app_data()
    settings = data.get('settings', {})
    
    if req.username == settings.get('adminUser') and req.password == settings.get('adminPass'):
        return ok({"role": "admin"})
    
    teachers = [t.strip() for t in settings.get('teacherUsers', '').split(',')]
    if req.username in teachers and req.password == settings.get('passA'):
        return ok({"role": "teacher"})
        
    raise HTTPException(status_code=401, detail="Credenciales incorrectas")

# --- NOTAS ENDPOINTS ---

@app.get("/api/get_notas")
async def get_notas(alumno_id: str, nombre_alumno: str = "", grado_academico: str = ""):
    data = load_app_data()
    notas = data.get('notas', [])
    
    found = [n for n in notas if n[0] == alumno_id]
    if not found and nombre_alumno:
        found = [n for n in notas if n[1] == nombre_alumno]
        
    if grado_academico and grado_academico != "TODOS":
        found = [n for n in found if n[11] == grado_academico]
        
    return ok({"notas": found})

@app.post("/api/add_nota")
async def add_nota(request: Request):
    body = await request.json()
    data = load_app_data()
    
    new_row = [
        body.get('alumno_id'),
        body.get('nombre_alumno', ''),
        body.get('curso'),
        body.get('fecha_reading', ''),
        body.get('reading', ''),
        body.get('fecha_writing', ''),
        body.get('writing', ''),
        body.get('fecha_listening', ''),
        body.get('listening', ''),
        body.get('media', 0),
        f"n{uuid.uuid4()}", # unique ID
        body.get('grado_academico', '')
    ]
    
    data['notas'].append(new_row)
    save_app_data(data)
    return ok({"message": "Nota añadida"})

@app.post("/api/save_trimester_checks")
async def save_trimester_checks(req: SaveTrimesterChecks):
    data = load_app_data()
    data['trimester_checks'][req.studentId] = req.checks
    save_app_data(data)
    return ok({"status": "saved"})

@app.get("/api/get_icon")
async def get_icon(url: Optional[str] = None, sheetName: Optional[str] = None):
    # Proxy logic to avoid CORS and handle Google Sheets icons
    if url:
        try:
            res = requests.get(url, timeout=10)
            return Response(content=res.content, media_type=res.headers.get('Content-Type'))
        except:
            raise HTTPException(status_code=404)
    # ... sheetName logic ...
    raise HTTPException(status_code=404)

@app.get("/api/get_course_students_from_data")
async def get_course_students_from_data(grado: str):
    data = load_app_data()
    notas = data.get('notas', [])
    students = []
    seen = set()
    for n in notas:
        if n[2] == grado or n[11] == grado:
            sid, name = n[0], n[1]
            if sid not in seen:
                students.append({"id": sid, "name": name})
                seen.add(sid)
    students.sort(key=lambda x: x['name'])
    return ok({"students": students})

# Main execution
if __name__ == "__main__":
    import uvicorn
    from fastapi import Response
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
