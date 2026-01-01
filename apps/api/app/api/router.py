from fastapi import APIRouter

from app.api.v1 import activity, auth, drafts, emails, gmail, rules, settings

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(gmail.router, prefix="/gmail", tags=["gmail"])
api_router.include_router(emails.router, prefix="/emails", tags=["emails"])
api_router.include_router(drafts.router, prefix="/drafts", tags=["drafts"])
api_router.include_router(rules.router, prefix="/rules", tags=["rules"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(activity.router, prefix="/activity", tags=["activity"])
