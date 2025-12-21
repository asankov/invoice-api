import uuid
from abc import ABC, abstractmethod
from datetime import UTC, datetime, timedelta

from google.cloud import firestore
from google.oauth2 import service_account


class AuthRepository(ABC):
    @abstractmethod
    def store_code(self, email: str, code: str) -> None:
        pass

    @abstractmethod
    def get_codes_for_user(
        self, email: str, unused_only: bool = True, unexpired_only: bool = True
    ) -> list[str]:
        pass

    @abstractmethod
    def mark_code_as_used(self, email: str, code: str) -> None:
        pass

    @abstractmethod
    def create_user(self, email: str, name: str, verification_code: str) -> None:
        pass

    @abstractmethod
    def verify_user(self, email: str) -> None:
        pass


class FirestoreAuthRepository(AuthRepository):
    """Firestore implementation of AuthRepository."""

    def __init__(self, project_id: str, collection_name: str) -> None:
        self._project_id = project_id
        self._collection_name = collection_name
        credentials = service_account.Credentials.from_service_account_file("firestore-sa.json")
        self._db = firestore.Client(
            project=self._project_id, database="invoicer", credentials=credentials
        )
        self._collection = self._db.collection(self._collection_name)
        self._users_collection = self._db.collection("users")

    def store_code(self, email: str, code: str) -> None:
        now = datetime.now(UTC)
        doc_data = {
            "id": str(uuid.uuid4()),
            "email": email,
            "code": code,
            "expires_at": now + timedelta(minutes=10),
            "used": False,
            "created_at": now,
        }
        self._collection.add(doc_data)

    def get_codes_for_user(
        self, email: str, unused_only: bool = True, unexpired_only: bool = True
    ) -> list[str]:
        query = self._collection.where("email", "==", email)

        if unused_only:
            query = query.where("used", "==", False)

        if unexpired_only:
            now = datetime.now(UTC)
            query = query.where("expires_at", ">", now)

        docs = query.stream()
        codes = []

        for doc in docs:
            data = doc.to_dict()
            codes.append(data.get("code"))

        return codes

    def mark_code_as_used(self, email: str, code: str) -> None:
        query = self._collection.where("email", "==", email).where("code", "==", code)
        docs = query.stream()

        for doc in docs:
            doc.reference.update({"used": True})

    def create_user(self, email: str, name: str, verification_code: str) -> None:
        now = datetime.now(UTC)
        user_data = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": name,
            "created_at": now,
            "verification_code": verification_code,
            "email_verified_at": None,
        }
        self._users_collection.add(user_data)

    def verify_user(self, email: str) -> None:
        query = self._users_collection.where("email", "==", email)
        docs = query.stream()

        for doc in docs:
            doc.reference.update(
                {"email_verified_at": datetime.now(UTC), "verification_code": None}
            )
