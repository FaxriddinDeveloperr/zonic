# Zonic — Zona egallash (Territory Capture) Flutter ulash yo'riqnomasi

> Bu faylni Flutter dasturchiga to'liq bering. Yugurish boshlanishidan zona egallashgacha
> har bir qadam: qaysi API/hodisa, qachon, qanday yuboriladi va qanday javob keladi.

## 0. Umumiy

- **REST Base URL:** `http://SERVER_IP:5065`
- **WebSocket URL:** `http://SERVER_IP:5065`, namespace **`/hubs/location`**
- **Avtorizatsiya (REST):** har so'rovga header `Authorization: Bearer <accessToken>`
- **Avtorizatsiya (WS):** handshake `auth: { access_token: <accessToken> }`
- **Paketlar:** `socket_io_client` (WS), `dio` yoki `http` (REST)
- **Sana formati (WS):** `SendLocation`dagi `timestamp` aynan **`"dd.MM.yyyy HH:mm:ss"`** bo'lishi shart.

---

## 1. Bir martalik sozlash (yugurishdan oldin)

### Foydalanuvchi rangi (zona rangi)
Har bir foydalanuvchining shaxsiy rangi bor — uning barcha zonalari shu rangда chiziladi.
```
PUT /User/UpdateMe
Body: { "color": "#FF5500" }   // #RRGGBB
```
Rangni o'qish: `GET /UserProfile/GetMe` → javobda `"color": "#FF5500"`.
> Rang o'zgartirilsa, foydalanuvchining BARCHA eski zonalari ham avtomatik shu rangga o'tadi.

---

## 2. Yugurish oqimi (eng asosiy qism)

### 2.1. WebSocket'ga ulanish
```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

final socket = IO.io('http://SERVER_IP:5065/hubs/location',
  IO.OptionBuilder()
    .setTransports(['websocket'])
    .disableAutoConnect()
    .setAuth({'access_token': accessToken})   // JWT shu yerda
    .build());
socket.connect();
```

### 2.2. Serverdan KELADIGAN hodisalarni tinglang
| Hodisa | Ma'lumot | Qachon / nima qilish |
|--------|----------|----------------------|
| `Connected` | `socketId` (string) | Ulanish tasdiqlandi |
| `RunStarted` | `sessionId` (string) | `StartRun`dan keyin — yugurish boshlandi |
| `RunStopped` | (bo'sh) | `StopRun`dan keyin — sessiya yopildi |
| `ZoneCaptured` | `{ "zoneId": "...", "areaKm2": 0.45 }` | ✅ Zona egallandi! Xaritani yangilang |
| `ZoneNotClosed` | (bo'sh) | ❌ Halqa yopilmagan (start↔finish > 150m). Foydalanuvchiga ayting |
| `ZoneTooShort` | `{ "minMeters": 500 }` | ❌ Yugurish juda qisqa. "Kamida 500m yuguring" |
| `ZoneNotCaptured` | (bo'sh) | ❌ Hudud band (boshqaning himoyalangan zonasi). Egallanmadi |
| `ZoneUpdated` | `[ZoneItem, ...]` | Atrofda zona o'zgardi → xaritani qayta yuklang (`GetArea`) |

```dart
socket.on('Connected', (id) { /* ulandi */ });
socket.on('RunStarted', (sessionId) { /* timer/UI boshlang */ });
socket.on('ZoneCaptured', (d) { /* d['zoneId'], d['areaKm2'] → GetArea qayta yuklang */ });
socket.on('ZoneNotClosed', (_) { /* "Boshlanish nuqtasiga 150m yaqinlashing" */ });
socket.on('ZoneTooShort', (d) { /* "Kamida ${d['minMeters']}m yuguring" */ });
socket.on('ZoneNotCaptured', (_) { /* "Bu hudud band" */ });
socket.on('ZoneUpdated', (zones) { /* xaritadagi zonalarni yangilang */ });
socket.on('RunStopped', (_) { /* UI ni yakunlang */ });
```

### 2.3. Yugurishni boshlash → `StartRun`
Foydalanuvchi "Boshlash" bosganda:
```dart
socket.emit('StartRun', [1]);   // 1 = Zone Capture (zona egallash)
// Server javob: 'RunStarted' hodisasi (sessionId bilan)
```

### 2.4. Yugurish davomida → har ~1 sekundда `SendLocation`
GPS har yangilanганда (sekundiga 1 marta) nuqta yuboring. **Massiv** ko'rinishida:
```dart
// Tartib MUHIM: [lat, lng, accuracy, speed, timestamp, runTypeId]
socket.emit('SendLocation', [
  position.latitude,            // double
  position.longitude,          // double
  position.accuracy,           // double — metrda (50 dan katta bo'lsa server tashlaydi)
  position.speed,              // double — m/s
  formatTime(DateTime.now()),  // "dd.MM.yyyy HH:mm:ss"  ⚠️ aynan shu format
  1,                           // runTypeId = 1
]);
```
`formatTime` namunasi (sana formati MUHIM):
```dart
String two(int n) => n.toString().padLeft(2, '0');
String formatTime(DateTime t) {
  final u = t.toUtc();
  return '${two(u.day)}.${two(u.month)}.${u.year} ${two(u.hour)}:${two(u.minute)}:${two(u.second)}';
}
```
> Server avtomatik filtrlaydi: aniqlik (accuracy) 50m dan yomon, tezlik 12 m/s dan tez,
> yoki sekundiga 1 martadan tez kelgan nuqtalar tashlanadi. Buni o'ylab o'tirmang — shunchaki yuboravering.

### 2.5. Yugurishni tugatish → `StopRun`
Foydalanuvchi "Tugatish" bosganda (oxirgi nuqtani yuborib bo'lгач):
```dart
socket.emit('StopRun');
// Server javob (BIRORTASI keladi):
//   ZoneCaptured   → muvaffaqiyat
//   ZoneNotClosed  → halqa yopilmagan
//   ZoneTooShort   → < 500m
//   ZoneNotCaptured→ hudud band
```
> ⚠️ **Muhim:** "Tugatish" uchun halqa yopiq bo'lishi kerak — boshlanish va tugash nuqtasi
> orasi **≤150 metr**. Frontendда ham buni tekshirib, foydalanuvchini ogohlantirsangiz yaxshi.

### 2.6. Yugurishni bekor qilish (cancel)
Agar foydalanuvchi yugurishni saqlamasdan chiqsa — shunchaki socketni uzing:
```dart
socket.disconnect();   // server tugatilmagan sessiyani avtomatik o'chiradi (history'ga tushmaydi)
```

---

## 3. Xaritadagi zonalar (REST)

### 3.1. Ko'rinib turgan hududdagi zonalar → `GetArea`
Xarita siljiganda/zoomlanganда, ko'rinib turgan to'rtburchak (bounding box) bo'yicha:
```
GET /Zone/GetArea?minLat=41.30&minLng=69.20&maxLat=41.34&maxLng=69.28
```
Javob (200) — har bir zona:
```json
[
  {
    "zoneId": "uuid",
    "ownerUserId": "uuid",
    "ownerUsername": "ali",
    "color": "#FF5500",
    "areaKm2": 0.45,
    "capturedAt": "07.06.2026",
    "pathPolygon": [ {"lat":41.311,"lng":69.240}, {"lat":41.312,"lng":69.241}, ... ]
  }
]
```
- `pathPolygon` — poligon konturidagi nuqtalar. Yandex Map'da **Polygon** sifatida chizing, ichini `color` bilan bo'yang.
- ⚠️ Bir zona **birlashган** bo'lsa (MultiPolygon), u bir necha element bo'lib qaytadi, hammasiда **bir xil `zoneId`**. Har bir elementni alohida poligon qilib chizing.

### 3.2. Mening zonalarim → `GetMyZones`
```
GET /Zone/GetMyZones      → javob 3.1 bilan bir xil, faqat foydalanuvchiniki
```

### 3.3. Zonaga bosilganda → `Details`
Foydalanuvchi xaritadagi poligonga bosсa, karta ko'rsatish uchun:
```
GET /Zone/Details/{zoneId}
```
Javob (200):
```json
{
  "zoneId": "uuid",
  "ownerUserId": "uuid",
  "ownerUsername": "ali",
  "ownerAvatarUrl": "/UserProfile/DownloadAvatar?fileId=uuid.png",
  "areaKm2": 0.45,
  "capturedAt": "07.06.2026 15:30:00"
}
```
- `ownerAvatarUrl` to'liq URL emas — oldiga base qo'shing: `http://SERVER_IP:5065` + `ownerAvatarUrl`
  (rasm so'rovida ham `Authorization: Bearer` kerak). `null` bo'lsa — avatar yo'q.

---

## 4. To'liq oqim (flow) — qisqacha

1. (Bir marta) Rangni o'rnating: `PUT /User/UpdateMe {color}`.
2. Xarita ochilganда: `GET /Zone/GetArea?bbox` → poligonlarni chizing.
3. "Boshlash" → WS ulang → `StartRun([1])` → `RunStarted` keladi.
4. Har sekund: `SendLocation([lat,lng,accuracy,speed,timestamp,1])`.
5. "Tugatish" → `StopRun` →
   - `ZoneCaptured` → "Tabriklaymiz!" + `GetArea` qayta yuklang.
   - `ZoneNotClosed` / `ZoneTooShort` / `ZoneNotCaptured` → tegishli xabar.
6. `ZoneUpdated` kelganда (boshqa o'yinchi atrofда zona oldi) → `GetArea` qayta yuklang.
7. Zonaga bosilганда: `GET /Zone/Details/{id}` → karta.

---

## 5. Server qoidalari (avtomatik — frontend bilishi foydali)

- Halqa **≤150m** yopilishi shart, aks holda `ZoneNotClosed`.
- Yugurish **≥500m** bo'lishi kerak, aks holda `ZoneTooShort`.
- Zona = yugurilган yo'l ichidagi **to'ldirilган maydon** (poligon).
- Boshqaning zonasини olish: masofangiz **egasinikidan ≥1.4 barobar** ko'p bo'lsa — egallaysiz/kesib olasiz; kam bo'lsa — sizning zonangiz uning chegarasidан kesiladi.
- To'liq qoplab egallash: yugurish_km **≥ maydon_km² × 1.33**.
- O'z zonalaringiz tegса yoki markazlari **≤500m** bo'lsa — avtomatik **birlashadi**.

---

## 6. SendLocation formati haqida (texnik eslatma)

Server `SendLocation` va `StartRun` uchun **3 xil formatni** qabul qiladi — qaysi biri qulay bo'lsa:
- Massiv (tavsiya): `socket.emit('SendLocation', [lat, lng, accuracy, speed, timestamp, runTypeId])`
- Obyekt: `socket.emit('SendLocation', {'lat':.., 'lng':.., 'accuracy':.., 'speed':.., 'timestamp':'..', 'runTypeId':1})`
- `StartRun`: `emit('StartRun', [1])` yoki `emit('StartRun', 1)` yoki `emit('StartRun', {'runTypeId':1})`.

Hammasi ishlaydi — `socket_io_client` uchun **massiv** ko'rinishi eng ishonchli.
