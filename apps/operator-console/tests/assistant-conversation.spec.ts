import { expect, test } from '@playwright/test';
import {
  viewports,
  prepareAuthenticatedDashboard,
} from './helpers/responsiveShell';

test('Feature: Home conversation entry — Scenario: Given an empty conversation When an operator chooses a suggested request Then the same conversation flow sends it and replaces the welcome state', async ({ page }) => {
  await page.setViewportSize(viewports[2]);
  await prepareAuthenticatedDashboard(page);

  let conversationCalls = 0;
  let speechCalls = 0;
  await page.route('**/api/v1/assistant/tts', async (route) => {
    speechCalls += 1;
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/v1/assistant/converse', async (route) => {
    conversationCalls += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ type: 'answer', message: 'No hay luces encendidas en este momento.' }),
    });
  });

  await page.goto('/home-conversation');

  const emptyState = page.locator('.home-conversation-empty-state');
  const suggestions = page.locator('.home-conversation-suggestion');
  await expect(emptyState).toBeVisible();
  await expect(page.getByRole('heading', { name: /qué quieres hacer en casa|what would you like to do at home/i })).toBeVisible();
  await expect(suggestions).toHaveCount(3);

  const speechToggle = page.getByRole('button', { name: /lectura de respuestas activada|response reading enabled/i });
  await expect(speechToggle).toBeVisible();

  await suggestions.first().click();

  await expect.poll(() => conversationCalls).toBe(1);
  await expect.poll(() => speechCalls).toBe(1);
  await expect(page.getByText(/no hay luces encendidas/i)).toBeVisible();

  await speechToggle.click();
  await expect(page.getByRole('button', { name: /activar lectura de respuestas|enable response reading/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /activar lectura de respuestas|enable response reading/i })).toBeVisible();
  await expect(emptyState).toBeHidden();
  await expect(page.getByTestId('home-conversation-composer')).toBeVisible();
});

test('Feature: Conversation restoration — Scenario: Given a long saved conversation When the operator returns to the chat Then the newest turn and new-conversation control are immediately reachable', async ({ page }) => {
  await page.setViewportSize(viewports[2]);
  const messages = Array.from({ length: 28 }, (_, index) => ({
    id: `saved-message-${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `Mensaje guardado ${index + 1}: estado operativo de la casa.`,
    timestamp: `2026-08-21T12:${String(index).padStart(2, '0')}:00.000Z`,
  }));
  await page.addInitScript((savedMessages) => {
    sessionStorage.setItem('hp_home_conversation_v1:responsive-admin', JSON.stringify(savedMessages));
  }, messages);
  await prepareAuthenticatedDashboard(page);

  await page.goto('/home-conversation');

  const feed = page.locator('.home-conversation-feed');
  await expect(page.locator('.home-conversation-message')).toHaveCount(messages.length);
  await expect(page.getByRole('button', { name: /nueva conversación|new conversation/i })).toBeVisible();
  const scrollPosition = await feed.evaluate(element => element.scrollHeight - element.clientHeight - element.scrollTop);
  expect(scrollPosition).toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: /nueva conversación|new conversation/i }).click();
  await expect(page.locator('.home-conversation-empty-state')).toBeVisible();
});

test('Feature: Conversational confirmation — Scenario: Given a protected action When confirmation is required Then the resident can answer naturally without accept or reject buttons', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('hp_home_conversation_v1:responsive-admin', JSON.stringify([{
      id: 'confirmation-message',
      role: 'assistant',
      content: 'Encontré 2 luces encendidas. ¿Confirmas que quieres apagarlas?',
      timestamp: '2026-08-21T12:00:00.000Z',
      responseType: 'clarification',
      options: [
        { id: 'confirm', label: 'Sí, adelante' },
        { id: 'cancel', label: 'No, cancelar' },
      ],
    }]));
  });
  await prepareAuthenticatedDashboard(page);

  await page.goto('/home-conversation');

  await expect(page.getByText(/responde sí para continuar o no para cancelar|reply yes to continue or no to cancel/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sí, adelante' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'No, cancelar' })).toHaveCount(0);
});

for (const viewport of [viewports[0], viewports[2]]) {
  test(`Feature: Home conversation entry — Scenario: Given the ${viewport.name} layout When the welcome suggestions render Then they fit the viewport without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    await page.goto('/home-conversation');

    const suggestionsContainer = page.locator('.home-conversation-suggestions');
    const suggestions = page.locator('.home-conversation-suggestion');
    await expect(suggestionsContainer).toBeVisible();
    await expect(suggestions).toHaveCount(3);

    const layout = await page.evaluate(() => ({
      direction: getComputedStyle(document.querySelector('.home-conversation-suggestions')!).flexDirection,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(layout.direction).toBe(viewport.name === 'mobile' ? 'column' : 'row');
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  });
}

for (const viewport of viewports) {
  test(`Feature: Home conversation composer — Scenario: Given the ${viewport.name} shell When an operator focuses and writes a command Then the composer remains visible, reachable, and free of horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);

    await page.goto('/home-conversation');

    const composer = page.getByTestId('home-conversation-composer');
    const input = page.getByRole('textbox', { name: /dime algo|tell me something/i });
    const send = page.getByRole('button', { name: /enviar|send/i });

    await expect(composer).toBeVisible();
    await expect(input).toBeVisible();
    await input.focus();
    await expect(input).toBeFocused();
    await input.fill('Enciende la luz de la sala');
    await expect(send).toBeEnabled();

    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);

    const composerBox = await composer.boundingBox();
    expect(composerBox).not.toBeNull();
    expect((composerBox?.y ?? 0) + (composerBox?.height ?? 0)).toBeLessThanOrEqual(viewport.height + 1);
  });
}

test('Feature: Home conversation composer — Scenario: Given a mobile virtual keyboard When the visual viewport shrinks Then the composer remains available above the keyboard', async ({ page }) => {
  await page.setViewportSize(viewports[0]);
  await page.addInitScript(() => {
    const visualViewport = new EventTarget() as VisualViewport;
    Object.defineProperties(visualViewport, {
      height: { configurable: true, value: 410 },
      offsetTop: { configurable: true, value: 0 },
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });
  });
  await prepareAuthenticatedDashboard(page);

  await page.goto('/home-conversation');

  await page.evaluate(() => window.visualViewport?.dispatchEvent(new Event('resize')));

  const composer = page.getByTestId('home-conversation-composer');
  const conversation = page.locator('section.flex.h-full.w-full');
  const input = page.getByRole('textbox', { name: /dime algo|tell me something/i });

  await expect(composer).toBeVisible();
  await expect(conversation).toHaveAttribute('style', /height: calc\(100% - 310px\)/);
  await input.focus();
  await expect(input).toBeFocused();

  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
});

test('Feature: Manual voice capture — Scenario: Given an accepted recording When it is stopped Then HomePilot transcribes and submits it exactly once', async ({ page }) => {
  await page.addInitScript(() => {
    const track = {
      stop: () => undefined,
      addEventListener: () => undefined,
    };
    const stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => stream,
        enumerateDevices: async () => [{ deviceId: 'microphone-1', kind: 'audioinput', label: 'Test microphone' }],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: () => new Promise<void>(() => undefined),
      },
    });

    class FakeMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(...args: unknown[]) { void args; }

      start() {
        this.state = 'recording';
      }

      stop() {
        if (this.state !== 'recording') return;
        this.state = 'inactive';
        window.setTimeout(() => {
          this.ondataavailable?.({ data: new Blob(['accepted voice capture'], { type: this.mimeType }) });
          this.onstop?.();
        }, 0);
      }
    }

    class FakeAudioContext {
      createAnalyser() {
        return {
          fftSize: 0,
          getByteTimeDomainData: (samples: Uint8Array) => samples.fill(140),
        };
      }

      createMediaStreamSource() {
        return { connect: () => undefined };
      }

      close() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeMediaRecorder });
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext });
  });
  await prepareAuthenticatedDashboard(page);

  let transcriptionCalls = 0;
  let conversationCalls = 0;
  await page.route('**/api/v1/assistant/stt', async (route) => {
    transcriptionCalls += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ provider: 'whisper-local', transcript: 'apaga la luz de la sala' }),
    });
  });
  await page.route('**/api/v1/assistant/converse', async (route) => {
    conversationCalls += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ type: 'answer', message: 'Apagué la luz de la sala.' }),
    });
  });
  await page.route('**/api/v1/assistant/tts', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/home-conversation');
  const microphone = page.getByRole('button', { name: /talk to nezu|hablar con nezu/i });
  await expect(microphone).toBeVisible();
  await microphone.click();
  const stopRecording = page.getByRole('button', { name: /recording|grabando/i });
  await expect(stopRecording).toBeVisible();
  await stopRecording.click();

  await expect.poll(() => transcriptionCalls).toBe(1);
  await expect.poll(() => conversationCalls).toBe(1);
  await expect(page.getByText('Apagué la luz de la sala.')).toBeVisible();
  expect(transcriptionCalls).toBe(1);
  expect(conversationCalls).toBe(1);
});

test('Feature: Global wake activation — Scenario: Given one accepted Ok Nezu capture When it contains a command Then HomePilot transcribes, acknowledges, and submits it exactly once', async ({ page }) => {
  await page.addInitScript(() => {
    const track = {
      stop: () => undefined,
      addEventListener: () => undefined,
    };
    const stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
    };
    let recorderStarts = 0;
    let analyserFrames = 0;

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => stream,
        enumerateDevices: async () => [{ deviceId: 'microphone-1', kind: 'audioinput', label: 'Test microphone' }],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });

    class FakeMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(...args: unknown[]) { void args; }

      start() {
        this.state = 'recording';
        recorderStarts += 1;
        if (recorderStarts === 1) {
          window.setTimeout(() => this.stop(), 1000);
        }
      }

      stop() {
        if (this.state !== 'recording') return;
        this.state = 'inactive';
        window.setTimeout(() => {
          this.ondataavailable?.({ data: new Blob(['accepted wake capture'], { type: this.mimeType }) });
          this.onstop?.();
        }, 0);
      }
    }

    class FakeAudioContext {
      state = 'running';
      currentTime = 0;
      destination = {};

      createAnalyser() {
        return {
          fftSize: 0,
          getByteTimeDomainData: (samples: Uint8Array) => {
            samples.fill(analyserFrames++ < 20 ? 128 : 160);
          },
        };
      }

      createMediaStreamSource() {
        return { connect: () => undefined };
      }

      createGain() {
        const root = document.documentElement;
        root.dataset.wakeAcknowledgements = String(Number(root.dataset.wakeAcknowledgements || '0') + 1);
        return {
          gain: {
            setValueAtTime: () => undefined,
            exponentialRampToValueAtTime: () => undefined,
          },
          connect: () => undefined,
        };
      }

      createOscillator() {
        return {
          type: 'sine',
          frequency: { setValueAtTime: () => undefined },
          connect: () => undefined,
          start: () => undefined,
          stop: () => undefined,
        };
      }

      resume() {
        return Promise.resolve();
      }

      close() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeMediaRecorder });
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext });
  });
  await prepareAuthenticatedDashboard(page);

  let transcriptionCalls = 0;
  let conversationCalls = 0;
  await page.route('**/api/v1/assistant/stt', async (route) => {
    transcriptionCalls += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ provider: 'whisper-local', transcript: 'Ok Nezu apaga la luz de la sala' }),
    });
  });
  await page.route('**/api/v1/assistant/converse', async (route) => {
    conversationCalls += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ type: 'answer', message: 'Apagué la luz de la sala.' }),
    });
  });
  await page.route('**/api/v1/assistant/tts', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/');
  await expect.poll(() => transcriptionCalls).toBe(1);
  await expect.poll(() => conversationCalls).toBe(1);
  await expect.poll(() => page.locator('html').getAttribute('data-wake-acknowledgements')).toBe('1');
  expect(transcriptionCalls).toBe(1);
  expect(conversationCalls).toBe(1);
});

test('Feature: Voice confirmation follow-up — Scenario: Given a pending confirmation When the spoken prompt ends Then HomePilot captures one direct yes or no without a wake phrase', async ({ page }) => {
  await page.addInitScript(() => {
    const track = { stop: () => undefined, addEventListener: () => undefined };
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
    let recorderStarts = 0;
    let confirmationReplyCaptureRequested = false;
    window.addEventListener('homepilot:confirmation-listen', () => { confirmationReplyCaptureRequested = true; });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => stream,
        enumerateDevices: async () => [{ deviceId: 'microphone-1', kind: 'audioinput', label: 'Test microphone' }],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });

    class FakeMediaRecorder {
      static isTypeSupported() { return true; }
      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(...args: unknown[]) { void args; }

      start() {
        this.state = 'recording';
        recorderStarts += 1;
        document.documentElement.dataset.confirmationRecorderStarts = String(recorderStarts);
        if (confirmationReplyCaptureRequested) window.setTimeout(() => this.stop(), 1000);
      }

      stop() {
        if (this.state !== 'recording') return;
        this.state = 'inactive';
        window.setTimeout(() => {
          this.ondataavailable?.({ data: new Blob(['direct confirmation reply'], { type: this.mimeType }) });
          this.onstop?.();
        }, 0);
      }
    }

    class FakeAudioContext {
      createAnalyser() {
        return { fftSize: 0, getByteTimeDomainData: (samples: Uint8Array) => samples.fill(160) };
      }
      createMediaStreamSource() { return { connect: () => undefined }; }
      close() { return Promise.resolve(); }
    }

    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeMediaRecorder });
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext });
  });
  await prepareAuthenticatedDashboard(page);

  let transcriptionCalls = 0;
  let confirmationCalls = 0;
  await page.route('**/api/v1/assistant/stt', async (route) => {
    transcriptionCalls += 1;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ provider: 'whisper-local', transcript: 'sí' }) });
  });
  await page.route('**/api/v1/assistant/converse', async (route) => {
    confirmationCalls += 1;
    const body = route.request().postDataJSON() as { prompt?: string; interactionMode?: string };
    expect(body).toEqual(expect.objectContaining({ prompt: 'sí', interactionMode: 'voice' }));
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ type: 'execution', message: 'Acción completada.' }) });
  });

  await page.goto('/home-conversation');
  await expect.poll(async () => Number(await page.locator('html').getAttribute('data-confirmation-recorder-starts')) >= 1).toBeTruthy();
  await page.evaluate(() => window.dispatchEvent(new Event('homepilot:confirmation-listen')));

  await expect.poll(() => transcriptionCalls).toBe(1);
  await expect.poll(() => confirmationCalls).toBe(1);
  await expect(page.getByText('Acción completada.')).toBeVisible();
  expect(transcriptionCalls).toBe(1);
  expect(confirmationCalls).toBe(1);
});

test('Feature: Home conversation trust — Scenario: Given an empty session When the welcome state appears Then the operator sees concise contextual suggestions and a protected action cue', async ({ page }) => {
  await page.setViewportSize(viewports[2]);
  await prepareAuthenticatedDashboard(page);
  await page.goto('/home-conversation');

  await expect(page.getByRole('heading', { name: /qué quieres hacer en casa|what would you like to do at home/i })).toBeVisible();
  await expect(page.locator('.home-conversation-suggestion')).toHaveCount(3);
  await expect(page.locator('.home-conversation-suggestion--protected')).toHaveCount(1);
  await expect(page.getByText(/acciones protegidas|protected actions/i)).toHaveCount(0);
});

test('Feature: Home conversation continuity — Scenario: Given a local transcript When the page reloads Then the resident sees context and can deliberately start over', async ({ page }) => {
  await page.setViewportSize(viewports[2]);
  await prepareAuthenticatedDashboard(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('hp_home_conversation_v1:responsive-admin', JSON.stringify([
      {
        id: 'persisted-user-message',
        role: 'user',
        content: '¿Qué luces están encendidas?',
        timestamp: '2026-08-21T12:00:00.000Z'
      },
      {
        id: 'persisted-assistant-message',
        role: 'assistant',
        content: 'No hay luces encendidas.',
        responseType: 'answer',
        timestamp: '2026-08-21T12:00:01.000Z'
      }
    ]));
  });
  await page.goto('/home-conversation');

  await expect(page.getByText(/conversación activa|conversation active/i)).toBeVisible();
  await expect(page.getByText(/no hay luces encendidas/i)).toBeVisible();
  await page.getByRole('button', { name: /nueva conversación|new conversation/i }).click();
  await expect(page.locator('.home-conversation-empty-state')).toBeVisible();
});
