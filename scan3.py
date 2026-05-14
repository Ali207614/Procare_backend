import os
import re

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.ts') and 'spec' not in file:
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()

                # Simple check for `.find` inside a `for` loop
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    if '.find(' in line:
                        for j in range(max(0, i-10), i):
                            if 'for (' in lines[j] or '.map(' in lines[j]:
                                print(f"File: {path}:{i+1} : {line.strip()}")
                                break
