import {thumbFor} from '../src/components/ScrollViewWithThumb';

describe('thumbFor', () => {
  it('draws no thumb when everything fits', () => {
    expect(thumbFor(400, 400)).toEqual({height: 0, travel: 0});
    expect(thumbFor(400, 300)).toEqual({height: 0, travel: 0});
  });

  it('sizes the thumb by the share of the content in view', () => {
    // A 408pt view keeps a 400pt track; half the content in view, half the track.
    expect(thumbFor(408, 816)).toEqual({height: 200, travel: 200});
  });

  it('keeps a long list thumb big enough to see', () => {
    expect(thumbFor(408, 100000).height).toBe(28);
  });
});
