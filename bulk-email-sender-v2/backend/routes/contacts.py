"""CSV upload — validates and returns contacts. No DB write here (contacts are stored per campaign)."""
import io, re
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import pandas as pd
from routes.auth import get_current_user

router = APIRouter()
EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


@router.post("/upload")
async def upload_csv(file: UploadFile = File(...), user=Depends(get_current_user)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")
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

    df.columns = [c.strip().lower() for c in df.columns]
    if not {"name", "email"}.issubset(df.columns):
        raise HTTPException(status_code=400,
            detail=f"CSV must have Name and Email columns. Found: {list(df.columns)}")

    df = df.dropna(subset=["name", "email"])
    df["name"]  = df["name"].astype(str).str.strip()
    df["email"] = df["email"].astype(str).str.strip()

    errors, contacts, seen = [], [], set()
    for idx, row in df.iterrows():
        name, email = row["name"], row["email"]
        errs = []
        if not name:                       errs.append("Name is empty")
        if not EMAIL_RE.match(email):      errs.append(f"Invalid email: {email}")
        elif email.lower() in seen:        errs.append(f"Duplicate: {email}")
        if errs:
            errors.append({"row": idx + 2, "name": name, "email": email, "errors": errs})
        else:
            seen.add(email.lower())
            extra = {c: str(row[c]) for c in df.columns if c not in ("name", "email") and pd.notna(row[c])}
            contacts.append({"name": name, "email": email, **extra})

    return {
        "total_rows": len(df), "valid_count": len(contacts),
        "error_count": len(errors), "contacts": contacts, "errors": errors,
    }
