# Cam + OM5 — протокол тела

## Цель

Cam управляет селфи-палкой (Osmo Mobile 5) как своим телом.

## Слои

| Слой | Где | Что делает |
|------|-----|------------|
| Лицо / AI Director | `index.html`, `app.js`, `stick.js` | Голос, глаза, сценарии |
| BLE протокол (JS) | `ble/protocol.js` | Сборка DUML-пакетов |
| iOS тело | `ios-bridge/` | CoreBluetooth → fff5 |

## BLE (DJI-стек)

- Service `FFF0`
- `FFF4` notify + иногда pairing `[0x01,0x00]`
- `FFF5` writeWithoutResponse — команды

Пакет поворота (база om-research web-bluetooth):

```
55 15 04 a9 | body… | CRC16 LE
```

Публично проверено на **OM2 / OM3 / OM4**. **OM5** — проверить у себя: закрой Mimo, собери `ios-bridge`, Send Left/Right.

## iPhone Safari

Чистый Safari **не** даёт Web Bluetooth. Варианты:

1. **ios-bridge** (рекомендуется) — Xcode → Run на iPhone
2. **beacio / WebBLE** + веб-кнопки Cam (эксперимент)
3. Режиссёр-режим: Cam говорит → ты/Mimo двигает

## Важно

- Пока открыт **DJI Mimo**, он держит BLE — мост не подключится.
- Не гарантия «OM5 поедет с первого пакета» без калибровки payload под твою прошивку.
- Это interoperablity / research-стек, не официальный SDK DJI.
