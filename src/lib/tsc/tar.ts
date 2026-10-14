export interface TarEntry {
  /** Path inside the archive with the top-level directory (e.g. `package/`) removed. */
  path: string;
  data: Uint8Array;
}

/** Decompress a gzipped tarball and return its regular files. */
export async function extractTarGz(gz: Uint8Array): Promise<TarEntry[]> {
  const stream = new Blob([gz as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  const tar = new Uint8Array(await new Response(stream).arrayBuffer());
  return extractTar(tar);
}

const decoder = new TextDecoder();

function readString(buf: Uint8Array, start: number, length: number): string {
  let end = start;
  while (end < start + length && buf[end] !== 0) end++;
  return decoder.decode(buf.subarray(start, end));
}

function readOctal(buf: Uint8Array, start: number, length: number): number {
  const str = readString(buf, start, length).trim();
  return str ? parseInt(str, 8) : 0;
}

/** Parse pax extended header records (`"<len> <key>=<value>\n"`). */
function parsePax(data: Uint8Array): Record<string, string> {
  const result: Record<string, string> = {};
  const text = decoder.decode(data);
  let i = 0;
  while (i < text.length) {
    const space = text.indexOf(' ', i);
    if (space === -1) break;
    const len = parseInt(text.slice(i, space), 10);
    if (!len) break;
    const record = text.slice(space + 1, i + len - 1);
    const eq = record.indexOf('=');
    if (eq !== -1) result[record.slice(0, eq)] = record.slice(eq + 1);
    i += len;
  }
  return result;
}

/** Parse an uncompressed ustar/pax/GNU tar archive. */
export function extractTar(tar: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  let longName: string | undefined;
  let paxPath: string | undefined;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;

    const size = readOctal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 48);
    const dataStart = offset + 512;
    const data = tar.subarray(dataStart, dataStart + size);
    offset = dataStart + Math.ceil(size / 512) * 512;

    if (type === 'L') {
      longName = readString(data, 0, data.length);
      continue;
    }
    if (type === 'x') {
      paxPath = parsePax(data).path;
      continue;
    }
    if (type === 'g') continue;

    let name = readString(header, 0, 100);
    if (readString(header, 257, 6) === 'ustar') {
      const prefix = readString(header, 345, 155);
      if (prefix) name = `${prefix}/${name}`;
    }
    name = paxPath ?? longName ?? name;
    paxPath = undefined;
    longName = undefined;

    if (type !== '0' && type !== '7') continue;

    const slash = name.indexOf('/');
    const path = slash === -1 ? name : name.slice(slash + 1);
    if (path) entries.push({ path, data });
  }

  return entries;
}
