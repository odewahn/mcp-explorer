import os, base64, json, getpass
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

VERSION = 1
b64e = lambda b: base64.urlsafe_b64encode(b).decode("ascii")


def derive_key(password: bytes, salt: bytes) -> bytes:
    kdf = Scrypt(
        salt=salt,
        length=32,
        n=2**15,  # adjust down (2**14) if too slow
        r=8,
        p=1,
        backend=default_backend(),
    )
    return kdf.derive(password)


api_key = getpass.getpass("API key to encrypt (input hidden): ").encode()
password = getpass.getpass("Password (to derive encryption key): ").encode()

salt = os.urandom(16)
key = derive_key(password, salt)

nonce = os.urandom(12)
aesgcm = AESGCM(key)
ct = aesgcm.encrypt(nonce, api_key, None)

payload = {"v": VERSION, "s": b64e(salt), "n": b64e(nonce), "c": b64e(ct)}
token = "ENC:" + base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()

print("\nPut this in your env:")
print(f'ENCRYPTED_API_KEY="{token}"')
