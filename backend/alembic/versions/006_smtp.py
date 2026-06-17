"""006_smtp — SMTP config per sito"""
from alembic import op

revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE sites
            ADD COLUMN IF NOT EXISTS "smtpHost"      VARCHAR,
            ADD COLUMN IF NOT EXISTS "smtpPort"      INTEGER NOT NULL DEFAULT 587,
            ADD COLUMN IF NOT EXISTS "smtpUseTls"    BOOLEAN NOT NULL DEFAULT true,
            ADD COLUMN IF NOT EXISTS "smtpUsername"  VARCHAR,
            ADD COLUMN IF NOT EXISTS "smtpPassword"  VARCHAR,
            ADD COLUMN IF NOT EXISTS "smtpFromEmail" VARCHAR,
            ADD COLUMN IF NOT EXISTS "smtpFromName"  VARCHAR
    """)


def downgrade():
    op.execute("""
        ALTER TABLE sites
            DROP COLUMN IF EXISTS "smtpHost",
            DROP COLUMN IF EXISTS "smtpPort",
            DROP COLUMN IF EXISTS "smtpUseTls",
            DROP COLUMN IF EXISTS "smtpUsername",
            DROP COLUMN IF EXISTS "smtpPassword",
            DROP COLUMN IF EXISTS "smtpFromEmail",
            DROP COLUMN IF EXISTS "smtpFromName"
    """)
