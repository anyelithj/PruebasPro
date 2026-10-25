"""RF-17.12 / RF-17.13: nlu_training_examples (entrenamiento continuo con conversaciones reales)

Revision ID: 7a3d1f0c2b64
Revises: 6209f471d39b
Create Date: 2026-10-10 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7a3d1f0c2b64"
down_revision: str | Sequence[str] | None = "6209f471d39b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "nlu_training_examples",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("intent", sa.String(length=32), nullable=False),
        sa.Column("predicted_intent", sa.String(length=32), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("entities", sa.JSON(), nullable=False),
        sa.Column("source", sa.String(length=16), nullable=False),
        sa.Column("approved", sa.Boolean(), nullable=False),
        sa.Column("conversation_id", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="ml",
    )
    op.create_index(
        op.f("ix_ml_nlu_training_examples_intent"),
        "nlu_training_examples",
        ["intent"],
        unique=False,
        schema="ml",
    )
    op.create_index(
        op.f("ix_ml_nlu_training_examples_approved"),
        "nlu_training_examples",
        ["approved"],
        unique=False,
        schema="ml",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f("ix_ml_nlu_training_examples_approved"),
        table_name="nlu_training_examples",
        schema="ml",
    )
    op.drop_index(
        op.f("ix_ml_nlu_training_examples_intent"),
        table_name="nlu_training_examples",
        schema="ml",
    )
    op.drop_table("nlu_training_examples", schema="ml")
