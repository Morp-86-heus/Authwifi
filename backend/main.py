import os
import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from database import engine
from models import Base
from routers import auth, portal, crm, tenants, sites, stats, managers, superadmin, whitelist, blacklist, segments, survey, reviews, campaigns, automations

logging.basicConfig(level=logging.INFO)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Authwifi API",
    description="Piattaforma WiFi Marketing",
    version="0.1",
    docs_url="/api/docs" if os.getenv("NODE_ENV") != "production" else None,
    redoc_url=None,
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Path("public/uploads").mkdir(parents=True, exist_ok=True)
app.mount("/public", StaticFiles(directory="public"), name="public")

app.include_router(auth.router)
app.include_router(portal.router)
app.include_router(crm.router)
app.include_router(tenants.router)
app.include_router(sites.router)
app.include_router(stats.router)
app.include_router(managers.router)
app.include_router(superadmin.router)
app.include_router(whitelist.router)
app.include_router(blacklist.router)
app.include_router(segments.router)
app.include_router(survey.router)
app.include_router(reviews.router)
app.include_router(campaigns.router)
app.include_router(automations.router)


@app.get("/health")
def health():
    return {"status": "ok"}
