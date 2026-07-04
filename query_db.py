import sqlite3
import os

db_path = os.path.join(os.environ.get('APPDATA', ''), 'AIWorkMemory', 'db', 'workmemory.db')
print("Querying database at:", db_path)

try:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT id, timestamp, ai_app, ai_task, ai_state, substr(ai_description, 1, 100) as description FROM screenshots ORDER BY id DESC LIMIT 5")
    rows = cursor.fetchall()
    
    if not rows:
        print("No screenshots found.")
    else:
        print(f"{'id':<5} | {'timestamp':<20} | {'ai_app':<15} | {'ai_task':<20} | {'ai_state':<10} | {'description'}")
        print("-" * 120)
        for row in rows:
            print(f"{row['id']:<5} | {str(row['timestamp'])[:20]:<20} | {str(row['ai_app'])[:15]:<15} | {str(row['ai_task'])[:20]:<20} | {str(row['ai_state'])[:10]:<10} | {row['description']}")
            
except Exception as e:
    print("Error:", e)
