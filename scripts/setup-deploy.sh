#!/usr/bin/env bash
# Run once as root on the existing Ubuntu host. No credentials belong in Git.
set -euo pipefail

if [[ $EUID -ne 0 || $# -ne 1 ]]; then
  echo 'Usage: sudo bash scripts/setup-deploy.sh /path/to/deploy-key.pub' >&2
  exit 2
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
app_user=ubuntu
source_root=/home/ubuntu/apps/nest
deploy_root=/srv/nest
web_root=/var/www/nest
env_file=$source_root/backend/.env
dropin=/etc/systemd/system/nest-backend.service.d/20-cicd.conf
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup=$deploy_root/setup-backup-$stamp
key_file=$1

for tool in node npm python3 curl nginx systemctl visudo ssh-keygen; do
  command -v "$tool" >/dev/null
done
[[ $(node -p 'process.versions.node.split(".")[0]') == 24 ]]
[[ -f $script_dir/deploy.py && -f $script_dir/deploy-ssh.sh ]]
[[ -f $env_file && -f $source_root/backend/dist/main.js ]]
[[ -d $source_root/backend/node_modules && -f $web_root/index.html ]]
[[ -f $key_file && ! -L $key_file ]]
ssh-keygen -lf "$key_file" >/dev/null
[[ $(wc -l < "$key_file") -eq 1 ]]
read -r key_type key_body key_comment < "$key_file"
[[ $key_type == ssh-ed25519 && $key_body =~ ^[A-Za-z0-9+/=]+$ ]]
key_line="restrict,command=\"/usr/local/libexec/nest-deploy-ssh.sh\" $key_type $key_body nest-github-actions-deploy"

install -d -o "$app_user" -g "$app_user" -m 755 "$deploy_root" "$deploy_root/releases"
install -d -o root -g root -m 700 "$backup"
install -d -o root -g root -m 755 /usr/local/libexec "$(dirname "$dropin")"
if [[ -f $dropin ]]; then cp -a "$dropin" "$backup/dropin.before"; fi
if [[ -f /etc/sudoers.d/nest-deploy ]]; then
  cp -a /etc/sudoers.d/nest-deploy "$backup/sudoers.before"
fi
if [[ -f /home/ubuntu/.ssh/authorized_keys ]]; then
  cp -a /home/ubuntu/.ssh/authorized_keys "$backup/authorized_keys.before"
fi
cp -a /etc/systemd/system/nest-backend.service "$backup/service.before"

if [[ ! -L $deploy_root/current ]]; then
  [[ ! -e $deploy_root/current ]]
  bootstrap_id=bootstrap-$stamp
  bootstrap=$deploy_root/releases/$bootstrap_id
  install -d -o "$app_user" -g "$app_user" -m 755 "$bootstrap/backend" "$bootstrap/frontend/dist"
  cp -a "$source_root/backend/dist" "$source_root/backend/node_modules" "$bootstrap/backend/"
  cp -a "$source_root/backend/package.json" "$source_root/backend/package-lock.json" "$bootstrap/backend/"
  cp -a "$web_root/." "$bootstrap/frontend/dist/"
  find "$bootstrap/frontend" -type d -exec chmod 755 {} +
  find "$bootstrap/frontend" -type f -exec chmod 644 {} +
  ln -s "$env_file" "$bootstrap/backend/.env"
  printf '%s\n' "$bootstrap_id" > "$bootstrap/.nest-release-ready"
  chown -R "$app_user:$app_user" "$bootstrap"
  ln -s "releases/$bootstrap_id" "$deploy_root/current"
  chown -h "$app_user:$app_user" "$deploy_root/current"
fi

# install -d can leave intermediate bootstrap parents at 0700 under umask 077.
# Also repair an already-created bootstrap when retrying an interrupted setup.
current_target=$(readlink -f "$deploy_root/current")
[[ $(dirname "$current_target") == "$deploy_root/releases" ]]
[[ -f $current_target/.nest-release-ready && -f $current_target/frontend/dist/index.html ]]
chmod 755 "$current_target"

# Never replace existing user data, database configuration or media files.
install -o root -g root -m 755 "$script_dir/deploy.py" /usr/local/libexec/nest-deploy.py
install -o root -g root -m 755 "$script_dir/deploy-ssh.sh" /usr/local/libexec/nest-deploy-ssh.sh
printf '%s\n' 'NEST_DEPLOY_SITE_URL=https://159.75.18.65/' > /etc/nest-deploy.env
chown root:root /etc/nest-deploy.env
chmod 644 /etc/nest-deploy.env
printf '%s\n' 'ubuntu ALL=(root) NOPASSWD: /usr/bin/systemctl restart nest-backend.service' > "$backup/sudoers.new"
visudo -cf "$backup/sudoers.new"
install -o root -g root -m 440 "$backup/sudoers.new" /etc/sudoers.d/nest-deploy

changed_web=0
changed_service=0
recover_setup() {
  status=$?
  trap - ERR
  if [[ $changed_web == 1 ]]; then
    if [[ -L $web_root ]]; then rm -- "$web_root"; fi
    mv -- "$backup/frontend.before" "$web_root"
  fi
  if [[ $changed_service == 1 ]]; then
    if [[ -f $backup/dropin.before ]]; then
      cp -a "$backup/dropin.before" "$dropin"
    else
      rm -f -- "$dropin"
    fi
    systemctl daemon-reload
    systemctl restart nest-backend.service || true
  fi
  echo "Setup failed; restored the previous application paths. Backup: $backup" >&2
  exit "$status"
}
trap recover_setup ERR

changed_service=1
cat > "$dropin" <<'SERVICE'
[Service]
WorkingDirectory=/srv/nest/current/backend
ExecStart=
ExecStart=/usr/bin/node /srv/nest/current/backend/dist/main.js
SERVICE

if [[ ! -L $web_root ]]; then
  mv -- "$web_root" "$backup/frontend.before"
  changed_web=1
  ln -s "$deploy_root/current/frontend/dist" "$web_root"
else
  [[ $(readlink "$web_root") == "$deploy_root/current/frontend/dist" ]]
fi

nginx -t
runuser -u www-data -- test -r "$deploy_root/current/frontend/dist/index.html"
systemctl daemon-reload
systemctl restart nest-backend.service
curl --fail --silent --show-error --output /dev/null --retry 15 --retry-connrefused --retry-delay 1 --retry-max-time 35 http://127.0.0.1:3000/api/public/stats
curl --fail --silent --show-error --output /dev/null https://159.75.18.65/
systemctl is-active --quiet nest-backend.service

install -d -o "$app_user" -g "$app_user" -m 700 /home/ubuntu/.ssh
touch /home/ubuntu/.ssh/authorized_keys
chown "$app_user:$app_user" /home/ubuntu/.ssh/authorized_keys
chmod 600 /home/ubuntu/.ssh/authorized_keys
if ! grep -Fq -- "$key_body" /home/ubuntu/.ssh/authorized_keys; then
  printf '\n%s\n' "$key_line" >> /home/ubuntu/.ssh/authorized_keys
fi
trap - ERR
echo "Setup complete. Current release: $(readlink "$deploy_root/current"). Backup: $backup"
echo 'Installed a forced-command deployment key; database, environment and media preserved.'
