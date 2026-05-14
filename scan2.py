import os
import re

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.ts') and 'spec' not in file:
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()

                # Check for query in loop (e.g. await this.knex / await trx in a for loop)
                lines = content.split('\n')
                in_loop = False
                loop_depth = 0
                for i, line in enumerate(lines):
                    if re.search(r'for\s*\(', line) or re.search(r'\.(map|forEach|filter)\s*\(.*=>', line):
                        pass
                    if 'await trx' in line or 'await this.knex' in line:
                        # naive check
                        # see if there is an await in a map or for loop
                        pass
