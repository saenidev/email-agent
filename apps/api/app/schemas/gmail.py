from pydantic import BaseModel


class GmailStatus(BaseModel):
    connected: bool
    email: str | None = None
