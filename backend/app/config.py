"""
Application configuration.
"""
import os
from pathlib import Path


class Settings:
    APP_NAME: str = "سیستم مدیریت KPI"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    DATABASE_DIR: Path = Path(os.getenv("DATABASE_DIR", str(Path(__file__).resolve().parent.parent)))
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{DATABASE_DIR / 'kpi_system.db'}",
    )

    DEFAULT_KPI_MIN_SCORE: float = 0.0
    DEFAULT_KPI_MAX_SCORE: float = 100.0


settings = Settings()
