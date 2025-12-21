import os
import jwt
from datetime import datetime, timezone, timedelta

ACCESS_SECRET = os.getenv(
    "JWT_SECRET", "jjjkfjodsbhfjsbnffehwufewn819u90sjfadhgie(*hifWHR3fenf89a"
)
ACCESS_TOKEN_EXPIRY = timedelta(minutes=15)


def create_access_token(email: str) -> str:
    """Create a JWT access token for the given email."""
    now = datetime.now(timezone.utc)
    access_payload = {
        "email": email,
        "iat": now,
        "exp": now + ACCESS_TOKEN_EXPIRY,
    }
    return jwt.encode(access_payload, ACCESS_SECRET, algorithm="HS256")


def verify_access_token(token: str) -> str | None:
    """Verify and decode an access token. Returns email or None if invalid."""
    try:
        payload = jwt.decode(token, ACCESS_SECRET, algorithms=["HS256"])
        return payload["email"]
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
