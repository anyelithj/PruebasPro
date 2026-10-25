// review.exception.ts => errores de dominio del módulo Review.
import { ConflictException, ForbiddenException, NotFoundException } from "../../../shared/filter/http-exception.filter";
import { EDIT_WINDOW_DAYS } from "../model/review.model";

export class ReviewNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Review", id);
  }
}

export class DuplicateReviewException extends ConflictException {
  constructor() {
    super("Ya publicaste una reseña de este producto; puedes editarla", "DUPLICATE_REVIEW");
  }
}

export class ReviewEditWindowClosedException extends ForbiddenException {
  constructor() {
    super(`Las reseñas solo se editan durante ${EDIT_WINDOW_DAYS} días`, "REVIEW_EDIT_WINDOW_CLOSED");
  }
}

export class ReviewNotEditableException extends ForbiddenException {
  constructor() {
    super("No tienes permiso para esta modificación de la reseña", "REVIEW_NOT_EDITABLE");
  }
}
