"""
Migration script to add Google OAuth columns to existing users table.
Run this after updating models.py if the table already exists.

Usage:
    python migrate_add_google_oauth_columns.py
"""

from sqlalchemy import text, inspect
from database import engine
from models import User

def migrate_add_google_oauth_columns():
    """Add Google OAuth columns to users table if they don't exist"""
    
    # Get current columns
    inspector = inspect(engine)
    existing_columns = [c['name'] for c in inspector.get_columns('users')]
    
    columns_to_add = {
        'google_id': 'VARCHAR(500) UNIQUE',
        'google_access_token': 'TEXT',
        'google_refresh_token': 'TEXT',
        'google_token_expiry': 'TIMESTAMP WITH TIME ZONE',
        'google_calendar_id': 'VARCHAR(500)',
        'google_meet_enabled': 'BOOLEAN DEFAULT FALSE'
    }
    
    with engine.connect() as conn:
        for column_name, column_type in columns_to_add.items():
            if column_name not in existing_columns:
                alter_sql = f"ALTER TABLE users ADD COLUMN {column_name} {column_type};"
                try:
                    conn.execute(text(alter_sql))
                    print(f"✅ Added column: {column_name}")
                except Exception as e:
                    print(f"⚠️ Column {column_name} might already exist: {e}")
            else:
                print(f"✓ Column {column_name} already exists")
        
        conn.commit()
    
    print("\n✅ Migration completed successfully!")

if __name__ == "__main__":
    try:
        migrate_add_google_oauth_columns()
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        exit(1)
