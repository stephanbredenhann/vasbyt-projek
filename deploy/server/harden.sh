#!/usr/bin/env bash
#
# One-time hardening for a fresh Ubuntu or Debian VPS. Run as root, from a root session you keep
# open until `ssh vasbyt` works from a second terminal:
#
#   bash harden.sh <username> "<contents of ~/.ssh/id_vasbyt.pub>"
#
set -euo pipefail

USER_NAME=${1:?usage: harden.sh <username> "<public key>"}
PUBKEY=${2:?usage: harden.sh <username> "<public key>"}
. /etc/os-release
export DEBIAN_FRONTEND=noninteractive

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

log "Updating packages"
apt-get update
apt-get -y upgrade
apt-get -y install ufw fail2ban python3-systemd unattended-upgrades ca-certificates curl git

log "Creating $USER_NAME"
id "$USER_NAME" &>/dev/null || adduser --disabled-password --gecos "" "$USER_NAME"
usermod -aG sudo "$USER_NAME"
install -d -m 700 -o "$USER_NAME" -g "$USER_NAME" "/home/$USER_NAME/.ssh"
# Only this key, not root's authorized_keys, which may hold the provider's keys.
printf '%s\n' "$PUBKEY" > "/home/$USER_NAME/.ssh/authorized_keys"
chown "$USER_NAME:$USER_NAME" "/home/$USER_NAME/.ssh/authorized_keys"
chmod 600 "/home/$USER_NAME/.ssh/authorized_keys"

log "Locking down SSH"
# 00- so it wins over cloud-init's 50-cloud-init.conf, which often turns passwords back on.
cat > /etc/ssh/sshd_config.d/00-hardening.conf <<EOF
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers $USER_NAME
MaxAuthTries 3
X11Forwarding no
EOF
sshd -t
systemctl reload ssh || systemctl restart ssh

log "Firewall: 22, 80, 443 only"
ufw default deny incoming
ufw default allow outgoing
ufw limit OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

log "fail2ban"
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
backend = systemd
bantime = 1h
bantime.increment = true
findtime = 10m
maxretry = 5

[sshd]
enabled = true
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

log "Automatic security updates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

log "Docker"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$ID $VERSION_CODENAME stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
# Rotated logs, so a chatty container cannot fill the disk.
echo '{ "log-driver": "local" }' > /etc/docker/daemon.json
systemctl restart docker
usermod -aG docker "$USER_NAME"

log "Done"
echo "Next, still in this root session: passwd $USER_NAME   (sudo needs it)"
echo "Then from a NEW local terminal: ssh vasbyt. Only close this session once that works."
