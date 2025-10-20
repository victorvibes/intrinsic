#!/usr/bin/env bash
set -euo pipefail

TAG_PREFIX="v" 

need() { command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing: $1"; exit 1; }; }
need git
need npm

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

read -rp "Commit message: " MSG
[[ -z "$MSG" ]] && { echo "❌ Commit message required"; exit 1; }
git add -A
git commit -m "$MSG"

echo "Select version bump:"
select BUMP in "patch" "minor" "major"; do
  case "$BUMP" in
    patch|minor|major) break ;;
    *) echo "Invalid choice";;
  esac
done

# updates package.json, creates tag & release commit
npm version "$BUMP" -m "chore(release): %s"

NEW_VER=$(node -p "require('./package.json').version")
NEW_TAG="${TAG_PREFIX}${NEW_VER}"

echo "→ New version: ${NEW_VER}  (tag: ${NEW_TAG})"

git push origin "$CURRENT_BRANCH" --follow-tags

if command -v gh >/dev/null 2>&1; then
  echo "→ Creating GitHub Release ${NEW_TAG} (auto notes)…"
  gh release create "${NEW_TAG}" --title "${NEW_TAG}" --generate-notes
  echo "✅ GitHub Release created."
else
  echo "⚠️  'gh' CLI not found."
fi

echo "🎉 Done."
