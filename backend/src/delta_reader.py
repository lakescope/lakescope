import json
import boto3
import os
from deltalake import DeltaTable
from typing import Optional
import logging

log = logging.getLogger("delta_reader")


def _resolve_storage_options(profile: Optional[str], region: str) -> dict:
    access_key = os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")

    if access_key and secret_key:
        log.info("Using credentials from environment variables")
        opts = {
            "AWS_ACCESS_KEY_ID": access_key,
            "AWS_SECRET_ACCESS_KEY": secret_key,
            "AWS_REGION": region,
            # S3 lacks atomic rename; delta-rs requires this flag to write on S3
            "AWS_S3_ALLOW_UNSAFE_RENAME": "true",
        }
        token = os.getenv("AWS_SESSION_TOKEN")
        if token:
            opts["AWS_SESSION_TOKEN"] = token
        return opts

    log.info("Resolving credentials via boto3 profile: %s", profile)
    kwargs = {}
    if profile:
        kwargs["profile_name"] = profile
    session = boto3.Session(**kwargs)
    creds = session.get_credentials()
    if creds is None:
        raise RuntimeError("No AWS credentials found")
    frozen = creds.get_frozen_credentials()
    opts = {
        "AWS_ACCESS_KEY_ID": frozen.access_key,
        "AWS_SECRET_ACCESS_KEY": frozen.secret_key,
        "AWS_REGION": region,
        # S3 lacks atomic rename; delta-rs requires this flag to write on S3
        "AWS_S3_ALLOW_UNSAFE_RENAME": "true",
    }
    if frozen.token:
        opts["AWS_SESSION_TOKEN"] = frozen.token
    return opts


def _auto_region(bucket: str, profile: Optional[str]) -> str:
    try:
        kwargs = {}
        if profile:
            kwargs["profile_name"] = profile
        s3 = boto3.Session(**kwargs).client("s3", region_name="us-east-1")
        loc = s3.get_bucket_location(Bucket=bucket)["LocationConstraint"]
        return loc or "us-east-1"
    except Exception as e:
        log.warning("Could not auto-detect region: %s — defaulting to us-east-1", e)
        return "us-east-1"


def _is_checkpoint_error(e: Exception) -> bool:
    msg = str(e).lower()
    return "parquet" in msg or "get_byte_ranges" in msg or "decoding response body" in msg


def _safe_int(d: dict, key: str) -> Optional[int]:
    try:
        return int(d[key])
    except Exception:
        return None


class DeltaReader:
    def __init__(self, path: str, profile: Optional[str], region: Optional[str]):
        self.path = path.rstrip("/")
        self.profile = profile or None
        self.bucket = path.replace("s3://", "").split("/")[0]
        self.region = region or _auto_region(self.bucket, self.profile)
        log.info("Using region: %s", self.region)

        # Derive S3 prefixes
        without_scheme = self.path.replace("s3://", "")
        key_part = without_scheme.split("/", 1)[1] if "/" in without_scheme else ""
        self._log_prefix = key_part.rstrip("/") + "/_delta_log/"

    # -------------------------------------------------------------------------
    # delta-rs helpers (fast path for small/medium tables)
    # -------------------------------------------------------------------------

    def _load(self, without_files: bool = False) -> DeltaTable:
        opts = _resolve_storage_options(self.profile, self.region)
        return DeltaTable(self.path, storage_options=opts, without_files=without_files)

    def _add_actions(self, dt: DeltaTable) -> dict:
        log.info("Reading add actions from checkpoint...")
        result = dt.get_add_actions(flatten=True).to_pydict()
        log.info("Add actions loaded: %d files", len(result.get("path", [])))
        return result

    # -------------------------------------------------------------------------
    # S3/boto3 fallback helpers (used when checkpoint parquet is unreadable)
    # -------------------------------------------------------------------------

    def _s3(self):
        opts = _resolve_storage_options(self.profile, self.region)
        return boto3.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=opts.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=opts.get("AWS_SECRET_ACCESS_KEY"),
            aws_session_token=opts.get("AWS_SESSION_TOKEN"),
        )

    def _read_log_json(self, s3, version: int) -> list[dict]:
        key = f"{self._log_prefix}{version:020d}.json"
        try:
            body = s3.get_object(Bucket=self.bucket, Key=key)["Body"].read().decode("utf-8")
            return [json.loads(line) for line in body.splitlines() if line.strip()]
        except Exception:
            return []

    def _get_checkpoint_version(self, s3) -> Optional[int]:
        try:
            body = s3.get_object(
                Bucket=self.bucket,
                Key=f"{self._log_prefix}_last_checkpoint",
            )["Body"].read()
            return json.loads(body).get("version")
        except Exception:
            return None

    def _list_log_versions(self, s3, from_version: int, max_results: int = 500) -> list[int]:
        """List _delta_log/*.json version numbers at or after from_version."""
        # StartAfter is exclusive, so subtract 1 to include from_version itself
        start_after = f"{self._log_prefix}{max(0, from_version - 1):020d}.json"
        versions: list[int] = []
        pag = s3.get_paginator("list_objects_v2")
        for page in pag.paginate(
            Bucket=self.bucket,
            Prefix=self._log_prefix,
            StartAfter=start_after,
        ):
            for obj in page.get("Contents", []):
                fname = obj["Key"].split("/")[-1]
                # Only match exactly 20-digit version .json files
                if len(fname) == 25 and fname.endswith(".json") and fname[:20].isdigit():
                    v = int(fname[:20])
                    if v >= from_version:
                        versions.append(v)
                        if len(versions) >= max_results:
                            return sorted(versions)
        return sorted(versions)

    def _current_version_from_s3(self, s3) -> int:
        cp = self._get_checkpoint_version(s3)
        # List log files from near the checkpoint to find the latest commit
        start = max(0, (cp or 0))
        versions = self._list_log_versions(s3, from_version=start, max_results=2000)
        if versions:
            return versions[-1]
        if cp is not None:
            return cp
        raise RuntimeError("Cannot determine table version: no .json files in _delta_log/")

    def _find_metadata_from_s3(self, s3) -> dict:
        """Scan JSON log files to find the most recent metaData action."""
        cp = self._get_checkpoint_version(s3)
        # Check recent files first (may contain schema change), then version 0 as fallback
        recent = self._list_log_versions(s3, from_version=max(0, (cp or 0)), max_results=100)
        check_versions = list(reversed(recent))
        if 0 not in recent:
            check_versions.append(0)

        for v in check_versions:
            for action in self._read_log_json(s3, v):
                if "metaData" in action:
                    return action["metaData"]
        return {}

    # -------------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------------

    def get_info(self) -> dict:
        log.info("get_info: loading table")
        try:
            dt = self._load(without_files=False)
            meta = dt.metadata()
            files = dt.files()
            num_files = len(files)
            total_bytes = None
            avg_bytes = None
            total_rows = None
            try:
                actions = self._add_actions(dt)
                sizes = [s for s in actions.get("size_bytes", []) if s]
                total_bytes = sum(sizes) or None
                avg_bytes = round(total_bytes / len(sizes)) if sizes and total_bytes else None
                rec = actions.get("num_records", [])
                if rec:
                    total_rows = sum(r for r in rec if r) or None
            except Exception as e:
                log.warning("Could not read add actions: %s", e)
            return {
                "path": self.path,
                "version": dt.version(),
                "name": meta.name or self.path.rstrip("/").split("/")[-1],
                "description": meta.description,
                "partition_columns": meta.partition_columns,
                "num_files": num_files,
                "total_size_bytes": total_bytes,
                "avg_file_size_bytes": avg_bytes,
                "total_rows": total_rows,
                "created_time": meta.created_time,
                "configuration": meta.configuration or {},
            }
        except Exception as e:
            if not _is_checkpoint_error(e):
                raise
            log.warning("Large table — checkpoint unreadable, falling back to JSON log: %s", e)

        # S3 fallback: read metadata from JSON log files (no parquet involved)
        s3 = self._s3()
        current_version = self._current_version_from_s3(s3)
        meta = self._find_metadata_from_s3(s3)

        partition_columns = meta.get("partitionColumns", [])
        table_name = meta.get("name") or self.path.rstrip("/").split("/")[-1]
        configuration = meta.get("configuration") or {}
        created_time = meta.get("createdTime")

        return {
            "path": self.path,
            "version": current_version,
            "name": table_name,
            "description": None,
            "partition_columns": partition_columns,
            "num_files": None,       # not derivable without checkpoint parquet
            "total_size_bytes": None,
            "avg_file_size_bytes": None,
            "total_rows": None,
            "created_time": created_time,
            "configuration": configuration,
        }

    def get_history(self, limit: int = 100) -> list[dict]:
        log.info("get_history: limit=%d", limit)
        try:
            dt = self._load(without_files=True)
            raw = dt.history(limit=limit)
            result = []
            for entry in raw:
                metrics = entry.get("operationMetrics", {}) or {}
                params = entry.get("operationParameters", {}) or {}
                result.append({
                    "version": entry.get("version"),
                    "timestamp": entry.get("timestamp"),
                    "operation": entry.get("operation", "UNKNOWN"),
                    "user": (
                        entry.get("userName")
                        or entry.get("userMetadata")
                        or entry.get("engineInfo")
                        or "unknown"
                    ),
                    "num_added_files": _safe_int(metrics, "numFiles") or _safe_int(metrics, "numAddedFiles"),
                    "num_removed_files": _safe_int(metrics, "numRemovedFiles"),
                    "num_output_rows": _safe_int(metrics, "numOutputRows"),
                    "num_deleted_rows": _safe_int(metrics, "numDeletedRows"),
                    "execution_time_ms": _safe_int(metrics, "executionTimeMs"),
                    "size_bytes": _safe_int(metrics, "numOutputBytes"),
                    "parameters": {k: str(v) for k, v in params.items()},
                })
            log.info("get_history: returned %d commits", len(result))
            return result
        except Exception as e:
            if not _is_checkpoint_error(e):
                raise
            log.warning("Large table — checkpoint unreadable, falling back to JSON log: %s", e)

        # S3 fallback: read commit history from individual .json log files
        s3 = self._s3()
        current_version = self._current_version_from_s3(s3)
        start_from = max(0, current_version - limit)
        versions = self._list_log_versions(s3, from_version=start_from, max_results=limit + 50)
        recent_versions = sorted(versions)[-limit:]

        result = []
        for v in reversed(recent_versions):
            actions = self._read_log_json(s3, v)
            ci = next((a.get("commitInfo") for a in actions if "commitInfo" in a), None)
            if not ci:
                continue
            metrics = ci.get("operationMetrics", {}) or {}
            params = ci.get("operationParameters", {}) or {}
            result.append({
                "version": v,
                "timestamp": ci.get("timestamp"),
                "operation": ci.get("operation", "UNKNOWN"),
                "user": (
                    ci.get("userName")
                    or ci.get("userMetadata")
                    or ci.get("engineInfo")
                    or "unknown"
                ),
                "num_added_files": _safe_int(metrics, "numFiles") or _safe_int(metrics, "numAddedFiles"),
                "num_removed_files": _safe_int(metrics, "numRemovedFiles"),
                "num_output_rows": _safe_int(metrics, "numOutputRows"),
                "num_deleted_rows": _safe_int(metrics, "numDeletedRows"),
                "execution_time_ms": _safe_int(metrics, "executionTimeMs"),
                "size_bytes": _safe_int(metrics, "numOutputBytes"),
                "parameters": {k: str(v) for k, v in params.items()},
            })
        log.info("get_history: S3 fallback returned %d commits", len(result))
        return result

    def get_schema(self) -> list[dict]:
        log.info("get_schema: loading")
        try:
            dt = self._load(without_files=True)
            return [
                {
                    "name": f.name,
                    "type": str(f.type),
                    "nullable": f.nullable,
                    "metadata": f.metadata or {},
                }
                for f in dt.schema().fields
            ]
        except Exception as e:
            if not _is_checkpoint_error(e):
                raise
            log.warning("Large table — checkpoint unreadable, falling back to JSON log: %s", e)

        # S3 fallback: extract schemaString from metaData action
        s3 = self._s3()
        meta = self._find_metadata_from_s3(s3)
        schema_str = meta.get("schemaString", "{}")
        try:
            schema_json = json.loads(schema_str)
        except Exception:
            return []
        return [
            {
                "name": f.get("name", ""),
                "type": str(f.get("type", "")),
                "nullable": f.get("nullable", True),
                "metadata": f.get("metadata") or {},
            }
            for f in schema_json.get("fields", [])
        ]

    def get_files(self) -> dict:
        log.info("get_files: reading add actions")
        try:
            dt = self._load(without_files=False)
        except Exception as e:
            if _is_checkpoint_error(e):
                log.warning("get_files: checkpoint too large to read — file stats unavailable: %s", e)
                return {
                    "files": [], "total": None, "size_buckets": {},
                    "error": "Checkpoint parquet too large — file stats unavailable for this table",
                }
            raise

        try:
            actions = self._add_actions(dt)
        except Exception as e:
            log.error("get_files: add actions failed: %s", e)
            return {"files": [], "total": 0, "size_buckets": {}, "error": str(e)}

        paths = actions.get("path", [])
        sizes = actions.get("size_bytes", [])
        mod_times = actions.get("modification_time", [])
        num_records = actions.get("num_records", [None] * len(paths))

        buckets = {"<1MB": 0, "1-10MB": 0, "10-64MB": 0, "64-128MB": 0, ">128MB": 0}
        files_sample = []
        for i, path in enumerate(paths):
            sz = sizes[i] if i < len(sizes) else 0
            mb = (sz or 0) / 1_048_576
            if mb < 1:
                buckets["<1MB"] += 1
            elif mb < 10:
                buckets["1-10MB"] += 1
            elif mb < 64:
                buckets["10-64MB"] += 1
            elif mb < 128:
                buckets["64-128MB"] += 1
            else:
                buckets[">128MB"] += 1
            if i < 500:
                files_sample.append({
                    "path": path,
                    "size_bytes": sz,
                    "modification_time": mod_times[i] if i < len(mod_times) else None,
                    "num_records": num_records[i] if num_records and i < len(num_records) else None,
                })

        log.info("get_files: %d total files, returning %d sample", len(paths), len(files_sample))
        return {"files": files_sample, "total": len(paths), "size_buckets": buckets}

    def get_health(self) -> dict:
        log.info("get_health: loading")
        try:
            dt = self._load(without_files=True)
            version = dt.version()
            history = dt.history()
        except Exception as e:
            if not _is_checkpoint_error(e):
                raise
            log.warning("Large table — checkpoint unreadable, falling back to JSON log: %s", e)
            return self._get_health_from_s3()

        last_vacuum = None
        last_optimize = None
        last_schema_change = None
        for entry in history:
            op = entry.get("operation", "")
            if last_vacuum is None and "VACUUM" in op:
                last_vacuum = entry
            if last_optimize is None and op in ("OPTIMIZE", "REORG"):
                last_optimize = entry
            if last_schema_change is None and op in ("ADD COLUMNS", "REPLACE COLUMNS", "CHANGE COLUMN"):
                last_schema_change = entry
            if last_vacuum and last_optimize and last_schema_change:
                break

        last_checkpoint = (version // 10) * 10
        return {
            "current_version": version,
            "last_checkpoint_version": last_checkpoint,
            "versions_since_checkpoint": version - last_checkpoint,
            "last_vacuum": _fmt_health_entry(last_vacuum),
            "last_optimize": _fmt_health_entry(last_optimize),
            "last_schema_change": _fmt_health_entry(last_schema_change),
        }

    def _get_health_from_s3(self) -> dict:
        s3 = self._s3()
        current_version = self._current_version_from_s3(s3)
        cp_version = self._get_checkpoint_version(s3) or (current_version // 10) * 10

        # Scan all available JSON log files for health-relevant operations
        versions = self._list_log_versions(s3, from_version=0, max_results=10000)
        last_vacuum = None
        last_optimize = None
        last_schema_change = None

        for v in reversed(versions):
            actions = self._read_log_json(s3, v)
            ci = next((a.get("commitInfo") for a in actions if "commitInfo" in a), None)
            if not ci:
                continue
            op = ci.get("operation", "")
            entry = {
                "version": v,
                "timestamp": ci.get("timestamp"),
                "operation": op,
                "operationMetrics": ci.get("operationMetrics") or {},
            }
            if last_vacuum is None and "VACUUM" in op:
                last_vacuum = entry
            if last_optimize is None and op in ("OPTIMIZE", "REORG"):
                last_optimize = entry
            if last_schema_change is None and op in ("ADD COLUMNS", "REPLACE COLUMNS", "CHANGE COLUMN"):
                last_schema_change = entry
            if last_vacuum and last_optimize and last_schema_change:
                break

        last_checkpoint = (current_version // 10) * 10
        return {
            "current_version": current_version,
            "last_checkpoint_version": last_checkpoint,
            "versions_since_checkpoint": current_version - last_checkpoint,
            "last_vacuum": _fmt_health_entry(last_vacuum),
            "last_optimize": _fmt_health_entry(last_optimize),
            "last_schema_change": _fmt_health_entry(last_schema_change),
        }


def _fmt_health_entry(h: Optional[dict]) -> Optional[dict]:
    if not h:
        return None
    return {
        "version": h.get("version"),
        "timestamp": h.get("timestamp"),
        "operation": h.get("operation"),
        "metrics": h.get("operationMetrics") or {},
    }
