import Foundation
import CoreBluetooth

/// Cam body: CoreBluetooth client for DJI Osmo Mobile–class gimbals (FFF0 / DUML).
/// Research baseline: OM2–OM4 (alkersan/om-research). OM5: verify on device.
final class GimbalBLE: NSObject, ObservableObject {
    @Published var status: String = "Выкл"
    @Published var connected: Bool = false

    private var central: CBCentralManager!
    private var peripheral: CBPeripheral?
    private var writeChar: CBCharacteristic?
    private var notifyChar: CBCharacteristic?

    private let serviceUUID = CBUUID(string: "FFF0")
    private let notifyUUID = CBUUID(string: "FFF4")
    private let writeUUID = CBUUID(string: "FFF5")

    override init() {
        super.init()
        central = CBCentralManager(delegate: self, queue: .main)
    }

    func startScan() {
        guard central.state == .poweredOn else {
            status = "Bluetooth выключен"
            return
        }
        status = "Сканирование…"
        central.scanForPeripherals(withServices: [serviceUUID], options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
        // Also scan without filter — OM names vary
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.central.scanForPeripherals(withServices: nil, options: nil)
        }
    }

    func stopScan() {
        central.stopScan()
    }

    func disconnect() {
        if let p = peripheral { central.cancelPeripheralConnection(p) }
        connected = false
        status = "Отключено"
    }

    // MARK: - Commands (om-research style rotate)

    func left() { send(buildRotate(yaw: -800, pitch: 0, roll: 0, time: 20, speed: true)) }
    func right() { send(buildRotate(yaw: 800, pitch: 0, roll: 0, time: 20, speed: true)) }
    func up() { send(buildRotate(yaw: 0, pitch: 600, roll: 0, time: 20, speed: true)) }
    func down() { send(buildRotate(yaw: 0, pitch: -600, roll: 0, time: 20, speed: true)) }
    func stop() { send(buildRotate(yaw: 0, pitch: 0, roll: 0, time: 5, speed: true)) }

    private func send(_ data: Data) {
        guard let p = peripheral, let c = writeChar else {
            status = "Нет записи BLE"
            return
        }
        p.writeValue(data, for: c, type: .withoutResponse)
        status = "TX \(data.count) байт"
    }

    private func buildRotate(yaw: Int16, pitch: Int16, roll: Int16, time: UInt8, speed: Bool) -> Data {
        var packet = Data()
        // header from om-research web-bluetooth
        packet.append(contentsOf: [0x55, 0x15, 0x04, 0xa9])
        var body: [UInt8] = [0x02, 0x04, 0x01, 0x00, 0x00, 0x04]
        body.append(speed ? 0x0c : 0x14)
        func le(_ v: Int16) -> [UInt8] { [UInt8(v & 0xff), UInt8((v >> 8) & 0xff)] }
        body += le(yaw) + le(roll) + le(pitch)
        body.append(0x80) // speed mode flag
        body.append(time)
        let crc = Self.crc16(Data(body))
        packet.append(contentsOf: body)
        packet.append(UInt8(crc & 0xff))
        packet.append(UInt8((crc >> 8) & 0xff))
        return packet
    }

    private static func crc16(_ data: Data) -> UInt16 {
        var crc: UInt16 = 0xdf0c
        var table = [UInt16](repeating: 0, count: 256)
        for i in 0..<256 {
            var c = UInt16(i)
            for _ in 0..<8 { c = (c & 1) != 0 ? (c >> 1) ^ 0x8408 : c >> 1 }
            table[i] = c
        }
        for b in data {
            crc = (crc >> 8) ^ table[Int((UInt16(b) ^ crc) & 0xff)]
        }
        return crc
    }
}

extension GimbalBLE: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        status = central.state == .poweredOn ? "Bluetooth OK" : "Bluetooth недоступен"
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                        advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let name = peripheral.name ?? advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? ""
        let upper = name.uppercased()
        // OM5 / Osmo Mobile naming variants
        if upper.contains("OM") || upper.contains("OSMO") || upper.contains("DJI") || name.isEmpty == false {
            if upper.contains("OM") || upper.contains("OSMO") || upper.contains("MOBILE") {
                self.peripheral = peripheral
                status = "Найден: \(name)"
                stopScan()
                central.connect(peripheral, options: nil)
            }
        }
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        status = "Подключено, сервисы…"
        peripheral.delegate = self
        peripheral.discoverServices([serviceUUID])
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        status = "Ошибка: \(error?.localizedDescription ?? "?")"
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        connected = false
        status = "Отключено"
    }
}

extension GimbalBLE: CBPeripheralDelegate {
    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard let services = peripheral.services else { return }
        for s in services where s.uuid == serviceUUID {
            peripheral.discoverCharacteristics([notifyUUID, writeUUID], for: s)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard let chars = service.characteristics else { return }
        for c in chars {
            if c.uuid == writeUUID { writeChar = c }
            if c.uuid == notifyUUID {
                notifyChar = c
                peripheral.setNotifyValue(true, for: c)
                // arm pairing style write used on some DJI stacks
                peripheral.writeValue(Data([0x01, 0x00]), for: c, type: .withResponse)
            }
        }
        connected = writeChar != nil
        status = connected ? "Готов к командам" : "Нет fff5"
    }
}
