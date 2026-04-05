# PricePilot Chrome Extension

## What Is This

A Chrome extension that connects the Lista shopping app to supermarket websites. It executes shopping automation tools (read cart, add items, remove items, login, checkout) in the user's real browser session, giving the cloud agent full control over the user's cart.

## Why an Extension

Supermarket websites (starting with Rami Levy) use HttpOnly cookies (`cf_clearance`) for session identity. These cookies cannot be read or transferred by JavaScript — they are automatically attached to requests made from the same origin. A headless browser on a cloud server is treated as a separate device, so it can only add items but cannot remove, update, or clear the cart.

The extension runs **inside** the user's browser, on the supermarket's domain. Every `fetch()` call includes all cookies automatically. Full cart control works.

## How It Works

### For the User

1. Install the extension from Chrome Web Store (one time)
2. Open Lista, create a shopping list, click "Build Cart at רמי לוי"
3. The agent chats with you, searches products, and builds your cart
4. You see items appear in your real Rami Levy cart
5. Continue to checkout on the Rami Levy tab

### For Developers

The extension is a message router between the Lista frontend and the supermarket page:

```
Lista app → postMessage → lista_bridge.js → chrome.runtime → background.js
    → chrome.scripting.executeScript({world: 'MAIN'}) → supermarket page
    → result → background.js → chrome.tabs.sendMessage → lista_bridge.js
    → postMessage → Lista app → POST /api/tool-response → cloud agent resumes
```

All tool execution happens in `background.js` using `chrome.scripting.executeScript` with `world: 'MAIN'`. This:
- Bypasses CSP restrictions on the supermarket page
- Gives direct access to `window.$nuxt`, `localStorage`, `fetch()`
- Includes all cookies (HttpOnly included) in fetch requests

## Extension Detection

The Lista frontend detects the extension using postMessage ping/pong:

```javascript
// Lista sends:
window.postMessage({ type: 'PRICEPILOT_PING' }, '*');

// lista_bridge.js (content script) responds:
window.postMessage({ type: 'PRICEPILOT_PONG' }, '*');
```

Content scripts run in Chrome's isolated world, so they cannot set `window` properties visible to the page. Ping/pong via postMessage is the reliable detection method.

## Adding a New Supermarket

To add support for a new supermarket (e.g., Shufersal):

1. **manifest.json**: Add URL patterns to `content_scripts` and `host_permissions`
2. **background.js**: Add tool handler functions for the new store (e.g., `handleShufersal_ReadCart`)
3. **Tool routing**: Map tool names to the correct store's handlers based on context

The extension architecture is store-agnostic at the messaging layer. Only the tool handlers are store-specific.

## Permissions Explained

| Permission | Why |
|-----------|-----|
| `tabs` | Find existing supermarket tabs, track tab IDs |
| `scripting` | `chrome.scripting.executeScript` to run code in page context |
| `activeTab` | Fallback permission for user-initiated actions |
| `host_permissions: rami-levy.co.il` | Allow script execution on Rami Levy pages |
| `host_permissions: localhost, vercel.app` | Content script injection on Lista pages |

## Development

### Load Unpacked (Development)

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `pricepilot_extension/` directory

### After Code Changes

1. Go to `chrome://extensions`
2. Click the refresh icon on PricePilot
3. Close and reopen all Rami Levy and Lista tabs (content scripts need fresh injection)

### Debugging

- **Extension errors**: `chrome://extensions` → click "Errors" on PricePilot
- **Background logs**: `chrome://extensions` → click "service worker" link → opens DevTools for background.js
- **Content script logs**: Open DevTools on the Lista page → Console → filter by `[PricePilot`
- **Server logs**: Check the PricePilot server terminal for `browser_bridge` log lines

## Publishing to Chrome Web Store

1. Create a developer account ($5 one-time fee) at https://chrome.google.com/webstore/devconsole
2. Create a ZIP of the `pricepilot_extension/` directory
3. Upload with description, screenshots, and privacy policy
4. Privacy policy must explain: what data is accessed (cart contents, auth state), why (to automate shopping), and that no data leaves the user's browser except tool results sent to the PricePilot API
5. Review typically takes 1-3 business days

## Limitations

- **Desktop only**: Chrome extensions don't exist on mobile browsers
- **Chrome/Edge only**: Works on Chromium-based browsers. Firefox would need a separate WebExtension port.
- **User must install**: One-time friction, but required
- **Tab must be open**: The supermarket tab must be open (the extension opens one automatically if needed)
