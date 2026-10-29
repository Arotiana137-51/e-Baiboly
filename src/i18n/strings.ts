type TranslationKey =
  | 'tabs.bible'
  | 'tabs.hymns'
  | 'menu.favorites'
  | 'menu.history'
  | 'menu.search'
  | 'menu.misc'
  | 'menu.about'
  | 'menu.cultMode'
  | 'notes.title'
  | 'notes.empty'
  | 'notes.open'
  | 'notes.save'
  | 'notes.edit'
  | 'notes.placeholder'
  | 'notes.fromVerse'
  | 'notes.untilVerse'
  | 'notes.editedOn'
  | 'notes.deleted'
  | 'notes.undo'
  | 'notes.search'
  | 'notes.noResults'
  | 'notes.exportAll'
  | 'notes.exportTitle'
  | 'highlight.color'
  | 'highlight.bold'
  | 'highlight.italic'
  | 'highlight.underline'
  | 'highlight.erase'
  | 'actions.noteAdd'
  | 'actions.noteOpen'
  | 'actions.hymnNoteAdd'
  | 'actions.hymnNoteOpen'
  | 'cultMode.title'
  | 'cultMode.activate'
  | 'cultMode.deactivate'
  | 'cultMode.intro'
  | 'cultMode.emptyState'
  | 'cultMode.addBible'
  | 'cultMode.addHymn'
  | 'cultMode.summary'
  | 'cultMode.wholeChapter'
  | 'cultMode.verses'
  | 'personalization.title'
  | 'personalization.brandBadge'
  | 'personalization.firstRunWelcome'
  | 'personalization.firstRunDesc'
  | 'personalization.hint'
  | 'common.cancel'
  | 'common.close'
  | 'common.remove'
  | 'common.clear'
  | 'common.send'
  | 'font.increase'
  | 'font.decrease'
  | 'favorites.removeTitle'
  | 'favorites.removeMessage'
  | 'favorites.emptyBible'
  | 'favorites.emptyHymnal'
  | 'favorites.hymnLabel'
  | 'history.titleBible'
  | 'history.titleHymnal'
  | 'history.clearTitle'
  | 'history.clearMessage'
  | 'history.clearAll'
  | 'history.emptyBible'
  | 'history.emptyHymnal'
  | 'history.emptyAll'
  | 'history.filterAll'
  | 'search.placeholderBible'
  | 'search.noResultsBible'
  | 'search.resultCount'
  | 'search.categorized'
  | 'search.simple'
  | 'verseList.title'
  | 'verseList.searchLabel'
  | 'verseList.empty'
  | 'errors.bibleSearch'
  | 'errors.verseSearch'
  | 'errors.hymnSearch'
  | 'errors.fatalTitle'
  | 'errors.fatalMessage'
  | 'errors.fatalRetry'
  | 'actions.addToFavorites'
  | 'actions.report'
  | 'actions.reportQuestion'
  | 'actions.share'
  | 'actions.viewConcordance'
  | 'share.image'
  | 'share.colors'
  | 'share.background'
  | 'share.verseCount'
  | 'share.fewerVerses'
  | 'share.moreVerses'
  | 'share.prevPage'
  | 'share.nextPage'
  | 'report.title'
  | 'report.comment'
  | 'report.placeholder'
  | 'report.note'
  | 'about.sectionDeveloper'
  | 'about.sectionSupport'
  | 'about.sectionInfo'
  | 'about.sectionBestPractices'
  | 'about.developerRole'
  | 'about.developerLine3'
  | 'about.supportLine1'
  | 'about.supportLine2'
  | 'about.infoLinePlatforms'
  | 'about.bestPracticeLine1'
  | 'about.bestPracticeLine2'
  | 'about.bestPracticeLine3'
  | 'about.contribute'
  | 'about.links'
  | 'about.contactDeveloper'
  | 'about.phone'
  | 'about.website'
  | 'about.privacyPolicy'
  | 'about.open'
  | 'about.addLinksHint'
  | 'about.rateApp'
  | 'about.rateAppHint'
  | 'about.rateButton'
  | 'bible.oldTestament'
  | 'bible.newTestament'
  | 'dictionary.menu'
  | 'dictionary.title'
  | 'dictionary.search'
  | 'dictionary.empty'
  | 'dictionary.read'
  | 'dictionary.recent'
  | 'dictionary.seeAlso'
  | 'update.title'
  | 'update.body'
  | 'update.later'
  | 'update.go';

type TranslationParams = Record<string, string | number>;

type TranslationMap = Record<TranslationKey, string>;

type Translations = {
  fr: TranslationMap;
};

const translations: Translations = {
  fr: {
    'tabs.bible': 'Baiboly',
    'tabs.hymns': 'Fihirana',
    'menu.favorites': 'Ankafizina',
    'menu.history': 'Tsiahy',
    'menu.search': 'Fikarohana',
    'menu.misc': 'Fanekem-pinoana',
    'menu.about': 'Mombamomba',
    'menu.cultMode': 'Fotoam-pivavahana',
    'notes.title': 'Ireo Naoty',
    'notes.empty': 'Mbola tsy misy naoty',
    'notes.open': 'Vakio ny naoty',
    'notes.save': 'Tahirizo',
    'notes.edit': 'Ovay',
    'notes.placeholder': 'Soraty eto ny naotinao…',
    'notes.fromVerse': 'Andininy',
    'notes.untilVerse': "hatramin'ny",
    'notes.editedOn': 'Novaina {{date}}',
    'notes.deleted': 'Voafafa ny naoty',
    'notes.undo': 'Averina',
    'notes.search': "Hitady ao amin'ny naoty",
    'notes.noResults': 'Tsy misy naoty mifanaraka amin\'izany',
    'notes.exportAll': 'Zarao daholo',
    'notes.exportTitle': 'Ny naotiko — e-Baiboly',
    // The highlight bubble over selected words. Colours and B / I / U are
    // drawn; these name them for screen readers.
    'highlight.color': 'Loko',
    'highlight.bold': 'Gras',
    'highlight.italic': 'Italique',
    'highlight.underline': 'Souligné',
    'highlight.erase': 'Fafao',
    'actions.noteAdd': 'Hanoratra naoty',
    'actions.noteOpen': 'Jereo ny naoty',
    'actions.hymnNoteAdd': "Naoty momba ny hira",
    'actions.hymnNoteOpen': "Jereo ny naoty momba ny hira",
    'cultMode.title': 'Fotoam-pivavahana',
    'cultMode.activate': 'Velomy ny fotoana',
    'cultMode.deactivate': 'Ajanony',
    'cultMode.intro':
      'Ito dia fampidirana ny programam-pivavahana ka rehefa alahatrao mialoha eto ireo tokony ho vakianao mandritra ny fotoana dia tsy mila mikaroka boky/fihirana intsony ianao fa manindry ny teboka (prev, next) ery ambany fotsiny. Alaminao otrany ireny mandamina “Playlist” ireny izy ity mba hanamorana ny fampiasanao ny appli e-Baiboly mandritra ny fotoam-bavaka.',
    'cultMode.emptyState': "Ampio andinin'teny na hira",
    'cultMode.addBible': 'Ampio Baiboly',
    'cultMode.addHymn': 'Ampio Fihirana',
    'cultMode.summary': "{{bible}} andinin'teny · {{hymns}} hira",
    'cultMode.wholeChapter': 'Toko manontolo',
    'cultMode.verses': 'Andininy {{range}}',
    'personalization.title': 'Loko manokana',
    'personalization.brandBadge': 'Fisafidianana loko',
    'personalization.firstRunWelcome':
      "Tongasoa eto amin'ny e-Baiboly! Faly miarahaba anao izahay.",
    'personalization.firstRunDesc':
      "Safidio ny loko tianao ampiasaina ato anatin'ny e-Baiboly",
    'personalization.hint': 'Kitiho ny loko handrosoana',
    'common.cancel': 'Ajanony',
    'common.close': 'Hidio',
    'common.remove': 'Esory',
    'common.clear': 'Fafao',
    'common.send': 'Alefa',
    'font.increase': 'A+',
    'font.decrease': 'A-',
    'favorites.removeTitle': "Esorina ao amin'ny ankafizina",
    'favorites.removeMessage': "Tena esorina ao amin'ny ankafizina ve ity?",
    'favorites.emptyBible': "Tsy mbola misy andininy ankafizina",
    'favorites.emptyHymnal': "Tsy mbola misy fihirana ankafizina",
    'favorites.hymnLabel': 'Fihirana {{number}}',
    'history.titleBible': 'Tsiahy Baiboly',
    'history.titleHymnal': 'Tsiahy Fihirana',
    'history.clearTitle': 'Fafao ny tsiahy',
    'history.clearMessage': "Tena hofafana daholo ve ny tsiahy?",
    'history.clearAll': 'Fafao daholo',
    'history.emptyBible': "Tsy mbola misy tsiahy Baiboly",
    'history.emptyHymnal': "Tsy mbola misy tsiahy Fihirana",
    'history.emptyAll': 'Tsy mbola misy tsiahy',
    'history.filterAll': 'Rehetra',
    'search.placeholderBible': "Tadiavina ao @ Baiboly sy fihirana...",
    'search.noResultsBible': "Tsy nahitana valiny tao amin'ny Baiboly",
    'search.resultCount': '{{count}} valiny',
    // Shown as a pair in the "Fikarohana" header bar, so neither repeats it.
    'search.categorized': 'Isan-tsokajiny',
    'search.simple': 'Tsotra',
    'verseList.title': "Valin'ny fikarohana",
    'verseList.searchLabel': 'Fikarohana: "{{query}}"',
    'verseList.empty': "Tsy nahitana andininy ho an'ny \"{{query}}\" ao amin'ny {{book}}",
    'errors.bibleSearch': "Nisy olana teo am-pikarohana ao amin'ny Baiboly",
    'errors.verseSearch': "Nisy olana teo am-pikarohana andininy",
    'errors.hymnSearch': "Nisy olana teo am-pikarohana fihirana",
    'errors.fatalTitle': 'Nisy olana',
    'errors.fatalMessage': "Nisy zavatra tsy nety. Andramo averina.",
    'errors.fatalRetry': 'Avereno',
    'actions.addToFavorites': "Ampidiro ao amin'ny ankafizina",
    'actions.report': 'Tatero',
    // The verse sheet's quiet footer link, asked rather than ordered.
    'actions.reportQuestion': 'Misy diso?',
    // PLACEHOLDER MG copy — needs the app's own wording, not mine.
    'actions.share': 'Zarao',
    'actions.viewConcordance': 'Jereo ny concordance',
    // PLACEHOLDER MG copy — needs the app's own wording, not mine.
    // The share card's photo and "every colour" buttons, and the heading over
    // the colour grid.
    'share.image': 'Sary',
    'share.colors': 'Loko',
    'share.background': 'Fond',
    // Between the share card's - and + : how many verses (or hymn stanzas) it shows.
    'share.verseCount': '{{count}} andininy',
    // Read out by screen readers only: the - / + of the verse count and the
    // colour grid's arrows.
    'share.fewerVerses': 'Esory andininy iray',
    'share.moreVerses': 'Ampio andininy iray',
    'share.prevPage': 'Pejy teo aloha',
    'share.nextPage': 'Pejy manaraka',
    'report.title': 'Tatero',
    'report.comment': 'Fanamarihana',
    'report.placeholder': 'Farito ny olana tokony ahitsy...',
    'report.note': "Rehefa mandefa ianao dia alefa ny tondro, ny lahatsoratra miseho, ary ny fanamarihanao mba hanitsiana ny lesoka. Tsy misy angona momba ny toerana (localisation) angonina.",
    'about.sectionDeveloper': 'Mpamorona',
    'about.sectionSupport': 'Hanohana ny tetikasa',
    'about.sectionInfo': 'Fampahafantarana',
    'about.sectionBestPractices': 'Torohevitra',
    'about.developerRole': 'Mpamorona rindranasa',
    'about.developerLine3': "Aza misalasala mifandray amiko raha misy fanehoan-kevitra, bugs, na soso-kevitra.",
    'about.supportLine1': "Ity Application ity dia karakaraina sy hatsaraina amin'ny fotoanako malalaka.",
    'about.supportLine2': "Tena ilaina ny fanampianao ahafahana mitazona ny application ho azon'ny rehetra, ary ny fanampiana ara-bola ataonao dia andoavana ny droits App Store sy ireo hetra sy haba mety hiseho isaky ny firenena ampiasana ny application. Mandraisa anjara amin'ny.",
    'about.infoLinePlatforms': 'Misy amin\'ny Android sy iOS.',
    'about.bestPracticeLine1': "Ataovy 'Mise à jour matetika ny Application mba hahazoana fanitsiana sy fanamboarana.",
    'about.bestPracticeLine2': "Lazao ny lesoka na tsy fitoviana amin'ny alalan'ny bokotra Tatero.",
    'about.bestPracticeLine3': "Hajao ny privacy policy: jereo ny politika raha ilaina.",
    'about.contribute': 'Handray anjara',
    'about.links': 'Rohy',
    'about.contactDeveloper': 'Hifandray amin\'ny mpamorona',
    'about.phone': 'Finday',
    'about.website': 'Tranonkala',
    'about.privacyPolicy': 'Privacy Policy',
    'about.open': 'Sokafy',
    'about.addLinksHint': "Ampidiro ny rohy (email/tranonkala/privacy policy) ato amin'ity pejy ity.",
    // PLACEHOLDER MG copy — needs the app's own wording, not mine.
    'about.rateApp': 'Omeo naoty ny application',
    'about.rateAppHint': 'Manampy be ny naoty omenao',
    'about.rateButton': 'Hanome naoty',
    'bible.oldTestament': 'Testamenta taloha',
    'bible.newTestament': 'Testamenta vaovao',
    // The book's own title, Evans & Randzavola 1952.
    'dictionary.title': "Diksionera amin'ny Baiboly",
    'dictionary.menu': 'Diksionera',
    'dictionary.search': 'Tadiavina...',
    'dictionary.empty': 'Tsy nahitana valiny',
    'dictionary.read': 'Vakio',
    'dictionary.recent': 'Vao nojerena',
    // The book's own "see also" wording.
    'dictionary.seeAlso': 'Jereo koa',
    // Android only: the Play update prompt.
    'update.title': 'Misy version vaovao',
    'update.body': "Misy fanavaozana ny e-Baiboly ao amin'ny Play Store.",
    'update.later': 'Avy eo',
    'update.go': 'Havaozina',
  },
};

const defaultLocale: keyof Translations = 'fr';

export const t = (key: TranslationKey, params?: TranslationParams): string => {
  const template = translations[defaultLocale][key] ?? key;
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce(
    (acc, [paramKey, value]) => acc.replace(`{{${paramKey}}}`, String(value)),
    template
  );
};

export type { TranslationKey };
