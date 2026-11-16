import WidgetKit
import SwiftUI

// 홈 화면 위젯: 버튼마다 jongeup://go/<종류> 로 앱을 열면 웹이 가장 가까운 곳 길안내를 시작함
struct Entry: TimelineEntry { let date: Date }

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: Date()) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) { completion(Entry(date: Date())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        completion(Timeline(entries: [Entry(date: Date())], policy: .never))   // 내용이 고정이라 갱신 불필요
    }
}

struct QuickButton: View {
    let emoji: String
    let label: String
    let kind: String

    var body: some View {
        Link(destination: URL(string: "jongeup://go/\(kind)")!) {
            VStack(spacing: 4) {
                Text(emoji).font(.system(size: 28))
                Text(label).font(.system(size: 13, weight: .bold))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }
}

struct JongeupWidgetView: View {
    @Environment(\.colorScheme) var scheme

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("급할수록, 존급")
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(scheme == .dark ? Color(red: 0.18, green: 0.56, blue: 0.23) : Color(red: 0.02, green: 0.33, blue: 0.04))
            HStack(spacing: 8) {
                QuickButton(emoji: "🚻", label: "화장실", kind: "toilet")
                QuickButton(emoji: "🖨", label: "프린터", kind: "print")
                QuickButton(emoji: "🏪", label: "편의점", kind: "store")
            }
        }
    }
}

@main
struct JongeupWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "JongeupWidget", provider: Provider()) { _ in
            JongeupWidgetView().containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("존급 원탭")
        .description("가장 가까운 화장실·프린터·편의점으로 바로 길안내")
        .supportedFamilies([.systemMedium])   // 버튼 여러 개(Link)는 미디엄부터 가능
    }
}
