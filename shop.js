/* Hillary's Snack Corner order flow.
 * The Confirm Order button opens a prefilled WhatsApp message for the shop.
 */
(() => {
  'use strict';
  const BUSINESS = Object.freeze({ whatsappNumber: '256703149773' });
  const DADDIES_PRICES = Object.freeze({ '500g': 5000, '1 kg': 1000, '2 kg': 22000, '2.5 kg': 30000 });
  const SIZES = Object.freeze(['500g', '1 kg', '2 kg', '2.5 kg']);
  const PRODUCTS = Object.freeze({
    vanilla: { name: 'Vanilla Daddies', image: 'assets/vanilla-daddies.webp', sizes: SIZES, prices: DADDIES_PRICES },
    strawberry: { name: 'Strawberry Daddies', image: 'assets/strawberry-daddies.webp', sizes: SIZES, prices: DADDIES_PRICES },
    chocolate: { name: 'Chocolate Daddies', image: 'assets/chocolate-daddies.webp', sizes: SIZES, prices: DADDIES_PRICES },
    lemon: { name: 'Lemon Daddies', image: 'assets/lemon-daddies.webp', sizes: SIZES, prices: DADDIES_PRICES },
    corn: { name: 'Hard Corns', image: 'assets/hard-corns.webp', sizes: ['Pack size to confirm'], prices: {} }
  });
  // The cart stays in this page and is handed to the shop through WhatsApp.
  const cart = new Map();
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const orderDialog = $('#order-dialog');
  const flavourDialog = $('#flavour-dialog');
  const cartItems = $('#cart-items');
  let selectedPack = '500g';
  let toastTimer;
  let orderMessage = '';

  function formatUGX(amount) {
    return amount === undefined ? 'Price on request' : 'UGX ' + amount.toLocaleString('en-UG');
  }

  function itemPrice(product, size) {
    return PRODUCTS[product]?.prices?.[size];
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-' + name);
    svg.append(use);
    return svg;
  }

  function notify(message) {
    const toast = $('#toast');
    clearTimeout(toastTimer);
    const activeDialog = $('dialog[open]');
    (activeDialog || document.body).append(toast);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 3600);
  }

  function syncModalState() {
    document.body.classList.toggle('dialog-open', !!$('dialog[open]'));
    if (!document.querySelector('dialog[open]')) document.body.append($('#toast'));
  }

  function openDialog(dialog) {
    if (!dialog.open) dialog.showModal();
    syncModalState();
  }

  function totalCount() {
    return [...cart.values()].reduce((total, item) => total + item.quantity, 0);
  }

  function resetOrderView() {
    $('#request-result').hidden = true;
    $('#order-form').hidden = false;
    cartItems.hidden = false;
    $('#add-more').hidden = false;
    $('.order-intro').hidden = false;
    $('#order-details').hidden = cart.size === 0;
    orderMessage = '';
  }

  function snapshot() {
    return {
      items: [...cart.values()].map(item => ({ ...item, name: PRODUCTS[item.product].name, priceUGX: itemPrice(item.product, item.size) ?? null })),
      totalPacks: totalCount(),
      status: 'draft_order'
    };
  }

  function renderCart() {
    resetOrderView();
    const count = totalCount();
    $$('.bag-count').forEach(badge => {
      badge.textContent = String(count);
      badge.setAttribute('aria-label', count + ' ' + (count === 1 ? 'pack' : 'packs') + ' in order');
    });
    $('#pack-total').textContent = count + ' ' + (count === 1 ? 'pack' : 'packs') + ' in your order';
    cartItems.replaceChildren();
    if (!cart.size) {
      const empty = node('div', 'empty-cart');
      empty.append(icon('bag'), node('h3', '', 'A little empty. For now.'), node('p', '', 'Choose a snack and pack size to start your order.'));
      cartItems.append(empty);
      return;
    }
    for (const [key, item] of cart) {
      const product = PRODUCTS[item.product];
      const article = node('article', 'cart-item');
      const image = node('img');
      image.src = product.image;
      image.alt = '';
      image.width = 66;
      image.height = 72;
      const info = node('div');
      info.append(node('h3', '', product.name), node('p', '', item.size + ' · ' + formatUGX(itemPrice(item.product, item.size))));
      const remove = node('button', 'remove-item', 'Remove');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove ' + product.name + ', ' + item.size);
      remove.addEventListener('click', () => {
        cart.delete(key);
        renderCart();
        const nextControl = cartItems.querySelector('button') || $('#add-more');
        nextControl.focus();
        notify(product.name + ' removed.');
      });
      info.append(remove);
      const quantity = node('div', 'quantity-control');
      quantity.setAttribute('role', 'group');
      quantity.setAttribute('aria-label', product.name + ', ' + item.size + ', quantity');
      const value = node('span', '', String(item.quantity));
      const minus = node('button');
      minus.type = 'button';
      minus.append(icon('minus'));
      minus.disabled = item.quantity === 1;
      minus.setAttribute('aria-label', 'Decrease ' + product.name + ', ' + item.size + ' quantity');
      const plus = node('button');
      plus.type = 'button';
      plus.append(icon('plus'));
      plus.disabled = item.quantity === 99;
      plus.setAttribute('aria-label', 'Increase ' + product.name + ', ' + item.size + ' quantity');
      function changeQuantity(delta) {
        item.quantity = Math.min(99, Math.max(1, item.quantity + delta));
        value.textContent = String(item.quantity);
        minus.disabled = item.quantity === 1;
        plus.disabled = item.quantity === 99;
        const total = totalCount();
        $$('.bag-count').forEach(badge => {
          badge.textContent = String(total);
          badge.setAttribute('aria-label', total + ' ' + (total === 1 ? 'pack' : 'packs') + ' in order');
        });
        $('#pack-total').textContent = total + ' ' + (total === 1 ? 'pack' : 'packs') + ' in your order';
      }
      minus.addEventListener('click', () => changeQuantity(-1));
      plus.addEventListener('click', () => changeQuantity(1));
      quantity.append(minus, value, plus);
      article.append(image, info, quantity);
      cartItems.append(article);
    }
  }

  function validateItem(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Each item must be an object.');
    if (!Object.hasOwn(PRODUCTS, item.product)) throw new Error('Choose vanilla, strawberry, chocolate, lemon or corn.');
    if (!PRODUCTS[item.product].sizes.includes(item.size)) throw new Error('Choose an available pack size.');
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new Error('Quantity must be a whole number from 1 to 99.');
    return { product: item.product, size: item.size, quantity: item.quantity };
  }

  function addItems(items) {
    if (!Array.isArray(items) || items.length < 1 || items.length > 20) throw new Error('Provide 1 to 20 snack selections.');
    const validated = items.map(validateItem);
    // Validate the entire batch first so an invalid item never partially changes the cart.
    const next = new Map([...cart.entries()].map(([key, value]) => [key, { ...value }]));
    for (const item of validated) {
      const key = item.product + '|' + item.size;
      const quantity = (next.get(key)?.quantity || 0) + item.quantity;
      if (quantity > 99) throw new Error('The maximum is 99 packs per flavour and size. Add any larger quantity in the notes.');
      next.set(key, { ...item, quantity });
    }
    cart.clear();
    for (const [key, item] of next) cart.set(key, item);
    renderCart();
    return snapshot();
  }

  function addOne(product, size) {
    try {
      addItems([{ product, size, quantity: 1 }]);
      const count = totalCount();
      notify(PRODUCTS[product].name + ' added · ' + count + ' ' + (count === 1 ? 'pack' : 'packs') + ' in your order');
    } catch (error) {
      notify(error.message);
    }
  }

  function showOrder() {
    renderCart();
    openDialog(orderDialog);
  }

  function buildOrderMessage() {
    const lines = ["HILLARY'S SNACK CORNER", 'Order details', ''];
    const name = $('#customer-name').value.trim();
    if (name) lines.push('Name: ' + name, '');
    for (const item of cart.values()) {
      const price = itemPrice(item.product, item.size);
      lines.push(item.quantity + ' × ' + PRODUCTS[item.product].name + ' — ' + item.size + ' — ' + formatUGX(price) + (price ? ' each' : ''));
    }
    lines.push('');
    if ($('input[name="fulfilment"]:checked').value === 'delivery') {
      lines.push('Delivery requested: Yes');
      lines.push('Delivery area: ' + ($('#delivery-location').value.trim() || 'To discuss'));
    } else {
      lines.push('Delivery / collection: To discuss');
    }
    const notes = $('#order-notes').value.trim();
    if (notes) lines.push('', 'Additional requests: ' + notes);
    return lines.join('\n');
  }

  function prepareOrder() {
    if (!cart.size) throw new Error('Add at least one snack to your order.');
    orderMessage = buildOrderMessage();
    $('#order-summary').value = orderMessage;
    $('#order-form').hidden = true;
    cartItems.hidden = true;
    $('#add-more').hidden = true;
    $('.order-intro').hidden = true;
    $('#request-result').hidden = false;
    $('#result-title').focus();
    return { text: orderMessage, status: 'ready_to_confirm' };
  }

  $$('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $$('dialog').forEach(dialog => {
    dialog.addEventListener('close', syncModalState);
    // Use pointer-down and pointer-up outside the dialog to avoid closing on a dragged selection.
    let pointerStartedOutside = false;
    function outside(event) {
      const box = dialog.getBoundingClientRect();
      return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
    }
    dialog.addEventListener('pointerdown', event => { pointerStartedOutside = event.target === dialog && outside(event); });
    dialog.addEventListener('pointerup', event => { if (pointerStartedOutside && outside(event)) dialog.close(); pointerStartedOutside = false; });
  });
  $$('[data-open-order]').forEach(button => button.addEventListener('click', showOrder));
  $$('[data-add]').forEach(button => button.addEventListener('click', () => {
    const product = button.dataset.add;
    const size = product === 'corn' ? PRODUCTS.corn.sizes[0] : $('input[name="' + product + '-size"]:checked').value;
    addOne(product, size);
  }));
  $$('[data-pack]').forEach(button => button.addEventListener('click', () => {
    selectedPack = button.dataset.pack;
    $('#chosen-pack').textContent = selectedPack + ' Daddies · ' + formatUGX(DADDIES_PRICES[selectedPack]);
    openDialog(flavourDialog);
  }));
  $$('[data-flavour]').forEach(button => button.addEventListener('click', () => {
    const product = button.dataset.flavour;
    flavourDialog.close();
    addOne(product, selectedPack);
  }));
  $('[data-order-delivery]').addEventListener('click', () => {
    $('input[name="fulfilment"][value="delivery"]').checked = true;
    $('#location-field').hidden = false;
    showOrder();
  });
  $('#add-more').addEventListener('click', () => {
    orderDialog.close();
    $('#snacks').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    $('[data-add="vanilla"]').focus({ preventScroll: true });
  });
  $$('input[name="fulfilment"]').forEach(input => input.addEventListener('change', () => {
    $('#location-field').hidden = $('input[name="fulfilment"]:checked').value !== 'delivery';
  }));
  $('#order-form').addEventListener('submit', event => {
    event.preventDefault();
    try { prepareOrder(); } catch (error) { notify(error.message); }
  });
  $('#edit-order').addEventListener('click', () => { resetOrderView(); $('#customer-name').focus(); });
  const whatsappReady = /^[1-9]\d{7,14}$/.test(BUSINESS.whatsappNumber);
  if (whatsappReady) {
    $('#request-help').textContent = 'Tap Confirm Order to send these details to Hillary’s Snack Corner on WhatsApp.';
  }
  $('#share-order').addEventListener('click', () => {
    if (!orderMessage) return;
    if (!whatsappReady) {
      notify('WhatsApp ordering is not available right now.');
      return;
    }
    window.open('https://wa.me/' + BUSINESS.whatsappNumber + '?text=' + encodeURIComponent(orderMessage), '_blank', 'noopener,noreferrer');
  });
  $$('input[name="vanilla-size"], input[name="strawberry-size"], input[name="chocolate-size"], input[name="lemon-size"]').forEach(input => input.addEventListener('change', () => {
    const product = input.name.split('-')[0];
    const price = $('.product-price[data-price-for="' + product + '"]');
    const size = $('input[name="' + product + '-size"]:checked').value;
    if (price) price.textContent = size + ' · ' + formatUGX(DADDIES_PRICES[size]);
  }));
  $('#year').textContent = String(new Date().getFullYear());
  renderCart();

  // Optional page tools can inspect or edit the visible order draft.
  // They never send an order or payment.
  const context = document.modelContext;
  if (context?.registerTool) {
    const lifecycle = new AbortController();
    const toolDefinitions = [
      {
        name: 'get_snack_order', title: 'Read current snack order',
        description: 'Read the snack catalogue and the current on-page order draft. No order is sent.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute(input) {
          if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('This tool accepts an empty object.');
          return { catalogue: Object.entries(PRODUCTS).map(([id, p]) => ({ id, name: p.name, sizes: p.sizes })), ...snapshot() };
        }
      },
      {
        name: 'add_snacks_to_order', title: 'Add snacks to an order',
        description: 'Add one or more snack selections to the visible on-page order draft and open the order panel. Does not send an order.',
        inputSchema: { type: 'object', properties: { items: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', properties: { product: { type: 'string', enum: ['vanilla', 'strawberry', 'chocolate', 'lemon', 'corn'] }, size: { type: 'string', enum: [...SIZES, 'Pack size to confirm'] }, quantity: { type: 'integer', minimum: 1, maximum: 99 } }, required: ['product', 'size', 'quantity'], additionalProperties: false } } }, required: ['items'], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => key !== 'items')) throw new Error('Provide an items array.');
          const result = addItems(input.items);
          if (flavourDialog.open) flavourDialog.close();
          openDialog(orderDialog);
          return result;
        }
      }
    ];
    for (const tool of toolDefinitions) {
      try { Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Optional browser capability. */ }
    }
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  }
})();
