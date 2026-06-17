"""
Billing Stripe - piani, checkout, webhook, portale clienti.
"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models import Tenant
from auth import get_current_manager, require_roles

router = APIRouter(prefix="/billing", tags=["billing"])
logger = logging.getLogger(__name__)

PLAN_LABELS = {
    "TRIAL":      {"name": "Trial",      "price": 0,   "maxSites": 1},
    "STARTER":    {"name": "Starter",    "price": 29,  "maxSites": 1},
    "PRO":        {"name": "Pro",        "price": 79,  "maxSites": 5},
    "ENTERPRISE": {"name": "Enterprise", "price": 199, "maxSites": None},
}

class CheckoutRequest(BaseModel):
    plan: str

@router.get("/status")
def billing_status(
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_manager),
):
    t = db.query(Tenant).filter(Tenant.id == current["tenant_id"]).first()
    if not t:
        raise HTTPException(404, "Tenant non trovato")
    info = PLAN_LABELS.get(t.plan, {})
    return {
        "plan": t.plan,
        "planName": info.get("name", t.plan),
        "price": info.get("price", 0),
        "maxSites": info.get("maxSites"),
        "planExpiresAt": t.plan_expires_at.isoformat() if t.plan_expires_at else None,
        "isSuspended": t.is_suspended,
        "hasStripe": bool(t.stripe_customer_id),
        "stripeCustomerId": t.stripe_customer_id,
    }

@router.post("/checkout")
def create_checkout(
    body: CheckoutRequest,
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("owner")),
):
    import os
    from services.stripe_service import create_checkout_session, PLAN_PRICES
    if body.plan not in ("STARTER", "PRO", "ENTERPRISE"):
        raise HTTPException(400, "Piano non valido")
    if not PLAN_PRICES.get(body.plan):
        raise HTTPException(400, f"Price ID per piano {body.plan} non configurato (STRIPE_PRICE_{body.plan})")
    t = db.query(Tenant).filter(Tenant.id == current["tenant_id"]).first()
    base = os.getenv("BASE_URL", "http://localhost:8000")
    dashboard = base.replace(":8000", ":3000") if ":8000" in base else base
    success_url = f"{dashboard}/settings?billing=success"
    cancel_url  = f"{dashboard}/settings?billing=cancelled"
    try:
        url, session_id = create_checkout_session(
            tenant_id=current["tenant_id"],
            plan=body.plan,
            customer_id=t.stripe_customer_id,
            success_url=success_url,
            cancel_url=cancel_url,
        )
        return {"checkoutUrl": url}
    except Exception as e:
        logger.error("Stripe checkout error: %s", e)
        raise HTTPException(500, f"Errore Stripe: {e}")

@router.post("/portal")
def customer_portal(
    db: Session = Depends(get_db),
    current: dict = Depends(require_roles("owner")),
):
    import os
    from services.stripe_service import create_portal_session
    t = db.query(Tenant).filter(Tenant.id == current["tenant_id"]).first()
    if not t or not t.stripe_customer_id:
        raise HTTPException(400, "Nessun abbonamento Stripe attivo")
    base = os.getenv("BASE_URL", "http://localhost:8000")
    dashboard = base.replace(":8000", ":3000") if ":8000" in base else base
    try:
        url = create_portal_session(t.stripe_customer_id, f"{dashboard}/settings")
        return {"portalUrl": url}
    except Exception as e:
        raise HTTPException(500, f"Errore Stripe: {e}")

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    from services.stripe_service import construct_webhook_event
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = construct_webhook_event(payload, sig)
    except Exception as e:
        logger.warning("Webhook Stripe non valido: %s", e)
        raise HTTPException(400, "Webhook non valido")

    etype = event["type"]
    logger.info("Stripe webhook: %s", etype)

    if etype == "checkout.session.completed":
        session = event["data"]["object"]
        tenant_id = session.get("metadata", {}).get("tenant_id")
        plan      = session.get("metadata", {}).get("plan", "STARTER")
        customer  = session.get("customer")
        sub_id    = session.get("subscription")
        if tenant_id:
            t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if t:
                t.plan = plan
                t.stripe_customer_id = customer
                t.stripe_subscription_id = sub_id
                from datetime import timedelta
                t.plan_expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30)
                db.commit()
                logger.info("Tenant %s aggiornato a piano %s", tenant_id, plan)

    elif etype in ("customer.subscription.updated", "customer.subscription.deleted"):
        sub = event["data"]["object"]
        customer = sub.get("customer")
        t = db.query(Tenant).filter(Tenant.stripe_customer_id == customer).first()
        if t:
            status = sub.get("status")
            if etype == "customer.subscription.deleted" or status in ("canceled", "unpaid"):
                t.plan = "TRIAL"
                t.plan_expires_at = None
                t.stripe_subscription_id = None
            elif status == "active":
                period_end = sub.get("current_period_end")
                if period_end:
                    t.plan_expires_at = datetime.fromtimestamp(period_end)
            db.commit()
            logger.info("Subscription %s -> tenant %s status %s", sub.get("id"), t.id, status)

    elif etype == "invoice.payment_failed":
        invoice = event["data"]["object"]
        customer = invoice.get("customer")
        t = db.query(Tenant).filter(Tenant.stripe_customer_id == customer).first()
        if t:
            logger.warning("Pagamento fallito per tenant %s", t.id)

    return JSONResponse({"received": True})
