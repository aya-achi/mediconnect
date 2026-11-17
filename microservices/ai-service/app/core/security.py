import jwt
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.config import settings

security = HTTPBearer()

# Claim types that may carry the user identifier depending on the issuer's claim mapping
_USER_ID_CLAIMS = (
    "sub",
    "nameid",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
    "user_id",
)

def validate_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            audience="MediConnectUsers",  # Match the monolith audience
            issuer="MediConnect"  # Match the monolith issuer
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

def get_user_id(token_data: dict) -> str:
    """Extract the user id from the JWT payload regardless of claim naming."""
    for claim in _USER_ID_CLAIMS:
        value = token_data.get(claim)
        if value:
            return str(value)
    raise HTTPException(status_code=401, detail="Token does not contain a user identifier")
