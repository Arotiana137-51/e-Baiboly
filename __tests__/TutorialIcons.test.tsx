/**
 * Guards the drawn quest-log icons: every tutorial in the registry must map to
 * a real icon, and the triangle pieces (church roof, rocket fins, pen tip) must
 * keep their transparent side borders — that's what makes the RN border-trick
 * render as a triangle instead of a solid box.
 */
import React from 'react';
import {act, create} from 'react-test-renderer';
import {View} from 'react-native';
import {TutorialIcon, type TutorialIconName} from '../src/components/TutorialIcons';
import {TUTORIALS} from '../src/tutorials/registry';

const NAMES: TutorialIconName[] = ['rocket', 'church', 'highlighter', 'note'];

// Flatten every View's resolved style into one list.
const stylesOf = (name: TutorialIconName) => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<TutorialIcon name={name} color="#004E64" backgroundColor="#FBF3E6" />);
  });
  return tree.root
    .findAllByType(View)
    .map(node => node.props.style)
    .flat(Infinity)
    .filter(Boolean) as Record<string, unknown>[];
};

test.each(NAMES)('%s triangles keep transparent side borders', name => {
  const triangles = stylesOf(name).filter(s => s.borderLeftWidth || s.borderRightWidth);
  expect(triangles.length).toBeGreaterThan(0);
  for (const t of triangles) {
    expect(t.borderLeftColor).toBe('transparent');
    expect(t.borderRightColor).toBe('transparent');
    // A triangle needs zero box size, else it draws as a bordered rectangle.
    expect(t.width).toBe(0);
    expect(t.height).toBe(0);
  }
});

test('every tutorial maps to an icon that actually draws', () => {
  for (const tu of TUTORIALS) {
    expect(NAMES).toContain(tu.icon);
    expect(stylesOf(tu.icon).length).toBeGreaterThan(1);
  }
});
