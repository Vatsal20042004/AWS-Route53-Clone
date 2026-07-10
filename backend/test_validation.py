"""Quick smoke-test for DNS record value validation."""
import urllib.request, json, http.cookiejar

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

# Login
data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode()
req = urllib.request.Request(
    'http://localhost:8000/auth/login', data=data,
    headers={'Content-Type': 'application/json'}, method='POST'
)
opener.open(req)

# Get first zone id
req2 = urllib.request.Request('http://localhost:8000/hosted-zones')
zone_id = json.loads(opener.open(req2).read())['data'][0]['id']
print(f"Using zone: {zone_id}\n")

def post_record(payload):
    raw = json.dumps(payload).encode()
    req = urllib.request.Request(
        f'http://localhost:8000/hosted-zones/{zone_id}/records',
        data=raw, headers={'Content-Type': 'application/json'}, method='POST'
    )
    try:
        r = opener.open(req)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

PASS = "[PASS]"
FAIL = "[FAIL]"

# 1. Bad A record
code, body = post_record({'name': 'badtest.example.com', 'type': 'A', 'value': 'hello', 'ttl': 300})
assert code == 422, f"Expected 422, got {code}"
print(f"{PASS} A 'hello' rejected -> {body['detail']}")

# 2. Good A record
code, body = post_record({'name': 'goodtest.example.com', 'type': 'A', 'value': '192.0.2.99', 'ttl': 300})
assert code == 201, f"Expected 201, got {code}"
print(f"{PASS} A '192.0.2.99' accepted -> id={body['id']}")

# 3. Bad CAA (missing quotes)
code, body = post_record({'name': 'example.com', 'type': 'CAA', 'value': '0 issue letsencrypt.org', 'ttl': 3600})
assert code == 422, f"Expected 422, got {code}"
print(f"{PASS} CAA without quotes rejected -> {body['detail'][:80]}")

# 4. Good CAA (with quotes)
code, body = post_record({'name': 'example.com', 'type': 'CAA', 'value': '0 issue "letsencrypt.org"', 'ttl': 3600})
assert code == 201, f"Expected 201, got {code}"
print(f"{PASS} CAA with quotes accepted -> {body['value']}")

# 5. Bad AAAA
code, body = post_record({'name': 'ipv6test.example.com', 'type': 'AAAA', 'value': 'not-an-ipv6', 'ttl': 300})
assert code == 422, f"Expected 422, got {code}"
print(f"{PASS} AAAA 'not-an-ipv6' rejected -> {body['detail'][:70]}")

# 6. Good AAAA
code, body = post_record({'name': 'ipv6ok.example.com', 'type': 'AAAA', 'value': '2001:db8::1', 'ttl': 300})
assert code == 201, f"Expected 201, got {code}"
print(f"{PASS} AAAA '2001:db8::1' accepted -> id={body['id']}")

print("\nAll tests passed!")
