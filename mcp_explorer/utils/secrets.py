"""
Helper to decrypt AES-GCM + Scrypt-wrapped env vars (ENC:... tokens).

Based on feature-encrypted-env-var.md pattern.
"""
import os
import base64
import json
import getpass

from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag


b64d = lambda s: base64.urlsafe_b64decode(s.encode())

def derive_key(password: bytes, salt: bytes) -> bytes:
    kdf = Scrypt(
        salt=salt,
        length=32,
        n=2**15,
        r=8,
        p=1,
        backend=default_backend(),
    )
    return kdf.derive(password)

def load_and_decrypt_env(var_name: str = "ENCRYPTED_API_KEY") -> str:
    token = os.environ.get(var_name)
    if not token or not token.startswith("ENC:"):
        raise RuntimeError(f"{var_name} not set or not an ENC token")

    payload = json.loads(base64.urlsafe_b64decode(token[4:].encode()))
    if payload.get("v") != 1:
        raise RuntimeError("Unsupported secret version")

    salt = b64d(payload["s"])
    nonce = b64d(payload["n"])
    ct = b64d(payload["c"])

    password = getpass.getpass("Password to unlock secret: ").encode()
    key = derive_key(password, salt)

    try:
        plaintext = AESGCM(key).decrypt(nonce, ct, None)
    except InvalidTag:
        raise RuntimeError("Failed to decrypt secret: incorrect password or corrupt token")

    return plaintext.decode()