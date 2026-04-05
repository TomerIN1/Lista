/**
 * PricePilot Extension Bridge
 *
 * Handles communication between the Lista web app and the PricePilot
 * Chrome extension via window.postMessage.
 *
 * Detection uses ping/pong since content scripts run in Chrome's isolated
 * world and cannot set window properties visible to the page.
 */

// Tools that require the Chrome extension (everything except search)
const BROWSER_TOOLS = new Set([
  'initialize_shopping_session',
  'open_rami_levy_browser',
  'start_login',
  'submit_otp',
  'check_auth_status',
  'read_cart',
  'add_items_to_cart',
  'clear_cart',
  'remove_cart_item',
  'verify_session_continuity',
  'generate_handoff',
]);

/** Cached detection result */
let _extensionDetected: boolean | null = null;

/**
 * Check if the PricePilot Chrome extension is installed.
 * Sends a PRICEPILOT_PING and waits for PRICEPILOT_PONG from the content script.
 * Caches the result after first successful detection.
 */
export async function detectExtension(timeoutMs = 1000): Promise<boolean> {
  if (_extensionDetected === true) return true;

  return new Promise<boolean>((resolve) => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PRICEPILOT_PONG') {
        window.removeEventListener('message', handler);
        clearTimeout(timer);
        _extensionDetected = true;
        resolve(true);
      }
    };

    window.addEventListener('message', handler);
    window.postMessage({ type: 'PRICEPILOT_PING' }, '*');

    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(false);
    }, timeoutMs);
  });
}

/**
 * Synchronous check — returns cached result. Use detectExtension() first.
 */
export function isExtensionInstalled(): boolean {
  return _extensionDetected === true;
}

/**
 * Check if a tool requires the Chrome extension.
 */
export function isBrowserTool(toolName: string): boolean {
  return BROWSER_TOOLS.has(toolName);
}

/**
 * Send a tool request to the Chrome extension via window.postMessage.
 */
export function sendToExtension(
  requestId: string,
  toolName: string,
  args: Record<string, unknown>,
): void {
  window.postMessage(
    {
      type: 'PRICEPILOT_TOOL_REQUEST',
      requestId,
      tool: toolName,
      args,
    },
    '*',
  );
}

/**
 * Listen for tool responses from the Chrome extension.
 * Returns an unsubscribe function.
 */
export function onExtensionResponse(
  callback: (requestId: string, result: any) => void,
): () => void {
  const handler = (event: MessageEvent) => {
    if (event.source !== window) return;
    if (event.data?.type === 'PRICEPILOT_TOOL_RESPONSE') {
      callback(event.data.requestId, event.data.result);
    }
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
