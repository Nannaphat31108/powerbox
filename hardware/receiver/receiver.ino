#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* API_URL = "https://YOUR-RENDER-SERVICE.onrender.com/api/sos";

#define LORA_SS 5
#define LORA_RST 14
#define LORA_DIO0 26
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

void showWaiting() {
  display.clearDisplay(); display.setTextColor(SSD1306_WHITE); display.setTextSize(1);
  display.setCursor(0,0); display.println("POWER BOX");
  display.setCursor(0,20); display.println("Waiting SOS...");
  display.setCursor(0,40); display.print("WiFi: "); display.println(WiFi.status()==WL_CONNECTED ? "OK" : "OFFLINE");
  display.display();
}

void connectWiFi() {
  WiFi.mode(WIFI_STA); WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[WIFI] Connecting"); unsigned long started=millis();
  while(WiFi.status()!=WL_CONNECTED && millis()-started<15000){delay(500);Serial.print(".");}
  Serial.println();
  if(WiFi.status()==WL_CONNECTED){Serial.println("[WIFI] PASS");Serial.println(WiFi.localIP());}
  else Serial.println("[WIFI] OFFLINE - LoRa receiver still works");
}

bool postSOS(const String& deviceId,const String& latitude,const String& longitude,int rssi){
  if(WiFi.status()!=WL_CONNECTED) connectWiFi();
  if(WiFi.status()!=WL_CONNECTED) return false;
  WiFiClientSecure client; client.setInsecure();
  HTTPClient http; if(!http.begin(client,API_URL)) return false;
  http.addHeader("Content-Type","application/json");
  String json="{\"device_id\":\""+deviceId+"\",\"rssi\":"+String(rssi)+",";
  if(latitude=="NO_GPS" || latitude.length()==0) json+="\"latitude\":null,\"longitude\":null";
  else json+="\"latitude\":"+latitude+",\"longitude\":"+longitude;
  json+="}";
  Serial.print("[WEB] POST: "); Serial.println(json);
  int code=http.POST(json); Serial.print("[WEB] HTTP "); Serial.println(code);
  if(code>0) Serial.println(http.getString()); http.end(); return code>=200 && code<300;
}

void setup(){
  Serial.begin(115200); delay(500); Wire.begin(21,22);
  if(!display.begin(SSD1306_SWITCHCAPVCC,0x3C)){Serial.println("[OLED] FAIL");while(true)delay(1000);}
  showWaiting(); SPI.begin(18,19,23,LORA_SS); LoRa.setPins(LORA_SS,LORA_RST,LORA_DIO0);
  if(!LoRa.begin(433E6)){Serial.println("[LORA] FAIL");while(true)delay(1000);}
  LoRa.setSyncWord(0x12); Serial.println("[LORA] PASS - Receiver ready"); connectWiFi(); showWaiting();
}

void loop(){
  int packetSize=LoRa.parsePacket(); if(!packetSize)return;
  String message; while(LoRa.available()) message+=(char)LoRa.read(); int rssi=LoRa.packetRssi();
  Serial.print("[LORA] Received: ");Serial.println(message);
  String deviceId=message,latitude="",longitude=""; int comma1=message.indexOf(','),comma2=-1;
  if(comma1>=0){deviceId=message.substring(0,comma1);comma2=message.indexOf(',',comma1+1);if(comma2>=0){latitude=message.substring(comma1+1,comma2);longitude=message.substring(comma2+1);}else latitude=message.substring(comma1+1);}
  display.clearDisplay();display.setTextColor(SSD1306_WHITE);display.setTextSize(2);display.setCursor(0,0);display.println("SOS!");display.setTextSize(1);display.setCursor(0,20);display.println(deviceId);
  if(latitude=="NO_GPS"||latitude.length()==0){display.setCursor(0,34);display.println("GPS: WAITING");}
  else{display.setCursor(0,32);display.print("LAT:");display.println(latitude);display.setCursor(0,42);display.print("LON:");display.println(longitude);}
  display.setCursor(0,54);display.print("RSSI:");display.print(rssi);display.display();
  bool uploaded=postSOS(deviceId,latitude,longitude,rssi);Serial.println(uploaded?"[WEB] PASS - SOS uploaded":"[WEB] FAIL - SOS not uploaded");
}
