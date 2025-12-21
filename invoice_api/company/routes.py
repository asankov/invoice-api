import uuid

from fastapi import APIRouter, Depends, HTTPException

from invoice_api.auth.dependencies import get_current_user
from invoice_api.company.models import Company, CompanyDetails, CreateCompanyRequest
from invoice_api.company.repository import CompanyRepository


class CompanyRouter:
    def __init__(self, company_repository: CompanyRepository) -> None:
        self._company_repository = company_repository
        self.router = APIRouter(prefix="/company", tags=["company"])
        self._setup_routes()

    def _setup_routes(self) -> None:
        @self.router.get("")
        def get_company(
            user_email: str = Depends(get_current_user),
        ) -> CompanyDetails:
            item = self._company_repository.get_company(user_email)
            if not item:
                raise HTTPException(status_code=404, detail="Company details not found")

            return CompanyDetails(
                id=item.id,
                name=item.name,
                address=item.address,
                phone=item.phone,
                email=item.email,
            )

        @self.router.post("")
        def create_company(
            company: CreateCompanyRequest,
            user_email: str = Depends(get_current_user),
        ) -> CompanyDetails:
            id = uuid.uuid4()
            self._company_repository.save_company(
                user_email,
                Company(
                    id=id,
                    name=company.name,
                    address=company.address,
                    phone=company.phone,
                    email=company.email,
                ),
            )
            return CompanyDetails(
                id=id,
                name=company.name,
                address=company.address,
                phone=company.phone,
                email=company.email,
            )
