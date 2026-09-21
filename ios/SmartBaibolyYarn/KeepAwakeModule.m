#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

// Disables the idle timer so the reader stays lit like an open book. The
// timer only concerns the foreground app, so backgrounding releases it
// without any extra bookkeeping. Same JS name and method as the Android
// module.
@interface KeepAwake : NSObject <RCTBridgeModule>
@end

@implementation KeepAwake

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup { return NO; }

RCT_EXPORT_METHOD(setEnabled:(BOOL)enabled) {
  dispatch_async(dispatch_get_main_queue(), ^{
    [UIApplication sharedApplication].idleTimerDisabled = enabled;
  });
}

@end
