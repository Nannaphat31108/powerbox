# POWER BOX SOS

ระบบประกอบด้วย

1. ตัวส่ง: ESP32 + RA-01 SX1278 + NEO-6M GPS
2. ตัวรับ: ESP32 + RA-01 SX1278 + OLED + Wi-Fi
3. Web server: Flask + SQLAlchemy + Dashboard + OpenStreetMap

## Wiring - Transmitter

RA-01 -> ESP32

- VCC -> 3V3
- GND -> GND
- SCK -> GPIO18
- MISO -> GPIO19
- MOSI -> GPIO23
- NSS/CS -> GPIO5
- RST -> GPIO14
- DIO0 -> GPIO26
- ANT -> 433 MHz antenna

GPS -> ESP32

- VCC -> 3V3
- GND -> GND
- TX -> GPIO27
- RX -> not connected

## Wiring - Receiver

RA-01 uses the same LoRa pins as transmitter.

OLED -> ESP32

- GND -> GND
- VDD -> 3V3
- SCK/SCL -> GPIO22
- SDA -> GPIO21

## Arduino Libraries

Transmitter:
- LoRa by Sandeep Mistry
- TinyGPSPlus by Mikal Hart

Receiver:
- LoRa by Sandeep Mistry
- Adafruit GFX
- Adafruit SSD1306

WiFi, HTTPClient, WiFiClientSecure and Wire are included with ESP32 Arduino core.

## Configure Receiver

Edit these three values inside receiver.ino:

- WIFI_SSID
- WIFI_PASSWORD
- API_URL

API_URL should be:

https://YOUR-SERVICE.onrender.com/api/sos

## Run web locally

Windows:

python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py

Then open:

http://127.0.0.1:5000

## Deploy to Render

1. Upload the software folder to GitHub.
2. Create a Render Blueprint from render.yaml, or create a Python Web Service manually.
3. Build command:
   pip install -r requirements.txt
4. Start command:
   gunicorn app:app
5. Add PostgreSQL or set DATABASE_URL.
6. Open the deployed URL.
7. Put the deployed `/api/sos` URL into receiver.ino and upload the receiver code again.

## Test API without ESP32

POST /api/sos

Example JSON:

{
  "device_id": "SOS_BOX_01",
  "latitude": 18.123456,
  "longitude": 100.654321,
  "rssi": -72
}

Without GPS:

{
  "device_id": "SOS_BOX_01",
  "latitude": null,
  "longitude": null,
  "rssi": -72
}

## Important

- RA-01 VCC must use 3.3V, not 5V.
- Attach a matching 433 MHz antenna before LoRa transmission.
- The transmitter-to-receiver SOS link works through LoRa without internet.
- Only the receiver-to-web upload requires Wi-Fi/internet.
- `client.setInsecure()` is included for simple HTTPS prototyping. For a production deployment, configure certificate verification.
