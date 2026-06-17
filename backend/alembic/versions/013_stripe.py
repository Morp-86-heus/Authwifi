"""add stripe fields to tenants"""
from alembic import op

revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None

def upgrade():
    op.execute('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "stripeCustomerId" VARCHAR;')
    op.execute('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" VARCHAR;')

def downgrade():
    op.execute('ALTER TABLE tenants DROP COLUMN IF EXISTS "stripeCustomerId";')
    op.execute('ALTER TABLE tenants DROP COLUMN IF EXISTS "stripeSubscriptionId";')
