"""007_smtp_security — sostituisce smtpUseTls (bool) con smtpSecurity (varchar)"""
from alembic import op

revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE sites
            ADD COLUMN IF NOT EXISTS "smtpSecurity" VARCHAR NOT NULL DEFAULT 'starttls'
    """)
    op.execute("""
        UPDATE sites SET "smtpSecurity" = CASE
            WHEN "smtpUseTls" = true  THEN 'starttls'
            ELSE 'none'
        END
        WHERE "smtpUseTls" IS NOT NULL
    """)
    op.execute('''ALTER TABLE sites DROP COLUMN IF EXISTS "smtpUseTls"''')


def downgrade():
    op.execute("""
        ALTER TABLE sites
            ADD COLUMN IF NOT EXISTS "smtpUseTls" BOOLEAN NOT NULL DEFAULT true
    """)
    op.execute("""
        UPDATE sites SET "smtpUseTls" = CASE
            WHEN "smtpSecurity" = 'ssl' THEN true
            WHEN "smtpSecurity" = 'starttls' THEN true
            ELSE false
        END
    """)
    op.execute('''ALTER TABLE sites DROP COLUMN IF EXISTS "smtpSecurity"''')
