#import <React/RCTEventEmitter.h>
#import <UIKit/UIKit.h>
#import <objc/runtime.h>

// The phone's own text selection on the reader's passages, like the Android
// module of the same name. A passage is a UITextView from
// @bsky.app/react-native-uitextview (class RNUITextView, its text view's
// delegate). Its methods are hooked at runtime, so the library itself stays
// untouched:
// - the system edit menu (Copy, Translate, Share...) stays as UIKit makes it:
//   the app shows its highlight bubble next to it, on the side it leaves free;
// - each selection change goes to JS with where the words are
//   (SelectionMenuShown, or SelectionMenuHidden once it is cleared);
// - a tap on the bubble doesn't clear the selection, as any other tap
//   outside the text does;
// - a double-tap goes to JS with the character tapped
//   (SelectionMenuDoubleTap), instead of selecting the word under it;
// - each new layout sends the lines with their place (SelectionMenuLines),
//   which the library's onTextLayout doesn't give.

static NSString *const kEBSelectionMenuNotification = @"EBSelectionMenuEvent";
// The testID of the app's highlight bubble (HighlightBubble.tsx).
static NSString *const kEBBubbleIdentifier = @"highlight-bubble";

// The text views holding a selection: one at a time, as on Android, and all
// of them for clearSelection.
static NSHashTable<UITextView *> *EBSelectedTextViews(void)
{
  static NSHashTable<UITextView *> *views;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    views = [NSHashTable weakObjectsHashTable];
  });
  return views;
}

static void EBClearSelections(UITextView *except)
{
  for (UITextView *textView in [EBSelectedTextViews() allObjects]) {
    if (textView != except) {
      textView.selectedTextRange = nil;
    }
  }
}

static void EBPost(NSString *name, NSDictionary *body)
{
  [[NSNotificationCenter defaultCenter] postNotificationName:kEBSelectionMenuNotification
                                                      object:nil
                                                    userInfo:@{@"name" : name, @"body" : body}];
}

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

// The library resets the text (and with it the selection) while it redraws,
// with its _suppressSelectionChange flag up; those changes aren't the user's.
static BOOL EBSelectionChangeSuppressed(UIView *owner)
{
  static Ivar flag;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    flag = class_getInstanceVariable(NSClassFromString(@"RNUITextView"), "_suppressSelectionChange");
    // Read only while it is still a BOOL; a library update that changes it
    // makes the check a no-op rather than a read of something else.
    const char *type = flag ? ivar_getTypeEncoding(flag) : NULL;
    if (type == NULL || (strcmp(type, "B") != 0 && strcmp(type, "c") != 0)) {
      flag = NULL;
    }
  });
  if (flag == NULL) {
    return NO;
  }
  return *(BOOL *)((uint8_t *)(__bridge void *)owner + ivar_getOffset(flag));
}

static BOOL EBHasSelection(UITextView *textView)
{
  const NSRange range = textView.selectedRange;
  return range.location != NSNotFound && range.length > 0 && textView.selectedTextRange != nil;
}

// Where the selected words are, in the passage's coordinates (its top-left).
static void EBReportSelection(UIView *owner, UITextView *textView)
{
  if (EBSelectionChangeSuppressed(owner)) {
    return;
  }
  if (!EBHasSelection(textView)) {
    [EBSelectedTextViews() removeObject:textView];
    EBPost(@"SelectionMenuHidden", @{@"tag" : @(owner.tag)});
    return;
  }
  const NSRange range = textView.selectedRange;
  if (![EBSelectedTextViews() containsObject:textView]) {
    // A new selection ends the one in any other passage.
    dispatch_async(dispatch_get_main_queue(), ^{
      EBClearSelections(textView);
    });
    [EBSelectedTextViews() addObject:textView];
  }
  CGRect bounds = CGRectNull;
  for (UITextSelectionRect *selectionRect in [textView selectionRectsForRange:textView.selectedTextRange]) {
    if (CGRectIsEmpty(selectionRect.rect)) {
      continue;
    }
    bounds = CGRectIsNull(bounds) ? selectionRect.rect : CGRectUnion(bounds, selectionRect.rect);
  }
  if (CGRectIsNull(bounds)) {
    // Only a line break selected (the gap between two verses): still sent, so
    // JS learns this selection holds no words.
    bounds = [textView caretRectForPosition:textView.selectedTextRange.start];
  }
  bounds = [textView convertRect:bounds toView:owner];
  EBPost(@"SelectionMenuShown", @{
    @"tag" : @(owner.tag),
    @"start" : @(range.location),
    @"end" : @(NSMaxRange(range)),
    @"x" : @(CGRectGetMidX(bounds)),
    @"top" : @(CGRectGetMinY(bounds)),
    @"bottom" : @(CGRectGetMaxY(bounds)),
  });
}

static const void *kEBLinesKey = &kEBLinesKey;

// Texts whose lines nobody reads (the hymn reader's stanzas), by tag: their
// lines aren't sent. Touched on the main queue only.
static NSMutableSet<NSNumber *> *EBQuietTags(void)
{
  static NSMutableSet<NSNumber *> *tags;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    tags = [NSMutableSet new];
  });
  return tags;
}

// Every line of the passage: how many characters it holds, its top and its
// height, in the passage's coordinates, so JS can find a verse's lines (note
// brackets, jumps). Run when the text has been laid out again, and sent only
// when the lines changed.
static void EBReportLines(UIView *owner)
{
  if ([EBQuietTags() containsObject:@(owner.tag)]) {
    return;
  }
  UITextView *textView = EBFindTextView(owner);
  NSLayoutManager *layoutManager = textView.layoutManager;
  if (layoutManager == nil || textView.text.length == 0) {
    return;
  }
  const CGPoint origin = [textView convertPoint:CGPointMake(textView.textContainerInset.left,
                                                            textView.textContainerInset.top)
                                         toView:owner];
  NSMutableArray<NSDictionary *> *lines = [NSMutableArray new];
  [layoutManager
      enumerateLineFragmentsForGlyphRange:NSMakeRange(0, layoutManager.numberOfGlyphs)
                               usingBlock:^(CGRect rect, CGRect usedRect, NSTextContainer *container,
                                            NSRange glyphRange, BOOL *stop) {
                                 const NSRange characters = [layoutManager characterRangeForGlyphRange:glyphRange
                                                                                      actualGlyphRange:NULL];
                                 [lines addObject:@{
                                   @"length" : @(characters.length),
                                   @"y" : @(origin.y + rect.origin.y),
                                   @"height" : @(rect.size.height),
                                 }];
                               }];
  // Keyed by tag too: a recycled view showing the same text for a new passage
  // must still send its lines.
  NSDictionary *report = @{@"tag" : @(owner.tag), @"lines" : lines};
  if ([report isEqualToDictionary:objc_getAssociatedObject(owner, kEBLinesKey)]) {
    return;
  }
  objc_setAssociatedObject(owner, kEBLinesKey, report, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  EBPost(@"SelectionMenuLines", report);
}

// Whether a touch lands on the app's highlight bubble.
static BOOL EBTouchOnBubble(UITouch *touch)
{
  for (UIView *view = touch.view; view != nil; view = view.superview) {
    if ([view.accessibilityIdentifier isEqualToString:kEBBubbleIdentifier]) {
      return YES;
    }
  }
  return NO;
}

// Reports a passage's lines each time its text has been laid out again.
@interface EBLayoutWatcher : NSObject <NSLayoutManagerDelegate>
@property (nonatomic, weak) UIView *owner;
@property (nonatomic) BOOL reportPending;
@end

@implementation EBLayoutWatcher

- (void)layoutManager:(NSLayoutManager *)layoutManager
    didCompleteLayoutForTextContainer:(NSTextContainer *)textContainer
                                atEnd:(BOOL)layoutFinishedFlag
{
  if (!layoutFinishedFlag || self.reportPending) {
    return;
  }
  // After the layout pass, not inside it.
  self.reportPending = YES;
  dispatch_async(dispatch_get_main_queue(), ^{
    self.reportPending = NO;
    UIView *owner = self.owner;
    if (owner != nil) {
      EBReportLines(owner);
    }
  });
}

@end

// Catches a double-tap on a passage before the text view takes it for a word
// selection, and tells JS which character it landed on.
@interface EBDoubleTapTarget : NSObject <UIGestureRecognizerDelegate>
@property (nonatomic, weak) UIView *owner;
- (void)handleDoubleTap:(UITapGestureRecognizer *)recognizer;
@end

@implementation EBDoubleTapTarget

// UIKit's own multi-tap recognisers in the text view (double-tap selects a
// word, triple-tap a paragraph) wait for this one, whenever UIKit adds them.
// Single taps don't, so they aren't delayed.
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gestureRecognizer
    shouldBeRequiredToFailByGestureRecognizer:(UIGestureRecognizer *)other
{
  if (other.view == nil || ![other.view isDescendantOfView:gestureRecognizer.view]) {
    return NO;
  }
  if ([other isKindOfClass:[UITapGestureRecognizer class]]) {
    return ((UITapGestureRecognizer *)other).numberOfTapsRequired >= 2;
  }
  // UIKit's text interactions also use recognisers of their own classes.
  NSString *name = NSStringFromClass([other class]);
  return [name containsString:@"MultiTap"] || [name containsString:@"TapAndAHalf"];
}

- (void)handleDoubleTap:(UITapGestureRecognizer *)recognizer
{
  UITextView *textView = (UITextView *)recognizer.view;
  UIView *owner = self.owner;
  if (owner == nil || recognizer.state != UIGestureRecognizerStateEnded) {
    return;
  }
  CGPoint point = [recognizer locationInView:textView];
  point.x -= textView.textContainerInset.left;
  point.y -= textView.textContainerInset.top;
  const NSUInteger glyph = [textView.layoutManager glyphIndexForPoint:point inTextContainer:textView.textContainer];
  const NSUInteger offset = [textView.layoutManager characterIndexForGlyphAtIndex:glyph];
  EBPost(@"SelectionMenuDoubleTap", @{@"tag" : @(owner.tag), @"offset" : @(offset)});
}

@end

static const void *kEBDoubleTapKey = &kEBDoubleTapKey;
static const void *kEBLayoutWatcherKey = &kEBLayoutWatcherKey;

// Once per text view: the double-tap recogniser, and the watcher of its
// layout (whose first report covers a layout done before it was there).
static void EBPrepareTextView(UIView *owner)
{
  UITextView *textView = EBFindTextView(owner);
  if (textView == nil) {
    return;
  }
  if (objc_getAssociatedObject(textView, kEBDoubleTapKey) == nil) {
    EBDoubleTapTarget *target = [EBDoubleTapTarget new];
    target.owner = owner;
    UITapGestureRecognizer *doubleTap = [[UITapGestureRecognizer alloc] initWithTarget:target
                                                                                action:@selector(handleDoubleTap:)];
    doubleTap.numberOfTapsRequired = 2;
    doubleTap.cancelsTouchesInView = NO;
    doubleTap.delaysTouchesEnded = NO;
    doubleTap.delegate = target;
    [textView addGestureRecognizer:doubleTap];
    // The recogniser keeps only weak links to its target and delegate.
    objc_setAssociatedObject(doubleTap, kEBDoubleTapKey, target, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    objc_setAssociatedObject(textView, kEBDoubleTapKey, doubleTap, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }
  if (objc_getAssociatedObject(textView, kEBLayoutWatcherKey) == nil && textView.layoutManager.delegate == nil) {
    EBLayoutWatcher *watcher = [EBLayoutWatcher new];
    watcher.owner = owner;
    textView.layoutManager.delegate = watcher;
    // The layout manager keeps only a weak link to its delegate.
    objc_setAssociatedObject(textView, kEBLayoutWatcherKey, watcher, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }
  dispatch_async(dispatch_get_main_queue(), ^{
    EBReportLines(owner);
  });
}

// Runs `after` once the class's own method has run (the method is added when
// the class has none of its own).
static void EBHookSelectionChange(Class cls)
{
  SEL selector = @selector(textViewDidChangeSelection:);
  Method method = class_getInstanceMethod(cls, selector);
  IMP original = method ? method_getImplementation(method) : NULL;
  IMP replacement = imp_implementationWithBlock(^(UIView *owner, UITextView *textView) {
    if (original) {
      ((void (*)(id, SEL, UITextView *))original)(owner, selector, textView);
    }
    EBReportSelection(owner, textView);
  });
  if (!class_addMethod(cls, selector, replacement, "v@:@")) {
    method_setImplementation(method, replacement);
  }
}

static void EBHookDraw(Class cls)
{
  SEL selector = @selector(drawRect:);
  Method method = class_getInstanceMethod(cls, selector);
  if (method == NULL) {
    return;
  }
  IMP original = method_getImplementation(method);
  IMP replacement = imp_implementationWithBlock(^(UIView *owner, CGRect rect) {
    ((void (*)(id, SEL, CGRect))original)(owner, selector, rect);
    // A redraw resets the text with selection changes muted, then puts the
    // selection back; when it can't, that selection has ended.
    UITextView *textView = EBFindTextView(owner);
    if (textView != nil && [EBSelectedTextViews() containsObject:textView] && !EBHasSelection(textView)) {
      EBReportSelection(owner, textView);
    }
  });
  if (!class_addMethod(cls, selector, replacement, method_getTypeEncoding(method))) {
    method_setImplementation(method, replacement);
  }
}

// The double-tap recogniser goes on once the passage is on screen: by then the
// text view is selectable and has its own recognisers.
static void EBHookMoveToWindow(Class cls)
{
  SEL selector = @selector(didMoveToWindow);
  Method method = class_getInstanceMethod(cls, selector);
  if (method == NULL) {
    return;
  }
  IMP original = method_getImplementation(method);
  IMP replacement = imp_implementationWithBlock(^(UIView *owner) {
    ((void (*)(id, SEL))original)(owner, selector);
    if (owner.window != nil) {
      EBPrepareTextView(owner);
    }
  });
  if (!class_addMethod(cls, selector, replacement, method_getTypeEncoding(method))) {
    method_setImplementation(method, replacement);
  }
}

// The library clears the selection on any tap outside the text, through a
// recogniser on the window; a tap on the bubble must keep it, so its colour
// still has words to land on.
static void EBHookOutsideTap(Class cls)
{
  SEL selector = @selector(gestureRecognizer:shouldReceiveTouch:);
  Method method = class_getInstanceMethod(cls, selector);
  if (method == NULL) {
    return;
  }
  IMP original = method_getImplementation(method);
  IMP replacement = imp_implementationWithBlock(^BOOL(UIView *owner, UIGestureRecognizer *recognizer, UITouch *touch) {
    if (recognizer.view != nil && recognizer.view == owner.window && EBTouchOnBubble(touch)) {
      return NO;
    }
    return ((BOOL(*)(id, SEL, UIGestureRecognizer *, UITouch *))original)(owner, selector, recognizer, touch);
  });
  if (!class_addMethod(cls, selector, replacement, method_getTypeEncoding(method))) {
    method_setImplementation(method, replacement);
  }
}

// UIKit may cache which delegate methods exist when a text view gets its
// delegate, so the hooks go in at launch, before any passage is created.
// They apply to every RNUITextView: the Bible's passages and the hymns'
// stanzas, the only ones (the hymns turn their line reports off, skipLines).
// Scope them by tag (attach) if the library is ever used elsewhere.
// A constructor rather than +load, which RCT_EXPORT_MODULE already defines.
__attribute__((constructor)) static void EBInstallHooks(void)
{
  Class cls = NSClassFromString(@"RNUITextView");
  if (cls == nil) {
    return;
  }
  EBHookSelectionChange(cls);
  EBHookDraw(cls);
  EBHookMoveToWindow(cls);
  EBHookOutsideTap(cls);
}

@interface SelectionMenu : RCTEventEmitter <RCTBridgeModule>
@end

@implementation SelectionMenu {
  BOOL _hasListeners;
}

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  if (self = [super init]) {
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(onMenuEvent:)
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
  return @[ @"SelectionMenuShown", @"SelectionMenuHidden", @"SelectionMenuLines", @"SelectionMenuDoubleTap" ];
}

- (void)startObserving
{
  _hasListeners = YES;
}

- (void)stopObserving
{
  _hasListeners = NO;
}

- (void)onMenuEvent:(NSNotification *)notification
{
  if (_hasListeners) {
    [self sendEventWithName:notification.userInfo[@"name"] body:notification.userInfo[@"body"]];
  }
}

// Ends the selection on screen, e.g. once a colour is applied.
RCT_EXPORT_METHOD(clearSelection)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    EBClearSelections(nil);
  });
}

// Android hooks each text by its tag; here every RNUITextView already is.
RCT_EXPORT_METHOD(attach : (double)tag)
{
}

// Stops (skip) or restarts the line reports for one text.
RCT_EXPORT_METHOD(skipLines : (double)tag skip : (BOOL)skip)
{
  NSNumber *key = @((NSInteger)tag);
  dispatch_async(dispatch_get_main_queue(), ^{
    if (skip) {
      [EBQuietTags() addObject:key];
    } else {
      [EBQuietTags() removeObject:key];
    }
  });
}

@end
