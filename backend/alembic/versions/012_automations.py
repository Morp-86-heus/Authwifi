"""automations table"""
from alembic import op

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TYPE automation_trigger AS ENUM (
            'welcome', 'anniversary', 'inactivity', 'survey_done', 'segment_enter'
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS automations (
            id TEXT PRIMARY KEY,
            "tenantId" TEXT NOT NULL REFERENCES tenants(id),
            "siteId" TEXT REFERENCES sites(id),
            name TEXT NOT NULL,
            subject TEXT NOT NULL DEFAULT '',
            blocks TEXT NOT NULL DEFAULT '[]',
            "triggerType" automation_trigger NOT NULL DEFAULT 'welcome',
            "triggerConfig" TEXT NOT NULL DEFAULT '{}',
            "delayHours" INTEGER NOT NULL DEFAULT 0,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_automations_tenant ON automations("tenantId");
        CREATE INDEX IF NOT EXISTS idx_automations_site ON automations("siteId");
    """)


def downgrade():
    op.execute('DROP TABLE IF EXISTS automations;')
    op.execute('DROP TYPE IF EXISTS automation_trigger;')
