# email_parser_route.py (FastAPI APIRouter) => rutas del analizador de correos (matriz, hoja
# FastAPI). Rutas fijas (/extracted, /parsing-cache) ANTES de /{email_id}. SERVICE = Express
# (bandeja de soporte).

from fastapi import APIRouter, Depends, status

from app.module.email_parser.controller import email_parser_controller as controller
from app.shared.middleware.auth_middleware import require_roles

router = APIRouter(
    prefix="/api/v1/ml/email-parser",
    tags=["Email Parser"],
    dependencies=[Depends(require_roles("ADMIN", "SERVICE"))],
)
router.add_api_route(
    "/parse", controller.create_parsed_email, methods=["POST"], status_code=status.HTTP_201_CREATED
)
router.add_api_route("/extracted", controller.list_extracted_entities, methods=["GET"])
router.add_api_route("/parsing-cache", controller.delete_all_parsed_emails, methods=["DELETE"])
router.add_api_route("/{email_id}", controller.get_parsed_email_by_id, methods=["GET"])
