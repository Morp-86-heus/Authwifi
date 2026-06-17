from alembic import op

revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE sites
            ADD COLUMN IF NOT EXISTS "emailSubject"    VARCHAR,
            ADD COLUMN IF NOT EXISTS "emailBodyText"   VARCHAR,
            ADD COLUMN IF NOT EXISTS "emailButtonText" VARCHAR,
            ADD COLUMN IF NOT EXISTS "emailFooterText" VARCHAR
    """)


def downgrade():
    pass
