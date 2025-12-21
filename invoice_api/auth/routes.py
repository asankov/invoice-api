import secrets

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from invoice_api.auth.models import RequestCodeRequest, VerifyCodeRequest
from invoice_api.auth.repository import AuthRepository
from invoice_api.auth.tokens import create_access_token
from invoice_api.email.service import EmailService

router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_repository() -> AuthRepository:
    """Dependency to get the auth repository instance."""
    from main import auth_repository

    return auth_repository


def get_email_service() -> EmailService:
    """Dependency to get the email service instance."""
    from main import email_service

    return email_service


@router.post("/request_code", status_code=status.HTTP_200_OK)
def request_code(request: RequestCodeRequest) -> None:
    code = str(secrets.randbelow(1000000)).zfill(6)

    repository = get_auth_repository()
    repository.store_code(request.email, code)

    email_svc = get_email_service()
    email_svc.send_otp_email(request.email, code)


class VerifyCodeResponse(BaseModel):
    token: str


@router.post("/verify")
def verify_code(request: VerifyCodeRequest) -> VerifyCodeResponse:
    repository = get_auth_repository()
    codes = repository.get_codes_for_user(request.email)

    if request.code not in codes:
        raise HTTPException(status_code=401, detail="Invalid or expired code")

    repository.mark_code_as_used(request.email, request.code)
    access_token = create_access_token(request.email)

    return VerifyCodeResponse(token=access_token)
