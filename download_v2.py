import urllib.request
import urllib.parse
import re
import os
import time

searches = {
    "ambiance": ["ambient", "forest", "wind", "water"],
    "npc": ["monster", "creature", "orc", "skeleton", "zombie", "bat", "dragon"]
}

download_root = "/Users/anaibol/Workspace/polypoll/abraxas/apps/client/public/audio"
os.makedirs(os.path.join(download_root, "ambiance"), exist_ok=True)
os.makedirs(os.path.join(download_root, "npc"), exist_ok=True)

def download_oga(query, category):
    encoded_query = urllib.parse.quote(query)
    # Search for CC-BY-3.0 (17) and CC0 (2) to get more results
    url = f"https://opengameart.org/art-search-advanced?keys={encoded_query}&field_art_type_tid%5B%5D=13&field_art_licenses_tid%5B%5D=2&field_art_licenses_tid%5B%5D=4&sort_by=score&sort_order=DESC"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode()
            # Look for any link that looks like a file download
            links = re.findall(r'href="(/sites/default/files/[^"]+\.ogg)"', html)
            if not links:
                links = re.findall(r'href="(/sites/default/files/[^"]+\.mp3)"', html)
            
            count = 0
            for link in links:
                if count >= 3: break
                full_url = "https://opengameart.org" + link
                filename = os.path.basename(link)
                # Cleanup filename
                filename = f"{query}_{count}_{filename}"
                filepath = os.path.join(download_root, category, filename)
                
                if not os.path.exists(filepath):
                    print(f"Downloading {filename} to {category}...")
                    try:
                        dl_req = urllib.request.Request(full_url, headers={"User-Agent": "Mozilla/5.0"})
                        with urllib.request.urlopen(dl_req) as dl_resp:
                            with open(filepath, 'wb') as f:
                                f.write(dl_resp.read())
                        print("Success.")
                        count += 1
                        time.sleep(1)
                    except:
                        print(f"Failed to download {full_url}")
                        continue
    except Exception as e:
        print(f"Error searching {query}: {e}")

for cat, queries in searches.items():
    for q in queries:
        download_oga(q, cat)

print("Finished second attempt.")
