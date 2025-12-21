from fastapi import APIRouter, HTTPException, Depends
import uuid

from invoice_api.auth.dependencies import get_current_user
from invoice_api.company.models import Company, CompanyDetails, CreateCompanyRequest
from invoice_api.company.repository import CompanyRepository

router = APIRouter(prefix="/company", tags=["company"])


def get_company_repository() -> CompanyRepository:
    """Dependency to get the company repository instance."""
    from main import company_repository
    return company_repository


@router.get("", response_model=CompanyDetails)
def get_company(
    user_email: str = Depends(get_current_user),
    repository: CompanyRepository = Depends(get_company_repository)
):
    item = repository.get_company(user_email)
    if not item:
        raise HTTPException(status_code=404, detail="Company details not found")

    return CompanyDetails(
        id=item.id,
        name=item.name,
        address=item.address,
        phone=item.phone,
        email=item.email
    )


@router.post("", response_model=CompanyDetails)
def create_company(
    company: CreateCompanyRequest,
    user_email: str = Depends(get_current_user),
    repository: CompanyRepository = Depends(get_company_repository)
):
    id = uuid.uuid4()
    repository.save_company(
        user_email,
        Company(
            id=id,
            name=company.name,
            address=company.address,
            phone=company.phone,
            email=company.email
        )
    )
    return CompanyDetails(
        id=id,
        name=company.name,
        address=company.address,
        phone=company.phone,
        email=company.email
    )
