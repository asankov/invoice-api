import resend

from invoice_api.email.service import EmailService


class ResendEmailService(EmailService):
    def __init__(self, api_key: str):
        resend.api_key = api_key

    def send_otp_email(self, to_email: str, code: str):
        resend.Emails.send(
            {
                "from": "onboarding@resend.dev",
                "to": to_email,
                "subject": "Your login code",
                "text": f"Your verification code is: {code}\n\nExpires in 10 minutes.",
            }
        )
