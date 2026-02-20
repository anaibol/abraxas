import urllib.request
import urllib.parse
import re
import os
import time

# Categories to search
searches = {
    "ambiance": ["forest ambiance", "cave ambiance", "ocean waves ambiance", "wind ambiance"],
    "npc": ["monster growl", "skeleton rattle", "zombie groan", "bat screech", "monster roar"]
}

download_root = "/Users/anaibol/Workspace/polypoll/abraxas/apps/client/public/audio"
os.makedirs(os.path.join(download_root, "ambiance"), exist_ok=True)
os.makedirs(os.path.join(download_root, "npc"), exist_ok=True)

def download_oga(query, category):
    encoded_query = urllib.parse.quote(query)
    url = f"https://opengameart.org/art-search-advanced?keys={encoded_query}&field_art_type_tid%5B%5D=13&field_art_licenses_tid%5B%5D=2&sort_by=score&sort_order=DESC"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode()
            links = re.findall(r"data-ogg-url='([^']+)'", html)
            # Just take the first 2 good ones for each search to avoid Bloat
            count = 0
            for link in links:
                if count >= 2: break
                if "audio_preview" in link:
                    link = link.replace("/audio_preview/", "/")
                
                filename = f"{query.replace(' ', '_')}_{count}.ogg"
                filepath = os.path.join(download_root, category, filename)
                
                if not os.path.exists(filepath):
                    print(f"Downloading {filename} to {category}...")
                    dl_req = urllib.request.Request(link, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(dl_req) as dl_resp:
                        with open(filepath, 'wb') as f:
                            f.write(dl_resp.read())
                    print("Success.")
                    count += 1
                    time.sleep(1)
    except Exception as e:
        print(f"Error searching {query}: {e}")

for cat, queries in searches.items():
    for q in queries:
        download_oga(q, cat)

print("Finished downloading ambiance and NPC sounds.")
