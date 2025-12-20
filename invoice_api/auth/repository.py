from abc import ABC, abstractmethod
from google.oauth2 import service_account
from google.cloud import firestore
from datetime import datetime, timedelta, timezone
import uuid


class AuthRepository(ABC):
    @abstractmethod
    def store_code(self, email: str, code: str):
        pass

    @abstractmethod
    def get_codes_for_user(self, email: str, unused_only: bool = True, unexpired_only: bool = True) -> list[str]:
        pass

    @abstractmethod
    def mark_code_as_used(self, email: str, code: str):
        pass


class FirestoreAuthRepository(AuthRepository):
    """Firestore implementation of AuthRepository."""

    def __init__(self, project_id: str, collection_name: str):
        self._project_id = project_id
        self._collection_name = collection_name
        credentials = service_account.Credentials.from_service_account_file(
            "firestore-sa.json"
        )
        self._db = firestore.Client(
            project=self._project_id,
            database="invoicer",
            credentials=credentials
        )
        self._collection = self._db.collection(self._collection_name)

    def store_code(self, email: str, code: str):
        now = datetime.now(timezone.utc)
        doc_data = {
            "id": str(uuid.uuid4()),
            "email": email,
            "code": code,
            "expires_at": now + timedelta(minutes=10),
            "used": False,
            "created_at": now
        }
        self._collection.add(doc_data)

    def get_codes_for_user(self, email: str, unused_only: bool = True, unexpired_only: bool = True) -> list[str]:
        query = self._collection.where("email", "==", email)

        if unused_only:
            query = query.where("used", "==", False)

        if unexpired_only:
            now = datetime.now(timezone.utc)
            query = query.where("expires_at", ">", now)

        docs = query.stream()
        codes = []

        for doc in docs:
            data = doc.to_dict()
            codes.append(data.get("code"))

        return codes

    def mark_code_as_used(self, email: str, code: str):
        query = self._collection.where("email", "==", email).where("code", "==", code)
        docs = query.stream()

        for doc in docs:
            doc.reference.update({"used": True})
