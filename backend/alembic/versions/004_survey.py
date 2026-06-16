"""004 survey system

Revision ID: 004
Revises: 003
Create Date: 2026-06-16
"""
from alembic import op

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade():
    op.execute('ALTER TABLE guests ADD COLUMN IF NOT EXISTS "surveyEmailSentAt" TIMESTAMP')

    op.execute('ALTER TABLE sites ADD COLUMN IF NOT EXISTS "surveyEnabled" BOOLEAN NOT NULL DEFAULT true')
    op.execute('ALTER TABLE sites ADD COLUMN IF NOT EXISTS "surveyHoursDelay" INTEGER NOT NULL DEFAULT 24')

    op.execute("""
        CREATE TABLE IF NOT EXISTS survey_responses (
            id VARCHAR PRIMARY KEY,
            "guestId" VARCHAR NOT NULL REFERENCES guests(id),
            "siteId" VARCHAR NOT NULL REFERENCES sites(id),
            "tenantId" VARCHAR NOT NULL REFERENCES tenants(id),
            "npsScore" INTEGER,
            comment TEXT,
            "surveyToken" VARCHAR UNIQUE NOT NULL,
            "submittedAt" TIMESTAMP,
            "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)

    op.execute('CREATE INDEX IF NOT EXISTS idx_survey_token ON survey_responses ("surveyToken")')
    op.execute('CREATE INDEX IF NOT EXISTS idx_survey_guest ON survey_responses ("guestId")')
    op.execute('CREATE INDEX IF NOT EXISTS idx_guests_survey_null ON guests ("surveyEmailSentAt") WHERE "surveyEmailSentAt" IS NULL')


def downgrade():
    op.execute('DROP INDEX IF EXISTS idx_guests_survey_null')
    op.execute('DROP INDEX IF EXISTS idx_survey_guest')
    op.execute('DROP INDEX IF EXISTS idx_survey_token')
    op.execute('DROP TABLE IF EXISTS survey_responses')
    op.execute('ALTER TABLE sites DROP COLUMN IF EXISTS "surveyHoursDelay"')
    op.execute('ALTER TABLE sites DROP COLUMN IF EXISTS "surveyEnabled"')
    op.execute('ALTER TABLE guests DROP COLUMN IF EXISTS "surveyEmailSentAt"')
