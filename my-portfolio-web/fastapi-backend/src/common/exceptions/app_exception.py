"""[OOP] clase base de excepciones de dominio — todas heredan de ella."""


class AppException(Exception):
    """Excepción base con status HTTP + código de error semántico."""

    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"

    def __init__(self, message: str | None = None, *, error_code: str | None = None) -> None:
        self.message = message or self.__class__.__name__
        if error_code is not None:
            self.error_code = error_code
        super().__init__(self.message)
