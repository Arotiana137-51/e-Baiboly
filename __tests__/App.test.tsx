/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import PrivacyPolicyScreen from '../src/screens/PrivacyPolicyScreen';

// Without native insets the real SafeAreaProvider renders nothing under Jest,
// and this test used to pass on an empty tree.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

test('a fresh install mounts every provider and opens on the privacy policy', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  for (let i = 0; i < 10; i += 1) {
    await ReactTestRenderer.act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  }
  expect(tree!.root.findAllByType(PrivacyPolicyScreen)).toHaveLength(1);
  ReactTestRenderer.act(() => tree!.unmount());
});
