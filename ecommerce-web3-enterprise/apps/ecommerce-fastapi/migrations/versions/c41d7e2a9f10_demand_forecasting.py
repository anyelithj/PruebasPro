"""Fase 5 · Sprint 5.1 (pronóstico de demanda: forecast_models y forecast_results)

Escrita a mano con el mismo formato de autogenerate; reutiliza el ENUM model_status de ml_prediction.

Revision ID: c41d7e2a9f10
Revises: bb4c5f4fc47d
Create Date: 2026-10-04 01:40:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# ENUM ya creado por e37715fa79ab (model_versions): create_type=False => no se vuelve a crear
MODEL_STATUS = postgresql.ENUM(
    "QUEUED", "TRAINING", "READY", "FAILED", name="model_status", schema="ml", create_type=False
)

# revision identifiers, used by Alembic.
revision: str = "c41d7e2a9f10"
down_revision: str | Sequence[str] | None = "bb4c5f4fc47d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "forecast_models",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", MODEL_STATUS, nullable=False),
        sa.Column("prophet_weight", sa.Float(), nullable=True),
        sa.Column("metrics", sa.JSON(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("trained_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("version"),
        schema="ml",
    )
    op.create_table(
        "forecast_results",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("forecast_model_id", sa.String(length=36), nullable=False),
        sa.Column("product_id", sa.String(length=36), nullable=False),
        sa.Column("horizon_days", sa.Integer(), nullable=False),
        sa.Column("granularity", sa.String(length=5), nullable=False),
        sa.Column("forecast", sa.JSON(), nullable=False),
        sa.Column("seasonality", sa.JSON(), nullable=False),
        sa.Column("cold_start", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["forecast_model_id"], ["ml.forecast_models.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="ml",
    )
    op.create_index(
        op.f("ix_ml_forecast_results_forecast_model_id"),
        "forecast_results",
        ["forecast_model_id"],
        unique=False,
        schema="ml",
    )
    op.create_index(
        op.f("ix_ml_forecast_results_product_id"),
        "forecast_results",
        ["product_id"],
        unique=False,
        schema="ml",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f("ix_ml_forecast_results_product_id"), table_name="forecast_results", schema="ml"
    )
    op.drop_index(
        op.f("ix_ml_forecast_results_forecast_model_id"),
        table_name="forecast_results",
        schema="ml",
    )
    op.drop_table("forecast_results", schema="ml")
    op.drop_table("forecast_models", schema="ml")
