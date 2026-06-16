"""005 external reviews

Revision ID: 005
Revises: 004
Create Date: 2026-06-17
"""
from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade():
    op.execute('ALTER TABLE sites ADD COLUMN IF NOT EXISTS "googlePlaceId" VARCHAR')

    op.execute("""
        CREATE TABLE IF NOT EXISTS external_reviews (
            id VARCHAR PRIMARY KEY,
            "siteId" VARCHAR NOT NULL REFERENCES sites(id),
            "tenantId" VARCHAR NOT NULL REFERENCES tenants(id),
            source VARCHAR NOT NULL DEFAULT 'google',
            "externalId" VARCHAR,
            "authorName" VARCHAR,
            "authorPhoto" VARCHAR,
            rating INTEGER,
            text TEXT,
            "publishedAt" TIMESTAMP,
            "fetchedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
            UNIQUE ("siteId", source, "externalId")
        )
    """)

    op.execute('CREATE INDEX IF NOT EXISTS idx_reviews_siteId ON external_reviews ("siteId")')
    op.execute('CREATE INDEX IF NOT EXISTS idx_reviews_tenantId ON external_reviews ("tenantId")')


def downgrade():
    op.execute('DROP INDEX IF EXISTS idx_reviews_tenantId')
    op.execute('DROP INDEX IF EXISTS idx_reviews_siteId')
    op.execute('DROP TABLE IF EXISTS external_reviews')
    op.execute('ALTER TABLE sites DROP COLUMN IF EXISTS "googlePlaceId"')
