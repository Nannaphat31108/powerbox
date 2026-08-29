#include <SPI.h>
#include <LoRa.h>
#include <TinyGPSPlus.h>

#define LORA_SS 5
#define LORA_RST 14
#define LORA_DIO0 26
#define GPS_RX 27
#define GPS_TX -1

const char* DEVICE_ID = "SOS_BOX_01";
TinyGPSPlus gps;
HardwareSerial GPSserial(2);
unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL = 5000;

void sendSOS() {
  String message = String(DEVICE_ID);
  if (gps.location.isValid()) {
    message += "," + String(gps.location.lat(), 6) + "," + String(gps.location.lng(), 6);
  } else {
    message += ",NO_GPS";
  }
  Serial.print("[LORA] Sending: "); Serial.println(message);
  LoRa.beginPacket(); LoRa.print(message);
  int result = LoRa.endPacket();
  Serial.println(result == 1 ? "[LORA] PASS - Packet transmission completed" : "[LORA] WARNING - Packet transmission result unexpected");
}

void printGPSStatus() {
  Serial.print("[GPS] Characters received: "); Serial.println(gps.charsProcessed());
  if (gps.location.isValid()) {
    Serial.println("[GPS FIX] PASS");
    Serial.print("Latitude : "); Serial.println(gps.location.lat(), 6);
    Serial.print("Longitude: "); Serial.println(gps.location.lng(), 6);
    if (gps.satellites.isValid()) { Serial.print("Satellites: "); Serial.println(gps.satellites.value()); }
  } else {
    Serial.println("[GPS FIX] WAITING");
    if (gps.satellites.isValid()) { Serial.print("Satellites: "); Serial.println(gps.satellites.value()); }
  }
}

void setup() {
  Serial.begin(115200); delay(1000);
  Serial.println("POWER BOX SOS - TRANSMITTER");
  GPSserial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  SPI.begin(18, 19, 23, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(433E6)) { Serial.println("[LORA] FAIL - Check wiring"); while (true) delay(1000); }
  LoRa.setSyncWord(0x12);
  Serial.println("[ESP32] PASS - Running");
  Serial.println("[LORA] PASS - SX1278 detected");
}

void loop() {
  while (GPSserial.available()) gps.encode(GPSserial.read());
  if (millis() - lastSend >= SEND_INTERVAL) {
    lastSend = millis(); printGPSStatus(); sendSOS(); Serial.println("--------------------------------------");
  }
}
