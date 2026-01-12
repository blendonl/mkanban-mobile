import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

const FILE_WATCHER_TASK_NAME = 'FILE_WATCHER_TASK';

export async function registerBackgroundFileWatcherTask(
  forceCheckCallback: () => Promise<void>
): Promise<void> {
  try {
    TaskManager.defineTask(FILE_WATCHER_TASK_NAME, async () => {
      try {
        await forceCheckCallback();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (error) {
        console.error('Background file watcher task error:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });

    const isRegistered = await TaskManager.isTaskRegisteredAsync(FILE_WATCHER_TASK_NAME);

    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(FILE_WATCHER_TASK_NAME, {
        minimumInterval: 15 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });

      console.log('Background file watcher task registered');
    } else {
      console.log('Background file watcher task already registered');
    }
  } catch (error) {
    console.error('Failed to register background file watcher task:', error);
  }
}

export async function unregisterBackgroundFileWatcherTask(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(FILE_WATCHER_TASK_NAME);
    console.log('Background file watcher task unregistered');
  } catch (error) {
    console.error('Failed to unregister background file watcher task:', error);
  }
}

export async function getBackgroundFileWatcherTaskStatus(): Promise<BackgroundFetch.BackgroundFetchStatus | null> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    return status;
  } catch (error) {
    console.error('Failed to get background fetch status:', error);
    return null;
  }
}
