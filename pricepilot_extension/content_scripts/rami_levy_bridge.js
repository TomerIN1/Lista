/**
 * PricePilot Extension — Rami Levy Bridge Content Script
 *
 * Injected on rami-levy.co.il. Receives tool requests from the background
 * service worker and executes them in the page's JavaScript context.
 */

console.log('[PricePilot RL bridge] Content script loaded on:', window.location.href);

/**
 * Execute JavaScript in the page's main world (where $nuxt lives).
 */
function executeInPageContext(code) {
  return new Promise((resolve, reject) => {
    const responseId = 'pp_' + Math.random().toString(36).slice(2);
    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('Page context execution timed out (30s)'));
    }, 30000);

    function handler(event) {
      if (event.data?.ppResponseId === responseId) {
        window.removeEventListener('message', handler);
        clearTimeout(timeoutId);
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result);
        }
      }
    }

    window.addEventListener('message', handler);

    const script = document.createElement('script');
    script.textContent = `
      (async () => {
        try {
          const result = await (${code})();
          window.postMessage({ ppResponseId: '${responseId}', result }, '*');
        } catch(e) {
          window.postMessage({ ppResponseId: '${responseId}', error: e.message }, '*');
        }
      })();
    `;
    document.documentElement.appendChild(script);
    script.remove();
  });
}

// ============================================
// Tool Handlers
// ============================================

const TOOL_HANDLERS = {
  check_auth: handleCheckAuth,
  initialize_session: handleInitializeSession,
  read_cart: handleReadCart,
  add_items_to_cart: handleAddItems,
  clear_cart: handleClearCart,
  remove_cart_item: handleRemoveItem,
  start_login: handleStartLogin,
  submit_otp: handleSubmitOtp,
  verify_session: handleVerifySession,
  go_to_checkout: handleGoToCheckout,
};

async function handleCheckAuth() {
  console.log('[PricePilot RL bridge] handleCheckAuth');
  const auth = await executeInPageContext(`() => {
    try {
      const data = JSON.parse(localStorage.getItem('ramilevy') || '{}');
      const user = data && data.authuser && data.authuser.user ? data.authuser.user : null;
      return {
        authenticated: !!(user && user.token),
        email: user && user.email ? String(user.email) : '',
      };
    } catch(e) {
      return { authenticated: false, email: '' };
    }
  }`);

  return {
    status: 'success',
    authenticated: auth.authenticated,
    email: auth.email,
    message: auth.authenticated
      ? 'User is authenticated.'
      : 'User is NOT authenticated. Login required.',
  };
}

async function handleInitializeSession() {
  console.log('[PricePilot RL bridge] handleInitializeSession');
  const auth = await handleCheckAuth();

  if (!auth.authenticated) {
    return {
      status: 'partial',
      authenticated: false,
      email: auth.email,
      cart: { status: 'skipped', items: [], item_count: 0 },
      needs_login: true,
      message: 'Browser is ready, but the user is not authenticated yet. Ask for the Rami Levy email address and continue with the OTP flow.',
    };
  }

  const cart = await handleReadCart();
  return {
    status: 'success',
    authenticated: true,
    email: auth.email,
    cart: {
      status: cart.status,
      items: cart.items || [],
      item_count: cart.item_count || 0,
      message: cart.message || '',
    },
    message: 'Browser is ready, the user is authenticated, and the current cart was loaded.',
  };
}

async function handleReadCart() {
  console.log('[PricePilot RL bridge] handleReadCart');
  const items = await executeInPageContext(`() => {
    try {
      if (window.$nuxt && window.$nuxt.$store && window.$nuxt.$store.state.cart) {
        const cart = window.$nuxt.$store.state.cart;
        if (cart.items && Array.isArray(cart.items)) {
          return cart.items
            .filter(i => !i.is_delivery && i.name !== 'מחיר משלוח')
            .map(i => {
              const isWeighted = !!(i.prop && (i.prop.sw_shakil || i.prop.by_kilo));
              const amount = i.amount || 1;
              const multiplication = i.multiplication || 1;
              return {
                id: i.id,
                name: i.name || '',
                barcode: i.barcode || '',
                amount: amount,
                multiplication: multiplication,
                is_weighted: isWeighted,
                quantity_display: isWeighted
                  ? amount + ' ק"ג'
                  : amount + ' יחידות',
                price: i.price && i.price.price ? i.price.price : (typeof i.price === 'number' ? i.price : 0),
                total_price: i.price && i.price.finalPrice ? i.price.finalPrice : (i.sumPrice || 0),
              };
            });
        }
      }
      return [];
    } catch(e) { return []; }
  }`);

  return {
    status: 'success',
    items: items,
    item_count: items.length,
    message: items.length > 0 ? 'Cart has ' + items.length + ' item(s).' : 'Cart is empty.',
  };
}

async function handleAddItems(args) {
  console.log('[PricePilot RL bridge] handleAddItems:', args);
  const items = args.items;
  if (!items || typeof items !== 'object') {
    return { status: 'error', message: 'items is required.' };
  }

  const sessionData = await executeInPageContext(`() => {
    try {
      const token = JSON.parse(localStorage.getItem('ramilevy')).authuser.user.token;
      let storeId = '';
      if (window.$nuxt && window.$nuxt.$store && window.$nuxt.$store.state.cart) {
        storeId = String(window.$nuxt.$store.state.cart.storeId || '');
      }
      return { token, storeId: storeId || '331' };
    } catch(e) { return { token: null, storeId: '331' }; }
  }`);

  if (!sessionData.token) {
    return { status: 'error', message: 'No auth token. Login required.' };
  }

  const tomorrow = new Date(Date.now() + 86400000).toISOString().replace(/T.*/, 'T00:00:00.000Z');
  const itemsStr = JSON.stringify(items);
  const token = sessionData.token;
  const storeId = sessionData.storeId;

  const result = await executeInPageContext(`() => {
    return fetch('/api/v2/cart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'locale': 'he',
        'Accept': 'application/json, text/plain, */*',
        'Authorization': 'Bearer ' + ${JSON.stringify(token)},
        'ecomtoken': ${JSON.stringify(token)},
      },
      body: JSON.stringify({
        store: ${JSON.stringify(storeId)},
        isClub: 0,
        supplyAt: ${JSON.stringify(tomorrow)},
        items: ${itemsStr},
        meta: null,
      }),
    })
    .then(r => r.json())
    .then(data => {
      const cartItems = (data.items || [])
        .filter(i => !i.is_delivery && !(i.name || '').includes('משלוח'))
        .map(i => ({ id: i.id, name: i.name || '', qty: i.quantity || 1 }));
      return { ok: true, cart_items: cartItems, cart_count: cartItems.length };
    })
    .catch(e => ({ ok: false, error: e.message }));
  }`);

  if (result.ok) {
    return {
      status: 'success',
      items_added: items,
      cart_items: result.cart_items,
      cart_count: result.cart_count,
      message: 'Added ' + Object.keys(items).length + ' product(s). Cart now has ' + result.cart_count + ' items.',
    };
  }
  return { status: 'error', message: 'Failed to add items: ' + (result.error || 'unknown') };
}

async function handleClearCart() {
  console.log('[PricePilot RL bridge] handleClearCart');
  const result = await executeInPageContext(`async () => {
    try {
      if (window.$nuxt && window.$nuxt.$api && window.$nuxt.$api.cart &&
          typeof window.$nuxt.$api.cart.deleteCart === 'function') {
        await window.$nuxt.$api.cart.deleteCart();
        return { ok: true };
      }
      return { ok: false, error: 'deleteCart not available' };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  }`);

  if (result.ok) {
    return { status: 'success', message: 'Cart cleared. Call read_cart to verify.' };
  }
  return { status: 'error', message: 'Clear cart failed: ' + result.error };
}

async function handleRemoveItem(args) {
  const pid = String(args.product_id);
  console.log('[PricePilot RL bridge] handleRemoveItem:', pid);
  if (!pid) return { status: 'error', message: 'product_id is required.' };

  const pidStr = JSON.stringify(pid);

  const cartData = await executeInPageContext(`() => {
    try {
      const cart = window.$nuxt.$store.state.cart;
      if (!cart || !cart.items) return { items: {}, removeQty: '1.00' };
      const items = {};
      let removeQty = '1.00';
      for (const item of cart.items) {
        const id = String(item.id);
        const amount = item.amount || 1;
        if (id === ${pidStr}) {
          removeQty = amount.toFixed(2);
        } else {
          items[id] = amount.toFixed(2);
        }
      }
      return { items, removeQty };
    } catch(e) { return { items: {}, removeQty: '1.00' }; }
  }`);

  if (!Object.keys(cartData.items).length) {
    return { status: 'error', message: 'Cart is empty or could not read cart items.' };
  }

  const payloadItems = { ...cartData.items };
  payloadItems[pid] = '-' + cartData.removeQty;

  const sessionData = await executeInPageContext(`() => {
    try {
      const token = JSON.parse(localStorage.getItem('ramilevy')).authuser.user.token;
      let storeId = '';
      if (window.$nuxt && window.$nuxt.$store && window.$nuxt.$store.state.cart) {
        storeId = String(window.$nuxt.$store.state.cart.storeId || '');
      }
      return { token, storeId: storeId || '331' };
    } catch(e) { return { token: null, storeId: '331' }; }
  }`);

  if (!sessionData.token) {
    return { status: 'error', message: 'No auth token. Login required.' };
  }

  const tomorrow = new Date(Date.now() + 86400000).toISOString().replace(/T.*/, 'T00:00:00.000Z');
  const token = sessionData.token;
  const storeId = sessionData.storeId;
  const payloadStr = JSON.stringify(payloadItems);

  const result = await executeInPageContext(`() => {
    return fetch('/api/v2/cart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'locale': 'he',
        'Accept': 'application/json, text/plain, */*',
        'Authorization': 'Bearer ' + ${JSON.stringify(token)},
        'ecomtoken': ${JSON.stringify(token)},
      },
      body: JSON.stringify({
        store: ${JSON.stringify(storeId)},
        isClub: 0,
        supplyAt: ${JSON.stringify(tomorrow)},
        items: ${payloadStr},
        meta: null,
      }),
    })
    .then(r => r.json())
    .then(data => {
      const remaining = (data.items || [])
        .filter(i => !i.is_delivery && !(i.name || '').includes('משלוח'))
        .map(i => ({ id: i.id, name: i.name || '', qty: i.quantity }));
      const removed = !remaining.some(i => String(i.id) === ${pidStr});
      return { ok: true, remaining, removed };
    })
    .catch(e => ({ ok: false, error: e.message }));
  }`);

  if (result.ok) {
    return {
      status: result.removed ? 'success' : 'warning',
      removed_id: pid,
      remaining_items: result.remaining,
      message: result.removed
        ? 'Item ' + pid + ' removed. Cart now has ' + result.remaining.length + ' items.'
        : 'Item ' + pid + ' may not have been removed. Check with read_cart.',
    };
  }
  return { status: 'error', message: 'Failed to remove item: ' + (result.error || 'unknown') };
}

async function handleStartLogin(args) {
  const email = args.email;
  console.log('[PricePilot RL bridge] handleStartLogin:', email);
  if (!email) return { status: 'error', message: 'Email is required.' };

  await executeInPageContext(`() => {
    window.$nuxt.$root.$emit('OpenLoginModal');
  }`);
  await sleep(2000);

  const emailInput = document.querySelector(
    'input[type="email"], input[type="tel"], input[placeholder*="מייל"], input[placeholder*="email"], input[placeholder*="אימייל"]'
  );
  if (!emailInput) {
    return { status: 'error', message: 'Could not find email input field.' };
  }

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  nativeInputValueSetter.call(emailInput, email);
  emailInput.dispatchEvent(new Event('input', { bubbles: true }));
  emailInput.dispatchEvent(new Event('change', { bubbles: true }));

  await sleep(500);

  const buttons = document.querySelectorAll('button');
  let clicked = false;
  for (const btn of buttons) {
    const text = btn.textContent || '';
    if (text.includes('שלח') || text.includes('התחברות') || text.includes('המשך')) {
      btn.click();
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    const form = emailInput.closest('form');
    if (form) form.submit();
  }

  await sleep(3000);

  const smsBtn = findElementByText('הודעת SMS');
  if (smsBtn) {
    smsBtn.click();
    await sleep(1000);
    const sendCodeBtn = findElementByText('שלח קוד אימות') || findElementByText('שלח קוד') || findElementByText('שלח');
    if (sendCodeBtn) sendCodeBtn.click();
    await sleep(3000);
  }

  const otpInput = document.querySelector('input[placeholder*="קוד"], input[maxlength="6"], input[maxlength="1"]');

  return {
    status: otpInput ? 'success' : 'partial',
    message: otpInput
      ? 'OTP code sent via SMS. Ask the user for the 6-digit code.'
      : 'Email submitted but OTP field not detected. The code may still arrive.',
    otp_sent: !!otpInput,
  };
}

async function handleSubmitOtp(args) {
  const code = (args.otp_code || '').trim();
  console.log('[PricePilot RL bridge] handleSubmitOtp, code length:', code.length);
  if (!code) return { status: 'error', message: 'OTP code is required.' };

  let entered = false;
  const singleInput = document.querySelector('input[placeholder*="קוד"], input[maxlength="6"]');
  if (singleInput) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(singleInput, code);
    singleInput.dispatchEvent(new Event('input', { bubbles: true }));
    singleInput.dispatchEvent(new Event('change', { bubbles: true }));
    entered = true;
  }

  if (!entered) {
    const splits = document.querySelectorAll('input[maxlength="1"]');
    if (splits.length >= 6) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      for (let i = 0; i < 6 && i < code.length; i++) {
        nativeInputValueSetter.call(splits[i], code[i]);
        splits[i].dispatchEvent(new Event('input', { bubbles: true }));
        splits[i].dispatchEvent(new Event('change', { bubbles: true }));
      }
      entered = true;
    }
  }

  if (!entered) {
    return { status: 'error', message: 'Could not find OTP input field.' };
  }

  await sleep(1000);

  const verifyBtn = findElementByText('אמת קוד') || findElementByText('אמת') ||
    findElementByText('אישור') || findElementByText('שלח') ||
    document.querySelector('button[type="submit"]');

  if (verifyBtn) {
    verifyBtn.click();
  } else {
    const activeEl = document.activeElement || singleInput;
    if (activeEl) {
      activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
  }

  for (let attempt = 0; attempt < 15; attempt++) {
    await sleep(2000);
    try {
      const token = await executeInPageContext(`() => {
        try {
          return JSON.parse(localStorage.getItem('ramilevy')).authuser.user.token;
        } catch(e) { return null; }
      }`);
      if (token) {
        const email = await executeInPageContext(`() => {
          try {
            return JSON.parse(localStorage.getItem('ramilevy')).authuser.user.email || '';
          } catch(e) { return ''; }
        }`);
        return {
          status: 'success',
          message: 'Login successful. User is authenticated.',
          authenticated: true,
          email,
        };
      }
    } catch {}
  }

  return {
    status: 'error',
    message: 'Could not verify login. OTP may be wrong or expired.',
    authenticated: false,
  };
}

async function handleVerifySession() {
  console.log('[PricePilot RL bridge] handleVerifySession');
  const checks = { auth: false, cart: false, checkout: false };

  const auth = await executeInPageContext(`() => {
    try {
      const data = JSON.parse(localStorage.getItem('ramilevy') || '{}');
      const user = data && data.authuser && data.authuser.user ? data.authuser.user : null;
      return !!(user && user.token);
    } catch(e) { return false; }
  }`);
  checks.auth = auth;

  const cartCount = await executeInPageContext(`() => {
    try {
      if (window.$nuxt && window.$nuxt.$store && window.$nuxt.$store.state.cart) {
        const items = window.$nuxt.$store.state.cart.items;
        if (Array.isArray(items)) {
          return items.filter(i => !i.is_delivery && i.name !== 'מחיר משלוח').length;
        }
      }
      return 0;
    } catch(e) { return 0; }
  }`);
  checks.cart = cartCount > 0;
  checks.checkout = checks.auth;

  const allPassed = Object.values(checks).every(Boolean);
  return {
    status: allPassed ? 'success' : 'error',
    verified: allPassed,
    checks,
    failed: Object.entries(checks).filter(([, v]) => !v).map(([k]) => k),
    message: allPassed
      ? 'Session verified: auth valid, cart intact, checkout reachable.'
      : 'Session verification FAILED. Issues: ' + Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(', ') + '.',
  };
}

async function handleGoToCheckout() {
  console.log('[PricePilot RL bridge] handleGoToCheckout');
  window.location.href = 'https://www.rami-levy.co.il/he/dashboard/checkout';
  return {
    status: 'success',
    url: 'https://www.rami-levy.co.il/he/dashboard/checkout',
    message: 'Navigating to checkout. Continue in this browser tab.',
  };
}

// ============================================
// Utilities
// ============================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function findElementByText(text) {
  const elements = document.querySelectorAll('button, a, span');
  for (const el of elements) {
    if (el.textContent && el.textContent.includes(text)) return el;
  }
  return null;
}

// ============================================
// Message listener
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXECUTE_TOOL') {
    console.log('[PricePilot RL bridge] EXECUTE_TOOL:', message.tool, message.requestId);

    const handler = TOOL_HANDLERS[message.tool];
    if (!handler) {
      console.error('[PricePilot RL bridge] Unknown tool:', message.tool);
      chrome.runtime.sendMessage({
        type: 'PRICEPILOT_TOOL_RESULT',
        requestId: message.requestId,
        result: { status: 'error', message: 'Unknown tool: ' + message.tool },
      });
      return;
    }

    handler(message.args || {})
      .then(result => {
        console.log('[PricePilot RL bridge] Tool result:', message.tool, result.status);
        chrome.runtime.sendMessage({
          type: 'PRICEPILOT_TOOL_RESULT',
          requestId: message.requestId,
          result,
        });
      })
      .catch(error => {
        console.error('[PricePilot RL bridge] Tool error:', message.tool, error.message);
        chrome.runtime.sendMessage({
          type: 'PRICEPILOT_TOOL_RESULT',
          requestId: message.requestId,
          result: { status: 'error', message: error.message },
        });
      });
  }
});
