import type {WidgetGuide} from './widgetGuide';

// Google's steps (support.google.com/android/answer/9450271), photographed on
// a Galaxy A53 (One UI 8, phone in French): other launchers look a little
// different but follow the same path. The widget is listed as e-Baiboly.
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
          highlight: {x: 0.4, y: 0.59, w: 0.2, h: 0.16},
        },
        {
          text: 'Tsindrio "Widgets".',
          image: require('../../assets/illustrations/widget-guide/android/widgets_button.jpg'),
          aspect: 3.6,
          highlight: {x: 0.544, y: 0.16, w: 0.15, h: 0.56},
          tip: 'Raha tsy hitanao ny "Widgets": tsindrio ela ny kisary e-Baiboly, dia tsindrio "Widgets".',
        },
        {
          text: 'Tsindrio "Rechercher", dia soraty "e-Baiboly".',
          image: require('../../assets/illustrations/widget-guide/android/search_field.jpg'),
          aspect: 7.5,
          highlight: {x: 0.028, y: 0.056, w: 0.944, h: 0.861},
        },
        {
          text: 'Tsindrio "e-Baiboly".',
          image: require('../../assets/illustrations/widget-guide/android/search_result.jpg'),
          aspect: 2.9032,
          highlight: {x: 0, y: 0.435, w: 1, h: 0.524},
        },
        {
          text: 'Tsindrio ilay widget, dia tsindrio "Ajouter".',
          image: require('../../assets/illustrations/widget-guide/android/add_button.jpg'),
          aspect: 0.9626,
          highlight: {x: 0.389, y: 0.54, w: 0.222, h: 0.089},
        },
        {
          text: "Vita! Hiseho eo amin'ny écran isan'andro ny andinin-teny.",
          image: require('../../assets/illustrations/widget-guide/result.jpg'),
          aspect: 1.7917,
        },
      ],
    },
  ],
};
