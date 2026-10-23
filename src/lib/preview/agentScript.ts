/**
 * Script injected into the agent's hidden preview frame (see `AgentBrowser`).
 *
 * It lets the AI see and use the running app: it renders the page as an
 * accessibility snapshot with refs on interactive elements, performs actions
 * (click, type, press, ...) on those refs, and waits for the page to settle
 * afterwards. "Settled" means no DOM changes, no fetches in flight, and no
 * Nostr subscriptions waiting on EOSE.
 *
 * The parent sends `agent.call` notifications. Replies go back as
 * `agent.result` *requests*, because iframe.diy's outer frame only relays
 * requests from the inner frame to the parent; responses are routed to its
 * Service Worker.
 */
export function getPreviewAgentScript(): string {
  return String.raw`(function() {
  'use strict';

  if (window.__shakespeareAgent) return;
  window.__shakespeareAgent = true;

  var MAX_NAME = 120;
  var MAX_TEXT = 300;
  var QUIET_MS = 500;

  function post(method, params) {
    try {
      window.parent.postMessage({ jsonrpc: '2.0', id: crypto.randomUUID(), method: method, params: params }, '*');
    } catch (e) {
      // Ignore postMessage errors
    }
  }

  // ===========================================================================
  // Activity tracking, for deciding when the page has settled
  // ===========================================================================

  var lastActivity = Date.now();
  var pendingFetches = 0;
  var sockets = [];

  function touch() {
    lastActivity = Date.now();
  }

  new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      // Inline style changes are mostly animation frames
      if (mutations[i].type !== 'attributes' || mutations[i].attributeName !== 'style') {
        touch();
        return;
      }
    }
  }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true });

  var originalFetch = window.fetch;
  window.fetch = function() {
    pendingFetches++;
    touch();
    return originalFetch.apply(this, arguments).finally(function() {
      pendingFetches--;
      touch();
    });
  };

  var originalXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    pendingFetches++;
    touch();
    this.addEventListener('loadend', function() {
      pendingFetches--;
      touch();
    });
    return originalXhrSend.apply(this, arguments);
  };

  // Track Nostr subscriptions: a REQ is pending until its EOSE, CLOSED, or CLOSE.
  var OriginalWebSocket = window.WebSocket;
  function TrackedWebSocket(url, protocols) {
    var ws = protocols === undefined ? new OriginalWebSocket(url) : new OriginalWebSocket(url, protocols);
    var entry = { ws: ws, subs: new Set() };
    sockets.push(entry);
    touch();

    var send = ws.send;
    ws.send = function(data) {
      try {
        if (typeof data === 'string' && data.charAt(0) === '[') {
          var msg = JSON.parse(data);
          if (msg[0] === 'REQ') entry.subs.add(msg[1]);
          if (msg[0] === 'CLOSE') entry.subs.delete(msg[1]);
        }
      } catch (e) {
        // Not JSON
      }
      touch();
      return send.apply(ws, arguments);
    };
    ws.addEventListener('message', function(event) {
      try {
        if (typeof event.data === 'string' && event.data.charAt(0) === '[') {
          var msg = JSON.parse(event.data);
          if (msg[0] === 'EOSE' || msg[0] === 'CLOSED') entry.subs.delete(msg[1]);
        }
      } catch (e) {
        // Not JSON
      }
      touch();
    });
    ws.addEventListener('close', function() {
      sockets.splice(sockets.indexOf(entry), 1);
      touch();
    });
    return ws;
  }
  TrackedWebSocket.prototype = OriginalWebSocket.prototype;
  Object.setPrototypeOf(TrackedWebSocket, OriginalWebSocket);
  window.WebSocket = TrackedWebSocket;

  function pendingNetwork() {
    var count = pendingFetches;
    for (var i = 0; i < sockets.length; i++) {
      if (sockets[i].ws.readyState === OriginalWebSocket.CONNECTING) count++;
      count += sockets[i].subs.size;
    }
    return count;
  }

  function settle(options) {
    var timeout = options.timeout || 5000;
    var waitFor = options.text;
    var start = Date.now();
    return new Promise(function(resolve) {
      function check() {
        var now = Date.now();
        var found = !waitFor || (document.body && document.body.innerText.indexOf(waitFor) !== -1);
        var quiet = now - lastActivity >= QUIET_MS;
        var idle = document.readyState === 'complete' && pendingNetwork() === 0;
        if (found && quiet && (idle || waitFor)) {
          resolve({ settled: true, waited: now - start });
        } else if (now - start >= timeout) {
          resolve({ settled: false, waited: now - start, found: found, pending: pendingNetwork() });
        } else {
          setTimeout(check, 50);
        }
      }
      check();
    });
  }

  // ===========================================================================
  // Focus
  //
  // Shakespeare takes keyboard focus back whenever this frame grabs it, so
  // the user can keep typing. The browser then resets activeElement to
  // <body>, so the element the page last focused is tracked here instead.
  // ===========================================================================

  var lastFocused = null;
  document.addEventListener('focusin', function(event) {
    lastFocused = event.target;
  }, true);

  function focusedElement() {
    var active = document.activeElement;
    if (active && active !== document.body) return active;
    return lastFocused && lastFocused.isConnected ? lastFocused : document.body;
  }

  // ===========================================================================
  // Accessibility snapshot
  // ===========================================================================

  var refs = new Map();
  var elementRefs = new WeakMap();
  var nextRef = 1;

  function refFor(el) {
    var ref = elementRefs.get(el);
    if (!ref) {
      ref = 'e' + nextRef++;
      elementRefs.set(el, ref);
    }
    refs.set(ref, el);
    return ref;
  }

  function norm(text, max) {
    var s = (text || '').replace(/\s+/g, ' ').trim();
    max = max || MAX_NAME;
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, LINK: 1, META: 1, HEAD: 1, TITLE: 1 };

  var INTERACTIVE_ROLES = {
    button: 1, link: 1, textbox: 1, searchbox: 1, checkbox: 1, radio: 1, combobox: 1, listbox: 1,
    option: 1, slider: 1, spinbutton: 1, switch: 1, tab: 1, menuitem: 1, menuitemcheckbox: 1,
    menuitemradio: 1, treeitem: 1
  };

  var NAME_FROM_CONTENT = {
    button: 1, link: 1, heading: 1, option: 1, tab: 1, menuitem: 1, menuitemcheckbox: 1,
    menuitemradio: 1, checkbox: 1, radio: 1, switch: 1, treeitem: 1, cell: 1, columnheader: 1,
    rowheader: 1, tooltip: 1, clickable: 1
  };

  var CONTAINER_ROLES = {
    list: 1, listitem: 1, form: 1, region: 1, main: 1, navigation: 1, banner: 1, contentinfo: 1,
    complementary: 1, article: 1, table: 1, row: 1, paragraph: 1, blockquote: 1, group: 1
  };

  var LANDMARK_PARENTS = 'article, aside, main, nav, section';

  function implicitRole(el) {
    var tag = el.tagName;
    switch (tag) {
      case 'A': case 'AREA': return el.hasAttribute('href') ? 'link' : null;
      case 'BUTTON': case 'SUMMARY': return 'button';
      case 'INPUT':
        switch ((el.getAttribute('type') || 'text').toLowerCase()) {
          case 'checkbox': return 'checkbox';
          case 'radio': return 'radio';
          case 'range': return 'slider';
          case 'number': return 'spinbutton';
          case 'search': return 'searchbox';
          case 'button': case 'submit': case 'reset': case 'image': case 'file': return 'button';
          default: return 'textbox';
        }
      case 'TEXTAREA': return 'textbox';
      case 'SELECT': return el.multiple || el.size > 1 ? 'listbox' : 'combobox';
      case 'OPTION': return 'option';
      case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6': return 'heading';
      case 'IMG': return el.getAttribute('alt') === '' ? null : 'img';
      case 'NAV': return 'navigation';
      case 'MAIN': return 'main';
      case 'HEADER': return el.parentElement && el.parentElement.closest(LANDMARK_PARENTS) ? null : 'banner';
      case 'FOOTER': return el.parentElement && el.parentElement.closest(LANDMARK_PARENTS) ? null : 'contentinfo';
      case 'ASIDE': return 'complementary';
      case 'FORM': return 'form';
      case 'ARTICLE': return 'article';
      case 'UL': case 'OL': case 'MENU': return 'list';
      case 'LI': return 'listitem';
      case 'TABLE': return 'table';
      case 'TR': return 'row';
      case 'TH': return 'columnheader';
      case 'TD': return 'cell';
      case 'DIALOG': return 'dialog';
      case 'P': return 'paragraph';
      case 'BLOCKQUOTE': return 'blockquote';
      case 'HR': return 'separator';
      case 'PROGRESS': return 'progressbar';
      case 'VIDEO': return 'video';
      case 'AUDIO': return 'audio';
      case 'IFRAME': return 'iframe';
      case 'PRE': return 'code';
      default: return null;
    }
  }

  function reactProps(el) {
    var keys = Object.keys(el);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf('__reactProps$') === 0) return el[keys[i]];
    }
    return null;
  }

  function isClickable(el, style, parentCursor) {
    if (el.hasAttribute('onclick')) return true;
    var tabindex = el.getAttribute('tabindex');
    if (tabindex !== null && Number(tabindex) >= 0) return true;
    var props = reactProps(el);
    if (props && (props.onClick || props.onMouseDown || props.onPointerDown)) return true;
    return style.cursor === 'pointer' && parentCursor !== 'pointer';
  }

  function labelledBy(el) {
    var ids = el.getAttribute('aria-labelledby');
    if (!ids) return '';
    return norm(ids.split(/\s+/).map(function(id) {
      var target = document.getElementById(id);
      return target ? target.textContent : '';
    }).join(' '));
  }

  function explicitName(el) {
    var name = labelledBy(el) || norm(el.getAttribute('aria-label'));
    if (name) return name;
    if (el.labels && el.labels.length) {
      name = norm(Array.prototype.map.call(el.labels, function(label) { return label.innerText; }).join(' '));
      if (name) return name;
    }
    if (el.tagName === 'IMG' || (el.tagName === 'INPUT' && el.type === 'image')) return norm(el.getAttribute('alt'));
    if (el.tagName === 'INPUT' && /^(submit|button|reset)$/.test(el.type)) return norm(el.value);
    return norm(el.getAttribute('placeholder')) || norm(el.getAttribute('title'));
  }

  function valueOf(el, role) {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (/^(checkbox|radio|button|submit|reset|image|file)$/.test(el.type)) return undefined;
      return el.type === 'password' && el.value ? '••••' : norm(el.value, MAX_TEXT);
    }
    if (el.isContentEditable && (role === 'textbox' || role === 'searchbox')) return norm(el.innerText, MAX_TEXT);
    return undefined;
  }

  function stateProps(el, role) {
    var props = [];
    if (role === 'heading') {
      props.push('level=' + (el.getAttribute('aria-level') || (/^H[1-6]$/.test(el.tagName) ? el.tagName.charAt(1) : '2')));
    }
    var checked = el.getAttribute('aria-checked');
    if (checked === null && el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
      checked = el.indeterminate ? 'mixed' : String(el.checked);
    }
    if (checked === 'true') props.push('checked');
    if (checked === 'mixed') props.push('mixed');
    if (el.getAttribute('aria-expanded') === 'true') props.push('expanded');
    if (el.getAttribute('aria-selected') === 'true' || (el.tagName === 'OPTION' && el.selected)) props.push('selected');
    if (el.getAttribute('aria-pressed') === 'true') props.push('pressed');
    if (el.getAttribute('aria-current') && el.getAttribute('aria-current') !== 'false') props.push('current');
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') props.push('disabled');
    if (el.getAttribute('aria-invalid') === 'true') props.push('invalid');
    if (el === focusedElement() && el !== document.body) props.push('focused');
    if (role === 'link') {
      var href = el.getAttribute('href') || '';
      if (href.indexOf(location.origin) === 0) href = href.slice(location.origin.length) || '/';
      props.push('href=' + href);
    }
    if (el.tagName === 'IMG' && el.complete && el.naturalWidth === 0 && el.getAttribute('src')) {
      props.push('broken src=' + el.getAttribute('src'));
    }
    return props;
  }

  function isHidden(el, style) {
    if (el.hidden || el.inert || el.getAttribute('aria-hidden') === 'true') return true;
    return style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse';
  }

  /**
   * Build snapshot items for an element. Elements without a role are
   * flattened into their parent. Text is merged across inline content;
   * block-level elements keep their text on separate lines.
   */
  function build(el, parentCursor) {
    if (SKIP_TAGS[el.tagName]) return [];
    var style = getComputedStyle(el);

    // Icons are usually aria-hidden, but their names still say what an
    // icon-only button does
    var icon = el.tagName === 'svg' && style.display !== 'none' && /(?:^|\s)lucide-([a-z0-9-]+)/.exec(el.getAttribute('class') || '');
    if (icon && el.getAttribute('aria-hidden') === 'true') return [{ icon: icon[1] }];

    if (isHidden(el, style)) return [];

    var explicitRole = el.getAttribute('role');
    var role = explicitRole || implicitRole(el);
    if (role === 'presentation' || role === 'none') role = null;

    if (el.tagName === 'svg') {
      var label = labelledBy(el) || norm(el.getAttribute('aria-label'));
      if (label || role === 'img') return [{ role: 'img', name: label, props: [], children: [] }];
      return icon ? [{ icon: icon[1] }] : [];
    }

    // A label's text is already its control's name. Keep it only when it
    // stands in for a hidden control, like a styled file input.
    var control = el.tagName === 'LABEL' ? el.control : null;
    if (control && !isHidden(control, getComputedStyle(control)) && !el.contains(control)) return [];

    var children = [];
    var nodes = el.shadowRoot ? el.shadowRoot.childNodes : el.childNodes;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.nodeType === 3) {
        if (node.nodeValue.trim()) children.push({ text: node.nodeValue, inline: true });
        else if (node.nodeValue) children.push({ text: ' ', inline: true });
      } else if (node.nodeType === 1) {
        var built = build(node, style.cursor);
        for (var j = 0; j < built.length; j++) children.push(built[j]);
      }
    }
    if (el.tagName === 'BR') children.push({ text: ' ', inline: true });
    children = mergeText(children);

    var interactive = !!(role && INTERACTIVE_ROLES[role]) ||
      (el.isContentEditable && !(el.parentElement && el.parentElement.isContentEditable));
    if (!interactive && !control && isClickable(el, style, parentCursor)) {
      interactive = true;
      if (!role) role = 'clickable';
    }
    if (el.isContentEditable && interactive && !role) role = 'textbox';

    var inline = /^inline/.test(style.display);

    if (!role) {
      if (control && el.contains(control)) {
        children = children.filter(function(c) { return c.text === undefined; });
      }
      // A generic element: hoist its children, keeping block-level text apart
      if (!inline) {
        for (var k = 0; k < children.length; k++) {
          if (children[k].text !== undefined) children[k].inline = false;
        }
      }
      return children;
    }

    if (CONTAINER_ROLES[role] && !children.some(function(c) { return c.icon === undefined; })) return [];

    var item = { role: role, name: explicitName(el), props: stateProps(el, role), children: children };
    if (interactive) item.ref = refFor(el);
    item.value = valueOf(el, role);
    if (item.value !== undefined) item.children = [];

    var meaningful = children.filter(function(c) { return c.icon === undefined; });
    var allText = meaningful.every(function(c) { return c.text !== undefined; });
    if (NAME_FROM_CONTENT[role] && allText) {
      var text = norm(meaningful.map(function(c) { return c.text; }).join(' '), role === 'paragraph' || role === 'listitem' || role === 'cell' ? MAX_TEXT : MAX_NAME);
      if (!item.name) item.name = text;
      if (!item.name || item.name === text) item.children = [];
    }
    if (!item.name && meaningful.length === 0) {
      var icons = children.filter(function(c) { return c.icon !== undefined; }).map(function(c) { return c.icon; });
      if (icons.length) item.props.unshift('icon=' + icons.join(','));
    }
    return [item];
  }

  function mergeText(items) {
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var last = out[out.length - 1];
      if (item.text !== undefined && item.inline && last && last.text !== undefined && last.inline) {
        last.text += item.text;
      } else {
        out.push(item.text !== undefined ? { text: item.text, inline: item.inline } : item);
      }
    }
    return out.filter(function(item) { return item.text === undefined || item.text.trim(); });
  }

  function serialize(items, indent, out, budget) {
    for (var i = 0; i < items.length; i++) {
      if (budget.used > budget.max) return;
      var item = items[i];
      var line;
      if (item.icon !== undefined) continue;
      if (item.text !== undefined) {
        line = indent + '- text: ' + norm(item.text, MAX_TEXT);
        out.push(line);
        budget.used += line.length + 1;
        continue;
      }
      line = indent + '- ' + item.role;
      if (item.name) line += ' ' + JSON.stringify(item.name);
      for (var j = 0; j < item.props.length; j++) line += ' [' + item.props[j] + ']';
      if (item.ref) line += ' [ref=' + item.ref + ']';
      if (item.value !== undefined) line += ': ' + JSON.stringify(item.value);
      var visible = item.children.filter(function(c) { return c.icon === undefined; });
      if (visible.length === 1 && visible[0].text !== undefined && item.value === undefined) {
        line += ': ' + norm(visible[0].text, MAX_TEXT);
        visible = [];
      } else if (visible.length) {
        line += ':';
      }
      out.push(line);
      budget.used += line.length + 1;
      serialize(visible, indent + '  ', out, budget);
    }
  }

  function snapshot(root, maxChars) {
    refs.clear();
    if (!root) return '(the page has no body yet)';
    var items = root === document.body ? mergeText(build(root, 'auto')) : build(root, 'auto');
    var out = [];
    var budget = { used: 0, max: maxChars || 20000 };
    serialize(items, '', out, budget);
    if (budget.used > budget.max) {
      out.push('… (snapshot truncated; pass a ref to snapshot part of the page)');
    }
    return out.length ? out.join('\n') : '(the page is empty)';
  }

  // ===========================================================================
  // Actions
  // ===========================================================================

  function resolveRef(ref) {
    if (!ref) throw new Error('This action needs a ref from the snapshot.');
    var el = refs.get(ref);
    if (!el || !el.isConnected) throw new Error('Ref ' + ref + ' is not on the page anymore. Use the refs from the latest snapshot.');
    return el;
  }

  function describe(el) {
    var role = el.getAttribute('role') || implicitRole(el) || el.tagName.toLowerCase();
    var name = explicitName(el) || norm(el.innerText, 60);
    return role + (name ? ' "' + name + '"' : '');
  }

  function center(el) {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) throw new Error(describe(el) + ' has no size, so it cannot be clicked.');
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  /** The element a real click at the target's center would land on. */
  function hitTarget(el, point) {
    var hit = document.elementFromPoint(point.x, point.y);
    if (!hit || hit === el || el.contains(hit) || hit.contains(el)) return hit && el.contains(hit) ? hit : el;
    var labels = el.labels ? Array.prototype.slice.call(el.labels) : [];
    for (var i = 0; i < labels.length; i++) {
      if (labels[i].contains(hit)) return el;
    }
    throw new Error(describe(el) + ' is covered by ' + describe(hit) + ', so a user could not click it.');
  }

  function fire(target, type, point, extra) {
    var init = {
      bubbles: type.indexOf('enter') === -1 && type.indexOf('leave') === -1,
      cancelable: true, composed: true, view: window,
      clientX: point.x, clientY: point.y, screenX: point.x, screenY: point.y,
      button: 0, buttons: type === 'pointerdown' || type === 'mousedown' ? 1 : 0,
      detail: type.indexOf('click') !== -1 ? 1 : 0
    };
    if (extra) for (var key in extra) init[key] = extra[key];
    var event = type.indexOf('pointer') === 0
      ? new PointerEvent(type, Object.assign({ pointerId: 1, pointerType: 'mouse', isPrimary: true, width: 1, height: 1, pressure: type === 'pointerdown' ? 0.5 : 0 }, init))
      : new MouseEvent(type, init);
    return target.dispatchEvent(event);
  }

  function hover(target, point) {
    fire(target, 'pointerover', point);
    fire(target, 'pointerenter', point);
    fire(target, 'mouseover', point);
    fire(target, 'mouseenter', point);
    fire(target, 'pointermove', point);
    fire(target, 'mousemove', point);
  }

  var FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable=""], [contenteditable="true"]';

  function click(el) {
    var point = center(el);
    var target = hitTarget(el, point);
    hover(target, point);
    var pointerDown = fire(target, 'pointerdown', point);
    if (pointerDown && fire(target, 'mousedown', point)) {
      var focusable = target.closest(FOCUSABLE);
      if (focusable && !focusable.disabled) {
        focusable.focus({ preventScroll: true });
      } else {
        // Clicking something unfocusable moves focus off the focused element
        var current = focusedElement();
        if (current !== document.body) current.blur();
        lastFocused = null;
      }
    }
    fire(target, 'pointerup', point);
    if (pointerDown) fire(target, 'mouseup', point);
    fire(target, 'click', point);
  }

  function setValue(el, value) {
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    // The native setter bypasses React's value tracking, so React sees the change
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: value }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function type(el, text) {
    el.focus({ preventScroll: true });
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (el.disabled || el.readOnly) throw new Error(describe(el) + ' is not editable.');
      setValue(el, text);
    } else if (el.isContentEditable) {
      var range = document.createRange();
      range.selectNodeContents(el);
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('insertText', false, text);
    } else {
      throw new Error(describe(el) + ' is not a text field.');
    }
  }

  function selectOptions(el, values) {
    if (el.tagName !== 'SELECT') {
      throw new Error(describe(el) + ' is not a native <select>. Click it to open it, then click the option.');
    }
    var matched = 0;
    Array.prototype.forEach.call(el.options, function(option) {
      var match = values.indexOf(option.value) !== -1 || values.indexOf(norm(option.text)) !== -1;
      if (match) matched++;
      if (el.multiple || match) option.selected = match;
    });
    if (!matched) throw new Error('No option of ' + describe(el) + ' matches ' + JSON.stringify(values) + '.');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  var KEY_CODES = { Enter: 'Enter', Escape: 'Escape', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', ' ': 'Space',
    ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Home: 'Home', End: 'End',
    PageUp: 'PageUp', PageDown: 'PageDown' };

  function tabbables() {
    return Array.prototype.filter.call(document.querySelectorAll(FOCUSABLE), function(el) {
      if (el.disabled || el.getAttribute('tabindex') === '-1') return false;
      var rect = el.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    });
  }

  function press(combo) {
    var parts = combo.split('+');
    var key = parts.pop();
    if (key === '' && parts.length) key = '+';
    if (key === 'Space') key = ' ';
    if (key === 'Esc') key = 'Escape';
    var mods = { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
    parts.forEach(function(mod) {
      var m = mod.toLowerCase();
      if (m === 'control' || m === 'ctrl') mods.ctrlKey = true;
      else if (m === 'shift') mods.shiftKey = true;
      else if (m === 'alt') mods.altKey = true;
      else if (m === 'meta' || m === 'cmd') mods.metaKey = true;
    });
    var code = KEY_CODES[key] || (key.length === 1 ? (/[a-z]/i.test(key) ? 'Key' + key.toUpperCase() : /[0-9]/.test(key) ? 'Digit' + key : '') : key);
    var target = focusedElement();
    if (target !== document.activeElement && target.focus) target.focus({ preventScroll: true });
    var init = Object.assign({ key: key, code: code, bubbles: true, cancelable: true, composed: true }, mods);
    var proceed = target.dispatchEvent(new KeyboardEvent('keydown', init));
    if (proceed && key.length === 1) target.dispatchEvent(new KeyboardEvent('keypress', init));
    target.dispatchEvent(new KeyboardEvent('keyup', init));
    if (!proceed) return;

    // Default actions that synthetic key events don't trigger on their own
    if (key === 'Enter') {
      if (target.tagName === 'INPUT' && target.form) {
        target.form.requestSubmit();
      } else if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.getAttribute('role') === 'button') {
        click(target);
      }
    } else if (key === ' ' && (target.tagName === 'BUTTON' || target.getAttribute('role') === 'button' || target.getAttribute('role') === 'checkbox' || target.getAttribute('role') === 'switch' || target.type === 'checkbox' || target.type === 'radio')) {
      click(target);
    } else if (key === 'Tab') {
      var list = tabbables();
      var index = list.indexOf(target);
      var next = list[(index + (mods.shiftKey ? -1 : 1) + list.length) % list.length];
      if (next) next.focus();
    }
  }

  function scroll(ref, direction) {
    if (ref) {
      resolveRef(ref).scrollIntoView({ block: 'center', behavior: 'instant' });
      return;
    }
    var page = document.scrollingElement || document.documentElement;
    if (direction === 'top') page.scrollTop = 0;
    else if (direction === 'bottom') page.scrollTop = page.scrollHeight;
    else page.scrollBy(0, (direction === 'up' ? -0.8 : 0.8) * window.innerHeight);
  }

  function stringify(value) {
    if (value === undefined) return 'undefined';
    if (value instanceof Element) return '<' + value.tagName.toLowerCase() + '> ' + describe(value);
    if (typeof value === 'function') return String(value);
    try {
      var json = JSON.stringify(value, null, 2);
      return json === undefined ? String(value) : json;
    } catch (e) {
      return String(value);
    }
  }

  function evaluate(script) {
    var AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
    var fn;
    try {
      fn = new AsyncFunction('return (' + script + '\n)');
    } catch (e) {
      fn = new AsyncFunction(script);
    }
    return Promise.resolve(fn()).then(function(value) {
      var s = stringify(value);
      return s.length > 5000 ? s.slice(0, 5000) + '… (truncated)' : s;
    });
  }

  // ===========================================================================
  // Screenshots, rendered from the DOM by modern-screenshot (screenshot.js)
  // ===========================================================================

  var MAX_SCREENSHOT_HEIGHT = 8000;

  function isTransparent(color) {
    return !color || color === 'transparent' || /^rgba\(.*,\s*0\)$/.test(color);
  }

  function pageBackground() {
    var els = [document.body, document.documentElement];
    for (var i = 0; i < els.length; i++) {
      var color = els[i] && getComputedStyle(els[i]).backgroundColor;
      if (!isTransparent(color)) return color;
    }
    return '#ffffff';
  }

  /**
   * Render the visible part of the page, the whole page, or one element to a PNG.
   * Small viewports (phones) are rendered at 2×, like a real phone screen, and
   * elements are enlarged so their detail is visible.
   */
  function screenshot(el, fullPage) {
    var lib = window.modernScreenshot;
    if (!lib) return Promise.reject(new Error('Screenshots are not available in this page.'));
    var target = el || document.body;
    if (!target) return Promise.reject(new Error('The page has no body yet.'));
    var rect = target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return Promise.reject(new Error(describe(target) + ' has no size, so there is nothing to capture.'));
    var scale = el
      ? Math.max(1, Math.min(4, Math.floor(1600 / Math.max(rect.width, rect.height))))
      : (window.innerWidth < 600 ? 2 : 1);

    return lib.domToCanvas(target, { scale: scale, backgroundColor: pageBackground() }).then(function(canvas) {
      var x = 0, y = 0, w = canvas.width, h = canvas.height;
      if (!el && !fullPage) {
        x = Math.min(w - 1, Math.max(0, -rect.left) * scale);
        y = Math.min(h - 1, Math.max(0, -rect.top) * scale);
        w = Math.min(w - x, window.innerWidth * scale);
        h = Math.min(h - y, window.innerHeight * scale);
      }
      var truncated = h > MAX_SCREENSHOT_HEIGHT;
      if (truncated) h = MAX_SCREENSHOT_HEIGHT;

      var out = document.createElement('canvas');
      out.width = Math.round(w);
      out.height = Math.round(h);
      out.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, out.width, out.height);
      return {
        dataUrl: out.toDataURL('image/png'),
        width: out.width,
        height: out.height,
        scale: scale,
        truncated: truncated
      };
    });
  }

  function perform(p) {
    switch (p.action) {
      case 'none': case 'snapshot': case 'wait': case 'screenshot': return;
      case 'navigate': {
        var url = new URL(p.path || '/', location.href);
        if (url.origin !== location.origin) throw new Error('Only paths within the app can be opened.');
        var path = url.pathname + url.search + url.hash;
        history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
        return;
      }
      case 'back': history.back(); return;
      case 'click': click(resolveRef(p.ref)); return;
      case 'hover': {
        var el = resolveRef(p.ref);
        var point = center(el);
        hover(hitTarget(el, point), point);
        return;
      }
      case 'type': {
        var field = resolveRef(p.ref);
        type(field, p.text || '');
        if (p.submit) press('Enter');
        return;
      }
      case 'select': selectOptions(resolveRef(p.ref), p.values || []); return;
      case 'press': press(p.key || ''); return;
      case 'scroll': scroll(p.ref, p.direction); return;
      case 'eval': return evaluate(p.script || '');
      default: throw new Error('Unknown action: ' + p.action);
    }
  }

  function run(p) {
    // Count the action itself as activity, so the page gets time to react
    if (p.action !== 'snapshot' && p.action !== 'eval' && p.action !== 'screenshot') touch();
    return Promise.resolve().then(function() { return perform(p); }).then(function(output) {
      return settle(p.wait || {}).then(function(settled) {
        var root = document.body;
        if (p.scope) {
          root = refs.get(p.scope);
          if (!root || !root.isConnected) throw new Error('Ref ' + p.scope + ' is not on the page anymore.');
        }
        var image = p.action === 'screenshot'
          ? screenshot(p.ref ? resolveRef(p.ref) : null, p.fullPage)
          : undefined;
        return Promise.resolve(image).then(function(image) {
          return {
            url: location.pathname + location.search + location.hash,
            title: document.title,
            output: output,
            settled: settled,
            image: image,
            snapshot: p.snapshot === false ? undefined : snapshot(root, p.maxChars)
          };
        });
      });
    });
  }

  window.addEventListener('message', function(event) {
    if (event.source !== window.parent) return;
    var message = event.data;
    if (!message || message.jsonrpc !== '2.0' || message.method !== 'agent.call') return;
    var params = message.params || {};
    run(params).then(function(result) {
      post('agent.result', { callId: params.callId, result: result });
    }, function(error) {
      post('agent.result', { callId: params.callId, error: error && error.message ? error.message : String(error) });
    });
  });

  post('agent.ready', {});
})();`;
}
