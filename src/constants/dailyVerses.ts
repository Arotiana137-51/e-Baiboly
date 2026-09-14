/**
 * Verse calendar for the daily-verse notification. Refs only — the Malagasy
 * text is read from the bundled Bible DB when the notification is scheduled,
 * so the feature stays fully offline.
 *
 * DAILY_VERSES has exactly 365 entries, index = dayOfYear - 1. Roughly every
 * 5th entry (marked `// c`) is a correction / repentance verse; the rest are
 * encouragement. Standard 1-66 book ids. Chapter/verse numbers follow the
 * MG1865 numbering, which is Hebrew-style in Joel, Malachi, Hosea 14, Isaiah 9
 * and 64, Micah 5 and Jonah 2 (English numbering differs there) but
 * English-style in the Psalms.
 */
export type VerseRef = {b: number; c: number; v: number; to?: number}; // to = end verse of a pair

export const DAILY_VERSES: ReadonlyArray<VerseRef> = [
  {b: 19, c: 23, v: 1}, // Salamo 23:1
  {b: 19, c: 23, v: 4}, // Salamo 23:4
  {b: 19, c: 23, v: 6}, // Salamo 23:6
  {b: 23, c: 41, v: 10}, // Isaia 41:10
  {b: 29, c: 2, v: 12, to: 13}, // Joela 2:12-13 c
  {b: 24, c: 29, v: 11}, // Jeremia 29:11
  {b: 5, c: 31, v: 6}, // Deotoronomia 31:6
  {b: 20, c: 3, v: 5, to: 6}, // Ohabolana 3:5-6
  {b: 36, c: 3, v: 17}, // Zefania 3:17
  {b: 19, c: 51, v: 10}, // Salamo 51:10 c
  {b: 40, c: 11, v: 28}, // Matio 11:28
  {b: 42, c: 1, v: 37}, // Lioka 1:37
  {b: 43, c: 3, v: 16}, // Jaona 3:16
  {b: 45, c: 8, v: 28}, // Romana 8:28
  {b: 40, c: 3, v: 2}, // Matio 3:2 c
  {b: 46, c: 10, v: 13}, // 1 Korintiana 10:13
  {b: 50, c: 4, v: 13}, // Filipiana 4:13
  {b: 58, c: 11, v: 1}, // Hebreo 11:1
  {b: 60, c: 5, v: 7}, // 1 Petera 5:7
  {b: 48, c: 6, v: 7}, // Galatiana 6:7 c
  {b: 62, c: 4, v: 4}, // 1 Jaona 4:4
  {b: 19, c: 46, v: 1}, // Salamo 46:1
  {b: 19, c: 46, v: 10}, // Salamo 46:10
  {b: 19, c: 46, v: 7}, // Salamo 46:7
  {b: 23, c: 55, v: 6, to: 7}, // Isaia 55:6-7 c
  {b: 23, c: 40, v: 31}, // Isaia 40:31
  {b: 24, c: 33, v: 3}, // Jeremia 33:3
  {b: 6, c: 1, v: 9}, // Josoa 1:9
  {b: 20, c: 18, v: 10}, // Ohabolana 18:10
  {b: 20, c: 3, v: 7}, // Ohabolana 3:7 c
  {b: 33, c: 7, v: 7}, // Mika 7:7
  {b: 40, c: 6, v: 33}, // Matio 6:33
  {b: 42, c: 12, v: 32}, // Lioka 12:32
  {b: 43, c: 14, v: 27}, // Jaona 14:27
  {b: 42, c: 13, v: 3}, // Lioka 13:3 c
  {b: 45, c: 8, v: 1}, // Romana 8:1
  {b: 47, c: 12, v: 9}, // 2 Korintiana 12:9
  {b: 48, c: 2, v: 20}, // Galatiana 2:20
  {b: 52, c: 5, v: 16, to: 18}, // 1 Tesaloniana 5:16-18
  {b: 59, c: 1, v: 22}, // Jakoba 1:22 c
  {b: 59, c: 1, v: 5}, // Jakoba 1:5
  {b: 66, c: 21, v: 4}, // Apokalypsy 21:4
  {b: 19, c: 91, v: 1}, // Salamo 91:1
  {b: 19, c: 91, v: 2}, // Salamo 91:2
  {b: 23, c: 1, v: 16, to: 17}, // Isaia 1:16-17 c
  {b: 19, c: 91, v: 4}, // Salamo 91:4
  {b: 23, c: 26, v: 3}, // Isaia 26:3
  {b: 24, c: 17, v: 7}, // Jeremia 17:7
  {b: 2, c: 14, v: 14}, // Eksodosy 14:14
  {b: 19, c: 139, v: 23, to: 24}, // Salamo 139:23-24 c
  {b: 20, c: 16, v: 3}, // Ohabolana 16:3
  {b: 34, c: 1, v: 7}, // Nahoma 1:7
  {b: 40, c: 7, v: 7}, // Matio 7:7
  {b: 42, c: 6, v: 38}, // Lioka 6:38
  {b: 40, c: 6, v: 14, to: 15}, // Matio 6:14-15 c
  {b: 43, c: 16, v: 33}, // Jaona 16:33
  {b: 45, c: 8, v: 31}, // Romana 8:31
  {b: 46, c: 2, v: 9}, // 1 Korintiana 2:9
  {b: 49, c: 2, v: 8}, // Efesiana 2:8
  {b: 45, c: 12, v: 2}, // Romana 12:2 c
  {b: 58, c: 13, v: 5}, // Hebreo 13:5
  {b: 60, c: 2, v: 9}, // 1 Petera 2:9
  {b: 62, c: 4, v: 18}, // 1 Jaona 4:18
  {b: 19, c: 27, v: 1}, // Salamo 27:1
  {b: 26, c: 18, v: 30}, // Ezekiela 18:30 c
  {b: 19, c: 27, v: 14}, // Salamo 27:14
  {b: 19, c: 27, v: 4}, // Salamo 27:4
  {b: 23, c: 43, v: 2}, // Isaia 43:2
  {b: 24, c: 31, v: 3}, // Jeremia 31:3
  {b: 20, c: 16, v: 18}, // Ohabolana 16:18 c
  {b: 4, c: 6, v: 24, to: 26}, // Nomery 6:24-26
  {b: 20, c: 3, v: 26}, // Ohabolana 3:26
  {b: 35, c: 3, v: 18, to: 19}, // Habakoka 3:18-19
  {b: 40, c: 28, v: 20}, // Matio 28:20
  {b: 41, c: 1, v: 15}, // Marka 1:15 c
  {b: 42, c: 11, v: 9}, // Lioka 11:9
  {b: 43, c: 10, v: 10}, // Jaona 10:10
  {b: 45, c: 8, v: 38, to: 39}, // Romana 8:38-39
  {b: 47, c: 5, v: 17}, // 2 Korintiana 5:17
  {b: 62, c: 1, v: 9}, // 1 Jaona 1:9 c
  {b: 51, c: 3, v: 23}, // Kolosiana 3:23
  {b: 55, c: 1, v: 7}, // 2 Timoty 1:7
  {b: 59, c: 1, v: 12}, // Jakoba 1:12
  {b: 66, c: 1, v: 8}, // Apokalypsy 1:8
  {b: 26, c: 33, v: 11}, // Ezekiela 33:11 c
  {b: 19, c: 34, v: 18}, // Salamo 34:18
  {b: 19, c: 34, v: 4}, // Salamo 34:4
  {b: 19, c: 34, v: 19}, // Salamo 34:19
  {b: 23, c: 54, v: 17}, // Isaia 54:17
  {b: 19, c: 32, v: 5}, // Salamo 32:5 c
  {b: 24, c: 32, v: 27}, // Jeremia 32:27
  {b: 5, c: 31, v: 8}, // Deotoronomia 31:8
  {b: 20, c: 10, v: 22}, // Ohabolana 10:22
  {b: 35, c: 2, v: 4}, // Habakoka 2:4
  {b: 40, c: 7, v: 1, to: 2}, // Matio 7:1-2 c
  {b: 40, c: 19, v: 26}, // Matio 19:26
  {b: 42, c: 12, v: 7}, // Lioka 12:7
  {b: 43, c: 8, v: 12}, // Jaona 8:12
  {b: 45, c: 5, v: 8}, // Romana 5:8
  {b: 49, c: 4, v: 26, to: 27}, // Efesiana 4:26-27 c
  {b: 46, c: 15, v: 57}, // 1 Korintiana 15:57
  {b: 50, c: 4, v: 6}, // Filipiana 4:6
  {b: 58, c: 4, v: 16}, // Hebreo 4:16
  {b: 60, c: 5, v: 10}, // 1 Petera 5:10
  {b: 28, c: 6, v: 1}, // Hosea 6:1 c
  {b: 62, c: 3, v: 1}, // 1 Jaona 3:1
  {b: 19, c: 37, v: 4}, // Salamo 37:4
  {b: 19, c: 37, v: 5}, // Salamo 37:5
  {b: 19, c: 37, v: 23}, // Salamo 37:23
  {b: 20, c: 28, v: 13}, // Ohabolana 28:13 c
  {b: 23, c: 41, v: 13}, // Isaia 41:13
  {b: 24, c: 29, v: 12}, // Jeremia 29:12
  {b: 1, c: 28, v: 15}, // Genesisy 28:15
  {b: 20, c: 16, v: 9}, // Ohabolana 16:9
  {b: 42, c: 6, v: 46}, // Lioka 6:46 c
  {b: 38, c: 4, v: 6}, // Zakaria 4:6
  {b: 40, c: 6, v: 34}, // Matio 6:34
  {b: 42, c: 18, v: 27}, // Lioka 18:27
  {b: 43, c: 14, v: 6}, // Jaona 14:6
  {b: 59, c: 4, v: 7}, // Jakoba 4:7 c
  {b: 45, c: 8, v: 37}, // Romana 8:37
  {b: 47, c: 4, v: 16}, // 2 Korintiana 4:16
  {b: 48, c: 5, v: 22, to: 23}, // Galatiana 5:22-23
  {b: 56, c: 2, v: 11}, // Titosy 2:11
  {b: 28, c: 10, v: 12}, // Hosea 10:12 c
  {b: 59, c: 1, v: 17}, // Jakoba 1:17
  {b: 66, c: 21, v: 5}, // Apokalypsy 21:5
  {b: 19, c: 55, v: 22}, // Salamo 55:22
  {b: 19, c: 56, v: 3}, // Salamo 56:3
  {b: 19, c: 34, v: 14}, // Salamo 34:14 c
  {b: 19, c: 57, v: 1}, // Salamo 57:1
  {b: 23, c: 43, v: 1}, // Isaia 43:1
  {b: 24, c: 29, v: 13}, // Jeremia 29:13
  {b: 5, c: 33, v: 27}, // Deotoronomia 33:27
  {b: 40, c: 6, v: 24}, // Matio 6:24 c
  {b: 20, c: 17, v: 17}, // Ohabolana 17:17
  {b: 39, c: 3, v: 6}, // Malakia 3:6
  {b: 40, c: 5, v: 16}, // Matio 5:16
  {b: 42, c: 1, v: 45}, // Lioka 1:45
  {b: 45, c: 12, v: 21}, // Romana 12:21 c
  {b: 43, c: 15, v: 5}, // Jaona 15:5
  {b: 45, c: 10, v: 9}, // Romana 10:9
  {b: 46, c: 13, v: 4}, // 1 Korintiana 13:4
  {b: 49, c: 3, v: 20}, // Efesiana 3:20
  {b: 30, c: 5, v: 14}, // Amosa 5:14 c
  {b: 58, c: 12, v: 2}, // Hebreo 12:2
  {b: 60, c: 2, v: 24}, // 1 Petera 2:24
  {b: 62, c: 4, v: 19}, // 1 Jaona 4:19
  {b: 19, c: 103, v: 2}, // Salamo 103:2
  {b: 20, c: 14, v: 12}, // Ohabolana 14:12 c
  {b: 19, c: 103, v: 8}, // Salamo 103:8
  {b: 19, c: 103, v: 12}, // Salamo 103:12
  {b: 23, c: 40, v: 29}, // Isaia 40:29
  {b: 24, c: 17, v: 8}, // Jeremia 17:8
  {b: 43, c: 14, v: 15}, // Jaona 14:15 c
  {b: 6, c: 1, v: 8}, // Josoa 1:8
  {b: 20, c: 19, v: 21}, // Ohabolana 19:21
  {b: 29, c: 2, v: 25}, // Joela 2:25
  {b: 40, c: 11, v: 29}, // Matio 11:29
  {b: 62, c: 1, v: 8}, // 1 Jaona 1:8 c
  {b: 42, c: 1, v: 49}, // Lioka 1:49
  {b: 43, c: 1, v: 12}, // Jaona 1:12
  {b: 45, c: 15, v: 13}, // Romana 15:13
  {b: 47, c: 5, v: 7}, // 2 Korintiana 5:7
  {b: 30, c: 5, v: 15}, // Amosa 5:15 c
  {b: 51, c: 3, v: 15}, // Kolosiana 3:15
  {b: 52, c: 5, v: 24}, // 1 Tesaloniana 5:24
  {b: 59, c: 5, v: 16}, // Jakoba 5:16
  {b: 66, c: 7, v: 17}, // Apokalypsy 7:17
  {b: 19, c: 51, v: 17}, // Salamo 51:17 c
  {b: 19, c: 121, v: 1, to: 2}, // Salamo 121:1-2
  {b: 19, c: 121, v: 7}, // Salamo 121:7
  {b: 19, c: 121, v: 8}, // Salamo 121:8
  {b: 23, c: 55, v: 11}, // Isaia 55:11
  {b: 40, c: 7, v: 13, to: 14}, // Matio 7:13-14 c
  {b: 24, c: 1, v: 5}, // Jeremia 1:5
  {b: 2, c: 33, v: 14}, // Eksodosy 33:14
  {b: 20, c: 23, v: 18}, // Ohabolana 23:18
  {b: 29, c: 3, v: 5}, // Joela 3:5
  {b: 51, c: 3, v: 5}, // Kolosiana 3:5 c
  {b: 40, c: 17, v: 20}, // Matio 17:20
  {b: 42, c: 1, v: 50}, // Lioka 1:50
  {b: 43, c: 14, v: 1}, // Jaona 14:1
  {b: 45, c: 12, v: 12}, // Romana 12:12
  {b: 33, c: 6, v: 8}, // Mika 6:8 c
  {b: 46, c: 13, v: 13}, // 1 Korintiana 13:13
  {b: 50, c: 4, v: 7}, // Filipiana 4:7
  {b: 58, c: 13, v: 8}, // Hebreo 13:8
  {b: 60, c: 1, v: 3}, // 1 Petera 1:3
  {b: 20, c: 3, v: 11, to: 12}, // Ohabolana 3:11-12 c
  {b: 62, c: 5, v: 4}, // 1 Jaona 5:4
  {b: 19, c: 118, v: 24}, // Salamo 118:24
  {b: 19, c: 118, v: 6}, // Salamo 118:6
  {b: 19, c: 118, v: 14}, // Salamo 118:14
  {b: 42, c: 9, v: 23}, // Lioka 9:23 c
  {b: 23, c: 49, v: 15}, // Isaia 49:15
  {b: 24, c: 17, v: 14}, // Jeremia 17:14
  {b: 13, c: 16, v: 11}, // 1 Tantara 16:11
  {b: 20, c: 24, v: 14}, // Ohabolana 24:14
  {b: 59, c: 4, v: 8}, // Jakoba 4:8 c
  {b: 28, c: 6, v: 3}, // Hosea 6:3
  {b: 40, c: 21, v: 22}, // Matio 21:22
  {b: 42, c: 4, v: 18}, // Lioka 4:18
  {b: 43, c: 8, v: 32}, // Jaona 8:32
  {b: 38, c: 1, v: 3}, // Zakaria 1:3 c
  {b: 45, c: 8, v: 18}, // Romana 8:18
  {b: 47, c: 1, v: 3, to: 4}, // 2 Korintiana 1:3-4
  {b: 48, c: 6, v: 9}, // Galatiana 6:9
  {b: 55, c: 1, v: 12}, // 2 Timoty 1:12
  {b: 19, c: 37, v: 8}, // Salamo 37:8 c
  {b: 59, c: 1, v: 2, to: 3}, // Jakoba 1:2-3
  {b: 66, c: 2, v: 10}, // Apokalypsy 2:10
  {b: 19, c: 16, v: 11}, // Salamo 16:11
  {b: 19, c: 16, v: 8}, // Salamo 16:8
  {b: 40, c: 7, v: 21}, // Matio 7:21 c
  {b: 19, c: 17, v: 8}, // Salamo 17:8
  {b: 23, c: 12, v: 2}, // Isaia 12:2
  {b: 24, c: 32, v: 17}, // Jeremia 32:17
  {b: 16, c: 8, v: 10}, // Nehemia 8:10
  {b: 46, c: 10, v: 12}, // 1 Korintiana 10:12 c
  {b: 20, c: 30, v: 5}, // Ohabolana 30:5
  {b: 27, c: 12, v: 3}, // Daniela 12:3
  {b: 40, c: 18, v: 20}, // Matio 18:20
  {b: 42, c: 6, v: 21}, // Lioka 6:21
  {b: 39, c: 3, v: 7}, // Malakia 3:7 c
  {b: 43, c: 6, v: 35}, // Jaona 6:35
  {b: 45, c: 6, v: 23}, // Romana 6:23
  {b: 46, c: 15, v: 58}, // 1 Korintiana 15:58
  {b: 49, c: 2, v: 10}, // Efesiana 2:10
  {b: 20, c: 11, v: 2}, // Ohabolana 11:2 c
  {b: 58, c: 10, v: 23}, // Hebreo 10:23
  {b: 60, c: 3, v: 12}, // 1 Petera 3:12
  {b: 62, c: 4, v: 10}, // 1 Jaona 4:10
  {b: 19, c: 30, v: 5}, // Salamo 30:5
  {b: 44, c: 3, v: 19}, // undefined 3:19 c
  {b: 19, c: 31, v: 24}, // Salamo 31:24
  {b: 19, c: 32, v: 7}, // Salamo 32:7
  {b: 23, c: 30, v: 21}, // Isaia 30:21
  {b: 24, c: 15, v: 16}, // Jeremia 15:16
  {b: 62, c: 2, v: 15}, // 1 Jaona 2:15 c
  {b: 14, c: 20, v: 15}, // 2 Tantara 20:15
  {b: 20, c: 3, v: 24}, // Ohabolana 3:24
  {b: 26, c: 36, v: 26}, // Ezekiela 36:26
  {b: 40, c: 6, v: 26}, // Matio 6:26
  {b: 14, c: 7, v: 14}, // 2 Tantara 7:14 c
  {b: 42, c: 8, v: 48}, // Lioka 8:48
  {b: 43, c: 3, v: 17}, // Jaona 3:17
  {b: 45, c: 5, v: 1}, // Romana 5:1
  {b: 47, c: 4, v: 17}, // 2 Korintiana 4:17
  {b: 19, c: 90, v: 12}, // Salamo 90:12 c
  {b: 51, c: 1, v: 13}, // Kolosiana 1:13
  {b: 53, c: 3, v: 3}, // 2 Tesaloniana 3:3
  {b: 59, c: 1, v: 4}, // Jakoba 1:4
  {b: 66, c: 21, v: 7}, // Apokalypsy 21:7
  {b: 40, c: 16, v: 26}, // Matio 16:26 c
  {b: 19, c: 32, v: 8}, // Salamo 32:8
  {b: 19, c: 33, v: 18}, // Salamo 33:18
  {b: 19, c: 33, v: 20}, // Salamo 33:20
  {b: 23, c: 46, v: 4}, // Isaia 46:4
  {b: 49, c: 4, v: 29}, // Efesiana 4:29 c
  {b: 24, c: 31, v: 25}, // Jeremia 31:25
  {b: 5, c: 7, v: 9}, // Deotoronomia 7:9
  {b: 20, c: 3, v: 33}, // Ohabolana 3:33
  {b: 33, c: 7, v: 8}, // Mika 7:8
  {b: 24, c: 6, v: 16}, // Jeremia 6:16 c
  {b: 40, c: 7, v: 11}, // Matio 7:11
  {b: 42, c: 8, v: 50}, // Lioka 8:50
  {b: 43, c: 6, v: 37}, // Jaona 6:37
  {b: 45, c: 5, v: 5}, // Romana 5:5
  {b: 20, c: 12, v: 1}, // Ohabolana 12:1 c
  {b: 46, c: 1, v: 9}, // 1 Korintiana 1:9
  {b: 50, c: 1, v: 6}, // Filipiana 1:6
  {b: 58, c: 11, v: 6}, // Hebreo 11:6
  {b: 60, c: 4, v: 8}, // 1 Petera 4:8
  {b: 42, c: 12, v: 15}, // Lioka 12:15 c
  {b: 62, c: 4, v: 16}, // 1 Jaona 4:16
  {b: 19, c: 62, v: 1}, // Salamo 62:1
  {b: 19, c: 62, v: 5}, // Salamo 62:5
  {b: 19, c: 62, v: 8}, // Salamo 62:8
  {b: 59, c: 4, v: 10}, // Jakoba 4:10 c
  {b: 23, c: 58, v: 11}, // Isaia 58:11
  {b: 24, c: 30, v: 17}, // Jeremia 30:17
  {b: 1, c: 50, v: 20}, // Genesisy 50:20
  {b: 20, c: 10, v: 28}, // Ohabolana 10:28
  {b: 25, c: 3, v: 40}, // Fitomaniana 3:40 c
  {b: 33, c: 7, v: 18}, // Mika 7:18
  {b: 40, c: 10, v: 31}, // Matio 10:31
  {b: 42, c: 10, v: 20}, // Lioka 10:20
  {b: 43, c: 8, v: 36}, // Jaona 8:36
  {b: 19, c: 119, v: 9}, // Salamo 119:9 c
  {b: 45, c: 8, v: 15}, // Romana 8:15
  {b: 47, c: 9, v: 8}, // 2 Korintiana 9:8
  {b: 48, c: 3, v: 26}, // Galatiana 3:26
  {b: 54, c: 1, v: 15}, // 1 Timoty 1:15
  {b: 40, c: 5, v: 44}, // Matio 5:44 c
  {b: 59, c: 1, v: 18}, // Jakoba 1:18
  {b: 66, c: 3, v: 8}, // Apokalypsy 3:8
  {b: 19, c: 73, v: 26}, // Salamo 73:26
  {b: 19, c: 84, v: 11}, // Salamo 84:11
  {b: 45, c: 2, v: 4}, // Romana 2:4 c
  {b: 19, c: 90, v: 14}, // Salamo 90:14
  {b: 23, c: 60, v: 1}, // Isaia 60:1
  {b: 24, c: 33, v: 6}, // Jeremia 33:6
  {b: 9, c: 16, v: 7}, // 1 Samoela 16:7
  {b: 6, c: 24, v: 15}, // Josoa 24:15 c
  {b: 20, c: 11, v: 25}, // Ohabolana 11:25
  {b: 33, c: 7, v: 19}, // Mika 7:19
  {b: 40, c: 5, v: 14}, // Matio 5:14
  {b: 42, c: 11, v: 13}, // Lioka 11:13
  {b: 20, c: 15, v: 1}, // Ohabolana 15:1 c
  {b: 43, c: 10, v: 11}, // Jaona 10:11
  {b: 45, c: 8, v: 26}, // Romana 8:26
  {b: 46, c: 13, v: 7}, // 1 Korintiana 13:7
  {b: 49, c: 6, v: 10}, // Efesiana 6:10
  {b: 43, c: 3, v: 3}, // Jaona 3:3 c
  {b: 58, c: 6, v: 19}, // Hebreo 6:19
  {b: 60, c: 1, v: 8, to: 9}, // 1 Petera 1:8-9
  {b: 62, c: 5, v: 14}, // 1 Jaona 5:14
  {b: 19, c: 86, v: 5}, // Salamo 86:5
  {b: 66, c: 3, v: 19}, // Apokalypsy 3:19 c
  {b: 19, c: 86, v: 15}, // Salamo 86:15
  {b: 19, c: 103, v: 13}, // Salamo 103:13
  {b: 23, c: 65, v: 24}, // Isaia 65:24
  {b: 25, c: 3, v: 22, to: 23}, // Fitomaniana 3:22-23
  {b: 9, c: 15, v: 22}, // 1 Samoela 15:22 c
  {b: 2, c: 15, v: 2}, // Eksodosy 15:2
  {b: 20, c: 12, v: 25}, // Ohabolana 12:25
  {b: 35, c: 2, v: 3}, // Habakoka 2:3
  {b: 40, c: 11, v: 30}, // Matio 11:30
  {b: 19, c: 141, v: 3}, // Salamo 141:3 c
  {b: 42, c: 12, v: 6}, // Lioka 12:6
  {b: 43, c: 10, v: 27, to: 28}, // Jaona 10:27-28
  {b: 45, c: 8, v: 32}, // Romana 8:32
  {b: 47, c: 12, v: 10}, // 2 Korintiana 12:10
  {b: 40, c: 23, v: 12}, // Matio 23:12 c
  {b: 51, c: 2, v: 6, to: 7}, // Kolosiana 2:6-7
  {b: 55, c: 2, v: 13}, // 2 Timoty 2:13
  {b: 59, c: 1, v: 25}, // Jakoba 1:25
  {b: 66, c: 22, v: 13}, // Apokalypsy 22:13
  {b: 52, c: 5, v: 22}, // 1 Tesaloniana 5:22 c
  {b: 19, c: 94, v: 19}, // Salamo 94:19
  {b: 19, c: 100, v: 5}, // Salamo 100:5
  {b: 19, c: 107, v: 1}, // Salamo 107:1
  {b: 23, c: 26, v: 4}, // Isaia 26:4
  {b: 9, c: 12, v: 24}, // 1 Samoela 12:24 c
  {b: 25, c: 3, v: 24}, // Fitomaniana 3:24
  {b: 14, c: 16, v: 9}, // 2 Tantara 16:9
  {b: 20, c: 13, v: 12}, // Ohabolana 13:12
  {b: 36, c: 3, v: 15}, // Zefania 3:15
  {b: 20, c: 19, v: 20}, // Ohabolana 19:20 c
  {b: 40, c: 28, v: 18}, // Matio 28:18
  {b: 42, c: 12, v: 24}, // Lioka 12:24
  {b: 43, c: 14, v: 2}, // Jaona 14:2
  {b: 45, c: 10, v: 13}, // Romana 10:13
  {b: 42, c: 6, v: 37}, // Lioka 6:37 c
  {b: 46, c: 13, v: 8}, // 1 Korintiana 13:8
  {b: 50, c: 4, v: 19}, // Filipiana 4:19
  {b: 58, c: 13, v: 6}, // Hebreo 13:6
  {b: 60, c: 1, v: 6, to: 7}, // 1 Petera 1:6-7
  {b: 59, c: 1, v: 19, to: 20}, // Jakoba 1:19-20 c
  {b: 62, c: 5, v: 13}, // 1 Jaona 5:13
  {b: 19, c: 119, v: 105}, // Salamo 119:105
  {b: 19, c: 119, v: 114}, // Salamo 119:114
  {b: 19, c: 119, v: 165}, // Salamo 119:165
  {b: 23, c: 5, v: 20}, // Isaia 5:20 c
];

// Palm Sunday .. Easter Monday (Alatsinain'ny Paska is a public holiday).
export const HOLY_WEEK: ReadonlyArray<VerseRef> = [
  {b: 40, c: 21, v: 9}, // Matio 21:9
  {b: 43, c: 12, v: 24}, // Jaona 12:24
  {b: 43, c: 12, v: 32}, // Jaona 12:32
  {b: 42, c: 22, v: 42}, // Lioka 22:42
  {b: 43, c: 13, v: 34}, // Jaona 13:34
  {b: 23, c: 53, v: 5}, // Isaia 53:5
  {b: 19, c: 16, v: 10}, // Salamo 16:10
  {b: 40, c: 28, v: 6}, // Matio 28:6
  {b: 43, c: 11, v: 25}, // Jaona 11:25
];

// 24, 25, 26 December.
export const CHRISTMAS: ReadonlyArray<VerseRef> = [
  {b: 42, c: 2, v: 10, to: 11}, // Lioka 2:10-11
  {b: 23, c: 9, v: 5}, // Isaia 9:5
  {b: 43, c: 1, v: 14}, // Jaona 1:14
];

const DAY_MS = 86_400_000;

// Local calendar day as a UTC midnight timestamp, so day arithmetic is
// immune to DST shifts.
const utcMidnight = (date: Date): number =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

const dayOfYear = (date: Date): number =>
  (utcMidnight(date) - Date.UTC(date.getFullYear(), 0, 1)) / DAY_MS + 1;

// Anonymous Gregorian algorithm (Meeus/Jones/Butcher). Returns UTC midnight.
export const easterSunday = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
};

export const dailyVerseFor = (date: Date): VerseRef => {
  const daysFromEaster =
    (utcMidnight(date) - easterSunday(date.getFullYear()).getTime()) / DAY_MS;
  if (daysFromEaster >= -7 && daysFromEaster <= 1) {
    return HOLY_WEEK[daysFromEaster + 7];
  }
  if (date.getMonth() === 11 && date.getDate() >= 24 && date.getDate() <= 26) {
    return CHRISTMAS[date.getDate() - 24];
  }
  return DAILY_VERSES[(dayOfYear(date) - 1) % DAILY_VERSES.length]; // Feb 29 wraps
};
