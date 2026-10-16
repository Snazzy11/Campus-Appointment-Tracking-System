def public_profile(user):
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "avatar_url": f"/api/avatars/{user.avatar_key}" if user.avatar_key else None,
    }


def account_profile(user):
    return {**public_profile(user), "authenticated": True, "sub": user.cognito_sub,
            "email": user.email, "bio": user.bio, "updated_at": user.updated_at}
