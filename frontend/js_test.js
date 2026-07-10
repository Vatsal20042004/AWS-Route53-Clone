const fs = require('fs');

const HOSTNAME_RE = /^(?!-)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_RE = /^([\da-fA-F]{0,4}:){2,7}[\da-fA-F]{0,4}$|^::[\da-fA-F]{0,4}$|^[\da-fA-F]{0,4}::$/;
const CAA_RE = /^(0|128)\s+(issue|issuewild|iodef)\s+"[^"]+"$/;

function isValidIPv4(v) {
    const m = IPV4_RE.exec(v.trim());
    if (!m) return false;
    return [m[1], m[2], m[3], m[4]].every(n => parseInt(n) >= 0 && parseInt(n) <= 255);
}

function isValidIPv6(v) {
    const s = v.trim();
    const segments = s.split(':');
    if (s.includes('::')) {
        if ((s.match(/::/g) || []).length > 1) return false;
        return segments.length <= 8;
    }
    return segments.length === 8 && segments.every(seg => /^[\da-fA-F]{0,4}$/.test(seg));
}

function isValidHostname(v) {
    return HOSTNAME_RE.test(v.trim()) && v.trim().length <= 253;
}

function validateValue(type, value) {
    const v = value.trim();
    if (!v) return '';

    switch (type) {
        case 'A': return !isValidIPv4(v) ? "Error: Invalid IPv4" : "";
        case 'AAAA': return !isValidIPv6(v) ? "Error: Invalid IPv6" : "";
        case 'CNAME':
        case 'MX':
        case 'NS':
        case 'PTR':
        case 'SRV': return !isValidHostname(v) ? "Error: Invalid hostname" : "";
        case 'TXT': return v.length > 255 ? "Error: Max 255 chars" : "";
        case 'CAA': return !CAA_RE.test(v) ? "Error: Invalid CAA format" : "";
    }
    return '';
}

const tests = [
    { name: "A record: try value 'hello'", type: "A", val: "hello" },
    { name: "A record: try value '192.0.2.1'", type: "A", val: "192.0.2.1" },
    { name: "A record: try '999.999.999.999'", type: "A", val: "999.999.999.999" },
    { name: "AAAA record: try 'hello'", type: "AAAA", val: "hello" },
    { name: "AAAA record: try '2001:db8::1'", type: "AAAA", val: "2001:db8::1" },
    { name: "CNAME record: try 'hello world'", type: "CNAME", val: "hello world" },
    { name: "CNAME record: try 'target.example.com'", type: "CNAME", val: "target.example.com" },
    { name: "CAA record: try 'issue letsencrypt.org'", type: "CAA", val: "issue letsencrypt.org" },
    { name: "CAA record: try '0 issue \"letsencrypt.org\"'", type: "CAA", val: "0 issue \"letsencrypt.org\"" },
    { name: "TXT record: try 'normal string'", type: "TXT", val: "hello world" },
    { name: "NS record: valid", type: "NS", val: "ns1.example.com" },
    { name: "NS record: space", type: "NS", val: "ns1 .example.com" },
];

let res = "FRONTEND VALIDATION TESTS\n========================================\n";
for (const t of tests) {
    const r = validateValue(t.type, t.val) || "success";
    res += `${t.name.padEnd(55)} -> UI Result: ${r}\n`;
}

fs.writeFileSync('js_test_results.txt', res);
