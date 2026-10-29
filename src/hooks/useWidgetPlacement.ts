import {useCallback, useEffect, useState} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {canPinWidget, isWidgetPlaced} from '../services/widget/dailyVerseWidget';

// Whether the app can add the widget for the person (Android launchers that
// support it) and whether it is on the home screen. Widgets are added and
// removed outside the app, so it is asked again on focus and each time the app
// comes back to the front (the launcher's "add?" card puts the app behind it).
export const useWidgetPlacement = (): {canPin: boolean; placed: boolean} => {
  const [placement, setPlacement] = useState({canPin: false, placed: false});

  const check = useCallback(() => {
    Promise.all([canPinWidget(), isWidgetPlaced()]).then(
      ([canPin, placed]) => setPlacement({canPin, placed}),
      () => setPlacement({canPin: false, placed: false}),
    );
  }, []);

  useFocusEffect(check);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  return placement;
};
