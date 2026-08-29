import os
from datetime import datetime, timezone
from flask import Flask, jsonify, render_template, request
from sqlalchemy import DateTime, Float, Integer, String, create_engine, desc
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

app = Flask(__name__)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///sos.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)

class Base(DeclarativeBase):
    pass

class SOSRecord(Base):
    __tablename__ = "sos_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_id: Mapped[str] = mapped_column(String(80), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    rssi: Mapped[int | None] = mapped_column(Integer, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

Base.metadata.create_all(engine)

def record_to_dict(row):
    return {"id":row.id,"device_id":row.device_id,"latitude":row.latitude,"longitude":row.longitude,"rssi":row.rssi,"received_at":row.received_at.isoformat(),"has_gps":row.latitude is not None and row.longitude is not None}

@app.get("/")
def dashboard(): return render_template("index.html")

@app.get("/health")
def health(): return {"status":"ok"}

@app.post("/api/sos")
def receive_sos():
    data=request.get_json(silent=True) or {}
    device_id=str(data.get("device_id","")).strip()
    if not device_id: return jsonify({"ok":False,"error":"device_id is required"}),400
    latitude,longitude,rssi=data.get("latitude"),data.get("longitude"),data.get("rssi")
    try:
        latitude=None if latitude is None else float(latitude); longitude=None if longitude is None else float(longitude); rssi=None if rssi is None else int(rssi)
    except (TypeError,ValueError): return jsonify({"ok":False,"error":"Invalid coordinate or RSSI"}),400
    if latitude is not None and not (-90<=latitude<=90): return jsonify({"ok":False,"error":"Invalid latitude"}),400
    if longitude is not None and not (-180<=longitude<=180): return jsonify({"ok":False,"error":"Invalid longitude"}),400
    row=SOSRecord(device_id=device_id,latitude=latitude,longitude=longitude,rssi=rssi)
    with SessionLocal() as db:
        db.add(row);db.commit();db.refresh(row);return jsonify({"ok":True,"record":record_to_dict(row)}),201

@app.get("/api/latest")
def latest():
    with SessionLocal() as db:
        row=db.query(SOSRecord).order_by(desc(SOSRecord.id)).first()
        return jsonify({"ok":True,"record":None if row is None else record_to_dict(row)})

@app.get("/api/history")
def history():
    try: limit=min(max(int(request.args.get("limit",50)),1),200)
    except ValueError: limit=50
    with SessionLocal() as db:
        rows=db.query(SOSRecord).order_by(desc(SOSRecord.id)).limit(limit).all()
        return jsonify({"ok":True,"records":[record_to_dict(row) for row in rows]})

if __name__ == "__main__":
    app.run(host="0.0.0.0",port=int(os.getenv("PORT","5000")),debug=True)
