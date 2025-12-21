import secrets

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

from invoice_api.auth.models import RequestCodeRequest, VerifyCodeRequest
from invoice_api.auth.repository import AuthRepository
from invoice_api.auth.tokens import create_access_token
from invoice_api.email.service import EmailService


class SignUpRequest(BaseModel):
    name: str
    email: EmailStr


class VerifyCodeResponse(BaseModel):
    token: str


class AuthRouter:
    def __init__(self, auth_repository: AuthRepository, email_service: EmailService) -> None:
        self._auth_repository = auth_repository
        self._email_service = email_service
        self.router = APIRouter(prefix="/auth", tags=["auth"])
        self._setup_routes()

    def _setup_routes(self) -> None:
        @self.router.post("/sign-up", status_code=status.HTTP_200_OK)
        def sign_up(request: SignUpRequest) -> None:
            code = str(secrets.randbelow(1000000)).zfill(6)

            self._auth_repository.create_user(request.email, request.name, code)
            self._email_service.send_verification_email(request.email, code)

        @self.router.post("/request_code", status_code=status.HTTP_200_OK)
        def request_code(request: RequestCodeRequest) -> None:
            code = str(secrets.randbelow(1000000)).zfill(6)

            self._auth_repository.store_code(request.email, code)
            self._email_service.send_otp_email(request.email, code)

        @self.router.post("/verify")
        def verify_code(request: VerifyCodeRequest) -> VerifyCodeResponse:
            codes = self._auth_repository.get_codes_for_user(request.email)

            if request.code not in codes:
                raise HTTPException(status_code=401, detail="Invalid or expired code")

            self._auth_repository.mark_code_as_used(request.email, request.code)
            access_token = create_access_token(request.email)

            return VerifyCodeResponse(token=access_token)
