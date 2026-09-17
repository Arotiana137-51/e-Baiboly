// `isIOS` is read once at module load, so each case loads the module fresh
// with Platform.OS already set.
const loadScale = (os: 'ios' | 'android') => {
  let mod: typeof import('../src/theme/responsive') | undefined;
  jest.isolateModules(() => {
    require('react-native').Platform.OS = os;
    mod = require('../src/theme/responsive');
  });
  return mod!;
};

describe('responsive scale', () => {
  it('keeps HIG point sizes on iOS regardless of screen width', () => {
    const {scale, verticalScale} = loadScale('ios');
    expect(scale(44, 320)).toBe(44);
    expect(scale(44, 430)).toBe(44);
    expect(verticalScale(56, 932)).toBe(56);
  });

  it('width-scales on Android, clamped to [0.85, 1.25]', () => {
    const {scale} = loadScale('android');
    expect(scale(44, 360)).toBe(42);
    expect(scale(44, 300)).toBe(37);
    expect(scale(44, 600)).toBe(55);
  });
});
