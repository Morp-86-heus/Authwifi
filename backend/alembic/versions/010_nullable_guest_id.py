"""make survey_responses.guestId nullable for test tokens"""
from alembic import op

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None

def upgrade():
    op.execute('''ALTER TABLE survey_responses ALTER COLUMN "guestId" DROP NOT NULL''')

def downgrade():
    op.execute('''ALTER TABLE survey_responses ALTER COLUMN "guestId" SET NOT NULL''')
