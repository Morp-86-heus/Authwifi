"""Wrapper Stripe SDK."""
import os
import stripe

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

PLAN_PRICES = {
    "STARTER":    os.getenv("STRIPE_PRICE_STARTER", ""),
    "PRO":        os.getenv("STRIPE_PRICE_PRO", ""),
    "ENTERPRISE": os.getenv("STRIPE_PRICE_ENTERPRISE", ""),
}

def create_checkout_session(tenant_id, plan, customer_id, success_url, cancel_url):
    params = {
        "mode": "subscription",
        "line_items": [{"price": PLAN_PRICES[plan], "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {"tenant_id": tenant_id, "plan": plan},
        "client_reference_id": tenant_id,
    }
    if customer_id:
        params["customer"] = customer_id
    else:
        params["customer_creation"] = "always"
    session = stripe.checkout.Session.create(**params)
    return session.url, session.id

def create_portal_session(customer_id, return_url):
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return session.url

def construct_webhook_event(payload, sig_header):
    secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    return stripe.Webhook.construct_event(payload, sig_header, secret)
