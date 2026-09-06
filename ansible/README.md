# Ansible deployment for this project

This directory contains two Ansible playbooks for deploying the infrastructure in this repo:

- `deploy_compose.yml` deploys the Docker Compose stack (`Mosquitto`, `Prometheus`, and `Grafana`)
- `deploy_garden_telemetry.yml` deploys the Python MQTT telemetry service

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

## Deploy the Python telemetry service

```bash
cd /home/teisha/git/wismesh-mqtt-sensors
ansible-playbook -i ansible/inventory.ini ansible/deploy_garden_telemetry.yml
```

## Useful service-level Docker Compose commands

The compose stack is defined in `docker-compose.yaml` and runs as the `garden-telemetry-compose.service` systemd service.

To install or restart just one service in the compose stack:

```bash
ssh pi@raspberrypi.local
cd ~/telemetry
docker compose up -d mosquitto
# or:
# docker compose up -d prometheus
# docker compose up -d grafana
```

To restart a single service:

```bash
cd ~/telemetry
docker compose restart mosquitto
```

To stop and remove a single service container:

```bash
cd ~/telemetry
docker compose stop mosquitto
docker compose rm -sf mosquitto
```

To tear down the whole stack:

```bash
cd ~/telemetry
docker compose down
```

## Service management notes

- The Python telemetry bridge is managed by `garden-telemetry.service`
- The Docker stack is managed by `garden-telemetry-compose.service`
- You can check status with:

```bash
sudo systemctl status garden-telemetry.service
sudo systemctl status garden-telemetry-compose.service
```
