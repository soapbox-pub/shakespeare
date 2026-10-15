/**
 * Browser stand-in for `node:zlib`, which just-bash imports for gzip, gunzip,
 * zcat and `rg -z`. Those commands report an error instead of breaking the
 * bundle.
 */

export const constants = {
  Z_BEST_SPEED: 1,
  Z_BEST_COMPRESSION: 9,
  Z_DEFAULT_COMPRESSION: -1,
};

function unavailable(): never {
  throw new Error('gzip compression is not available in this environment');
}

export const gzipSync = unavailable;
export const gunzipSync = unavailable;
