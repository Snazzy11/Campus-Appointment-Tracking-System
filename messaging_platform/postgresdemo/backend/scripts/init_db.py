
from app.models import Base
from app.services.database import engine


def main():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized.")


if __name__ == "__main__":
    main()
