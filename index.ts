import { registerRootComponent } from 'expo';
import { Buffer } from 'buffer';

(global as any).Buffer = Buffer;

if (typeof (global as any).requestIdleCallback === 'undefined') {
  (global as any).requestIdleCallback = (cb: IdleRequestCallback, options?: IdleRequestOptions) => {
    const start = Date.now();
    return setTimeout(() => {
      cb({
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
      });
    }, 1);
  };

  (global as any).cancelIdleCallback = (id: number) => {
    clearTimeout(id);
  };
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
