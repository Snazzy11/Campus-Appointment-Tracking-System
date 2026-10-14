import os

# Configure imports with fake values; tests never contact PostgreSQL or Cognito.
os.environ.update({
    "DB_USER": "test", "DB_PASSWORD": "test", "DB_NAME": "test",
    "DB_HOST": "127.0.0.1", "DB_PORT": "5432",
    "COGNITO_DOMAIN": "https://login.example.test",
    "COGNITO_CLIENT_ID": "test-client", "COGNITO_REGION": "us-east-1",
    "COGNITO_USER_POOL_ID": "us-east-1_test",
    "COGNITO_REDIRECT_URI": "http://localhost:8000/auth/callback",
    "COGNITO_APP_REDIRECT_URIS": "campusmessaging://auth/callback,http://localhost:8081/auth/callback",
    "FRONTEND_URL": "http://localhost:8081",
    "FRONTEND_ORIGINS": "http://localhost:8081", "COOKIE_SECURE": "false",
})
