# ZONIC — Frontend Stack va Backend Integratsiya

Flutter ilovasi (`zonic`, v1.4.0+8) frontend texnologiyalari va backend bilan bog'liq barcha integratsiya nuqtalari hujjati.

> **Holat:** mijoz tomonidagi zona qayta ishlash xatolari to'g'rilangan (6-bo'limга qarang). Bu hujjat ilovaning **joriy** (to'g'rilangandan keyingi) holatini aks ettiradi.

---

## 1. Frontend Texnologiyalari (Stack)

### Asosiy
| Soha | Paket | Versiya |
|------|-------|---------|
| Framework | Flutter SDK (Dart `>=3.0.0 <4.0.0`) | — |
| State Management | `flutter_bloc` / `bloc` / `equatable` | 8.1.5 / 8.1.4 / 2.0.5 |
| Navigatsiya | `go_router` | 13.2.0 |
| Lokalizatsiya | `easy_localization` (uz / ru / en) | 3.0.7 |

### Tarmoq (Network) va Real-time
| Maqsad | Paket | Versiya |
|--------|-------|---------|
| HTTP REST mijoz | `dio` | 5.4.3+1 |
| Real-time soket (location hub) | `socket_io_client` | 3.1.5 |
| Event bus | `event_bus` | 2.0.1 |
| Logging | `logging` | 1.3.0 |

> ℹ️ `signalr_netcore` paketi olib tashlandi — real-time aloqa faqat `socket_io_client` orqali.

### Saqlash (Storage)
| Maqsad | Paket |
|--------|-------|
| Token / oddiy sozlamalar | `shared_preferences` 2.2.3 |
| Xavfsiz saqlash | `flutter_secure_storage` 9.0.0 |
| Fayl yo'llari | `path_provider` 2.1.2 |

### Xarita, GPS, Auth, UI
| Soha | Paket |
|------|-------|
| Xarita | `yandex_mapkit` 4.2.1 |
| Geolokatsiya / GPS | `geolocator` 11.0.0 |
| Ruxsatlar | `permission_handler` 11.3.0 |
| Google Sign-In | `google_sign_in` 7.2.0 |
| Apple Sign-In | `sign_in_with_apple` 6.1.4 + `crypto` 3.0.6 |
| Grafiklar | `fl_chart` 0.68.0 |
| Rasm (cache / picker) | `cached_network_image` 3.3.1 / `image_picker` 1.0.7 |
| Shriftlar | `google_fonts` 6.2.1 + Orbitron (lokal) |
| SVG | `flutter_svg` 2.0.10+1 |
| Funktsional | `dartz` 0.10.1 (Either) / `freezed` / `intl` 0.20.2 |

### Loyiha tuzilishi (Feature-based + Clean-ish)
```
lib/
├── core/
│   ├── network/        ← API integratsiya yadrosi
│   │   ├── api_constants.dart        (baseUrl + barcha endpointlar)
│   │   ├── api_client.dart           (Dio singleton + interceptorlar)
│   │   ├── token_storage.dart        (JWT saqlash)
│   │   └── location_hub_service.dart (socket.io real-time hub)
│   ├── constants/ · theme/ · router/ · utils/ · widgets/
└── features/
    ├── auth/      (login, register, google/apple)
    ├── running/   (zone capture + free run, socket.io hub)
    ├── map/       (Yandex xarita, zonalar)
    │   └── data/models/  (territory_zone.dart, merged_zone.dart)
    ├── ranking/   (leaderboard)
    ├── profile/   (GetMe, avatar, run history)
    ├── clan/ · community/ · splash/
```
Har bir feature ichida `data/` (services, repositories, models) va `presentation/` (pages, widgets) bo'linmasi mavjud.

---

## 2. Backend Integratsiya — Umumiy

- **Base URL:** `http://89.39.95.172:5065` (`lib/core/network/api_constants.dart:3`)
- **REST mijoz:** Dio singleton — `ApiClient.instance.dio` (`lib/core/network/api_client.dart`)
- **Real-time:** socket.io — `LocationHubService.instance` (`/hubs/location`)
- **Auth:** JWT Bearer token (access + refresh)
- **Default headerlar:** `Content-Type: application/json`
- **Timeoutlar:** connect 15s, receive 15s (avatar yuklashda 60s)

### Dio Interceptor mantiqi (`api_client.dart`)
1. **onRequest:** har bir so'rovga `TokenStorage`'dan olingan `Authorization: Bearer <accessToken>` qo'shiladi.
2. **onError (401):** avtomatik `refreshToken` chaqiriladi → muvaffaqiyatli bo'lsa so'rov qayta yuboriladi; aks holda `_forceLogout()` → tokenlar tozalanadi va `/login`ga yo'naltiriladi (`navigatorKey` orqali).

### Token saqlash (`token_storage.dart`)
- `shared_preferences` ichida: `access_token`, `refresh_token`, `username`.
- `accessToken` xotirada ham keshlanadi (`_cachedAccessToken`).
- Metodlar: `saveTokens()`, `getAccessToken()`, `getRefreshToken()`, `getUsername()`, `hasTokens()`, `clear()`.

### Server xatolik formati
```json
{ "errors": { "": ["xabar"] }, "title": "...", "status": 400, "traceId": "..." }
```
Barcha servicelarda `_parseError()` shu formatdan birinchi xabarni oladi, tarmoq xatolarida esa "Server bilan aloqa yo'q" qaytaradi.

---

## 3. REST Endpointlar

Barcha yo'llar `api_constants.dart` ichida konstanta sifatida belgilangan.

### Auth — `lib/features/auth/data/repositories/auth_repository_impl.dart`
| Metod | Endpoint | Body | Izoh |
|-------|----------|------|------|
| POST | `/Account/Login` | `{ userName, password }` | → `{ accessToken, refreshToken }` saqlanadi |
| POST | `/User/Register` | `{ username, email, phone, password }` | |
| POST | `/Account/RefreshToken` | `{ refreshToken }` | 401 da avtomatik chaqiriladi |
| POST | `/Account/GoogleLogin` | `{ idToken }` | `google_sign_in` orqali idToken olinadi |
| POST | `/Account/AppleLogin` | `{ identityToken, email?, fullName? }` | email JWT'dan ham parse qilinadi |

> Google client ID: iOS `1031576445136-f50j0...`, serverClientId `1031576445136-7ea25...`.

### UserProfile — `lib/features/profile/data/services/user_profile_service.dart`
| Metod | Endpoint | Izoh |
|-------|----------|------|
| GET | `/UserProfile/GetMe` | profil ma'lumotlari → `UserProfileModel` |
| PUT | `/User/UpdateMe` | `{ username?, email?, phone?, oldPassword?, newPassword?, color? }` |
| POST | `/UserProfile/UploadAvatar` | `multipart/form-data` (`file`), timeout 60s → `fileId` |
| GET | `/UserProfile/DownloadAvatar?fileId=` | avatar URL: `baseUrl + downloadAvatar?fileId=<id>` |

### Run History & Leaderboard — `lib/features/profile/presentation/pages/profile_page.dart`, `ranking_page.dart`
| Metod | Endpoint | Query | Javob |
|-------|----------|-------|-------|
| GET | `/UserProfile/GetRunHistory` | `isWeekly` / `isMonthly` / `isYearly` (bool) | `{ runs: [...], summary: { avgSpeed } }` |
| GET | `/UserProfile/GetLeaderboard` | `Page`, `PageSize` | leaderboard ro'yxati |

`runs[]` elementlari: `date, startedAt, duration, distance, avgSpeed, runType`.

### FreeRun — `lib/features/running/data/services/free_run_service.dart`
| Metod | Endpoint | Izoh |
|-------|----------|------|
| POST | `/FreeRun/Save` | erkin yugurishni saqlash (quyida body) |
| GET | `/FreeRun/GetHistory?Page=&PageSize=` | tarix |
| GET | `/FreeRun/GetLeaderboard?Page=&PageSize=` | reyting |

**`/FreeRun/Save` body** (`free_run_save_request.dart`):
```json
{
  "startTime": "dd.MM.yyyy HH:mm:ss",
  "endTime": "dd.MM.yyyy HH:mm:ss",
  "durationSeconds": 0,
  "paceMinPerKm": 0.0,
  "averageSpeedKmh": 0.0,
  "routePoints": [ { "lat": 0.0, "lng": 0.0, "ts": "dd.MM.yyyy HH:mm:ss" } ]
}
```

### Manual (lookup ro'yxatlar) — `lib/features/profile/data/services/manual_service.dart`
| Metod | Endpoint | Query | Javob shakli |
|-------|----------|-------|--------------|
| GET | `/Manual/RunTypeSelectList` | — | `[{ value, text }]` |
| GET | `/Manual/StateSelectList` | — | `[{ value, text }]` |
| GET | `/Manual/CountrySelectList` | — | `[{ value, text }]` |
| GET | `/Manual/RegionSelectList` | `countryId` | `[{ value, text }]` |
| GET | `/Manual/DistrictSelectList` | `regionId` | `[{ value, text }]` |

`value/text` → `SelectListItem` modeliga parse qilinadi.

### Zone — `lib/features/map/presentation/pages/map_page.dart`
| Metod | Endpoint | Query / Path | Izoh |
|-------|----------|--------------|------|
| GET | `/Zone/GetArea` | `minLat, minLng, maxLat, maxLng` | xaritadagi ko'rinadigan zonalar (kamera to'xtaганда 500ms debounce bilan) |
| GET | `/Zone/GetMyZones` | — | foydalanuvchi zonalari |
| GET | `/Zone/Details/{zoneId}` | path | zona tafsilotlari + egasi avatari |

**`/Zone/GetArea` javob formatlari** (`map_page.dart` uchala formatni qo'llab-quvvatlaydi):
- `{ userPolygons: [{ userId, username, pathPolygon:[{lat,lng}], areaKm2, color, capturedAt }] }`
- `{ zones: [...] }` (eski bounding-box)
- to'g'ridan-to'g'ri `List` (PostGIS / legacy)

> ✅ **To'g'ri yondashuv (joriy holat):** `/Zone/GetArea` qaytarган `pathPolygon` **o'zгартирилmasdan** chiziladi va ichи `color` bilan bo'yaladi. Backend poligonlarни allaqachon **kesган, birlashtirган va maydonини (`areaKm2`) hisoblаган** — ustма-ust tushmaydiган tayyor poligonlar qaytaradi.
>
> Maydon: avval backend `areaKm2 * 1_000_000`, faqat `areaKm2` bo'lмаган eski zonalar uchun `MergedZone.polygonAreaM2()` (Shoelace) zaxira sifatida ishlatiladi.

> ⛔ **Mijozда BAJARILMAYDI** (avval `TerritoryService` qilar edi — endi o'chirilган):
> - ❌ **convex hull** — kesилган (botiq) zonани qavариq qilib, kesиб olинган qismни qaytadан ko'rsatardi → raqib yerини bosиб ko'rsatardi. **Eng jiddiy xato shu edi.**
> - ❌ **union-find merge** — backend o'zи birlаshtiradi.
> - ❌ **<500 m² filtr** — haqiqiy zonани yashirardi.
> - ❌ **maydonни mijозда hisoblаш** — backend `areaKm2` beradi.
> - ❌ **Chaikin smoothing / Douglas-Peucker** — chegараni siljitardi.

**Modellar:**
- `territory_zone.dart` — `/Zone/GetArea` javobini parse qiladi (`pathPolygon` → `serverPolygon`, bbox, `areaKm2`, `color`).
- `merged_zone.dart` — chizishga tayyor zona (`polygon`, `areaM2`, `ownerUserId`, `detailsZoneId`, `center` + zaxira `polygonAreaM2()`).

---

## 4. Real-time — Location Hub (socket.io)

Fayl: `lib/core/network/location_hub_service.dart` · Singleton: `LocationHubService.instance`

- **URL:** `baseUrl + /hubs/location`
- **Transport:** faqat `websocket`
- **Auth:** ulanishda `setAuth({ 'access_token': <JWT> })`
- **Ulanish:** `disableAutoConnect()` + qo'lda `connect()`, 5s timeout
- Faqat **Zone Capture (`runTypeId == 1`)** uchun ishlatiladi. **Free Run (`runTypeId == 2`)** lokal — server sessiyasi yo'q (`running_cubit.dart`).

### Client → Server (emit)
| Event | Argumentlar | Izoh |
|-------|-------------|------|
| `StartRun` | `[runTypeId]` | sessiya boshlaydi → `RunStarted` keladi |
| `StopRun` | — | sessiyani to'xtatadi |
| `SendLocation` | `[lat, lng, accuracy, speed, timestamp, runTypeId]` | timestamp **UTC** `dd.MM.yyyy HH:mm:ss` |

> ⚠️ Timestamp majburiy UTC formatda bo'lishi kerak. Mahalliy vaqt (UTC+5) yuborilsa, server nuqtalarni tashlab yuboradi → masofa kam chiqadi → `ZoneTooShort`.

### Server → Client (on)
| Event | Payload | Frontend reaksiyasi |
|-------|---------|---------------------|
| `Connected` | — | log |
| `RunStarted` | `sessionId` (Guid) | `currentSessionId` saqlanadi, `onRunStarted` stream |
| `RunStopped` | — | `onRunStopped` stream |
| `ZoneUpdated` | `[zones]` | `onZoneUpdated` stream → **`/Zone/GetArea` qayta yuklanadi** ✅ |
| `ZoneCaptured` | `{ zoneId, areaKm2 }` | `ZoneCaptureResult(captured)` + run stopped → **`/Zone/GetArea` qayta yuklanadi** ✅ |
| `ZoneNotClosed` | — | `ZoneCaptureResult(notClosed)` |
| `ZoneNotCaptured` | `{ reason }` | `ZoneCaptureResult(notCaptured, reason)` |
| `ZoneTooShort` | `{ minMeters, ranMeters }` | `ZoneCaptureResult(tooShort)` |
| `Error` / `error` / `exception` | — | log |

> ✅ `map_page.dart` ичида `onZoneUpdated` va `onCaptureResult` (captured) streamlariga obuna bo'lib, har biri kelганда `_fetchAreaZones()` chaqiriladi — xarita serverdан yangi zonalarni qayta oladi.

### Hub Streamlari (UI tomon tinglaydi)
- `debugStream` — `LocationDebugInfo` (debug overlay)
- `onRunStarted: Stream<String>`
- `onRunStopped: Stream<void>`
- `onZoneUpdated: Stream<List>`
- `onCaptureResult: Stream<ZoneCaptureResult>`

### Holatlar
- `HubConnectionState`: `Connected`, `Connecting`, `Disconnected`, `Reconnecting`
- `ZoneCaptureStatus`: `captured`, `notClosed`, `notCaptured`, `tooShort`

---

## 5. Run Type qoidalari
| runTypeId | Nomi | Backend bilan ishlash |
|-----------|------|------------------------|
| `1` | Zone Capture | socket.io hub orqali real-time, zona qo'lga olinadi |
| `2` | Free Run | lokal yugurish, oxirida `/FreeRun/Save` orqali saqlanadi |

`RunningCubit` (`lib/features/running/cubit/running_cubit.dart`) GPS nuqtalarini olib, `runTypeId == 1` bo'lsa `LocationHubService.sendLocation()` orqali serverga uzatadi.

---

## 6. Bajarilган tuzatishlar (changelog)

Mobil dasturchining backend bilan moslik bo'yicha izohi asosida quyidagilar amalga oshirildi:

1. ✅ **`TerritoryService` butunlay o'chirildi** (`lib/features/map/data/services/territory_service.dart`).
2. ✅ **`MergedZone`** alohida modelga ko'chirildi → `lib/features/map/data/models/merged_zone.dart`.
3. ✅ **`_drawUserPolygons`** — `pathPolygon` o'zгартирилmasdan chiziladi (`simplifyPolygon` / `chaikinSmooth` olib tashlandi).
4. ✅ **`_drawZones`** — har bir zona o'zicha chiziladi (`computeTileGroupOutlines`, `_mergeNearbyOutlines`, `convexHull`, `chaikinSmooth` olib tashlandi).
5. ✅ **Maydon** — backend `areaKm2` ustuvor; faqat eski zonalar uchun `MergedZone.polygonAreaM2()` zaxira.
6. ✅ **Real-time qayta yuklash** — `ZoneCaptured` (`onCaptureResult`) va `ZoneUpdated` (`onZoneUpdated`) kelганда `_fetchAreaZones()` chaqiriladi.
7. ✅ **`signalr_netcore`** `pubspec.yaml` dan olib tashlandi.

**Tekshiruv:** `flutter analyze` — kompilyatsiya xatosi yo'q (qolганлари eski `info`/`warning` lintlar).

---

## 7. Diqqat / Nomuvofiqliklar
- Koddagi `baseUrl` = `http://89.39.95.172:5065`. (Eski memory yozuvida `:8080` ko'rsatilган — kod manbasi ustuvor.)
- Aloqa **HTTP** (TLS yo'q) — production uchun HTTPS tavsiya etiladi.
- iOS/Android'da cleartext HTTP trafigi uchun platforma sozlamalari (`AndroidManifest`, `Info.plist` ATS) tekshirilishi kerak.
</content>
