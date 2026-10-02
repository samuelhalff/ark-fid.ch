#!/usr/bin/env python3
"""Send one article to the Zapier webhook that publishes it on LinkedIn.

Usage: notify-linkedin.py <slug>   (reads title/description from src/translations/fr/ressources.json)
   or: ARTICLE_SLUG / ARTICLE_TITLE / ARTICLE_DESCRIPTION in the environment (article pipeline).
Optional: UNSPLASH_ACCESS_KEY for the illustration.
Used by the AI article workflow and by linkedin-new-article.yml (articles committed by hand).
"""
import json
import os
import sys
import urllib.request

WEBHOOK = 'https://hooks.zapier.com/hooks/catch/3870740/u06k73r/'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main() -> int:
    slug = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('ARTICLE_SLUG', '')
    title = os.environ.get('ARTICLE_TITLE', '')
    description = os.environ.get('ARTICLE_DESCRIPTION', '')
    if not slug:
        print('No article slug given')
        return 1
    if not title:
        with open(os.path.join(ROOT, 'src/translations/fr/ressources.json'), encoding='utf-8') as f:
            articles = json.load(f).get('Articles', [])
        article = next((a for a in articles if a.get('slug') == slug), None)
        if article is None:
            print(f'Article not found: {slug}')
            return 1
        title = article.get('title', '')[:400]
        description = article.get('description', '')[:4086]
    article_url = f'https://ark-fid.ch/fr/ressources/articles/{slug}/'

    image_url = ''
    unsplash_key = os.environ.get('UNSPLASH_ACCESS_KEY', '')
    if unsplash_key:
        try:
            req = urllib.request.Request(
                'https://api.unsplash.com/photos/random?query=Switzerland+landscape&orientation=landscape',
                headers={'Authorization': f'Client-ID {unsplash_key}', 'Accept-Version': 'v1'},
            )
            with urllib.request.urlopen(req, timeout=15) as r:
                image_url = json.loads(r.read().decode('utf-8')).get('urls', {}).get('regular', '')
        except Exception as e:  # the post still goes out without an image
            print(f'⚠️ Unsplash error: {e}')

    if len(description) > 200:
        truncated = description[:200].rsplit(' ', 1)[0]
        last_end = max(truncated.rfind('.'), truncated.rfind('!'), truncated.rfind('?'))
        summary = truncated[:last_end + 1] if last_end > 0 else truncated + '…'
    else:
        summary = description
    if summary:
        sep = ' ' if summary[-1:] in '.!?' else '. '
        comment = f"{summary}{sep}Découvrez l'article complet sur Ark Fiduciaire →"
    else:
        comment = f'Découvrez notre dernier article : {title} →'

    payload = json.dumps({
        'title': title, 'url': article_url, 'description': description,
        'image_url': image_url, 'comment': comment,
    }).encode('utf-8')
    if os.environ.get('DRY_RUN'):
        print(payload.decode('utf-8'))
        return 0
    req = urllib.request.Request(WEBHOOK, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f'✅ Zapier webhook sent for {slug} (status: {resp.status})')
        return 0
    except Exception as e:
        print(f'⚠️ Zapier webhook error: {e}')
        return 1


if __name__ == '__main__':
    sys.exit(main())
