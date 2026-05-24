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
- `scripts/deploy.sh`: local deploy to system-level systemd service.
- `scripts/deploy_remote.sh`: rsync to Pi and invoke remote deploy script.
- `scripts/update_app.sh`: pull latest code, refresh deps, restart service.
- `systemd/garden-telemetry.service`: service template used by deploy script.

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
First make sure that the template is working:
```
cd mqtt-processor
./scripts/deploy_template.sh --stack-name garden-telemetry-dev --region us-east-1 --stage dev
```


Local deploy on target machine:

```bash
bash scripts/deploy.sh
```

Remote deploy from laptop/workstation:

```bash
bash scripts/deploy_remote.sh user@pi-host
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

`scripts/deploy_remote.sh` checks for `config/garden-telemetry.env` and, if present, copies it to `~/.config/garden-telemetry.env` on the remote host. Deploy then installs it to `/etc/default/garden-telemetry`, which is read by the system service.

This config file is intentionally git-ignored and should not be committed.

Update in place on target machine:

```bash
bash scripts/update_app.sh
```

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

The deploy script already templates this path from:

- `scripts/deploy.sh` replacing `{{APP_PY}}`.
