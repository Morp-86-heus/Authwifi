"""campaigns and campaign_recipients tables"""
from alembic import op

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'cancelled');
    """)
    op.execute("""
        CREATE TYPE campaign_audience AS ENUM ('all', 'segment', 'sub_segment', 'marketing_consent');
    """)
    op.execute("""
        CREATE TYPE recipient_status AS ENUM ('pending', 'sent', 'failed');
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS campaigns (
            id TEXT PRIMARY KEY,
            "tenantId" TEXT NOT NULL REFERENCES tenants(id),
            "siteId" TEXT REFERENCES sites(id),
            name TEXT NOT NULL,
            subject TEXT NOT NULL DEFAULT '',
            blocks TEXT NOT NULL DEFAULT '[]',
            status campaign_status NOT NULL DEFAULT 'draft',
            "audienceType" campaign_audience NOT NULL DEFAULT 'all',
            "audienceSegmentId" TEXT REFERENCES segments(id),
            "audienceSubSegmentId" TEXT REFERENCES sub_segments(id),
            "totalRecipients" INTEGER NOT NULL DEFAULT 0,
            "sentCount" INTEGER NOT NULL DEFAULT 0,
            "failedCount" INTEGER NOT NULL DEFAULT 0,
            "scheduledAt" TIMESTAMP,
            "sentAt" TIMESTAMP,
            "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS campaign_recipients (
            id TEXT PRIMARY KEY,
            "campaignId" TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
            "guestId" TEXT REFERENCES guests(id),
            email TEXT NOT NULL,
            status recipient_status NOT NULL DEFAULT 'pending',
            "sentAt" TIMESTAMP,
            "failedReason" TEXT,
            "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns("tenantId");
        CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients("campaignId");
        CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(status);
    """)


def downgrade():
    op.execute('DROP TABLE IF EXISTS campaign_recipients;')
    op.execute('DROP TABLE IF EXISTS campaigns;')
    op.execute('DROP TYPE IF EXISTS recipient_status;')
    op.execute('DROP TYPE IF EXISTS campaign_audience;')
    op.execute('DROP TYPE IF EXISTS campaign_status;')
