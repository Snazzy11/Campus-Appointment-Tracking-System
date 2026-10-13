"""Private object storage; clients receive only normalized images through the API."""
import base64
import binascii
import io
import logging
import os
import re
import warnings
from pathlib import Path
from uuid import uuid4

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 5 * 1024 * 1024
MAX_ENCODED = 4 * ((MAX_BYTES + 2) // 3)
KEY = re.compile(r"^[0-9a-f]{32}\.jpg$")
Image.MAX_IMAGE_PIXELS = 20_000_000
logger = logging.getLogger(__name__)


def normalize(encoded):
    try:
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) > MAX_BYTES:
            raise HTTPException(413, "Choose a photo smaller than 5 MB")
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as original:
                if original.format not in ("JPEG", "PNG", "WEBP") or getattr(original, "is_animated", False):
                    raise HTTPException(422, "Choose a still JPEG, PNG, or WebP photo")
                original.load()
                oriented = ImageOps.exif_transpose(original).convert("RGBA")
                # Flatten transparency on white, crop to square and discard metadata.
                square = ImageOps.fit(oriented, (512, 512), method=Image.Resampling.LANCZOS)
                clean = Image.new("RGB", (512, 512), "white")
                clean.paste(square, mask=square.getchannel("A"))
                output = io.BytesIO()
                clean.save(output, format="JPEG", quality=85)
                return output.getvalue()
    except (binascii.Error, ValueError, OSError, UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, "Invalid photo. Choose a JPEG, PNG, or WebP image up to 20 megapixels") from None


def storage():
    bucket = os.getenv("AVATAR_S3_BUCKET")
    if bucket:
        client = boto3.client("s3", region_name=os.getenv("AWS_REGION") or os.getenv("COGNITO_REGION"),
                              config=Config(connect_timeout=5, read_timeout=10, retries={"max_attempts": 2}))
        return client, bucket
    if os.getenv("COOKIE_SECURE", "false").lower() == "true":
        raise HTTPException(503, "Profile photo storage is not configured yet")
    directory = Path(os.getenv("AVATAR_LOCAL_DIR", Path(__file__).resolve().parents[2] / ".data/avatars"))
    directory.mkdir(parents=True, exist_ok=True)
    return None, directory


def put(data):
    key = uuid4().hex + ".jpg"
    try:
        client, location = storage()
        if client:
            client.put_object(Bucket=location, Key="avatars/" + key, Body=data, ContentType="image/jpeg", ServerSideEncryption="AES256")
        else:
            (location / key).write_bytes(data)
    except (BotoCoreError, ClientError, OSError):
        raise HTTPException(503, "Photo storage is temporarily unavailable") from None
    return key


def read(key):
    if not KEY.fullmatch(key):
        raise HTTPException(404, "Photo not found")
    try:
        client, location = storage()
        if client:
            response = client.get_object(Bucket=location, Key="avatars/" + key)
            try:
                return response["Body"].read()
            finally:
                response["Body"].close()
        return (location / key).read_bytes()
    except FileNotFoundError:
        raise HTTPException(404, "Photo not found") from None
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") in ("NoSuchKey", "404"):
            raise HTTPException(404, "Photo not found") from None
        raise HTTPException(503, "Photo storage is temporarily unavailable") from None
    except (BotoCoreError, OSError):
        raise HTTPException(503, "Photo storage is temporarily unavailable") from None


def discard(key):
    if not key or not KEY.fullmatch(key):
        return
    try:
        client, location = storage()
        if client:
            client.delete_object(Bucket=location, Key="avatars/" + key)
        else:
            (location / key).unlink(missing_ok=True)
    except (HTTPException, BotoCoreError, ClientError, OSError):
        # A failed cleanup must not turn an already committed profile save into a failure.
        logger.warning("Avatar cleanup failed; orphaned object needs later cleanup")
