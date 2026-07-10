import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey, Enum as SAEnum, Text, Boolean
)
from sqlalchemy.orm import relationship
from .database import Base


def gen_uuid():
    return str(uuid.uuid4())


class ZoneType(str, enum.Enum):
    PUBLIC = "Public"
    PRIVATE = "Private"


class RecordType(str, enum.Enum):
    A = "A"
    AAAA = "AAAA"
    CNAME = "CNAME"
    TXT = "TXT"
    MX = "MX"
    NS = "NS"
    PTR = "PTR"
    SRV = "SRV"
    CAA = "CAA"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class HostedZone(Base):
    __tablename__ = "hosted_zones"

    id = Column(String, primary_key=True, default=gen_uuid, index=True)
    name = Column(String, nullable=False, index=True)
    type = Column(SAEnum(ZoneType), nullable=False, default=ZoneType.PUBLIC)
    comment = Column(Text, nullable=True)
    record_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    records = relationship(
        "DNSRecord", back_populates="zone", cascade="all, delete-orphan"
    )


class DNSRecord(Base):
    __tablename__ = "dns_records"

    id = Column(String, primary_key=True, default=gen_uuid, index=True)
    hosted_zone_id = Column(
        String, ForeignKey("hosted_zones.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String, nullable=False)
    type = Column(SAEnum(RecordType), nullable=False)
    value = Column(Text, nullable=False)
    ttl = Column(Integer, default=300)
    priority = Column(Integer, nullable=True)   # MX, SRV
    weight = Column(Integer, nullable=True)      # SRV
    port = Column(Integer, nullable=True)        # SRV
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    zone = relationship("HostedZone", back_populates="records")
