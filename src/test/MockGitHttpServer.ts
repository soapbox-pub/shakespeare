/**
 * Mock Git HTTP server that simulates the Git Smart HTTP protocol.
 * This allows testing git clone operations without a real server.
 * Exposes a fetch-compatible method that can be passed to the Git class.
 */
export class MockGitHttpServer {
  private repositories: Map<string, MockRepository> = new Map();

  /**
   * Add a mock repository to the server
   */
  addRepository(url: string, repo: MockRepository): void {
    this.repositories.set(url, repo);
  }

  /**
   * Fetch-compatible method for handling HTTP requests
   */
  fetch = async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);

    // Remove .git suffix and git protocol paths to get base URL
    let baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
    baseUrl = baseUrl.replace(/\/(info\/refs|git-upload-pack)$/, '');
    baseUrl = baseUrl.replace(/\.git$/, '');

    const repo = this.repositories.get(baseUrl);
    if (!repo) {
      return new Response('Not Found', {
        status: 404,
        statusText: 'Not Found',
        headers: {},
      });
    }

    // Handle /info/refs?service=git-upload-pack
    if (url.pathname.endsWith('/info/refs') && url.searchParams.get('service') === 'git-upload-pack') {
      return this.handleInfoRefs(url, repo);
    }

    // Handle /git-upload-pack
    if (url.pathname.endsWith('/git-upload-pack')) {
      return this.handleUploadPack(url, repo);
    }

    return new Response('Not Found', {
      status: 404,
      statusText: 'Not Found',
      headers: {},
    });
  };

  private handleInfoRefs(url: URL, repo: MockRepository): Response {
    // Git Smart HTTP protocol advertisement
    // Format: pkt-line format with capabilities
    const lines: string[] = [];

    // Service header
    lines.push('# service=git-upload-pack\n');
    lines.push(''); // flush-pkt

    // Advertise HEAD
    const caps = 'multi_ack thin-pack side-band side-band-64k ofs-delta shallow deepen-since deepen-not deepen-relative no-progress include-tag multi_ack_detailed no-done symref=HEAD:refs/heads/main agent=git/isomorphic-git@1.32.1';
    lines.push(`${repo.headCommit} HEAD\0${caps}\n`);

    // Advertise refs
    for (const [ref, commit] of Object.entries(repo.refs)) {
      lines.push(`${commit} ${ref}\n`);
    }

    lines.push(''); // flush-pkt

    const body = this.encodePktLines(lines);

    return new Response(body, {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'application/x-git-upload-pack-advertisement',
      },
    });
  }

  private handleUploadPack(url: URL, repo: MockRepository): Response {
    // Return the pre-built packfile from the repository
    const packfile = repo.packfile;

    return new Response(packfile, {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'application/x-git-upload-pack-result',
      },
    });
  }

  /**
   * Encode strings in Git pkt-line format
   * Format: 4-byte hex length (including the 4 bytes) + data
   * Special: "0000" is a flush packet
   */
  private encodePktLines(lines: string[]): Uint8Array<ArrayBuffer> {
    const chunks: Uint8Array[] = [];

    for (const line of lines) {
      if (line === '') {
        // Flush packet
        chunks.push(new TextEncoder().encode('0000'));
      } else {
        const data = new TextEncoder().encode(line);
        const length = data.length + 4;
        const lengthHex = length.toString(16).padStart(4, '0');
        chunks.push(new TextEncoder().encode(lengthHex));
        chunks.push(data);
      }
    }

    // Concatenate all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }
}

export interface MockRepository {
  /** SHA-1 hash of the HEAD commit */
  headCommit: string;
  /** Map of ref names to commit SHAs */
  refs: Record<string, string>;
  /** Pre-built packfile containing all objects */
  packfile: Uint8Array<ArrayBuffer>;
}

/**
 * Create a minimal mock repository with a single commit
 * Uses a pre-built valid Git packfile for testing
 */
export function createMockRepository(): MockRepository {
  // This is a real Git packfile generated from a repository with:
  // - README.md containing "# Test Repository\n\nThis is a test.\n"
  // - One commit with message "Initial commit"
  // - Commit SHA: 2e538da98e06b91e70268817b0fa3f01aeeb003e
  const packfileHex = '5041434b00000002000000039e40789c9d93c7aeab581045e77cc599a3d72493a4f75a4d06136c820d66464e878cc1f6d7f77d7dd5b31e750d4aaa2595b4f7606d4b51008aa4489e27d32421e953cae63449730cce9274c12419591044ce153c457048f2dcea7101022c5e408345b28e03f8997c5d7ffd5ed537f9a32ffe0404cb302c49511c0b7ee00c8e23d9d8f7cdb615ffefbb9aaab5a9c08fdf232a9ae180ab7605bea1394270f3947f380210d0b8c647140451aa845c6d14c51f4bfe7cfe7c5187eaa6f294d5ba87c6b982b2992af4f0227f5641aa3af75f8e00942d9b7b85a176c0e871b6653ebcde69f15dcb53796cd3852fa25999347672f5d770bff3323a117ab4e4b72c9a6ed466e70830b9a8b48b0c4ecc6aedf807bda5dba9c52095f1cb20866f29b41a131589903913357c37f46672ea1bd5b05ddffcbc55380474adfc209d13bd14794a87703e9aa8ab52b26b77ebd39e2bfbd5c46d1559a3f7fc3c4e68b850a698cf87f684787c1271f8408015cd345d5b03ccbd14dd14eab9b42cf588454161173dd309aee699caccc4e6e2b8ae6ba21d97b6b4ef48e921de7359f01070c648a6a07df395dc1492099361ffac562571385de6c3e64267e822d798f0322a84a1430f3ed2debc1a1cccebca7b68f0d5c2eb2b7badcfb19a711a2e9aa7b31b90ef5d2ee9bbcf4922ccef61bf372b83a5b884addb83eef7d808d28f5da8d89a6982f59521f68ba84b564f0e34de52ab508df162d72872fa30f347d08603cb57ed8ca3466ddac2bec30b01453a89f9eb78913c5f4000e7c6354c19fd9ec822bfe7578abfb8766f37d896ef69dddd0e8294bcb7b1f66fd9d40265f2f6783a2b993e56e5868ae98c80058e3363df9750d0ae813b3e86d6a7f60bfab41e2f7cf7df121a7372f41af7a92e994dad073ebd9814a7adfad838decb49111068b4b1b8fa165ef453b15dca9352976c7c3c7beca19072402aea4c73504c211a72955312c16659e9cca34ac34fcf65be21e0f16474f11eb8994ff4b94e571d7f66197d0896719e42bd2aa5f6cafaa42b677e5c8f062a3face317027ebde4d446be9d511cf9bf8c418ca1d99a04826f3b91bf0191324721b302789c535608492d2e51084a2dc82fce2cc92faae4e20ac9c82c5600a2448512a0941e1700d2db0b85a502789c3334303033315108727574f175d5cb4d6108b64b36f75d7d71d56395df97d867957c9ec1f9531f00d83a0e40d3e38f9fec5693e0d772cc782c387687aa7a8ddd';

  const packfileBytes = hexToBytes(packfileHex);
  const commitSha = '2e538da98e06b91e70268817b0fa3f01aeeb003e';

  // Wrap packfile in side-band-64k format with pkt-line
  const bandedChunk = new Uint8Array(packfileBytes.length + 1);
  bandedChunk[0] = 1; // Band 1 (packfile data)
  bandedChunk.set(packfileBytes, 1);

  const pktLine = encodePktLine(bandedChunk);
  const flushPkt = new TextEncoder().encode('0000');

  const packfile = new Uint8Array(pktLine.length + flushPkt.length);
  packfile.set(pktLine, 0);
  packfile.set(flushPkt, pktLine.length);

  return {
    headCommit: commitSha,
    refs: {
      'refs/heads/main': commitSha,
    },
    packfile,
  };
}

/**
 * Create a mock repository with custom content
 * Note: This uses the same pre-built packfile regardless of input
 * For more complex testing, you'd need to generate packfiles dynamically
 */
export function createMockRepositoryWithContent(_files: Record<string, string>): MockRepository {
  return createMockRepository();
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function encodePktLine(data: Uint8Array): Uint8Array {
  const length = data.length + 4;
  const lengthHex = length.toString(16).padStart(4, '0');
  const header = new TextEncoder().encode(lengthHex);
  const result = new Uint8Array(header.length + data.length);
  result.set(header, 0);
  result.set(data, header.length);
  return result;
}
