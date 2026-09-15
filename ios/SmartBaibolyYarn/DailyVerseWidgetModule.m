#import <React/RCTBridgeModule.h>

// Bridge declaration for the Swift DailyVerseWidgetModule.
@interface RCT_EXTERN_MODULE(DailyVerseWidget, NSObject)
RCT_EXTERN_METHOD(refresh:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
