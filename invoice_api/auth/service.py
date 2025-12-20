from abc import ABC, abstractmethod
from pydantic import EmailStr


class EmailService(ABC):
    @abstractmethod
    def send_email(self, email: EmailStr, code: str) -> None:
        pass
