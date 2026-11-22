#!/bin/bash
set -euo pipefail

bundle='NYX Vox.app'
destination="${HOME}/Applications"
target="$destination/$bundle"
lock="$destination/.nyx-vox-install.lock"

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

check_platform() {
  [[ "$(uname -s)" == Darwin ]] || fail 'NYX Vox requires macOS.'
  [[ "$(uname -m)" == arm64 || "$(sysctl -n hw.optional.arm64 2>/dev/null)" == 1 ]] ||
    fail 'This release supports Apple Silicon Macs.'
}

cleanup() {
  if [[ -f "$workspace/mounted" ]] && ! hdiutil detach "$workspace/dmg" >&2; then
    printf 'Disk image is still mounted at %s/dmg\n' "$workspace" >&2
    rmdir "$lock"
    return 1
  fi
  if [[ -d "$workspace/previous.app" && ! -e "$target" ]]; then
    mv "$workspace/previous.app" "$target" || {
      printf 'Previous installation saved at %s/previous.app\n' "$workspace" >&2
      rmdir "$lock"
      return 1
    }
  fi
  rm -rf -- "$workspace"
  rmdir "$lock"
}

check_existing_app() {
  [[ ! -L "$target" ]] || fail "Refusing to replace a symlink at $target."
  [[ -e "$target" ]] || return 0
  local plistbuddy=/usr/libexec/PlistBuddy
  local installed_id archive_id installed_version
  installed_id=$("$plistbuddy" -c 'Print CFBundleIdentifier' "$target/Contents/Info.plist")
  archive_id=$("$plistbuddy" -c 'Print CFBundleIdentifier' "$workspace/$bundle/Contents/Info.plist")
  [[ "$installed_id" == "$archive_id" ]] || fail "A different application exists at $target."
  installed_version=$("$plistbuddy" -c 'Print CFBundleShortVersionString' "$target/Contents/Info.plist")
  awk -v old="$installed_version" -v new="$version" 'BEGIN {
    if (old !~ /^[0-9]+\.[0-9]+\.[0-9]+$/) exit 1
    split(old, o, "."); split(new, n, ".")
    for (i = 1; i <= 3; i++) {
      if (o[i] + 0 < n[i] + 0) exit 0
      if (o[i] + 0 > n[i] + 0) exit 1
    }
  }' || fail "Installed version $installed_version cannot be replaced with $version."
}

fetch() {
  curl --fail --silent --show-error --location --proto '=https' \
    --proto-redir '=https' --retry 3 "$@"
}

stage_latest_release() {
  local metadata="$workspace/release.json"
  local name digest index=0
  fetch --output "$metadata" 'https://api.github.com/repos/AVP-Dev/nyx-vox/releases/latest'
  version=$(plutil -extract tag_name raw -o - "$metadata")
  [[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail 'Unexpected public release version.'
  version=${version#v}

  while name=$(plutil -extract "assets.$index.name" raw -o - "$metadata" 2>/dev/null); do
    if [[ "$name" == "NYX.Vox_${version}_aarch64.dmg" ]]; then
      break
    fi
    index=$((index + 1))
  done
  [[ "$name" == "NYX.Vox_${version}_aarch64.dmg" ]] || fail 'Apple Silicon disk image is unavailable.'
  digest=$(plutil -extract "assets.$index.digest" raw -o - "$metadata")
  [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || fail 'The disk image checksum is unavailable.'
  fetch --output "$workspace/nyx-vox.dmg" \
    "https://github.com/AVP-Dev/nyx-vox/releases/download/v${version}/$name"
  (cd "$workspace" && printf '%s  nyx-vox.dmg\n' "${digest#sha256:}" | shasum -a 256 --check)

  mkdir "$workspace/dmg"
  hdiutil attach -readonly -nobrowse -mountpoint "$workspace/dmg" "$workspace/nyx-vox.dmg" >&2
  touch "$workspace/mounted"
  [[ -f "$workspace/dmg/$bundle/Contents/Info.plist" ]] || fail 'The disk image is missing the application.'
  ditto "$workspace/dmg/$bundle" "$workspace/$bundle"
  hdiutil detach "$workspace/dmg" >&2
  rm "$workspace/mounted"

  local attributes
  attributes=$(xattr "$workspace/$bundle")
  if printf '%s\n' "$attributes" | grep -Fxq com.apple.quarantine; then
    xattr -dr com.apple.quarantine "$workspace/$bundle"
  fi
}

install_app() {
  mkdir -p "$destination"
  [[ ! -e "/Applications/$bundle" && ! -L "/Applications/$bundle" ]] ||
    fail "NYX Vox already exists in /Applications. Update it through its original installation method."
  mkdir "$lock" || fail 'Another installation is in progress.'
  trap 'rmdir "$lock"' EXIT
  workspace=$(mktemp -d "$destination/.nyx-vox.XXXXXXXX")
  trap cleanup EXIT

  stage_latest_release

  check_existing_app
  if [[ -d "$target" ]]; then
    mv "$target" "$workspace/previous.app"
  fi
  mv "$workspace/$bundle" "$target"
  open "$target"
}

check_platform
install_app
