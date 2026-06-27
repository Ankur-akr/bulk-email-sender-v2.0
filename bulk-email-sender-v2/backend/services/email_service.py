"""
Amazon SES Email Service
Handles sending personalized emails with retry logic.
"""
import os
import time
import logging
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from typing import Dict, Optional
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


class SESEmailService:
    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                self._client = boto3.client(
                    "ses",
                    region_name=os.getenv("AWS_REGION", "us-east-1"),
                    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                )
            except Exception as e:
                logger.error(f"Failed to create SES client: {e}")
                raise
        return self._client

    def send_email(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None,
        sender_email: Optional[str] = None,
        max_retries: int = 3,
    ) -> Dict:
        """
        Send a single email via SES with retry logic.
        Returns dict with status, message_id, and error.
        """
        from_email = sender_email or os.getenv("SENDER_EMAIL", "")
        if not from_email:
            return {"status": "failed", "message_id": None, "error": "Sender email not configured"}

        message = {
            "Subject": {"Data": subject, "Charset": "UTF-8"},
            "Body": {"Text": {"Data": body_text, "Charset": "UTF-8"}},
        }
        if body_html:
            message["Body"]["Html"] = {"Data": body_html, "Charset": "UTF-8"}

        for attempt in range(1, max_retries + 1):
            try:
                client = self._get_client()
                response = client.send_email(
                    Source=f"{to_name} <{from_email}>" if False else from_email,
                    Destination={"ToAddresses": [to_email]},
                    Message=message,
                )
                message_id = response["MessageId"]
                logger.info(f"Email sent to {to_email} | MessageId: {message_id}")
                return {"status": "sent", "message_id": message_id, "error": None}

            except ClientError as e:
                code = e.response["Error"]["Code"]
                msg = e.response["Error"]["Message"]
                logger.warning(f"Attempt {attempt}/{max_retries} failed for {to_email}: {code} - {msg}")
                if attempt < max_retries:
                    time.sleep(2 ** attempt)  # Exponential backoff
                else:
                    return {"status": "failed", "message_id": None, "error": f"{code}: {msg}"}

            except NoCredentialsError:
                return {"status": "failed", "message_id": None, "error": "AWS credentials not found"}

            except Exception as e:
                logger.error(f"Unexpected error sending to {to_email}: {e}")
                if attempt < max_retries:
                    time.sleep(2 ** attempt)
                else:
                    return {"status": "failed", "message_id": None, "error": str(e)}

        return {"status": "failed", "message_id": None, "error": "Max retries exceeded"}

    def verify_credentials(self) -> Dict:
        """Test AWS SES connectivity."""
        try:
            client = self._get_client()
            client.get_send_quota()
            return {"valid": True, "error": None}
        except NoCredentialsError:
            return {"valid": False, "error": "AWS credentials not found"}
        except ClientError as e:
            return {"valid": False, "error": e.response["Error"]["Message"]}
        except Exception as e:
            return {"valid": False, "error": str(e)}


ses_service = SESEmailService()
