from fastapi import FastAPI

from invoice_api.auth.repository import AuthRepository, FirestoreAuthRepository
from invoice_api.auth.service import EmailService
from invoice_api.auth.routes import router as auth_router
from invoice_api.company.repository import CompanyRepository, FirestoreCompanyRepository
from invoice_api.company.routes import router as company_router

app = FastAPI(title="Invoicing API")

company_repository: CompanyRepository = FirestoreCompanyRepository("invoicer-480512", "companies")
auth_repository: AuthRepository = FirestoreAuthRepository("invoicer-480512", "auth-codes")
email_service: EmailService | None = None

app.include_router(company_router)
app.include_router(auth_router)
