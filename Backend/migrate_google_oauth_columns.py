"""
Compatibility wrapper for the legacy Google OAuth migration entrypoint.

Google OAuth columns are now managed by the shared schema synchronizer.
"""

import sys

from schema_manager import sync_schema


def migrate_add_google_oauth_columns() -> bool:
    try:
        sync_schema()
        return True
    except Exception as exc:
        print(f"[ERROR] Schema sync failed: {exc}")
        return False


if __name__ == "__main__":
    sys.exit(0 if migrate_add_google_oauth_columns() else 1)
