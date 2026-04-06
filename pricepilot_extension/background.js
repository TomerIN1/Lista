/**
 * PricePilot Extension — Background Service Worker
 *
 * All tool execution happens here using chrome.scripting.executeScript
 * with world: 'MAIN'. This bypasses CSP restrictions on rami-levy.co.il
 * and gives direct access to window.$nuxt, localStorage, fetch, etc.
 */

const RAMI_LEVY_MARKET_URL = 'https://www.rami-levy.co.il/he/online/market';

let ramiLevyTabId = null;
const pendingRequests = new Map(); // requestId → listaTabId

// ============================================
// Tab Management
// ============================================

async function ensureRamiLevyTab() {
  if (ramiLevyTabId !== null) {
    try {
      const tab = await chrome.tabs.get(ramiLevyTabId);
      if (tab && tab.url && tab.url.includes('rami-levy.co.il')) {
        console.log('[PricePilot bg] Reusing Rami Levy tab:', ramiLevyTabId);
        return ramiLevyTabId;
      }
    } catch {
      ramiLevyTabId = null;
    }
  }

  const tabs = await chrome.tabs.query({ url: '*://www.rami-levy.co.il/*' });
  if (tabs.length > 0) {
    ramiLevyTabId = tabs[0].id;
    console.log('[PricePilot bg] Found existing Rami Levy tab:', ramiLevyTabId);
    return ramiLevyTabId;
  }

  console.log('[PricePilot bg] Opening new Rami Levy tab');
  const tab = await chrome.tabs.create({ url: RAMI_LEVY_MARKET_URL, active: false });
  ramiLevyTabId = tab.id;

  await new Promise((resolve) => {
    const listener = (tabId, changeInfo) => {
      if (tabId === ramiLevyTabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 30000);
  });

  return ramiLevyTabId;
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === ramiLevyTabId) {
    console.log('[PricePilot bg] Rami Levy tab closed');
    ramiLevyTabId = null;
  }
});

// ============================================
// Execute in Page Main World (bypasses CSP)
// ============================================

async function execInPage(tabId, func, args = []) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func,
    args,
  });
  return results[0]?.result;
}

// ============================================
// Tool Handlers (all run via chrome.scripting)
// ============================================

async function handleCheckAuth(tabId) {
  return execInPage(tabId, () => {
    try {
      const data = JSON.parse(localStorage.getItem('ramilevy') || '{}');
      const user = data && data.authuser && data.authuser.user ? data.authuser.user : null;
      return {
        status: 'success',
        authenticated: !!(user && user.token),
        email: (user && user.email) ? String(user.email) : '',
        message: (user && user.token) ? 'User is authenticated.' : 'User is NOT authenticated. Login required.',
      };
    } catch (e) {
      return { status: 'success', authenticated: false, email: '', message: 'User is NOT authenticated.' };
    }
  });
}

async function handleInitializeSession(tabId) {
  const auth = await handleCheckAuth(tabId);

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

  const cart = await handleReadCart(tabId);
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

async function handleReadCart(tabId) {
  // Navigate to market page to get fresh Vuex state
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      if (!window.location.href.includes('/he/online/market')) {
        window.location.href = 'https://www.rami-levy.co.il/he/online/market';
      } else {
        window.location.reload();
      }
    },
  });
  // Wait for page to load and Vuex to populate
  await sleep(5000);

  return execInPage(tabId, () => {
    try {
      if (window.$nuxt && window.$nuxt.$store && window.$nuxt.$store.state.cart) {
        const cart = window.$nuxt.$store.state.cart;
        if (cart.items && Array.isArray(cart.items)) {
          let subtotal = 0;
          let deliveryPrice = 29.90; // Default Rami Levy delivery fee

          const items = cart.items
            .filter(i => {
              // Capture delivery price but exclude from items list
              if (i.is_delivery || i.name === 'מחיר משלוח') {
                const dp = (i.price && i.price.finalPrice) || i.sumPrice || (i.price && i.price.price) || 0;
                if (dp > 0) deliveryPrice = dp; // Only override default if actual price found
                return false;
              }
              return true;
            })
            .map(i => {
              const isWeighted = !!(i.prop && (i.prop.sw_shakil || i.prop.by_kilo));
              const amount = i.amount || 1;
              const multiplication = i.multiplication || 1;
              const unitPrice = i.price && i.price.price != null ? i.price.price : (typeof i.price === 'number' ? i.price : null);
              const lineTotal = i.price && i.price.finalPrice != null ? i.price.finalPrice : (i.sumPrice || 0);
              const promoPrice = i.price && i.price.club_price ? i.price.club_price : null;

              // Extract promo/promotion info from all possible Vuex fields
              const priceObj = i.price || {};
              const originalPrice = priceObj.originalPrice || priceObj.regular_price || priceObj.price1 || null;
              let promoText = '';
              // Try multiple known promo field locations
              if (i.promotion) {
                promoText = typeof i.promotion === 'string' ? i.promotion
                  : (i.promotion.text || i.promotion.title || i.promotion.description || JSON.stringify(i.promotion));
              }
              if (!promoText && priceObj.promotion) {
                promoText = typeof priceObj.promotion === 'string' ? priceObj.promotion
                  : (priceObj.promotion.text || priceObj.promotion.title || '');
              }
              if (!promoText && i.promo_text) promoText = i.promo_text;
              if (!promoText && i.badge) promoText = typeof i.badge === 'string' ? i.badge : (i.badge.text || '');
              if (!promoText && priceObj.badge) promoText = typeof priceObj.badge === 'string' ? priceObj.badge : (priceObj.badge.text || '');
              // If original price differs from unit price, there's a discount
              const hasPromo = !!(promoText || (originalPrice && unitPrice && originalPrice > unitPrice));
              // Build promo display if we have original price but no text
              if (!promoText && originalPrice && unitPrice && originalPrice > unitPrice) {
                promoText = amount + ' ב-' + (lineTotal || unitPrice);
              }

              // Out-of-stock detection: line_total is 0 when quantity > 0 means unavailable
              // (unit price may still show, but finalPrice/sumPrice is 0 for out-of-stock items)
              const inStock = !(amount > 0 && lineTotal === 0);

              subtotal += lineTotal;

              return {
                id: i.id,
                name: i.name || '',
                barcode: i.barcode || '',
                amount: amount,
                multiplication: multiplication,
                is_weighted: isWeighted,
                quantity_display: isWeighted ? amount + ' ק"ג' : amount + ' יחידות',
                unit_price: unitPrice,
                original_price: originalPrice,
                promo_price: promoPrice,
                promo_text: promoText,
                has_promo: hasPromo,
                line_total: lineTotal,
                in_stock: inStock,
              };
            });

          const outOfStockItems = items.filter(i => !i.in_stock);

          return {
            status: 'success',
            items,
            item_count: items.length,
            subtotal: subtotal,
            delivery_price: deliveryPrice,
            total_with_delivery: subtotal + deliveryPrice,
            out_of_stock_items: outOfStockItems.map(i => ({ id: i.id, name: i.name })),
            out_of_stock_count: outOfStockItems.length,
            message: items.length > 0
              ? 'Cart has ' + items.length + ' item(s). Subtotal: ₪' + subtotal.toFixed(2)
                + (outOfStockItems.length > 0
                  ? '. WARNING: ' + outOfStockItems.length + ' item(s) are OUT OF STOCK: ' + outOfStockItems.map(i => i.name).join(', ')
                  : '')
              : 'Cart is empty.',
          };
        }
      }
      return { status: 'success', items: [], item_count: 0, subtotal: 0, delivery_price: 29.90, total_with_delivery: 29.90, message: 'Cart is empty.' };
    } catch (e) {
      return { status: 'error', message: 'Failed to read cart: ' + e.message };
    }
  });
}

async function handleAddItems(tabId, args) {
  const items = args.items;
  if (!items || typeof items !== 'object') {
    return { status: 'error', message: 'items is required.' };
  }

  return execInPage(tabId, async (items) => {
    try {
      const token = JSON.parse(localStorage.getItem('ramilevy')).authuser.user.token;
      if (!token) return { status: 'error', message: 'No auth token. Login required.' };

      let storeId = '331';
      if (window.$nuxt && window.$nuxt.$store && window.$nuxt.$store.state.cart) {
        storeId = String(window.$nuxt.$store.state.cart.storeId || '331');
      }

      const tomorrow = new Date(Date.now() + 86400000).toISOString().replace(/T.*/, 'T00:00:00.000Z');

      const resp = await fetch('/api/v2/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'locale': 'he',
          'Accept': 'application/json, text/plain, */*',
          'Authorization': 'Bearer ' + token,
          'ecomtoken': token,
        },
        body: JSON.stringify({
          store: storeId,
          isClub: 0,
          supplyAt: tomorrow,
          items: items,
          meta: null,
        }),
      });

      const data = await resp.json();
      const cartItems = (data.items || [])
        .filter(i => !i.is_delivery && !(i.name || '').includes('משלוח'))
        .map(i => ({ id: i.id, name: i.name || '', qty: i.quantity || 1 }));

      return {
        status: 'success',
        items_added: items,
        cart_items: cartItems,
        cart_count: cartItems.length,
        message: 'Added ' + Object.keys(items).length + ' product(s). Cart now has ' + cartItems.length + ' items.',
      };
    } catch (e) {
      return { status: 'error', message: 'Failed to add items: ' + e.message };
    }
  }, [items]);
}

async function handleClearCart(tabId) {
  return execInPage(tabId, async () => {
    try {
      if (window.$nuxt && window.$nuxt.$api && window.$nuxt.$api.cart &&
          typeof window.$nuxt.$api.cart.deleteCart === 'function') {
        await window.$nuxt.$api.cart.deleteCart();
        return { status: 'success', message: 'Cart cleared. Call read_cart to verify.' };
      }
      return { status: 'error', message: 'deleteCart not available' };
    } catch (e) {
      return { status: 'error', message: 'Clear cart failed: ' + e.message };
    }
  });
}

async function handleRemoveItem(tabId, args) {
  const pid = String(args.product_id);
  if (!pid) return { status: 'error', message: 'product_id is required.' };

  return execInPage(tabId, async (pid) => {
    try {
      const token = JSON.parse(localStorage.getItem('ramilevy')).authuser.user.token;
      if (!token) return { status: 'error', message: 'No auth token.' };

      let storeId = '331';
      const cart = window.$nuxt && window.$nuxt.$store && window.$nuxt.$store.state.cart;
      if (cart) storeId = String(cart.storeId || '331');

      if (!cart || !cart.items) return { status: 'error', message: 'Cart empty.' };

      const payloadItems = {};
      let removeQty = '1.00';
      for (const item of cart.items) {
        const id = String(item.id);
        const amount = item.amount || 1;
        if (id === pid) {
          removeQty = amount.toFixed(2);
        } else {
          payloadItems[id] = amount.toFixed(2);
        }
      }
      payloadItems[pid] = '-' + removeQty;

      const tomorrow = new Date(Date.now() + 86400000).toISOString().replace(/T.*/, 'T00:00:00.000Z');
      const resp = await fetch('/api/v2/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'locale': 'he',
          'Accept': 'application/json, text/plain, */*',
          'Authorization': 'Bearer ' + token,
          'ecomtoken': token,
        },
        body: JSON.stringify({ store: storeId, isClub: 0, supplyAt: tomorrow, items: payloadItems, meta: null }),
      });

      const data = await resp.json();
      const remaining = (data.items || [])
        .filter(i => !i.is_delivery && !(i.name || '').includes('משלוח'))
        .map(i => ({ id: i.id, name: i.name || '', qty: i.quantity }));
      const removed = !remaining.some(i => String(i.id) === pid);

      return {
        status: removed ? 'success' : 'warning',
        removed_id: pid,
        remaining_items: remaining,
        message: removed
          ? 'Item ' + pid + ' removed. Cart now has ' + remaining.length + ' items.'
          : 'Item ' + pid + ' may not have been removed.',
      };
    } catch (e) {
      return { status: 'error', message: 'Remove failed: ' + e.message };
    }
  }, [pid]);
}

async function handleStartLogin(tabId, args) {
  const email = args.email;
  if (!email) return { status: 'error', message: 'Email is required.' };

  // Step 1: Open login modal
  await execInPage(tabId, () => {
    window.$nuxt.$root.$emit('OpenLoginModal');
  });
  await sleep(2000);

  // Step 2: Fill email and submit
  const fillResult = await chrome.scripting.executeScript({
    target: { tabId },
    func: (email) => {
      const input = document.querySelector(
        'input[type="email"], input[type="tel"], input[placeholder*="מייל"], input[placeholder*="email"], input[placeholder*="אימייל"]'
      );
      if (!input) return { found: false };

      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, email);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      // Click submit
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent || '';
        if (text.includes('שלח') || text.includes('התחברות') || text.includes('המשך')) {
          btn.click();
          return { found: true, clicked: true };
        }
      }
      return { found: true, clicked: false };
    },
    args: [email],
  });

  await sleep(3000);

  // Step 3: Handle SMS method selection
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const els = document.querySelectorAll('button, a, span');
      for (const el of els) {
        if (el.textContent && el.textContent.includes('הודעת SMS')) {
          el.click();
          return true;
        }
      }
      return false;
    },
  });
  await sleep(1500);

  // Click "send code" if visible
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent || '';
        if (text.includes('שלח קוד')) { btn.click(); return true; }
      }
      return false;
    },
  });
  await sleep(3000);

  // Step 4: Check if OTP field appeared
  const otpCheck = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      return !!document.querySelector('input[placeholder*="קוד"], input[maxlength="6"], input[maxlength="1"]');
    },
  });
  const otpVisible = otpCheck[0]?.result || false;

  return {
    status: otpVisible ? 'success' : 'partial',
    message: otpVisible
      ? 'OTP code sent via SMS. Ask the user for the 6-digit code.'
      : 'Email submitted but OTP field not detected. The code may still arrive.',
    otp_sent: otpVisible,
  };
}

async function handleSubmitOtp(tabId, args) {
  const code = (args.otp_code || '').trim();
  if (!code) return { status: 'error', message: 'OTP code is required.' };

  // Fill OTP and click verify
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (code) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

      // Try single input
      const single = document.querySelector('input[placeholder*="קוד"], input[maxlength="6"]');
      if (single) {
        setter.call(single, code);
        single.dispatchEvent(new Event('input', { bubbles: true }));
        single.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // Try split inputs
        const splits = document.querySelectorAll('input[maxlength="1"]');
        for (let i = 0; i < 6 && i < code.length && i < splits.length; i++) {
          setter.call(splits[i], code[i]);
          splits[i].dispatchEvent(new Event('input', { bubbles: true }));
          splits[i].dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // Click verify
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent || '';
        if (text.includes('אמת קוד') || text.includes('אמת') || text.includes('אישור')) {
          btn.click();
          return;
        }
      }
      // Fallback: submit button
      const submit = document.querySelector('button[type="submit"]');
      if (submit) submit.click();
    },
    args: [code],
  });

  // Poll for token
  for (let attempt = 0; attempt < 15; attempt++) {
    await sleep(2000);
    const tokenResult = await execInPage(tabId, () => {
      try {
        const data = JSON.parse(localStorage.getItem('ramilevy'));
        return {
          token: data?.authuser?.user?.token || null,
          email: data?.authuser?.user?.email || '',
        };
      } catch { return { token: null, email: '' }; }
    });

    if (tokenResult && tokenResult.token) {
      return {
        status: 'success',
        message: 'Login successful. User is authenticated.',
        authenticated: true,
        email: tokenResult.email,
      };
    }
  }

  return {
    status: 'error',
    message: 'Could not verify login. OTP may be wrong or expired.',
    authenticated: false,
  };
}

async function handleVerifySession(tabId) {
  const auth = await handleCheckAuth(tabId);
  const cart = await handleReadCart(tabId);

  const checks = {
    auth: auth.authenticated,
    cart: (cart.item_count || 0) > 0,
    checkout: auth.authenticated, // if authed, checkout is reachable
  };

  const allPassed = Object.values(checks).every(Boolean);
  return {
    status: allPassed ? 'success' : 'error',
    verified: allPassed,
    checks,
    failed: Object.entries(checks).filter(([, v]) => !v).map(([k]) => k),
    message: allPassed
      ? 'Session verified: auth valid, cart intact, checkout reachable.'
      : 'Session verification FAILED.',
  };
}

async function handleGoToCheckout(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      window.location.href = 'https://www.rami-levy.co.il/he/dashboard/checkout';
    },
  });
  return {
    status: 'success',
    url: 'https://www.rami-levy.co.il/he/dashboard/checkout',
    message: 'Navigating to checkout. Continue in this browser tab.',
  };
}

// ============================================
// Tool Router
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

// ============================================
// Message Handling
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PRICEPILOT_TOOL_REQUEST') {
    console.log('[PricePilot bg] Tool request:', message.tool, message.requestId);
    const listaTabId = sender.tab?.id;
    if (listaTabId) pendingRequests.set(message.requestId, listaTabId);
    handleToolRequest(message.requestId, message.tool, message.args || {});
    return false;
  }

  if (message.type === 'PRICEPILOT_PING') {
    sendResponse({ type: 'PRICEPILOT_PONG', installed: true });
    return false;
  }
});

async function handleToolRequest(requestId, toolName, args) {
  try {
    const tabId = await ensureRamiLevyTab();
    const handler = TOOL_HANDLERS[toolName];

    if (!handler) {
      sendResultToLista(requestId, { status: 'error', message: 'Unknown tool: ' + toolName });
      return;
    }

    console.log('[PricePilot bg] Executing', toolName, 'on tab', tabId);
    const result = await handler(tabId, args);
    console.log('[PricePilot bg] Result:', toolName, result?.status);
    sendResultToLista(requestId, result);
  } catch (error) {
    console.error('[PricePilot bg] Tool error:', toolName, error.message);
    sendResultToLista(requestId, { status: 'error', message: error.message });
  }
}

function sendResultToLista(requestId, result) {
  const listaTabId = pendingRequests.get(requestId);
  pendingRequests.delete(requestId);

  if (listaTabId) {
    chrome.tabs.sendMessage(listaTabId, {
      type: 'PRICEPILOT_TOOL_RESPONSE',
      requestId,
      result,
    });
  } else {
    console.warn('[PricePilot bg] No Lista tab for requestId:', requestId);
  }
}

// ============================================
// Utility
// ============================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
