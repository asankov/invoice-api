from abc import ABC, abstractmethod


class EmailService(ABC):
    @abstractmethod
    def send_otp_email(self, to_email: str, code: str):
        pass
