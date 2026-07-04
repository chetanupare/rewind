import sqlite3
import os

db_path = os.path.join(os.environ.get('APPDATA', ''), 'AIWorkMemory', 'db', 'workmemory.db')
try:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT id, ai_processed FROM screenshots ORDER BY id DESC LIMIT 5")
    rows = cursor.fetchall()
    
    for row in rows:
        print(f"ID: {row['id']} | ai_processed: {row['ai_processed']}")
            
except Exception as e:
    print("Error:", e)
