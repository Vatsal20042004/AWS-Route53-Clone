"""
Seed script — run once to populate DB with admin user and sample data.
Usage:
    cd backend
    python seed.py
"""
import sys
import os
import uuid
from datetime import datetime

# Allow imports from app/
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine, Base
from app import models
from app.auth import get_password_hash

Base.metadata.create_all(bind=engine)
db = SessionLocal()


def seed():
    # ── Admin user ─────────────────────────────────────────────────────────
    existing = db.query(models.User).filter(models.User.username == "admin").first()
    if not existing:
        admin = models.User(
            username="admin",
            password_hash=get_password_hash("admin123"),
            created_at=datetime.utcnow(),
        )
        db.add(admin)
        db.commit()
        print("✅ Admin user created (admin/admin123)")
    else:
        print("ℹ️  Admin user already exists")

    # ── Sample Hosted Zones ────────────────────────────────────────────────
    zones_data = [
        {"name": "example.com", "type": models.ZoneType.PUBLIC, "comment": "Primary public zone"},
        {"name": "internal.corp", "type": models.ZoneType.PRIVATE, "comment": "Internal corporate DNS"},
        {"name": "api.example.io", "type": models.ZoneType.PUBLIC, "comment": "API subdomain zone"},
    ]

    zone_ids = []
    for zd in zones_data:
        z = db.query(models.HostedZone).filter(models.HostedZone.name == zd["name"]).first()
        if not z:
            z = models.HostedZone(
                id=str(uuid.uuid4()),
                **zd,
                record_count=0,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(z)
            db.commit()
            db.refresh(z)
            print(f"✅ Zone created: {zd['name']}")
        else:
            print(f"ℹ️  Zone already exists: {zd['name']}")
        zone_ids.append(z.id)

    # ── Sample DNS Records ─────────────────────────────────────────────────
    records_data = [
        # example.com records
        {"hosted_zone_id": zone_ids[0], "name": "example.com", "type": models.RecordType.A, "value": "93.184.216.34", "ttl": 300},
        {"hosted_zone_id": zone_ids[0], "name": "www.example.com", "type": models.RecordType.CNAME, "value": "example.com", "ttl": 3600},
        {"hosted_zone_id": zone_ids[0], "name": "example.com", "type": models.RecordType.MX, "value": "mail.example.com", "ttl": 3600, "priority": 10},
        {"hosted_zone_id": zone_ids[0], "name": "example.com", "type": models.RecordType.TXT, "value": "v=spf1 include:_spf.example.com ~all", "ttl": 3600},
        {"hosted_zone_id": zone_ids[0], "name": "example.com", "type": models.RecordType.NS, "value": "ns1.example.com", "ttl": 172800},
        # internal.corp records
        {"hosted_zone_id": zone_ids[1], "name": "app.internal.corp", "type": models.RecordType.A, "value": "10.0.1.50", "ttl": 60},
        {"hosted_zone_id": zone_ids[1], "name": "db.internal.corp", "type": models.RecordType.A, "value": "10.0.1.100", "ttl": 60},
        {"hosted_zone_id": zone_ids[1], "name": "_sip._tcp.internal.corp", "type": models.RecordType.SRV, "value": "sipserver.internal.corp", "ttl": 300, "priority": 10, "weight": 20, "port": 5060},
        # api.example.io records
        {"hosted_zone_id": zone_ids[2], "name": "api.example.io", "type": models.RecordType.A, "value": "203.0.113.42", "ttl": 300},
        {"hosted_zone_id": zone_ids[2], "name": "api.example.io", "type": models.RecordType.AAAA, "value": "2001:db8::1", "ttl": 300},
        {"hosted_zone_id": zone_ids[2], "name": "api.example.io", "type": models.RecordType.CAA, "value": "0 issue letsencrypt.org", "ttl": 3600},
    ]

    for rd in records_data:
        # Simple dedup check by name+type+zone
        existing_r = (
            db.query(models.DNSRecord)
            .filter(
                models.DNSRecord.hosted_zone_id == rd["hosted_zone_id"],
                models.DNSRecord.name == rd["name"],
                models.DNSRecord.type == rd["type"],
            )
            .first()
        )
        if not existing_r:
            r = models.DNSRecord(
                id=str(uuid.uuid4()),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                **rd,
            )
            db.add(r)
        
    db.commit()
    print("✅ Sample records seeded")

    # Update record counts
    for zone_id in zone_ids:
        count = db.query(models.DNSRecord).filter(models.DNSRecord.hosted_zone_id == zone_id).count()
        zone = db.query(models.HostedZone).filter(models.HostedZone.id == zone_id).first()
        if zone:
            zone.record_count = count
    db.commit()
    print("✅ Record counts updated")
    print("\n🎉 Seed complete! Log in with admin/admin123")


if __name__ == "__main__":
    seed()
    db.close()
