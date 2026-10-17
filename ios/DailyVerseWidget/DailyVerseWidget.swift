import SwiftUI
import WidgetKit

// Home-screen "Sakafom-panahy" widget. Pure display: the app (JS) writes
// dailyVerse.json into the App Group container on every launch — one entry per
// local day for the next two months, the accent colour and a deep link — and
// this only renders it (see src/services/widget/dailyVerseWidget.ts for the
// contract). The verse calendar itself lives in JS and is never duplicated.
//
// Look: the share card's — a flat colour with matching ink, or a photo (copied
// next to the feed) under a dark scrim — behind a serif verse and, under it, a
// short rule and the reference; a plan day's label on top. Small, medium and
// large families. With "follow dark mode" the feed adds a night look, used
// while the phone is in dark mode. From iOS 16 the lock screen gets the words
// alone.

private let appGroup = "group.com.ebaiboly.app"
// One-tap shortcut to the look picker (App.tsx routes it to Safidio ny loko).
private let settingsURL = URL(string: "ebaiboly://widget-look")!
private let fileName = "dailyVerse.json"
// Same as DEFAULT_PRIMARY_COLOR_ID's hex in src/theme/personalizationPalette.ts.
private let defaultAccent = "#007991"

private struct FeedLook: Decodable {
  let background: String
  let text: String
  let accent: String
  let image: String?
}

private struct Feed: Decodable {
  let look: FeedLook?
  // Night version of `look`; null when the widget ignores dark mode.
  let lookDark: FeedLook?
  let label: String
  let days: [String: Day]
}

struct Look {
  let background: Color
  let text: Color
  let accent: Color
  let photo: UIImage?

  static let fallback = Look(background: Color(hex: defaultAccent), text: .white, accent: .white, photo: nil)
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
  let look: Look
  let night: Look?
}

private let dayKey: DateFormatter = {
  let f = DateFormatter()
  f.locale = Locale(identifier: "en_US_POSIX")
  f.dateFormat = "yyyy-MM-dd"
  return f
}()

private func groupDir() -> URL? {
  FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
}

private func readFeed() -> Feed? {
  guard
    let dir = groupDir(),
    let data = try? Data(contentsOf: dir.appendingPathComponent(fileName))
  else { return nil }
  return try? JSONDecoder().decode(Feed.self, from: data)
}

// Widgets get ~30 MB; a gallery photo decoded at full size would blow that,
// so it is scaled down to a card-sized bitmap once per timeline.
private func loadPhoto(named name: String?) -> UIImage? {
  guard let name = name, !name.isEmpty, let dir = groupDir(),
        let image = UIImage(contentsOfFile: dir.appendingPathComponent(name).path)
  else { return nil }
  let maxEdge: CGFloat = 800
  let scale = min(1, maxEdge / max(image.size.width, image.size.height))
  if scale >= 1 { return image }
  let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
  return UIGraphicsImageRenderer(size: size).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
}

private func makeLook(_ feed: FeedLook?) -> Look {
  guard let feed = feed else { return .fallback }
  return Look(
    background: Color(hex: feed.background),
    text: Color(hex: feed.text),
    accent: Color(hex: feed.accent),
    photo: loadPhoto(named: feed.image)
  )
}

// No feed yet (fresh install, or the app hasn't been opened in two months).
// Placeholder MG copy — user-owned.
private func fallbackEntry(_ date: Date) -> VerseEntry {
  VerseEntry(
    date: date,
    label: "",
    ref: nil,
    text: "Sokafy ny e-Baiboly hahitana ny andinin-teny androany.",
    url: nil,
    look: .fallback,
    night: nil
  )
}

private let sampleEntry = VerseEntry(
  date: Date(),
  label: "",
  ref: "Salamo 23:1",
  text: "Jehovah no Mpiandry ahy, tsy hanan-java-mahory aho.",
  url: nil,
  look: .fallback,
  night: nil
)

/// One entry per day in the feed from today on, each dated at local midnight,
/// so WidgetKit swaps the verse exactly at the day change without polling.
private func entries(from now: Date) -> [VerseEntry] {
  guard let feed = readFeed() else { return [] }
  let look = makeLook(feed.look)
  let night = feed.lookDark.map { makeLook($0) }
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
      look: look,
      night: night
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
  @Environment(\.colorScheme) private var colorScheme
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

  // WidgetKit redraws the view when the phone switches appearance.
  private var look: Look { colorScheme == .dark ? (entry.night ?? entry.look) : entry.look }

  private var isSmall: Bool { family == .systemSmall }
  // Largest size, which a short verse keeps; a long verse shrinks to fit
  // (minimumScaleFactor below) instead of being cut. Kept close to reading
  // size: a larger start made a short verse on the large widget oversized.
  private var verseSize: CGFloat {
    switch family {
    case .systemSmall: return 15
    case .systemLarge: return 18
    default: return 17
    }
  }
  // Safety cap only: the card's height is the real limit.
  private var verseLines: Int {
    switch family {
    case .systemSmall: return 8
    case .systemLarge: return 16
    default: return 8
    }
  }

  private var ink: Color { look.text }

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
    VStack(alignment: .leading, spacing: 0) {
      // Nothing above the verse but a plan day's label, and not on the small
      // size, where the verse needs every line.
      if !isSmall, !entry.label.isEmpty {
        Text(entry.label.uppercased())
          .font(.system(size: 10, weight: .semibold))
          .kerning(1)
          .foregroundColor(ink.opacity(0.7))
          .lineLimit(1)
          .padding(.bottom, 4)
      }

      Text(entry.text)
        .font(.system(size: verseSize, weight: .medium, design: .serif))
        .foregroundColor(ink)
        .lineSpacing(3)
        .lineLimit(verseLines)
        .minimumScaleFactor(0.6)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.bottom, 10)

      if let ref = entry.ref {
        // A short rule, the reference, and the look shortcut at the end.
        HStack(spacing: 8) {
          Rectangle()
            .fill(look.accent)
            .frame(width: 20, height: 1.5)
          Text(ref)
            .font(.system(size: isSmall ? 11 : 12, weight: .semibold))
            .foregroundColor(look.accent)
            .lineLimit(1)
          // Small widgets only take one URL (widgetURL), so the shortcut is
          // medium/large only. The Link takes the whole trailing remainder
          // of the line so it is an easy target next to the verse tap.
          if !isSmall {
            Link(destination: settingsURL) {
              HStack {
                Spacer(minLength: 8)
                Image(systemName: "slider.horizontal.3")
                  .font(.system(size: 12, weight: .semibold))
                  .accessibilityLabel("Loko") // placeholder MG copy — user-owned
              }
              .foregroundColor(ink.opacity(0.7))
              .frame(maxWidth: .infinity, minHeight: 28, alignment: .trailing)
              .contentShape(Rectangle())
            }
          } else {
            Spacer(minLength: 0)
          }
        }
      }
    }
    .padding(isSmall ? 12 : 16)
    .widgetBackground(CardBackground(look: look))
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

// Flat colour, or the photo centre-cropped under the share card's 45% scrim.
struct CardBackground: View {
  let look: Look

  var body: some View {
    if let photo = look.photo {
      ZStack {
        Image(uiImage: photo)
          .resizable()
          .scaledToFill()
        Color.black.opacity(0.45)
      }
    } else {
      look.background
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
