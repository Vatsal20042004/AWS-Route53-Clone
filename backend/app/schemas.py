from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class ZoneType(str, Enum):
    PUBLIC = "Public"
    PRIVATE = "Private"


class RecordType(str, Enum):
    A = "A"
    AAAA = "AAAA"
    CNAME = "CNAME"
    TXT = "TXT"
    MX = "MX"
    NS = "NS"
    PTR = "PTR"
    SRV = "SRV"
    CAA = "CAA"


# ─── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Hosted Zone ─────────────────────────────────────────────────────────────

class HostedZoneCreate(BaseModel):
    name: str = Field(..., min_length=1)
    type: ZoneType = ZoneType.PUBLIC
    comment: Optional[str] = None


class HostedZoneUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[ZoneType] = None
    comment: Optional[str] = None


class HostedZoneOut(BaseModel):
    id: str
    name: str
    type: ZoneType
    comment: Optional[str]
    record_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── DNS Record ──────────────────────────────────────────────────────────────

class DNSRecordCreate(BaseModel):
    name: str = Field(..., min_length=1)
    type: RecordType
    value: str = Field(..., min_length=1)
    ttl: int = Field(default=300, ge=1, le=2147483647)
    priority: Optional[int] = None
    weight: Optional[int] = None
    port: Optional[int] = None

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v, info):
        return v

    model_config = {"from_attributes": True}


class DNSRecordUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[RecordType] = None
    value: Optional[str] = None
    ttl: Optional[int] = Field(default=None, ge=1, le=2147483647)
    priority: Optional[int] = None
    weight: Optional[int] = None
    port: Optional[int] = None

    model_config = {"from_attributes": True}


class DNSRecordOut(BaseModel):
    id: str
    hosted_zone_id: str
    name: str
    type: RecordType
    value: str
    ttl: int
    priority: Optional[int]
    weight: Optional[int]
    port: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Paginated responses ──────────────────────────────────────────────────────

class PaginatedZones(BaseModel):
    data: List[HostedZoneOut]
    total: int
    page: int
    page_size: int


class PaginatedRecords(BaseModel):
    data: List[DNSRecordOut]
    total: int
    page: int
    page_size: int
