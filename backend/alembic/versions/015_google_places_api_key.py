"""add googlePlacesApiKey to sites"""
from alembic import op

revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None

def upgrade():
    op.execute('ALTER TABLE sites ADD COLUMN IF NOT EXISTS "googlePlacesApiKey" VARCHAR;')

def downgrade():
    op.execute('ALTER TABLE sites DROP COLUMN IF EXISTS "googlePlacesApiKey";')
