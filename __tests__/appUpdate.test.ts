import {ASK_AGAIN_DAYS, shouldOffer} from '../src/utils/appUpdate';

const DAY = 24 * 60 * 60 * 1000;
const now = 100 * DAY;

describe('update prompt', () => {
  it('offers a waiting update nobody has answered yet', () => {
    expect(shouldOffer(31, null, now)).toBe(true);
  });

  it('offers nothing when Play has no update', () => {
    expect(shouldOffer(null, null, now)).toBe(false);
  });

  it('leaves the same version alone for a few days after an answer, then asks again', () => {
    const answered = {versionCode: 31, at: now - (ASK_AGAIN_DAYS - 1) * DAY};
    expect(shouldOffer(31, answered, now)).toBe(false);
    expect(shouldOffer(31, answered, now + 2 * DAY)).toBe(true);
  });

  it('offers a newer version at once, even right after answering the last one', () => {
    expect(shouldOffer(32, {versionCode: 31, at: now - DAY}, now)).toBe(true);
  });
});
