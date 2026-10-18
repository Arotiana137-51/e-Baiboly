import SwiftUI
import WidgetKit

// Home-screen daily verse widget. Pure display: the app (JS) writes
// dailyVerse.json into the App Group container on every launch — one entry per
// local day for the next two months, the app's accent colour and a deep link —
// and this only renders it (see src/services/widget/dailyVerseWidget.ts for the
// contract). The verse calendar itself lives in JS and is never duplicated.
//
// A card in the system background (light or dark), an accent stripe, the
// reference in the accent, and the verse; a Teny ho anao plan day adds its
// label on the top line. Small, medium and large families, and from iOS 16
// the lock screen, which gets the words alone.

private let appGroup = "group.com.ebaiboly.app"
private let fileName = "dailyVerse.json"
// Same as DEFAULT_PRIMARY_COLOR_ID's hex in src/theme/personalizationPalette.ts.
private let defaultAccent = "#007991"

private struct Feed: Decodable {
  let accent: String?
  let label: String
  let days: [String: Day]
}

private struct Day: Decodable {
  let ref: String
  let text: String
  let url: String
  // A Teny ho anao plan day's own label, shown instead of the feed's.
  let label: String?
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
  label: "",
  ref: "Salamo 23:1",
  text: "Jehovah no Mpiandry ahy, tsy hanan-java-mahory aho.",
  url: nil,
  accent: Color(hex: defaultAccent)
)

/// One entry per day in the feed from today on, each dated at local midnight,
/// so WidgetKit swaps the verse exactly at the day change without polling.
private func entries(from now: Date) -> [VerseEntry] {
  guard let feed = readFeed() else { return [] }
  let accent = Color(hex: feed.accent ?? defaultAccent)
  let calendar = Calendar.current
  let today = calendar.startOfDay(for: now)
  return feed.days.keys.sorted().compactMap { key -> VerseEntry? in
    guard let day = feed.days[key], let parsed = dayKey.date(from: key) else { return nil }
    let midnight = calendar.startOfDay(for: parsed)
    if midnight < today { return nil }
    return VerseEntry(
      date: midnight == today ? now : midnight,
      label: day.label ?? feed.label,
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

  // The lock screen families only exist from iOS 16, hence the checks.
  private var isLockScreen: Bool {
    if #available(iOSApplicationExtension 16.0, *) {
      return family == .accessoryRectangular || family == .accessoryInline
    }
    return false
  }

  private var isInline: Bool {
    if #available(iOSApplicationExtension 16.0, *) {
      return family == .accessoryInline
    }
    return false
  }

  // 14pt as designed; the line cap follows the card's height, and a long
  // verse shrinks a little rather than being cut.
  private var verseLines: Int {
    switch family {
    case .systemSmall: return 6
    case .systemLarge: return 14
    default: return 5
    }
  }

  var body: some View {
    if isLockScreen {
      LockScreenVerse(entry: entry, inline: isInline)
        .widgetBackground(Color.clear)
        .widgetURL(entry.url)
    } else {
      card
    }
  }

  private var card: some View {
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
          .lineLimit(verseLines)
          .minimumScaleFactor(0.8)
        Spacer(minLength: 0)
      }
    }
    .padding(12)
    .widgetBackground(Color(UIColor.systemBackground))
    .widgetURL(entry.url)
  }
}

// Lock screen: the system draws it in its own tinted style, so only the words
// travel. Rectangular: the reference over the start of the verse; inline: one
// line next to the date.
struct LockScreenVerse: View {
  let entry: VerseEntry
  let inline: Bool

  var body: some View {
    if inline {
      Text(entry.ref.map { "\($0) · \(entry.text)" } ?? entry.text)
    } else {
      VStack(alignment: .leading, spacing: 1) {
        if let ref = entry.ref {
          Text(ref)
            .font(.system(size: 13, weight: .semibold))
            .lineLimit(1)
        }
        Text(entry.text)
          .font(.system(size: 13, design: .serif))
          .lineLimit(entry.ref == nil ? 3 : 2)
          .minimumScaleFactor(0.85)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
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
    .description("Andinin-teny iray isan'andro eo amin'ny écran.")
    .verseFamilies()
    .ownContentMargins()
  }
}

private extension WidgetConfiguration {
  // The home screen sizes, plus the lock screen ones from iOS 16.
  func verseFamilies() -> some WidgetConfiguration {
    if #available(iOSApplicationExtension 16.0, *) {
      return supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryInline])
    } else {
      return supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
  }

  // iOS 17 adds its own content margins around every widget; the view already
  // pads itself, so without this the verse sits ~30pt in from each edge.
  func ownContentMargins() -> some WidgetConfiguration {
    if #available(iOSApplicationExtension 17.0, *) {
      return contentMarginsDisabled()
    } else {
      return self
    }
  }
}

private extension View {
  // iOS 17 requires containerBackground for widgets; earlier versions take a
  // plain background.
  @ViewBuilder
  func widgetBackground<B: View>(_ background: B) -> some View {
    if #available(iOS 17.0, *) {
      containerBackground(for: .widget) { background }
    } else {
      self.background(background)
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
