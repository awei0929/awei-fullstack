#!/bin/sh
# Root-owned forced-command entry point. The SSH key must also use restrict.
set -eu
LC_ALL=C
export LC_ALL

reject() {
    printf '%s\n' 'Only deploy RELEASE_ID or rollback RELEASE_ID is permitted.' >&2
    exit 64
}

case "${SSH_ORIGINAL_COMMAND-}" in
    'deploy '*) action=deploy; release=${SSH_ORIGINAL_COMMAND#deploy } ;;
    'rollback '*) action=rollback; release=${SSH_ORIGINAL_COMMAND#rollback } ;;
    *) reject ;;
esac
case "$release" in
    ''|*[!a-zA-Z0-9-]*) reject ;;
esac
[ "${#release}" -le 128 ] || reject

# Optional root-owned server configuration, installed by setup-deploy.sh.
if [ -r /etc/nest-deploy.env ]; then
    set -a
    . /etc/nest-deploy.env
    set +a
fi

# Neither executable path can be overridden by a command supplied over SSH.
exec /usr/bin/python3 /usr/local/libexec/nest-deploy.py "$action" "$release"
