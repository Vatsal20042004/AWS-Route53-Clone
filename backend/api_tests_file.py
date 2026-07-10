import urllib.request
import json
import http.cookiejar
import urllib.error
import sys

with open("results.txt", "w") as f:
    sys.stdout = f

    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    def raw_post(url, data, method="POST"):
        req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'}, method=method)
        try:
            r = opener.open(req)
            return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def get(url):
        req = urllib.request.Request(url)
        r = opener.open(req)
        return r.status, json.loads(r.read())

    def delete(url):
        req = urllib.request.Request(url, method="DELETE")
        try:
            r = opener.open(req)
            return r.status, None
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    # Login
    raw_post('http://localhost:8000/auth/login', {"username": "admin", "password": "admin123"})
    _, zones_res = get('http://localhost:8000/hosted-zones')
    zone_id = zones_res['data'][0]['id']

    def test(name, typ, value, prio=None, wt=None, port=None):
        payload = {"name": name, "type": typ, "value": value, "ttl": 300}
        if prio is not None: payload['priority'] = prio
        if wt is not None: payload['weight'] = wt
        if port is not None: payload['port'] = port
        return raw_post(f'http://localhost:8000/hosted-zones/{zone_id}/records', payload)

    print("BACKEND API TESTS")
    print("="*50)
    tests = [
        ("A bad string", "A", "hello"),
        ("A valid", "A", "192.0.2.1"),
        ("A out of range", "A", "999.999.999.999"),
        ("AAAA bad", "AAAA", "hello"),
        ("AAAA valid", "AAAA", "2001:db8::1"),
        ("CNAME bad space", "CNAME", "hello world"),
        ("CNAME valid", "CNAME", "target.example.com"),
        ("MX missing prio", "MX", "mail.test.com"),
        ("MX prio out of range", "MX", "mail.test.com", 70000),
        ("MX valid", "MX", "mail.test.com", 10),
        ("SRV missing port", "SRV", "sip.test.com", 10, 20),
        ("SRV port out of range", "SRV", "sip.test.com", 10, 20, 99999),
        ("SRV valid", "SRV", "sip.test.com", 10, 20, 5060),
        ("CAA missing quotes", "CAA", "issue letsencrypt.org"),
        ("CAA valid", "CAA", "0 issue \"letsencrypt.org\""),
        ("TXT valid", "TXT", "hello world testing"),
        ("NS bad space", "NS", "ns1 .com"),
        ("NS valid", "NS", "ns1.example.com"),
        ("PTR valid", "PTR", "reverse.example.com")
    ]

    created_records = []
    for title, typ, val, *args in tests:
        prio = args[0] if len(args) > 0 else None
        wt = args[1] if len(args) > 1 else None
        port = args[2] if len(args) > 2 else None
        code, res = test("test.com", typ, val, prio, wt, port)
        
        if code == 201:
            created_records.append((res['id'], typ, val))

        detail = res.get('detail', 'Success') if isinstance(res, dict) else res
        print(f"{title:25} -> Status: {code} | Detail: {detail}")

    print("\nREGRESSION: EDITING")
    print("="*50)
    if created_records:
        rec_id, typ, old_value = created_records[0]
        # Edit to invalid
        code, res = raw_post(f'http://localhost:8000/hosted-zones/{zone_id}/records/{rec_id}', {"value": "invalid edit"}, method="PUT")
        print(f"Edit {typ} to invalid string -> Status: {code} | Detail: {res.get('detail', 'Success')}")

        # Edit to valid
        new_val = "1.1.1.1" if typ == "A" else "edited.com"
        code, res = raw_post(f'http://localhost:8000/hosted-zones/{zone_id}/records/{rec_id}', {"value": new_val}, method="PUT")
        print(f"Edit {typ} to valid string   -> Status: {code} | Detail: {res.get('detail', 'Success')}")

    print("\nREGRESSION: DELETING")
    print("="*50)
    if created_records:
        rec_id, _, _ = created_records[0]
        code, _ = delete(f'http://localhost:8000/hosted-zones/{zone_id}/records/{rec_id}')
        print(f"Delete record -> Status: {code}")

    print("\nREGRESSION: ZONE CRUD")
    print("="*50)
    code, res = raw_post('http://localhost:8000/hosted-zones', {"name": "testsuite.com", "type": "Public"})
    print(f"Create Zone -> Status: {code}")
    if code == 201:
        z_id = res['id']
        code, res = raw_post(f'http://localhost:8000/hosted-zones/{z_id}', {"comment": "updated"}, method="PUT")
        print(f"Update Zone -> Status: {code}")
        code, _ = delete(f'http://localhost:8000/hosted-zones/{z_id}')
        print(f"Delete Zone -> Status: {code}")
