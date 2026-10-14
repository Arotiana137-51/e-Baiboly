#import <React/RCTEventEmitter.h>
#import <UIKit/UIKit.h>
#import <objc/runtime.h>

// Puts the app's own actions (Surligner, Naoty, ...) in the phone's
// text-selection menu, like the Android module of the same name: the
// primary ones first, then the system's (Copy, Look Up, Translate), then
// the rest. The system Share is dropped: the app's own sharing does more.
//
// The selectable verse text is a UITextView from @bsky.app/react-native-
// uitextview (class RNUITextView), which is its text view's delegate but
// builds no menu of its own. The menu delegate method is added to that
// class at runtime, so the library itself stays untouched. If a later
// version implements it, class_addMethod leaves its version in place.

static NSString *const kEBSelectionMenuNotification = @"EBSelectionMenuAction";
static NSArray<NSDictionary *> *sEBItems;

static UITextView *EBFindTextView(UIView *root)
{
  for (UIView *child in root.subviews) {
    if ([child isKindOfClass:[UITextView class]]) {
      return (UITextView *)child;
    }
    UITextView *found = EBFindTextView(child);
    if (found) {
      return found;
    }
  }
  return nil;
}

static void EBSendAction(UIView *owner, UITextView *textView, NSString *key, NSRange range)
{
  [[NSNotificationCenter defaultCenter] postNotificationName:kEBSelectionMenuNotification
                                                      object:nil
                                                    userInfo:@{
                                                      @"tag" : @(owner.tag),
                                                      @"key" : key,
                                                      @"start" : @(range.location),
                                                      @"end" : @(NSMaxRange(range)),
                                                    }];
  // As on Android, an action ends the selection.
  textView.selectedTextRange = nil;
}

API_AVAILABLE(ios(16.0))
static UIMenu *EBBuildMenu(UIView *owner, UITextView *textView, NSRange range, NSArray<UIMenuElement *> *suggested)
{
  NSMutableArray<UIMenuElement *> *primary = [NSMutableArray new];
  NSMutableArray<UIMenuElement *> *secondary = [NSMutableArray new];
  for (NSDictionary *item in sEBItems) {
    NSString *key = item[@"key"];
    UIAction *action = [UIAction actionWithTitle:item[@"label"]
                                           image:nil
                                      identifier:nil
                                         handler:^(__kindof UIAction *_) {
                                           EBSendAction(owner, textView, key, range);
                                         }];
    [([item[@"primary"] boolValue] ? primary : secondary) addObject:action];
  }

  NSMutableArray<UIMenuElement *> *children = [NSMutableArray arrayWithArray:primary];
  for (UIMenuElement *element in suggested) {
    if ([element isKindOfClass:[UIMenu class]] &&
        [((UIMenu *)element).identifier isEqualToString:UIMenuShare]) {
      continue;
    }
    [children addObject:element];
  }
  [children addObjectsFromArray:secondary];
  return [UIMenu menuWithChildren:children];
}

// iOS 16+: the edit menu is asked from the text view's delegate.
static void EBInstallMenuHook(void)
{
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    Class cls = NSClassFromString(@"RNUITextView");
    if (cls == nil) {
      return;
    }
    if (@available(iOS 16.0, *)) {
      SEL selector = @selector(textView:editMenuForTextInRange:suggestedActions:);
      struct objc_method_description description =
          protocol_getMethodDescription(@protocol(UITextViewDelegate), selector, NO, YES);
      if (description.types == NULL) {
        return;
      }
      id block = ^UIMenu *(UIView *owner, UITextView *textView, NSRange range, NSArray<UIMenuElement *> *suggested) {
        return EBBuildMenu(owner, textView, range, suggested);
      };
      class_addMethod(cls, selector, imp_implementationWithBlock(block), description.types);
    }
  });
}

// iOS 15: UIMenuController items, appended after the system's. Each needs
// its own selector; the responder chain reaches RNUITextView from its text
// view, so only selectable verses show them (the default canPerformAction:
// answers YES for a selector the class implements).
static void EBInstallLegacyMenuItems(void)
{
  if (@available(iOS 16.0, *)) {
    return;
  }
  Class cls = NSClassFromString(@"RNUITextView");
  if (cls == nil) {
    return;
  }
  NSMutableArray<UIMenuItem *> *menuItems = [NSMutableArray new];
  [sEBItems enumerateObjectsUsingBlock:^(NSDictionary *item, NSUInteger index, BOOL *stop) {
    SEL selector = NSSelectorFromString([NSString stringWithFormat:@"eb_selectionMenu%lu:", (unsigned long)index]);
    NSString *key = item[@"key"];
    id block = ^(UIView *owner, id sender) {
      UITextView *textView = EBFindTextView(owner);
      if (textView) {
        EBSendAction(owner, textView, key, textView.selectedRange);
      }
    };
    class_replaceMethod(cls, selector, imp_implementationWithBlock(block), "v@:@");
    [menuItems addObject:[[UIMenuItem alloc] initWithTitle:item[@"label"] action:selector]];
  }];
  [UIMenuController sharedMenuController].menuItems = menuItems;
}

@interface SelectionMenu : RCTEventEmitter <RCTBridgeModule>
@end

@implementation SelectionMenu {
  BOOL _hasListeners;
}

RCT_EXPORT_MODULE();

// UIKit may cache which delegate methods exist when a text view gets its
// delegate, so the method goes in at launch, before any verse is created.
+ (void)load
{
  EBInstallMenuHook();
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  if (self = [super init]) {
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(onMenuAction:)
                                                 name:kEBSelectionMenuNotification
                                               object:nil];
  }
  return self;
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ @"SelectionMenuAction" ];
}

- (void)startObserving
{
  _hasListeners = YES;
}

- (void)stopObserving
{
  _hasListeners = NO;
}

- (void)onMenuAction:(NSNotification *)notification
{
  if (_hasListeners) {
    [self sendEventWithName:@"SelectionMenuAction" body:notification.userInfo];
  }
}

RCT_EXPORT_METHOD(setItems : (NSArray *)items)
{
  sEBItems = [items copy];
  dispatch_async(dispatch_get_main_queue(), ^{
    EBInstallLegacyMenuItems();
  });
}

// Android hooks each text by its tag; here every RNUITextView already is.
RCT_EXPORT_METHOD(attach : (double)tag)
{
}

@end
