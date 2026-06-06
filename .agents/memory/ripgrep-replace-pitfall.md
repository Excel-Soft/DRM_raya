---
name: ripgrep -r flag mangles output
description: Why `rg -rn`/`rg -rc` produces garbage like "n"/"co" in this repo's greps
---

# ripgrep `-r` is --replace, not recursive

In ripgrep, `-r` means `--replace <TEXT>`, NOT "recursive" (rg recurses by
default). Writing `rg -rn 'pattern' dir` consumes `n` as the replacement string,
so every match is rewritten to `n` and the displayed output is garbage
(e.g. headers show `Content-Type","n"`, `.cotification-service`). This wasted
time twice in this project.

**Why:** muscle memory from `grep -rn`. grep needs `-r` to recurse; ripgrep does
not.

**How to apply:** to read real file content, use plain `rg -n 'pattern' path`
(no `-r`) or `grep -rn`. Reserve `rg -r` only when you actually want
search-and-replace preview.
