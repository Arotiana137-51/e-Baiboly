import SwiftUI
import WidgetKit

// Home-screen "Sakafom-panahy" widget. Pure display: the app (JS) writes
// dailyVerse.json into the App Group container on every launch — one entry per
// local day for the next two months, the accent colour and a deep link — and
// this only renders it (see src/services/widget/dailyVerseWidget.ts for the
// contract). The verse calendar itself lives in JS and is never duplicated.
//
// Look: a gradient of the accent colour behind white serif text, a date badge
// on top, reference + translation tag on the bottom line; small, medium and
// large families.

private let appGroup = "group.com.ebaiboly.app"
private let fileName = "dailyVerse.json"
// Same as DEFAULT_PRIMARY_COLOR_ID's hex in src/theme/personalizationPalette.ts.
private let defaultAccent = "#007991"

private struct Feed: Decodable {
  let accent: String
  let label: String
  let translation: String?
  let days: [String: Day]
}

private struct Day: Decodable {
  let ref: String
  let text: String
  let url: String
  let dateLabel: String?
}

struct VerseEntry: TimelineEntry {
  let date: Date
  let dateLabel: String
  let label: String
  let translation: String
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
    dateLabel: "e-Baiboly",
    label: "",
    translation: "",
    ref: nil,
    text: "Sokafy ny e-Baiboly hahitana ny andinin-teny androany.",
    url: nil,
    accent: Color(hex: defaultAccent)
  )
}

private let sampleEntry = VerseEntry(
  date: Date(),
  dateLabel: "Tal 15 Sep",
  label: "Sakafom-panahy",
  translation: "MG1865",
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
      dateLabel: day.dateLabel ?? key,
      label: feed.label,
      translation: feed.translation ?? "",
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
  @Environment(\.widgetFamily) private var family
  let entry: VerseEntry

  private var isSmall: Bool { family == .systemSmall }
  private var verseSize: CGFloat {
    switch family {
    case .systemSmall: return 13
    case .systemLarge: return 19
    default: return 15.5
    }
  }
  private var verseLines: Int {
    switch family {
    case .systemSmall: return 5
    case .systemLarge: return 10
    default: return 4
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .center) {
        Text(entry.dateLabel.uppercased())
          .font(.system(size: 10, weight: .semibold))
          .kerning(1)
          .foregroundColor(.white.opacity(0.9))
          .padding(.horizontal, 9)
          .padding(.vertical, 2)
          .background(Capsule().fill(Color.white.opacity(0.15)))
          .overlay(Capsule().stroke(Color.white.opacity(0.1), lineWidth: 1))
          .lineLimit(1)
        Spacer(minLength: 4)
        if !isSmall, !entry.label.isEmpty {
          Text(entry.label.uppercased())
            .font(.system(size: 10))
            .kerning(1)
            .foregroundColor(.white.opacity(0.7))
            .lineLimit(1)
        }
      }

      Spacer(minLength: 4)
      Text(entry.ref == nil ? entry.text : "\u{201C}\(entry.text)\u{201D}")
        .font(.system(size: verseSize, weight: .medium, design: .serif))
        .foregroundColor(.white)
        .lineSpacing(3)
        .lineLimit(verseLines)
        .shadow(color: .black.opacity(0.6), radius: 3, x: 0, y: 1)
      Spacer(minLength: 4)

      if let ref = entry.ref {
        Rectangle()
          .fill(Color.white.opacity(0.2))
          .frame(height: 1)
        HStack(spacing: 6) {
          Text(ref)
            .font(.system(size: isSmall ? 11 : 12, weight: .semibold))
            .foregroundColor(.white)
            .shadow(color: .black.opacity(0.6), radius: 2, x: 0, y: 1)
            .lineLimit(1)
          if !entry.translation.isEmpty {
            Text(entry.translation.uppercased())
              .font(.system(size: 9, weight: .medium))
              .kerning(1)
              .foregroundColor(.white.opacity(0.6))
              .padding(.horizontal, 4)
              .padding(.vertical, 1)
              .background(RoundedRectangle(cornerRadius: 4).fill(Color.white.opacity(0.1)))
          }
          Spacer(minLength: 0)
        }
        .padding(.top, 6)
      }
    }
    .padding(isSmall ? 12 : 14)
    .widgetBackground(
      LinearGradient(
        colors: [entry.accent, entry.accent.darkened(0.45)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    )
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
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

private extension View {
  // iOS 17 requires containerBackground for widgets; earlier versions take a
  // plain background.
  @ViewBuilder
  func widgetBackground<S: ShapeStyle>(_ style: S) -> some View {
    if #available(iOS 17.0, *) {
      containerBackground(style, for: .widget)
    } else {
      background(style)
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

  /// Blends towards black by `amount` (0...1), mirroring ColorUtils.blendARGB on Android.
  func darkened(_ amount: Double) -> Color {
    let ui = UIColor(self)
    var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
    ui.getRed(&r, green: &g, blue: &b, alpha: &a)
    let k = 1 - amount
    return Color(red: Double(r * k), green: Double(g * k), blue: Double(b * k))
  }
}
