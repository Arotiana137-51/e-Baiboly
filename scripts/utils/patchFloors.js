// The oldest bundled DB a patch built today still fits, per target: the last
// version with a change no patch can carry (a new table, new or renumbered
// hymns). Raise it with such a change. build:patch lifts index.json's
// minBaseline to it when it writes the next patch, not before, so devices on
// older APKs keep the patches already published for them.

module.exports = {
  // Dictionary table (and the concordance's 20261016).
  bible: 20261021,
  // New FFPM/Fanampiny rows, FFPM 815-819 renumbered.
  hymns: 20261028,
};
