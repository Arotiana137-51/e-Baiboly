import type {WidgetGuide} from './widgetGuide';

// Apple's steps (support.apple.com/118610), photographed on an iPhone set to
// English (iOS 26: the Edit and Done buttons are a brush and a check), with
// the French labels in brackets. The widget is "Sakafom-panahy" under
// e-Baiboly; the lock screen sizes need iOS 16 and have no photos yet.
export const WIDGET_GUIDE: WidgetGuide = {
  intro: "Sakafom-panahy isan'andro: andinin-teny iray isan'andro eo amin'ny écran.",
  sections: [
    {
      title: "Écran d'accueil",
      steps: [
        {
          text: "Tsindrio ela (long press) ny toerana malalaka eo amin'ny écran d'accueil, mandra-pihetsiketsiky ny kisary.",
          image: require('../../assets/illustrations/widget-guide/home_long_press.jpg'),
          aspect: 720 / 760,
          highlight: {x: 0.4, y: 0.59, w: 0.2, h: 0.16},
        },
        {
          text: 'Tsindrio ny bokotra eo ankavia ambony.',
          image: require('../../assets/illustrations/widget-guide/ios/edit_button.jpg'),
          aspect: 4.875,
          highlight: {x: 0.152, y: 0.117, w: 0.34, h: 0.633},
          tip: 'Raha soratra no ao amin\'io bokotra io: "Edit" na "Modifier".',
        },
        {
          text: 'Tsindrio "Add Widget" (na "Ajouter un widget").',
          image: require('../../assets/illustrations/widget-guide/ios/menu.jpg'),
          aspect: 1.5811,
          highlight: {x: 0.094, y: 0.095, w: 0.453, h: 0.135},
        },
        {
          text: 'Tsindrio "Search Widgets" (na "Rechercher"), dia soraty "e-Baiboly".',
          image: require('../../assets/illustrations/widget-guide/ios/search_field.jpg'),
          aspect: 4.875,
          highlight: {x: 0.062, y: 0.19, w: 0.876, h: 0.6},
        },
        {
          text: 'Tsindrio "e-Baiboly".',
          image: require('../../assets/illustrations/widget-guide/ios/search_result.jpg'),
          aspect: 2.2075,
          highlight: {x: 0.034, y: 0.532, w: 0.932, h: 0.309},
        },
        {
          text: 'Akisaho miankavia na miankavanana hifidianana ny habeny, dia tsindrio "Add Widget" (na "Ajouter le widget").',
          image: require('../../assets/illustrations/widget-guide/ios/add_button.jpg'),
          aspect: 3.4412,
          highlight: {x: 0.062, y: 0.379, w: 0.876, h: 0.435},
        },
        {
          text: 'Tsindrio ny ✓ eo ankavanana ambony.',
          image: require('../../assets/illustrations/widget-guide/ios/done_button.jpg'),
          aspect: 4.875,
          highlight: {x: 0.508, y: 0.117, w: 0.342, h: 0.633},
          tip: 'Raha soratra no ao amin\'io bokotra io: "Done" na "OK".',
        },
        {
          text: "Vita! Hiseho eo amin'ny écran isan'andro ny andinin-teny.",
          image: require('../../assets/illustrations/widget-guide/result.jpg'),
          aspect: 1.7917,
        },
      ],
    },
    {
      title: 'Écran verrouillé',
      steps: [
        {
          text: 'Tsindrio ela ny écran verrouillé mandra-pisehon\'ny "Customize" (na "Personnaliser"), dia tsindrio izany.',
        },
        {text: 'Fidio ny écran verrouillé, dia tsindrio "Add Widgets" (na "Ajouter des widgets").'},
        {text: 'Tsindrio "e-Baiboly", dia fidio ilay widget.'},
        {text: 'Tsindrio "Done" (na "OK"). (iOS 16 no ho miakatra)'},
      ],
    },
  ],
};
