# Ansible deployment for this project

This directory contains two Ansible playbooks for deploying the infrastructure in this repo:

- `deploy_compose.yml` deploys the Docker Compose stack (`Mosquitto`, `Prometheus`, `Grafana`, `tools-api`, and `tools-ui`)
- `deploy_garden_telemetry.yml` deploys the Python MQTT telemetry service
- `deploy_tools_website.yml` deploys only the tools website stack (`tools-api`, `tools-ui`) plus DB/backup setup

## Install Ansible on Ubuntu 24.04 WSL

```bash
sudo apt update
sudo apt install -y software-properties-common curl ca-certificates gnupg
sudo add-apt-repository --yes --update ppa:ansible/ansible
sudo apt install -y ansible
ansible --version
```

## Install Ansible on macOS

If you use Homebrew:

```bash
brew update
brew install ansible
ansible --version
```

## Update your inventory

Edit `ansible/inventory.ini` and replace the example target host:

```ini
[pi]
raspberrypi.local ansible_user=pi ansible_become=true
```

You can also use an IP address instead of a hostname.

## Deploy the Docker Compose stack

```bash
cd /home/teisha/git/wismesh-mqtt-sensors
ansible-playbook -i ansible/inventory.ini ansible/deploy_compose.yml
```

This also syncs the `tools_website/` module directory to `~/telemetry` on the Pi.
It also ensures `/mnt/storage/tools_api_data` exists for the tools API SQLite database.
It also ensures `/mnt/storage/tools_api_backups` exists and installs a nightly cron backup for the tools API DB.

## Deploy only the tools website stack and DB setup

```bash
cd /home/teisha/git/wismesh-mqtt-sensors
ansible-playbook -i ansible/inventory.ini ansible/deploy_tools_website.yml
```

This playbook updates only the web tools stack files, ensures DB/backup directories, installs nightly backup cron, and runs compose for `tools-api` and `tools-ui`.
It uses `--no-deps`, so it does not start/recreate `mosquitto`, `prometheus`, or `grafana`.

## Deploy the Python telemetry service

```bash
cd /home/teisha/git/wismesh-mqtt-sensors
ansible-playbook -i ansible/inventory.ini ansible/deploy_garden_telemetry.yml
```

This playbook is safe to run repeatedly.
It does not run docker compose down, does not remove containers, and does not touch Grafana/Prometheus/Mosquitto services.
It only restarts `garden-telemetry.service` when inputs actually changed (code, requirements, env file, or service unit template).

---


## Remote Compose Commands (Run on the Pi over SSH)

The compose stack is defined in `docker-compose.yaml` and runs as the `garden-telemetry-compose.service` systemd service.

These commands are not Ansible commands.
Run them only after SSHing into the Pi host.

Start by SSHing into the Pi:

```bash
ssh pi@raspberrypi.local
cd ~/telemetry
```

Then run Docker Compose service commands on the Pi shell:

```bash
docker compose up -d mosquitto
# or:
# docker compose up -d prometheus
# docker compose up -d grafana
# docker compose up -d tools-api
# docker compose up -d tools-ui
```

Restart a single service:

```bash
cd ~/telemetry
docker compose restart mosquitto
```

Stop and remove a single service container:

```bash
cd ~/telemetry
docker compose stop mosquitto
docker compose rm -sf mosquitto
```

Tear down the whole stack:

```bash
cd ~/telemetry
docker compose down
```

Note: the installed `garden-telemetry-compose.service` now uses `docker compose stop` on service stop/restart so routine service operations do not remove containers/networks.

## Service management notes

- The Python telemetry bridge is managed by `garden-telemetry.service`
- The Docker stack is managed by `garden-telemetry-compose.service`
- You can check status with:

```bash
sudo systemctl status garden-telemetry.service
sudo systemctl status garden-telemetry-compose.service
```
