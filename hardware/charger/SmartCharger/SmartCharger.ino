/*
  เครื่องชาร์จแบตอัจฉริยะแบบสแตนด์อโลน (Smart Standalone Battery Charger)
  บอร์ด : Arduino Nano (ATmega328P)
  แบต   : ตะกั่วกรด / AGM / Gel 12V ขนาด 4.5–12Ah
  ไลบรารี: LiquidCrystal I2C (Frank de Brabander) — ติดตั้งจาก Library Manager

  ขาที่ใช้
    A0 แรงดันแบต (R1 10k / R2 3.3k)     A1 กระแสชาร์จ (R10 0.22R)
    A2 อุณหภูมิ NTC 10k (R9 10k)         A4 SDA, A5 SCL -> จอ LCD I2C
    D2 ปุ่ม START   D3 ปุ่ม MODE   D5 LED แดง   D6 LED เขียว   D7 รีเลย์   D8 บัซเซอร์
*/
#include <Wire.h>
#include <EEPROM.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);   // ถ้าจอไม่ขึ้น เปลี่ยนเป็น 0x3F

// ---------- ขา ----------
const byte PIN_VBAT  = A0;
const byte PIN_IBAT  = A1;
const byte PIN_TEMP  = A2;
const byte PIN_START = 2;
const byte PIN_MODE  = 3;
const byte PIN_LED_R = 5;
const byte PIN_LED_G = 6;
const byte PIN_RELAY = 7;
const byte PIN_BUZZ  = 8;

// ---------- ค่าคาลิเบรต (แก้ให้ตรงกับมัลติมิเตอร์) ----------
const float VCC_REAL  = 5.00;                 // วัดแรงดันขา 5V ของ Nano แล้วใส่ค่าจริง
const float DIV_RATIO = (10.0 + 3.3) / 3.3;   // (R1 + R2) / R2
const float R_SHUNT   = 0.22;                 // R10
const float V_CAL     = 1.000;                // ตัวคูณแก้แรงดัน เช่น 1.012
const float NTC_R0    = 10000.0, NTC_B = 3950.0, R_NTC_PULLUP = 10000.0;

// ---------- เกณฑ์การชาร์จ แบตตะกั่วกรด 12V ----------
const float V_NO_BATT  = 3.0;    // ต่ำกว่านี้ = ไม่มีแบต หรือต่อกลับขั้ว
const float V_DEEP     = 10.5;   // ต่ำกว่านี้ = แบตหมดลึก เตือนแต่ยังชาร์จได้
const float V_FULL_CHG = 14.1;   // ขณะชาร์จต้องถึงค่านี้ก่อนจะนับว่าเต็ม
const float V_RECHARGE = 12.6;   // หลังเต็ม ถ้าแรงดันพักต่ำกว่านี้ ชาร์จต่อ
const float I_SHORT    = 2.2;    // กระแสเกินนี้ = ลัดวงจร
const float T_STOP     = 45.0;   // ร้อนเกิน หยุดชาร์จ
const float T_RESUME   = 40.0;   // เย็นลงแล้ว ชาร์จต่อ
const unsigned long MAX_CHARGE_MS = 20UL * 3600UL * 1000UL;  // ชาร์จนานสุด 20 ชม.
const unsigned long REST_EVERY_MS = 60000UL;                 // ทุก 1 นาที ตัดรีเลย์วัดแรงดันพัก
const unsigned long FULL_HOLD_MS  = 120000UL;                // เงื่อนไขเต็มต้องค้าง 2 นาที

const float CAPS[] = {4.5, 7.0, 9.0, 12.0};   // ความจุแบต (Ah) เลือกด้วยปุ่ม MODE
const byte NUM_CAPS = sizeof(CAPS) / sizeof(CAPS[0]);
byte capIdx = 1;

enum State { NO_BATT, READY, CHARGING, PAUSED, HOT, FULL, FAULT };
State state = NO_BATT;
const char *faultMsg = "";

float vBat = 0, iBat = 0, tempC = 25, vRest = 0;
bool tempOk = false, relayOn = false;
unsigned long tState = 0, tCharge = 0, tLastRest = 0, tFull = 0, tLow = 0, tShort = 0, tLcd = 0;

// ---------- ฮาร์ดแวร์ ----------
float readAvg(byte pin) {
  long sum = 0;
  for (byte i = 0; i < 16; i++) sum += analogRead(pin);
  return sum / 16.0;
}

void measure() {
  float rawI = readAvg(PIN_IBAT);
  iBat = rawI * VCC_REAL / 1023.0 / R_SHUNT;
  // A0 วัดเทียบ GND แต่ขั้วลบแบตลอยอยู่บน R10 จึงต้องลบแรงดันตก I*R ออก
  float vNode = readAvg(PIN_VBAT) * VCC_REAL / 1023.0 * DIV_RATIO * V_CAL;
  vBat = vNode - iBat * R_SHUNT;

  float rawT = readAvg(PIN_TEMP);
  tempOk = rawT > 10 && rawT < 1013;            // ถ้าไม่ได้เสียบ NTC จะข้ามการเช็กอุณหภูมิ
  if (tempOk) {
    float r = R_NTC_PULLUP * rawT / (1023.0 - rawT);
    tempC = 1.0 / (1.0 / 298.15 + log(r / NTC_R0) / NTC_B) - 273.15;
  }
}

void setRelay(bool on) {
  relayOn = on;
  digitalWrite(PIN_RELAY, on ? HIGH : LOW);
}

void beep(byte n, int ms = 120) {
  for (byte i = 0; i < n; i++) {
    digitalWrite(PIN_BUZZ, HIGH); delay(ms);
    digitalWrite(PIN_BUZZ, LOW);  delay(ms);
  }
}

void go(State s) {
  state = s;
  tState = millis();
  setRelay(s == CHARGING);
  if (s == CHARGING && tCharge == 0) tCharge = millis();
  if (s == NO_BATT || s == READY) tCharge = 0;
  tFull = tLow = tShort = 0;
  if (s == FULL) beep(3);
  if (s == FAULT) beep(1, 600);
  lcd.clear();
}

void fault(const char *msg) { faultMsg = msg; go(FAULT); }

// ---------- ปุ่ม (กดลง GND, ใช้ INPUT_PULLUP) ----------
bool pressed(byte pin) {
  static bool last[14];
  static unsigned long tEdge[14];
  bool down = digitalRead(pin) == LOW;
  if (down != last[pin] && millis() - tEdge[pin] > 40) {
    last[pin] = down;
    tEdge[pin] = millis();
    if (down) return true;
  }
  return false;
}

// ---------- การแสดงผล ----------
void fmt(char *out, float v, byte width, byte dec) { dtostrf(v, width, dec, out); }

void drawLcd() {
  char a[8], b[8], line[17];
  lcd.setCursor(0, 0);
  switch (state) {
    case NO_BATT:
      lcd.print(F("Connect battery "));
      lcd.setCursor(0, 1);
      fmt(a, CAPS[capIdx], 4, 1);
      snprintf(line, sizeof line, "Cap %sAh  MODE>", a);
      lcd.print(line);
      break;
    case READY:
      fmt(a, vBat, 5, 2);
      snprintf(line, sizeof line, "Battery %sV  ", a);
      lcd.print(line);
      lcd.setCursor(0, 1);
      lcd.print(vBat < V_DEEP ? F("LOW! START=chg ") : F("Auto start...   "));
      break;
    case CHARGING: {
      fmt(a, vBat, 5, 2); fmt(b, iBat, 4, 2);
      snprintf(line, sizeof line, "CHG %sV %sA", a, b);
      lcd.print(line);
      unsigned long m = (millis() - tCharge) / 60000UL;
      fmt(a, CAPS[capIdx], 4, 1);
      if (tempOk) { fmt(b, tempC, 2, 0); }
      else strcpy(b, "--");
      snprintf(line, sizeof line, "%sAh %sC %02lu:%02lu", a, b, m / 60, m % 60);
      lcd.setCursor(0, 1); lcd.print(line);
      break;
    }
    case PAUSED:
      fmt(a, vBat, 5, 2);
      snprintf(line, sizeof line, "PAUSED %sV  ", a);
      lcd.print(line);
      lcd.setCursor(0, 1); lcd.print(F("START = resume  "));
      break;
    case HOT:
      fmt(a, tempC, 3, 0);
      snprintf(line, sizeof line, "TOO HOT %sC    ", a);
      lcd.print(line);
      lcd.setCursor(0, 1); lcd.print(F("Cooling down... "));
      break;
    case FULL:
      fmt(a, vBat, 5, 2);
      snprintf(line, sizeof line, "FULL %sV     ", a);
      lcd.print(line);
      lcd.setCursor(0, 1); lcd.print(F("Battery charged "));
      break;
    case FAULT:
      lcd.print(F("FAULT:          "));
      lcd.setCursor(6, 0); lcd.print(faultMsg);
      lcd.setCursor(0, 1); lcd.print(F("START = reset   "));
      break;
  }
}

void updateLeds() {
  bool blink = (millis() / 400) % 2;
  bool fast  = (millis() / 120) % 2;
  bool red = false, green = false;
  switch (state) {
    case CHARGING: red = true; break;
    case PAUSED:
    case HOT:      red = blink; break;
    case FAULT:    red = fast; break;
    case FULL:     green = true; break;
    case READY:    green = blink; break;
    default: break;
  }
  digitalWrite(PIN_LED_R, red);
  digitalWrite(PIN_LED_G, green);
}

// ---------- ตั้งค่า ----------
void setup() {
  pinMode(PIN_START, INPUT_PULLUP);
  pinMode(PIN_MODE, INPUT_PULLUP);
  pinMode(PIN_LED_R, OUTPUT);
  pinMode(PIN_LED_G, OUTPUT);
  pinMode(PIN_RELAY, OUTPUT);
  pinMode(PIN_BUZZ, OUTPUT);
  setRelay(false);

  byte saved = EEPROM.read(0);
  if (saved < NUM_CAPS) capIdx = saved;

  lcd.init();
  lcd.backlight();
  lcd.print(F("Smart Charger"));
  lcd.setCursor(0, 1);
  lcd.print(F("12V Lead-Acid"));
  beep(1);
  delay(1200);
  go(NO_BATT);
}

// ---------- วงจรหลัก ----------
void loop() {
  measure();
  unsigned long now = millis();
  bool btnStart = pressed(PIN_START);
  bool btnMode  = pressed(PIN_MODE);

  if (btnMode && state != CHARGING) {
    capIdx = (capIdx + 1) % NUM_CAPS;
    EEPROM.update(0, capIdx);
    beep(1, 40);
  }

  // ป้องกัน: ลัดวงจร / กระแสเกิน
  if (relayOn && iBat > I_SHORT) {
    if (!tShort) tShort = now;
    if (now - tShort > 1500) fault("Overcurrent");
  } else tShort = 0;

  float iFull = max(0.06, CAPS[capIdx] * 0.02);   // กระแสหางเมื่อเต็ม ~0.02C

  switch (state) {
    case NO_BATT:
      if (vBat > V_NO_BATT && now - tState > 1000) go(READY);
      break;

    case READY:
      if (vBat < V_NO_BATT) go(NO_BATT);
      else if (btnStart || (vBat >= V_DEEP && now - tState > 3000)) go(CHARGING);
      break;

    case CHARGING:
      if (btnStart) { go(PAUSED); break; }
      if (tempOk && tempC >= T_STOP) { go(HOT); break; }
      if (now - tCharge > MAX_CHARGE_MS) { fault("Timeout"); break; }

      // ตัดรีเลย์ชั่วครู่เพื่อวัดแรงดันพักจริงของแบต
      if (now - tLastRest > REST_EVERY_MS) {
        setRelay(false);
        delay(2000);
        measure();
        vRest = vBat;
        tLastRest = millis();
        if (vRest < V_NO_BATT) { go(NO_BATT); break; }   // ถอดแบตออกระหว่างชาร์จ
        setRelay(true);
        delay(300);
        measure();
      }

      if (vBat >= V_FULL_CHG && iBat <= iFull) {
        if (!tFull) tFull = now;
        if (now - tFull > FULL_HOLD_MS) go(FULL);
      } else tFull = 0;
      break;

    case PAUSED:
      if (vBat < V_NO_BATT) go(NO_BATT);
      else if (btnStart) go(CHARGING);
      break;

    case HOT:
      if (!tempOk || tempC <= T_RESUME) go(CHARGING);
      break;

    case FULL:
      if (vBat < V_NO_BATT) { go(NO_BATT); break; }
      if (btnStart) { tCharge = 0; go(CHARGING); break; }
      if (vBat < V_RECHARGE) {                 // แบตเริ่มลด ชาร์จเติม
        if (!tLow) tLow = now;
        if (now - tLow > 30000) { tCharge = 0; go(CHARGING); }
      } else tLow = 0;
      break;

    case FAULT:
      if (btnStart) go(vBat > V_NO_BATT ? READY : NO_BATT);
      break;
  }

  updateLeds();
  if (now - tLcd > 500) { tLcd = now; drawLcd(); }
}
