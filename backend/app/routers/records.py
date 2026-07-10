import ipaddress
import re
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import uuid

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user

router = APIRouter(tags=["records"])

# ─── Hostname regex (RFC 1123) ────────────────────────────────────────────────
_HOSTNAME_RE = re.compile(
    r'^(?!-)'                          # no leading hyphen
    r'(?:[a-zA-Z0-9]'
    r'(?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?'
    r'\.)*'
    r'[a-zA-Z0-9]'
    r'(?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$'
)

# CAA: "0 issue \"letsencrypt.org\""  or  "128 issuewild \"*\""
_CAA_RE = re.compile(
    r'^(0|128)\s+(issue|issuewild|iodef)\s+"[^"]+"$'
)


def _is_valid_hostname(value: str) -> bool:
    return bool(_HOSTNAME_RE.match(value)) and len(value) <= 253


def _validate_value(record_type: schemas.RecordType, value: str) -> Optional[str]:
    """
    Returns an error string if invalid, or None if valid.
    """
    v = value.strip()

    if record_type == schemas.RecordType.A:
        try:
            ipaddress.IPv4Address(v)
        except ValueError:
            return f"Invalid IPv4 address format. Expected e.g. '192.0.2.1', got '{v}'"

    elif record_type == schemas.RecordType.AAAA:
        try:
            ipaddress.IPv6Address(v)
        except ValueError:
            return f"Invalid IPv6 address format. Expected e.g. '2001:db8::1', got '{v}'"

    elif record_type in (
        schemas.RecordType.CNAME,
        schemas.RecordType.MX,
        schemas.RecordType.NS,
        schemas.RecordType.PTR,
        schemas.RecordType.SRV,
    ):
        if not _is_valid_hostname(v):
            return (
                f"Invalid hostname for {record_type} record. "
                f"Must use letters, digits, hyphens and dots (no spaces, no bare IPs). "
                f"Got: '{v}'"
            )

    elif record_type == schemas.RecordType.TXT:
        if len(v) > 255:
            return f"TXT record value must be 255 characters or fewer (got {len(v)})"

    elif record_type == schemas.RecordType.CAA:
        if not _CAA_RE.match(v):
            return (
                'CAA record value must match: <flag> <tag> "<value>" '
                '— e.g. \'0 issue "letsencrypt.org"\'. '
                f"Flag must be 0 or 128; tag must be issue, issuewild, or iodef."
            )

    return None


def _validate_record_full(
    record_type: schemas.RecordType,
    value: str,
    priority: Optional[int],
    weight: Optional[int],
    port: Optional[int],
):
    """Run all validations — raises HTTPException on first failure."""

    # 1. Type-specific value format
    err = _validate_value(record_type, value)
    if err:
        raise HTTPException(status_code=422, detail=err)

    # 2. Required numeric fields
    if record_type == schemas.RecordType.MX:
        if priority is None:
            raise HTTPException(status_code=422, detail="MX records require 'priority'")
        if not (0 <= priority <= 65535):
            raise HTTPException(status_code=422, detail="MX priority must be 0–65535")

    if record_type == schemas.RecordType.SRV:
        if priority is None:
            raise HTTPException(status_code=422, detail="SRV records require 'priority'")
        if weight is None:
            raise HTTPException(status_code=422, detail="SRV records require 'weight'")
        if port is None:
            raise HTTPException(status_code=422, detail="SRV records require 'port'")
        if not (0 <= priority <= 65535):
            raise HTTPException(status_code=422, detail="SRV priority must be 0–65535")
        if not (1 <= port <= 65535):
            raise HTTPException(status_code=422, detail="SRV port must be 1–65535")


def _update_zone_record_count(db: Session, zone_id: str):
    count = db.query(models.DNSRecord).filter(
        models.DNSRecord.hosted_zone_id == zone_id
    ).count()
    zone = db.query(models.HostedZone).filter(models.HostedZone.id == zone_id).first()
    if zone:
        zone.record_count = count
        zone.updated_at = datetime.utcnow()
        db.commit()


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/hosted-zones/{zone_id}/records", response_model=schemas.PaginatedRecords)
def list_records(
    zone_id: str,
    search: Optional[str] = Query(None),
    type: Optional[schemas.RecordType] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = db.query(models.HostedZone).filter(models.HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")

    q = db.query(models.DNSRecord).filter(models.DNSRecord.hosted_zone_id == zone_id)
    if search:
        q = q.filter(models.DNSRecord.name.ilike(f"%{search}%"))
    if type:
        q = q.filter(models.DNSRecord.type == type)

    total = q.count()
    records = (
        q.order_by(models.DNSRecord.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"data": records, "total": total, "page": page, "page_size": page_size}


@router.get("/hosted-zones/{zone_id}/records/{record_id}", response_model=schemas.DNSRecordOut)
def get_record(
    zone_id: str,
    record_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    record = (
        db.query(models.DNSRecord)
        .filter(
            models.DNSRecord.id == record_id,
            models.DNSRecord.hosted_zone_id == zone_id,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


@router.post(
    "/hosted-zones/{zone_id}/records",
    response_model=schemas.DNSRecordOut,
    status_code=status.HTTP_201_CREATED,
)
def create_record(
    zone_id: str,
    payload: schemas.DNSRecordCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = db.query(models.HostedZone).filter(models.HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")

    _validate_record_full(
        payload.type, payload.value, payload.priority, payload.weight, payload.port
    )

    record = models.DNSRecord(
        id=str(uuid.uuid4()),
        hosted_zone_id=zone_id,
        name=payload.name,
        type=payload.type,
        value=payload.value,
        ttl=payload.ttl,
        priority=payload.priority,
        weight=payload.weight,
        port=payload.port,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    _update_zone_record_count(db, zone_id)
    return record


@router.put("/hosted-zones/{zone_id}/records/{record_id}", response_model=schemas.DNSRecordOut)
def update_record(
    zone_id: str,
    record_id: str,
    payload: schemas.DNSRecordUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    record = (
        db.query(models.DNSRecord)
        .filter(
            models.DNSRecord.id == record_id,
            models.DNSRecord.hosted_zone_id == zone_id,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    update_data = payload.model_dump(exclude_unset=True)

    # Determine the effective type/value/etc after applying updates
    effective_type = update_data.get("type", record.type)
    effective_value = update_data.get("value", record.value)
    effective_priority = update_data.get("priority", record.priority)
    effective_weight = update_data.get("weight", record.weight)
    effective_port = update_data.get("port", record.port)

    # Use string value for enum comparison
    if hasattr(effective_type, "value"):
        effective_type = schemas.RecordType(effective_type.value)

    _validate_record_full(
        effective_type, effective_value, effective_priority, effective_weight, effective_port
    )

    for key, val in update_data.items():
        setattr(record, key, val)
    record.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(record)
    return record


@router.delete("/hosted-zones/{zone_id}/records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(
    zone_id: str,
    record_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    record = (
        db.query(models.DNSRecord)
        .filter(
            models.DNSRecord.id == record_id,
            models.DNSRecord.hosted_zone_id == zone_id,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    db.delete(record)
    db.commit()
    _update_zone_record_count(db, zone_id)
