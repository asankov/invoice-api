from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import Field
from pydantic_settings import BaseSettings

from invoice_api.auth.repository import AuthRepository, FirestoreAuthRepository
from invoice_api.auth.routes import AuthRouter
from invoice_api.company.repository import CompanyRepository, FirestoreCompanyRepository
from invoice_api.company.routes import CompanyRouter
from invoice_api.email.resend import ResendEmailService
from invoice_api.email.service import EmailService


class Config(BaseSettings):
    resend_api_key: str = Field(alias="RESEND_API_KEY")
    gcp_project_id: str = Field(alias="GCP_PROJECT_ID")


def create_app() -> FastAPI:
    app = FastAPI(title="Invoicing API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["https://invoices.asankov.dev"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    load_dotenv()

    config = Config()  # type: ignore[call-arg]  # these are loaded from env variables

    company_repository: CompanyRepository = FirestoreCompanyRepository(config.gcp_project_id)
    auth_repository: AuthRepository = FirestoreAuthRepository(config.gcp_project_id)
    email_service: EmailService = ResendEmailService(config.resend_api_key)

    company_router = CompanyRouter(company_repository).router
    auth_router = AuthRouter(auth_repository, email_service).router

    app.include_router(company_router)
    app.include_router(auth_router)

    return app


if __name__ == "__main__":
    import uvicorn

    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=8080)
