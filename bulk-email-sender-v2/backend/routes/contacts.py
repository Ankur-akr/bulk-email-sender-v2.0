"""Contacts / CSV upload routes"""
import io
import re
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException
import pandas as pd

router = APIRouter()

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def validate_email(email: str) -> bool:
    return bool(EMAIL_REGEX.match(str(email).strip()))


@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    """Upload and validate a CSV file with Name, Email columns."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await file.read()

    df = None
    last_error = None

    for encoding in ["utf-8", "utf-8-sig", "cp1252", "latin1"]:
        try:
            df = pd.read_csv(
                io.BytesIO(content),
                encoding=encoding
            )
            break
        except Exception as e:
            last_error = e

    if df is None:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse CSV: {last_error}"
        )
    
    # Normalize column names
    df.columns = [col.strip().lower() for col in df.columns]
    
    required = {"name", "email"}
    if not required.issubset(set(df.columns)):
        raise HTTPException(
            status_code=400,
            detail=f"CSV must contain columns: Name, Email. Found: {list(df.columns)}"
        )
    
    # Drop empty rows
    df = df.dropna(subset=["name", "email"])
    df["name"] = df["name"].astype(str).str.strip()
    df["email"] = df["email"].astype(str).str.strip()
    
    errors = []
    valid_contacts = []
    seen_emails = set()
    
    for idx, row in df.iterrows():
        name = row["name"]
        email = row["email"]
        row_errors = []
        
        if not name:
            row_errors.append("Name is empty")
        if not validate_email(email):
            row_errors.append(f"Invalid email: {email}")
        elif email.lower() in seen_emails:
            row_errors.append(f"Duplicate email: {email}")
        
        if row_errors:
            errors.append({"row": idx + 2, "name": name, "email": email, "errors": row_errors})
        else:
            seen_emails.add(email.lower())
            contact = {"name": name, "email": email}
            # Include any extra columns
            for col in df.columns:
                if col not in ("name", "email"):
                    contact[col] = str(row[col]) if pd.notna(row[col]) else ""
            valid_contacts.append(contact)
    
    return {
        "total_rows": len(df),
        "valid_count": len(valid_contacts),
        "error_count": len(errors),
        "contacts": valid_contacts,
        "errors": errors
    }
