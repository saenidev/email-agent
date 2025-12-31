"""Encryption utilities for storing OAuth tokens securely."""

from cryptography.fernet import Fernet

from app.config import get_settings

settings = get_settings()


def get_fernet() -> Fernet:
    """Get Fernet instance for encryption/decryption."""
    return Fernet(settings.token_encryption_key.encode())


def encrypt_token(token: str) -> str:
    """Encrypt a token for storage."""
    f = get_fernet()
    return f.encrypt(token.encode()).decode()


def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a stored token."""
    f = get_fernet()
    return f.decrypt(encrypted_token.encode()).decode()
