from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from invoice_api.auth.tokens import verify_access_token

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """FastAPI dependency to get the current authenticated user's email."""
    email = verify_access_token(credentials.credentials)
    if email is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    return email
