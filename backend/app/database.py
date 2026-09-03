import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./reservation.db")

engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
elif DATABASE_URL.startswith("mysql"):
    # Ensure UTF-8 encoding for Korean characters
    engine_kwargs["connect_args"] = {"charset": "utf8mb4"}
    # Frequent client polling (rooms/reservations every 5-10s per user) can
    # otherwise exhaust the default pool (size 5 + overflow 10) under load.
    engine_kwargs["pool_size"] = 20
    engine_kwargs["max_overflow"] = 30
    engine_kwargs["pool_timeout"] = 30
    # Recycle connections before MySQL's wait_timeout drops them, and verify
    # liveness before handing them out so dead connections aren't reused.
    engine_kwargs["pool_recycle"] = 280
    engine_kwargs["pool_pre_ping"] = True

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
