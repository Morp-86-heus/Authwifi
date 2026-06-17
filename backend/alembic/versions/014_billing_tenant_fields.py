"""add planExpiresAt and isSuspended to tenants"""
from alembic import op

revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None

def upgrade():
    op.execute('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP;')
    op.execute('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "isSuspended" BOOLEAN NOT NULL DEFAULT false;')

def downgrade():
    op.execute('ALTER TABLE tenants DROP COLUMN IF EXISTS "planExpiresAt";')
    op.execute('ALTER TABLE tenants DROP COLUMN IF EXISTS "isSuspended";')
