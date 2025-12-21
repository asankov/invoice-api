from abc import ABC, abstractmethod
from google.cloud import firestore
from google.oauth2 import service_account

from invoice_api.company.models import Company


class CompanyRepository(ABC):
    """Abstract repository interface for company data operations."""

    @abstractmethod
    def get_company(self, user_email: str) -> Company | None:
        """Retrieve company details for a user."""
        pass

    @abstractmethod
    def save_company(self, user_email: str, company: Company) -> None:
        """Save or update company details for a user."""
        pass


class FirestoreCompanyRepository(CompanyRepository):
    """Firestore implementation of CompanyRepository."""

    def __init__(self, project_id: str, collection_name: str):
        self._project_id = project_id
        self._collection_name = collection_name
        credentials = service_account.Credentials.from_service_account_file(
            "firestore-sa.json"
        )
        self._db = firestore.Client(
            project=self._project_id, database="invoicer", credentials=credentials
        )
        self._collection = self._db.collection(self._collection_name)

    def get_company(self, user_email: str) -> Company | None:
        """Retrieve company details for a user from Firestore."""
        doc_ref = self._collection.document(user_email)
        doc = doc_ref.get()

        if not doc.exists:
            return None

        data = doc.to_dict()
        assert data is not None
        return Company(
            id=data["id"],
            name=data["name"],
            address=data["address"],
            phone=data["phone"],
            email=data["email"],
        )

    def save_company(self, user_email: str, company: Company) -> None:
        """Save or update company details for a user in Firestore."""
        doc_ref = self._collection.document(user_email)
        doc_ref.set(
            {
                "id": str(company.id),
                "name": company.name,
                "address": company.address,
                "phone": company.phone,
                "email": company.email,
            }
        )
