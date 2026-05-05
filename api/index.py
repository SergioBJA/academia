import json
import os
import time
import base64
import hashlib
import hmac
import re
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from fastapi import FastAPI, Request, HTTPException, Query, Body
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
from google.oauth2 import service_account
from google.auth.transport.requests import Request as GoogleRequest
import google.auth

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURATION ---
GOOGLE_EMAIL = os.environ.get('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'academia-universal-worker@academia-universal-490517.iam.gserviceaccount.com')
GOOGLE_KEY = os.environ.get('GOOGLE_PRIVATE_KEY', "").replace('\\n', '\n')
if not GOOGLE_KEY:
    # Fallback to the one from api.php (for initial setup if env vars are not set)
    GOOGLE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VFXJoI6c6+Cq\nwwhG8knTU/YQiUeDdvxknqLBotcOjiKtfqxajS0rrL875T1inLfk88aefRhYqK/k\nPYPbdSL61IfaOAWrLR5MAEvjohnVGqgfZdUqjEz3SvcEZVtUbA8xfw4MAXH6WlT/\nKxO3iXrZFWk/VbutsEfYt4ix/mWneF8ZxrTNQZrBqUP2e+NcshAwENi6aaiuRGpI\nSpd63BSIynkPwfTzAGVJ5LVAmTllNDZqI3AZE0GyLyFu0aveVe9yzl3ZN0SptR/a\n2ZZjy/qZ17o+XzSRuWqbshaIdV3ei248WPHfial32phITRER+faGJ7doV86JemI3\nW2ww/0VzAgMBAAECggEAXO2+TPKQLLo6zptHvOIuy14IYDWpu0bIeCXV+ZcNdlP+\nUfDYEWedc+ATUeQrqoKyGyrvaeoGrNypvODjS3f1bVcHObK25S7Rq8Qt4XOluvip\nVEIRGDVXbQnMNmsNfnjIpLYxwrTo1NgA+EBnXJIf1hbwChI+szASxChv8FSSGxwa\nkxHlae47sg2OBWXJm/KlmtpjPTDabn7SaGGHg9HedlEuVvITO0o4z0scSDKnk8DD\nUeTEaxU54/ZE784wGGuRg4eBsxBlR0Gte5iX91k4IxOw8iFsrXikMgYOj4rkDoOU\n9meyI9cUjFMcPngYbrOwWyo5vStgsTkZRoMTzg7jGQKBgQDt/Y1U0JDrNW5tFSyV\n+AGCVFh6ysrXhEOKT3Ma5qoDgGkz5XZ/fTz/1ib5FJLV6yQIl6MVqg3xDuMCWBf5\nHTCYHtD9E44wJg8eEn7MsOKblXO4RN/h77NCJizrxWBxp9w2pt1ioCOWJVuwHhn/\nZBD2HbKK9Obw0rtd9gI1DQETjQKBgQDJgVt9hFO5pe/0YKFSDpUnvbAVHkJGHBx5\nlNrbjjE+0fCtyhuA0dddWG8REd3+0yhiRoEXSoK4e2u8xSuz2iIvHxET3hv6hikj\nl7DthvbC7mg2Xw5+ekOwq61mX5I4lznG1SAGX4Ia0r8X5uM9mH3A9Vrn5wSwy1rQ\nEVggUeb8/wKBgBGA2GgofsANyfVT3VeaSeIf+fHuAEUhgSYm+bw8wrxHMXWTpsdx\nmo7mXS9sh/AbvyayoFfzjdrw0VlWyUyVDQHjIlO6oHaCFhKMIa9EQyZWM5CV4DFp\nw7FVxXABsDorslKCqz2ZsYRVcwzc6eSSo3y2am8129ZSaV1bvoXQUwfxAoGANnPc\nc2jE71AmLdXHAlOqftjFso9AvY1vLHPLSLV+HUnCTlRlZkROfI0fRm+bm/cX3KbM\nz6x08sF3dcWab7msrysoBERrLyH+D/4385gbKsYeJ0M8uXT0wdNCwn1lGCHVnSOO\nyeoZUIJO3XipQ8XnhbNH448MN3Jckgl91Q4M66UCgYEAohGHdwsWM9xeZ0XnaffN\nm0PIf3WYH0EHmT/IXBft90M2OEM8ihofmHPtd+WJWTD0eIbbMXCLx0314RQg4/Sh\nEA2F1WCHd6AM0+ZwZJQWyPeqJhkE6np8oNarU6VBQLbHFPlF0pBAYSINyx75HDID\n2Nx6y1Rqr2/4UDu8B+ebMeI=\n-----END PRIVATE KEY-----\n".replace('\\n', '\n')

SHEET_ID = os.environ.get('SPREADSHEET_ID', '1u5e05TMsfuYoWSgDlORFt2pT_kEyvWYhjLq3pHxYU4E')
DATA_FILE = 'app_data.json'

# --- HELPERS ---

def is_student(name):
    if not name or not isinstance(name, str):
        return False
    t = name.upper().strip()
    if not t or t == '0' or t == 'FALSE':
        return False
    
    blocked = [
        'MEMORIA', 'ASISTENCIA', 'CLASE ONLINE', 'CLASE RECUPERADA',
        'FACTURAR CLASE', 'VIAJE O ENFERMEDAD'
    ]
    if t in blocked:
        return False
    
    if 'CLASE ' in t or 'FACTURAR' in t or 'VIAJE' in t or 'ENFERMEDAD' in t:
        return False
    
    return True

def find_student_column(row):
    for idx, cell in enumerate(row):
        if cell and 'ALUMNO' in str(cell).upper():
            return idx
    return 2

def index_to_letter(i):
    l = ''
    while i >= 0:
        l = chr((i % 26) + 65) + l
        i = (i // 26) - 1
    return l

def norm_curso(s):
    if not isinstance(s, str):
        return ''
    s = s.lower()
    s = re.sub(r'an(?![a-z])', 'anual', s)
    s = re.sub(r'ex(?![a-z])', 'exams', s)
    s = re.sub(r'pr(?![a-z])', 'prepare', s)
    s = re.sub(r'perso(?![a-z])', 'personalizadas', s)
    s = re.sub(r'prl(?![a-z])', 'prepare level', s)
    s = re.sub(r'[^a-z0-9]', '', s)
    return s

def deduplicate_cursos(cursos):
    if not cursos:
        return []
    norm_to_longest = {}
    norm_order = {}
    for idx, c in enumerate(cursos):
        nc = norm_curso(c)
        if not nc:
            continue
        if nc not in norm_to_longest:
            norm_to_longest[nc] = c
            norm_order[nc] = idx
        elif len(c) > len(norm_to_longest[nc]):
            norm_to_longest[nc] = c
            
    sorted_keys = sorted(norm_order.keys(), key=lambda k: norm_order[k])
    return [norm_to_longest[k] for k in sorted_keys]

def parse_month_dates(headers_row):
    raw_dates = []
    current_year = datetime.now().year
    for j, date_val in enumerate(headers_row[5:], 5):
        date_val = str(date_val).strip()
        if not date_val:
            continue
        if '/' in date_val:
            p = date_val.split('/')
            try:
                d = int(p[0])
                m = int(p[1])
                y = int(p[2]) if len(p) > 2 else current_year
                if len(str(y)) == 2:
                    y += 2000
                raw_dates.append({'colIndex': j, 'dateStr': date_val, 'day': d, 'month': m, 'year': y})
            except:
                continue
    
    months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    res = []
    for rd in raw_dates:
        m_idx = rd['month'] - 1
        month_str = months[m_idx] + f" {rd['year']}" if 0 <= m_idx < 12 else 'Otros'
        res.append({'colIndex': rd['colIndex'], 'dateStr': rd['dateStr'], 'monthStr': month_str})
    return res

def get_google_credentials():
    scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/contacts.readonly'
    ]
    info = {
        "type": "service_account",
        "project_id": "academia-universal-490517",
        "private_key": GOOGLE_KEY,
        "client_email": GOOGLE_EMAIL,
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    creds = service_account.Credentials.from_service_account_info(info, scopes=scopes)
    return creds

def get_access_token():
    creds = get_google_credentials()
    creds.refresh(GoogleRequest())
    return creds.token

async def sheets_request(url, method='GET', body=None):
    token = get_access_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient(follow_redirects=True) as client:
        if method == 'GET':
            resp = await client.get(url, headers=headers)
        elif method == 'POST':
            resp = await client.post(url, headers=headers, json=body)
        elif method == 'PUT':
            resp = await client.put(url, headers=headers, json=body)
        else:
            raise Exception(f"Method {method} not supported")
        
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()

async def get_google_contacts():
    token = get_access_token()
    url = 'https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=1000'
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json"
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code >= 400: return {}
        data = resp.json()
        
        contacts = {}
        for conn in data.get('connections', []):
            name = conn.get('names', [{}])[0].get('displayName', '')
            phone = conn.get('phoneNumbers', [{}])[0].get('value', '')
            if name and phone:
                clean_phone = re.sub(r'[^\d+]', '', phone)
                contacts[name.strip()] = clean_phone
        return contacts

def load_app_data():
    defaults = {
        'notas': [],
        'anulados': [],
        'trimester_checks': {},
        'teacher_notes': {},
        'snapshots': [],
        'day_overrides': {},
        'highlights': {},
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
                'certificados': "Hola, adjunto el certificado de la Agencia Tributaria correspondiente al alumno/a *{nombre}*, perteneciente al año fiscal *{año}*.\n\nEl PDF con el certificado detallado acaba de ser descargado en tu dispositivo. (Acuérdate de adjuntarlo en este chat usando el clip 📎). ¡Gracias!",
                'notas_exam_wow': "WOW, *{nombre}*!!! Tus notas en *YES OF COURSE* son increíbles!! Tienes el PDF con el detalle adjunto.\n\n*\"The limit is the sky\"* y tú estás volando alto.\n\nEstamos súper orgullosos de tu nivel!!! Enjoy your success!!!",
                'notas_exam_good': "Hi, *{nombre}*!! Vaya nota has sacado en *YES OF COURSE*!! Échale un vistazo al PDF con el detalle.\n\nEstás muy cerca de la cima. Recuerda: *\"Consistency is the key to success\"*\n\nSigue brillando así!!! Great job!!!",
                'notas_exam_path': "Hey, *{nombre}*!! Ya tienes tu nota de *YES OF COURSE* disponibles en el PDF adjunto.\n\nVas por buen camino!!! Sigue dándole duro porque *\"Small steps, big results\"* es la clave.\n\nA por el siguiente nivel, you can do it!!",
                'notas_exam_error': "Hello, *{nombre}*!!! Ya están aquí tus notas de *YES OF COURSE*. Te enviamos el PDF con el detalle.\n\nDon't worry!! *\"Every expert was once a beginner\"*\n\nEstamos aquí para ayudarte a darle la vuelta a este resultado!! Let's work together!!!",
                'notas_trim_wow': "WOW, *{nombre}*!!! Tus notas en *YES OF COURSE* son increíbles!! Tienes el PDF con el detalle adjunto.\n\n*\"The limit is the sky\"* y tú estás volando alto.\n\nEstamos súper orgullosos de tu nivel!!! Enjoy your success!!!",
                'notas_trim_good': "Hi, *{nombre}*!! Vaya nota has sacado en *YES OF COURSE*!! Échale un vistazo al PDF con el detalle.\n\nEstás muy cerca de la cima. Recuerda: *\"Consistency is the key to success\"*\n\nSigue brillando así!!! Great job!!!",
                'notas_trim_path': "Hey, *{nombre}*!! Ya tienes tu nota de *YES OF COURSE* disponibles en el PDF adjunto.\n\nVas por buen camino!!! Sigue dándole duro porque *\"Small steps, big results\"* es la clave.\n\nA por el siguiente nivel, you can do it!!",
                'notas_trim_error': "Hello, *{nombre}*!!! Ya están aquí tus notas de *YES OF COURSE*. Te enviamos el PDF con el detalle.\n\nDon't worry!! *\"Every expert was once a beginner\"*\n\nEstamos aquí para ayudarte a darle la vuelta a este resultado!! Let's work together!!!",
                'asistencias': "Hola {nombre}, te recordamos tu horario de clase en YES OF COURSE. ¡Te esperamos!"
            }
        }
    }
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
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
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        return True
    except Exception as e:
        print(f"Error saving data: {e}")
        return False

# --- API ENDPOINTS ---

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "env": {
            "has_email": bool(GOOGLE_EMAIL),
            "has_key": bool(GOOGLE_KEY),
            "has_id": bool(SHEET_ID)
        }
    }

# Mocking ok and fail from PHP
def ok_response(body: Any):
    if isinstance(body, dict):
        body['success'] = True
    return JSONResponse(content=body)

@app.get("/")
async def read_index():
    try:
        with open('index.html', 'r', encoding='utf-8') as f:
            content = f.read()
        return Response(content=content, media_type="text/html")
    except:
        return JSONResponse(status_code=404, content={"error": "index.html not found"})

@app.get("/api")
@app.post("/api")
async def main_api(request: Request, action: Optional[str] = Query(None)):
    body = {}
    if request.method == "POST":
        try:
            body = await request.json()
        except:
            pass
    
    if not action:
        action = body.get('action', '')

    # Dispatcher
    try:
        if action == 'get_portal_init':
            return await get_portal_init()
        elif action == 'get_cursos':
            return await get_get_cursos()
        elif action == 'get_web_config':
            return get_web_config()
        elif action == 'global_login':
            return global_login(body)
        elif action == 'verify_portal_password':
            return verify_portal_password(body or request.query_params)
        elif action == 'get_server_info':
            return get_server_info()
        elif action == 'get_notas':
            return get_notas(request.query_params)
        elif action == 'get_all_notas':
            return get_all_notas()
        elif action == 'add_nota':
            return add_nota(body)
        elif action == 'edit_nota':
            return edit_nota(body)
        elif action == 'delete_nota':
            return delete_nota(body)
        elif action == 'toggle_anulado':
            return toggle_anulado(body)
        elif action == 'save_trimester_checks':
            return save_trimester_checks(body)
        elif action == 'save_workflow_checks':
            return save_workflow_checks(body)
        elif action == 'save_teacher_note':
            return save_teacher_note(body)
        elif action == 'get_statistics':
            return await get_statistics()
        elif action == 'reset_statistics':
            return reset_statistics()
        elif action == 'get_waiting_list':
            return get_waiting_list()
        elif action == 'add_waiting_entry':
            return add_waiting_entry(body)
        elif action == 'update_waiting_entry':
            return update_waiting_entry(body)
        elif action == 'delete_waiting_entry':
            return delete_waiting_entry(body)
        elif action == 'reset_waiting_list':
            return reset_waiting_list(body)
        elif action == 'get_portal_settings':
            return get_portal_settings(body or request.query_params)
        elif action == 'save_portal_settings':
            return save_portal_settings(body)
        elif action == 'save_web_config':
            return save_web_config(body)
        elif action == 'get_backup_info':
            return get_backup_info()
        elif action == 'get_sheets':
            return await get_sheets()
        elif action == 'get_historical_marks':
            return get_historical_marks()
        elif action == 'get_summary':
            return await get_summary(request.query_params)
        elif action == 'get_all_students':
            return await get_all_students()
        elif action == 'save_historical_marks':
            return save_historical_marks(body)
        elif action == 'save_day_override':
            return save_day_override(body)
        elif action == 'save_extra_columns':
            return save_extra_columns(body)
        elif action == 'save_highlight':
            return save_highlight(body)
        elif action == 'get_icon':
            return await get_icon(request.query_params)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    
    # ... more to follow ...
    
    return JSONResponse(status_code=400, content={"error": f"Action '{action}' not implemented"})

async def get_get_cursos():
    meta_url = f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}?fields=sheets.properties(title,sheetId)"
    meta = await sheets_request(meta_url)
    
    all_sheet_names = []
    ignore_patterns = [r'vacio', r'plantilla', r'config', r'asistencias']
    
    for sh in meta.get('sheets', []):
        name = sh['properties']['title']
        if name.lower() == 'notas':
            continue
        skip = False
        for p in ignore_patterns:
            if re.search(p, name, re.IGNORECASE):
                skip = True
                break
        if not skip:
            all_sheet_names.append(name)
            
    all_cursos = {}
    for name in all_sheet_names:
        all_cursos[name] = True
        range_url = f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/'{name}'!C2"
        try:
            data = await sheets_request(range_url)
            values = data.get('values', [])
            raw = values[0][0] if values and values[0] else ''
            if raw:
                parts = [p.strip() for p in re.split(r'[,;\n]', raw) if p.strip()]
                for c in parts:
                    all_cursos[c] = True
        except:
            continue
            
    cursos = list(all_cursos.keys())
    cursos = deduplicate_cursos(cursos)
    cursos.sort(key=str.lower)
    return ok_response({'cursos': cursos})

async def get_portal_init():
    meta_url = f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}?fields=sheets.properties(title,sheetId)"
    meta = await sheets_request(meta_url)
    
    all_sheet_names = []
    notas_sheet_name = None
    ignore_patterns = [r'vacio', r'plantilla', r'config', r'asistencias']
    
    for sh in meta.get('sheets', []):
        name = sh['properties']['title']
        if name.lower() == 'notas':
            notas_sheet_name = name
            continue
        skip = False
        for p in ignore_patterns:
            if re.search(p, name, re.IGNORECASE):
                skip = True
                break
        if not skip:
            all_sheet_names.append(name)

    ranges = []
    for name in all_sheet_names:
        ranges.append(f"'{name}'!C2")
        ranges.append(f"'{name}'!C4")
        ranges.append(f"'{name}'!E2")
        ranges.append(f"'{name}'!E4")
        ranges.append(f"'{name}'!G2")
        ranges.append(f"'{name}'!G4")
        ranges.append(f"'{name}'!C7:C")
        
    query_params = "&".join([f"ranges={httpx.utils.quote(r)}" for r in ranges])
    batch_url = f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values:batchGet?{query_params}"
    batch_data = await sheets_request(batch_url)
    value_ranges = batch_data.get('valueRanges', [])
    
    all_students = []
    sheet_meta = {}
    vr_idx = 0
    
    for name in all_sheet_names:
        c2_data = value_ranges[vr_idx]['values'][0][0] if vr_idx < len(value_ranges) and value_ranges[vr_idx].get('values') else ''
        vr_idx += 1
        c4_data = value_ranges[vr_idx]['values'][0][0] if vr_idx < len(value_ranges) and value_ranges[vr_idx].get('values') else ''
        vr_idx += 1
        e2_data = value_ranges[vr_idx]['values'][0][0] if vr_idx < len(value_ranges) and value_ranges[vr_idx].get('values') else ''
        vr_idx += 1
        e4_data = value_ranges[vr_idx]['values'][0][0] if vr_idx < len(value_ranges) and value_ranges[vr_idx].get('values') else ''
        vr_idx += 1
        g2_data = value_ranges[vr_idx]['values'][0][0] if vr_idx < len(value_ranges) and value_ranges[vr_idx].get('values') else ''
        vr_idx += 1
        g4_data = value_ranges[vr_idx]['values'][0][0] if vr_idx < len(value_ranges) and value_ranges[vr_idx].get('values') else ''
        vr_idx += 1
        
        icon_url = f"/api?action=get_icon&sheetName={httpx.utils.quote(name)}"
        if isinstance(e2_data, str) and e2_data.startswith('http'):
            icon_url = f"/api?action=get_icon&url={httpx.utils.quote(e2_data)}"
            
        sheet_meta[name] = {
            'c2': c2_data,
            'c4': c4_data,
            'icon': icon_url,
            'note': e4_data,
            'video': g2_data,
            'qr': g4_data
        }
        
        student_rows = value_ranges[vr_idx].get('values', []) if vr_idx < len(value_ranges) else []
        vr_idx += 1
        for row in student_rows:
            s_name = row[0] if row else ''
            if is_student(s_name):
                all_students.append({'name': s_name.strip(), 'course': name})

    app_data = load_app_data()
    all_notas = app_data.get('notas', [])
    anulados = app_data.get('anulados', [])
    
    cursos_list = deduplicate_cursos(all_sheet_names)
    
    # Mapping for deduplicated course names
    course_mapping = {}
    for raw in all_sheet_names:
        for final in cursos_list:
            if norm_curso(raw) == norm_curso(final):
                course_mapping[raw] = final
                break
                
    for s in all_students:
        s['course'] = course_mapping.get(s['course'], s['course'])
        
    final_meta = {}
    for raw_name, data in sheet_meta.items():
        f_name = course_mapping.get(raw_name, raw_name)
        if f_name not in final_meta or len(str(data['c2'])) > len(str(final_meta[f_name].get('c2', ''))):
            final_meta[f_name] = data
            
    return ok_response({
        'cursos': cursos_list,
        'students': all_students,
        'notas': all_notas,
        'anulados': anulados,
        'trimester_checks': app_data.get('trimester_checks', {}),
        'workflow_checks': app_data.get('workflow_checks', {}),
        'teacher_notes': app_data.get('teacher_notes', {}),
        'snapshots': app_data.get('snapshots', []),
        'meta': final_meta,
        'sheets': all_sheet_names
    })

def get_server_info():
    return ok_response({
        'dir': os.getcwd(),
        'mtime': datetime.fromtimestamp(os.path.getmtime(DATA_FILE)).strftime('%Y-%m-%d %H:%M:%S') if os.path.exists(DATA_FILE) else 'FILE_MISSING',
        'writable': os.access(os.path.dirname(os.path.abspath(DATA_FILE)), os.W_OK)
    })

def get_notas(params):
    alumno_id = params.get('alumno_id')
    nombre_alumno = params.get('nombre_alumno')
    grado = params.get('grado_academico')
    
    if not alumno_id and not nombre_alumno:
        return JSONResponse(status_code=400, content={"error": "Falta alumno_id o nombre_alumno"})
        
    app_data = load_app_data()
    rows = app_data.get('notas', [])
    
    found = []
    if alumno_id:
        found = [r for r in rows if str(r[0]) == str(alumno_id)]
    
    if not found and nombre_alumno:
        found = [r for r in rows if str(r[1]).strip() == str(nombre_alumno).strip()]
        
    if grado and grado != 'TODOS':
        found = [r for r in found if len(r) > 11 and str(r[11]) == str(grado)]
        
    return ok_response({'notas': found})

def get_all_notas():
    app_data = load_app_data()
    return ok_response({'rows': app_data.get('notas', [])})

def add_nota(body):
    app_data = load_app_data()
    new_nota = [
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
        f"n{int(time.time() * 1000)}", # unique id
        body.get('grado_academico', '')
    ]
    app_data['notas'].append(new_nota)
    save_app_data(app_data)
    return ok_response({'message': 'Nota añadida localmente'})

def edit_nota(body):
    nota_id = str(body.get('nota_id'))
    if not nota_id:
        return JSONResponse(status_code=400, content={"error": "Falta nota_id"})
        
    app_data = load_app_data()
    found = False
    for r in app_data['notas']:
        if len(r) > 10 and str(r[10]) == nota_id:
            if 'curso' in body: r[2] = body['curso']
            if 'fecha_reading' in body: r[3] = body['fecha_reading']
            if 'reading' in body: r[4] = body['reading']
            if 'fecha_writing' in body: r[5] = body['fecha_writing']
            if 'writing' in body: r[6] = body['writing']
            if 'fecha_listening' in body: r[7] = body['fecha_listening']
            if 'listening' in body: r[8] = body['listening']
            if 'grado_academico' in body: r[11] = body['grado_academico']
            found = True
            break
            
    if not found:
        return JSONResponse(status_code=404, content={"error": "No se encontró la nota a editar"})
        
    save_app_data(app_data)
    return ok_response({'message': 'Nota actualizada correctamente'})

def delete_nota(body):
    nota_id = str(body.get('nota_id'))
    if not nota_id:
        return JSONResponse(status_code=400, content={"error": "Falta nota_id"})
        
    app_data = load_app_data()
    initial_count = len(app_data['notas'])
    app_data['notas'] = [r for r in app_data['notas'] if len(r) <= 10 or str(r[10]) != nota_id]
    
    if len(app_data['notas']) == initial_count:
        return JSONResponse(status_code=404, content={"error": "No se encontró la nota a eliminar"})
        
    save_app_data(app_data)
    return ok_response({'message': 'Nota eliminada correctamente'})

def toggle_anulado(body):
    alumno_id = body.get('alumno_id')
    alumno_name = body.get('alumno_name')
    is_anulado = body.get('anulado', False)
    
    if not alumno_id:
        return JSONResponse(status_code=400, content={"error": "Falta alumno_id"})
        
    app_data = load_app_data()
    anulados = app_data.get('anulados', [])
    
    if is_anulado:
        if alumno_id not in anulados:
            anulados.append(alumno_id)
            app_data['student_log'].append({'id': alumno_id, 'name': alumno_name, 'type': 'baja', 'date': datetime.now().strftime('%Y-%m-%d')})
    else:
        if alumno_id in anulados:
            anulados.remove(alumno_id)
            app_data['student_log'].append({'id': alumno_id, 'name': alumno_name, 'type': 'alta', 'date': datetime.now().strftime('%Y-%m-%d')})
            
    app_data['anulados'] = anulados
    save_app_data(app_data)
    return ok_response({'message': 'Estado de alumno actualizado'})

def save_trimester_checks(body):
    student_id = body.get('studentId')
    checks = body.get('checks')
    if student_id and checks is not None:
        app_data = load_app_data()
        app_data['trimester_checks'][student_id] = checks
        save_app_data(app_data)
        return ok_response({'status': 'saved'})
    return JSONResponse(status_code=400, content={"error": "Faltan datos"})

def save_workflow_checks(body):
    student_id = body.get('studentId')
    checks = body.get('checks')
    if student_id and checks is not None:
        app_data = load_app_data()
        app_data['workflow_checks'][student_id] = checks
        save_app_data(app_data)
        return ok_response({'status': 'saved'})
    return JSONResponse(status_code=400, content={"error": "Faltan datos"})

def save_teacher_note(body):
    student_id = body.get('studentId')
    note = body.get('note')
    if student_id:
        app_data = load_app_data()
        app_data['teacher_notes'][student_id] = note
        save_app_data(app_data)
        return ok_response({'status': 'saved'})
    return JSONResponse(status_code=400, content={"error": "Faltan datos"})

async def get_statistics():
    app_data = load_app_data()
    notas = app_data.get('notas', [])
    anulados = app_data.get('anulados', [])
    student_log = app_data.get('student_log', [])
    first_seen_stored = app_data.get('first_seen_dates', {})
    needs_save = False

    first_seen = {}
    for nota in notas:
        id = str(nota[0])
        if not id: continue
        dates = [d for d in [nota[3], nota[5], nota[7]] if d]
        min_date = min(dates) if dates else first_seen_stored.get(id)
        if min_date and (id not in first_seen or min_date < first_seen[id]['date']):
            first_seen[id] = {
                'date': min_date,
                'name': nota[1],
                'course': nota[2] if len(nota) > 2 else 'Desconocido'
            }
            if id not in first_seen_stored:
                first_seen_stored[id] = min_date
                needs_save = True

    if needs_save:
        app_data['first_seen_dates'] = first_seen_stored
        save_app_data(app_data)

    bajas_by_month = {}
    logged_baja_ids = []
    for entry in student_log:
        if entry.get('type') == 'baja':
            id = str(entry.get('id', ''))
            m = entry.get('date', '')[:7]
            if not m: continue
            course = entry.get('course', first_seen.get(id, {}).get('course', 'Desconocido'))
            if m not in bajas_by_month: bajas_by_month[m] = []
            bajas_by_month[m].append({'name': entry.get('name', id), 'course': course})
            if id: logged_baja_ids.append(id)

    current_month = datetime.now().strftime('%Y-%m')
    for id in anulados:
        id_str = str(id)
        if id_str not in logged_baja_ids:
            name = first_seen.get(id_str, {}).get('name', id_str)
            course = first_seen.get(id_str, {}).get('course', 'Desconocido')
            if current_month not in bajas_by_month: bajas_by_month[current_month] = []
            bajas_by_month[current_month].append({'name': name, 'course': course})

    altas_by_month = {}
    for id, data in first_seen.items():
        m = data['date'][:7]
        if not m: continue
        if m not in altas_by_month: altas_by_month[m] = []
        altas_by_month[m].append({'name': data['name'], 'course': data['course']})

    all_months = sorted(list(set(list(altas_by_month.keys()) + list(bajas_by_month.keys()))))
    monthly = []
    run_active = 0
    run_inactive = 0
    for m in all_months:
        altas = altas_by_month.get(m, [])
        bajas = bajas_by_month.get(m, [])
        
        course_breakdown = {}
        for a in altas:
            c = a['course']
            if c not in course_breakdown: course_breakdown[c] = {'course': c, 'altas': 0, 'bajas': 0}
            course_breakdown[c]['altas'] += 1
        for b in bajas:
            c = b['course']
            if c not in course_breakdown: course_breakdown[c] = {'course': c, 'altas': 0, 'bajas': 0}
            course_breakdown[c]['bajas'] += 1

        altas_count = len(altas)
        bajas_count = len(bajas)
        run_active += altas_count - bajas_count
        run_inactive += bajas_count
        
        monthly.append({
            'month': m,
            'altas': altas_count,
            'bajas': bajas_count,
            'delta': altas_count - bajas_count,
            'running_active': run_active,
            'running_inactive': run_inactive,
            'altas_names': [a['name'] for a in altas],
            'bajas_names': [b['name'] for b in bajas],
            'breakdown': list(course_breakdown.values())
        })

    return ok_response({
        'monthly': monthly,
        'total_students': len(first_seen),
        'total_active': len(first_seen) - len(anulados),
        'total_inactive': len(anulados),
    })

def reset_statistics():
    app_data = load_app_data()
    app_data['student_log'] = []
    save_app_data(app_data)
    return ok_response({})

def get_waiting_list():
    app_data = load_app_data()
    return ok_response({'list': app_data.get('waiting_list', [])})

def add_waiting_entry(body):
    app_data = load_app_data()
    entry = body.get('entry')
    if not entry: return JSONResponse(status_code=400, content={"error": "Datos de entrada vacíos"})
    
    entry['id'] = f"w{int(time.time() * 1000)}"
    entry['timestamp'] = int(time.time())
    entry['status'] = 'pendiente'
    
    if 'waiting_list' not in app_data: app_data['waiting_list'] = []
    app_data['waiting_list'].append(entry)
    
    save_app_data(app_data)
    return ok_response({'entry': entry})

def update_waiting_entry(body):
    app_data = load_app_data()
    id = body.get('id')
    updates = body.get('updates', {})
    if not id: return JSONResponse(status_code=400, content={"error": "ID no proporcionado"})
    
    found = False
    for item in app_data.get('waiting_list', []):
        if item.get('id') == id:
            for k, v in updates.items():
                item[k] = v
            found = True
            break
            
    if found:
        save_app_data(app_data)
        return ok_response({})
    return JSONResponse(status_code=404, content={"error": "Entrada no encontrada"})

def delete_waiting_entry(body):
    app_data = load_app_data()
    id = body.get('id')
    if not id: return JSONResponse(status_code=400, content={"error": "ID no proporcionado"})

    initial_len = len(app_data.get('waiting_list', []))
    app_data['waiting_list'] = [item for item in app_data.get('waiting_list', []) if item.get('id') != id]
    
    if len(app_data['waiting_list']) < initial_len:
        save_app_data(app_data)
        return ok_response({})
    return JSONResponse(status_code=404, content={"error": "Entrada no encontrada"})

def reset_waiting_list(body):
    app_data = load_app_data()
    p_type = body.get('type', 'all')

    if p_type == 'all':
        app_data['waiting_list'] = []
    else:
        app_data['waiting_list'] = [item for item in app_data.get('waiting_list', []) if item.get('status') != p_type]

    save_app_data(app_data)
    return ok_response({})
def global_login(body):
    data = load_app_data()
    settings = data.get('settings', {})
    username = body.get('username')
    password = body.get('password')
    
    if username == settings.get('adminUser', 'Admin') and password == settings.get('adminPass', 'Admin-1234'):
        return ok_response({"role": "admin"})
    
    teacher_users = [u.strip() for u in settings.get('teacherUsers', '').split(',')]
    teacher_pass = settings.get('passA', '2020')
    
    if username in teacher_users and password == teacher_pass:
        return ok_response({"role": "teacher"})
        
    return JSONResponse(status_code=401, content={"success": False, "error": "Usuario o contraseña incorrectos"})

def verify_portal_password(params):
    data = load_app_data()
    settings = data.get('settings', {})
    p_type = params.get('type')
    p_pass = params.get('password')
    
    correct_pass = settings.get('passA', '2020')
    if p_type == 'B':
        correct_pass = settings.get('passB', 'certificados123')
    elif p_type == 'S':
        correct_pass = settings.get('passStats', 'Estadisticas123')
        
    if p_pass == correct_pass:
        return ok_response({})
    return ok_response({"success": False, "error": "Contraseña incorrecta"})

def get_portal_settings(params):
    master_key = params.get('masterKey')
    data = load_app_data()
    settings = data.get('settings', {})
    if master_key == settings.get('masterKey', 'admin99'):
        return ok_response({'settings': settings})
    return JSONResponse(status_code=401, content={"error": "Clave Maestra incorrecta"})

def save_portal_settings(body):
    master_key = body.get('masterKey')
    new_settings = body.get('settings', {})
    data = load_app_data()
    settings = data.get('settings', {})
    if master_key == settings.get('masterKey', 'admin99'):
        data['settings'].update(new_settings)
        save_app_data(data)
        return ok_response({'message': 'Ajustes guardados correctamente'})
    return JSONResponse(status_code=401, content={"error": "Clave Maestra incorrecta"})

def get_web_config():
    data = load_app_data()
    # Extract unique courses from notas (index 11)
    cursos = []
    for nt in data.get('notas', []):
        if len(nt) > 11 and nt[11]:
            cursos.append(str(nt[11]).strip())
    cursos = sorted(list(set(cursos)))
    
    return ok_response({
        'success': True,
        'web_config': data.get('web_config', {}),
        'cursos': cursos
    })

def save_web_config(body):
    new_config = body.get('web_config', {})
    data = load_app_data()
    if 'web_config' not in data: data['web_config'] = {}
    data['web_config'].update(new_config)
    save_app_data(data)
    return ok_response({'message': 'Configuración web guardada'})

def get_backup_info():
    return ok_response({'diaria': [], 'semanal': [], 'trimestral': []})

async def get_sheets():
    meta_url = f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}?fields=sheets.properties(title)"
    meta = await sheets_request(meta_url)
    ignore_patterns = [r'vacio', r'plantilla', r'config', r'asistencias', r'notas']
    sheets = []
    for sh in meta.get('sheets', []):
        name = sh['properties']['title']
        skip = False
        for p in ignore_patterns:
            if re.search(p, name, re.IGNORECASE):
                skip = True
                break
        if not skip:
            sheets.append(name)
    return ok_response({'sheets': sheets})

def get_historical_marks():
    data = load_app_data()
    return ok_response({
        'marks': data.get('asistencias_historial', {}),
        'overrides': data.get('day_overrides', {}),
        'extra_columns': data.get('extra_columns', {})
    })

async def get_summary(params):
    sheet_name = params.get('sheetName')
    if not sheet_name: return JSONResponse(status_code=400, content={"error": "Falta sheetName"})
    
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/'{sheet_name}'!A1:ZZ1000"
    data = await sheets_request(url)
    rows = data.get('values', [])
    
    if len(rows) < 6:
        return ok_response({'summaryByMonth': {}, 'totalDatesCount': 0})
        
    valid_dates = parse_month_dates(rows)
    professor = rows[3][2] if len(rows[3]) > 2 else ''
    course_name = rows[1][2] if len(rows[1]) > 2 else sheet_name
    
    app_data = load_app_data()
    json_marks = app_data.get('asistencias_historial', {})
    
    summary_by_month = {}
    for d in valid_dates:
        m = d['monthStr']
        if m not in summary_by_month: summary_by_month[m] = {'dates': [], 'students': []}
        if d['dateStr'] not in summary_by_month[m]['dates']:
            summary_by_month[m]['dates'].append(d['dateStr'])
            
    student_col = find_student_column(rows[4] if len(rows) > 4 else rows[5])
    for i in range(6, len(rows)):
        s_name = rows[i][student_col] if len(rows[i]) > student_col else ''
        if not is_student(s_name): continue
        clean_name = s_name.strip()
        
        for m_ref in summary_by_month.values():
            records = {}
            for ds in m_ref['dates']:
                key = f"{clean_name}|{ds}"
                val = json_marks.get(key, '')
                records[ds] = val
            m_ref['students'].append({'name': clean_name, 'records': records})
            
    return ok_response({
        'summaryByMonth': summary_by_month,
        'totalDatesCount': len(valid_dates),
        'professor': professor,
        'course_name': course_name
    })

async def get_all_students():
    meta_url = f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}?fields=sheets.properties(title)"
    meta = await sheets_request(meta_url)
    ignore_patterns = [r'vacio', r'plantilla', r'config', r'asistencias', r'notas']
    
    ranges = []
    names = []
    for sh in meta.get('sheets', []):
        name = sh['properties']['title']
        skip = False
        for p in ignore_patterns:
            if re.search(p, name, re.IGNORECASE):
                skip = True
                break
        if not skip:
            names.append(name)
            ranges.append(f"'{name}'!C7:C")
            
    if not ranges: return ok_response({'students': []})
    
    query_params = "&".join([f"ranges={httpx.utils.quote(r)}" for r in ranges])
    batch_url = f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values:batchGet?{query_params}"
    batch_data = await sheets_request(batch_url)
    
    all_students = []
    for i, vr in enumerate(batch_data.get('valueRanges', [])):
        sheet_name = names[i]
        for row in vr.get('values', []):
            s_name = row[0] if row else ''
            if is_student(s_name):
                all_students.append({'name': s_name.strip(), 'course': sheet_name})
                
    return ok_response({'students': all_students})

def save_historical_marks(body):
    new_marks = body.get('marks', {})
    data = load_app_data()
    if 'asistencias_historial' not in data: data['asistencias_historial'] = {}
    
    for k, v in new_marks.items():
        if v == '':
            data['asistencias_historial'].pop(k, None)
        else:
            data['asistencias_historial'][k] = v
            
    save_app_data(data)
    return ok_response({'message': 'Historial persistido', 'count': len(data['asistencias_historial'])})

def save_day_override(body):
    key = body.get('key')
    label = body.get('label')
    if not key: return JSONResponse(status_code=400, content={"error": "Falta la clave (key)"})
    
    data = load_app_data()
    if 'day_overrides' not in data: data['day_overrides'] = {}
    
    if label == '':
        data['day_overrides'].pop(key, None)
    else:
        data['day_overrides'][key] = label
        
    save_app_data(data)
    return ok_response({'message': 'Etiqueta de día guardada'})

def save_extra_columns(body):
    month_key = body.get('monthKey')
    count = body.get('count', 0)
    if not month_key: return JSONResponse(status_code=400, content={"error": "Falta monthKey"})
    
    data = load_app_data()
    if 'extra_columns' not in data: data['extra_columns'] = {}
    data['extra_columns'][month_key] = count
    save_app_data(data)
    return ok_response({'message': 'Contador de columnas fijas guardado'})

def save_highlight(body):
    name = body.get('studentName')
    highlight = body.get('highlight', False)
    if not name: return JSONResponse(status_code=400, content={"error": "Falta studentName"})
    
    data = load_app_data()
    if 'highlights' not in data: data['highlights'] = {}
    if highlight:
        data['highlights'][name] = True
    else:
        data['highlights'].pop(name, None)
    save_app_data(data)
    return ok_response({'message': 'Destacado actualizado'})

async def get_icon(params):
    url = params.get('url')
    sheet_name = params.get('sheetName')
    
    if url:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            resp = await client.get(url)
            return Response(content=resp.content, media_type=resp.headers.get('content-type'))
            
    if sheet_name:
        # PNG export requires more complex setup or direct link. 
        # For now, return 404 as fallback.
        return Response(status_code=404)
        
    return Response(status_code=400)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
