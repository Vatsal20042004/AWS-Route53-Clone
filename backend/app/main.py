from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import auth, hosted_zones, records

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AWS Route53 Clone API",
    description="A full-stack clone of the AWS Route53 console backend.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://aws-route53-clone.vercel.app",  # placeholder – update when deploying
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(hosted_zones.router)
app.include_router(records.router)


@app.get("/health")
def health():
    return {"status": "ok"}
