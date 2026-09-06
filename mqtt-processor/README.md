# mqtt-processor

MQTT-to-metrics bridge for WisMesh telemetry.

## Directory Structure

- `src/app.py`: main executable module run by the systemd service.
- `src/payload_parser.py`: pure payload parsing logic (unit-testable).
- `src/services/dynamodb.py`: DynamoDB table initialization service.
- `tests/test_payload_parser.py`: pytest unit tests for payload parsing.
- `tests/test_dynamodb_service.py`: pytest tests for DynamoDB service with mocks.
- `requirements.txt`: runtime dependencies for deployment.
- `requirements-dev.txt`: local development/testing dependencies.
- `pytest.ini`: pytest discovery/config.
- `scripts/deploy_template.sh`: AWS CloudFormation deploy helper for the infrastructure stack.
- `systemd/garden-telemetry.service`: systemd template for the Python MQTT bridge.
- `systemd/garden-telemetry-compose.service`: systemd template for the Docker Compose stack.
- `ansible/`: preferred deployment path for remote provisioning and service startup.

## Execution Flow

1. Service starts Python executable at `src/app.py`.
2. App subscribes to `msh/+/json/#` (configurable via `MQTT_TOPIC`).
3. `on_message` parses JSON and keeps only telemetry payloads.
4. Metrics are exposed to Prometheus on `PROMETHEUS_PORT`.
5. Records are optionally written to DynamoDB when configured.

## Local Development

Install runtime deps:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Install test deps and run tests:

```bash
pip install -r requirements-dev.txt
pytest
```

Run app locally:

```bash
python src/app.py
```

## Deployment

The supported deployment path is Ansible.

```bash
cd /home/teisha/git/wismesh-mqtt-sensors
ansible-playbook -i ansible/inventory.ini ansible/deploy_compose.yml
ansible-playbook -i ansible/inventory.ini ansible/deploy_garden_telemetry.yml
```

The CloudFormation template is still available separately for AWS infrastructure provisioning:

```bash
cd mqtt-processor
./scripts/deploy_template.sh --stack-name garden-telemetry-dev --region us-east-1 --stage dev
```

Environment file setup (recommended):

```bash
mkdir -p config
cat > config/garden-telemetry.env <<'EOF'
MQTT_BROKER=localhost
MQTT_PORT=1883
MQTT_TOPIC=msh/+/json/#
PROMETHEUS_PORT=8000
EOF
```

This config file is intentionally git-ignored and should not be committed.

## Service Path Adjustment

If you move the executable again, update `ExecStart` in the rendered system service file:

- `/etc/systemd/system/garden-telemetry.service`

Expected command format:

```ini
ExecStart=/path/to/.venv/bin/python /path/to/mqtt-processor/src/app.py
```

Then reload/restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart garden-telemetry.service
```

The Ansible playbook templates this path from:

- `systemd/garden-telemetry.service` with `APP_PY` set to the installed Python service entry point.

## Compose Service Adjustment

The Docker Compose stack is managed by `garden-telemetry-compose.service`, rendered from `systemd/garden-telemetry-compose.service` during the Ansible compose deployment.

If you change the stack location, update the template and re-run the compose deployment so the installed unit is regenerated.

To inspect it on the target host:

```bash
sudo systemctl status garden-telemetry-compose.service
sudo systemctl restart garden-telemetry-compose.service
docker compose -f ~/telemetry/docker-compose.yaml ps
```



### Grafana dashboards from files

Drop dashboard JSON files into `grafana/dashboards/`.

The compose file mounts this folder read-only into Grafana at `/var/lib/grafana/dashboards`, and provisioning is configured to load dashboards from there.

After adding or updating dashboard JSON files, refresh Grafana:
```
cd wismesh-mqtt-sensors
docker compose up -d grafana
```

Deploy the compose stack and app service using Ansible:
```
cd /home/teisha/git/wismesh-mqtt-sensors
ansible-playbook -i ansible/inventory.ini ansible/deploy_compose.yml
ansible-playbook -i ansible/inventory.ini ansible/deploy_garden_telemetry.yml
```
