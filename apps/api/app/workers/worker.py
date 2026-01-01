"""ARQ worker configuration."""

import logging
from typing import Any

from arq import cron
from arq.connections import RedisSettings

from app.config import get_settings
from app.workers.tasks import (
    poll_all_users,
    poll_emails_for_user,
    refresh_gmail_tokens,
    send_approved_draft,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


async def startup(ctx: dict[str, Any]) -> None:
    """Worker startup hook."""
    logger.info("ARQ Worker starting up...")


async def shutdown(ctx: dict[str, Any]) -> None:
    """Worker shutdown hook."""
    logger.info("ARQ Worker shutting down...")


class WorkerSettings:
    """ARQ worker settings."""

    # Redis connection
    redis_settings = RedisSettings.from_dsn(str(settings.redis_url))

    # Available functions
    functions = [
        poll_all_users,
        poll_emails_for_user,
        send_approved_draft,
        refresh_gmail_tokens,
    ]

    # Scheduled jobs (cron)
    cron_jobs = [
        # Poll emails every 5 minutes
        cron(
            poll_all_users,
            minute={0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55},
            run_at_startup=True,
        ),
        # Refresh tokens every hour
        cron(
            refresh_gmail_tokens,
            minute=0,
        ),
    ]

    # Lifecycle hooks
    on_startup = startup
    on_shutdown = shutdown

    # Worker settings
    max_jobs = 10
    job_timeout = 300  # 5 minutes
    keep_result = 3600  # 1 hour
    keep_result_forever = False
