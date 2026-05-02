"""
Migration script to add missing columns to users table.
This script adds all missing columns to match the User model schema.
"""

from sqlalchemy import text
from database import engine
import sys

def migrate():
    """Add all missing columns to users table."""
    try:
        with engine.connect() as connection:
            # Get all existing columns in users table
            result = connection.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users'
            """))
            existing_columns = {row[0] for row in result}
            print(f"Existing columns: {existing_columns}\n")
            
            # First, make username column nullable if it exists
            if 'username' in existing_columns:
                try:
                    print("Making username column nullable...")
                    connection.execute(text("""
                        ALTER TABLE users ALTER COLUMN username DROP NOT NULL
                    """))
                    connection.commit()
                    print("✓ username column made nullable\n")
                except Exception as e:
                    print(f"Note: username column update: {str(e)}\n")
                    connection.rollback()
            
            # Define columns to add with their SQL definitions
            columns_to_add = {
                'first_name': "VARCHAR(100) NOT NULL DEFAULT 'Unknown'",
                'last_name': "VARCHAR(100) NOT NULL DEFAULT 'User'",
                'phone': "VARCHAR(20) NULL",
                'is_verified': "BOOLEAN NOT NULL DEFAULT FALSE",
                'otp_code': "VARCHAR(6) NULL",
                'otp_expires_at': "TIMESTAMP WITH TIME ZONE NULL",
                'password_reset_token_version': "INTEGER NOT NULL DEFAULT 0",
                'is_active': "BOOLEAN NOT NULL DEFAULT TRUE",
                'created_at': "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()",
                'updated_at': "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()",
                'deleted_at': "TIMESTAMP WITH TIME ZONE NULL",
            }
            
            # Add missing columns
            added_count = 0
            for column_name, column_def in columns_to_add.items():
                if column_name not in existing_columns:
                    try:
                        print(f"Adding {column_name} column...")
                        connection.execute(text(f"""
                            ALTER TABLE users ADD COLUMN {column_name} {column_def}
                        """))
                        connection.commit()
                        print(f"✓ {column_name} column added successfully")
                        added_count += 1
                    except Exception as e:
                        print(f"✗ Failed to add {column_name}: {str(e)}")
                        connection.rollback()
                else:
                    print(f"✓ {column_name} column already exists")
            
            print(f"\n✓ Migration completed! Added {added_count} column(s)")
            return True
        
    except Exception as e:
        print(f"\n✗ Migration failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("Starting migration: Ensuring all user columns exist...\n")
    success = migrate()
    sys.exit(0 if success else 1)
