import type {VerseRef} from './dailyVerses';

/**
 * "Teny ho anao": verse plans for the situations a reader can say they are
 * living through (see utils/lifeSituations for how a day's verse is picked
 * and services/lifeSituations for the on-device state). Refs only, same
 * MG1865 numbering as dailyVerses.ts; the text comes from the bundled DB.
 *
 * Three kinds, from the pastoral design:
 * - short: a sudden moment, `days` verses, one check-in at the end;
 * - season: grief, conflict…, `days` verses then spares, check-in every
 *   `checkEvery` days;
 * - long: an open-ended struggle, the verses form a pool that cycles.
 *
 * Content rules (checked by __tests__/lifeSituations.test.ts): every verse
 * stands alone on a small widget, pain is named before comfort, and the
 * plans for people who are hurting carry no correction verse and
 * nothing that reads as "this is a punishment" or "your faith is too weak".
 * Labels are placeholder MG copy — user-owned.
 */
export type SituationId =
  | 'fear'
  | 'guidance'
  | 'thanks'
  | 'grief'
  | 'discouraged'
  | 'conflict'
  | 'doubt'
  | 'guilt'
  | 'newfaith'
  | 'temptation'
  | 'work'
  | 'illness'
  | 'lonely'
  | 'family'
  | 'children'
  | 'betrayed'
  | 'waiting'
  | 'insecurity'
  | 'studies'
  | 'ageing'
  | 'disaster'
  | 'faraway'
  | 'anger'
  | 'shame'
  | 'injustice'
  | 'divorce'
  | 'babyloss'
  | 'journey'
  | 'newtask'
  | 'prison'
  | 'disability'
  | 'heartbreak'
  | 'caregiver'
  | 'insomnia'
  | 'pregnancy'
  | 'addictedrelative';

export type SituationKind = 'short' | 'season' | 'long';

export type SituationVerse = VerseRef & {correction?: true};

export type LifeSituation = {
  id: SituationId;
  label: string;
  kind: SituationKind;
  // Plan length for short and season plans; undefined for long ones.
  days?: number;
  // Days between check-ins (short plans: the plan length).
  checkEvery: number;
  // Plan days in order, then spares (short/season) — or the whole pool (long).
  verses: ReadonlyArray<SituationVerse>;
  // Shows the "talk to someone" line on the screen.
  safetyNote?: true;
};

export const LIFE_SITUATIONS: ReadonlyArray<LifeSituation> = [
  {
    id: 'fear',
    label: 'Tahotra sy fanahiana',
    kind: 'short',
    days: 7,
    checkEvery: 7,
    verses: [
      {b: 19, c: 34, v: 4}, // Salamo 34:4
      {b: 23, c: 41, v: 10}, // Isaia 41:10
      {b: 19, c: 56, v: 3}, // Salamo 56:3
      {b: 40, c: 14, v: 27}, // Matio 14:27
      {b: 19, c: 118, v: 6}, // Salamo 118:6
      {b: 50, c: 4, v: 6}, // Filipiana 4:6
      {b: 43, c: 14, v: 27}, // Jaona 14:27
      // spares
      {b: 19, c: 4, v: 8}, // Salamo 4:8
      {b: 55, c: 1, v: 7}, // 2 Timoty 1:7
      {b: 19, c: 121, v: 2}, // Salamo 121:2
    ],
  },
  {
    id: 'guidance',
    label: 'Fanapahan-kevitra sy fitarihana',
    kind: 'short',
    days: 7,
    checkEvery: 7,
    verses: [
      {b: 20, c: 3, v: 5, to: 6}, // Ohabolana 3:5-6
      {b: 19, c: 32, v: 8}, // Salamo 32:8
      {b: 59, c: 1, v: 5}, // Jakoba 1:5
      {b: 19, c: 119, v: 105}, // Salamo 119:105
      {b: 23, c: 30, v: 21}, // Isaia 30:21
      {b: 20, c: 16, v: 9}, // Ohabolana 16:9
      {b: 19, c: 37, v: 5}, // Salamo 37:5
      // spares
      {b: 20, c: 16, v: 3}, // Ohabolana 16:3
      {b: 19, c: 25, v: 4}, // Salamo 25:4
      {b: 24, c: 33, v: 3}, // Jeremia 33:3
    ],
  },
  {
    id: 'thanks',
    label: 'Fisaorana sy fifaliana',
    kind: 'short',
    days: 7,
    checkEvery: 7,
    verses: [
      {b: 19, c: 118, v: 24}, // Salamo 118:24
      {b: 52, c: 5, v: 16, to: 18}, // 1 Tesaloniana 5:16-18
      {b: 19, c: 103, v: 2}, // Salamo 103:2
      {b: 19, c: 107, v: 1}, // Salamo 107:1
      {b: 59, c: 1, v: 17}, // Jakoba 1:17
      {b: 19, c: 100, v: 4}, // Salamo 100:4
      {b: 19, c: 16, v: 11}, // Salamo 16:11
      // spares
      {b: 50, c: 4, v: 4}, // Filipiana 4:4
      {b: 19, c: 136, v: 1}, // Salamo 136:1
      {b: 19, c: 126, v: 3}, // Salamo 126:3
    ],
  },
  {
    id: 'grief',
    label: 'Fisaonana',
    kind: 'season',
    days: 21,
    checkEvery: 7,
    safetyNote: true,
    verses: [
      {b: 19, c: 34, v: 18}, // Salamo 34:18
      {b: 40, c: 5, v: 4}, // Matio 5:4
      {b: 43, c: 11, v: 35}, // Jaona 11:35
      {b: 19, c: 147, v: 3}, // Salamo 147:3
      {b: 19, c: 23, v: 4}, // Salamo 23:4
      {b: 23, c: 43, v: 2}, // Isaia 43:2
      {b: 19, c: 56, v: 8}, // Salamo 56:8
      {b: 25, c: 3, v: 22, to: 23}, // Fitomaniana 3:22-23
      {b: 19, c: 42, v: 11}, // Salamo 42:11
      {b: 19, c: 73, v: 26}, // Salamo 73:26
      {b: 43, c: 14, v: 1}, // Jaona 14:1
      {b: 23, c: 66, v: 13}, // Isaia 66:13
      {b: 40, c: 11, v: 28}, // Matio 11:28
      {b: 19, c: 121, v: 8}, // Salamo 121:8
      {b: 19, c: 62, v: 8}, // Salamo 62:8
      {b: 43, c: 14, v: 27}, // Jaona 14:27
      {b: 43, c: 11, v: 25}, // Jaona 11:25
      {b: 52, c: 4, v: 13}, // 1 Tesaloniana 4:13
      {b: 52, c: 4, v: 14}, // 1 Tesaloniana 4:14
      {b: 66, c: 21, v: 4}, // Apokalypsy 21:4
      {b: 43, c: 14, v: 2}, // Jaona 14:2
      // spares
      {b: 46, c: 15, v: 55}, // 1 Korintiana 15:55
      {b: 45, c: 8, v: 18}, // Romana 8:18
      {b: 19, c: 16, v: 11}, // Salamo 16:11
    ],
  },
  {
    id: 'discouraged',
    label: 'Kivy sy reraka am-po',
    kind: 'season',
    days: 21,
    checkEvery: 7,
    safetyNote: true,
    verses: [
      {b: 19, c: 42, v: 11}, // Salamo 42:11
      {b: 19, c: 34, v: 18}, // Salamo 34:18
      {b: 23, c: 40, v: 29}, // Isaia 40:29
      {b: 23, c: 40, v: 31}, // Isaia 40:31
      {b: 40, c: 11, v: 28}, // Matio 11:28
      {b: 47, c: 4, v: 8, to: 9}, // 2 Korintiana 4:8-9
      {b: 47, c: 4, v: 16}, // 2 Korintiana 4:16
      {b: 48, c: 6, v: 9}, // Galatiana 6:9
      {b: 19, c: 3, v: 3}, // Salamo 3:3
      {b: 19, c: 40, v: 2}, // Salamo 40:2
      {b: 25, c: 3, v: 22, to: 23}, // Fitomaniana 3:22-23
      {b: 19, c: 61, v: 2}, // Salamo 61:2
      {b: 23, c: 42, v: 3}, // Isaia 42:3
      {b: 50, c: 1, v: 6}, // Filipiana 1:6
      {b: 45, c: 15, v: 13}, // Romana 15:13
      {b: 19, c: 27, v: 13}, // Salamo 27:13
      {b: 24, c: 29, v: 11}, // Jeremia 29:11
      {b: 60, c: 5, v: 7}, // 1 Petera 5:7
      {b: 19, c: 143, v: 8}, // Salamo 143:8
      {b: 11, c: 19, v: 7}, // 1 Mpanjaka 19:7
      {b: 19, c: 94, v: 19}, // Salamo 94:19
    ],
  },
  {
    id: 'conflict',
    label: 'Fifandraisana sarotra',
    kind: 'season',
    days: 14,
    checkEvery: 7,
    verses: [
      {b: 40, c: 5, v: 9}, // Matio 5:9
      {b: 46, c: 13, v: 4}, // 1 Korintiana 13:4
      {b: 20, c: 17, v: 9}, // Ohabolana 17:9
      {b: 43, c: 13, v: 34}, // Jaona 13:34
      {b: 45, c: 12, v: 21}, // Romana 12:21
      {b: 51, c: 3, v: 14}, // Kolosiana 3:14
      {b: 50, c: 4, v: 7}, // Filipiana 4:7
      {b: 49, c: 4, v: 32, correction: true}, // Efesiana 4:32 c
      {b: 51, c: 3, v: 13, correction: true}, // Kolosiana 3:13 c
      {b: 45, c: 12, v: 18, correction: true}, // Romana 12:18 c
      {b: 20, c: 15, v: 1, correction: true}, // Ohabolana 15:1 c
      {b: 59, c: 1, v: 19, correction: true}, // Jakoba 1:19 c
      {b: 40, c: 18, v: 22, correction: true}, // Matio 18:22 c
      {b: 60, c: 3, v: 9, correction: true}, // 1 Petera 3:9 c
    ],
  },
  {
    id: 'doubt',
    label: 'Fisalasalana',
    kind: 'season',
    days: 14,
    checkEvery: 7,
    verses: [
      {b: 41, c: 9, v: 24}, // Marka 9:24
      {b: 43, c: 20, v: 29}, // Jaona 20:29
      {b: 58, c: 11, v: 1}, // Hebreo 11:1
      {b: 19, c: 13, v: 5}, // Salamo 13:5
      {b: 45, c: 10, v: 17}, // Romana 10:17
      {b: 40, c: 14, v: 31}, // Matio 14:31
      {b: 23, c: 40, v: 28}, // Isaia 40:28
      {b: 43, c: 6, v: 68}, // Jaona 6:68
      {b: 58, c: 13, v: 8}, // Hebreo 13:8
      {b: 55, c: 2, v: 13}, // 2 Timoty 2:13
      {b: 19, c: 94, v: 19}, // Salamo 94:19
      {b: 43, c: 20, v: 27}, // Jaona 20:27
      {b: 25, c: 3, v: 22, to: 23}, // Fitomaniana 3:22-23
      {b: 58, c: 11, v: 6}, // Hebreo 11:6
    ],
  },
  {
    id: 'guilt',
    label: 'Mila famelan-keloka',
    kind: 'season',
    days: 14,
    checkEvery: 7,
    verses: [
      {b: 62, c: 1, v: 9}, // 1 Jaona 1:9
      {b: 19, c: 103, v: 12}, // Salamo 103:12
      {b: 23, c: 1, v: 18}, // Isaia 1:18
      {b: 33, c: 7, v: 19}, // Mika 7:19
      {b: 45, c: 8, v: 1}, // Romana 8:1
      {b: 19, c: 86, v: 5}, // Salamo 86:5
      {b: 23, c: 43, v: 25}, // Isaia 43:25
      {b: 58, c: 8, v: 12}, // Hebreo 8:12
      {b: 47, c: 5, v: 17}, // 2 Korintiana 5:17
      {b: 42, c: 15, v: 7}, // Lioka 15:7
      {b: 19, c: 32, v: 5, correction: true}, // Salamo 32:5 c
      {b: 19, c: 51, v: 10, correction: true}, // Salamo 51:10 c
      {b: 44, c: 3, v: 19, correction: true}, // Asan'ny Apostoly 3:19 c
      {b: 20, c: 28, v: 13, correction: true}, // Ohabolana 28:13 c
      // spares
      {b: 59, c: 4, v: 10, correction: true}, // Jakoba 4:10 c
    ],
  },
  {
    id: 'newfaith',
    label: 'Mpino vao',
    kind: 'season',
    days: 21,
    checkEvery: 21,
    verses: [
      {b: 43, c: 3, v: 16}, // Jaona 3:16
      {b: 47, c: 5, v: 17}, // 2 Korintiana 5:17
      {b: 49, c: 2, v: 8}, // Efesiana 2:8
      {b: 43, c: 1, v: 12}, // Jaona 1:12
      {b: 45, c: 10, v: 9}, // Romana 10:9
      {b: 43, c: 10, v: 27, to: 28}, // Jaona 10:27-28
      {b: 50, c: 1, v: 6}, // Filipiana 1:6
      {b: 19, c: 119, v: 105}, // Salamo 119:105
      {b: 43, c: 15, v: 5}, // Jaona 15:5
      {b: 44, c: 2, v: 42}, // Asan'ny Apostoly 2:42
      {b: 43, c: 14, v: 6}, // Jaona 14:6
      {b: 62, c: 5, v: 13}, // 1 Jaona 5:13
      {b: 40, c: 6, v: 33}, // Matio 6:33
      {b: 45, c: 6, v: 23}, // Romana 6:23
      {b: 19, c: 1, v: 2}, // Salamo 1:2
      {b: 43, c: 8, v: 12}, // Jaona 8:12
      {b: 45, c: 12, v: 2, correction: true}, // Romana 12:2 c
      {b: 59, c: 1, v: 22, correction: true}, // Jakoba 1:22 c
      {b: 58, c: 10, v: 25, correction: true}, // Hebreo 10:25 c
      {b: 60, c: 2, v: 2, correction: true}, // 1 Petera 2:2 c
      {b: 51, c: 3, v: 2, correction: true}, // Kolosiana 3:2 c
    ],
  },
  {
    id: 'temptation',
    label: 'Fakam-panahy sy fiankinan-doha',
    kind: 'long',
    checkEvery: 14,
    verses: [
      {b: 46, c: 10, v: 13}, // 1 Korintiana 10:13
      {b: 59, c: 1, v: 12}, // Jakoba 1:12
      {b: 58, c: 2, v: 18}, // Hebreo 2:18
      {b: 62, c: 1, v: 9}, // 1 Jaona 1:9
      {b: 45, c: 6, v: 14}, // Romana 6:14
      {b: 45, c: 8, v: 1}, // Romana 8:1
      {b: 47, c: 12, v: 9}, // 2 Korintiana 12:9
      {b: 50, c: 4, v: 13}, // Filipiana 4:13
      {b: 48, c: 5, v: 1}, // Galatiana 5:1
      {b: 43, c: 8, v: 36}, // Jaona 8:36
      {b: 45, c: 12, v: 21}, // Romana 12:21
      {b: 49, c: 6, v: 10}, // Efesiana 6:10
      {b: 62, c: 4, v: 4}, // 1 Jaona 4:4
      {b: 23, c: 41, v: 10}, // Isaia 41:10
      {b: 19, c: 121, v: 2}, // Salamo 121:2
      {b: 40, c: 6, v: 13}, // Matio 6:13
      {b: 59, c: 4, v: 7, correction: true}, // Jakoba 4:7 c
      {b: 40, c: 26, v: 41, correction: true}, // Matio 26:41 c
      {b: 48, c: 5, v: 16, correction: true}, // Galatiana 5:16 c
      {b: 45, c: 13, v: 14, correction: true}, // Romana 13:14 c
      {b: 19, c: 119, v: 11, correction: true}, // Salamo 119:11 c
      {b: 55, c: 2, v: 22, correction: true}, // 2 Timoty 2:22 c
      {b: 20, c: 4, v: 23, correction: true}, // Ohabolana 4:23 c
      {b: 60, c: 5, v: 8, correction: true}, // 1 Petera 5:8 c
      {b: 46, c: 15, v: 33, correction: true}, // 1 Korintiana 15:33 c
      {b: 49, c: 6, v: 11, correction: true}, // Efesiana 6:11 c
      {b: 19, c: 51, v: 10, correction: true}, // Salamo 51:10 c
      {b: 20, c: 28, v: 13, correction: true}, // Ohabolana 28:13 c
      {b: 45, c: 6, v: 12, correction: true}, // Romana 6:12 c
    ],
  },
  {
    id: 'work',
    label: "Tsy manan'asa sy fahasahiranana ara-bola",
    kind: 'long',
    checkEvery: 14,
    verses: [
      {b: 50, c: 4, v: 19}, // Filipiana 4:19
      {b: 40, c: 6, v: 33}, // Matio 6:33
      {b: 40, c: 6, v: 26}, // Matio 6:26
      {b: 40, c: 6, v: 34}, // Matio 6:34
      {b: 19, c: 37, v: 3}, // Salamo 37:3
      {b: 20, c: 16, v: 3}, // Ohabolana 16:3
      {b: 19, c: 37, v: 5}, // Salamo 37:5
      {b: 24, c: 29, v: 11}, // Jeremia 29:11
      {b: 19, c: 34, v: 10}, // Salamo 34:10
      {b: 23, c: 40, v: 31}, // Isaia 40:31
      {b: 19, c: 138, v: 8}, // Salamo 138:8
      {b: 19, c: 90, v: 17}, // Salamo 90:17
      {b: 51, c: 3, v: 23}, // Kolosiana 3:23
      {b: 20, c: 3, v: 5, to: 6}, // Ohabolana 3:5-6
      {b: 23, c: 41, v: 10}, // Isaia 41:10
      {b: 19, c: 121, v: 2}, // Salamo 121:2
      {b: 19, c: 145, v: 15, to: 16}, // Salamo 145:15-16
      {b: 25, c: 3, v: 22, to: 23}, // Fitomaniana 3:22-23
      {b: 42, c: 12, v: 24}, // Lioka 12:24
      {b: 19, c: 128, v: 2}, // Salamo 128:2
      {b: 47, c: 9, v: 8}, // 2 Korintiana 9:8
      {b: 20, c: 10, v: 22}, // Ohabolana 10:22
      {b: 19, c: 84, v: 11}, // Salamo 84:11
      {b: 60, c: 5, v: 7}, // 1 Petera 5:7
      {b: 45, c: 8, v: 28}, // Romana 8:28
      {b: 40, c: 7, v: 7}, // Matio 7:7
      {b: 40, c: 7, v: 11}, // Matio 7:11
      {b: 6, c: 1, v: 9}, // Josoa 1:9
    ],
  },
  {
    id: 'illness',
    label: 'Aretina (ny tenako na ny havako)',
    kind: 'long',
    checkEvery: 14,
    safetyNote: true,
    verses: [
      {b: 24, c: 17, v: 14}, // Jeremia 17:14
      {b: 19, c: 41, v: 3}, // Salamo 41:3
      {b: 19, c: 147, v: 3}, // Salamo 147:3
      {b: 23, c: 41, v: 10}, // Isaia 41:10
      {b: 47, c: 12, v: 9}, // 2 Korintiana 12:9
      {b: 19, c: 73, v: 26}, // Salamo 73:26
      {b: 23, c: 40, v: 31}, // Isaia 40:31
      {b: 19, c: 103, v: 13}, // Salamo 103:13
      {b: 40, c: 11, v: 28}, // Matio 11:28
      {b: 23, c: 40, v: 29}, // Isaia 40:29
      {b: 47, c: 4, v: 16}, // 2 Korintiana 4:16
      {b: 45, c: 8, v: 18}, // Romana 8:18
      {b: 19, c: 23, v: 4}, // Salamo 23:4
      {b: 19, c: 121, v: 2}, // Salamo 121:2
      {b: 23, c: 43, v: 2}, // Isaia 43:2
      {b: 19, c: 6, v: 2}, // Salamo 6:2
      {b: 19, c: 30, v: 2}, // Salamo 30:2
      {b: 19, c: 91, v: 15}, // Salamo 91:15
      {b: 48, c: 6, v: 2}, // Galatiana 6:2
      {b: 23, c: 46, v: 4}, // Isaia 46:4
      {b: 50, c: 4, v: 6}, // Filipiana 4:6
      {b: 43, c: 14, v: 27}, // Jaona 14:27
      {b: 19, c: 34, v: 19}, // Salamo 34:19
      {b: 66, c: 21, v: 4}, // Apokalypsy 21:4
      {b: 19, c: 62, v: 8}, // Salamo 62:8
      {b: 40, c: 8, v: 3}, // Matio 8:3
      {b: 25, c: 3, v: 22, to: 23}, // Fitomaniana 3:22-23
      {b: 19, c: 42, v: 11}, // Salamo 42:11
    ],
  },
  {
    id: 'lonely',
    label: 'Mahatsiaro ho irery',
    kind: 'long',
    checkEvery: 14,
    verses: [
      {b: 5, c: 31, v: 6}, // Deoteronomia 31:6
      {b: 19, c: 27, v: 10}, // Salamo 27:10
      {b: 23, c: 41, v: 10}, // Isaia 41:10
      {b: 43, c: 14, v: 18}, // Jaona 14:18
      {b: 19, c: 139, v: 9, to: 10}, // Salamo 139:9-10
      {b: 19, c: 23, v: 4}, // Salamo 23:4
      {b: 23, c: 49, v: 15}, // Isaia 49:15
      {b: 19, c: 25, v: 16}, // Salamo 25:16
      {b: 19, c: 34, v: 18}, // Salamo 34:18
      {b: 6, c: 1, v: 9}, // Josoa 1:9
      {b: 19, c: 145, v: 18}, // Salamo 145:18
      {b: 43, c: 15, v: 15}, // Jaona 15:15
      {b: 19, c: 73, v: 23}, // Salamo 73:23
      {b: 60, c: 5, v: 7}, // 1 Petera 5:7
      {b: 19, c: 16, v: 11}, // Salamo 16:11
      {b: 23, c: 54, v: 10}, // Isaia 54:10
      {b: 24, c: 31, v: 3}, // Jeremia 31:3
      {b: 40, c: 11, v: 28}, // Matio 11:28
      {b: 45, c: 8, v: 31}, // Romana 8:31
      {b: 19, c: 62, v: 8}, // Salamo 62:8
      {b: 19, c: 121, v: 8}, // Salamo 121:8
      {b: 1, c: 28, v: 15}, // Genesisy 28:15
      {b: 5, c: 31, v: 8}, // Deoteronomia 31:8
      {b: 21, c: 4, v: 9, to: 10}, // Mpitoriteny 4:9-10
      {b: 58, c: 10, v: 24}, // Hebreo 10:24
      {b: 19, c: 139, v: 17}, // Salamo 139:17
      {b: 19, c: 9, v: 10}, // Salamo 9:10
      {b: 19, c: 68, v: 5}, // Salamo 68:5
    ],
  },
  {
    id: 'family',
    label: 'Fanambadiana sy fianakaviana',
    kind: 'season',
    days: 14,
    checkEvery: 7,
    verses: [
      {b: 19, c: 69, v: 8}, // Salamo 69:8
      {b: 19, c: 34, v: 18}, // Salamo 34:18
      {b: 45, c: 15, v: 5}, // Romana 15:5
      {b: 45, c: 12, v: 10, correction: true}, // Romana 12:10 c
      {b: 20, c: 15, v: 1, correction: true}, // Ohabolana 15:1 c
      {b: 59, c: 1, v: 19, correction: true}, // Jakoba 1:19 c
      {b: 49, c: 4, v: 32, correction: true}, // Efesiana 4:32 c
      {b: 51, c: 3, v: 13, correction: true}, // Kolosiana 3:13 c
      {b: 46, c: 13, v: 4, correction: true}, // 1 Korintiana 13:4 c
      {b: 21, c: 4, v: 12}, // Mpitoriteny 4:12
      {b: 45, c: 12, v: 18, correction: true}, // Romana 12:18 c
      {b: 51, c: 3, v: 14, correction: true}, // Kolosiana 3:14 c
      {b: 23, c: 54, v: 10}, // Isaia 54:10
      {b: 50, c: 4, v: 7}, // Filipiana 4:7
    ],
  },
  {
    id: 'children',
    label: "Manahy ny amin'ny zanako",
    kind: 'long',
    checkEvery: 14,
    verses: [
      {b: 40, c: 15, v: 22}, // Matio 15:22
      {b: 41, c: 9, v: 24}, // Marka 9:24
      {b: 60, c: 5, v: 7}, // 1 Petera 5:7
      {b: 23, c: 49, v: 25}, // Isaia 49:25
      {b: 23, c: 54, v: 13}, // Isaia 54:13
      {b: 23, c: 44, v: 3}, // Isaia 44:3
      {b: 19, c: 103, v: 17}, // Salamo 103:17
      {b: 24, c: 31, v: 17}, // Jeremia 31:17
      {b: 23, c: 40, v: 11}, // Isaia 40:11
      {b: 50, c: 4, v: 6}, // Filipiana 4:6
      {b: 19, c: 121, v: 7}, // Salamo 121:7
      {b: 42, c: 15, v: 20}, // Lioka 15:20
      {b: 20, c: 22, v: 6}, // Ohabolana 22:6
      {b: 19, c: 127, v: 3}, // Salamo 127:3
      {b: 40, c: 19, v: 14}, // Matio 19:14
      {b: 40, c: 7, v: 11}, // Matio 7:11
      {b: 43, c: 17, v: 15}, // Jaona 17:15
      {b: 4, c: 6, v: 24, to: 26}, // Nomery 6:24-26
      {b: 23, c: 43, v: 5}, // Isaia 43:5
      {b: 44, c: 16, v: 31}, // Asan'ny Apostoly 16:31
      {b: 19, c: 37, v: 25}, // Salamo 37:25
      {b: 64, c: 1, v: 4}, // 3 Jaona 1:4
      {b: 19, c: 112, v: 2}, // Salamo 112:2
      {b: 24, c: 29, v: 11}, // Jeremia 29:11
      {b: 19, c: 138, v: 8}, // Salamo 138:8
      {b: 23, c: 41, v: 10}, // Isaia 41:10
      {b: 25, c: 3, v: 22, to: 23}, // Fitomaniana 3:22-23
      {b: 19, c: 121, v: 8}, // Salamo 121:8
    ],
  },
  {
    id: 'betrayed',
    label: 'Voaratra, voafitaka na nolavina',
    kind: 'season',
    days: 21,
    checkEvery: 7,
    verses: [
      {b: 19, c: 55, v: 12}, // Salamo 55:12
      {b: 19, c: 41, v: 9}, // Salamo 41:9
      {b: 19, c: 6, v: 6}, // Salamo 6:6
      {b: 19, c: 31, v: 9}, // Salamo 31:9
      {b: 19, c: 56, v: 8}, // Salamo 56:8
      {b: 19, c: 34, v: 18}, // Salamo 34:18
      {b: 23, c: 53, v: 3}, // Isaia 53:3
      {b: 19, c: 27, v: 10}, // Salamo 27:10
      {b: 19, c: 147, v: 3}, // Salamo 147:3
      {b: 19, c: 62, v: 8}, // Salamo 62:8
      {b: 19, c: 3, v: 3}, // Salamo 3:3
      {b: 19, c: 37, v: 5, to: 6}, // Salamo 37:5-6
      {b: 19, c: 55, v: 22}, // Salamo 55:22
      {b: 1, c: 50, v: 20}, // Genesisy 50:20
      {b: 19, c: 118, v: 8}, // Salamo 118:8
      {b: 24, c: 30, v: 17}, // Jeremia 30:17
      {b: 19, c: 23, v: 3}, // Salamo 23:3
      {b: 47, c: 4, v: 8, to: 9}, // 2 Korintiana 4:8-9
      {b: 19, c: 94, v: 14}, // Salamo 94:14
      {b: 23, c: 49, v: 15}, // Isaia 49:15
      {b: 60, c: 5, v: 10}, // 1 Petera 5:10
    ],
  },
  {
    id: 'waiting',
    label: 'Miandry ela',
    kind: 'long',
    checkEvery: 14,
    verses: [
      {b: 19, c: 13, v: 2}, // Salamo 13:2
      {b: 35, c: 1, v: 2}, // Habakoka 1:2
      {b: 19, c: 6, v: 3}, // Salamo 6:3
      {b: 19, c: 27, v: 14}, // Salamo 27:14
      {b: 23, c: 40, v: 31}, // Isaia 40:31
      {b: 25, c: 3, v: 25, to: 26}, // Fitomaniana 3:25-26
      {b: 35, c: 2, v: 3}, // Habakoka 2:3
      {b: 19, c: 40, v: 2}, // Salamo 40:2
      {b: 45, c: 8, v: 25}, // Romana 8:25
      {b: 33, c: 7, v: 7}, // Mika 7:7
      {b: 19, c: 130, v: 5}, // Salamo 130:5
      {b: 19, c: 130, v: 6}, // Salamo 130:6
      {b: 21, c: 3, v: 1}, // Mpitoriteny 3:1
      {b: 21, c: 3, v: 11}, // Mpitoriteny 3:11
      {b: 23, c: 30, v: 18}, // Isaia 30:18
      {b: 19, c: 62, v: 5}, // Salamo 62:5
      {b: 19, c: 33, v: 20}, // Salamo 33:20
      {b: 59, c: 5, v: 8}, // Jakoba 5:8
      {b: 19, c: 33, v: 22}, // Salamo 33:22
      {b: 19, c: 31, v: 24}, // Salamo 31:24
      {b: 19, c: 25, v: 5}, // Salamo 25:5
      {b: 45, c: 12, v: 12}, // Romana 12:12
      {b: 58, c: 10, v: 36}, // Hebreo 10:36
      {b: 23, c: 26, v: 3}, // Isaia 26:3
      {b: 19, c: 46, v: 10}, // Salamo 46:10
      {b: 19, c: 39, v: 7}, // Salamo 39:7
      {b: 23, c: 64, v: 3}, // Isaia 64:3
      {b: 19, c: 27, v: 13}, // Salamo 27:13
    ],
  },
  {
    id: 'insecurity',
    label: 'Tsy fandriampahalemana sy herisetra',
    kind: 'long',
    checkEvery: 14,
    safetyNote: true,
    verses: [
      {b: 19, c: 55, v: 4}, // Salamo 55:4
      {b: 19, c: 56, v: 3}, // Salamo 56:3
      {b: 19, c: 91, v: 2}, // Salamo 91:2
      {b: 19, c: 91, v: 5}, // Salamo 91:5
      {b: 19, c: 91, v: 11}, // Salamo 91:11
      {b: 19, c: 4, v: 8}, // Salamo 4:8
      {b: 20, c: 18, v: 10}, // Ohabolana 18:10
      {b: 19, c: 121, v: 7}, // Salamo 121:7
      {b: 23, c: 54, v: 17}, // Isaia 54:17
      {b: 19, c: 23, v: 4}, // Salamo 23:4
      {b: 5, c: 31, v: 6}, // Deoteronomia 31:6
      {b: 23, c: 41, v: 10}, // Isaia 41:10
      {b: 19, c: 34, v: 7}, // Salamo 34:7
      {b: 19, c: 3, v: 5}, // Salamo 3:5
      {b: 19, c: 3, v: 6}, // Salamo 3:6
      {b: 43, c: 14, v: 27}, // Jaona 14:27
      {b: 23, c: 43, v: 2}, // Isaia 43:2
      {b: 19, c: 118, v: 6}, // Salamo 118:6
      {b: 58, c: 13, v: 6}, // Hebreo 13:6
      {b: 19, c: 62, v: 6}, // Salamo 62:6
      {b: 19, c: 9, v: 9}, // Salamo 9:9
      {b: 36, c: 3, v: 17}, // Zefania 3:17
      {b: 19, c: 16, v: 8}, // Salamo 16:8
      {b: 19, c: 32, v: 7}, // Salamo 32:7
      {b: 34, c: 1, v: 7}, // Nahoma 1:7
      {b: 33, c: 4, v: 4}, // Mika 4:4
      {b: 23, c: 32, v: 18}, // Isaia 32:18
      {b: 19, c: 61, v: 3}, // Salamo 61:3
    ],
  },
  {
    id: 'studies',
    label: 'Fianarana sy fanadinana',
    kind: 'short',
    days: 7,
    checkEvery: 7,
    verses: [
      {b: 19, c: 94, v: 19}, // Salamo 94:19
      {b: 50, c: 4, v: 6}, // Filipiana 4:6
      {b: 55, c: 1, v: 7}, // 2 Timoty 1:7
      {b: 59, c: 1, v: 5}, // Jakoba 1:5
      {b: 20, c: 2, v: 6}, // Ohabolana 2:6
      {b: 19, c: 32, v: 8}, // Salamo 32:8
      {b: 20, c: 16, v: 3}, // Ohabolana 16:3
      {b: 51, c: 3, v: 23}, // Kolosiana 3:23
      {b: 50, c: 4, v: 13}, // Filipiana 4:13
      {b: 6, c: 1, v: 9}, // Josoa 1:9
    ],
  },
  {
    id: 'ageing',
    label: 'Fahanterana',
    kind: 'long',
    checkEvery: 14,
    verses: [
      {b: 19, c: 71, v: 9}, // Salamo 71:9
      {b: 19, c: 71, v: 18}, // Salamo 71:18
      {b: 19, c: 73, v: 26}, // Salamo 73:26
      {b: 23, c: 46, v: 4}, // Isaia 46:4
      {b: 19, c: 92, v: 14}, // Salamo 92:14
      {b: 47, c: 4, v: 16}, // 2 Korintiana 4:16
      {b: 19, c: 90, v: 12}, // Salamo 90:12
      {b: 18, c: 12, v: 12}, // Joba 12:12
      {b: 20, c: 16, v: 31}, // Ohabolana 16:31
      {b: 19, c: 37, v: 25}, // Salamo 37:25
      {b: 23, c: 40, v: 29}, // Isaia 40:29
      {b: 23, c: 40, v: 31}, // Isaia 40:31
      {b: 19, c: 23, v: 6}, // Salamo 23:6
      {b: 43, c: 14, v: 2}, // Jaona 14:2
      {b: 43, c: 14, v: 3}, // Jaona 14:3
      {b: 55, c: 4, v: 7}, // 2 Timoty 4:7
      {b: 50, c: 1, v: 21}, // Filipiana 1:21
      {b: 66, c: 21, v: 4}, // Apokalypsy 21:4
      {b: 19, c: 48, v: 14}, // Salamo 48:14
      {b: 19, c: 121, v: 8}, // Salamo 121:8
      {b: 23, c: 41, v: 10}, // Isaia 41:10
      {b: 19, c: 103, v: 5}, // Salamo 103:5
      {b: 19, c: 103, v: 14}, // Salamo 103:14
      {b: 19, c: 71, v: 5}, // Salamo 71:5
      {b: 43, c: 11, v: 25}, // Jaona 11:25
      {b: 46, c: 15, v: 55}, // 1 Korintiana 15:55
      {b: 58, c: 13, v: 8}, // Hebreo 13:8
      {b: 23, c: 43, v: 1}, // Isaia 43:1
    ],
  },
  {
    id: 'disaster',
    label: 'Rivodoza, hain-tany sy loza',
    kind: 'season',
    days: 14,
    checkEvery: 7,
    safetyNote: true,
    verses: [
      {b: 19, c: 69, v: 2}, // Salamo 69:2
      {b: 35, c: 3, v: 17}, // Habakoka 3:17
      {b: 35, c: 3, v: 18}, // Habakoka 3:18
      {b: 19, c: 46, v: 2}, // Salamo 46:2
      {b: 23, c: 25, v: 4}, // Isaia 25:4
      {b: 23, c: 43, v: 2}, // Isaia 43:2
      {b: 19, c: 107, v: 29}, // Salamo 107:29
      {b: 34, c: 1, v: 7}, // Nahoma 1:7
      {b: 19, c: 34, v: 6}, // Salamo 34:6
      {b: 23, c: 41, v: 17}, // Isaia 41:17
      {b: 24, c: 17, v: 8}, // Jeremia 17:8
      {b: 19, c: 37, v: 19}, // Salamo 37:19
      {b: 25, c: 3, v: 22, to: 23}, // Fitomaniana 3:22-23
      {b: 23, c: 58, v: 11}, // Isaia 58:11
    ],
  },
  {
    id: 'faraway',
    label: 'Toa lavitra Andriamanitra',
    kind: 'season',
    days: 14,
    checkEvery: 7,
    verses: [
      {b: 19, c: 10, v: 1}, // Salamo 10:1
      {b: 19, c: 22, v: 2}, // Salamo 22:2
      {b: 19, c: 42, v: 3}, // Salamo 42:3
      {b: 19, c: 77, v: 7}, // Salamo 77:7
      {b: 25, c: 3, v: 57}, // Fitomaniana 3:57
      {b: 19, c: 139, v: 7, to: 8}, // Salamo 139:7-8
      {b: 19, c: 119, v: 151}, // Salamo 119:151
      {b: 19, c: 145, v: 18}, // Salamo 145:18
      {b: 24, c: 29, v: 13}, // Jeremia 29:13
      {b: 23, c: 41, v: 13}, // Isaia 41:13
      {b: 36, c: 3, v: 17}, // Zefania 3:17
      {b: 45, c: 8, v: 39}, // Romana 8:39
      {b: 5, c: 31, v: 6}, // Deoteronomia 31:6
      {b: 19, c: 73, v: 28}, // Salamo 73:28
    ],
  },
  {
    id: 'anger',
    label: 'Fahatezerana sy lolompo',
    kind: 'season',
    days: 14,
    checkEvery: 7,
    verses: [
      {b: 19, c: 39, v: 3}, // Salamo 39:3
      {b: 19, c: 62, v: 8}, // Salamo 62:8
      {b: 20, c: 14, v: 29, correction: true}, // Ohabolana 14:29 c
      {b: 49, c: 4, v: 26, correction: true}, // Efesiana 4:26 c
      {b: 59, c: 1, v: 19, correction: true}, // Jakoba 1:19 c
      {b: 59, c: 1, v: 20, correction: true}, // Jakoba 1:20 c
      {b: 20, c: 15, v: 1, correction: true}, // Ohabolana 15:1 c
      {b: 19, c: 37, v: 8, correction: true}, // Salamo 37:8 c
      {b: 20, c: 16, v: 32, correction: true}, // Ohabolana 16:32 c
      {b: 19, c: 103, v: 8}, // Salamo 103:8
      {b: 49, c: 4, v: 31, correction: true}, // Efesiana 4:31 c
      {b: 49, c: 4, v: 32, correction: true}, // Efesiana 4:32 c
      {b: 48, c: 5, v: 22}, // Galatiana 5:22
      {b: 40, c: 11, v: 29}, // Matio 11:29
    ],
  },
  {
    id: 'shame',
    label: 'Henatra sy fahatsapana ho tsy misy dikany',
    kind: 'season',
    days: 21,
    checkEvery: 7,
    verses: [
      {b: 19, c: 44, v: 15}, // Salamo 44:15
      {b: 19, c: 69, v: 19}, // Salamo 69:19
      {b: 19, c: 34, v: 5}, // Salamo 34:5
      {b: 19, c: 3, v: 3}, // Salamo 3:3
      {b: 23, c: 54, v: 4}, // Isaia 54:4
      {b: 23, c: 61, v: 7}, // Isaia 61:7
      {b: 45, c: 8, v: 1}, // Romana 8:1
      {b: 58, c: 12, v: 2}, // Hebreo 12:2
      {b: 19, c: 139, v: 14}, // Salamo 139:14
      {b: 23, c: 43, v: 4}, // Isaia 43:4
      {b: 23, c: 49, v: 16}, // Isaia 49:16
      {b: 40, c: 10, v: 31}, // Matio 10:31
      {b: 49, c: 2, v: 10}, // Efesiana 2:10
      {b: 60, c: 2, v: 9}, // 1 Petera 2:9
      {b: 47, c: 5, v: 17}, // 2 Korintiana 5:17
      {b: 24, c: 31, v: 3}, // Jeremia 31:3
      {b: 36, c: 3, v: 17}, // Zefania 3:17
      {b: 42, c: 15, v: 20}, // Lioka 15:20
      {b: 23, c: 50, v: 7}, // Isaia 50:7
      {b: 45, c: 10, v: 11}, // Romana 10:11
      {b: 62, c: 3, v: 1}, // 1 Jaona 3:1
    ],
  },
  {
    id: 'injustice',
    label: 'Tsy rariny sy fanenjehana',
    kind: 'season',
    days: 14,
    checkEvery: 7,
    verses: [
      {b: 19, c: 94, v: 3}, // Salamo 94:3
      {b: 21, c: 4, v: 1}, // Mpitoriteny 4:1
      {b: 19, c: 9, v: 9}, // Salamo 9:9
      {b: 19, c: 103, v: 6}, // Salamo 103:6
      {b: 19, c: 146, v: 7}, // Salamo 146:7
      {b: 19, c: 10, v: 17}, // Salamo 10:17
      {b: 42, c: 18, v: 7}, // Lioka 18:7
      {b: 19, c: 37, v: 5, to: 6}, // Salamo 37:5-6
      {b: 40, c: 5, v: 10}, // Matio 5:10
      {b: 60, c: 3, v: 14}, // 1 Petera 3:14
      {b: 47, c: 4, v: 8, to: 9}, // 2 Korintiana 4:8-9
      {b: 43, c: 16, v: 33}, // Jaona 16:33
      {b: 23, c: 54, v: 17}, // Isaia 54:17
      {b: 45, c: 8, v: 31}, // Romana 8:31
    ],
  },
  {
    id: 'divorce',
    label: 'Fisarahana sy fisaraham-panambadiana',
    kind: 'season',
    days: 21,
    checkEvery: 7,
    verses: [
      {b: 19, c: 6, v: 6}, // Salamo 6:6
      {b: 19, c: 102, v: 7}, // Salamo 102:7
      {b: 19, c: 38, v: 10}, // Salamo 38:10
      {b: 19, c: 34, v: 18}, // Salamo 34:18
      {b: 19, c: 147, v: 3}, // Salamo 147:3
      {b: 19, c: 55, v: 22}, // Salamo 55:22
      {b: 23, c: 54, v: 5}, // Isaia 54:5
      {b: 23, c: 54, v: 10}, // Isaia 54:10
      {b: 40, c: 11, v: 28}, // Matio 11:28
      {b: 47, c: 1, v: 3}, // 2 Korintiana 1:3
      {b: 19, c: 68, v: 5}, // Salamo 68:5
      {b: 23, c: 41, v: 10}, // Isaia 41:10
      {b: 5, c: 31, v: 8}, // Deoteronomia 31:8
      {b: 19, c: 126, v: 5}, // Salamo 126:5
      {b: 25, c: 3, v: 22, to: 23}, // Fitomaniana 3:22-23
      {b: 19, c: 31, v: 24}, // Salamo 31:24
      {b: 23, c: 43, v: 19}, // Isaia 43:19
      {b: 24, c: 29, v: 11}, // Jeremia 29:11
      {b: 19, c: 73, v: 26}, // Salamo 73:26
      {b: 19, c: 121, v: 2}, // Salamo 121:2
      {b: 50, c: 4, v: 7}, // Filipiana 4:7
    ],
  },
  {
    id: 'babyloss',
    label: 'Afa-jaza',
    kind: 'season',
    days: 21,
    checkEvery: 7,
    safetyNote: true,
    verses: [
      {b: 24, c: 31, v: 15}, // Jeremia 31:15
      {b: 19, c: 6, v: 6}, // Salamo 6:6
      {b: 19, c: 88, v: 3}, // Salamo 88:3
      {b: 19, c: 31, v: 9}, // Salamo 31:9
      {b: 19, c: 56, v: 8}, // Salamo 56:8
      {b: 19, c: 34, v: 18}, // Salamo 34:18
      {b: 40, c: 5, v: 4}, // Matio 5:4
      {b: 23, c: 66, v: 13}, // Isaia 66:13
      {b: 23, c: 40, v: 11}, // Isaia 40:11
      {b: 19, c: 139, v: 13}, // Salamo 139:13
      {b: 19, c: 139, v: 16}, // Salamo 139:16
      {b: 47, c: 1, v: 4}, // 2 Korintiana 1:4
      {b: 23, c: 49, v: 16}, // Isaia 49:16
      {b: 10, c: 12, v: 23}, // 2 Samoela 12:23
      {b: 43, c: 16, v: 22}, // Jaona 16:22
      {b: 19, c: 147, v: 3}, // Salamo 147:3
      {b: 23, c: 25, v: 8}, // Isaia 25:8
      {b: 66, c: 21, v: 4}, // Apokalypsy 21:4
      {b: 19, c: 126, v: 5}, // Salamo 126:5
      {b: 43, c: 14, v: 1}, // Jaona 14:1
      {b: 19, c: 23, v: 4}, // Salamo 23:4
    ],
  },
  {
    id: 'journey',
    label: 'Fiaingana sy fifindrana',
    kind: 'short',
    days: 7,
    checkEvery: 7,
    verses: [
      {b: 19, c: 137, v: 4}, // Salamo 137:4
      {b: 1, c: 28, v: 15}, // Genesisy 28:15
      {b: 2, c: 33, v: 14}, // Eksodosy 33:14
      {b: 5, c: 31, v: 8}, // Deoteronomia 31:8
      {b: 6, c: 1, v: 9}, // Josoa 1:9
      {b: 19, c: 121, v: 3}, // Salamo 121:3
      {b: 19, c: 121, v: 8}, // Salamo 121:8
      {b: 19, c: 139, v: 9, to: 10}, // Salamo 139:9-10
      {b: 23, c: 43, v: 2}, // Isaia 43:2
      {b: 20, c: 3, v: 6}, // Ohabolana 3:6
    ],
  },
  {
    id: 'newtask',
    label: 'Andraikitra vaovao',
    kind: 'short',
    days: 7,
    checkEvery: 7,
    verses: [
      {b: 24, c: 1, v: 6}, // Jeremia 1:6
      {b: 24, c: 1, v: 8}, // Jeremia 1:8
      {b: 2, c: 4, v: 12}, // Eksodosy 4:12
      {b: 6, c: 1, v: 9}, // Josoa 1:9
      {b: 19, c: 37, v: 5}, // Salamo 37:5
      {b: 23, c: 41, v: 10}, // Isaia 41:10
      {b: 47, c: 12, v: 9}, // 2 Korintiana 12:9
      {b: 50, c: 4, v: 13}, // Filipiana 4:13
      {b: 50, c: 1, v: 6}, // Filipiana 1:6
      {b: 20, c: 16, v: 3}, // Ohabolana 16:3
    ],
  },
  {
    id: 'prison',
    label: 'Fonja (ny tenako na ny havako)',
    kind: 'long',
    checkEvery: 14,
    verses: [
      {b: 19, c: 107, v: 10}, // Salamo 107:10
      {b: 19, c: 142, v: 7}, // Salamo 142:7
      {b: 19, c: 102, v: 20}, // Salamo 102:20
      {b: 19, c: 69, v: 33}, // Salamo 69:33
      {b: 19, c: 146, v: 7}, // Salamo 146:7
      {b: 42, c: 4, v: 18}, // Lioka 4:18
      {b: 23, c: 42, v: 7}, // Isaia 42:7
      {b: 19, c: 107, v: 14}, // Salamo 107:14
      {b: 1, c: 39, v: 21}, // Genesisy 39:21
      {b: 44, c: 16, v: 25}, // Asan'ny Apostoly 16:25
      {b: 55, c: 2, v: 9}, // 2 Timoty 2:9
      {b: 40, c: 25, v: 36}, // Matio 25:36
      {b: 58, c: 13, v: 3}, // Hebreo 13:3
      {b: 38, c: 9, v: 12}, // Zakaria 9:12
      {b: 33, c: 7, v: 8}, // Mika 7:8
      {b: 19, c: 139, v: 12}, // Salamo 139:12
      {b: 43, c: 8, v: 36}, // Jaona 8:36
      {b: 45, c: 8, v: 1}, // Romana 8:1
      {b: 19, c: 40, v: 2}, // Salamo 40:2
      {b: 19, c: 34, v: 18}, // Salamo 34:18
      {b: 23, c: 41, v: 10}, // Isaia 41:10
      {b: 25, c: 3, v: 22, to: 23}, // Fitomaniana 3:22-23
      {b: 19, c: 23, v: 4}, // Salamo 23:4
      {b: 5, c: 31, v: 8}, // Deoteronomia 31:8
      {b: 19, c: 91, v: 15}, // Salamo 91:15
      {b: 23, c: 43, v: 19}, // Isaia 43:19
      {b: 24, c: 29, v: 11}, // Jeremia 29:11
      {b: 19, c: 25, v: 16}, // Salamo 25:16
    ],
  },
  {
    id: 'disability',
    label: 'Fahasembanana sy fanaintainana maharitra',
    kind: 'long',
    checkEvery: 14,
    verses: [
      {b: 19, c: 6, v: 2}, // Salamo 6:2
      {b: 18, c: 30, v: 17}, // Joba 30:17
      {b: 19, c: 38, v: 9}, // Salamo 38:9
      {b: 43, c: 9, v: 3}, // Jaona 9:3
      {b: 47, c: 12, v: 9}, // 2 Korintiana 12:9
      {b: 58, c: 4, v: 15}, // Hebreo 4:15
      {b: 45, c: 8, v: 26}, // Romana 8:26
      {b: 23, c: 40, v: 29}, // Isaia 40:29
      {b: 23, c: 40, v: 31}, // Isaia 40:31
      {b: 19, c: 73, v: 26}, // Salamo 73:26
      {b: 47, c: 4, v: 16}, // 2 Korintiana 4:16
      {b: 19, c: 31, v: 7}, // Salamo 31:7
      {b: 45, c: 8, v: 18}, // Romana 8:18
      {b: 19, c: 139, v: 14}, // Salamo 139:14
      {b: 19, c: 147, v: 3}, // Salamo 147:3
      {b: 19, c: 34, v: 19}, // Salamo 34:19
      {b: 23, c: 46, v: 4}, // Isaia 46:4
      {b: 19, c: 18, v: 33}, // Salamo 18:33
      {b: 19, c: 18, v: 32}, // Salamo 18:32
      {b: 40, c: 11, v: 28}, // Matio 11:28
      {b: 19, c: 55, v: 22}, // Salamo 55:22
      {b: 47, c: 1, v: 4}, // 2 Korintiana 1:4
      {b: 23, c: 41, v: 10}, // Isaia 41:10
      {b: 25, c: 3, v: 22, to: 23}, // Fitomaniana 3:22-23
      {b: 23, c: 35, v: 5}, // Isaia 35:5
      {b: 23, c: 35, v: 6}, // Isaia 35:6
      {b: 50, c: 3, v: 21}, // Filipiana 3:21
      {b: 66, c: 21, v: 4}, // Apokalypsy 21:4
    ],
  },
  {
    id: 'heartbreak',
    label: 'Fo torotoro noho ny fitiavana',
    kind: 'season',
    days: 14,
    checkEvery: 7,
    safetyNote: true,
    verses: [
      {b: 19, c: 31, v: 12}, // Salamo 31:12
      {b: 19, c: 42, v: 11}, // Salamo 42:11
      {b: 19, c: 34, v: 18}, // Salamo 34:18
      {b: 19, c: 147, v: 3}, // Salamo 147:3
      {b: 19, c: 73, v: 23}, // Salamo 73:23
      {b: 24, c: 31, v: 3}, // Jeremia 31:3
      {b: 23, c: 43, v: 4}, // Isaia 43:4
      {b: 23, c: 54, v: 10}, // Isaia 54:10
      {b: 19, c: 73, v: 26}, // Salamo 73:26
      {b: 60, c: 5, v: 7}, // 1 Petera 5:7
      {b: 20, c: 3, v: 5}, // Ohabolana 3:5
      {b: 24, c: 29, v: 11}, // Jeremia 29:11
      {b: 19, c: 126, v: 5}, // Salamo 126:5
      {b: 36, c: 3, v: 17}, // Zefania 3:17
    ],
  },
  {
    id: 'caregiver',
    label: 'Mikarakara marary na antitra',
    kind: 'long',
    checkEvery: 14,
    verses: [
      {b: 19, c: 61, v: 2}, // Salamo 61:2
      {b: 19, c: 18, v: 6}, // Salamo 18:6
      {b: 2, c: 18, v: 18}, // Eksodosy 18:18
      {b: 40, c: 11, v: 28}, // Matio 11:28
      {b: 41, c: 6, v: 31}, // Marka 6:31
      {b: 19, c: 55, v: 22}, // Salamo 55:22
      {b: 60, c: 5, v: 7}, // 1 Petera 5:7
      {b: 23, c: 40, v: 29}, // Isaia 40:29
      {b: 23, c: 40, v: 31}, // Isaia 40:31
      {b: 48, c: 6, v: 2}, // Galatiana 6:2
      {b: 40, c: 25, v: 40}, // Matio 25:40
      {b: 58, c: 6, v: 10}, // Hebreo 6:10
      {b: 47, c: 4, v: 16}, // 2 Korintiana 4:16
      {b: 19, c: 23, v: 2}, // Salamo 23:2
      {b: 19, c: 116, v: 7}, // Salamo 116:7
      {b: 8, c: 1, v: 16}, // Rota 1:16
      {b: 50, c: 4, v: 13}, // Filipiana 4:13
      {b: 50, c: 4, v: 19}, // Filipiana 4:19
      {b: 47, c: 9, v: 8}, // 2 Korintiana 9:8
      {b: 23, c: 41, v: 10}, // Isaia 41:10
      {b: 25, c: 3, v: 22, to: 23}, // Fitomaniana 3:22-23
      {b: 19, c: 121, v: 2}, // Salamo 121:2
      {b: 19, c: 28, v: 7}, // Salamo 28:7
      {b: 23, c: 58, v: 11}, // Isaia 58:11
      {b: 23, c: 46, v: 4}, // Isaia 46:4
      {b: 19, c: 4, v: 8}, // Salamo 4:8
      {b: 58, c: 4, v: 16}, // Hebreo 4:16
      {b: 19, c: 73, v: 26}, // Salamo 73:26
    ],
  },
  {
    id: 'insomnia',
    label: 'Tsy mahita tory',
    kind: 'short',
    days: 7,
    checkEvery: 7,
    verses: [
      {b: 19, c: 102, v: 7}, // Salamo 102:7
      {b: 19, c: 63, v: 6}, // Salamo 63:6
      {b: 19, c: 42, v: 8}, // Salamo 42:8
      {b: 19, c: 121, v: 4}, // Salamo 121:4
      {b: 19, c: 4, v: 8}, // Salamo 4:8
      {b: 20, c: 3, v: 24}, // Ohabolana 3:24
      {b: 19, c: 3, v: 5}, // Salamo 3:5
      {b: 19, c: 91, v: 1}, // Salamo 91:1
      {b: 23, c: 26, v: 3}, // Isaia 26:3
      {b: 40, c: 11, v: 28}, // Matio 11:28
    ],
  },
  {
    id: 'pregnancy',
    label: 'Fitondrana vohoka sy fiterahana',
    kind: 'long',
    checkEvery: 14,
    verses: [
      {b: 23, c: 26, v: 17}, // Isaia 26:17
      {b: 43, c: 16, v: 21}, // Jaona 16:21
      {b: 19, c: 139, v: 13}, // Salamo 139:13
      {b: 19, c: 139, v: 14}, // Salamo 139:14
      {b: 19, c: 139, v: 16}, // Salamo 139:16
      {b: 24, c: 1, v: 5}, // Jeremia 1:5
      {b: 23, c: 46, v: 3}, // Isaia 46:3
      {b: 23, c: 44, v: 2}, // Isaia 44:2
      {b: 19, c: 22, v: 9}, // Salamo 22:9
      {b: 19, c: 22, v: 10}, // Salamo 22:10
      {b: 23, c: 40, v: 11}, // Isaia 40:11
      {b: 23, c: 66, v: 13}, // Isaia 66:13
      {b: 23, c: 41, v: 10}, // Isaia 41:10
      {b: 50, c: 4, v: 6}, // Filipiana 4:6
      {b: 50, c: 4, v: 7}, // Filipiana 4:7
      {b: 43, c: 14, v: 27}, // Jaona 14:27
      {b: 19, c: 121, v: 7}, // Salamo 121:7
      {b: 4, c: 6, v: 24, to: 26}, // Nomery 6:24-26
      {b: 23, c: 43, v: 1}, // Isaia 43:1
      {b: 19, c: 127, v: 3}, // Salamo 127:3
      {b: 19, c: 71, v: 6}, // Salamo 71:6
      {b: 42, c: 1, v: 45}, // Lioka 1:45
      {b: 20, c: 31, v: 25}, // Ohabolana 31:25
      {b: 5, c: 31, v: 8}, // Deoteronomia 31:8
      {b: 19, c: 16, v: 8}, // Salamo 16:8
      {b: 23, c: 26, v: 3}, // Isaia 26:3
      {b: 19, c: 37, v: 5}, // Salamo 37:5
      {b: 19, c: 28, v: 7}, // Salamo 28:7
    ],
  },
  {
    id: 'addictedrelative',
    label: 'Havana voafatotry ny toaka na zava-mahadomelina',
    kind: 'long',
    checkEvery: 14,
    safetyNote: true,
    verses: [
      {b: 19, c: 6, v: 3}, // Salamo 6:3
      {b: 25, c: 3, v: 49, to: 50}, // Fitomaniana 3:49-50
      {b: 41, c: 9, v: 24}, // Marka 9:24
      {b: 60, c: 5, v: 7}, // 1 Petera 5:7
      {b: 19, c: 55, v: 22}, // Salamo 55:22
      {b: 19, c: 34, v: 18}, // Salamo 34:18
      {b: 42, c: 15, v: 20}, // Lioka 15:20
      {b: 42, c: 15, v: 24}, // Lioka 15:24
      {b: 42, c: 19, v: 10}, // Lioka 19:10
      {b: 19, c: 18, v: 16}, // Salamo 18:16
      {b: 40, c: 18, v: 12}, // Matio 18:12
      {b: 23, c: 49, v: 25}, // Isaia 49:25
      {b: 24, c: 31, v: 17}, // Jeremia 31:17
      {b: 19, c: 107, v: 14}, // Salamo 107:14
      {b: 19, c: 107, v: 20}, // Salamo 107:20
      {b: 43, c: 8, v: 36}, // Jaona 8:36
      {b: 47, c: 5, v: 17}, // 2 Korintiana 5:17
      {b: 40, c: 19, v: 26}, // Matio 19:26
      {b: 24, c: 32, v: 27}, // Jeremia 32:27
      {b: 45, c: 8, v: 26}, // Romana 8:26
      {b: 45, c: 12, v: 12}, // Romana 12:12
      {b: 48, c: 6, v: 2}, // Galatiana 6:2
      {b: 50, c: 4, v: 6}, // Filipiana 4:6
      {b: 23, c: 40, v: 29}, // Isaia 40:29
      {b: 25, c: 3, v: 22, to: 23}, // Fitomaniana 3:22-23
      {b: 19, c: 130, v: 5}, // Salamo 130:5
      {b: 50, c: 1, v: 6}, // Filipiana 1:6
      {b: 20, c: 3, v: 5}, // Ohabolana 3:5
    ],
  },
];

// The choice list is grouped by what a situation touches in a life, not by
// how long its plan runs (that stays under each label). Titles are
// placeholder MG copy — user-owned.
export type SituationTheme = 'heart' | 'family' | 'health' | 'life' | 'hardship' | 'faith';

export const SITUATION_THEMES: ReadonlyArray<{theme: SituationTheme; title: string}> = [
  {theme: 'heart', title: 'Ny ao am-po'},
  {theme: 'family', title: 'Fianakaviana sy fifandraisana'},
  {theme: 'health', title: 'Fahasalamana, fahanterana ary fisaonana'},
  {theme: 'life', title: 'Fiainana andavanandro'},
  {theme: 'hardship', title: 'Loza, herisetra ary tsy rariny'},
  {theme: 'faith', title: 'Finoana'},
];

// Every situation in exactly one theme: a Record, so a new id that is left out
// does not compile.
export const SITUATION_THEME: Record<SituationId, SituationTheme> = {
  fear: 'heart',
  discouraged: 'heart',
  lonely: 'heart',
  shame: 'heart',
  anger: 'heart',
  insomnia: 'heart',
  family: 'family',
  children: 'family',
  conflict: 'family',
  betrayed: 'family',
  divorce: 'family',
  heartbreak: 'family',
  addictedrelative: 'family',
  illness: 'health',
  grief: 'health',
  babyloss: 'health',
  ageing: 'health',
  disability: 'health',
  caregiver: 'health',
  pregnancy: 'health',
  work: 'life',
  studies: 'life',
  newtask: 'life',
  journey: 'life',
  guidance: 'life',
  waiting: 'life',
  disaster: 'hardship',
  insecurity: 'hardship',
  injustice: 'hardship',
  prison: 'hardship',
  newfaith: 'faith',
  doubt: 'faith',
  faraway: 'faith',
  guilt: 'faith',
  temptation: 'faith',
  thanks: 'faith',
};

// "How is your heart?", above the list: a feeling, said without having to find
// the words, brings the situations that may fit to the top. Nothing is chosen
// for the person. Labels are placeholder MG copy — user-owned.
export type FeelingId = 'afraid' | 'sad' | 'discouraged' | 'angry' | 'ashamed' | 'thankful';

export const FEELINGS: ReadonlyArray<{
  id: FeelingId;
  label: string;
  situations: ReadonlyArray<SituationId>;
}> = [
  {
    id: 'afraid',
    label: 'Matahotra',
    situations: ['fear', 'insecurity', 'insomnia', 'disaster', 'pregnancy', 'newtask', 'studies'],
  },
  {
    id: 'sad',
    label: 'Malahelo',
    situations: ['grief', 'babyloss', 'lonely', 'divorce', 'heartbreak', 'betrayed', 'illness'],
  },
  {
    id: 'discouraged',
    label: 'Kivy',
    situations: ['discouraged', 'waiting', 'work', 'caregiver', 'disability', 'ageing', 'faraway'],
  },
  {id: 'angry', label: 'Tezitra', situations: ['anger', 'injustice', 'conflict', 'betrayed', 'family']},
  {id: 'ashamed', label: 'Menatra', situations: ['shame', 'guilt', 'temptation', 'prison', 'addictedrelative']},
  {id: 'thankful', label: 'Mankasitraka', situations: ['thanks', 'newfaith']},
];
