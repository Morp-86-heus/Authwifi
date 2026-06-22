"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-16

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("contact_email", sa.String(), nullable=True),
        sa.Column("logo_url", sa.String(), nullable=True),
        sa.Column("plan", sa.Enum("TRIAL", "STARTER", "PRO", "ENTERPRISE", name="plan_enum"), nullable=False, server_default="TRIAL"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )

    op.create_table(
        "managers",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("first_name", sa.String(), nullable=True),
        sa.Column("last_name", sa.String(), nullable=True),
        sa.Column("role", sa.String(), nullable=False, server_default="owner"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    op.create_table(
        "sites",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("address", sa.String(), nullable=True),
        sa.Column("type", sa.Enum("HOTEL", "BNB", "BEACH_CLUB", "RESTAURANT", "OTHER", name="site_type_enum"), nullable=False, server_default="HOTEL"),
        sa.Column("omada_controller_url", sa.String(), nullable=True),
        sa.Column("omada_omadac_id", sa.String(), nullable=True),
        sa.Column("omada_site_id", sa.String(), nullable=True),
        sa.Column("omada_operator_user", sa.String(), nullable=True),
        sa.Column("omada_operator_pass", sa.String(), nullable=True),
        sa.Column("primary_color", sa.String(), nullable=False, server_default="#0055ff"),
        sa.Column("accent_color", sa.String(), nullable=False, server_default="#f5f5f5"),
        sa.Column("welcome_title", sa.String(), nullable=False, server_default="Benvenuto!"),
        sa.Column("welcome_text", sa.String(), nullable=False, server_default="Connettiti al WiFi gratuito."),
        sa.Column("login_methods", sa.String(), nullable=False, server_default="email,clickthrough"),
        sa.Column("logo_url", sa.String(), nullable=True),
        sa.Column("background_image_url", sa.String(), nullable=True),
        sa.Column("hero_image_url", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "guests",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("mac_address", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("first_name", sa.String(), nullable=True),
        sa.Column("last_name", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("language", sa.String(), nullable=True),
        sa.Column("country", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "mac_address", name="uq_guest_tenant_mac"),
        sa.UniqueConstraint("tenant_id", "email", name="uq_guest_tenant_email"),
    )

    op.create_table(
        "wifi_sessions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("guest_id", sa.String(), nullable=False),
        sa.Column("site_id", sa.String(), nullable=False),
        sa.Column("mac_address", sa.String(), nullable=False),
        sa.Column("ap_mac", sa.String(), nullable=True),
        sa.Column("ssid_name", sa.String(), nullable=True),
        sa.Column("started_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("omada_session_id", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["guest_id"], ["guests.id"]),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "consents",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("guest_id", sa.String(), nullable=False),
        sa.Column("type", sa.Enum("TERMS_OF_SERVICE", "MARKETING_EMAIL", "MARKETING_SMS", "PROFILING", "THIRD_PARTY", name="consent_type_enum"), nullable=False),
        sa.Column("granted", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("user_agent", sa.String(), nullable=True),
        sa.Column("policy_version", sa.String(), nullable=False, server_default="1.0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["guest_id"], ["guests.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("consents")
    op.drop_table("wifi_sessions")
    op.drop_table("guests")
    op.drop_table("sites")
    op.drop_table("managers")
    op.drop_table("tenants")
    op.execute("DROP TYPE IF EXISTS consent_type_enum")
    op.execute("DROP TYPE IF EXISTS site_type_enum")
    op.execute("DROP TYPE IF EXISTS plan_enum")
