import {useEffect, useState} from 'react';
import {Dimensions, Keyboard, Platform} from 'react-native';

// Height of the on-screen keyboard, 0 when it is hidden. Needed because the
// app is edge-to-edge on Android (targetSdk 36): the window no longer shrinks
// for the keyboard (adjustResize has no effect), so anything that must stay
// above it has to make room itself. iOS uses the "will" events so the layout
// moves together with the keyboard animation.
//
// Measured from the keyboard's top edge to the bottom of the screen rather
// than its reported height alone: an edge-to-edge window runs behind the
// navigation bar, which the reported height can leave out.
export const useKeyboardHeight = (): number => {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, e =>
      setHeight(
        Math.max(
          e.endCoordinates.height,
          Dimensions.get('screen').height - e.endCoordinates.screenY,
        ),
      ),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return height;
};
