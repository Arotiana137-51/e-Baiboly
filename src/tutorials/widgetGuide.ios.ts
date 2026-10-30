import type {WidgetGuide} from './widgetGuide';

// Apple's steps (support.apple.com/118610), screenshots of a whole iPhone
// screen set to English (iOS 26: the Edit and Done buttons are a brush and a
// check), with the French labels in brackets. The widget is "Sakafom-panahy"
// under e-Baiboly; the lock screen sizes need iOS 16. Other apps' icons and
// widgets, names and the person in the wallpaper are blurred in the pictures.
export const WIDGET_PICTURE = {
  image: require('../../assets/illustrations/widget-guide/result.jpg'),
  aspect: 720 / 402,
};

// Every screenshot is a whole iPhone screen.
const SCREEN = 720 / 1558;

export const WIDGET_GUIDE: WidgetGuide = {
  intro: "Sakafom-panahy isan'andro: andinin-teny iray isan'andro eo amin'ny écran.",
  sections: [
    {
      title: "Écran d'accueil",
      steps: [
        {
          text: "Tsindrio ela (long press) ny toerana malalaka eo amin'ny écran d'accueil, mandra-pihetsiketsiky ny kisary.",
          image: require('../../assets/illustrations/widget-guide/ios/home_1_long_press.jpg'),
          aspect: SCREEN,
          tap: {x: 0.5, y: 0.42, hold: true},
        },
        {
          text: 'Tsindrio ny bokotra eo ankavia ambony.',
          image: require('../../assets/illustrations/widget-guide/ios/home_2_edit.jpg'),
          aspect: SCREEN,
          tap: {x: 0.161, y: 0.037},
          tip: 'Raha soratra no ao amin\'io bokotra io: "Edit" na "Modifier".',
        },
        {
          text: 'Tsindrio "Add Widget" (na "Ajouter un widget").',
          image: require('../../assets/illustrations/widget-guide/ios/home_3_add_widget.jpg'),
          aspect: SCREEN,
          tap: {x: 0.33, y: 0.095},
        },
        {
          text: 'Tsindrio "Search Widgets" (na "Rechercher"), dia soraty "e-Baiboly".',
          image: require('../../assets/illustrations/widget-guide/ios/home_4_search.jpg'),
          aspect: SCREEN,
          tap: {x: 0.5, y: 0.182},
        },
        {
          text: 'Tsindrio "e-Baiboly".',
          image: require('../../assets/illustrations/widget-guide/ios/home_5_result.jpg'),
          aspect: SCREEN,
          tap: {x: 0.25, y: 0.275},
        },
        {
          text: 'Akisaho miankavia na miankavanana hifidianana ny habeny, dia tsindrio "Add Widget" (na "Ajouter le widget").',
          image: require('../../assets/illustrations/widget-guide/ios/home_6_add.jpg'),
          aspect: SCREEN,
          tap: {x: 0.5, y: 0.9},
        },
        {
          text: 'Tsindrio ny ✓ eo ankavanana ambony.',
          image: require('../../assets/illustrations/widget-guide/ios/home_7_done.jpg'),
          aspect: SCREEN,
          tap: {x: 0.837, y: 0.037},
          tip: 'Raha soratra no ao amin\'io bokotra io: "Done" na "OK".',
        },
        {
          text: "Vita! Hiseho eo amin'ny écran isan'andro ny andinin-teny.",
          ...WIDGET_PICTURE,
        },
        {
          // TEMP: Malagasy wording to be written by the owner.
          text: "Raha hanova ny loko na ny soratra: tsindrio ity bokotra ity eo amin'ny widget.",
          image: require('../../assets/illustrations/widget-guide/ios/home_7_done.jpg'),
          aspect: SCREEN,
          tap: {x: 0.886, y: 0.469},
        },
      ],
    },
    {
      title: 'Écran verrouillé',
      steps: [
        {
          // TEMP: Malagasy wording to be written by the owner (this and the
          // next step were one step before).
          text: 'Tsindrio ela ny écran verrouillé.',
          image: require('../../assets/illustrations/widget-guide/ios/lock_1_long_press.jpg'),
          aspect: SCREEN,
          tap: {x: 0.5, y: 0.4, hold: true},
        },
        {
          text: 'Tsindrio "Customize" (na "Personnaliser").',
          image: require('../../assets/illustrations/widget-guide/ios/lock_2_customize.jpg'),
          aspect: SCREEN,
          tap: {x: 0.5, y: 0.93},
        },
        {
          // TEMP: Malagasy wording to be written by the owner.
          text: "Tsindrio ny efajoro eo ambany, toeran'ny widget.",
          image: require('../../assets/illustrations/widget-guide/ios/lock_3_widgets.jpg'),
          aspect: SCREEN,
          tap: {x: 0.5, y: 0.78},
          tip: 'Raha anontaniana: fidio ny "Lock Screen" (na "Écran verrouillé").',
        },
        {
          // TEMP: Malagasy wording to be written by the owner.
          text: 'Tadiavo ao amin\'ny lisitra ny "e-Baiboly", dia tsindrio.',
          image: require('../../assets/illustrations/widget-guide/ios/lock_4_list.jpg'),
          aspect: SCREEN,
          tap: {x: 0.28, y: 0.86},
          tip: 'Raha feno ilay toerana, tsindrio ny − eo amin\'ny widget iray mba hanesorana azy aloha.',
        },
        {
          text: 'Tsindrio ilay widget.',
          image: require('../../assets/illustrations/widget-guide/ios/lock_5_pick.jpg'),
          aspect: SCREEN,
          tap: {x: 0.5, y: 0.75},
        },
        {
          text: 'Tsindrio ny ✕.',
          image: require('../../assets/illustrations/widget-guide/ios/lock_6_close.jpg'),
          aspect: SCREEN,
          tap: {x: 0.895, y: 0.476},
        },
        {
          text: 'Tsindrio "Done" (na "OK"). (iOS 16 no ho miakatra)',
          image: require('../../assets/illustrations/widget-guide/ios/lock_7_done.jpg'),
          aspect: SCREEN,
          tap: {x: 0.836, y: 0.037},
        },
        {
          text: "Vita! Hiseho eo amin'ny écran isan'andro ny andinin-teny.",
          image: require('../../assets/illustrations/widget-guide/ios/lock_7_done.jpg'),
          aspect: SCREEN,
        },
      ],
    },
  ],
};
