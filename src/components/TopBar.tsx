import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {AppMode} from '../screens/MainScreen';
import AnimatedHamburger from './AnimatedHamburger';
import {useTheme} from '../contexts/ThemeContext';
import {useAdaptiveInsets} from '../hooks/useAdaptiveInsets';
import {useResponsive} from '../theme/responsive';
import {useTutorialTarget} from '../contexts/TutorialContext';

const EXTRA_TOP_PADDING = 6;

// Same order as HymnSelectionModal: Fihirana → F. Fifohazana →
// F. Fanampiny → Antema. Keep these two lists in sync.
const HYMNAL_CATEGORIES = [
  { key: 'ffpm', label: 'Fihirana' },
  { key: 'fifo', label: 'F. Fifohazana' },
  { key: 'ff', label: 'F.Fanampiny' },
  { key: 'antema', label: 'Antema' },
];

interface TopBarProps {
  appMode: AppMode;
  title: string;
  onMenuPress: () => void;
  onTitlePress?: () => void;
  isMenuOpen?: boolean;
  onPreviousPress?: () => void;
  onNextPress?: () => void;
  onSearchPress?: () => void;
  currentHymnalCategory?: string;
  onHymnalCategoryChange?: (category: string) => void;
}

const TopBar: React.FC<TopBarProps> = ({
  appMode,
  title,
  onMenuPress,
  onTitlePress,
  isMenuOpen,
  onPreviousPress,
  onNextPress,
  onSearchPress,
  currentHymnalCategory,
  onHymnalCategoryChange,
}) => {
  const {theme} = useTheme();
  const insets = useAdaptiveInsets();
  const titleTargetRef = useTutorialTarget('topbarTitle');
  const prevTargetRef = useTutorialTarget('topbarPrev');
  const nextTargetRef = useTutorialTarget('topbarNext');
  const menuTargetRef = useTutorialTarget('topbarMenu');
  const {isIOS, isAndroid, isSmall, isXSmall, scale, fontFor} = useResponsive();
  const toolbarHeight = Math.max(isAndroid ? 56 : 44, scale(isAndroid ? 52 : 44));
  // 320pt (SE 1st gen and the like) leaves ~113pt for the title next to four
  // 44pt buttons, so narrow the buttons and the title there on both platforms.
  const iconButtonWidth = isXSmall ? 40 : Math.max(40, scale(44));
  // iOS follows the HIG navigation bar: 17pt semibold title and chevrons at
  // bar-button weight. The heavy 900 glyphs read as oversized in San Francisco.
  const arrowFontSize = fontFor(isIOS ? 26 : isXSmall ? 28 : 32);
  const arrowFontWeight = isIOS ? '600' : '900';
  const titleFontSize = fontFor(isIOS ? (isXSmall ? 15 : 17) : isSmall ? 16 : 18);
  const titleFontWeight = isIOS ? '600' : '700';
  const tabFontSize = fontFor(isXSmall ? 12 : isSmall ? 13 : 14);
  const searchIconSize = fontFor(isXSmall ? 17 : 19);

  const handleTitlePress = () => {
    if (appMode === 'hymnal' && onHymnalCategoryChange && currentHymnalCategory) {
      // Cycle through hymnal categories
      const currentIndex = HYMNAL_CATEGORIES.findIndex(cat => cat.key === currentHymnalCategory);
      const nextIndex = (currentIndex + 1) % HYMNAL_CATEGORIES.length;
      onHymnalCategoryChange(HYMNAL_CATEGORIES[nextIndex].key);
    } else if (onTitlePress) {
      onTitlePress();
    }
  };

  // Get display title for hymnal mode
  const displayTitle = appMode === 'hymnal' && currentHymnalCategory 
    ? HYMNAL_CATEGORIES.find(cat => cat.key === currentHymnalCategory)?.label || title
    : title;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.navBackground,
          paddingTop: insets.top + EXTRA_TOP_PADDING,
          height: toolbarHeight + insets.top + EXTRA_TOP_PADDING,
        },
      ]}
    >
      <Pressable
        ref={prevTargetRef}
        collapsable={false}
        accessibilityLabel="Previous chapter"
        android_ripple={{
          color: theme.colors.accentBlue + '40',
          borderless: true,
          foreground: true,
        }}
        style={({pressed}) => [
          styles.iconButton,
          {width: iconButtonWidth},
          pressed && {opacity: 0.85},
        ]}
        onPress={onPreviousPress}
      >
        <Text style={[styles.buttonText, {fontSize: arrowFontSize, fontWeight: arrowFontWeight}]}>‹‹</Text>
      </Pressable>
      
      {appMode === 'hymnal' && onHymnalCategoryChange ? (
        // Hymnal category tabs - replace title when in hymnal mode
        <View
          ref={titleTargetRef}
          collapsable={false}
          style={[
            styles.categoryTabsContainer,
            {
              backgroundColor: theme.colors.navBackground,
              borderColor: 'rgba(255,255,255,0.28)',
            },
          ]}
        >
          {HYMNAL_CATEGORIES.map((category) => (
            <Pressable
              key={category.key}
              android_ripple={{
                color: theme.colors.accentBlue + '40',
                borderless: true,
              }}
              style={({pressed}) => [
                styles.categoryTab,
                currentHymnalCategory === category.key
                  ? {backgroundColor: theme.colors.accentBlue}
                  : {backgroundColor: 'transparent'},
                pressed && {opacity: 0.92},
              ]}
              onPress={() => onHymnalCategoryChange(category.key)}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[
                  styles.categoryTabText,
                  {
                    fontSize: tabFontSize,
                    color:
                      currentHymnalCategory === category.key
                        ? '#FFFFFF'
                        : 'rgba(255,255,255,0.92)',
                    fontWeight: currentHymnalCategory === category.key ? '700' : '600',
                  },
                ]}
              >
                {category.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        // Normal title for other modes
        <Pressable
          ref={titleTargetRef}
          collapsable={false}
          android_ripple={{
            color: theme.colors.accentBlue + '40',
            borderless: true,
          }}
          style={({pressed}) => [styles.titleContainer, pressed && {opacity: 0.92}]}
          onPress={handleTitlePress}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            style={[styles.title, {fontSize: titleFontSize, fontWeight: titleFontWeight}]}
          >
            {displayTitle}
          </Text>
        </Pressable>
      )}
      
      <Pressable
        ref={nextTargetRef}
        collapsable={false}
        accessibilityLabel="Next chapter"
        android_ripple={{
          color: theme.colors.accentBlue + '40',
          borderless: true,
          foreground: true,
        }}
        style={({pressed}) => [
          styles.iconButton,
          {width: iconButtonWidth},
          pressed && {opacity: 0.85},
        ]}
        onPress={onNextPress}
      >
        <Text style={[styles.buttonText, {fontSize: arrowFontSize, fontWeight: arrowFontWeight}]}>{'››'}</Text>
      </Pressable>

      {/* Search magnifier — opens centralized Bible+Hymn search.
          Minimalist plain white magnifier; full-height touch zone like the
          arrow buttons, no border, no ripple mask. */}
      {onSearchPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hitady"
          style={({pressed}) => [
            styles.iconButton,
            {width: iconButtonWidth},
            pressed && {opacity: 0.6},
          ]}
          onPress={onSearchPress}
        >
          {/* Classic magnifier: lens circle + handle stroke at 45°. */}
          <View style={{width: searchIconSize, height: searchIconSize}}>
            <View
              style={[
                styles.searchLens,
                {
                  width: searchIconSize * 0.7,
                  height: searchIconSize * 0.7,
                  borderRadius: searchIconSize,
                },
              ]}
            />
            <View
              style={[
                styles.searchHandle,
                {
                  width: searchIconSize * 0.34,
                  top: searchIconSize * 0.62,
                  left: searchIconSize * 0.58,
                },
              ]}
            />
          </View>
        </Pressable>
      ) : null}

      {/* Hamburger menu - always present */}
      <View ref={menuTargetRef} collapsable={false} style={styles.rightActions}>
        <AnimatedHamburger
          isOpen={isMenuOpen || false}
          onPress={onMenuPress}
          accessibilityLabel={isMenuOpen ? 'Close menu' : 'Open menu'}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 50,
    backgroundColor: '#247BA0',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    overflow: 'hidden',
  },
  searchLens: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 50,
  },
  searchHandle: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    transform: [{rotate: '45deg'}],
  },
  buttonText: {
    color: 'white',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  title: {
    color: 'white',
    letterSpacing: 0.15,
    textAlign: 'center',
    width: '100%',
  },
  categoryTabsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 4,
    marginHorizontal: 6,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  categoryTab: {
    flex: 1,
    flexShrink: 1,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTabText: {
    fontWeight: '500',
    color: '#ecf0f1',
  },
  iconWrapper: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    position: 'absolute',
  },
});

export default TopBar;
