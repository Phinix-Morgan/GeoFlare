
# GeoFlare setup

## Connect Supabase

1. In Supabase, open **Project Settings -> Database -> Connect**.
2. Copy the **Session pooler** connection string. Use the direct connection only when your environment supports IPv6.
3. Create a local `.env` file in the repository root by copying `.env.example`.
4. Replace `DATABASE_URL` with the Supabase URI and URL-encode special characters in the database password (`@` becomes `%40`, for example).
5. Set `FIRMS_MAP_KEY` to your NASA FIRMS API key.

The SQLAlchemy driver format must be:

```text
postgresql+psycopg://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
```

Test the database connection from the repository root:

```text
uv run python -m backend.test_db
```

Start the API from the repository root:

```text
uv run uvicorn backend.app.main:app --reload
```

Verify it at `http://127.0.0.1:8000/health`. The frontend expects the API at that address.
