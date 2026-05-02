"""
Compatibility wrapper for the legacy user-column migration entrypoint.

The backend now performs additive schema synchronization across all tables,
so this script delegates to the shared schema manager instead of maintaining
one-off SQL for the users table.
"""

import sys

from schema_manager import sync_schema


def migrate() -> bool:
    try:
        sync_schema()
        return True
    except Exception as exc:
        print(f"[ERROR] Schema sync failed: {exc}")
        return False


if __name__ == "__main__":
    sys.exit(0 if migrate() else 1)
