/*
  ===================================================
  Loop2Local — Kiosk ESP32 Controller
  ===================================================
  หน้าที่:
  1. วัดระยะด้วย HC-SR04 → ตรวจจับขวดที่เข้ามา
  2. สั่ง Servo (12kg) ยกขวดเข้าตู้
  3. นับ point สะสม + ส่งขึ้น Firebase Realtime Database
  4. ถ้าไม่มีขวดเข้ามาภายใน 10 วิ → ปิด session (status = waiting_scan)

  Libraries ที่ต้องลงใน Arduino IDE (Library Manager):
  - Firebase ESP32 Client by Mobizt  (ชื่อ: "Firebase ESP Client")
  - ESP32Servo by Kevin Harrington / Jurgen Sm... (ชื่อ: "ESP32Servo")
  ===================================================
*/

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include <ESP32Servo.h>

// ===================== CONFIG: แก้ตรงนี้ก่อนอัพโหลด =====================
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

#define FIREBASE_HOST   "your-project-id-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_API_KEY "YOUR_FIREBASE_WEB_API_KEY"

// ถ้าใช้ Firebase Auth แบบ Email/Password (แนะนำสำหรับงานจริง)
#define FIREBASE_AUTH_EMAIL    "kiosk-device@loop2local.com"
#define FIREBASE_AUTH_PASSWORD "YOUR_DEVICE_PASSWORD"

// ===================== PIN CONFIG =====================
#define TRIG_PIN   5     // HC-SR04 Trig
#define ECHO_PIN   18    // HC-SR04 Echo
#define SERVO_PIN  13    // Servo signal pin

// ===================== TUNABLE PARAMETERS =====================
const float BOTTLE_DETECT_DISTANCE_CM = 10.0;  // ระยะที่ถือว่า "มีขวด" (ปรับตามตำแหน่งเซนเซอร์จริง)
const unsigned long SESSION_TIMEOUT_MS = 10000; // 10 วินาที ไม่มีขวดใหม่ = จบรอบ
const unsigned long DETECT_COOLDOWN_MS = 1500;  // กันนับขวดเดียวซ้ำหลายครั้ง (debounce)
const int POINTS_PER_BOTTLE = 10;
const int SERVO_OPEN_ANGLE = 90;   // มุมตอน "ยก/เปิดทาง" ปรับตามกลไกจริง
const int SERVO_CLOSE_ANGLE = 0;   // มุมตอน "ปิด/พัก"
const int SERVO_MOVE_DELAY_MS = 600; // เวลาที่รอให้ servo หมุนถึงตำแหน่ง

// ===================== GLOBALS =====================
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
Servo bottleServo;

bool sessionActive = false;
String currentSessionId = "";
int bottleCount = 0;
int totalPoints = 0;
unsigned long lastBottleTime = 0;
unsigned long lastDetectTime = 0;

// ===================== SETUP =====================
void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  bottleServo.attach(SERVO_PIN);
  bottleServo.write(SERVO_CLOSE_ANGLE);

  connectWiFi();
  setupFirebase();

  Serial.println("=== ESP32 Kiosk Ready ===");
}

// ===================== MAIN LOOP =====================
void loop() {
  float distance = readDistanceCM();

  bool bottleDetected = (distance > 0 && distance < BOTTLE_DETECT_DISTANCE_CM);

  if (bottleDetected && (millis() - lastDetectTime > DETECT_COOLDOWN_MS)) {
    lastDetectTime = millis();
    onBottleDetected();
  }

  // เช็ค timeout: ถ้า session active แต่ไม่มีขวดเข้ามานานเกินกำหนด → จบรอบ
  if (sessionActive && (millis() - lastBottleTime > SESSION_TIMEOUT_MS)) {
    endSession();
  }

  delay(50); // กัน loop เร็วเกินจำเป็น ลดการอ่าน sensor รัว
}

// ===================== SENSOR =====================
float readDistanceCM() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // timeout 30ms ป้องกันค้าง
  if (duration == 0) return -1; // ไม่เจอ echo (เกินระยะ/ไม่มีอะไรสะท้อน)

  float distanceCM = duration * 0.0343 / 2.0;
  return distanceCM;
}

// ===================== BOTTLE EVENT =====================
void onBottleDetected() {
  Serial.println("[Bottle] Detected!");

  // ถ้ายังไม่มี session ที่ active → เริ่ม session ใหม่
  if (!sessionActive) {
    startNewSession();
  }

  // หมุน servo ยกขวดเข้าตู้
  moveServo();

  // อัพเดทตัวนับ
  bottleCount++;
  totalPoints = bottleCount * POINTS_PER_BOTTLE;
  lastBottleTime = millis();

  Serial.printf("[Bottle] count=%d points=%d\n", bottleCount, totalPoints);

  // ส่งข้อมูลขึ้น Firebase
  updateFirebaseSession();
}

void moveServo() {
  bottleServo.write(SERVO_OPEN_ANGLE);
  delay(SERVO_MOVE_DELAY_MS);
  bottleServo.write(SERVO_CLOSE_ANGLE);
  delay(SERVO_MOVE_DELAY_MS);
}

// ===================== SESSION MANAGEMENT =====================
void startNewSession() {
  sessionActive = true;
  bottleCount = 0;
  totalPoints = 0;
  currentSessionId = generateSessionId();
  lastBottleTime = millis();

  Serial.println("[Session] New session started: " + currentSessionId);

  String path = "/kiosk_sessions/" + currentSessionId;

  FirebaseJson json;
  json.set("status", "active");
  json.set("bottle_count", 0);
  json.set("points", 0);
  json.set("created_at", (int)(millis() / 1000)); // ใช้ relative time; แนะนำเปลี่ยนเป็น real epoch ถ้ามี NTP sync
  json.set("last_bottle_at", (int)(millis() / 1000));
  json.set("user_id", nullptr);

  if (Firebase.RTDB.setJSON(&fbdo, path.c_str(), &json)) {
    Serial.println("[Firebase] Session created OK");
  } else {
    Serial.println("[Firebase] FAILED: " + fbdo.errorReason());
  }
}

void updateFirebaseSession() {
  if (currentSessionId == "") return;

  String path = "/kiosk_sessions/" + currentSessionId;

  FirebaseJson json;
  json.set("bottle_count", bottleCount);
  json.set("points", totalPoints);
  json.set("last_bottle_at", (int)(millis() / 1000));

  if (Firebase.RTDB.updateNode(&fbdo, path.c_str(), &json)) {
    Serial.println("[Firebase] Updated OK");
  } else {
    Serial.println("[Firebase] Update FAILED: " + fbdo.errorReason());
  }
}

void endSession() {
  Serial.println("[Session] Timeout reached. Ending session: " + currentSessionId);

  String path = "/kiosk_sessions/" + currentSessionId;
  Firebase.RTDB.setString(&fbdo, (path + "/status").c_str(), "waiting_scan");

  // รีเซ็ตตัวแปรในตู้ พร้อมรับรอบใหม่
  sessionActive = false;
  currentSessionId = "";
  bottleCount = 0;
  totalPoints = 0;
}

// ===================== HELPERS =====================
String generateSessionId() {
  // สุ่ม 6 ตัวอักษร a-z0-9 — งานจริงควรเช็คชนกันด้วย แต่โอกาสชนต่ำมากพอสำหรับ hackathon
  const char chars[] = "abcdefghijklmnopqrstuvwxyz0123456789";
  String id = "session_";
  for (int i = 0; i < 6; i++) {
    id += chars[random(0, sizeof(chars) - 1)];
  }
  return id;
}

// ===================== WIFI & FIREBASE INIT =====================
void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected: " + WiFi.localIP().toString());
}

void setupFirebase() {
  config.host = FIREBASE_HOST;
  config.api_key = FIREBASE_API_KEY;

  auth.user.email = FIREBASE_AUTH_EMAIL;
  auth.user.password = FIREBASE_AUTH_PASSWORD;

  config.token_status_callback = tokenStatusCallback; // มาจาก addons/TokenHelper.h

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.println("Firebase initialized");
}
