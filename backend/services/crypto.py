"""
Cifratura simmetrica Fernet per dati sensibili nel DB.
Generare la chiave: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""
import os
import logging

logger = logging.getLogger(__name__)

_PREFIX = "enc:"  # identifica valori cifrati


def _fernet():
    from cryptography.fernet import Fernet
    key = os.getenv("ENCRYPTION_KEY", "")
    if not key:
        raise RuntimeError("ENCRYPTION_KEY non impostata nel .env")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt(plaintext):
    """Cifra un valore. Ritorna None se input e None/vuoto."""
    if not plaintext:
        return plaintext
    if plaintext.startswith(_PREFIX):
        return plaintext  # gia cifrato
    token = _fernet().encrypt(plaintext.encode()).decode()
    return f"{_PREFIX}{token}"


def decrypt(ciphertext):
    """Decifra un valore. Fallback trasparente per valori legacy in chiaro."""
    if not ciphertext:
        return ciphertext
    if not ciphertext.startswith(_PREFIX):
        return ciphertext  # valore legacy in chiaro
    try:
        return _fernet().decrypt(ciphertext[len(_PREFIX):].encode()).decode()
    except Exception as exc:
        logger.error("Errore decifratura: %s", exc)
        return None
