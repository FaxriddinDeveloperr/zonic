# Zonic Backend — Yangi endpointlar (Profile + Free Run)

> Mobil dasturchi so'ragan, oldin **404** bo'lgan 7 ta endpoint endi tayyor.
> Barchasi `Authorization: Bearer <accessToken>` header talab qiladi.
> Base URL: `http://SERVER_IP:5065`.

> ⚠️ **Auth 500 muammosi:** oldin `Login/Register/GoogleLogin` 500 qaytarardi — bu DB ustun
> yetishmasligidan edi, migration bilan tuzatildi. Server qayta deploy qilingach 500 yo'qoladi.

---

## 1. GET /UserProfile/GetMe
Joriy foydalanuvchi profili.
```json
// 200
{ "username": "aliuser", "email": "ali@example.com", "phone": "+998901234567",
  "avatarFileId": "uuid.png" }   // avatar yuklanmagan bo'lsa null
```

## 2. PUT /User/UpdateMe
Profilni yangilash (barcha maydon ixtiyoriy).
```json
// Request
{ "username": "yangi", "email": "y@x.com", "phone": "+998900000000",
  "oldPassword": "joriy", "newPassword": "yangiParol" }
```
- Parol o'zgartirish uchun **`oldPassword` + `newPassword`** ikkalasi (yangi ≥6 belgi). Eski noto'g'ri → 400.
- Faqat profil maydonini o'zgartirsa, parol maydonlari yuborilmasin.
- Javob: **200** (bo'sh body).

## 3. POST /UserProfile/UploadAvatar
`multipart/form-data`, form maydoni nomi **`file`**. Ruxsat: jpeg/png/webp/gif/heic, max **5 MB**.
```json
// 200
{ "fileId": "uuid.png" }
```
```dart
final form = FormData.fromMap({'file': await MultipartFile.fromFile(path, filename: 'avatar.png')});
final fileId = (await dio.post('/UserProfile/UploadAvatar', data: form)).data['fileId'];
```

## 4. GET /UserProfile/DownloadAvatar?fileId=uuid.png
Binar rasm oqimi (`Content-Type: image/...`).
```dart
Image.network('$base/UserProfile/DownloadAvatar?fileId=$fileId',
  headers: {'Authorization': 'Bearer $token'});
```

---

## Free Run — sana formati
- **Javoblarda:** ISO 8601 (`2026-06-07T09:20:00.000Z`) — `DateTime.parse()` to'g'ridan o'qiydi.
- **Yuborishda:** ISO 8601 **yoki** `dd.MM.yyyy HH:mm:ss` — ikkalasi ham qabul qilinadi.

## 5. POST /FreeRun/Save
```json
// Request
{ "startTime": "2026-06-07T09:20:00.000Z", "endTime": "2026-06-07T09:30:00.000Z",
  "durationSeconds": 600, "paceMinPerKm": 5.2, "averageSpeedKmh": 11.5,
  "routePoints": [ { "lat": 41.311081, "lng": 69.240562, "ts": "2026-06-07T09:20:00.000Z" } ] }
```
- `paceMinPerKm`, `averageSpeedKmh` — ixtiyoriy.
- `distanceKm` backendda route nuqtalaridan (haversine) hisoblanadi — yuborish shart emas.
- Javob 200: `{ "id": "run-uuid" }`.

## 6. GET /FreeRun/GetHistory?Page=1&PageSize=20
```json
// 200
{ "items": [
  { "id": "uuid", "startTime": "2026-06-07T09:20:00.000Z", "endTime": "2026-06-07T09:30:00.000Z",
    "durationSeconds": 600, "paceMinPerKm": 5.2, "averageSpeedKmh": 11.5, "distanceKm": 1.91,
    "routePoints": [ { "lat": 41.311081, "lng": 69.240562, "ts": "2026-06-07T09:20:00.000Z" } ] } ] }
```

## 7. GET /FreeRun/GetLeaderboard?Page=1&PageSize=20
```json
// 200
{ "items": [
  { "rank": 1, "userId": "uuid", "username": "ali", "totalDistanceKm": 47.3,
    "totalRuns": 12, "bestPaceMinPerKm": 4.15, "averageSpeedKmh": 12.4 } ] }
```
- `bestPaceMinPerKm` — eng tez (eng kichik) temp.
- `Page`/`PageSize` katta yoki kichik harf bilan — ikkalasi ham ishlaydi.

---

---

# Territory Capture (hudud egallash) — zona endpointlari

> Zona tizimi geohash kataklardan **PostGIS poligonlar**ga o'tdi. Egallash yugurish
> tugaganda (`StopRun`) butun yo'ldan poligon yasab hisoblanadi.

## 8. GET /Zone/GetArea?minLat=&minLng=&maxLat=&maxLng=
Xaritada ko'rinib turgan to'rtburchak (bbox) ichidagi zonalar.
```json
// 200
[
  { "zoneId": "uuid", "ownerUserId": "uuid", "ownerUsername": "ali",
    "color": "#FF5500", "areaKm2": 0.45, "capturedAt": "07.06.2026",
    "pathPolygon": [ {"lat":41.311,"lng":69.240}, {"lat":41.312,"lng":69.241}, ... ] }
]
```
- `pathPolygon` — poligon konturidagi nuqtalar (Yandex `MapObjectCollection` poligon sifatida chizing).
- Zona **birlashgan (MultiPolygon)** bo'lsa, har bir bo'lak alohida element bo'lib, **bir xil `zoneId`** bilan keladi.

## 9. GET /Zone/GetMyZones
Javob 8 bilan bir xil (`pathPolygon[]`), faqat foydalanuvchining zonalari.

## 10. GET /Zone/Details/:id
Zonaga bosilganda chiqadigan karta.
```json
// 200
{ "zoneId": "uuid", "ownerUserId": "uuid", "ownerUsername": "ali",
  "ownerAvatarUrl": "/UserProfile/DownloadAvatar?fileId=uuid.png",
  "areaKm2": 0.45, "capturedAt": "07.06.2026 15:30:00" }
```

## 11. Zona rangi
Foydalanuvchining shaxsiy rangi `PUT /User/UpdateMe` orqali o'rnatiladi: `{"color":"#FF5500"}`.
Rang o'zgarsa — **barcha zonalari** shu rangga o'tadi. `GetMe` da `color` qaytadi.

## 12. WebSocket — yugurish (zona egallash)
`StartRun(1)` (1 = Zone Capture) → har sekund `SendLocation(...)` → `StopRun`.
**`StopRun`dan keyin serverdan keladigan hodisalar:**
| Hodisa | Ma'no |
|--------|-------|
| `ZoneCaptured` `{zoneId, areaKm2}` | zona muvaffaqiyatli egallandi |
| `ZoneNotClosed` | halqa yopilmadi (start↔finish > 150m) — saqlanmadi |
| `ZoneNotCaptured` | halqa yopildi, lekin hudud to'liq himoyalangan zonalar bilan band — saqlanmadi |
| `ZoneUpdated` `[ZoneItem...]` | atrofdagi zona o'zgardi — xaritani yangilang (GetArea qayta yuklang) |

**Qoidalar (serverda avtomatik):** halqa ≤150m yopilishi; egallab olish uchun masofa egasiникidан ≥1.4× ko'p; to'liq qoplab egallash (maydon km²×1.33); kesib olish; bir foydalanuvchi zonalari ≤500m markaz/tegishda birlashadi.

---

## Serverda qo'llash (deploy)
```bash
# 1) PostGIS (zona poligonlari uchun SHART — bir marta):
sudo apt update && sudo apt install -y postgresql-14-postgis-3
# 2) Kod:
cd ~/zonic
git pull
npm install
npm run build
# 3) Migratsiyalar (idempotent — qayta ishlatsa zarari yo'q):
sudo -u postgres psql -d zonic < migrations/002_free_run.sql
sudo -u postgres psql -d zonic < migrations/003_territory.sql
# 4) Qayta ishga tushirish:
pm2 restart zonic-nest --update-env
```
> Avatar fayllari serverda `~/zonic/uploads/avatars/` ichida saqlanadi (git'ga tushmaydi).
> Eski geohash zonalar yangi tizimga ko'chmaydi — toza boshlanadi (kelishilgan).
