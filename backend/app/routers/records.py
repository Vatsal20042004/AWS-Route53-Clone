from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import uuid

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user

router = APIRouter(tags=["records"])


def _update_zone_record_count(db: Session, zone_id: str):
    count = db.query(models.DNSRecord).filter(
        models.DNSRecord.hosted_zone_id == zone_id
    ).count()
    zone = db.query(models.HostedZone).filter(models.HostedZone.id == zone_id).first()
    if zone:
        zone.record_count = count
        zone.updated_at = datetime.utcnow()
        db.commit()


def _validate_record(payload: schemas.DNSRecordCreate):
    """Validate type-specific field requirements."""
    if payload.type == schemas.RecordType.MX:
        if payload.priority is None:
            raise HTTPException(
                status_code=422, detail="MX records require 'priority' field"
            )
    if payload.type == schemas.RecordType.SRV:
        missing = [f for f, v in [("priority", payload.priority), ("weight", payload.weight), ("port", payload.port)] if v is None]
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"SRV records require: {', '.join(missing)}",
            )
    if payload.type == schemas.RecordType.CAA:
        # CAA value should be in format: flag tag value (e.g. "0 issue letsencrypt.org")
        parts = payload.value.strip().split(" ", 2)
        if len(parts) < 3:
            raise HTTPException(
                status_code=422,
                detail="CAA record value must be in format: 'flag tag value' (e.g. '0 issue letsencrypt.org')",
            )


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
    records = q.order_by(models.DNSRecord.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
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

    _validate_record(payload)

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
    for key, value in update_data.items():
        setattr(record, key, value)
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
