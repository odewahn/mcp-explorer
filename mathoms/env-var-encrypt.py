import os, base64, json, getpass
from Crypto.Protocol.KDF import scrypt as _scrypt
from Crypto.Cipher import AES

VERSION = 1
b64e = lambda b: base64.urlsafe_b64encode(b).decode("ascii")


def derive_key(password: bytes, salt: bytes) -> bytes:
    return _scrypt(password, salt, 32, N=2**15, r=8, p=1)


api_key = getpass.getpass("API key to encrypt (input hidden): ").encode()
password = getpass.getpass("Password (to derive encryption key): ").encode()

salt = os.urandom(16)
key = derive_key(password, salt)

nonce = os.urandom(12)
cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
ct, tag = cipher.encrypt_and_digest(api_key)

payload = {"v": VERSION, "s": b64e(salt), "n": b64e(nonce), "c": b64e(ct + tag)}
token = "ENC:" + base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()

print("\nPut this in your env:")
print(f'ENCRYPTED_API_KEY="{token}"')
