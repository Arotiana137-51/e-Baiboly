// How to put the widget on the phone, one file per platform:
// widgetGuide.android.ts and widgetGuide.ios.ts. Metro bundles only the
// running platform's file (and its screenshots), so the iPhone guide never
// ships in the APK and the Android one never ships in the IPA. This file is
// the shape both must have.
import type {ImageSourcePropType} from 'react-native';

// One action per step, shown one at a time: what older users follow best
// (exact steps, a picture of where to tap, short words).
export type WidgetGuideStep = {
  text: string;
  // A real screenshot of that moment, and its width / height.
  image?: ImageSourcePropType;
  aspect?: number;
  // Where to tap, as fractions of the image: a ring is drawn over it.
  highlight?: {x: number; y: number; w: number; h: number};
  // A way out when the phone doesn't match, shown under this step only.
  tip?: string;
};

export type WidgetGuideSection = {
  title: string;
  steps: WidgetGuideStep[];
};

export type WidgetGuide = {
  intro: string;
  sections: WidgetGuideSection[];
};

export declare const WIDGET_GUIDE: WidgetGuide;
