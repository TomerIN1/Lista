/**
 * Minimal content script on rami-levy.co.il.
 * Just responds to pings so background.js knows the tab has a content script.
 */
console.log('[PricePilot] Rami Levy keepalive loaded on:', window.location.href);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING_TAB') {
    sendResponse({ ok: true });
  }
});
