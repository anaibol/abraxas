import urllib.request
import urllib.parse
import re
import os
import time

# Targeted high-quality OGA items for ambiance and creatures
items = {
    "ambiance": [
        "https://opengameart.org/content/ambient-wind",
        "https://opengameart.org/content/night-forest-ambience",
        "https://opengameart.org/content/cave-ambiance",
        "https://opengameart.org/content/ocean-sounds"
    ],
    "npc": [
        "https://opengameart.org/content/monster-grunt-pack",
        "https://opengameart.org/content/skeleton-sounds",
        "https://opengameart.org/content/zombie-groans",
        "https://opengameart.org/content/creature-sfx-pack"
    ]
}

download_root = "/Users/anaibol/Workspace/polypoll/abraxas/apps/client/public/audio"
os.makedirs(os.path.join(download_root, "ambiance"), exist_ok=True)
os.makedirs(os.path.join(download_root, "npc"), exist_ok=True)

def download_from_page(url, category):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode()
            # Find download links in the file list table
            links = re.findall(r'href="([^"]+\.(?:ogg|mp3|wav))"', html)
            
            count = 0
            for link in links:
                if count >= 3: break
                if "/sites/default/files/" not in link: continue
                
                full_url = link if link.startswith("http") else "https://opengameart.org" + link
                filename = os.path.basename(link)
                filepath = os.path.join(download_root, category, filename)
                
                if not os.path.exists(filepath):
                    print(f"Downloading {filename} to {category}...")
                    try:
                        dl_req = urllib.request.Request(full_url, headers={"User-Agent": "Mozilla/5.0"})
                        with urllib.request.urlopen(dl_req) as dl_resp:
                            with open(filepath, 'wb') as f:
                                f.write(dl_resp.read())
                        print(f"Successfully downloaded {filename}")
                        count += 1
                        time.sleep(1)
                    except Exception as e:
                        print(f"Failed to download {full_url}: {e}")
    except Exception as e:
        print(f"Error accessing {url}: {e}")

for cat, urls in items.items():
    for url in urls:
        download_from_page(url, cat)

print("Finished third attempt.")
