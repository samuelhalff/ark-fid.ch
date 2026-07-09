#!/bin/bash
# Run codex review on the last commit
cd /home/sam/dev/ark-fid.ch
exec /home/sam/.local/bin/codex review --commit HEAD - < /home/sam/dev/ark-fid.ch/scripts/codex-review-prompt.txt
