"""[DRY] literales de la app en un solo lugar — sin strings mágicos dispersos."""

from typing import Final

# Auth / tokens
TOKEN_TYPE_ACCESS: Final = "access"
TOKEN_TYPE_REFRESH: Final = "refresh"
AUTH_HEADER_PREFIX: Final = "Bearer"

# Pagination
DEFAULT_PAGE: Final = 1
DEFAULT_PAGE_SIZE: Final = 20
MAX_PAGE_SIZE: Final = 100

# Cache keys
CACHE_USER_PREFIX: Final = "user:"

# Headers
REQUEST_ID_HEADER: Final = "X-Request-ID"
