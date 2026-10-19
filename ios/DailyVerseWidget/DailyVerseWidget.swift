import ImageIO
import SwiftUI
import WidgetKit
import AppIntents

// Home-screen daily verse widget. Pure display: the app (JS) writes
// dailyVerse.json into the App Group container on every launch — one entry per
// local day for the next two months, the look, the text settings and per day a
// deep link, the mode and whether the verse is a favorite — and this only
// renders it (see src/services/widget/dailyVerseWidget.ts for the contract).
// The verse calendar itself lives in JS and is never duplicated.
//
// Look: the share card's — the chosen colour as a diagonal gradient with
// matching ink, or a photo (copied next to the feed) under a veil — behind the
// verse in the chosen typeface and size, a date badge and the heart on top,
// reference + translation tag + mode on the bottom line; small, medium and large
// families. With "follow dark mode" the feed adds a night look, used while the
// phone is in dark mode. From iOS 16 the lock screen gets the words alone.
//
// The heart adds the verse to the app's favorites, or takes it out: from iOS
// 17 without opening the app (ToggleFavoriteIntent records the wanted state in
// widgetFavorites.json, which the app folds in when it comes to the front);
// before that, through an ebaiboly://favorite link that opens the app.

private let appGroup = "group.com.ebaiboly.app"
// One-tap shortcut to the look picker (App.tsx routes it to Safidio ny loko).
private let settingsURL = URL(string: "ebaiboly://widget-look")!
private let fileName = "dailyVerse.json"
// Hearts tapped on the widget, {"19:23:1": true}; read and cleared by the app.
private let heartsFileName = "widgetFavorites.json"
// Same as DEFAULT_PRIMARY_COLOR_ID's hex in src/theme/personalizationPalette.ts.
private let defaultAccent = "#007991"

private struct FeedVeil: Decodable {
  let color: String
  let alpha: Double
}

private struct FeedLook: Decodable {
  let background: String
  let text: String
  let accent: String
  let image: String?
  let veil: FeedVeil?
}

private struct FeedText: Decodable {
  let scale: Double
  let font: String
}

private struct Feed: Decodable {
  let look: FeedLook?
  // Night version of `look`; null when the widget ignores dark mode.
  let lookDark: FeedLook?
  let text: FeedText?
  let label: String
  let translation: String?
  let days: [String: Day]
}

struct Look {
  let background: Color
  let text: Color
  let accent: Color
  let photo: UIImage?
  // Laid over the photo so the text on it reads.
  let veil: Color

  static let fallback = Look(
    background: Color(hex: defaultAccent),
    text: .white,
    accent: .white,
    photo: nil,
    veil: Color.black.opacity(0.45)
  )
}

private struct Day: Decodable {
  let ref: String
  let text: String
  let url: String
  let dateLabel: String?
  // The mode: "Fampaherezana", or a Teny ho anao plan day's own label.
  let label: String?
  // The verse for the heart; absent on a check-in day.
  let key: String?
  let fav: Bool?
  let favUrl: String?
}

struct VerseEntry: TimelineEntry {
  let date: Date
  let dateLabel: String
  let label: String
  let translation: String
  let ref: String?
  let text: String
  let url: URL?
  let look: Look
  let night: Look?
  let scale: CGFloat
  let font: String
  let key: String?
  let favorite: Bool
  // iOS 15-16 heart: opens the app, which records the wanted state.
  let favURL: URL?
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

// Widgets get ~30 MB, so the photo must never be decoded at full size. ImageIO
// builds an 800 px thumbnail straight from the file; drawing through
// UIGraphicsImageRenderer instead silently multiplied the bitmap by the screen
// scale and got the extension killed mid-render, leaving the previous look.
private func loadPhoto(named name: String?) -> UIImage? {
  guard let name = name, !name.isEmpty, let dir = groupDir() else { return nil }
  let options: [CFString: Any] = [
    kCGImageSourceCreateThumbnailFromImageAlways: true,
    kCGImageSourceCreateThumbnailWithTransform: true,
    kCGImageSourceThumbnailMaxPixelSize: 800,
  ]
  guard let source = CGImageSourceCreateWithURL(dir.appendingPathComponent(name) as CFURL, nil),
        let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
  else { return nil }
  return UIImage(cgImage: thumbnail)
}

private func makeLook(_ feed: FeedLook?) -> Look {
  guard let feed = feed else { return .fallback }
  return Look(
    background: Color(hex: feed.background),
    text: Color(hex: feed.text),
    accent: Color(hex: feed.accent),
    photo: loadPhoto(named: feed.image),
    veil: feed.veil.map { Color(hex: $0.color).opacity($0.alpha) } ?? Color.black.opacity(0.45)
  )
}

private func readHearts() -> [String: Bool] {
  guard
    let dir = groupDir(),
    let data = try? Data(contentsOf: dir.appendingPathComponent(heartsFileName)),
    let hearts = try? JSONDecoder().decode([String: Bool].self, from: data)
  else { return [:] }
  return hearts
}

private func recordHeart(key: String, on: Bool) {
  guard let dir = groupDir() else { return }
  var hearts = readHearts()
  hearts[key] = on
  if let data = try? JSONEncoder().encode(hearts) {
    try? data.write(to: dir.appendingPathComponent(heartsFileName), options: .atomic)
  }
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
    look: .fallback,
    night: nil,
    scale: 1,
    font: "serif",
    key: nil,
    favorite: false,
    favURL: nil
  )
}

private let sampleEntry = VerseEntry(
  date: Date(),
  dateLabel: "Tal 15 Sep",
  label: "Fampaherezana",
  translation: "MG1865",
  ref: "Salamo 23:1",
  text: "Jehovah no Mpiandry ahy, tsy hanan-java-mahory aho.",
  url: nil,
  look: .fallback,
  night: nil,
  scale: 1,
  font: "serif",
  key: nil,
  favorite: false,
  favURL: nil
)

/// One entry per day in the feed from today on, each dated at local midnight,
/// so WidgetKit swaps the verse exactly at the day change without polling.
private func entries(from now: Date) -> [VerseEntry] {
  guard let feed = readFeed() else { return [] }
  let look = makeLook(feed.look)
  let night = feed.lookDark.map { makeLook($0) }
  // A heart tapped since the app last looked wins over the feed.
  let hearts = readHearts()
  let calendar = Calendar.current
  let today = calendar.startOfDay(for: now)
  return feed.days.keys.sorted().compactMap { key -> VerseEntry? in
    guard let day = feed.days[key], let parsed = dayKey.date(from: key) else { return nil }
    let midnight = calendar.startOfDay(for: parsed)
    if midnight < today { return nil }
    let favorite = day.key.flatMap { hearts[$0] } ?? day.fav ?? false
    return VerseEntry(
      date: midnight == today ? now : midnight,
      dateLabel: day.dateLabel ?? key,
      label: day.label ?? feed.label,
      translation: feed.translation ?? "",
      ref: day.ref,
      text: day.text,
      url: URL(string: day.url),
      look: look,
      night: night,
      scale: CGFloat(feed.text?.scale ?? 1),
      font: feed.text?.font ?? "serif",
      key: day.key,
      favorite: favorite,
      favURL: day.favUrl.flatMap { URL(string: "\($0)&on=\(favorite ? 0 : 1)") }
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

// The heart from iOS 17: records the wanted state without opening the app;
// WidgetKit reloads the timeline once it returns.
@available(iOS 17.0, *)
struct ToggleFavoriteIntent: AppIntent {
  static let title: LocalizedStringResource = "Ankafizina" // placeholder MG copy — user-owned
  static let isDiscoverable = false

  @Parameter(title: "Andininy") var key: String
  @Parameter(title: "Ankafizina") var favorite: Bool

  init() {}

  init(key: String, favorite: Bool) {
    self.key = key
    self.favorite = favorite
  }

  func perform() async throws -> some IntentResult {
    recordHeart(key: key, on: favorite)
    return .result()
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

  // The chosen typeface and size; the italic is a serif one.
  private var verseFont: Font {
    let font = Font.system(
      size: verseSize * entry.scale,
      weight: .medium,
      design: entry.font == "sans" ? .default : .serif
    )
    return entry.font == "italic" ? font.italic() : font
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

  @ViewBuilder
  private var heart: some View {
    if let key = entry.key {
      let symbol = Image(systemName: entry.favorite ? "heart.fill" : "heart")
        .font(.system(size: 13, weight: .semibold))
        .foregroundColor(ink.opacity(0.9))
        .frame(width: 28, height: 28)
        .contentShape(Rectangle())
      if #available(iOS 17.0, *) {
        Button(intent: ToggleFavoriteIntent(key: key, favorite: !entry.favorite)) { symbol }
          .buttonStyle(.plain)
      } else {
        // Small widgets only take one URL (widgetURL), so no heart there.
        if !isSmall, let url = entry.favURL {
          Link(destination: url) { symbol }
        }
      }
    }
  }

  private var card: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .center) {
        Text(entry.dateLabel.uppercased())
          .font(.system(size: 10, weight: .semibold))
          .kerning(1)
          .foregroundColor(ink.opacity(0.9))
          .padding(.horizontal, 9)
          .padding(.vertical, 2)
          .background(Capsule().fill(ink.opacity(0.15)))
          .overlay(Capsule().stroke(ink.opacity(0.1), lineWidth: 1))
          .lineLimit(1)
        Spacer(minLength: 4)
        heart
          .padding(.trailing, -6)
      }

      // Quotes around a verse; the check-in card's question stays bare.
      Text(entry.key == nil ? entry.text : "\u{201C}\(entry.text)\u{201D}")
        .font(verseFont)
        .foregroundColor(ink)
        .lineSpacing(3)
        .lineLimit(verseLines)
        .minimumScaleFactor(0.6)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.vertical, 8)

      if let ref = entry.ref {
        Rectangle()
          .fill(ink.opacity(0.2))
          .frame(height: 1)
        HStack(spacing: 4) {
          Text(ref)
            .font(.system(size: isSmall ? 11 : 12, weight: .semibold))
            .foregroundColor(look.accent)
            .lineLimit(1)
          if !entry.translation.isEmpty && !isSmall {
            Text(entry.translation.uppercased())
              .font(.system(size: 9, weight: .medium))
              .kerning(0.5)
              .foregroundColor(ink.opacity(0.6))
              .padding(.horizontal, 3)
              .padding(.vertical, 1)
              .background(RoundedRectangle(cornerRadius: 4).fill(ink.opacity(0.1)))
          }
          Spacer(minLength: 6)
          // Small widgets only take one URL (widgetURL), so the mode and the
          // look shortcut are medium/large only.
          if !isSmall {
            if !entry.label.isEmpty {
              Text(entry.label.uppercased())
                .font(.system(size: 10, weight: .medium))
                .kerning(0.8)
                .foregroundColor(ink.opacity(0.7))
                .lineLimit(1)
            }
            Link(destination: settingsURL) {
              Image(systemName: "slider.horizontal.3")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(ink.opacity(0.7))
                .frame(minWidth: 28, minHeight: 28, alignment: .trailing)
                .contentShape(Rectangle())
                .accessibilityLabel("Loko") // placeholder MG copy — user-owned
            }
          }
        }
        .padding(.top, 4)
      }
    }
    .padding(isSmall ? 12 : 14)
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

// The colour as a diagonal gradient into a darker shade of itself, or the photo
// centre-cropped under its veil.
struct CardBackground: View {
  let look: Look

  var body: some View {
    if let photo = look.photo {
      ZStack {
        Image(uiImage: photo)
          .resizable()
          .scaledToFill()
        look.veil
      }
    } else {
      LinearGradient(
        colors: [look.background, look.background.darkened(0.45)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
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

  func darkened(_ amount: Double) -> Color {
    let ui = UIColor(self)
    var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
    ui.getRed(&r, green: &g, blue: &b, alpha: &a)
    let k = 1 - amount
    return Color(red: Double(r * k), green: Double(g * k), blue: Double(b * k))
  }
}
