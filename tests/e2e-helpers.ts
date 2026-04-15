import type { Page } from '@playwright/test';

const E2E_AUTH_STORAGE_KEY = 'eu-david:e2e-auth-user';

export async function stubSignedInAuth(page: Page) {
  await page.addInitScript(
    ({ authStorageKey }) => {
      window.localStorage.setItem(
        authStorageKey,
        JSON.stringify({
          id: 'e2e-user-1',
          email: 'e2e@example.com',
          user_metadata: { username: 'E2E User' },
        })
      );
    },
    { authStorageKey: E2E_AUTH_STORAGE_KEY }
  );
}

export async function stubAuthAndCamera(page: Page) {
  await page.addInitScript(
    ({ authStorageKey }) => {
      window.localStorage.setItem(
        authStorageKey,
        JSON.stringify({
          id: 'e2e-user-1',
          email: 'e2e@example.com',
          user_metadata: { username: 'E2E User' },
        })
      );

      const cameraState = {
        getUserMediaCalls: 0,
        stopCalls: 0,
      };

      Object.defineProperty(window, '__cameraTestState', {
        value: cameraState,
        configurable: true,
      });

      const getUserMedia = async () => {
        cameraState.getUserMediaCalls += 1;

        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;

        const stream = canvas.captureStream();
        for (const track of stream.getTracks()) {
          const originalStop = track.stop.bind(track);
          track.stop = () => {
            cameraState.stopCalls += 1;
            originalStop();
          };
        }

        return stream;
      };

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia,
          enumerateDevices: async () => [],
        },
        configurable: true,
      });
    },
    { authStorageKey: E2E_AUTH_STORAGE_KEY }
  );
}

export async function readCameraState(page: Page) {
  return page.evaluate(
    () =>
      (
        window as Window & {
          __cameraTestState?: { getUserMediaCalls: number; stopCalls: number };
        }
      ).__cameraTestState
  );
}
