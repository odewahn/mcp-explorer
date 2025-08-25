Here’s a rewritten **README** that uses **Option B (cryptography’s Scrypt KDF)** so you won’t hit the OpenSSL “memory limit exceeded” issue.

---

# README — Password-Locked Env Secret (Python, with cryptography Scrypt)

A small pattern to make an API key stored as an environment variable **harder to casually discover**.
It encrypts the key with a user-supplied password and decrypts it at runtime in your CLI.

> ⚠️ **Not a substitute for real secret management.** This only raises the bar (e.g., against “someone cat’d the env”). If an attacker can run code as your process or read its memory, they can still get the plaintext once unlocked.

---

## What this gives you

- A self-contained **encrypted token** (salt + nonce + ciphertext) you can store in `ENV`.
- A CLI flow that **prompts for a password** to decrypt before use.
- AES-GCM (authenticated encryption) with a key derived from the password via **cryptography’s Scrypt KDF**.

---

## How it works (high level)

1. **Encrypt** (one-time or on rotation):

   - Enter the plaintext API key and a password.
   - A random salt is generated.
   - `Scrypt` derives a 256-bit key from the password + salt.
   - AES-GCM encrypts the API key with a random 12-byte nonce.
   - Outputs a compact `ENC:...` token you paste into your environment.

2. **Decrypt** (at runtime):

   - Your CLI reads the `ENC:...` token from `ENCRYPTED_API_KEY`.
   - Prompts for the password, re-derives the key with the stored salt.
   - Decrypts with the nonce + ciphertext to recover the API key.

---

## Repo layout

```
.
├── encrypt_api_key.py  # one-time encryptor that prints an ENC: token
├── cli_tool.py         # example CLI that prompts & decrypts at runtime
└── README.md
```

---

## Quickstart

**Requirements**

- Python 3.10+
- `cryptography`

```bash
pip install cryptography
```

**1) Create the encrypted token**

```bash
python encrypt_api_key.py
```

- Enter the **plaintext API key** (hidden input).
- Enter a **password** (this is what users will type to unlock it).

You’ll get output like:

```bash
ENCRYPTED_API_KEY="ENC:eyJ2IjoxLCJzIjoiUjE0Q1F..."
```

**2) Store it in your environment**

Add it to your server’s environment (shell export, `.env` file, systemd unit, container secret, etc.).

**3) Use it in your CLI**

```bash
python cli_tool.py
```

You’ll be prompted:

```
Password to unlock secret:
```

On success, your app receives the plaintext API key (don’t print it in real code).

---

## Example code

**encrypt_api_key.py**

```python
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
        backend=default_backend()
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
```

---

**cli_tool.py**

```python
import os, base64, json, getpass
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

b64d = lambda s: base64.urlsafe_b64decode(s.encode())

def derive_key(password: bytes, salt: bytes) -> bytes:
    kdf = Scrypt(
        salt=salt,
        length=32,
        n=2**15,
        r=8,
        p=1,
        backend=default_backend()
    )
    return kdf.derive(password)

def load_and_decrypt_env(var_name: str = "ENCRYPTED_API_KEY") -> str:
    token = os.environ.get(var_name)
    if not token or not token.startswith("ENC:"):
        raise RuntimeError(f"{var_name} not set or not an ENC token")

    payload = json.loads(base64.urlsafe_b64decode(token[4:].encode()))
    if payload.get("v") != 1:
        raise RuntimeError("Unsupported secret version")

    salt  = b64d(payload["s"])
    nonce = b64d(payload["n"])
    ct    = b64d(payload["c"])

    password = getpass.getpass("Password to unlock secret: ").encode()
    key = derive_key(password, salt)

    return AESGCM(key).decrypt(nonce, ct, None).decode()

if __name__ == "__main__":
    try:
        api_key = load_and_decrypt_env()
        print("Secret unlocked. (Don’t print in real tools.)")
        # use api_key...
    except Exception as e:
        print(f"Failed to unlock secret: {e}")
        raise SystemExit(1)
```

---

## Rotation

- **Rotate API key**: re-run `encrypt_api_key.py` with the new key, replace env var.
- **Rotate password**: decrypt once, re-encrypt with a new password to produce a new token.
- Keep `"v"` in the payload for versioning if you change KDF/params later.

---

## Threat model & limitations

This helps against:

- Accidental disclosure (logs, config dumps, `env` leakage).
- At-rest protection in environment stores.

It does **not** protect against:

- Attackers who can read process memory.
- Weak or reused passwords.
- Shoulder surfing / phishing during unlock.

For production systems, prefer:

- Cloud KMS / Secrets Manager (AWS, GCP, Azure).
- OS keyrings (`keyring` library).
- HashiCorp Vault.
