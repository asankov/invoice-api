import uuid

from pydantic import BaseModel, EmailStr


class Company(BaseModel):
    id: uuid.UUID
    name: str
    address: str
    phone: str
    email: EmailStr


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
