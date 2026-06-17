"""008_survey_customization — testi e layout survey personalizzabili per sito"""
from alembic import op

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE sites
            ADD COLUMN IF NOT EXISTS "surveyTitle"         VARCHAR,
            ADD COLUMN IF NOT EXISTS "surveySubtitle"      VARCHAR,
            ADD COLUMN IF NOT EXISTS "surveyQuestionLabel" VARCHAR,
            ADD COLUMN IF NOT EXISTS "surveyCommentLabel"  VARCHAR,
            ADD COLUMN IF NOT EXISTS "surveyButtonText"    VARCHAR,
            ADD COLUMN IF NOT EXISTS "surveyThankYouTitle" VARCHAR,
            ADD COLUMN IF NOT EXISTS "surveyShowComment"   BOOLEAN NOT NULL DEFAULT true
    """)


def downgrade():
    op.execute("""
        ALTER TABLE sites
            DROP COLUMN IF EXISTS "surveyTitle",
            DROP COLUMN IF EXISTS "surveySubtitle",
            DROP COLUMN IF EXISTS "surveyQuestionLabel",
            DROP COLUMN IF EXISTS "surveyCommentLabel",
            DROP COLUMN IF EXISTS "surveyButtonText",
            DROP COLUMN IF EXISTS "surveyThankYouTitle",
            DROP COLUMN IF EXISTS "surveyShowComment"
    """)
