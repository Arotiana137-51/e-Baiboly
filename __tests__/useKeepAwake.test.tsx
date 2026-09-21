import React from 'react';
import {act, create} from 'react-test-renderer';
import {NativeModules} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useKeepAwake, setKeepScreenOn} from '../src/hooks/useKeepAwake';

let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));

const setEnabled = jest.fn();
NativeModules.KeepAwake = {setEnabled};

const Harness = () => {
  useKeepAwake();
  return null;
};

const flush = () => act(async () => {});

beforeEach(async () => {
  setEnabled.mockClear();
  mockFocused = true;
  await AsyncStorage.clear();
});

test('holds the screen while focused and releases it on unmount', async () => {
  let tree: ReturnType<typeof create> | undefined;
  await act(async () => {
    tree = create(<Harness />);
  });
  await flush();
  expect(setEnabled).toHaveBeenCalledWith(true);

  await act(async () => {
    tree!.unmount();
  });
  expect(setEnabled).toHaveBeenLastCalledWith(false);
});

test('does nothing while unfocused', async () => {
  mockFocused = false;
  await act(async () => {
    create(<Harness />);
  });
  await flush();
  expect(setEnabled).not.toHaveBeenCalled();
});

test('respects the stored opt-out', async () => {
  await setKeepScreenOn(false);
  await act(async () => {
    create(<Harness />);
  });
  await flush();
  expect(setEnabled).not.toHaveBeenCalledWith(true);
});
