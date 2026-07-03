# ZONIC — Backend uchun kerakli qo'shimchalar

> Mobil ilovada (Flutter) UI tayyor, lekin backend'da endpoint/maydon yo'qligi
> sababli lokal (SharedPreferences) yoki mock ma'lumot bilan ishlayotgan joylar
> ro'yxati. Har bir bo'limda taklif qilingan endpoint spetsifikatsiyasi bor.
>
> Tekshirilgan sana: 2026-07-03. Server: `http://89.39.95.172:5065`
> (mavjudlik `401 = bor, 404 = yo'q` usulida tekshirildi).

---

## 1. Profil — lokal saqlanayotgan maydonlar (MUHIM)

**Fayl:** `edit_profile_page.dart`, `profile_page.dart`

Quyidagi maydonlar UI'da bor, lekin backend'da saqlanmaydi — hozir telefon
xotirasida (SharedPreferences) turadi va qurilma almashsa yo'qoladi:

| Maydon | UI joyi |
|---|---|
| `bio` (status matni) | Profil tahriri → "Bio (Status)" |
| `instagram` | Profil tahriri → Instagram username |
| `strava` | Profil tahriri → Strava link |
| `selectedBadge` (tanlangan titul/belgi) | Profil tahriri → "Maxsus belgi (Titullar)" |
| Muqova rasmi (cover) | Profil tepasidagi katta rasm |

**Kerak:**

1. `GET /UserProfile/GetMe` javobiga va `PUT /User/UpdateMe` body'siga qo'shish:
   ```json
   {
     "bio": "string?",
     "instagramUsername": "string?",
     "stravaUrl": "string?",
     "selectedBadgeCode": "string?"
   }
   ```
2. Muqova rasmi uchun (avatar bilan bir xil mexanizm):
   - `POST /UserProfile/UploadCover` — multipart/form-data (file) → `fileId`
   - `GET  /UserProfile/DownloadCover?fileId=` 
   - `GetMe` javobida: `"coverFileId": "string?"`

---

## 2. Bildirishnomalar — to'liq mock (MUHIM)

**Fayl:** `notifications_page.dart` — 4 ta qattiq yozilgan (hardcoded) xabar
ko'rsatiladi, hech qanday API chaqirilmaydi.

**Kerak:**

- `GET /Notifications?Page=&PageSize=` →
  ```json
  {
    "items": [{
      "id": "guid",
      "type": "friend_request | achievement | clan | system",
      "title": "string",
      "body": "string",
      "createdAt": "datetime",
      "isRead": false,
      "payload": { "userId": 1, "requestId": "..." }
    }],
    "unreadCount": 4
  }
  ```
- `POST /Notifications/MarkRead` — body: `{ "ids": ["guid"] }` (bo'sh bo'lsa hammasi)
- `DELETE /Notifications/{id}` va `DELETE /Notifications` (hammasini o'chirish)
- Do'stlik so'rovi bildirishnomasidagi "Qabul qilish" tugmasi mavjud
  `POST /Friends/Respond` ga ulanadi — qo'shimcha ish shart emas.

---

## 3. Boshqa foydalanuvchi profili — statistika mock (MUHIM)

**Fayl:** `user_profile_page.dart` — boshqa o'yinchining profilini ochganda
faqat `username`, `avatarFileId`, `level` real; qolgani (masofa, temp,
g'alabalar, hudud, unvon, bio, so'nggi faolliklar) demo qiymatlar.

**Kerak:** bitta ochiq (public) profil endpoint'i:

- `GET /UserProfile/GetPublicProfile?userId={zonicId}` →
  ```json
  {
    "zonicId": 123,
    "username": "string",
    "avatarFileId": "string?",
    "coverFileId": "string?",
    "level": 12,
    "bio": "string?",
    "selectedBadgeCode": "string?",
    "regionName": "string?",
    "stats": {
      "totalDistanceKm": 156.4,
      "avgPaceMinPerKm": 4.3,
      "totalAreaKm2": 12.5,
      "activityCount": 48
    },
    "achievements": [ { "type": "distance", "threshold": 100, "isUnlocked": true } ],
    "recentActivities": [
      { "date": "2026-06-27", "distanceKm": 5.2, "durationMinutes": 28 }
    ]
  }
  ```

Shu sahifadagi tugmalar ham ulanmagan:
- **"Obuna bo'lish" (follow)** — faqat lokal state. Friends tizimi bilan
  bog'lash kerak (`POST /Friends/Request` bor) yoki alohida Follow API.
- **Chat tugmasi** — o'lik. Shaxsiy chat API rejada bo'lsa kerak bo'ladi.
- **Challenge (kubok) tugmasi** — o'lik. `POST /Challenge/Create` backend'da
  bor, faqat frontend ulaydi (backend ishi shart emas).

---

## 4. Market — katalog va inventar lokal (MUHIM)

**Fayl:** `market_page.dart`

- 30+ mahsulot (ramkalar, temalar, boosterlar, bellashuv kartalari) ilova
  ichida qattiq yozilgan ro'yxatda. `GET /Market/Items` mavjud, lekin bu
  katalogni to'liq qaytarmaydi — ilova faqat backend'da bor kodlarni real
  sotib oladi, qolganini lokal simulyatsiya qiladi.
- Sotib olingan buyumlar (inventar) xotirada — ilova qayta ochilsa yo'qoladi.
- Balans `GET /Wallet` dan olinadi (ishlayapti), lekin backend'da bo'lmagan
  mahsulotlar lokal balansdan ayiriladi (sinxron emas).

**Kerak:**

1. `GET /Market/Items` to'liq katalog qaytarsin:
   ```json
   [{
     "code": "frame_gold",
     "category": "frame | theme | booster | challenge",
     "name": "Oltin Hashamat",
     "description": "string",
     "price": 5000,
     "currency": "tanga | uzs",
     "isPremium": false,
     "duration": "permanent | 1h | 1d | 1m | 3m",
     "discountLabel": "string?"
   }]
   ```
2. `GET /Market/Inventory` — foydalanuvchining sotib olgan buyumlari:
   ```json
   [{ "code": "frame_gold", "purchasedAt": "datetime", "expiresAt": "datetime?" }]
   ```
3. Premium (UZS) mahsulotlar uchun real to'lov oqimi: `POST /Payment/Create`
   endpoint mavjud, lekin hujjati yo'q — so'rov/javob formati va qaysi
   provayder (Payme/Click) ishlatilishini aniqlashtirish kerak. Hozir ilova
   to'lovni simulyatsiya qiladi.

---

## 5. Klan Dashboard — level/XP hardcoded

**Fayl:** `clan_dashboard_page.dart`

- Klan darajasi ("Level 12"), XP progress bar va "Total XP: 125.7K" — qattiq
  yozilgan qiymatlar.
- A'zolar ro'yxatida har bir a'zoning level/XP'si yo'q (0 ko'rsatiladi).
- Foydalanuvchi klanda bo'lmasa demo a'zolar ("Amir_Pro", "SpeedRunner"...)
  ko'rsatiladi.
- "Chat" tugmasi o'lik — klan chati API'si umuman yo'q.

**Kerak:**

1. `GET /Clan/Mine` javobiga qo'shish:
   ```json
   {
     "clan": {
       "level": 12,
       "xp": 4500,
       "xpToNextLevel": 10000,
       "totalXp": 125700
     },
     "members": [{ "zonicId": 1, "username": "...", "isLeader": true,
                    "level": 45, "weeklyXp": 45230 }]
   }
   ```
2. Klan chati (rejada bo'lsa): `GET/POST /Clan/{id}/Messages` yoki SignalR hub.

---

## 6. Sozlamalar sahifasi

**Fayl:** `settings_page.dart`

- **"Akkauntni o'chirish"** — hozir faqat lokal token/prefs tozalanadi,
  serverdagi akkaunt o'chmaydi. **Kerak:** `DELETE /User/Me` (parol tasdiqlash
  bilan). Google Play / App Store talabi bo'yicha bu majburiy funksiya.
- **Ulanishlar** (Strava "Ulangan", Apple Health, Google Fit) va **Gadjetlar**
  (Apple Watch 85% batareya...) — to'liq mock. Bu integratsiyalar rejada
  bo'lsa OAuth/token saqlash endpointlari kerak bo'ladi; rejada bo'lmasa
  frontend'dan olib tashlaymiz.

---

## 7. Feed (Jamiyat sahifasi) — mayda bo'shliqlar

**Fayl:** `community_page.dart`

Post/story/like backend bilan ishlayapti. Ulanmagani:

- **Share tugmasi** — o'lik (frontend hal qilishi mumkin).
- **Bookmark (saqlash) tugmasi** — o'lik. Kerak bo'lsa:
  `POST /Feed/Posts/{id}/Bookmark`, `DELETE ...`, `GET /Feed/Bookmarks`.
- **Izoh (comment)** funksiyasi UI'da ham, backend'da ham yo'q — rejaga
  qarab: `GET/POST /Feed/Posts/{id}/Comments`.
- Header'dagi **bildirishnoma nuqtasi** statik — 2-bo'limdagi `unreadCount`
  bilan hal bo'ladi.

---

## 8. Xarita — Pizza POI demo

**Fayl:** `map_page.dart` — 3 ta statik koordinatada pizza belgisi turadi
(demo). Agar POI (reklama nuqtalari) funksiyasi rejada bo'lsa:

- `GET /Poi/GetArea?MinLat=&MinLng=&MaxLat=&MaxLng=` →
  `[{ "id", "type": "pizza", "lat", "lng", "title", "iconUrl" }]`

---

## 9. Statistika bo'shliqlari

- **Puls (heart rate)** — profil statistikasida fallback demo qiymat bor,
  backend'da bunday ma'lumot yo'q (gadjet integratsiyasiga bog'liq, 6-bo'lim).
- **Uzluksizlik (streak)** — hech qanday endpoint qaytarmaydi. Hozircha UI'dan
  olib tashlandi; kelajakda kerak bo'lsa `GetStats` summary'siga
  `"currentStreakDays": 5` qo'shish yetarli.
- **Qadamlar** — `POST /Steps/Save` backend'da tayyor, lekin mobil ilova hali
  qadam o'lchamaydi (pedometer yo'q) — bu mobil tomondagi ish, backend'ga
  ish yo'q. Shu sababli QADAM statistikasi hozircha doim 0.

---

## 10. Ma'lumot uchun: backend tayyor, UI hali ulanmagan

Bular backend'dan ish talab qilmaydi (frontend keyin ulaydi):

- `Challenge/*` (Create/Respond/List/Finish) — servis yozilgan, UI yo'q
- `Coach/*` (Zones/Feedback) — servis yozilgan, UI yo'q
- `Wallet/ClaimDailyReward` — servis yozilgan, UI tugmasi yo'q
- `Subscription/Plans` — obuna sotib olish sahifasi yo'q (faqat `Me` bilan
  feature-gating ishlaydi)
- `Clan/Leaderboard` — reyting sahifasida klan tab'i yo'q
- `Friends/Search` — jamiyat sahifasidagi qidiruv tugmasi ulanmagan

---

## Ustuvorlik tavsiyasi

| # | Ish | Sabab |
|---|---|---|
| 1 | Profil maydonlari (bio/instagram/strava/badge/cover) | Foydalanuvchi kiritgan ma'lumot yo'qolyapti |
| 2 | `DELETE /User/Me` | Store talabi |
| 3 | Bildirishnomalar API | Sahifa to'liq mock |
| 4 | Public profil endpoint'i | Boshqa o'yinchi profili noto'g'ri ma'lumot ko'rsatadi |
| 5 | Market katalog + inventar | Sotib olingan narsalar yo'qolyapti |
| 6 | Klan level/XP maydonlari | Kichik qo'shimcha, katta vizual effekt |
| 7 | Payment/Create hujjati | Premium sotuvlar uchun |
