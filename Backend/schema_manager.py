import logging
from datetime import date, datetime, time
from typing import Dict, Tuple

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.schema import Index, UniqueConstraint

from database import Base, engine
import models  # noqa: F401  Ensures all model tables are registered with Base.metadata.

logger = logging.getLogger(__name__)


class SchemaSyncError(RuntimeError):
    """Raised when the database schema cannot be safely synchronized."""


IndexSpec = Tuple[bool, Tuple[str, ...]]


def _quote_identifier(engine_instance: Engine, identifier: str) -> str:
    return engine_instance.dialect.identifier_preparer.quote(identifier)


def _literal_sql(value, dialect_name: str) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        if dialect_name == "sqlite":
            return "1" if value else "0"
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, datetime):
        return f"'{value.isoformat(sep=' ')}'"
    if isinstance(value, date):
        return f"'{value.isoformat()}'"
    if isinstance(value, time):
        return f"'{value.isoformat()}'"
    escaped = str(value).replace("'", "''")
    return f"'{escaped}'"


def _default_sql(column, engine_instance: Engine):
    if column.server_default is not None:
        arg = column.server_default.arg
        text_value = getattr(arg, "text", None)
        if text_value is not None:
            return str(text_value)
        try:
            return str(arg.compile(dialect=engine_instance.dialect, compile_kwargs={"literal_binds": True}))
        except Exception:
            return str(arg)

    default = column.default
    if default is not None and default.is_scalar:
        return _literal_sql(default.arg, engine_instance.dialect.name)

    return None


def _table_row_count(connection: Connection, engine_instance: Engine, table_name: str) -> int:
    quoted_table = _quote_identifier(engine_instance, table_name)
    return int(connection.execute(text(f"SELECT COUNT(*) FROM {quoted_table}")).scalar_one())


def _desired_index_specs(table) -> Dict[IndexSpec, str]:
    specs: Dict[IndexSpec, str] = {}

    for column in table.columns:
        if column.unique:
            specs[(True, (column.name,))] = f"uq_{table.name}_{column.name}"
        elif column.index:
            specs[(False, (column.name,))] = f"ix_{table.name}_{column.name}"

    for constraint in table.constraints:
        if isinstance(constraint, UniqueConstraint):
            column_names = tuple(column.name for column in constraint.columns)
            if column_names:
                specs[(True, column_names)] = constraint.name or f"uq_{table.name}_{'_'.join(column_names)}"

    for index in table.indexes:
        if isinstance(index, Index):
            column_names = tuple(column.name for column in index.columns)
            if column_names:
                specs[(bool(index.unique), column_names)] = index.name or f"{'uq' if index.unique else 'ix'}_{table.name}_{'_'.join(column_names)}"

    return specs


def _existing_index_specs(connection: Connection, table_name: str) -> set[IndexSpec]:
    inspector = inspect(connection)
    existing: set[IndexSpec] = set()

    for index in inspector.get_indexes(table_name):
        column_names = tuple(index.get("column_names") or ())
        if column_names:
            existing.add((bool(index.get("unique")), column_names))

    for constraint in inspector.get_unique_constraints(table_name):
        column_names = tuple(constraint.get("column_names") or ())
        if column_names:
            existing.add((True, column_names))

    return existing


def _sync_missing_columns(connection: Connection, engine_instance: Engine) -> None:
    inspector = inspect(connection)
    existing_tables = set(inspector.get_table_names())

    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue

        existing_columns = {column["name"] for column in inspector.get_columns(table.name)}
        table_row_count = None

        for column in table.columns:
            if column.name in existing_columns:
                continue

            if column.primary_key:
                raise SchemaSyncError(
                    f"Database table '{table.name}' is missing primary key column '{column.name}'. "
                    "Automatic repair is not safe."
                )

            default_sql = _default_sql(column, engine_instance)
            if table_row_count is None:
                table_row_count = _table_row_count(connection, engine_instance, table.name)

            if table_row_count > 0 and not column.nullable and default_sql is None:
                raise SchemaSyncError(
                    f"Database table '{table.name}' is missing required column '{column.name}', "
                    "and there is no safe default for existing rows."
                )

            pieces = [
                _quote_identifier(engine_instance, column.name),
                column.type.compile(dialect=engine_instance.dialect),
            ]
            if default_sql is not None:
                pieces.extend(["DEFAULT", default_sql])
            if not column.nullable:
                pieces.append("NOT NULL")

            quoted_table = _quote_identifier(engine_instance, table.name)
            connection.execute(text(f"ALTER TABLE {quoted_table} ADD COLUMN {' '.join(pieces)}"))
            logger.info("Added missing column %s.%s", table.name, column.name)


def _sync_indexes(connection: Connection, engine_instance: Engine) -> None:
    inspector = inspect(connection)
    existing_tables = set(inspector.get_table_names())

    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue

        existing_specs = _existing_index_specs(connection, table.name)
        quoted_table = _quote_identifier(engine_instance, table.name)

        for (is_unique, column_names), index_name in _desired_index_specs(table).items():
            if (is_unique, column_names) in existing_specs:
                continue

            quoted_index = _quote_identifier(engine_instance, index_name)
            quoted_columns = ", ".join(_quote_identifier(engine_instance, column_name) for column_name in column_names)
            unique_clause = "UNIQUE " if is_unique else ""
            connection.execute(
                text(
                    f"CREATE {unique_clause}INDEX IF NOT EXISTS {quoted_index} "
                    f"ON {quoted_table} ({quoted_columns})"
                )
            )
            logger.info("Created missing %sindex %s on %s", unique_clause.lower(), index_name, table.name)


def validate_schema(engine_instance: Engine = engine) -> None:
    issues = []
    with engine_instance.connect() as connection:
        inspector = inspect(connection)
        table_names = set(inspector.get_table_names())

        for table in Base.metadata.sorted_tables:
            if table.name not in table_names:
                issues.append(f"Missing table '{table.name}'")
                continue

            existing_columns = {column["name"] for column in inspector.get_columns(table.name)}
            missing_columns = [column.name for column in table.columns if column.name not in existing_columns]
            if missing_columns:
                issues.append(f"Table '{table.name}' is missing columns: {', '.join(missing_columns)}")

            existing_specs = _existing_index_specs(connection, table.name)
            missing_indexes = []
            for spec, index_name in _desired_index_specs(table).items():
                if spec not in existing_specs:
                    missing_indexes.append(index_name)
            if missing_indexes:
                issues.append(f"Table '{table.name}' is missing indexes/constraints: {', '.join(missing_indexes)}")

    if issues:
        raise SchemaSyncError("Schema validation failed:\n- " + "\n- ".join(issues))


def sync_schema(engine_instance: Engine = engine) -> None:
    """Create missing tables, backfill missing columns, and validate the final schema."""
    Base.metadata.create_all(bind=engine_instance)

    with engine_instance.begin() as connection:
        _sync_missing_columns(connection, engine_instance)
        _sync_indexes(connection, engine_instance)

    validate_schema(engine_instance)
