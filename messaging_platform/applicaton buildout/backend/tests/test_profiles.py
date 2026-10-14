import base64
from io import BytesIO

import pytest
from PIL import Image
from sqlalchemy.orm import Session

from app.services import avatars
from test_mobile_api import client as client, login


@pytest.fixture(autouse=True)
def local_photos(tmp_path, monkeypatch):
    monkeypatch.delenv('AVATAR_S3_BUCKET', raising=False)
    monkeypatch.setenv('AVATAR_LOCAL_DIR', str(tmp_path))
    monkeypatch.setenv('COOKIE_SECURE', 'false')


def photo():
    output = BytesIO()
    image = Image.new('RGB', (800, 600), 'green')
    exif = Image.Exif()
    exif[270] = 'Private metadata'
    image.save(output, 'JPEG', exif=exif)
    return base64.b64encode(output.getvalue())


def test_profile_identity_and_case_insensitive_uniqueness(client):
    alice, before = login(client, 'alice')
    bob, other = login(client, 'bob')
    saved = client.post('/api/me/profile', headers=alice, json={'username': '  Carter_1 ', 'display_name': ' Carter ', 'bio': ' Hi there '})
    assert saved.status_code == 200
    assert saved.json()['username'] == 'carter_1'
    assert saved.json()['display_name'] == 'Carter'
    assert saved.json()['bio'] == 'Hi there'
    assert saved.json()['id'] == before['id'] and saved.json()['sub'] == before['sub']
    assert saved.json()['email'] == before['email']
    assert client.post('/api/me/profile', headers=bob, json={'username': 'CARTER_1', 'bio': 'must rollback'}).status_code == 409
    assert client.get('/api/me', headers=bob).json()['bio'] == ''
    assert client.get('/api/me', headers=bob).json()['id'] == other['id']
    assert client.get('/api/me', headers=alice).json()['username'] == 'carter_1'


@pytest.mark.parametrize('payload', [
    {'username': 'ab'}, {'username': 'a b'}, {'username': 'x'*31},
    {'display_name': 'x'*81}, {'bio': 'x'*301}, {'email': 'other@test'},
    {'id': 2}, {'avatar_key': 'evil.jpg'}, {'bio': '\x00'},
])
def test_profile_validation(client, payload):
    headers, _ = login(client, 'alice')
    assert client.post('/api/me/profile', headers=headers, json=payload).status_code == 422


def test_profile_writes_require_bearer_and_only_edit_self(client):
    alice, _ = login(client, 'alice')
    bob, b = login(client, 'bob')
    assert client.post('/api/me/profile', json={'bio': 'no'}).status_code == 401
    client.cookies.set('campus_session', alice['Authorization'].split()[1])
    assert client.post('/api/me/profile', json={'bio': 'no'}).status_code == 401
    assert client.post('/api/me/avatar', content=photo()).status_code == 401
    assert client.post('/api/me/avatar/remove').status_code == 401
    assert client.post('/api/me/profile', headers=alice, json={'id': b['id'], 'bio': 'no'}).status_code == 422
    assert client.get('/api/me', headers=bob).json()['bio'] == ''


def test_photo_roundtrip_strips_metadata_replaces_and_removes(client, tmp_path):
    headers, _ = login(client, 'alice')
    response = client.post('/api/me/avatar', headers=headers, content=photo())
    assert response.status_code == 200, response.text
    url = response.json()['avatar_url']
    served = client.get(url)
    assert served.headers['content-type'] == 'image/jpeg'
    normalized = Image.open(BytesIO(served.content))
    assert normalized.size == (512, 512) and not normalized.getexif()
    second = client.post('/api/me/avatar', headers=headers, content=photo())
    assert second.status_code == 200 and second.json()['avatar_url'] != url
    assert client.get(url).status_code == 404
    assert len(list(tmp_path.glob('*.jpg'))) == 1
    assert client.post('/api/me/avatar/remove', headers=headers).json()['avatar_url'] is None
    assert client.get(second.json()['avatar_url']).status_code == 404
    assert not list(tmp_path.glob('*.jpg'))


def test_invalid_large_and_animated_uploads_leave_previous_photo(client):
    headers, _ = login(client, 'alice')
    url = client.post('/api/me/avatar', headers=headers, content=photo()).json()['avatar_url']
    assert client.post('/api/me/avatar', headers=headers, content=b'not base64').status_code == 422
    assert client.post('/api/me/avatar', headers=headers, content=base64.b64encode(b'<svg/>')).status_code == 422
    assert client.post('/api/me/avatar', headers=headers, content=b'A'*(avatars.MAX_ENCODED+1)).status_code == 413
    out = BytesIO()
    Image.new('RGB', (10, 10), 'red').save(out, 'GIF', save_all=True, append_images=[Image.new('RGB', (10, 10), 'blue')])
    assert client.post('/api/me/avatar', headers=headers, content=base64.b64encode(out.getvalue())).status_code == 422
    assert client.get('/api/me', headers=headers).json()['avatar_url'] == url
    assert client.get(url).status_code == 200


def test_failed_photo_commit_cleans_new_object_and_keeps_old(client, monkeypatch, tmp_path):
    headers, _ = login(client, 'alice')
    url = client.post('/api/me/avatar', headers=headers, content=photo()).json()['avatar_url']
    def fail(self):
        raise RuntimeError('commit failed')
    with monkeypatch.context() as patch:
        patch.setattr(Session, 'commit', fail)
        with pytest.raises(RuntimeError, match='commit failed'):
            client.post('/api/me/avatar', headers=headers, content=photo())
    assert client.get('/api/me', headers=headers).json()['avatar_url'] == url
    assert len(list(tmp_path.glob('*.jpg'))) == 1


def test_cloud_without_bucket_fails_without_losing_profile(client, monkeypatch):
    headers, _ = login(client, 'alice')
    monkeypatch.setenv('COOKIE_SECURE', 'true')
    monkeypatch.delenv('AVATAR_LOCAL_DIR')
    assert client.post('/api/me/avatar', headers=headers, content=photo()).status_code == 503
    assert client.post('/api/me/profile', headers=headers, json={'bio': 'Still works'}).status_code == 200


def test_member_profiles_exclude_login_details_and_history_uses_current_name(client):
    alice, a = login(client, 'alice')
    bob, b = login(client, 'bob')
    group = client.post('/api/conversations', headers=alice, json={'recipient_id': b['id']}).json()
    path = f'/api/conversations/{group["id"]}/messages'
    client.post(path, headers=alice, json={'text': 'Before rename'})
    client.post('/api/data', headers=alice, json={'text': 'Public before rename'})
    client.post('/api/me/profile', headers=alice, json={'display_name': 'New name', 'bio': 'My bio'})
    profile = client.get(f'/api/users/{a["id"]}/profile', headers=bob).json()
    assert profile['bio'] == 'My bio' and 'email' not in profile and 'sub' not in profile
    assert client.get(f'/api/users/{a["id"]}/profile').status_code == 401
    assert client.get(path, headers=bob).json()[0]['profile']['display_name'] == 'New name'
    assert client.get('/api/data').json()[0]['profile']['display_name'] == 'New name'
    assert client.get('/api/conversations', headers=bob).json()[0]['members'][0]['display_name'] == 'New name'


def test_s3_storage_uses_private_encrypted_objects_and_cleanup(client, monkeypatch):
    objects = {}
    class FakeS3:
        def put_object(self, **kwargs):
            assert kwargs['Bucket'] == 'test-bucket'
            assert kwargs['ServerSideEncryption'] == 'AES256'
            assert kwargs['ContentType'] == 'image/jpeg' and 'ACL' not in kwargs
            assert kwargs['Key'].startswith('avatars/')
            objects[kwargs['Key']] = kwargs['Body']
        def get_object(self, **kwargs):
            return {'Body': BytesIO(objects[kwargs['Key']])}
        def delete_object(self, **kwargs):
            objects.pop(kwargs['Key'])
    monkeypatch.setenv('AVATAR_S3_BUCKET', 'test-bucket')
    monkeypatch.setattr(avatars.boto3, 'client', lambda *args, **kwargs: FakeS3())
    headers, _ = login(client, 'alice')
    upload = client.post('/api/me/avatar', headers=headers, content=photo())
    assert upload.status_code == 200
    assert client.get(upload.json()['avatar_url']).status_code == 200
    assert client.post('/api/me/avatar/remove', headers=headers).status_code == 200
    assert objects == {}


def test_https_with_explicit_persistent_directory_supports_photos(client, monkeypatch):
    monkeypatch.setenv('COOKIE_SECURE', 'true')
    headers, _ = login(client, 'alice')
    result = client.post('/api/me/avatar', headers=headers, content=photo())
    assert result.status_code == 200
    assert client.get(result.json()['avatar_url']).status_code == 200
