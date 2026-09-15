import Foundation
import React
import WidgetKit

// Lets JS ask the home-screen widget to reload its timeline right after
// rewriting dailyVerse.json (fresh install, colour change). Same JS name and
// method as the Android module.
@objc(DailyVerseWidget)
class DailyVerseWidgetModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc func refresh(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    WidgetCenter.shared.reloadAllTimelines()
    resolve(true)
  }
}
