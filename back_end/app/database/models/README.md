OK!!! So we have the following datastructures

_USER_
users:
    user_id(p-key), 
    email, 
    email_verified_at, 
    created_at,
    cognito_id UNIQUE, 

profiles:
    user_id(f-key/p-key), 
    user_name UNIQUE, 
    display_name, 
    description, 
    profile_photo_key,
    major

user_role:
    user_id(f-key/p-key),
    role(p-key),                -- developer, maps_administrator

_MESSAGING PLATFORM_
chats:
    chat_id(p-key), 
    title,
    type,                       -- global, direct, group
    created_at

messages:
    message_id(p-key), 
    chat_id(f-key), 
    sender(f-key to user: user_id),
    kind,                       --message, system, availability_share, schedule_share, meeting_share, image_share
    created_at,
    edited_at,
    deleted_at,
    body,
    version

message_revisions:
    message_id (f-key)
    version
    body
    edited_by (f-key to user: user_id)
    saved_at
    PRIMARY KEY(message_id, version)

chat_members (relation between chat and user):
    user_id(f-key/p-key), 
    chat_id(f-key/p-key), 
    role,                       -- member, moderator, owner
    joined_at

_SCHEDULE_
terms:
    term_id(p-key), 
    year, 
    season, 
    starts_on, 
    ends_on,
    timezone,
    UNIQUE(year,season)

schedules:
    schedule_id(p-key)
    user_id(f-key),
    term_id(f-key),
    UNIQUE(user_id, term_id)

events:
    event_id(p-key), 
    schedule_id(foreign_key), 
    title,
    description


event_meetings:                 -- events can be recurring or one off
    meeting_id(p-key)
    event_id(f-key),
    starts_at, 
    ends_at,
    location_label,
    building_id(f-key to building: building_id),
    location_point

_RSO_
rsos:
    rso_id (p-key), 
    name,
    description, 
    rso_url, 
    email,
    phone,
    location,
    rso_chat_id(f-key)
rso_members:
    rso_id(f-key/p-key), 
    user_id(f-key, p-key), 
    role,                       -- president, treasurer, member, etc
    moderator,                  -- can perform administrative tasks
    confirmed_by,
    status                      -- pending, active



The following probably aren't needed
_MAP_
buidlings:
    building_id(p-key),
building_name (some buildings have mulitple names 1:N):
    building_id(f-key/p-key), building_name(p-key)


entrances:
    entrance_id(p-key), building_id(f-key), 
paths:
hazards:

