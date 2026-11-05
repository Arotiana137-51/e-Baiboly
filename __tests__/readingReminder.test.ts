/**
 * The launch re-arm must not add notifications while they are off: iOS 27
 * rejects the add ("Source is not authorized"), which flooded the report sheet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import {ensureRemindersScheduled} from '../src/services/reminders/readingReminder';

const slot = {id: 'morning', enabled: true, time: '07:00', frequency: 'daily'};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.setItem('settings.readingReminder.slots', JSON.stringify([slot]));
});

afterEach(async () => {
  await AsyncStorage.clear();
});

test('re-arms an enabled reminder when notifications are allowed', async () => {
  await ensureRemindersScheduled();
  expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1);
});

test('adds nothing while notifications are off', async () => {
  jest.mocked(notifee.getNotificationSettings).mockResolvedValueOnce({authorizationStatus: 0} as never);
  await ensureRemindersScheduled();
  expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
});
