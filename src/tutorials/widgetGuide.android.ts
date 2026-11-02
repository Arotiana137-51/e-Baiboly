import type {WidgetGuide} from './widgetGuide';

// Google's steps (support.google.com/android/answer/9450271), screenshots of
// a whole Galaxy A53 screen (One UI 8, phone in French): other launchers look
// a little different but follow the same path. The widget is listed as
// e-Baiboly. Other apps' icons and widgets are blurred in the pictures.
export const WIDGET_PICTURE = {
  image: require('../../assets/illustrations/widget-guide/result.jpg'),
  aspect: 720 / 402,
};

// Every screenshot is a whole phone screen.
const SCREEN = 720 / 1600;

export const WIDGET_GUIDE: WidgetGuide = {
  intro: "Sakafom-panahy isan'andro: andinin-teny iray isan'andro eo amin'ny écran.",
  sections: [
    {
      title: "Eo amin'ny écran d'accueil",
      steps: [
        {
          text: "Tsindrio ela (long press) ny toerana malalaka eo amin'ny écran d'accueil.",
          image: require('../../assets/illustrations/widget-guide/android/home_1_long_press.jpg'),
          aspect: SCREEN,
          tap: {x: 0.5, y: 0.45, hold: true},
        },
        {
          text: 'Tsindrio "Widgets".',
          image: require('../../assets/illustrations/widget-guide/android/home_2_widgets.jpg'),
          aspect: SCREEN,
          tap: {x: 0.617, y: 0.866},
          tip: 'Raha tsy hitanao ny "Widgets": tsindrio ela ny kisary e-Baiboly, dia tsindrio "Widgets".',
        },
        {
          text: 'Tsindrio "Rechercher", dia soraty "e-Baiboly".',
          image: require('../../assets/illustrations/widget-guide/android/home_3_search.jpg'),
          aspect: SCREEN,
          tap: {x: 0.5, y: 0.074},
        },
        {
          text: 'Tsindrio "e-Baiboly".',
          image: require('../../assets/illustrations/widget-guide/android/home_4_result.jpg'),
          aspect: SCREEN,
          tap: {x: 0.31, y: 0.153},
        },
        {
          // TEMP: Malagasy wording to be written by the owner (this and the
          // next step split the old "Tsindrio ilay widget, dia tsindrio
          // Ajouter").
          text: 'Tsindrio ilay widget.',
          image: require('../../assets/illustrations/widget-guide/android/home_5_widget.jpg'),
          aspect: SCREEN,
          tap: {x: 0.5, y: 0.34},
        },
        {
          // TEMP: Malagasy wording to be written by the owner.
          text: 'Tsindrio "Ajouter".',
          image: require('../../assets/illustrations/widget-guide/android/home_6_add.jpg'),
          aspect: SCREEN,
          tap: {x: 0.5, y: 0.386},
        },
        {
          // TEMP: Malagasy wording to be written by the owner.
          text: "Raha hanova ny habeny: sintony ny zorony. Avy eo, tsindrio ny toerana malalaka.",
          image: require('../../assets/illustrations/widget-guide/android/home_7_size.jpg'),
          aspect: SCREEN,
          tap: {x: 0.5, y: 0.6},
        },
        {
          text: "Vita! Hiseho eo amin'ny écran isan'andro ny andinin-teny.",
          image: require('../../assets/illustrations/widget-guide/android/home_8_done.jpg'),
          aspect: SCREEN,
        },
        {
          // TEMP: Malagasy wording to be written by the owner.
          text: "Raha hanova ny loko na ny soratra: tsindrio ity bokotra ity eo amin'ny widget.",
          image: require('../../assets/illustrations/widget-guide/android/home_8_done.jpg'),
          aspect: SCREEN,
          tap: {x: 0.887, y: 0.624},
        },
      ],
    },
  ],
};
