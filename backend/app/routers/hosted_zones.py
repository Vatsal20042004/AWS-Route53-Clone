from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import uuid

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user

router = APIRouter(prefix="/hosted-zones", tags=["hosted-zones"])


def _refresh_record_count(db: Session, zone: models.HostedZone):
    count = db.query(models.DNSRecord).filter(
        models.DNSRecord.hosted_zone_id == zone.id
    ).count()
    zone.record_count = count
    db.commit()


@router.get("", response_model=schemas.PaginatedZones)
def list_zones(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.HostedZone)
    if search:
        q = q.filter(models.HostedZone.name.ilike(f"%{search}%"))
    total = q.count()
    zones = q.order_by(models.HostedZone.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"data": zones, "total": total, "page": page, "page_size": page_size}


@router.get("/{zone_id}", response_model=schemas.HostedZoneOut)
def get_zone(
    zone_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = db.query(models.HostedZone).filter(models.HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")
    return zone


@router.post("", response_model=schemas.HostedZoneOut, status_code=status.HTTP_201_CREATED)
def create_zone(
    payload: schemas.HostedZoneCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = models.HostedZone(
        id=str(uuid.uuid4()),
        name=payload.name,
        type=payload.type,
        comment=payload.comment,
        record_count=0,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


@router.put("/{zone_id}", response_model=schemas.HostedZoneOut)
def update_zone(
    zone_id: str,
    payload: schemas.HostedZoneUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = db.query(models.HostedZone).filter(models.HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(zone, key, value)
    zone.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(zone)
    return zone


@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zone(
    zone_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    zone = db.query(models.HostedZone).filter(models.HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")
    db.delete(zone)
    db.commit()
