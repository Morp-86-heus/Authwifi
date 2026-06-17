import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional
from sqlalchemy import (
    String, DateTime, Boolean, Integer, ForeignKey, UniqueConstraint,
    func, Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


def new_id() -> str:
    return str(uuid.uuid4())


class Plan(str, PyEnum):
    TRIAL = "TRIAL"
    STARTER = "STARTER"
    PRO = "PRO"
    ENTERPRISE = "ENTERPRISE"


class SiteType(str, PyEnum):
    HOTEL = "HOTEL"
    BNB = "BNB"
    BEACH_CLUB = "BEACH_CLUB"
    RESTAURANT = "RESTAURANT"
    OTHER = "OTHER"


class ConsentType(str, PyEnum):
    TERMS_OF_SERVICE = "TERMS_OF_SERVICE"
    MARKETING_EMAIL = "MARKETING_EMAIL"
    MARKETING_SMS = "MARKETING_SMS"
    PROFILING = "PROFILING"
    THIRD_PARTY = "THIRD_PARTY"


class ManagerRole(str, PyEnum):
    SUPERADMIN = "superadmin"
    OWNER = "owner"
    MANAGER = "manager"
    STAFF = "staff"


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    plan: Mapped[str] = mapped_column(
        SAEnum(Plan, name="Plan", create_type=True), default=Plan.TRIAL
    )

    # Anagrafica
    ragione_sociale: Mapped[str | None] = mapped_column("ragioneSociale", String, nullable=True)
    forma_giuridica: Mapped[str | None] = mapped_column("formaGiuridica", String, nullable=True)
    partita_iva: Mapped[str | None] = mapped_column("partitaIva", String, nullable=True)
    codice_fiscale: Mapped[str | None] = mapped_column("codiceFiscale", String, nullable=True)

    # Sede
    via: Mapped[str | None] = mapped_column(String, nullable=True)
    civico: Mapped[str | None] = mapped_column(String, nullable=True)
    cap: Mapped[str | None] = mapped_column(String, nullable=True)
    citta: Mapped[str | None] = mapped_column(String, nullable=True)
    provincia: Mapped[str | None] = mapped_column(String, nullable=True)
    paese: Mapped[str | None] = mapped_column(String, nullable=True)

    # Contatti
    telefono: Mapped[str | None] = mapped_column(String, nullable=True)
    contact_email: Mapped[str | None] = mapped_column("contactEmail", String, nullable=True)
    pec: Mapped[str | None] = mapped_column(String, nullable=True)
    sito_web: Mapped[str | None] = mapped_column("sitoWeb", String, nullable=True)

    # Fatturazione
    codice_sdi: Mapped[str | None] = mapped_column("codiceSdi", String, nullable=True)
    pec_fatturazione: Mapped[str | None] = mapped_column("pecFatturazione", String, nullable=True)
    iban: Mapped[str | None] = mapped_column(String, nullable=True)

    note: Mapped[str | None] = mapped_column(String, nullable=True)
    logo_url: Mapped[str | None] = mapped_column("logoUrl", String, nullable=True)

    plan_expires_at: Mapped[datetime | None] = mapped_column("planExpiresAt", DateTime, nullable=True)
    is_suspended: Mapped[bool] = mapped_column("isSuspended", Boolean, default=False, server_default="false")

    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column("deletedAt", DateTime, nullable=True)

    sites: Mapped[list["Site"]] = relationship("Site", back_populates="tenant")
    managers: Mapped[list["Manager"]] = relationship("Manager", back_populates="tenant")
    guests: Mapped[list["Guest"]] = relationship("Guest", back_populates="tenant")
    segments: Mapped[list["Segment"]] = relationship("Segment", back_populates="tenant")


class Manager(Base):
    __tablename__ = "managers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column("tenantId", String, ForeignKey("tenants.id"), nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column("passwordHash", String, nullable=False)
    first_name: Mapped[str | None] = mapped_column("firstName", String, nullable=True)
    last_name: Mapped[str | None] = mapped_column("lastName", String, nullable=True)
    role: Mapped[str] = mapped_column(SAEnum(ManagerRole, name="ManagerRole", create_type=True), default=ManagerRole.OWNER)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime, server_default=func.now(), onupdate=func.now()
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="managers")
    site_assignments: Mapped[list["ManagerSite"]] = relationship("ManagerSite", back_populates="manager", cascade="all, delete-orphan")


class ManagerSite(Base):
    __tablename__ = "manager_sites"
    __table_args__ = (
        UniqueConstraint("managerId", "siteId", name="ManagerSite_managerId_siteId_key"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    manager_id: Mapped[str] = mapped_column("managerId", String, ForeignKey("managers.id"), nullable=False)
    site_id: Mapped[str] = mapped_column("siteId", String, ForeignKey("sites.id"), nullable=False)

    manager: Mapped["Manager"] = relationship("Manager", back_populates="site_assignments")
    site: Mapped["Site"] = relationship("Site")


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column("tenantId", String, ForeignKey("tenants.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str] = mapped_column(
        SAEnum(SiteType, name="SiteType", create_type=True), default=SiteType.HOTEL
    )

    omada_controller_url: Mapped[str | None] = mapped_column("omadaControllerUrl", String, nullable=True)
    omada_omadac_id: Mapped[str | None] = mapped_column("omadaOmadacId", String, nullable=True)
    omada_site_id: Mapped[str | None] = mapped_column("omadaSiteId", String, nullable=True)
    omada_operator_user: Mapped[str | None] = mapped_column("omadaOperatorUser", String, nullable=True)
    omada_operator_pass: Mapped[str | None] = mapped_column("omadaOperatorPass", String, nullable=True)

    primary_color: Mapped[str] = mapped_column("primaryColor", String, default="#0055ff")
    accent_color: Mapped[str] = mapped_column("accentColor", String, default="#f5f5f5")
    welcome_title: Mapped[str] = mapped_column("welcomeTitle", String, default="Benvenuto!")
    welcome_text: Mapped[str] = mapped_column("welcomeText", String, default="Connettiti al WiFi gratuito.")
    login_methods: Mapped[str] = mapped_column("loginMethods", String, default="email,clickthrough")
    logo_url: Mapped[str | None] = mapped_column("logoUrl", String, nullable=True)
    background_image_url: Mapped[str | None] = mapped_column("backgroundImageUrl", String, nullable=True)
    hero_image_url: Mapped[str | None] = mapped_column("heroImageUrl", String, nullable=True)

    survey_enabled: Mapped[bool] = mapped_column("surveyEnabled", Boolean, default=True, server_default="true")
    survey_hours_delay: Mapped[int] = mapped_column("surveyHoursDelay", Integer, default=24, server_default="24")
    google_place_id: Mapped[str | None] = mapped_column("googlePlaceId", String, nullable=True)
    survey_title: Mapped[str | None] = mapped_column("surveyTitle", String, nullable=True)
    survey_subtitle: Mapped[str | None] = mapped_column("surveySubtitle", String, nullable=True)
    survey_question_label: Mapped[str | None] = mapped_column("surveyQuestionLabel", String, nullable=True)
    survey_comment_label: Mapped[str | None] = mapped_column("surveyCommentLabel", String, nullable=True)
    survey_button_text: Mapped[str | None] = mapped_column("surveyButtonText", String, nullable=True)
    survey_thank_you_title: Mapped[str | None] = mapped_column("surveyThankYouTitle", String, nullable=True)
    survey_show_comment: Mapped[bool] = mapped_column("surveyShowComment", Boolean, default=True, server_default="true")
    email_subject: Mapped[str | None] = mapped_column("emailSubject", String, nullable=True)
    email_body_text: Mapped[str | None] = mapped_column("emailBodyText", String, nullable=True)
    email_button_text: Mapped[str | None] = mapped_column("emailButtonText", String, nullable=True)
    email_footer_text: Mapped[str | None] = mapped_column("emailFooterText", String, nullable=True)

    smtp_host: Mapped[str | None] = mapped_column("smtpHost", String, nullable=True)
    smtp_port: Mapped[int] = mapped_column("smtpPort", Integer, default=587, server_default="587")
    smtp_security: Mapped[str] = mapped_column("smtpSecurity", String, default="starttls", server_default="'starttls'")
    smtp_username: Mapped[str | None] = mapped_column("smtpUsername", String, nullable=True)
    smtp_password: Mapped[str | None] = mapped_column("smtpPassword", String, nullable=True)
    smtp_from_email: Mapped[str | None] = mapped_column("smtpFromEmail", String, nullable=True)
    smtp_from_name: Mapped[str | None] = mapped_column("smtpFromName", String, nullable=True)

    facebook_url: Mapped[str | None] = mapped_column("facebookUrl", String, nullable=True)
    instagram_url: Mapped[str | None] = mapped_column("instagramUrl", String, nullable=True)
    tripadvisor_url: Mapped[str | None] = mapped_column("tripadvisorUrl", String, nullable=True)
    google_review_url: Mapped[str | None] = mapped_column("googleReviewUrl", String, nullable=True)
    booking_url: Mapped[str | None] = mapped_column("bookingUrl", String, nullable=True)
    twitter_url: Mapped[str | None] = mapped_column("twitterUrl", String, nullable=True)

    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime, server_default=func.now(), onupdate=func.now()
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="sites")
    sessions: Mapped[list["WifiSession"]] = relationship("WifiSession", back_populates="site")


class Guest(Base):
    __tablename__ = "guests"
    __table_args__ = (
        UniqueConstraint("tenantId", "macAddress", name="Guest_tenantId_macAddress_key"),
        UniqueConstraint("tenantId", "email", name="Guest_tenantId_email_key"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column("tenantId", String, ForeignKey("tenants.id"), nullable=False)
    mac_address: Mapped[str | None] = mapped_column("macAddress", String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    first_name: Mapped[str | None] = mapped_column("firstName", String, nullable=True)
    last_name: Mapped[str | None] = mapped_column("lastName", String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    language: Mapped[str | None] = mapped_column(String, nullable=True)
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column("deletedAt", DateTime, nullable=True)

    segment_id: Mapped[str | None] = mapped_column("segmentId", String, ForeignKey("segments.id"), nullable=True)
    sub_segment_id: Mapped[str | None] = mapped_column("subSegmentId", String, ForeignKey("sub_segments.id"), nullable=True)

    survey_email_sent_at: Mapped[datetime | None] = mapped_column("surveyEmailSentAt", DateTime, nullable=True)

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="guests")
    sessions: Mapped[list["WifiSession"]] = relationship("WifiSession", back_populates="guest")
    consents: Mapped[list["Consent"]] = relationship("Consent", back_populates="guest")
    segment: Mapped[Optional["Segment"]] = relationship("Segment", viewonly=True)
    sub_segment: Mapped[Optional["SubSegment"]] = relationship("SubSegment", viewonly=True)
    survey_responses: Mapped[list["SurveyResponse"]] = relationship("SurveyResponse", back_populates="guest")


class WifiSession(Base):
    __tablename__ = "wifi_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    guest_id: Mapped[str | None] = mapped_column("guestId", String, ForeignKey("guests.id"), nullable=True)
    site_id: Mapped[str] = mapped_column("siteId", String, ForeignKey("sites.id"), nullable=False)
    mac_address: Mapped[str] = mapped_column("macAddress", String, nullable=False)
    ap_mac: Mapped[str | None] = mapped_column("apMac", String, nullable=True)
    ssid_name: Mapped[str | None] = mapped_column("ssidName", String, nullable=True)
    started_at: Mapped[datetime] = mapped_column("startedAt", DateTime, server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column("endedAt", DateTime, nullable=True)
    omada_session_id: Mapped[str | None] = mapped_column("omadaSessionId", String, nullable=True)

    guest: Mapped["Guest"] = relationship("Guest", back_populates="sessions")
    site: Mapped["Site"] = relationship("Site", back_populates="sessions")


class Consent(Base):
    __tablename__ = "consents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    guest_id: Mapped[str] = mapped_column("guestId", String, ForeignKey("guests.id"), nullable=False)
    type: Mapped[str] = mapped_column(
        SAEnum(ConsentType, name="ConsentType", create_type=True), nullable=False
    )
    granted: Mapped[bool] = mapped_column(Boolean, default=True)
    ip_address: Mapped[str | None] = mapped_column("ipAddress", String, nullable=True)
    user_agent: Mapped[str | None] = mapped_column("userAgent", String, nullable=True)
    policy_version: Mapped[str] = mapped_column("policyVersion", String, default="1.0")
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, server_default=func.now())

    guest: Mapped["Guest"] = relationship("Guest", back_populates="consents")


class MacBlacklist(Base):
    __tablename__ = "mac_blacklist"
    __table_args__ = (
        UniqueConstraint("siteId", "macAddress", name="mac_blacklist_site_mac_key"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column("tenantId", String, ForeignKey("tenants.id"), nullable=False)
    site_id: Mapped[str] = mapped_column("siteId", String, ForeignKey("sites.id"), nullable=False)
    mac_address: Mapped[str] = mapped_column("macAddress", String, nullable=False)
    reason: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, server_default=func.now())


class MacWhitelist(Base):
    __tablename__ = "mac_whitelist"
    __table_args__ = (
        UniqueConstraint("siteId", "macAddress", name="mac_whitelist_site_mac_key"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column("tenantId", String, ForeignKey("tenants.id"), nullable=False)
    site_id: Mapped[str] = mapped_column("siteId", String, ForeignKey("sites.id"), nullable=False)
    mac_address: Mapped[str] = mapped_column("macAddress", String, nullable=False)
    label: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, server_default=func.now())


class Segment(Base):
    __tablename__ = "segments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column("tenantId", String, ForeignKey("tenants.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, server_default=func.now())

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="segments")
    sub_segments: Mapped[list["SubSegment"]] = relationship("SubSegment", back_populates="segment", cascade="all, delete-orphan")


class SubSegment(Base):
    __tablename__ = "sub_segments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    segment_id: Mapped[str] = mapped_column("segmentId", String, ForeignKey("segments.id"), nullable=False)
    tenant_id: Mapped[str] = mapped_column("tenantId", String, ForeignKey("tenants.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    text_it: Mapped[str | None] = mapped_column("textIt", String, nullable=True)
    date_start: Mapped[datetime | None] = mapped_column("dateStart", DateTime, nullable=True)
    date_end: Mapped[datetime | None] = mapped_column("dateEnd", DateTime, nullable=True)
    recurring: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, server_default=func.now())

    segment: Mapped["Segment"] = relationship("Segment", back_populates="sub_segments")


class SurveyResponse(Base):
    __tablename__ = "survey_responses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    guest_id: Mapped[str] = mapped_column("guestId", String, ForeignKey("guests.id"), nullable=False)
    site_id: Mapped[str] = mapped_column("siteId", String, ForeignKey("sites.id"), nullable=False)
    tenant_id: Mapped[str] = mapped_column("tenantId", String, ForeignKey("tenants.id"), nullable=False)
    nps_score: Mapped[int | None] = mapped_column("npsScore", Integer, nullable=True)
    comment: Mapped[str | None] = mapped_column(String, nullable=True)
    survey_token: Mapped[str] = mapped_column("surveyToken", String, unique=True, nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column("submittedAt", DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, server_default=func.now())

    guest: Mapped["Guest"] = relationship("Guest", back_populates="survey_responses")
    site: Mapped["Site"] = relationship("Site")


class ExternalReview(Base):
    __tablename__ = "external_reviews"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    site_id: Mapped[str] = mapped_column("siteId", String, ForeignKey("sites.id"), nullable=False)
    tenant_id: Mapped[str] = mapped_column("tenantId", String, ForeignKey("tenants.id"), nullable=False)
    source: Mapped[str] = mapped_column(String, default="google", server_default="'google'")
    external_id: Mapped[str | None] = mapped_column("externalId", String, nullable=True)
    author_name: Mapped[str | None] = mapped_column("authorName", String, nullable=True)
    author_photo: Mapped[str | None] = mapped_column("authorPhoto", String, nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    text: Mapped[str | None] = mapped_column(String, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column("publishedAt", DateTime, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column("fetchedAt", DateTime, server_default=func.now(), onupdate=func.now())

    site: Mapped["Site"] = relationship("Site")


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column("tenantId", String, ForeignKey("tenants.id"), nullable=False)
    site_id: Mapped[str | None] = mapped_column("siteId", String, ForeignKey("sites.id"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False, server_default="''")
    blocks: Mapped[str] = mapped_column(String, nullable=False, server_default="'[]'")
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="'draft'")
    audience_type: Mapped[str] = mapped_column("audienceType", String, nullable=False, server_default="'all'")
    audience_segment_id: Mapped[str | None] = mapped_column("audienceSegmentId", String, ForeignKey("segments.id"), nullable=True)
    audience_sub_segment_id: Mapped[str | None] = mapped_column("audienceSubSegmentId", String, ForeignKey("sub_segments.id"), nullable=True)
    total_recipients: Mapped[int] = mapped_column("totalRecipients", Integer, nullable=False, server_default="0")
    sent_count: Mapped[int] = mapped_column("sentCount", Integer, nullable=False, server_default="0")
    failed_count: Mapped[int] = mapped_column("failedCount", Integer, nullable=False, server_default="0")
    scheduled_at: Mapped[datetime | None] = mapped_column("scheduledAt", DateTime, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column("sentAt", DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, server_default=func.now(), onupdate=func.now())

    recipients: Mapped[list["CampaignRecipient"]] = relationship("CampaignRecipient", back_populates="campaign", cascade="all, delete-orphan")


class CampaignRecipient(Base):
    __tablename__ = "campaign_recipients"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    campaign_id: Mapped[str] = mapped_column("campaignId", String, ForeignKey("campaigns.id"), nullable=False)
    guest_id: Mapped[str | None] = mapped_column("guestId", String, ForeignKey("guests.id"), nullable=True)
    email: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="'pending'")
    sent_at: Mapped[datetime | None] = mapped_column("sentAt", DateTime, nullable=True)
    failed_reason: Mapped[str | None] = mapped_column("failedReason", String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, server_default=func.now())

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="recipients")


class Automation(Base):
    __tablename__ = "automations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column("tenantId", String, ForeignKey("tenants.id"), nullable=False)
    site_id: Mapped[str | None] = mapped_column("siteId", String, ForeignKey("sites.id"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False, server_default="''")
    blocks: Mapped[str] = mapped_column(String, nullable=False, server_default="'[]'")
    trigger_type: Mapped[str] = mapped_column("triggerType", String, nullable=False, server_default="'welcome'")
    trigger_config: Mapped[str] = mapped_column("triggerConfig", String, nullable=False, server_default="'{}'")
    delay_hours: Mapped[int] = mapped_column("delayHours", Integer, nullable=False, server_default="0")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, server_default=func.now(), onupdate=func.now())
