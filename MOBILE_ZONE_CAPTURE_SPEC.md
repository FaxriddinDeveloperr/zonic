# Zonic — Zona egallash (Territory Capture) Flutter implementatsiya spetsifikatsiyasi

> Bu hujjat — Flutter ilovasidagi zona egallash oqimini **to'liq va aniq** ifodalaydi.
> AI yordamchisi (Claude Code) shu hujjat asosida Flutter mijozini to'g'ri yoza oladi.
> Backend tayyor va ishlayapti — bu yerda faqat mijoz nima qilishi yozilgan.

---

## 0. MUHIM: protokol va eng ko'p uchraydigan xatolar

1. **Bu Socket.IO, SignalR EMAS.** Backend NestJS + **Socket.IO** ishlatadi.
   - ✅ Flutter'da **`socket_io_client`** paketini ishlating.
   - ❌ `signalr_netcore` / `signalr` / `HubConnectionBuilder` ISHLATMANG. "Hub" so'zi adashtirмasin — bu oddiy Socket.IO.
2. **`timestamp` aynan `"dd.MM.yyyy HH:mm:ss"` (UTC)** bo'lishi SHART. Boshqa format (ISO va h.k.) bo'lsa, server o'sha GPS nuqtani **jimgina tashlab yuboradi** → halqa yopilmaydi → egallash ishlamaydi.
3. **`SendLocation` ni MASSIV ko'rinishida** yuboring: `[lat, lng, accuracy, speed, timestamp, runTypeId]`.
4. **`StopRun` dan keyin DARHOL socketни uzmang** — avval natija hodisasini (`ZoneCaptured` va h.k.) kuting (timeout ~15s).

---

## 1. Server manzillari
- REST Base URL: `http://89.39.95.172:5065`
- WebSocket URL: `http://89.39.95.172:5065`, namespace **`/hubs/location`**
- Auth: REST'da header `Authorization: Bearer <accessToken>`; WS'da handshake `auth: { access_token: <accessToken> }`

---

## 2. Avtorizatsiya (token olish)

### Login
```
POST /Account/Login
Body: { "userName": "ali", "password": "secret123" }   // ⚠️ "userName" — katta N
```
Javob (200):
```json
{
  "accessToken": "eyJ...",     // <-- WS va REST uchun shuni ishlating
  "token": "eyJ...",            // accessToken bilan bir xil
  "accessTokenExpireAt": "09.06.2026 20:00:00",
  "refreshToken": "base64...",
  "refreshTokenExpireAt": "09.07.2026 20:00:00"
}
```
### Token yangilash (401 kelganда)
```
POST /Account/RefreshToken
Body: { "refreshToken": "<saqlangan refreshToken>" }
```
Javob — Login bilan bir xil.

---

## 3. WebSocket kontrakti

### 3.1. Ulanish
```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

final socket = IO.io('http://89.39.95.172:5065/hubs/location',
  IO.OptionBuilder()
    .setTransports(['websocket'])
    .disableAutoConnect()
    .setAuth({'access_token': accessToken})
    .build());
socket.connect();
```

### 3.2. Serverdan KELADIGAN hodisalar (listen)
| Hodisa | Ma'lumot (data) | Izoh |
|--------|-----------------|------|
| `Connected` | `String socketId` | Ulanish tasdiqlandi (ulanishi bilan keladi) |
| `RunStarted` | `String sessionId` | `StartRun`dan keyin — yugurish boshlandi |
| `RunStopped` | (bo'sh) | `StopRun`dan keyin keladi. ⚠️ Bu YAKUNIY natija EMAS — pastdagi 4 hodisadan birini kuting |
| `ZoneCaptured` | `{ "zoneId": String, "areaKm2": double }` | ✅ Zona egallandi |
| `ZoneNotClosed` | (bo'sh) | ❌ Halqa yopilmagan (boshlanish↔tugash > 150m) |
| `ZoneTooShort` | `{ "minMeters": int }` | ❌ Yugurish < 500m |
| `ZoneNotCaptured`| `{ "reason": String }` yoki bo'sh | ❌ Hudud band (himoyalangan zona) yoki server xatosi |
| `ZoneUpdated` | `List<ZoneItem>` | Atrofda zona o'zgardi → xaritani qayta yuklang (`GetArea`) |

```dart
socket.on('Connected',     (id) { /* tayyor */ });
socket.on('RunStarted',    (sessionId) { /* timer/UI boshlang */ });
socket.on('RunStopped',    (_) { /* hali kutiladi */ });
socket.on('ZoneCaptured',  (d) { final id = d['zoneId']; final area = d['areaKm2']; /* GetArea qayta yukla */ });
socket.on('ZoneNotClosed', (_) { /* "Boshlanish nuqtasiga 150m yaqinlashing" */ });
socket.on('ZoneTooShort',  (d) { /* "Kamida ${d['minMeters']}m yuguring" */ });
socket.on('ZoneNotCaptured',(d) { /* "Bu hudud band" */ });
socket.on('ZoneUpdated',   (zones) { /* xaritadagi zonalarni yangilang */ });
```

### 3.3. Serverga YUBORILADIGAN hodisalar (emit)
| Hodisa | Yuborish | Izoh |
|--------|----------|------|
| `StartRun` | `socket.emit('StartRun', [1])` | 1 = Zone Capture, 2 = Free Run |
| `SendLocation` | `socket.emit('SendLocation', [lat, lng, accuracy, speed, timestamp, runTypeId])` | har ~1 sekund |
| `StopRun` | `socket.emit('StopRun')` | argumentsiz |

> `StartRun` va `SendLocation` 3 xil formatда qabul qilinadi (massiv / obyekt / pozitsion), lekin **massiv** eng ishonchli.

### 3.4. timestamp formati (MAJBURIY)
```dart
String _two(int n) => n.toString().padLeft(2, '0');
String formatTs(DateTime t) {
  final u = t.toUtc();
  return '${_two(u.day)}.${_two(u.month)}.${u.year} '
         '${_two(u.hour)}:${_two(u.minute)}:${_two(u.second)}';
}
// Natija: "09.06.2026 14:57:10"
```

---

## 4. To'liq oqim (state machine)

```
1. Login qilingan, accessToken bor.
2. socket.connect()  →  'Connected' hodisasini kut.
3. Foydalanuvchi "BOSHLASH" bosadi:
      emit('StartRun', [1])
      'RunStarted' ni kut (timeout 10s) → sessionId saqla.
4. Yugurish davomida (har ~1 sekund, GPS yangilanганда):
      emit('SendLocation', [lat, lng, accuracy, speed, formatTs(DateTime.now()), 1])
      (UI'da masofa/vaqtни ko'rsat)
5. Foydalanuvchi "TUGATISH" bosadi:
      a) OXIRGI GPS nuqtани yubor (emit SendLocation ...).
      b) ~600ms kut (oxirgi nuqta serverga yetib borishi uchun).
      c) emit('StopRun')
      d) Quyidagilardан BIRINI kut (timeout 15s):
           ZoneCaptured   → "Tabriklaymiz!" + GetArea qayta yukla
           ZoneNotClosed  → "Halqani yoping (≤150m)"
           ZoneTooShort   → "Kamida 500m yuguring"
           ZoneNotCaptured→ "Bu hudud band"
      e) ⚠️ Natija kelmaguncha socketни UZMA.
6. Istalgan vaqtда 'ZoneUpdated' kelса → joriy xarita uchun GetArea qayta yukla.
7. BEKOR QILISH (saqlamasdan chiqish): socket.disconnect() — server sessiyani o'chiradi.
```

### Frontend tekshiruvlari (ixtiyoriy, lekin tavsiya — UX uchun)
- "TUGATISH" bosилганда: `distance(points.first, points.last)` ni hisoblang.
  - `> 150m` bo'lsa: dialog ko'rsating ("Boshlanishga yaqinlashing yoki bekor qiling"). Server baribir `ZoneNotClosed` qaytaradi.
- Umumiy masofa `< 500m` bo'lsa: ogohlantiring (server `ZoneTooShort` qaytaradi).

---

## 5. To'liq Dart namunasi (socket_io_client)

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

class ZoneRunService {
  late IO.Socket socket;
  final String base = 'http://89.39.95.172:5065';

  void connect(String token) {
    socket = IO.io('$base/hubs/location',
      IO.OptionBuilder()
        .setTransports(['websocket'])
        .disableAutoConnect()
        .setAuth({'access_token': token})
        .build());

    socket.onConnect((_) => print('WS connected'));
    socket.on('Connected', (id) => print('socketId=$id'));
    socket.on('RunStarted', (sid) => _onRunStarted(sid as String));
    socket.on('RunStopped', (_) {});
    socket.on('ZoneCaptured', (d) => _onResult('captured', d));
    socket.on('ZoneNotClosed', (_) => _onResult('notClosed', null));
    socket.on('ZoneTooShort', (d) => _onResult('tooShort', d));
    socket.on('ZoneNotCaptured', (d) => _onResult('notCaptured', d));
    socket.on('ZoneUpdated', (zones) => _reloadMap());

    socket.connect();
  }

  String _two(int n) => n.toString().padLeft(2, '0');
  String _ts(DateTime t) {
    final u = t.toUtc();
    return '${_two(u.day)}.${_two(u.month)}.${u.year} ${_two(u.hour)}:${_two(u.minute)}:${_two(u.second)}';
  }

  void startRun() => socket.emit('StartRun', [1]);

  void sendLocation(double lat, double lng, double accuracy, double speed) {
    socket.emit('SendLocation', [lat, lng, accuracy, speed, _ts(DateTime.now()), 1]);
  }

  Future<void> stopRun() async {
    await Future.delayed(const Duration(milliseconds: 600)); // oxirgi nuqta yetib borsin
    socket.emit('StopRun');
    // natija hodisalari _onResult orqali keladi (timeout 15s o'zingiz qo'shing)
  }

  void cancel() => socket.disconnect(); // server sessiyani o'chiradi

  void _onRunStarted(String sessionId) { /* ... */ }
  void _onResult(String type, dynamic data) { /* UI yangilang */ }
  void _reloadMap() { /* GetArea qayta yukla */ }
}
```

---

## 6. Xaritadagi zonalar (REST)

### 6.1. Ko'rinib turgan hudud → GetArea
```
GET /Zone/GetArea?minLat=41.30&minLng=69.20&maxLat=41.34&maxLng=69.28
Header: Authorization: Bearer <accessToken>
```
Javob (200) — `ZoneItem` massivi:
```json
[
  {
    "zoneId": "uuid",
    "ownerUserId": "uuid",
    "ownerUsername": "ali",
    "color": "#FF5500",
    "areaKm2": 0.45,
    "capturedAt": "09.06.2026",
    "pathPolygon": [ {"lat":41.311,"lng":69.240}, {"lat":41.312,"lng":69.241}, ... ]
  }
]
```
- `pathPolygon` — poligon konturidagi nuqtalar. Xaritada **Polygon** sifatida chizing, ichini `color` bilan bo'yang.
- ⚠️ Birlashган zona (MultiPolygon) bir necha element bo'lib, **bir xil `zoneId`** bilan keladi — har birini alohida poligon qiling.

### 6.2. Mening zonalarim → GetMyZones
```
GET /Zone/GetMyZones    → javob 6.1 bilan bir xil, faqat foydalanuvchiniki
```

### 6.3. Zonaga bosilganda → Details
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
  "capturedAt": "09.06.2026 15:30:00"
}
```
- `ownerAvatarUrl` oldiga base qo'shing: `http://89.39.95.172:5065` + `ownerAvatarUrl` (rasmga ham `Authorization: Bearer` kerak). `null` bo'lsa — avatar yo'q.

### 6.4. Foydalanuvchi rangi (zona rangi)
```
PUT /User/UpdateMe        Body: { "color": "#FF5500" }   // #RRGGBB
GET /UserProfile/GetMe    → javobda "color"
```
Rang o'zgartirilса — foydalanuvchining BARCHA zonalari shu rangга o'tadi.

---

## 7. Server qoidalari (avtomatik — frontend bilishi foydali)

- Halqa **≤150m** yopilishi shart → aks holda `ZoneNotClosed`.
- Yugurish masofasi **≥500m** → aks holda `ZoneTooShort`.
- Zona = yugurilган yo'l ichidagi **to'ldirilган maydon** (poligon).
- Boshqaning zonasини olish: masofangiz **egasinikidan ≥1.4×** ko'p bo'lsa — egallaysiz/kesib olasiz; kam bo'lsa — sizning zonangiz uning chegarasidан kesiladi.
- To'liq qoplab egallash: `yugurish_km ≥ maydon_km² × 1.33`.
- O'z zonalaringiz tegса yoki markazlari **≤500m** bo'lsa — avtomatik **birlashadi**.

### SendLocation server-side filtrlari (mijoz o'ylamasligi mumkin, lekin bilса foydali)
- `accuracy > 50m` → nuqta tashlanadi.
- `speed > 12 m/s` → tashlanadi.
- sekundiga 1 martadan tez → ortig'i tashlanadi.
- `timestamp` formati noto'g'ri → tashlanadi.

---

## 8. Eslatma: "Hub disconnected" muammosi (tuzatilган)
Ilgari `StopRun`dan keyin server ba'zan socketни uzib qo'yardi va hech qanday hodisa qaytmasdi.
Bu **backendда tuzatildi** (2026-06-09): endi har qanday holatда socket uzilmaydi va doim
yuqoridagi 4 natija hodisasidан biri qaytadi. Agar baribir natija kelmasa — bu mijoz tomonidagi
xato (masalan socket natija kelmasdан uzilган, yoki timestamp formati noto'g'ri → nuqtalar
tushib qolган → halqa yopilmagan).
```
