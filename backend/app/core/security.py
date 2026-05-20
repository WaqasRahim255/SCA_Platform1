from functools import lru_cache

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.core.config import settings


@lru_cache(maxsize=1)
def get_clerk_jwks() -> dict[str, object]:
    if not settings.clerk_jwks_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CLERK_JWKS_URL is not configured.",
        )

    response = httpx.get(settings.clerk_jwks_url, timeout=10)
    response.raise_for_status()
    return response.json()


def get_signing_key(token: str) -> dict[str, object]:
    header = jwt.get_unverified_header(token)
    token_key_id = header.get("kid")

    for key in get_clerk_jwks().get("keys", []):
        if isinstance(key, dict) and key.get("kid") == token_key_id:
            return key

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Signing key not found.",
    )


def verify_clerk_jwt(token: str) -> dict[str, object]:
    if not settings.clerk_jwt_issuer or not settings.clerk_jwks_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Clerk JWT verification is not configured.",
        )

    try:
        payload = jwt.decode(
            token,
            get_signing_key(token),
            algorithms=["RS256"],
            audience=settings.clerk_jwt_audience,
            issuer=settings.clerk_jwt_issuer,
            options={"verify_aud": bool(settings.clerk_jwt_audience)},
        )
    except (JWTError, httpx.HTTPError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        ) from exc

    return payload
