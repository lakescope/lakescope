import os
import logging
import boto3
from botocore.config import Config as BotoConfig
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from src.delta_reader import DeltaReader

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
log = logging.getLogger("main")

DEFAULT_TABLE_PATH = os.getenv("DELTA_TABLE_PATH", "")
AWS_PROFILE = os.getenv("AWS_PROFILE")
AWS_REGION = os.getenv("AWS_REGION")

log.info("LakeScope backend starting")
log.info("Default table: %s | Profile: %s | Region: %s", DEFAULT_TABLE_PATH, AWS_PROFILE, AWS_REGION)


def make_reader(path: str) -> DeltaReader:
    resolved = path or DEFAULT_TABLE_PATH
    if not resolved:
        raise ValueError("No table path provided — pass ?path=s3://... or set DELTA_TABLE_PATH")
    return DeltaReader(resolved, AWS_PROFILE, AWS_REGION)


app = FastAPI(title="LakeScope API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/info")
def info(path: str = Query(default="")):
    try:
        return make_reader(path).get_info()
    except Exception as e:
        log.exception("get_info failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/history")
def history(limit: int = Query(default=100, le=1000), path: str = Query(default="")):
    try:
        return make_reader(path).get_history(limit=limit)
    except Exception as e:
        log.exception("get_history failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/schema")
def schema(path: str = Query(default="")):
    try:
        return make_reader(path).get_schema()
    except Exception as e:
        log.exception("get_schema failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/files")
def files(path: str = Query(default="")):
    try:
        return make_reader(path).get_files()
    except Exception as e:
        log.exception("get_files failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
def table_health(path: str = Query(default="")):
    try:
        return make_reader(path).get_health()
    except Exception as e:
        log.exception("get_health failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/browse")
def browse(prefix: str = Query(default="")):
    try:
        p = prefix[5:] if prefix.startswith("s3://") else prefix
        parts = p.split("/", 1)
        bucket = parts[0]
        key_prefix = parts[1] if len(parts) > 1 else ""
        if key_prefix and not key_prefix.endswith("/"):
            key_prefix += "/"

        access_key = os.getenv("AWS_ACCESS_KEY_ID")
        secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        token = os.getenv("AWS_SESSION_TOKEN")
        region = AWS_REGION or "us-east-1"

        boto_cfg = BotoConfig(connect_timeout=5, read_timeout=15, retries={"max_attempts": 1})
        s3_kwargs: dict = {"region_name": region, "config": boto_cfg}
        if access_key and secret_key:
            s3_kwargs["aws_access_key_id"] = access_key
            s3_kwargs["aws_secret_access_key"] = secret_key
            if token:
                s3_kwargs["aws_session_token"] = token

        s3 = boto3.client("s3", **s3_kwargs)
        paginator = s3.get_paginator("list_objects_v2")

        dirs, tables = [], []
        for page in paginator.paginate(
            Bucket=bucket, Prefix=key_prefix, Delimiter="/",
            PaginationConfig={"MaxItems": 500},
        ):
            for cp in page.get("CommonPrefixes", []):
                key = cp["Prefix"]
                full = f"s3://{bucket}/{key}"
                if key.rstrip("/").endswith(".delta"):
                    tables.append(full)
                else:
                    dirs.append(full)

        return {
            "prefix": f"s3://{bucket}/{key_prefix}",
            "dirs": sorted(dirs),
            "tables": sorted(tables),
        }
    except Exception as e:
        log.exception("browse failed")
        raise HTTPException(status_code=500, detail=str(e))
