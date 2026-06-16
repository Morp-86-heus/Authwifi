"""Add performance indexes for multi-tenant scalability

Revision ID: 003
Revises: 002
Create Date: 2026-06-16

"""
from typing import Sequence, Union
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # managers: FK on tenantId
    op.execute('CREATE INDEX IF NOT EXISTS "idx_managers_tenantId" ON managers ("tenantId")')

    # sites: FK on tenantId + composite for paginated lists
    op.execute('CREATE INDEX IF NOT EXISTS "idx_sites_tenantId" ON sites ("tenantId")')
    op.execute('CREATE INDEX IF NOT EXISTS "idx_sites_tenant_created" ON sites ("tenantId", "createdAt" DESC)')

    # guests: partial composite for tenant-scoped list queries (the hot path)
    op.execute(
        'CREATE INDEX IF NOT EXISTS "idx_guests_tenant_created" '
        'ON guests ("tenantId", "createdAt" DESC) WHERE "deletedAt" IS NULL'
    )
    # guests: FK indexes for segment queries
    op.execute('CREATE INDEX IF NOT EXISTS "idx_guests_segmentId" ON guests ("segmentId")')
    op.execute('CREATE INDEX IF NOT EXISTS "idx_guests_subSegmentId" ON guests ("subSegmentId")')

    # wifi_sessions: FK indexes (critical for guest detail page and analytics)
    op.execute('CREATE INDEX IF NOT EXISTS "idx_sessions_guestId" ON wifi_sessions ("guestId")')
    op.execute(
        'CREATE INDEX IF NOT EXISTS "idx_sessions_siteId_startedAt" '
        'ON wifi_sessions ("siteId", "startedAt" DESC)'
    )
    op.execute('CREATE INDEX IF NOT EXISTS "idx_sessions_macAddress" ON wifi_sessions ("macAddress")')

    # consents: FK index (used on every portal login and guest detail)
    op.execute('CREATE INDEX IF NOT EXISTS "idx_consents_guestId" ON consents ("guestId")')

    # segments: FK on tenantId
    op.execute('CREATE INDEX IF NOT EXISTS "idx_segments_tenantId" ON segments ("tenantId")')

    # sub_segments: FK indexes
    op.execute('CREATE INDEX IF NOT EXISTS "idx_subsegments_tenantId" ON sub_segments ("tenantId")')
    op.execute('CREATE INDEX IF NOT EXISTS "idx_subsegments_segmentId" ON sub_segments ("segmentId")')

    # mac_blacklist / mac_whitelist: tenantId FK (siteId+macAddress UNIQUE already indexed)
    op.execute('CREATE INDEX IF NOT EXISTS "idx_blacklist_tenantId" ON mac_blacklist ("tenantId")')
    op.execute('CREATE INDEX IF NOT EXISTS "idx_whitelist_tenantId" ON mac_whitelist ("tenantId")')

    # manager_sites: siteId FK (managerId+siteId UNIQUE covers managerId lookups already)
    op.execute('CREATE INDEX IF NOT EXISTS "idx_managersites_siteId" ON manager_sites ("siteId")')


def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS "idx_managersites_siteId"')
    op.execute('DROP INDEX IF EXISTS "idx_whitelist_tenantId"')
    op.execute('DROP INDEX IF EXISTS "idx_blacklist_tenantId"')
    op.execute('DROP INDEX IF EXISTS "idx_subsegments_segmentId"')
    op.execute('DROP INDEX IF EXISTS "idx_subsegments_tenantId"')
    op.execute('DROP INDEX IF EXISTS "idx_segments_tenantId"')
    op.execute('DROP INDEX IF EXISTS "idx_consents_guestId"')
    op.execute('DROP INDEX IF EXISTS "idx_sessions_macAddress"')
    op.execute('DROP INDEX IF EXISTS "idx_sessions_siteId_startedAt"')
    op.execute('DROP INDEX IF EXISTS "idx_sessions_guestId"')
    op.execute('DROP INDEX IF EXISTS "idx_guests_subSegmentId"')
    op.execute('DROP INDEX IF EXISTS "idx_guests_segmentId"')
    op.execute('DROP INDEX IF EXISTS "idx_guests_tenant_created"')
    op.execute('DROP INDEX IF EXISTS "idx_sites_tenant_created"')
    op.execute('DROP INDEX IF EXISTS "idx_sites_tenantId"')
    op.execute('DROP INDEX IF EXISTS "idx_managers_tenantId"')
