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
  | 'lonely';

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
];
