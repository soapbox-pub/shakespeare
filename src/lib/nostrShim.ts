/**
 * The path where the nostr shim script is served from.
 * This special path is intercepted by PreviewPane and serves the shim JavaScript.
 * 
 * NOTE: Cannot start with /_ because the iframe-fetch-client's Service Worker
 * ignores paths starting with /_ (reserved for its own system files).
 */
export const NOSTR_SHIM_PATH = '/.nostr/shim.js';

/**
 * Returns the JavaScript code for the nostr shim (without script tags).
 * This is served as an external script to work with the iframe-fetch-client's
 * document replacement which only re-executes external scripts.
 */
export function getNostrShimCode(): string {
  return `(function() {
  // Map to track pending requests
  var pendingRequests = new Map();
  var requestId = 0;

  // Send a request to the parent and wait for response
  function sendNostrRequest(method, params) {
    params = params || {};
    return new Promise(function(resolve, reject) {
      var id = ++requestId;
      
      pendingRequests.set(id, { resolve: resolve, reject: reject });
      
      window.parent.postMessage({
        jsonrpc: '2.0',
        method: 'nostr.' + method,
        params: params,
        id: id
      }, '*');
      
      // Timeout after 60 seconds (signing can take time with hardware wallets)
      setTimeout(function() {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error('Nostr request timed out'));
        }
      }, 60000);
    });
  }

  // Handle responses from parent
  window.addEventListener('message', function(event) {
    var message = event.data;
    
    // Check if this is a nostr response
    if (message && message.jsonrpc === '2.0' && message.id && pendingRequests.has(message.id)) {
      var pending = pendingRequests.get(message.id);
      pendingRequests.delete(message.id);
      
      if (message.error) {
        pending.reject(new Error(message.error.message || 'Unknown error'));
      } else {
        pending.resolve(message.result);
      }
    }
  });

  // Create the window.nostr shim
  window.nostr = {
    getPublicKey: function() {
      return sendNostrRequest('getPublicKey');
    },
    
    signEvent: function(event) {
      return sendNostrRequest('signEvent', { event: event });
    },
    
    getRelays: function() {
      return sendNostrRequest('getRelays');
    },
    
    nip04: {
      encrypt: function(pubkey, plaintext) {
        return sendNostrRequest('nip04.encrypt', { pubkey: pubkey, plaintext: plaintext });
      },
      decrypt: function(pubkey, ciphertext) {
        return sendNostrRequest('nip04.decrypt', { pubkey: pubkey, ciphertext: ciphertext });
      }
    },
    
    nip44: {
      encrypt: function(pubkey, plaintext) {
        return sendNostrRequest('nip44.encrypt', { pubkey: pubkey, plaintext: plaintext });
      },
      decrypt: function(pubkey, ciphertext) {
        return sendNostrRequest('nip44.decrypt', { pubkey: pubkey, ciphertext: ciphertext });
      }
    }
  };

  console.log('[Preview] window.nostr shim installed - NIP-07 calls will be proxied to parent');
})();`;
}

/**
 * Injects a reference to the nostr shim external script into an HTML string.
 * Inserts the script at the start of <head> to ensure it runs before any app code.
 * 
 * We use an external script instead of inline because the iframe-fetch-client's
 * replaceDocument() only re-executes external scripts (those with src attribute).
 */
export function injectNostrShim(html: string): string {
  // Use external script reference - the script will be served by PreviewPane
  const shimScript = `<script src="${NOSTR_SHIM_PATH}"></script>`;
  
  // Try to inject after <head> tag
  const headMatch = html.match(/<head[^>]*>/i);
  if (headMatch) {
    const insertPos = headMatch.index! + headMatch[0].length;
    return html.slice(0, insertPos) + '\n' + shimScript + '\n' + html.slice(insertPos);
  }
  
  // Fallback: inject after <!DOCTYPE html> or at the very start
  const doctypeMatch = html.match(/<!DOCTYPE[^>]*>/i);
  if (doctypeMatch) {
    const insertPos = doctypeMatch.index! + doctypeMatch[0].length;
    return html.slice(0, insertPos) + '\n' + shimScript + '\n' + html.slice(insertPos);
  }
  
  // Last resort: prepend
  return shimScript + '\n' + html;
}
