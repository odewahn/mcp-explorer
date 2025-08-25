import os, base64, json, getpass
from Crypto.Protocol.KDF import scrypt as _scrypt
from Crypto.Cipher import AES


b64d = lambda s: base64.urlsafe_b64decode(s.encode())


def derive_key(password: bytes, salt: bytes) -> bytes:
    return _scrypt(password, salt, 32, N=2**15, r=8, p=1)


def load_and_decrypt_env(var_name: str = "ENCRYPTED_ANTHROPIC_API_KEY") -> str:
    token = os.environ.get(var_name)
    if not token or not token.startswith("ENC:"):
        raise RuntimeError(f"{var_name} not set or not an ENC token")

    payload = json.loads(base64.urlsafe_b64decode(token[4:].encode()))
    if payload.get("v") != 1:
        raise RuntimeError("Unsupported secret version")

    salt = b64d(payload["s"])
    nonce = b64d(payload["n"])
    data = b64d(payload["c"])
    ct, tag = data[:-16], data[-16:]

    password = getpass.getpass("Password to unlock secret: ").encode()
    key = derive_key(password, salt)

    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    plaintext = cipher.decrypt_and_verify(ct, tag)

    return plaintext.decode()


if __name__ == "__main__":
    try:
        api_key = load_and_decrypt_env()
        print("Secret unlocked. (Don’t print in real tools.)")
        # use api_key...
    except Exception as e:
        print(f"Failed to unlock secret: {e}")
        raise SystemExit(1)
