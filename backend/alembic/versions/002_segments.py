"""Add segments and sub_segments tables; add segment/sub-segment to guests

Revision ID: 002
Revises: 001
Create Date: 2026-06-16

"""
from typing import Sequence, Union
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS segments (
            id VARCHAR NOT NULL,
            "tenantId" VARCHAR NOT NULL,
            name VARCHAR NOT NULL,
            priority INTEGER NOT NULL DEFAULT 0,
            enabled BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            PRIMARY KEY (id),
            FOREIGN KEY ("tenantId") REFERENCES tenants (id)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS sub_segments (
            id VARCHAR NOT NULL,
            "segmentId" VARCHAR NOT NULL,
            "tenantId" VARCHAR NOT NULL,
            name VARCHAR NOT NULL,
            "textIt" VARCHAR,
            "dateStart" TIMESTAMP,
            "dateEnd" TIMESTAMP,
            recurring BOOLEAN NOT NULL DEFAULT false,
            enabled BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            PRIMARY KEY (id),
            FOREIGN KEY ("segmentId") REFERENCES segments (id),
            FOREIGN KEY ("tenantId") REFERENCES tenants (id)
        )
    """)

    op.execute("""
        ALTER TABLE guests
            ADD COLUMN IF NOT EXISTS "segmentId" VARCHAR REFERENCES segments(id),
            ADD COLUMN IF NOT EXISTS "subSegmentId" VARCHAR REFERENCES sub_segments(id)
    """)


def downgrade() -> None:
    op.execute('ALTER TABLE guests DROP COLUMN IF EXISTS "subSegmentId"')
    op.execute('ALTER TABLE guests DROP COLUMN IF EXISTS "segmentId"')
    op.execute("DROP TABLE IF EXISTS sub_segments")
    op.execute("DROP TABLE IF EXISTS segments")
