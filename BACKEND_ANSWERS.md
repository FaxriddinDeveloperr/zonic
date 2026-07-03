# ZONIC — Backend javoblari (mobil integratsiya)

> `BACKEND_QUESTIONS.md` ga javob. Har bir raqam savol raqamiga mos.
> Barchasi **joriy server kodidan** tekshirildi (kod fayllari bilan).

---

## 1. ✅ Zona egallash natijasi (WebSocket) — HA, event bor

Server run tugaganda (`StopRun`) **har doim `RunStopped`** yuboradi, keyin **zone-capture run uchun aynan bittasini** yuboradi:

| Holat | Event | Payload |
|---|---|---|
| ✅ Egallandi | **`ZoneCaptured`** | `{ "zoneId": "uuid", "areaKm2": 0.1234 }` |
| ❌ Loop yopilmadi (start↔finish > 150 m) | **`ZoneNotClosed`** | *(payload yo'q)* |
| ❌ Masofa kam (< 500 m) | **`ZoneTooShort`** | `{ "minMeters": 500, "ranMeters": 320 }` |
| ❌ Yopildi-yu bloklangan/yaroqsiz | **`ZoneNotCaptured`** | *(payload yo'q)*, yoki server xatosida `{ "reason": "server_error" }` |

**Muhim:** `areaKm2` — km², 4 kasr aniqlik (masalan `0.1234`). `zoneId` — UUID.
Muvaffaqiyatsiz bo'lsa run **saqlanmaydi** (tarixga tushmaydi), qayta urinish uchun yangi `StartRun` kerak.

### `ZoneUpdated` bu boshqa narsa (broadcast)
Kimdir siz turgan hudud yaqinida zona egallasa, sizga **`ZoneUpdated`** keladi — bu **xaritani yangilash** uchun, to'liq polygon(lar) bilan (o'zingizning natijangiz emas — u `ZoneCaptured`):
```json
// ZoneUpdated payload — ZoneItemDto[]
[
  {
    "zoneId": "uuid", "ownerUserId": "uuid", "ownerUsername": "ali",
    "color": "#3B82F6", "areaKm2": 0.45, "capturedAt": "30.06.2026",
    "pathPolygon": [ { "lat": 41.31, "lng": 69.24 }, ... ]
  }
]
```

### To'liq WebSocket kontrakti (yangilangan)
**Client → Server (emit):**
- `StartRun` — `1` yoki `{ "runTypeId": 1 }` (1 = Zone Capture, 2 = Free Run)
- `StopRun` — argumentsiz
- `SendLocation` — obyekt: `{ lat, lng, accuracy, speed, timestamp, runTypeId }` (`timestamp`: `dd.MM.yyyy HH:mm:ss`)

**Server → Client (on):**
- `Connected` — socketId (string)
- `RunStarted` — sessionId (string)
- `RunStopped` — (payload yo'q) — har run oxirida
- `ZoneCaptured` / `ZoneNotClosed` / `ZoneTooShort` / `ZoneNotCaptured` — yuqoridagi jadval
- `ZoneUpdated` — `ZoneItemDto[]` (yaqin-atrofdagi o'zgarish)

> Ya'ni "Zona egallandi" ekranida `ZoneCaptured.areaKm2` ni ko'rsating; muvaffaqiyatsizda `ZoneTooShort.ranMeters`/`minMeters` bilan sababni ko'rsating.

---

## 2. ✅ Zona qoidalari (server qiymatlari — aniq)

| Qoida | Server qiymati | Izoh |
|---|---|---|
| **Minimal yugurish masofasi** | **500 m** | ⚠️ Client'da **550** turibdi — **500** ga o'zgartiring |
| **Loop closure radiusi** | **150 m** | ✅ Client bilan mos |
| **Accuracy filtri (max)** | **50 m** | Undan yomon (kattaroq) nuqtalar tashlanadi |
| **Tezlik chegarasi** | **12 m/s** | + "sakrash" tekshiruvi: 2× = **24 m/s** dan oshsa tashlanadi |
| **Rate-limit** | **1 soniya** | Har foydalanuvchidan minimal interval |

Manba: server `.env` (`GAME_MIN_RUN_DISTANCE_M=500`, `GAME_CLOSE_LOOP_DISTANCE_M=150`, `GAME_MIN_ACCURACY_METERS=50`, `GAME_MAX_SPEED_MPS=12`, `GAME_RATE_LIMIT_SECONDS=1`).

> Client GPS oqimini yuboraversin — server o'zi filtrlaydi. Faqat **minimal masofani 500 m** ga to'g'rilang.

---

## 3. Base URL / muhit

- **Hozirgi ishlayotgan:** `http://89.39.95.172:5065` (kodda ham shu).
- **HTTPS:** app'ning o'zida yo'q — production'da **nginx + Let's Encrypt** bilan qo'yiladi (tavsiya: iOS/Android `http`ni bloklaydi).
- **Staging/prod alohida:** hozircha bitta muhit.

> 👉 **Backend egasi tasdiqlaydi:** production'da domen (`https://api.zonic.uz`) ishga tushsa — o'shani ishlating; hozircha `http://89.39.95.172:5065`.

---

## 4. Avatar / rasm URL (boshqalar)

- **Boshqa foydalanuvchi avatari** (do'st / feed muallifi / zona egasi): **xuddi shu** `GET /UserProfile/DownloadAvatar?fileId=<avatarFileId>` — **egalik tekshiruvi yo'q**, istalgan `fileId`ni beradi. **Token kerak** (Bearer).
  - Zona `Details` javobidagi `ownerAvatarUrl` shu formatda tayyor URL beradi.
- **Feed rasmi:** `GET /Feed/Image?fileId=<id>` — **token TALAB QILADI** (public emas). Har ikkalasiga ham `Authorization: Bearer ...` qo'shing.

> Eslatma: rasm endpointlari token so'ragani uchun `<img>`/`Image.network`da header berish kerak (Dart'da `Image.network(url, headers: {...})` yoki avval baytlarni yuklab olish).

---

## 5. ✅ Sana formati

- **Ikkalasi ham qabul qilinadi:** `dd.MM.yyyy HH:mm:ss` **VA** ISO 8601 (`2026-06-30T08:00:00.000Z`).
- **Tavsiya: ISO 8601** yuboring (eng ishonchli, Dart `DateTime.toUtc().toIso8601String()`).
- **Javoblarda:** FreeRun/Steps tarixi **ISO** qaytaradi; Stats/ActivityHistory/PersonalBests **`dd.MM.yyyy`** (faqat ko'rsatish uchun string — `DateTime.parse` qilmang).
- **Faqat WebSocket `SendLocation.timestamp`** — `dd.MM.yyyy HH:mm:ss` (yoki ISO ham ishlaydi).

---

## 6. Real JSON namunalar (joriy)

### `GET /UserProfile/GetStats?dimension=running&period=weekly`
```json
{
  "dimension": "running", "period": "weekly", "unit": "km",
  "summary": { "activityCount": 5, "totalDistanceKm": 40.8, "avgDistanceKm": 8.16,
    "avgSpeedKmh": 11.14, "avgPaceMinPerKm": 5.42, "totalDurationSeconds": 10200,
    "avgDuration": "00:34:00", "totalAreaKm2": 0, "avgAreaKm2": 0, "totalSteps": 0, "avgSteps": 0 },
  "chart": [ { "label": "24.06", "value": 0 }, { "label": "25.06", "value": 9.5 } ]
}
```
### `GET /UserProfile/GetPersonalBests`
```json
{ "fastestSpeedKmh": { "value": 12.5, "date": "27.06.2026" },
  "longestDistanceKm": { "value": 14.2, "date": "27.06.2026" },
  "largestTerritoryKm2": { "value": 1.53, "date": "30.06.2026" } }
// har biri null bo'lishi mumkin
```
### `GET /UserProfile/GetAchievements`
```json
{ "distance": [ { "code":"dist_5","type":"distance","title":"5 km","threshold":5,"unit":"km",
    "current":5,"progress":1,"progressText":"40.8/5","isUnlocked":true,"unlockedAt":"30.06.2026" } ],
  "territory": [ { "code":"terr_1","type":"territory","title":"1 km²","threshold":1,"unit":"km²",
    "current":1,"progress":1,"progressText":"1.88/1","isUnlocked":true,"unlockedAt":"30.06.2026" } ] }
```
### `GET /UserProfile/GetActivityHistory?type=all`
```json
{ "totalCount": 9, "page": 1, "pageSize": 20,
  "items": [
    { "type":"running","id":"uuid","date":"30.06.2026","time":"12:00","durationSeconds":1200,
      "value":5.4,"unit":"km","polyline":[{"lat":41.311,"lng":69.24}],"polygons":null },
    { "type":"territory","id":"uuid","date":"30.06.2026","time":"11:46","durationSeconds":0,
      "value":1.53,"unit":"km²","polyline":null,"polygons":[[{"lat":41.31,"lng":69.24}]] },
    { "type":"steps","id":"uuid","date":"30.06.2026","time":"07:00","durationSeconds":2400,
      "value":5100,"unit":"steps","polyline":null,"polygons":null } ] }
```
### `GET /Wallet`
```json
{ "tanga": 12500, "xp": 9000, "xpExpiresAt": "2026-07-01T00:00:00.000Z" }
// xpExpiresAt: xp=0 bo'lsa null. XP muddati: Free 24s, Gold/Gold+ 48s.
```
### `GET /Market/Items` — 4 ta item
```json
{ "items": [
  { "id":"uuid","code":"challenge_card","title":"Challenge Card","description":"One free challenge against a friend","priceTanga":1500,"category":"challenge" },
  { "id":"uuid","code":"streak_freeze","title":"Streak Freeze","description":"Protect your streak for one missed day","priceTanga":2000,"category":"utility" },
  { "id":"uuid","code":"boost_2x_day","title":"2x XP Boost (1 day)","description":"Double XP for 24 hours","priceTanga":3000,"category":"boost" },
  { "id":"uuid","code":"color_neon_pack","title":"Neon Color Pack","description":"Unlock neon territory colors","priceTanga":5000,"category":"cosmetic" }
] }
```
**itemCode'lar:** `challenge_card`, `streak_freeze`, `boost_2x_day`, `color_neon_pack`. **category'lar:** `challenge`, `utility`, `boost`, `cosmetic`.

### `GET /Subscription/Me` — features kalitlari
```json
{ "tier": "gold_plus", "expiresAt": "2026-07-30T00:00:00.000Z",
  "features": {
    "noAds": true, "verifiedBadge": true, "mapColors": true, "avatarOnTerritory": true,
    "canCreateClan": true, "canCreateChallenge": true, "aiCoach": true,
    "storiesPerDay": -1,   // -1 = cheksiz (Free:0, Gold:1, Gold+:-1)
    "imagesPerPost": 10    // Free:1, Gold:5, Gold+:10
  } }
```
### `GET /Clan/Mine`
```json
// klanda bo'lsa:
{ "clan": { "id":"uuid","name":"Tashkent Runners","color":"#FF0000","ownerUserId":"uuid","memberCount":12,"createdAt":"2026-06-30T10:00:00.000Z" },
  "role": "member",
  "members": [ { "userId":"uuid","username":"leader","zonicId":772189,"role":"leader","joinedAt":"..." } ] }
// klanda bo'lmasa:
{ "clan": null, "role": null, "members": [] }
```
### `GET /Challenge/List`
```json
{ "challenges": [
  { "id":"uuid","challenger":{"userId":"uuid","username":"alice","zonicId":772189},
    "opponent":{"userId":"uuid","username":"bob","zonicId":772190},
    "goalType":"running","startAt":"2026-07-01T09:00:00.000Z","bet":500,
    "status":"active","direction":"outgoing","winnerUserId":null,"createdAt":"..." } ] }
// status: pending|accepted|active|declined|finished ; direction: outgoing|incoming
```
### `GET /Feed/Posts`
```json
{ "items": [
  { "id":"uuid","author":{"userId":"uuid","username":"alice","avatarFileId":"a1.jpg"},
    "type":"photo","caption":"Morning 5K 🏃",
    "imageUrls":["/Feed/Image?fileId=d4.jpg","/Feed/Image?fileId=g7.jpg"],
    "likeCount":3,"likedByMe":true,"createdAt":"2026-06-30T10:00:00.000Z" } ] }
```

---

## 7. Kichik aniqliklar

| Savol | Javob |
|---|---|
| Login body `userName` (katta N)? | ✅ **Ha**, `userName` (katta N). Register esa `username` (kichik). |
| Pagination casing? | **FreeRun/Steps** → `Page`/`PageSize` (kichik ham ishlaydi). **Clan/Feed/UserProfile-Leaderboard/ActivityHistory** → `page`/`pageSize` (kichik). |
| `GetMe`'da `zonicId` bormi? | ❌ **Yo'q.** ZONIC-ID uchun `GET /Friends/Me` ishlating (`{ zonicId, username, avatarFileId }`). |
| `Market/Purchase` `itemCode`'lar? | `challenge_card`, `streak_freeze`, `boost_2x_day`, `color_neon_pack`. |
| `401` → `RefreshToken` javobi `Login` bilan bir xilmi? | ✅ **Aynan bir xil** (`accessToken, token, accessTokenExpireAt, refreshToken, refreshTokenExpireAt`). |

---

### Xulosa mobil tomon uchun
1. **WebSocket:** `ZoneCaptured/ZoneNotClosed/ZoneTooShort/ZoneNotCaptured` event'larini tinglang — 1-bo'lim jadvali bo'yicha.
2. **Minimal masofani 550 → 500** ga o'zgartiring.
3. Rasm endpointlariga **token** bering.
4. Sana — **ISO 8601** yuboring.
5. Qolgan JSON shakllari 6-bo'limda — hujjatdagilar bilan mos (faqat WebSocket bo'limi yangilandi).
