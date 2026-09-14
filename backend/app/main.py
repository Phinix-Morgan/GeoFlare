import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .pipeline import pipeline
from .schemas import GeoFlareEvent

from backend.ingestion import run_ingestion


INGEST_INTERVAL_SECONDS = 15 * 60


app = FastAPI(
    title="GeoFlare API",
    description="AI-Powered Geospatial Thermal Intelligence API",
    version="0.2.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


ingestion_lock = asyncio.Lock()


async def automatic_ingestion_loop():
    await asyncio.sleep(5)

    while True:
        try:
            if not ingestion_lock.locked():
                async with ingestion_lock:
                    await asyncio.to_thread(run_ingestion)

        except Exception as exc:
            print(f"[GeoFlare] Automatic ingestion failed: {exc}")

        await asyncio.sleep(INGEST_INTERVAL_SECONDS)


@app.on_event("startup")
async def startup():
    asyncio.create_task(automatic_ingestion_loop())
    print("[GeoFlare] Automatic FIRMS ingestion enabled.")
    print(
        f"[GeoFlare] Ingestion interval: "
        f"{INGEST_INTERVAL_SECONDS // 60} minutes."
    )


@app.get("/health")
def health():
    return pipeline.health()


@app.get(
    "/events",
    response_model=list[GeoFlareEvent],
)
def get_events():
    return pipeline.get_events()


@app.get("/events/geojson")
def get_events_geojson():
    events = pipeline.get_events()

    features = []

    for event in events:
        properties = {
            key: value
            for key, value in event.items()
            if key not in {"latitude", "longitude"}
        }

        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [
                        event["longitude"],
                        event["latitude"],
                    ],
                },
                "properties": properties,
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
    }


@app.post("/ingest")
async def ingest():
    if ingestion_lock.locked():
        return {
            "status": "busy",
            "message": "An ingestion cycle is already running.",
        }

    async with ingestion_lock:
        result = await asyncio.to_thread(run_ingestion)

    return {
        "status": "ok",
        "message": "FIRMS ingestion completed.",
        **result,
    }