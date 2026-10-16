# Profile editing and photo storage

Profiles are implemented in `applicaton buildout`. Migration `d8b4a21e653c` adds nullable username/display name/avatar key, bio, and updated timestamp to users. A database unique index on `lower(username)` prevents case-insensitive collisions, including concurrent requests. Existing user IDs, Cognito subjects, emails, conversations, and messages are preserved. An empty username falls back to display name/email; usernames are stored lowercase.

## Local development

The buildout now has a separate Compose project `campus-buildout`, database `campus_buildout`, PostgreSQL loopback port 5434, and optional container web port 18083. Its ignored local configuration is already prepared. The separate database starts empty; accounts appear when users sign in. Existing groupdemo data is not copied or migrated.

```sh
docker compose --env-file deploy/local.env -f compose.yaml -f compose.dev.yaml up -d db
cd backend
uv sync --locked
uv run --locked alembic upgrade head
cd ..
./scripts/start-dev.sh
```

With no S3 bucket configured and `COOKIE_SECURE=false`, photos are stored in ignored `backend/.data/avatars`. Override `AVATAR_LOCAL_DIR` if necessary. Back up this directory along with the local database if retaining development photos. Compose mounts the named `avatar-data` volume at `/app/.data/avatars`, explicitly enabling persistent disk storage even under HTTPS. The image initializes this directory for the non-root API user. Back up this volume along with PostgreSQL; never remove it during a normal update. S3 remains preferred for multiple API hosts. Without a bucket or explicitly configured directory, HTTPS uploads fail closed.

The new `expo-image-picker` native module requires rebuilding an existing installed iPhone development app once. Web works immediately; Expo Go supports the picker but still cannot complete the app's Cognito native login. The configured photo-library picker does not request camera or microphone access.

## EC2 setup (prepared, not executed)

1. Create a private S3 bucket in your chosen AWS region, leaving Block Public Access enabled. The API uploads and serves images; clients never need S3 credentials or direct bucket CORS access.
2. Grant the application's runtime identity only `s3:GetObject`, `s3:PutObject`, and `s3:DeleteObject` on `arn:aws:s3:::YOUR_BUCKET/avatars/*`. Attach these permissions to an appropriate EC2 role without replacing permissions needed by existing applications. An instance role is shared by workloads that can reach instance metadata; review that boundary before granting it access.
3. Verify the API container can obtain role credentials. Boto3 uses its standard credential chain. Container access to EC2 metadata depends on the instance's metadata configuration; investigate that configuration rather than disabling IMDSv2. Never bake AWS keys into an image or frontend.
4. Add to the server's existing private `deploy/ec2.env`:

```dotenv
AVATAR_S3_BUCKET=your-private-bucket
AWS_REGION=us-east-2
```

Use the bucket's actual region. The Compose file passes these variables to the API. Uploads use SSE-S3 (`AES256`); a bucket requiring a different encryption policy needs corresponding code/policy changes.

5. In only the existing messaging Nginx site, set `client_max_body_size 7m;` to accommodate the bounded base64 upload of a 5 MiB image. The container Nginx config and host example are updated in source. The deployment script does not modify live host Nginx: review the one-site change, run `sudo nginx -t`, then gracefully reload Nginx. Preserve other sites.
6. Deploy this source using `./scripts/deploy-ec2.sh --migrate`. Cloud Compose identity remains `campus-ec2demo` and server directory `/home/ubuntu/apps/ec2demo`, retaining the existing database. Local images now use `campus-buildout-*` tags.
7. Verify text profile changes, duplicate username errors, photo replacement/removal, and persistence after API container recreation.

HTTPS requires either S3 or the explicit persistent directory supplied by Compose. No bucket or IAM changes are needed for the single-server disk option. The deployment guard permits adding only the standard project-local avatar volume while preserving all existing volumes and networks.

## Image lifecycle and visibility

- The server enforces a 5 MiB decoded upload limit and bounds streamed encoded bytes even without Content-Length.
- Only still JPEG/PNG/WebP images, up to 20 megapixels, are accepted. Images are oriented, center-cropped, flattened on white, resized to 512×512 JPEG, and re-encoded without original metadata.
- The database stores a random object key, never the image bytes. New objects use new keys; failed database commits clean up the newly uploaded object, and successful replacements attempt deletion of the old object.
- Only a currently referenced photo can be served. Cleanup failures are logged and can leave orphaned objects for later reconciliation. Process crashes between storage and database commits can also leave orphans; object storage and PostgreSQL are not one transaction.
- Avatar URLs are public to anyone with the link (including public-chat readers). They are not access-control tokens. Responses use no-store; previously downloaded copies cannot be revoked. Bios are returned only to authenticated users.
- Storage backups/version-retention policies must accompany database backups; restoring an old database alone cannot restore deleted photos.

## API

- GET `/api/me`: current user's profile and login identity.
- POST `/api/me/profile`: optional username, display_name, bio fields; omitted fields are preserved. Unknown identity/storage fields are rejected. Bearer session required.
- POST `/api/me/avatar`: raw base64 image body (Content-Type text/plain); returns updated account. Bearer session required.
- POST `/api/me/avatar/remove`: removes current photo. Bearer session required.
- GET `/api/users/{id}/profile`: authenticated public-profile fields and bio, without email or Cognito subject.
- GET `/api/avatars/{key}`: active normalized photo bytes.

Photo changes save immediately, independently of the form's Save/Cancel actions. Display name/avatar metadata is returned with messages and conversation members. History reloads resolve the current profile; existing remote screens refresh on reconnect/reload or conversation refresh, not through a dedicated profile-change event yet. System messages retain their historical text.

## Validation

Tests cover ownership/bearer requirements, identity field rejection, case-insensitive username conflicts and rollback, public-profile privacy, invalid/oversized/animated images, metadata removal, replacement/deletion, failed-commit cleanup, missing cloud storage, and the S3 adapter with a fake client. Frontend tests cover saved field rendering and initial save state. PostgreSQL migration and model consistency are checked separately. Real S3 permissions and physical iPhone photo selection still require their configured environments.

References: [Boto3 credentials](https://docs.aws.amazon.com/boto3/latest/guide/credentials.html), [S3 permissions](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-policy-language-overview.html), [Expo SDK 57 ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/).

Browser QA also exercised actual save and photo upload through a disposable API with mocked Cognito, followed by sign-in again and profile restoration. The application retains its existing in-memory web-session behavior, so a full browser reload requires sign-in again.


## Sign-out configuration

Add `https://messaging.tufts.pro/` and `campusmessaging://auth/callback` to the Cognito app client's Allowed sign-out URLs. For local web tests, also add the exact browser origin with a trailing slash, such as `http://localhost:8081/`. Keep existing callback and sign-out entries.

Sign out revokes the bearer session, clears device token storage and the legacy same-origin `campus_session` cookie, then opens Cognito's `/logout` endpoint in the authentication browser to clear its separate managed-login cookie. Web returns to the app root; native returns through the existing callback scheme. Login requests include `prompt=login` to request reauthentication. If the network fails or native logout is cancelled, local sign-out still completes and an explanatory error is shown. Federated external identity-provider sessions are controlled by that provider.


Deployed 2026-10-13 to messaging.tufts.pro with persistent disk storage. The actual volume is `campus-ec2demo_avatar-data`; include it in backups. The shared host's messaging site now permits 7 MB request bodies, and nginx configuration validation passed before reload. Database backup and previous Compose settings are retained under `/home/ubuntu/apps/ec2demo/releases/20261013T193555Z-31dbc0be`. No S3 bucket was created.
