# this is for implementing profile based information tied to the user rows.
from database.database import Base


class Profile(Base):
    __tablename__ = "profiles"
