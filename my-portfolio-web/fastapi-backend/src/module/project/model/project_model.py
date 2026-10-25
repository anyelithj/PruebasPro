"""[DDD] entidad de proyecto (SQLAlchemy ORM)."""

from sqlalchemy import ARRAY, Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.database.base_model import BaseModel


class ProjectModel(BaseModel):
    __tablename__ = "projects"

    title: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    link: Mapped[str] = mapped_column(String(500), nullable=False)
    techs: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
