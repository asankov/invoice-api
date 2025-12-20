from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
import os
from auth_repository import AuthRepository, FirestoreAuthRepository
from email_service import EmailService
from repository import Company, CompanyRepository, FirestoreCompanyRepository
import uuid
import secrets
from datetime import datetime, timezone, timedelta
import jwt

app = FastAPI(title="Invoicing API")
security = HTTPBearer()

company_repository: CompanyRepository = FirestoreCompanyRepository("invoicer-480512", "companies")
auth_repository: AuthRepository = FirestoreAuthRepository("invoicer-480512", "auth-codes")
email_service: EmailService | None = None

ACCESS_SECRET = os.getenv("JWT_SECRET", "jjjkfjodsbhfjsbnffehwufewn819u90sjfadhgie(*hifWHR3fenf89a")
ACCESS_TOKEN_EXPIRY = timedelta(minutes=15)

class CompanyDetails(BaseModel):
    id: uuid.UUID
    name: str
    address: str
    phone: str
    email: EmailStr

class CreateCompanyRequest(BaseModel):
    name: str
    address: str
    phone: str
    email: EmailStr

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    email = verify_access_token(credentials.credentials)
    if email is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    return email

@app.get("/company", response_model=CompanyDetails)
def get_company(user_email: str = Depends(get_current_user)):
    item = company_repository.get_company(user_email)
    if not item:
        raise HTTPException(status_code=404, detail="Company details not found")

    return CompanyDetails(
        id=item.id,
        name=item.name,
        address=item.address,
        phone=item.phone,
        email=item.email
    )

@app.post("/company", response_model=CompanyDetails)
def create_company(company: CompanyDetails, user_email: str = Depends(get_current_user)):
    company_repository.save_company(
        user_email,
        Company(
            id=uuid.uuid4(),
            name=company.name,
            address=company.address,
            phone=company.phone,
            email=company.email
        )
    )
    return company

class RequestCodeRequest(BaseModel):
    email: EmailStr

@app.post("/auth/request_code")
def request_code(request: RequestCodeRequest):
    code = str(secrets.randbelow(1000000)).zfill(6)

    auth_repository.store_code(request.email, code)

    if email_service is not None:
        email_service.send_email(request.email, code)

    return None

class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str

@app.post("/auth/verify")
def verify_code(request: VerifyCodeRequest):
    codes = auth_repository.get_codes_for_user(request.email)

    if request.code not in codes:
        raise HTTPException(status_code=401, detail="Invalid or expired code")

    # If valid: mark as used, create user if new, return session token
    auth_repository.mark_code_as_used(request.email, request.code)

    now = datetime.now(timezone.utc)
    access_payload = {
        "email": request.email,
        "iat": now,
        "exp": now + ACCESS_TOKEN_EXPIRY,
    }
    access_token = jwt.encode(access_payload, ACCESS_SECRET, algorithm="HS256")

    return {
        "jwt": access_token
    }

def verify_access_token(token: str) -> str | None:
    """Verify and decode an access token. Returns payload or None if invalid."""
    try:
        payload = jwt.decode(token, ACCESS_SECRET, algorithms=["HS256"])
        return payload["email"]
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
