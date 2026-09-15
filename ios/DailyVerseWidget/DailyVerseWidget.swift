import SwiftUI
import WidgetKit

// Home-screen "Sakafom-panahy" widget. Pure display: the app (JS) writes
// dailyVerse.json into the App Group container on every launch — one entry per
// local day for the next two months, the accent colour and a deep link — and
// this only renders it (see src/services/widget/dailyVerseWidget.ts for the
// contract). The verse calendar itself lives in JS and is never duplicated.

private let appGroup = "group.com.ebaiboly.app"
private let fileName = "dailyVerse.json"
// Same as DEFAULT_PRIMARY_COLOR_ID's hex in src/theme/personalizationPalette.ts.
private let defaultAccent = "#007991"

private struct Feed: Decodable {
  let accent: String
  let label: String
  let days: [String: Day]
}

private struct Day: Decodable {
  let ref: String
  let text: String
  let url: String
}

struct VerseEntry: TimelineEntry {
  let date: Date
  let label: String
  let ref: String?
  let text: String
  let url: URL?
  let accent: Color
}

private let dayKey: DateFormatter = {
  let f = DateFormatter()
  f.locale = Locale(identifier: "en_US_POSIX")
  f.dateFormat = "yyyy-MM-dd"
  return f
}()

private func readFeed() -> Feed? {
  guard
    let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup),
    let data = try? Data(contentsOf: dir.appendingPathComponent(fileName))
  else { return nil }
  return try? JSONDecoder().decode(Feed.self, from: data)
}

// No feed yet (fresh install, or the app hasn't been opened in two months).
// Placeholder MG copy — user-owned.
private func fallbackEntry(_ date: Date) -> VerseEntry {
  VerseEntry(
    date: date,
    label: "e-Baiboly",
    ref: nil,
    text: "Sokafy ny e-Baiboly hahitana ny andinin-teny androany.",
    url: nil,
    accent: Color(hex: defaultAccent)
  )
}

private let sampleEntry = VerseEntry(
  date: Date(),
  label: "Sakafom-panahy",
  ref: "Salamo 23:1",
  text: "Jehovah no Mpiandry ahy, tsy hanan-java-mahory aho.",
  url: nil,
  accent: Color(hex: defaultAccent)
)

/// One entry per day in the feed from today on, each dated at local midnight,
/// so WidgetKit swaps the verse exactly at the day change without polling.
private func entries(from now: Date) -> [VerseEntry] {
  guard let feed = readFeed() else { return [] }
  let accent = Color(hex: feed.accent)
  let calendar = Calendar.current
  let today = calendar.startOfDay(for: now)
  return feed.days.keys.sorted().compactMap { key -> VerseEntry? in
    guard let day = feed.days[key], let parsed = dayKey.date(from: key) else { return nil }
    let midnight = calendar.startOfDay(for: parsed)
    if midnight < today { return nil }
    return VerseEntry(
      date: midnight == today ? now : midnight,
      label: feed.label,
      ref: day.ref,
      text: day.text,
      url: URL(string: day.url),
      accent: accent
    )
  }
}

struct DailyVerseProvider: TimelineProvider {
  func placeholder(in context: Context) -> VerseEntry { sampleEntry }

  func getSnapshot(in context: Context, completion: @escaping (VerseEntry) -> Void) {
    completion(entries(from: Date()).first ?? sampleEntry)
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<VerseEntry>) -> Void) {
    let now = Date()
    let list = entries(from: now)
    completion(Timeline(entries: list.isEmpty ? [fallbackEntry(now)] : list, policy: .atEnd))
  }
}

struct DailyVerseView: View {
  let entry: VerseEntry

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      RoundedRectangle(cornerRadius: 2)
        .fill(entry.accent)
        .frame(width: 4)
      VStack(alignment: .leading, spacing: 4) {
        HStack {
          Text(entry.label)
            .font(.caption)
            .foregroundColor(.secondary)
            .lineLimit(1)
          Spacer()
          if let ref = entry.ref {
            Text(ref)
              .font(.caption.bold())
              .foregroundColor(entry.accent)
              .lineLimit(1)
          }
        }
        Text(entry.text)
          .font(.system(size: 14))
          .lineSpacing(2)
          .lineLimit(5)
        Spacer(minLength: 0)
      }
    }
    .padding(12)
    .widgetBackground(Color(UIColor.systemBackground))
    .widgetURL(entry.url)
  }
}

@main
struct DailyVerseWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "DailyVerseWidget", provider: DailyVerseProvider()) { entry in
      DailyVerseView(entry: entry)
    }
    // Placeholder MG copy — user-owned.
    .configurationDisplayName("Sakafom-panahy")
    .description("Andinin-teny iray isan'andro eo amin'ny efijery.")
    .supportedFamilies([.systemMedium])
  }
}

private extension View {
  // iOS 17 requires containerBackground for widgets; earlier versions take a
  // plain background.
  @ViewBuilder
  func widgetBackground(_ color: Color) -> some View {
    if #available(iOS 17.0, *) {
      containerBackground(color, for: .widget)
    } else {
      background(color)
    }
  }
}

private extension Color {
  init(hex: String) {
    var value: UInt64 = 0
    let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    guard cleaned.count == 6, Scanner(string: cleaned).scanHexInt64(&value) else {
      self = Color(red: 0, green: 0x79 / 255.0, blue: 0x91 / 255.0)
      return
    }
    self = Color(
      red: Double((value >> 16) & 0xFF) / 255.0,
      green: Double((value >> 8) & 0xFF) / 255.0,
      blue: Double(value & 0xFF) / 255.0
    )
  }
}
