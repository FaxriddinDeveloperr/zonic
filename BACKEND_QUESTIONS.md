# ZONIC — Backend'ga savollar (mobil integratsiya uchun)

> **Kimdan:** Flutter (mobil) tomon
> **Kimga:** Backend dasturchi
> **Maqsad:** `MOBILE_INTEGRATION.md` bo'yicha ilovani ulayapmiz. Quyidagi joylar
> aniqlanmasa, integratsiyani xatosiz tugatib bo'lmaydi. Iltimos har biriga
> **aniq javob** (va imkon bo'lsa **real JSON namuna**) bering.
>
> ⚠️ **Eng shoshilinch:** 1 va 2-bo'limlar — ularsiz zona/xarita oqimi tugamaydi.

---

## 1. ⚠️ Zona egallash (WebSocket) natijasi — ENG MUHIM

Hujjatda faqat `ZoneUpdated([{geohash, userId}])` event'i bor. Lekin mobil tomonda
run tugagach quyidagilar kerak:

- zona egallandimi yoki yo'q — holat: `captured` / `notClosed` / `tooShort`;
- egallangan maydon — `areaKm2`;
- muvaffaqiyatsiz bo'lsa sabab: yugurgan masofa (`ranMeters`) va kerakli minimum (`minMeters`);
- egallangan `zoneId`.

**Savollar:**
- [ ] Server run tugaganda alohida **"capture result"** event yuboradimi?
- [ ] Event nomi nima? (masalan `ZoneCaptured` / `RunResult`?)
- [ ] To'liq **payload (JSON)** shaklini bering.
- [ ] Muvaffaqiyatsiz holatlar (loop yopilmadi / masofa kam) qanday xabar bilan keladi?

> Agar bunday event yo'q bo'lsa — iltimos **qo'shing**. Aks holda "Zona egallandi"
> ekranida maydonni (km²) ko'rsatib bo'lmaydi.

---

## 2. ⚠️ Zona qoidalari (server qiymatlari)

Client'da hozir: minimal masofa = **550 m**, loop yopilishi = **150 m**.

**Savollar:**
- [ ] Serverdagi **minimal yugurish masofasi** (metr) nechchi? (500 yoki 550?)
- [ ] Boshlanish nuqtasiga qaytish (**loop closure**) radiusi (metr) nechchi?
- [ ] `accuracy` filtri (max metr) va **tezlik chegarasi** (m/s) qancha?

> Client server bilan **bir xil** bo'lishi uchun aniq raqamlar kerak.

---

## 3. Base URL / muhit

Hozir kodda: `http://89.39.95.172:5065`. Hujjatda `api.zonic.uz` ham bor.

**Savollar:**
- [ ] **Production** base URL qaysi?
- [ ] Staging va prod alohida bormi?
- [ ] **HTTPS** ishlaydimi?

---

## 4. Avatar va rasm URL (boshqa foydalanuvchilar)

`GetMe` / `Friends` `avatarFileId` beradi. O'z avatarim uchun
`/UserProfile/DownloadAvatar?fileId=` bor.

**Savollar:**
- [ ] **Do'st / feed muallifi / zona egasi** avatarini qaysi endpoint bilan olaman?
      Xuddi shu `DownloadAvatar` bilan ishlaydimi (token bilan)?
- [ ] **Feed rasmi** `/Feed/Image?fileId=` — to'g'rimi, tokensiz ochiladimi?

---

## 5. Sana formati (tasdiqlash)

FreeRun/Steps yuborishda hozir client `dd.MM.yyyy HH:mm:ss` yuboradi.

**Savollar:**
- [ ] **ISO 8601** ham qabul qilinadimi?
- [ ] Qaysi biri **tavsiya** etiladi (buzilmasligi uchun)?

---

## 6. Har bir bo'lim uchun REAL javob namunasi (JSON)

Hujjatdagi shakllar to'g'rimi yoki o'zgargani bormi — quyidagilarning **hozirgi
real javobini** (bittadan namuna) yuboring:

- [ ] `GET /UserProfile/GetStats?dimension=running&period=weekly`
- [ ] `GET /UserProfile/GetPersonalBests`
- [ ] `GET /UserProfile/GetAchievements`
- [ ] `GET /UserProfile/GetActivityHistory?type=all`
- [ ] `GET /Wallet`
- [ ] `GET /Market/Items` — qanday **item**'lar va **category**'lar bor? (`code`'lar ro'yxati)
- [ ] `GET /Subscription/Me` — `features` kalitlari aniq
- [ ] `GET /Clan/Mine`
- [ ] `GET /Challenge/List`
- [ ] `GET /Feed/Posts`

---

## 7. Kichik aniqliklar

- [ ] Login body `userName` (katta **N**) — hali shundaymi?
- [ ] Pagination: qaysi endpoint `Page/PageSize`, qaysi biri `page/pageSize`?
- [ ] `GetMe` javobida `zonicId` bormi? (`Friends/Me`'da bor)
- [ ] `Market/Purchase`'dagi `itemCode` qiymatlari qanday? (ro'yxat)
- [ ] `401` bo'lganda `RefreshToken` javobi `Login` bilan bir xilmi?

---

## Integratsiya holati (ma'lumot uchun)

| Bo'lim | Holat |
|---|---|
| Auth / GetMe / Zones / FreeRun / Manual / WebSocket | ✅ ulangan |
| Friends (Do'stlar / Takliflar) | ✅ ulangan |
| Wallet, Steps | ⚙️ service tayyor, UI ulanmoqda |
| Stats / PersonalBests / Achievements / ActivityHistory | ⏳ kutilmoqda |
| Clan / Challenge / Market / Subscription / Feed / Coach | ⏳ kutilmoqda |

> Ayniqsa **1 va 2-bo'limlar** tez kerak. Rahmat! 🙏
