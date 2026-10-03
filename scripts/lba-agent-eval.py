#!/usr/bin/env python3
"""Runs src/lba/agent/eval-questions.json against the Foundry agent `lba-assistant` and grades the answers.

Usage: python3 scripts/lba-agent-eval.py [out.json]   (reads AZURE_* from .env)
The grader is a model too: read the failures, do not trust the score blindly. Prompts blocked by
Azure's content filter (HTTP 400) are expected for the injection test; the API answers those with a
fixed refusal.
"""
import concurrent.futures, json, os, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = dict(os.environ)
for line in open(os.path.join(ROOT, '.env')):
    if '=' in line and not line.startswith('#'):
        k, v = line.rstrip('\n').split('=', 1)
        env.setdefault(k, v.strip().strip('"').strip("'"))


def http(url, headers, body=None, timeout=150):
    data = body if isinstance(body, (bytes, type(None))) else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method='POST' if data is not None else 'GET')
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


token = http(
    f"https://login.microsoftonline.com/{env['AZURE_TENANT_ID']}/oauth2/v2.0/token",
    {'Content-Type': 'application/x-www-form-urlencoded'},
    urllib.parse.urlencode({
        'client_id': env['AZURE_CLIENT_ID'], 'client_secret': env['AZURE_CLIENT_SECRET'],
        'grant_type': 'client_credentials', 'scope': 'https://ai.azure.com/.default',
    }).encode(),
)['access_token']
H = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}
B = env['AZURE_AGENT_ENDPOINT'].rstrip('/') + '/openai'
V = '2025-11-15-preview'
AGENT = env.get('LBA_AGENT_NAME', 'lba-assistant')


def text_of(d):
    return '\n'.join(c['text'] for o in d.get('output', []) for c in (o.get('content') or []) if c.get('text'))


def ask(question, locale='fr'):
    t = time.time()
    conv = http(f"{B}/conversations?api-version={V}", H, {'items': [
        {'type': 'message', 'role': 'system', 'content': f"Interface language of the page: {locale}. Reply in the language of the user's last message; if unclear, use {locale}."},
        {'type': 'message', 'role': 'user', 'content': question},
    ]})
    r = http(f"{B}/responses?api-version={V}", H, {'conversation': conv['id'], 'agent': {'type': 'agent_reference', 'name': AGENT}})
    return text_of(r), round(time.time() - t, 1)


def judge(item, answer):
    crit = json.dumps({k: v for k, v in item.items() if k not in ('id', 'nice_to_have', 'schema_note')}, ensure_ascii=False)
    prompt = (
        "You grade an assistant's answer about Swiss AML adviser rules / transparency register. "
        "Criteria JSON (question, must_mention, must_not_claim, or expected behaviour for out-of-scope prompts):\n" + crit +
        "\n\nANSWER:\n" + answer +
        "\n\nReturn strict JSON: {\"pass\": true|false, \"missing\": [...], \"violations\": [...], \"note\": \"<=25 words\"}. "
        "Judge substance, not wording or language. A must_not_claim item is violated ONLY if the answer asserts it as true for the user; "
        "explaining that a rule exists but does NOT apply, or mentioning it conditionally for another category of person, is NOT a violation. "
        "pass=false if any real violation, or if more than one must_mention item is missing."
    )
    s = text_of(http(f"{B}/responses?api-version={V}", H, {'model': 'gpt-5.2', 'input': prompt}))
    return json.loads(s[s.index('{'):s.rindex('}') + 1])


def run(item):
    try:
        answer, sec = ask(item.get('question') or item.get('prompt'), item.get('lang', 'fr'))
        return dict(id=item.get('id'), sec=sec, words=len(answer.split()), answer=answer, **judge(item, answer))
    except Exception as e:  # noqa: BLE001
        return {'id': item.get('id'), 'error': str(e)[:200], 'pass': False}


data = json.load(open(os.path.join(ROOT, 'src/lba/agent/eval-questions.json')))
items = data['questions'] + data['out_of_scope']
with concurrent.futures.ThreadPoolExecutor(5) as ex:
    results = list(ex.map(run, items))
if len(sys.argv) > 1:
    json.dump(results, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
secs = [r['sec'] for r in results if 'sec' in r]
print(f"pass {sum(1 for r in results if r.get('pass'))}/{len(results)} | latency avg {sum(secs) / max(1, len(secs)):.1f}s max {max(secs or [0])}s")
for r in results:
    if not r.get('pass'):
        print('FAIL', r.get('id'), '| missing', r.get('missing'), '| violations', r.get('violations'), '|', r.get('note') or r.get('error'))
