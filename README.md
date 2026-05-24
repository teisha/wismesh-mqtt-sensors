# Project to Connect WisMesh Sensors to Raspberry Pi running Grafana dashboard

## Architecture



## WisMesh Setup



## Raspberry Pi Setup

```
nohup python3 bridge.py > bridge.log 2>&1 &
```

Next natural step:

Run one end-to-end deploy from laptop:
```
deploy_remote.sh pi@raspberrypi.local
```
Verify on Pi:
```
sudo systemctl status garden-telemetry.service
```



## Communication - wiring it up


### Grafana dashboards from files

Drop dashboard JSON files into `grafana/dashboards/`.

The compose file mounts this folder read-only into Grafana at `/var/lib/grafana/dashboards`, and provisioning is configured to load dashboards from there.

After adding or updating dashboard JSON files, refresh Grafana:
```
cd /home/teisha/git/wismesh-mqtt-sensors
docker compose up -d grafana
```

Deploy compose + telemetry + Grafana files to the Pi and recreate Grafana:
```
cd /home/teisha/git/wismesh-mqtt-sensors/mqtt-processor
./scripts/deploy_grafana_remote.sh pi@raspberrypi.local
```





## Troubleshooting

### Is Mosquitto getting your messages from Meshtastic MQTT
This will tail the mosquitto logs:
```
docker exec -it mosquitto mosquitto_sub -h localhost -t "#" -v
```

### Are the messages being saved in Prometheus
Query one of the data points that you set up in your code:
```
curl -s "http://localhost:9090/api/v1/query?query=garden_temperature_celsius" | jq
```


## References I used

```
https://core-electronics.com.au/courses/meshtastic-for-makers-workshop/?fresh#KAEF1RG

https://www.youtube.com/watch?v=J4Z23yYmhvY&list=PLPK2l9Knytg6jzOfcqk5y0iBH48ZATVVD&index=7
```