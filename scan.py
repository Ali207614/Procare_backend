import os
import re

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()

                # Check for array.map(x => array2.find(y => ...)) or similar
                if re.search(r'\.(map|forEach|filter)\s*\([\s\S]*?\.(find|filter)\s*\(', content):
                    print(f"Potential O(N^2) in {path} using map/find")

                if re.search(r'for\s*\([\s\S]*?\.(find|filter)\s*\(', content):
                    print(f"Potential O(N^2) in {path} using for/find")
