# Project to Connect WisMesh Sensors to Raspberry Pi running Grafana dashboard

# Overview
This project describes one person's journey to create a weather center for a backyard garden.

I started this when I stumbled into Meshtastic as an off-grid communication method and thought it might be useful to set up, since this area is prone to hurricanes and bad weather.

But then I saw that they have sensors ... hmmm!  This could be something!
I will eventually be building this out to a full weather station with a rain gauge and wind speed tracker, but I am starting small - just temperature/humidity and barometric pressure

## Architecture

### The start:
- RAKwireless Mini Meshtastic Starter Kit US=915MHz RAK19003 + 4631
- RAK Wireless RAK1901 Temperature and Humidity Sensor
- RAK Wireless RAK1902 Barometric Pressure Sensor

Instead of the Meshtastic starter kit, I found the little [PeakMesh MicroMAG](https://www.etsy.com/listing/4346022155/peakmesh-micromag-smallest-outdoor) solar powered unit with a slot C and slot D for the sensor, so this answered the power question as well as have a p.

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







## Troubleshooting

### Is Mosquitto getting your messages from Meshtastic MQTT
This will tail the mosquitto logs:
```
docker exec -it mosquitto mosquitto_sub -h localhost -t "#" -v
```

### Why does 'docker compose ps' show this service restarting?
This shows the logs:
```
docker compose logs grafana --tail=120
```

### Are the messages being saved in Prometheus
Query one of the data points that you set up in your code:
```
curl -s "http://localhost:9090/api/v1/query?query=garden_temperature_celsius" | jq
```

### Oy, just reboot this thing
```
sudo reboot
```
Alternative equivalent:
```
sudo systemctl reboot
```

## References I used

```
https://core-electronics.com.au/courses/meshtastic-for-makers-workshop/?fresh#KAEF1RG

https://www.youtube.com/watch?v=J4Z23yYmhvY&list=PLPK2l9Knytg6jzOfcqk5y0iBH48ZATVVD&index=7
```