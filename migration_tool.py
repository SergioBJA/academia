import json
import os
import requests

def migrate_to_sheets():
    """
    Simulated migration: Reads app_data.json and prepares it for 
    a Google Sheets based storage.
    """
    if not os.path.exists('app_data.json'):
        print("Error: app_data.json not found.")
        return

    with open('app_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"Loaded {len(data.get('notas', []))} notes.")
    print(f"Loaded {len(data.get('anulados', []))} inactive students.")
    
    # In a real scenario, this would use the Google Sheets API 
    # to create a new sheet and upload the data.
    print("Migration status: Ready to upload to Google Sheets.")
    # ... logic to call Google Sheets API ...

if __name__ == "__main__":
    migrate_to_sheets()
