# Cam iOS BLE Bridge (тело OM5)

Нативный слой для iPhone: **CoreBluetooth → OM5**.
Сайт Cam сам по себе на Safari BLE не держит — этот мост и есть «тело».

## Зачем

- Cam (веб) = лицо + голос + режиссёр
- Этот Swift-код = руки: пишет DUML на `fff5`, слушает `fff4`

## Протокол

- Service: `0000fff0-0000-1000-8000-00805f9b34fb`
- Notify: `fff4` — после connect write `[0x01, 0x00]`
- Write: `fff5` — writeWithoutResponse, пакеты DUML
- Источник: alkersan/om-research (OM2–OM4), lib-osmo-ble

**OM5** официально не задокументирован. Стек часто тот же — проверяй на своей палке.
Пока Mimo подключён к OM5, BLE занят: **закрой Mimo** перед тестом моста.

## Как собрать (Mac + Xcode)

1. Открой Xcode → New Project → App (iOS, SwiftUI)
2. Bundle ID любой, например `arch.aicam.bridge`
3. Скопируй файлы из `ios-bridge/Sources/` в проект
4. Info.plist:
   - `NSBluetoothAlwaysUsageDescription` = «Cam управляет OM5»
5. Подключи iPhone кабелем, Run
6. На телефоне: Bluetooth вкл, OM5 вкл, **Mimo закрыт**
7. В приложении: Scan → Connect → кнопки Left/Right

## Статус

Каркас готов к прошивке на устройство. Успех вращения на **OM5** зависит от совпадения протокола с OM3/OM4. Если пакеты не двигают оси — нужен сниффер HCI с Mimo на Android/jailbreak или адаптация payload под OM5.

## Связь с веб-Cam

Пока мост standalone. Следующий шаг: WKWebView с Ai Cam + JS bridge `window.webkit.messageHandlers.gimbal.postMessage({cmd:'left'})`.
