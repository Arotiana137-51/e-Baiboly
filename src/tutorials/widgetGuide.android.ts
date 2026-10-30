import type {WidgetGuide} from './widgetGuide';

// Google's steps (support.google.com/android/answer/9450271), photographed on
// a Galaxy A53 (One UI 8, phone in French): other launchers look a little
// different but follow the same path. The widget is listed as e-Baiboly.
export const WIDGET_PICTURE = {
  image: require('../../assets/illustrations/widget-guide/result.jpg'),
  aspect: 720 / 402,
};

export const WIDGET_GUIDE: WidgetGuide = {
  intro: "Sakafom-panahy isan'andro: andinin-teny iray isan'andro eo amin'ny écran.",
  sections: [
    {
      title: "Eo amin'ny écran d'accueil",
      steps: [
        {
          text: "Tsindrio ela (long press) ny toerana malalaka eo amin'ny écran d'accueil.",
          image: require('../../assets/illustrations/widget-guide/home_long_press.jpg'),
          aspect: 720 / 760,
          tap: {x: 0.5, y: 0.67, hold: true},
        },
        {
          text: 'Tsindrio "Widgets".',
          image: require('../../assets/illustrations/widget-guide/android/widgets_button.jpg'),
          aspect: 3.6,
          tap: {x: 0.619, y: 0.44},
          tip: 'Raha tsy hitanao ny "Widgets": tsindrio ela ny kisary e-Baiboly, dia tsindrio "Widgets".',
        },
        {
          text: 'Tsindrio "Rechercher", dia soraty "e-Baiboly".',
          image: require('../../assets/illustrations/widget-guide/android/search_field.jpg'),
          aspect: 7.5,
          tap: {x: 0.5, y: 0.486},
        },
        {
          text: 'Tsindrio "e-Baiboly".',
          image: require('../../assets/illustrations/widget-guide/android/search_result.jpg'),
          aspect: 2.9032,
          tap: {x: 0.5, y: 0.697},
        },
        {
          text: 'Tsindrio ilay widget, dia tsindrio "Ajouter".',
          image: require('../../assets/illustrations/widget-guide/android/add_button.jpg'),
          aspect: 0.9626,
          tap: {x: 0.5, y: 0.585},
        },
        {
          text: "Vita! Hiseho eo amin'ny écran isan'andro ny andinin-teny.",
          ...WIDGET_PICTURE,
        },
      ],
    },
  ],
};
