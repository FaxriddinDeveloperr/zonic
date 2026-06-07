# Territory Capture (Hudud egallash) — Implementatsiya rejasi

> Maqsad: mobil dasturchi yuborgan 6 ta qoidani backendda amalga oshirish.
> Bu mavjud **geohash** zona tizimini **PostGIS poligon** tizimiga almashtiradi.
> ⚠️ Bu reja — TASDIQLASH uchun. Kod hali yozilmagan.

## ✅ TASDIQLANGAN QARORLAR (mobilechi, 2026-06-07)
- `overtake_factor = 1.4` (config) — egallab olish.
- Buffer radiusi = **15 m** (umumiy kenglik 30m).
- Halqa yopilganda (start↔finish ≤150m) → ichki maydon to'ldiriladi (Polygon). Yopilmasa → bekor (Rule 1.2).
- `min_zone_area = 10 m²` (config) — kichik qoldiq o'chiriladi.
- `capture_ratio = 1.33` (config) — `yugurish_km ≥ maydon_km² × 1.33`.
- **Rang profilda:** `sys_user.color` (har user uchun bitta). O'zgartirilsa — barcha zonalari shu rangga o'tadi. `StartRun` ga rang qo'shilmaydi.
- `GetArea`: **GeoJSON emas**, balki `pathPolygon: [{lat,lng}...]` qaytaradi. BBox query (minLat/minLng/maxLat/maxLng) saqlanadi → `ST_MakeEnvelope` bilan filtr. MultiPolygon → har bo'lak alohida element, bir xil `zoneId`.
- Eski geohash zonalar ko'chmaydi — toza boshlash (tasdiqlangan).

---

## 0. Asosiy o'zgarish (g'oya)

**Hozir:** zona = geohash katakcha. Yugurish paytida har bir nuqta uchun katak egallaб olinadi (uzluksiz, `LocationBackgroundService` ichida).

**Bo'ladi:** zona = yugurish yo'lidan yasalган **poligon**. Egallash **`StopRun` paytida bir marta** hisoblanadi: butun yo'l → poligon → qoidalar (yopish, egallab olish, kesish, birlashtirish) → saqlash.

Bu — fundamental siljish: "uzluksiz katak egallash" → "yugurish tugaganda poligon hisoblash".

---

## 1. Talab: serverda PostGIS

```bash
sudo apt update
sudo apt install -y postgresql-14-postgis-3
sudo -u postgres psql -d zonic -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```
> PostGIS bo'lmasa, butun tizim ishlamaydi. Bu birinchi qadam.

---

## 2. Ma'lumotlar bazasi sxemasi

Mavjud `game_zone` (geohash) jadvaliga tegmaymiz (eski ma'lumot buzilmasin). Yangi poligon jadval:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE game_territory (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id  uuid NOT NULL REFERENCES sys_user(id),
  color          varchar(7) NOT NULL DEFAULT '#3B82F6',     -- hex rang
  geom           geometry(MultiPolygon, 4326) NOT NULL,     -- multipolygon (birlashtirish uchun)
  centroid       geometry(Point, 4326) NOT NULL,            -- markaz (tez masofa tekshiruvi)
  area_m2        double precision NOT NULL,                 -- maydon (m²)
  run_distance_m double precision NOT NULL DEFAULT 0,       -- shu zonani yaratган yugurish masofasi (egallab olish uchun MUHIM)
  captured_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_territory_geom     ON game_territory USING GIST(geom);
CREATE INDEX idx_territory_centroid ON game_territory USING GIST(centroid);
CREATE INDEX idx_territory_owner    ON game_territory (owner_user_id);
```

**Diqqat:** `run_distance_m` — mobilechining sxemasida yo'q edi, lekin **Rule 2 (egallab olish)** uchun kerak: "egasining asl yugurish masofasi" shu yerda saqlanadi. `MultiPolygon` — chunki birlashganda bir nechta poligon bo'lishi mumkin.

---

## 3. Konfiguratsiya parametrlari (`.env` + `configuration.ts`)

```env
GAME_BUFFER_RADIUS_M=12          # yo'l "qalinligi" (poligon radiusi)
GAME_CLOSE_LOOP_DISTANCE_M=150   # halqani yopish masofasi (Rule 1)
GAME_OVERTAKE_FACTOR=1.4         # egallab olish koeffitsiyenti (Rule 2)
GAME_MIN_ZONE_AREA_M2=10         # minimal qolgan maydon (Rule 3)
GAME_MERGE_CENTROID_M=500        # birlashtirish markaz masofasi (Rule 5)
GAME_CAPTURE_DISTANCE_RATIO=1.4  # to'liq egallash nisbati (Rule 4)
```
Barchasi sozlanadigan — mobilechi tasdiqlagandan keyin qiymatlar aniqlanadi.

---

## 4. Yugurish oqimi (StartRun → SendLocation → StopRun)

### StartRun
- `StartRun(runTypeId, color?)` — yugurish boshlanganda foydalanuvchi tanlagan **rang** ham olinadi (yoki profil sozlamasidan).
- Hozirgidek `game_run_session` yoziladi.

### SendLocation (yugurish davomida)
- Hozirgidek nuqtalar `game_location_point` ga yoziladi (anti-cheat: tezlik/sakrash tekshiruvi qoladi).
- ❗ Lekin endi **geohash zona egallash O'CHIRILADI** (`LocationBackgroundService` ichidagi katak egallash mantig'i ZONE_CAPTURE uchun ishlamaydi — faqat nuqta yig'adi).

### StopRun (asosiy mantiq — YANGI)
1. Sessiyaning barcha nuqtalarini tartibli o'qiyman.
2. **Rule 1 — halqani yopish:** `ST_Distance(first, last) ≤ 150m`? Yo'q bo'lsa → zona **saqlanmaydi**, clientga `ZoneNotClosed` xabari (client ham oldindan tekshiradi).
3. Poligon yasayman:
   - Halqa yopilgan → ichki maydonni to'ldiruvchi poligon (`ST_MakePolygon` + `ST_MakeValid`).
   - (Zaxira: noto'g'ri geometriya bo'lsa `ST_Buffer(ST_MakeLine, radius)`.)
4. `area_m2 = ST_Area(geom::geography)`, `run_distance_m = ST_Length(line::geography)`.
5. **Boshqalarning ustma-ust zonalari** bilan ishlash (`&&` + `ST_Intersects`):
   - **Rule 4 — to'liq egallash:** yangi poligon eski zonani to'liq qoplasa va `run_distance ≥ area_km2 × ratio` → eski zona **o'chiriladi**.
   - **Rule 2+3 — egallab olish / kesib olish:** qisman ustma-ust. Agar `new.run_distance ≥ old.run_distance × overtake_factor` →
     - eski zona: `ST_Difference(old, new)` (kesilgan qism olib tashlanadi),
     - qolgan maydon `≤ min_area` bo'lsa eski zona o'chiriladi.
     - Aks holda (koeffitsiyentdan kam) → yangi zona eskisining ustiga **kira olmaydi** (`new = ST_Difference(new, old)` bilan kesib qo'yiladi).
6. **Rule 5 — birlashtirish (o'ziniki):** o'sha foydalanuvchining zonalari bilan tegsa YOKI markaz masofasi `≤500m` bo'lsa → `ST_Union` bilan bitta multipolygon.
7. Yangi/yangilangan zonalarni saqlayman (geom, centroid, area, run_distance, color).
8. `ZoneUpdated` broadcast.

> Bularning aksariyati **xom SQL / PostGIS funksiyalari** bilan yoziladi (TypeORM geometriyani o'zi bilmaydi).

---

## 5. Endpointlar o'zgarishi

### `GET /Zone/GetArea` (o'zgaradi)
Geohash to'rtburchak o'rniga **GeoJSON poligon** qaytaradi:
```json
[ { "zoneId": "uuid", "ownerUserId": "uuid", "ownerUsername": "ali",
    "color": "#FF0000", "areaKm2": 0.45, "capturedAt": "07.06.2026",
    "polygon": { "type": "MultiPolygon", "coordinates": [...] } } ]
```
(`ST_AsGeoJSON(geom)`). Flutter `yandex_mapkit` bilan poligon chizadi.

### `GET /Zone/Details/:id` (yangi)
```json
{ "zoneId": "uuid", "ownerUserId": "uuid", "ownerUsername": "ali",
  "ownerAvatarUrl": "/UserProfile/DownloadAvatar?fileId=...",
  "areaKm2": 0.45, "capturedAt": "07.06.2026 15:30:00" }
```
`ownerAvatarUrl` — biz endigina qo'shgan avatar endpointidan foydalanadi.

### `GET /Zone/GetMyZones` (o'zgaradi)
Yangi poligon shaklini qaytaradi.

---

## 6. Bosqichlar (taklif)

- **Bosqich 1 — Poydevor:** PostGIS o'rnatish, `game_territory` jadvali, config, StopRun'da poligon yaratish + halqa yopish (Rule 1), GetArea GeoJSON, Zone Details endpoint. (Egallab olish/kesish/birlashtirishsiz — yangi zona shunchaki boshqalarникidan kesib qo'yiladi.)
- **Bosqich 2 — Raqobat:** Rule 2 (egallab olish), Rule 4 (to'liq egallash), Rule 3 (kesish — `ST_Difference`).
- **Bosqich 3 — Birlashtirish:** Rule 5 (o'ziniki union + markaz + ichidan boshlash).

Har bosqich alohida sinaladi va deploy qilinadi.

---

## 7. Mobilechiга tasdiqlatish kerak bo'lган savollar

1. **overtake_factor:** 1.4 mi yoki 2x? (qoida "2 barobar", misol "1.4x" — ziddiyat).
2. **Buffer radiusi (yo'l qalinligi):** necha metr? (masalan 10–15m).
3. **Halqa yopilganda:** ichki maydon to'ldirilsinmi (territory), yoki yo'l "qalin chiziq" bo'lib qolsinmi?
4. **min_zone_area:** 10 m² to'g'rimi?
5. **full_capture ratio:** "3 km² → 4 km" → nisbat ≈1.33. Aniq qiymat?
6. **Rang manbai:** har yugurishda tanlanadimi, profilда saqlanadimi, yoki qat'iymi? `StartRun` ga `color` qo'shamizmi?
7. **GetArea:** app to'liq GeoJSON poligonga o'tadimi (eski bbox kerak emasmi)?

---

## 8. Xavf-xatarlar / qiyin joylar

- **PostGIS o'rnatish** serverda (apt) — root kerak.
- **Bir vaqtda yugurish (Rule 2.1, "birinchi boshlagan yutadi"):** bir nechta odam bir vaqtda tugatganda tranzaksiya + `started_at` bo'yicha tartiblash kerak — bu eng nozik joy.
- **TypeORM geometriyani bilmaydi** → xom SQL yoziladi (ehtiyotkorlik kerak).
- **Geohash → poligon ko'chish:** eski geohash zonalar yangi tizimga o'tmaydi (yangi boshlanadi) — buni mobilechi bilan kelishish kerak.
- **Geometriya validligi** (`ST_MakeValid`, o'z-o'zini kesган poligonlar).

---

## 9. Taxminiy hajm
- Bosqich 1: ~o'rta (PostGIS sozlash + poligon yaratish + 2 endpoint).
- Bosqich 2–3: ~katta (PostGIS qoidalar mantig'i + sinov).
- Jami: bir necha kunlik ish.
