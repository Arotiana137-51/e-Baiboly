type TranslationKey =
  | 'tabs.bible'
  | 'tabs.hymns'
  | 'menu.favorites'
  | 'menu.history'
  | 'menu.search'
  | 'menu.misc'
  | 'menu.about'
  | 'menu.personalization'
  | 'menu.cultMode'
  | 'menu.notes'
  | 'notes.title'
  | 'notes.empty'
  | 'notes.removeTitle'
  | 'notes.removeMessage'
  | 'cultMode.title'
  | 'cultMode.activate'
  | 'cultMode.deactivate'
  | 'cultMode.intro'
  | 'cultMode.emptyState'
  | 'cultMode.addBible'
  | 'cultMode.addHymn'
  | 'cultMode.deleteTitle'
  | 'cultMode.deleteMessage'
  | 'cultMode.cannotActivateEmpty'
  | 'personalization.title'
  | 'personalization.subtitle'
  | 'personalization.reset'
  | 'personalization.brandBadge'
  | 'personalization.chooseColor'
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
  | 'search.placeholderBible'
  | 'search.placeholderHymns'
  | 'search.noResultsBible'
  | 'search.noResultsHymns'
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
  | 'actions.viewConcordance'
  | 'report.title'
  | 'report.reference'
  | 'report.text'
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
  | 'about.paperBibleNote'
  | 'bible.searchPlaceholder'
  | 'bible.oldTestament'
  | 'bible.newTestament'
  | 'bible.chaptersTitle'
  | 'bible.readerPrev'
  | 'bible.readerNext'
  | 'bible.readerTitle'
  | 'bible.booksTitle'
  | 'bible.openBooks'
  | 'bible.noResults'
  | 'bible.loading'
  | 'hymns.title'
  | 'hymns.homeTitle'
  | 'hymns.placeholder';

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
    'menu.personalization': 'Loko manokana',
    'menu.cultMode': 'Fotoam-pivavahana',
    'menu.notes': 'Ireo Naoty',
    'notes.title': 'Ireo Naoty',
    'notes.empty': 'Mbola tsy misy naoty',
    'notes.removeTitle': 'Esorina ny naoty',
    'notes.removeMessage': 'Tena esorina ve ity naoty ity?',
    'cultMode.title': 'Fotoam-pivavahana',
    'cultMode.activate': 'Velomy ny fotoana',
    'cultMode.deactivate': 'Ajanony',
    'cultMode.intro':
      'Ito dia fampidirana ny programam-pivavahana ka rehefa alahatrao mialoha eto ireo tokony ho vakianao mandritra ny fotoana dia tsy mila mikaroka boky/fihirana intsony ianao fa manindry ny teboka (prev, next) ery ambany fotsiny. Alaminao otrany ireny mandamina “Playlist” ireny izy ity mba hanamorana ny fampiasanao ny appli e-Baiboly mandritra ny fotoam-bavaka.',
    'cultMode.emptyState': "Mbola tsy misy zavatra eto. Ampio Baiboly na Fihirana.",
    'cultMode.addBible': 'Hampio Baiboly',
    'cultMode.addHymn': 'Hampio Fihirana',
    'cultMode.deleteTitle': 'Esorina',
    'cultMode.deleteMessage': "Tena esorina ao amin'ny lisitra ve ity?",
    'cultMode.cannotActivateEmpty': 'Ampio aloha ny zavatra ho hirahana.',
    'personalization.title': 'Loko manokana',
    'personalization.subtitle': "Safidio ny lokon'ny rindrina sy ny bokotra",
    'personalization.reset': 'Avereno tany am-boalohany',
    'personalization.brandBadge': 'Fisafidianana loko',
    'personalization.chooseColor': 'Fisafidianana loko',
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
    'search.placeholderBible': "Tadiavina ao @ Baiboly sy fihirana...",
    'search.placeholderHymns': 'Tadiavo ao amin\'ny fihirana...',
    'search.noResultsBible': "Tsy nahitana valiny tao amin'ny Baiboly",
    'search.noResultsHymns': "Tsy nahitana valiny tao amin'ny fihirana",
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
    'actions.viewConcordance': 'Jereo ny concordance',
    'report.title': 'Tatero',
    'report.reference': 'Tondro',
    'report.text': 'Lahatsoratra',
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
    'about.paperBibleNote': "Natao ity rindran-kajy ity hikarohana soratra masina sy hira an-kamehana. Fa amin'ny fotoana ilaina fifantohana ( adim-panahy, asa sy fampaherezana, sns...) dia asaina ianao ampiasa Baiboly taratasy.",
    'bible.searchPlaceholder': 'Tadiavo boky iray...',
    'bible.oldTestament': 'Testamenta taloha',
    'bible.newTestament': 'Testamenta vaovao',
    'bible.chaptersTitle': 'Toko',
    'bible.readerPrev': 'Aloha',
    'bible.readerNext': 'Manaraka',
    'bible.readerTitle': '{{book}} toko {{chapterText}}',
    'bible.booksTitle': 'Boky',
    'bible.openBooks': 'Hanokatra ny boky',
    'bible.noResults': 'Tsy misy valiny',
    'bible.loading': 'Mandrasa kely, eo am-pikarakarana...',
    'hymns.title': 'Fihirana',
    'hymns.homeTitle': 'Fihirana',
    'hymns.placeholder': ' eo am-panamboarana',
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
