#!/usr/bin/env bash
# Container checks for the Discord bot starter, run under tight limits: uid
# 1001, no capabilities, no privilege escalation, 256 MB of memory and no swap,
# a small CPU share, a fixed PORT.
#
# The image is built from a standard Node recipe (npm ci, npm start) written as
# a Dockerfile in a copy of the repo; the repo itself has no Dockerfile.
# Nothing is mocked, but the Discord gateway cannot be reached without a real
# token, so "connected", command registration and the invite scopes on a real
# server are checked in production, not here.
#
# Usage: tests/smoke.sh [image]   (with no image, builds one first)
# Needs: docker, curl, bash. Exits non-zero if any case fails.
set -euo pipefail

cd "$(dirname "$0")/.."
RUN="dbsmoke-$$-$RANDOM"
IMAGE=${1:-}
PORT=8080
WORK=$(mktemp -d "${TMPDIR:-/tmp}/dbsmoke.XXXXXX")
PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "PASS  $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "FAIL  $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
info() { echo "INFO  $1"; }
report() { if [ "$2" = true ]; then pass "$1"; else fail "$1"; fi; }

cleanup() {
  docker rm -f "$RUN-app" >/dev/null 2>&1 || true
  [ -n "${BUILT:-}" ] && docker rmi -f "$IMAGE" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

if [ -z "$IMAGE" ]; then
  IMAGE="$RUN-image"
  BUILT=1
  mkdir "$WORK/ctx"
  git ls-files -co --exclude-standard -z | xargs -0 -I{} cp --parents {} "$WORK/ctx/"
  # The recipe for a repo with a start script, a package-lock.json and no
  # build script.
  cat > "$WORK/ctx/Dockerfile" <<'RECIPE'
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["npm", "start"]
RECIPE
  docker build -q -t "$IMAGE" "$WORK/ctx" >/dev/null
fi

start() { # start [docker run args...]
  docker rm -f "$RUN-app" >/dev/null 2>&1 || true
  docker run -d --name "$RUN-app" --restart on-failure --user 1001:1001 --cap-drop ALL \
    --security-opt no-new-privileges --memory 256m --memory-swap 256m --cpus 0.25 \
    -e PORT="$PORT" -p 127.0.0.1::"$PORT" "$@" "$IMAGE" >/dev/null
  HOSTPORT=$(docker port "$RUN-app" "$PORT/tcp" | head -n1 | sed 's/.*://')
  local i=0
  until curl -fsS "http://127.0.0.1:$HOSTPORT/health" >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -ge 60 ] || [ "$(docker inspect -f '{{.State.Running}}' "$RUN-app")" != true ]; then
      fail "the app becomes healthy"; docker logs "$RUN-app" 2>&1 | tail -n 20; exit 1
    fi
    sleep 0.5
  done
}
get() { curl -sS "http://127.0.0.1:$HOSTPORT$1"; }
field() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[process.argv[1]]))' "$1"; }

stop_timed() { # prints "<seconds> <exit code>"
  local t0 t1
  t0=$(date +%s.%N)
  docker stop -t 30 "$RUN-app" >/dev/null
  t1=$(date +%s.%N)
  echo "$(echo "$t1 - $t0" | bc | sed 's/^\./0./') $(docker inspect -f '{{.State.ExitCode}}' "$RUN-app")"
}

# ---- 1. Missing token ------------------------------------------------------
start
sleep 4
root=$(get /)
report "no token: /health answers 200" "$([ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$HOSTPORT/health")" = 200 ] && echo true || echo false)"
report "no token: gateway is \"no token\"" "$([ "$(echo "$root" | field gateway)" = "no token" ] && echo true || echo false)"
msg=$(echo "$root" | field message)
case $msg in *DISCORD_TOKEN*"Secrets in the dashboard sidebar"*"Variables tab"*) report "no token: the status page names the value and the place" true ;; *) report "no token: the status page names the value and the place ($msg)" false ;; esac
report "no token: the app is still running, restart count 0" "$([ "$(docker inspect -f '{{.State.Running}} {{.RestartCount}}' "$RUN-app")" = "true 0" ] && echo true || echo false)"
lines=$(docker logs "$RUN-app" 2>&1 | grep -c "DISCORD_TOKEN is missing" || true)
report "no token: one log line names the value ($lines)" "$([ "$lines" = 1 ] && echo true || echo false)"
info "memory idle, no token (docker stats): $(docker stats --no-stream --format '{{.MemUsage}}' "$RUN-app")"
read -r secs code <<<"$(stop_timed)"
report "no token: SIGTERM exits within 10 s ($secs s, exit $code)" "$([ "$code" = 0 ] && [ "$(echo "$secs < 10" | bc)" = 1 ] && echo true || echo false)"

# ---- 2. A token Discord refuses (a made-up one) ----------------------------
TOKEN=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')
start -e DISCORD_TOKEN="$TOKEN"
state=""
for _ in $(seq 1 60); do
  root=$(get /)
  case $(echo "$root" | field message) in *refused*) state=refused; break ;; esac
  case $(docker logs "$RUN-app" 2>&1) in *"login failed"*) state=offline; break ;; esac
  sleep 1
done
case $state in
  refused)
    pass "bad token: the status page says the token was refused"
    report "bad token: no crash loop, restart count 0" "$([ "$(docker inspect -f '{{.State.Running}} {{.RestartCount}}' "$RUN-app")" = "true 0" ] && echo true || echo false)"
    report "bad token: /health still answers 200" "$([ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$HOSTPORT/health")" = 200 ] && echo true || echo false)" ;;
  offline) info "bad token: Discord is not reachable from here, the refused case was not exercised" ;;
  *) fail "bad token: neither refused nor a login error after 60 s" ;;
esac
sleep 2
docker logs "$RUN-app" > "$WORK/token.log" 2>&1
report "the token is in no log line" "$(grep -qF "$TOKEN" "$WORK/token.log" && echo false || echo true)"
cmdlines=$(docker exec "$RUN-app" sh -c 'cat /proc/[0-9]*/cmdline | tr "\0" " "')
report "the token is on no process command line" "$(case $cmdlines in *"$TOKEN"*) echo false ;; *) echo true ;; esac)"
report "the token is not in the image's command or entrypoint" "$(docker inspect -f '{{.Config.Cmd}} {{.Config.Entrypoint}}' "$IMAGE" | grep -qF "$TOKEN" && echo false || echo true)"
info "memory idle, bad token: $(docker stats --no-stream --format '{{.MemUsage}}' "$RUN-app")"
read -r secs code <<<"$(stop_timed)"
report "bad token: SIGTERM exits within 10 s ($secs s, exit $code)" "$([ "$code" = 0 ] && [ "$(echo "$secs < 10" | bc)" = 1 ] && echo true || echo false)"

echo "$PASS_COUNT passed, $FAIL_COUNT failed"
[ "$FAIL_COUNT" -eq 0 ]
