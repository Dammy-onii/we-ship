import type * as NotificationsModule from 'expo-notifications';
import type * as TaskManagerModule from 'expo-task-manager';

import { fetchFriendPosts } from './backend/friends';
import { fetchLiveSnapshot } from './backend/repository';
import { requireSupabase } from './backend/supabase';
import { loadNativeModule } from './native-modules';
import { buildWidgetSnapshot } from './widget-snapshot';
import { syncWidgetSnapshot } from '@/widgets';

const TASK_NAME = 'weship-background-widget-refresh';

// Task definitions must run at module scope so the headless JS launch can find
// them. The guarded require keeps web, Expo Go, and stale native builds safe.
const TaskManager = loadNativeModule<typeof TaskManagerModule>(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-task-manager');
});

if (TaskManager && !TaskManager.isTaskDefined(TASK_NAME)) {
  TaskManager.defineTask(TASK_NAME, async ({ error }) => {
    if (error) return 2;
    try {
      const { data } = await requireSupabase().auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return 1;
      const [snapshot, friendPosts] = await Promise.all([
        fetchLiveSnapshot(userId),
        fetchFriendPosts(userId),
      ]);
      if (!snapshot?.rawPartnerId) return 1;
      const me = snapshot.users.you;
      const partner = snapshot.users.partner;
      const widgetSnapshot = await buildWidgetSnapshot({
        me,
        partner,
        space: snapshot.space,
        presence: snapshot.presences.find((item) => item.userId === 'partner') ?? {
          userId: 'partner',
          mood: 'calm',
          updatedAt: new Date().toISOString(),
        },
        question: snapshot.today,
        habits: snapshot.habits,
        todayLog: snapshot.log[0],
        goodies: snapshot.goodies,
        friendPosts,
        meId: 'you',
        partnerId: 'partner',
      });
      syncWidgetSnapshot(widgetSnapshot);
      return 0;
    } catch {
      return 2;
    }
  });
}

export async function registerBackgroundWidgetRefresh(
  Notifications: typeof NotificationsModule,
) {
  if (!TaskManager) return;
  const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (!registered) await Notifications.registerTaskAsync(TASK_NAME);
}
