/**
 * PricePilot Extension — Lista Bridge Content Script
 */

console.log('[PricePilot lista_bridge] Content script loaded on:', window.location.href);

/**
 * Listen for messages from the Lista web app.
 */
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  // Extension detection: respond to ping
  if (event.data?.type === 'PRICEPILOT_PING') {
    console.log('[PricePilot lista_bridge] Received PING, sending PONG');
    window.postMessage({ type: 'PRICEPILOT_PONG' }, '*');
    return;
  }

  // Tool request: forward to background
  if (event.data?.type === 'PRICEPILOT_TOOL_REQUEST') {
    console.log('[PricePilot lista_bridge] Forwarding tool request to background:', event.data.tool, event.data.requestId);
    chrome.runtime.sendMessage({
      type: 'PRICEPILOT_TOOL_REQUEST',
      requestId: event.data.requestId,
      tool: event.data.tool,
      args: event.data.args,
    });
  }
});

/**
 * Listen for tool responses from the background service worker.
 */
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PRICEPILOT_TOOL_RESPONSE') {
    console.log('[PricePilot lista_bridge] Received tool response from background:', message.requestId, message.result?.status);
    window.postMessage({
      type: 'PRICEPILOT_TOOL_RESPONSE',
      requestId: message.requestId,
      result: message.result,
    }, '*');
  }
});
