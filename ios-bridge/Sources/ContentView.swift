import SwiftUI

struct ContentView: View {
    @StateObject private var gimbal = GimbalBLE()

    var body: some View {
        VStack(spacing: 16) {
            Text("Cam · тело OM5")
                .font(.title2.bold())
            Text(gimbal.status)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            HStack {
                Button("Скан") { gimbal.startScan() }
                    .buttonStyle(.borderedProminent)
                Button("Стоп скан") { gimbal.stopScan() }
                    .buttonStyle(.bordered)
                Button("Отключить") { gimbal.disconnect() }
                    .buttonStyle(.bordered)
            }

            Divider()

            Text("Движение")
                .font(.headline)

            HStack(spacing: 12) {
                Button("←") { gimbal.left() }.frame(width: 64, height: 48)
                Button("→") { gimbal.right() }.frame(width: 64, height: 48)
                Button("↑") { gimbal.up() }.frame(width: 64, height: 48)
                Button("↓") { gimbal.down() }.frame(width: 64, height: 48)
            }
            .buttonStyle(.borderedProminent)

            Button("Стоп") { gimbal.stop() }
                .buttonStyle(.bordered)

            Spacer()
            Text("Закрой DJI Mimo перед подключением.\nOM5 должен быть включён.")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}
