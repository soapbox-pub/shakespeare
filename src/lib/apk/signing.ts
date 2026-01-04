/**
 * Browser-based APK signing utility
 * Implements JAR signing (v1) for Android APKs
 */
import JSZip from 'jszip';
import forge from 'node-forge';

export interface SigningKey {
  privateKey: forge.pki.PrivateKey;
  certificate: forge.pki.Certificate;
  alias: string;
}

export interface SigningOptions {
  key: SigningKey;
  apkData: ArrayBuffer;
}

/**
 * Zipalign implementation for 4-byte alignment
 * Aligns uncompressed entries to the specified boundary
 */
function zipalign(data: Uint8Array, alignment: number): Uint8Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // Find End of Central Directory (EOCD)
  let eocdOffset = -1;
  for (let i = data.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('Invalid ZIP: EOCD not found');

  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const _cdSize = view.getUint32(eocdOffset + 12, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);

  // Parse central directory to get file entries
  interface Entry {
    nameOffset: number;
    nameLength: number;
    extraLength: number;
    commentLength: number;
    compressionMethod: number;
    localHeaderOffset: number;
    compressedSize: number;
    uncompressedSize: number;
  }
  const entries: Entry[] = [];
  let pos = cdOffset;
  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) throw new Error('Invalid central directory');
    const compressionMethod = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const uncompressedSize = view.getUint32(pos + 24, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const localHeaderOffset = view.getUint32(pos + 42, true);
    entries.push({
      nameOffset: pos + 46,
      nameLength,
      extraLength,
      commentLength,
      compressionMethod,
      localHeaderOffset,
      compressedSize,
      uncompressedSize,
    });
    pos += 46 + nameLength + extraLength + commentLength;
  }

  // Calculate new offsets and padding needed
  interface AlignmentInfo {
    entry: Entry;
    localExtraLength: number;
    newOffset: number;
    paddingNeeded: number;
    name: string;
  }
  const alignmentInfos: AlignmentInfo[] = [];
  let currentOffset = 0;

  for (const entry of entries) {
    const localPos = entry.localHeaderOffset;
    if (view.getUint32(localPos, true) !== 0x04034b50) throw new Error('Invalid local header');

    const localNameLength = view.getUint16(localPos + 26, true);
    const localExtraLength = view.getUint16(localPos + 28, true);
    const _headerSize = 30 + localNameLength + localExtraLength;
    const _dataOffset = localPos + _headerSize;

    const nameBytes = data.slice(localPos + 30, localPos + 30 + localNameLength);
    const name = new TextDecoder().decode(nameBytes);

    // Only align uncompressed files (compression method 0 = STORE)
    let paddingNeeded = 0;
    if (entry.compressionMethod === 0 && entry.uncompressedSize > 0) {
      const newDataOffset = currentOffset + 30 + localNameLength + localExtraLength;
      const misalignment = newDataOffset % alignment;
      if (misalignment !== 0) {
        paddingNeeded = alignment - misalignment;
      }
    }

    alignmentInfos.push({
      entry,
      localExtraLength,
      newOffset: currentOffset,
      paddingNeeded,
      name,
    });

    currentOffset += 30 + localNameLength + localExtraLength + paddingNeeded + entry.compressedSize;
  }

  // Calculate new central directory offset
  const _newCdOffset = currentOffset;

  // Build new ZIP
  const cdEntrySize = pos - cdOffset; // Total size of central directory entries
  const newSize = currentOffset + cdEntrySize + 22;
  const result = new Uint8Array(newSize);
  const resultView = new DataView(result.buffer);

  let writePos = 0;

  // Write local file headers and data
  for (const info of alignmentInfos) {
    const entry = info.entry;
    const oldLocalPos = entry.localHeaderOffset;
    const oldNameLength = view.getUint16(oldLocalPos + 26, true);
    const oldExtraLength = view.getUint16(oldLocalPos + 28, true);
    const oldHeaderSize = 30 + oldNameLength + oldExtraLength;

    // Copy local file header
    result.set(data.slice(oldLocalPos, oldLocalPos + 30), writePos);

    // Update extra field length to include padding
    const newExtraLength = oldExtraLength + info.paddingNeeded;
    resultView.setUint16(writePos + 28, newExtraLength, true);

    // Copy filename
    result.set(data.slice(oldLocalPos + 30, oldLocalPos + 30 + oldNameLength), writePos + 30);

    // Copy original extra field
    if (oldExtraLength > 0) {
      result.set(
        data.slice(oldLocalPos + 30 + oldNameLength, oldLocalPos + 30 + oldNameLength + oldExtraLength),
        writePos + 30 + oldNameLength
      );
    }

    // Padding is implicitly zero-filled (Uint8Array is initialized to 0)

    writePos += 30 + oldNameLength + newExtraLength;

    // Copy file data
    const dataStart = oldLocalPos + oldHeaderSize;
    result.set(data.slice(dataStart, dataStart + entry.compressedSize), writePos);
    writePos += entry.compressedSize;
  }

  // Write central directory
  const newCdStart = writePos;
  for (let i = 0; i < alignmentInfos.length; i++) {
    const info = alignmentInfos[i];
    const entry = info.entry;

    // Find this entry in original central directory
    let oldCdPos = cdOffset;
    for (let j = 0; j < i; j++) {
      const e = entries[j];
      oldCdPos += 46 + e.nameLength + e.extraLength + e.commentLength;
    }

    const cdEntryLength = 46 + entry.nameLength + entry.extraLength + entry.commentLength;

    // Copy central directory entry
    result.set(data.slice(oldCdPos, oldCdPos + cdEntryLength), writePos);

    // Update local header offset
    resultView.setUint32(writePos + 42, info.newOffset, true);

    writePos += cdEntryLength;
  }

  // Write EOCD
  result.set(data.slice(eocdOffset, eocdOffset + 22), writePos);
  // Update central directory offset
  resultView.setUint32(writePos + 16, newCdStart, true);

  return result;
}

/**
 * APK Signature Scheme v2 implementation
 * Inserts a signing block between ZIP content and Central Directory
 */
function applyV2Signature(apk: Uint8Array, key: SigningKey): Uint8Array {
  const view = new DataView(apk.buffer, apk.byteOffset, apk.byteLength);

  // Find EOCD
  let eocdOffset = -1;
  for (let i = apk.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('Invalid ZIP: EOCD not found');

  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const _cdSize = view.getUint32(eocdOffset + 12, true);

  // Section 1: ZIP entries (before CD)
  const zipEntries = apk.slice(0, cdOffset);
  // Section 3: Central Directory
  const centralDir = apk.slice(cdOffset, eocdOffset);
  // Section 4: EOCD
  const eocd = apk.slice(eocdOffset);

  // Calculate content digests using 1MB chunks
  const CHUNK_SIZE = 1024 * 1024;
  const digests: Uint8Array[] = [];

  // Helper to compute SHA256
  const sha256 = (data: Uint8Array): Uint8Array => {
    const md = forge.md.sha256.create();
    const len = data.length;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      const end = Math.min(i + chunkSize, len);
      let chunk = '';
      for (let j = i; j < end; j++) {
        chunk += String.fromCharCode(data[j]);
      }
      md.update(chunk);
    }
    return new Uint8Array(forge.util.binary.raw.decode(md.digest().getBytes()));
  };

  // Digest section 1 (ZIP entries)
  for (let offset = 0; offset < zipEntries.length; offset += CHUNK_SIZE) {
    const chunkEnd = Math.min(offset + CHUNK_SIZE, zipEntries.length);
    const chunk = zipEntries.slice(offset, chunkEnd);
    // Chunk format: 0xa5 + 4-byte little-endian length + data
    const chunkData = new Uint8Array(5 + chunk.length);
    chunkData[0] = 0xa5;
    new DataView(chunkData.buffer).setUint32(1, chunk.length, true);
    chunkData.set(chunk, 5);
    digests.push(sha256(chunkData));
  }

  // Digest section 3 (Central Directory)
  for (let offset = 0; offset < centralDir.length; offset += CHUNK_SIZE) {
    const chunkEnd = Math.min(offset + CHUNK_SIZE, centralDir.length);
    const chunk = centralDir.slice(offset, chunkEnd);
    const chunkData = new Uint8Array(5 + chunk.length);
    chunkData[0] = 0xa5;
    new DataView(chunkData.buffer).setUint32(1, chunk.length, true);
    chunkData.set(chunk, 5);
    digests.push(sha256(chunkData));
  }

  // Pre-calculate signing block size to compute modified EOCD
  // The signing block size depends on: certificate size, signature size (256 for RSA-2048), public key size
  // We'll compute the actual size after building the blocks, but for now estimate
  // Actually, we need to include EOCD with modified offset in the digest
  // So we need to know the final signing block size first

  // For RSA-2048: signature is 256 bytes
  // We'll calculate the exact size by building the structure first without the actual signature
  const certDerForSize = getCertificateDer(key.certificate);
  const pubKeyDerForSize = getPublicKeyDer(key.certificate);

  // Calculate signing block size components:
  // digestsBlock: 4 (seq) + 4 (entry) + 4 (algo) + 4 (digest_len) + 32 (digest) = 48
  // certsBlock: 4 + 4 + certDer.length
  // attrsBlock: 4
  // signedData: 4 + digestsBlock + certsBlock + attrsBlock
  // sigsBlock: 4 (seq) + 4 (entry) + 4 (algo) + 4 (sig_len) + 256 (sig) = 272 (RSA-2048)
  // pubKeyBlock: 4 + pubKeyDer.length
  // signerBlock: 4 + signedData + sigsBlock + pubKeyBlock
  // signersBlock: 4 + signerBlock
  // v2Block: 8 (pair_size) + 4 (id) + signersBlock
  // signingBlock: 8 + v2Block + 8 + 16
  const digestsBlockSize = 4 + 4 + 4 + 4 + 32; // 48
  const certsBlockSize = 4 + 4 + certDerForSize.length;
  const attrsBlockSize = 4;
  const signedDataSize = 4 + digestsBlockSize + certsBlockSize + attrsBlockSize;
  const sigsBlockSize = 4 + 4 + 4 + 4 + 256; // 272 for RSA-2048 signature
  const pubKeyBlockSize = 4 + pubKeyDerForSize.length;
  const signerBlockSize = 4 + signedDataSize + sigsBlockSize + pubKeyBlockSize;
  const signersBlockSize = 4 + signerBlockSize;
  const v2BlockSize = 8 + 4 + signersBlockSize; // uint64 pair_size + uint32 ID + value
  const signingBlockTotalSize = 8 + v2BlockSize + 8 + 16;

  // For digest computation, EOCD's offset is treated as pointing to signing block start
  // (which is the original cdOffset, where we'll insert the signing block)
  // The actual file's EOCD will point to real CD, but digest uses signing block offset
  const eocdForDigest = new Uint8Array(eocd);
  // cdOffset is where signing block will be inserted, so EOCD offset = cdOffset for digest
  new DataView(eocdForDigest.buffer).setUint32(16, cdOffset, true);

  // Digest section 4 (EOCD with modified CD offset)
  for (let offset = 0; offset < eocdForDigest.length; offset += CHUNK_SIZE) {
    const chunkEnd = Math.min(offset + CHUNK_SIZE, eocdForDigest.length);
    const chunk = eocdForDigest.slice(offset, chunkEnd);
    const chunkData = new Uint8Array(5 + chunk.length);
    chunkData[0] = 0xa5;
    new DataView(chunkData.buffer).setUint32(1, chunk.length, true);
    chunkData.set(chunk, 5);
    digests.push(sha256(chunkData));
  }

  // Combine chunk digests into content digest
  // Format: 0x5a + 4-byte count + all digests concatenated
  const digestData = new Uint8Array(5 + digests.length * 32);
  digestData[0] = 0x5a;
  new DataView(digestData.buffer).setUint32(1, digests.length, true);
  for (let i = 0; i < digests.length; i++) {
    digestData.set(digests[i], 5 + i * 32);
  }
  const contentDigest = sha256(digestData);

  // Build signed data
  // Structure: sequence of length-prefixed digests, certificates, and additional attributes
  const certDer = getCertificateDer(key.certificate);

  // Digests: length-prefixed sequence of length-prefixed (algorithmId, digest) pairs
  // Algorithm ID: 0x0103 = RSASSA-PKCS1-v1_5 with SHA-256
  // Structure: sequence_length + [entry_length + algorithm_id + digest_length + digest]
  const digestEntrySize = 4 + 4 + 32; // algorithm_id + digest_length + digest
  const digestsBlock = new Uint8Array(4 + 4 + digestEntrySize);
  let dPos = 0;
  // Length of sequence
  new DataView(digestsBlock.buffer).setUint32(dPos, 4 + digestEntrySize, true);
  dPos += 4;
  // Entry length
  new DataView(digestsBlock.buffer).setUint32(dPos, digestEntrySize, true);
  dPos += 4;
  // Algorithm ID
  new DataView(digestsBlock.buffer).setUint32(dPos, 0x0103, true);
  dPos += 4;
  // Digest length
  new DataView(digestsBlock.buffer).setUint32(dPos, 32, true);
  dPos += 4;
  // Digest
  digestsBlock.set(contentDigest, dPos);

  // Certificates: length-prefixed sequence of DER-encoded certificates
  const certsBlock = new Uint8Array(4 + 4 + certDer.length);
  let cPos = 0;
  // Length of sequence
  new DataView(certsBlock.buffer).setUint32(cPos, 4 + certDer.length, true);
  cPos += 4;
  // Certificate length
  new DataView(certsBlock.buffer).setUint32(cPos, certDer.length, true);
  cPos += 4;
  // Certificate
  certsBlock.set(certDer, cPos);

  // Additional attributes (empty for now)
  const attrsBlock = new Uint8Array(4);
  new DataView(attrsBlock.buffer).setUint32(0, 0, true);

  // Combine into signed data content (without length prefix - that's added separately)
  const signedDataContent = new Uint8Array(digestsBlock.length + certsBlock.length + attrsBlock.length);
  let sdPos = 0;
  signedDataContent.set(digestsBlock, sdPos);
  sdPos += digestsBlock.length;
  signedDataContent.set(certsBlock, sdPos);
  sdPos += certsBlock.length;
  signedDataContent.set(attrsBlock, sdPos);

  // Sign the signed data content (RSA-PKCS1-v1_5 with SHA-256)
  // The signing algorithm hashes internally, so we feed it the raw content
  const md = forge.md.sha256.create();
  // Convert to string in chunks to avoid stack overflow
  const len = signedDataContent.length;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const end = Math.min(i + chunkSize, len);
    let chunk = '';
    for (let j = i; j < end; j++) {
      chunk += String.fromCharCode(signedDataContent[j]);
    }
    md.update(chunk);
  }
  const rsaPrivateKey = key.privateKey as unknown as forge.pki.rsa.PrivateKey;
  const signature = rsaPrivateKey.sign(md);
  const signatureBytes = new Uint8Array(forge.util.binary.raw.decode(signature));

  // Create length-prefixed signed data for the signer block
  const signedData = new Uint8Array(4 + signedDataContent.length);
  new DataView(signedData.buffer).setUint32(0, signedDataContent.length, true);
  signedData.set(signedDataContent, 4);

  // Build signatures block
  // Structure: sequence_length + [entry_length + algorithm_id + signature_length + signature]
  const sigEntrySize = 4 + 4 + signatureBytes.length; // algorithm_id + sig_length + signature
  const sigsBlock = new Uint8Array(4 + 4 + sigEntrySize);
  let sPos = 0;
  // Length of sequence
  new DataView(sigsBlock.buffer).setUint32(sPos, 4 + sigEntrySize, true);
  sPos += 4;
  // Entry length
  new DataView(sigsBlock.buffer).setUint32(sPos, sigEntrySize, true);
  sPos += 4;
  // Algorithm ID
  new DataView(sigsBlock.buffer).setUint32(sPos, 0x0103, true);
  sPos += 4;
  // Signature length
  new DataView(sigsBlock.buffer).setUint32(sPos, signatureBytes.length, true);
  sPos += 4;
  // Signature
  sigsBlock.set(signatureBytes, sPos);

  // Get public key DER
  const pubKeyDer = getPublicKeyDer(key.certificate);
  const pubKeyBlock = new Uint8Array(4 + pubKeyDer.length);
  new DataView(pubKeyBlock.buffer).setUint32(0, pubKeyDer.length, true);
  pubKeyBlock.set(pubKeyDer, 4);

  // Build signer block
  const signerBlock = new Uint8Array(4 + signedData.length + sigsBlock.length + pubKeyBlock.length);
  let signerPos = 0;
  // Length prefix
  new DataView(signerBlock.buffer).setUint32(signerPos, signedData.length + sigsBlock.length + pubKeyBlock.length, true);
  signerPos += 4;
  signerBlock.set(signedData, signerPos);
  signerPos += signedData.length;
  signerBlock.set(sigsBlock, signerPos);
  signerPos += sigsBlock.length;
  signerBlock.set(pubKeyBlock, signerPos);

  // Build signers sequence (just one signer)
  const signersBlock = new Uint8Array(4 + signerBlock.length);
  new DataView(signersBlock.buffer).setUint32(0, signerBlock.length, true);
  signersBlock.set(signerBlock, 4);

  // Build v2 signature block (ID 0x7109871a)
  // Format: uint64 pair_size + uint32 ID + value
  const v2Block = new Uint8Array(8 + 4 + signersBlock.length);
  // Pair size (uint64): ID (4 bytes) + value
  new DataView(v2Block.buffer).setBigUint64(0, BigInt(4 + signersBlock.length), true);
  // ID (uint32)
  new DataView(v2Block.buffer).setUint32(8, 0x7109871a, true);
  // Value (signers)
  v2Block.set(signersBlock, 12);

  // Build APK Signing Block
  // Structure: 8-byte size + pairs + 8-byte size + 16-byte magic
  const MAGIC = new Uint8Array([
    0x41, 0x50, 0x4b, 0x20, 0x53, 0x69, 0x67, 0x20,
    0x42, 0x6c, 0x6f, 0x63, 0x6b, 0x20, 0x34, 0x32,
  ]); // "APK Sig Block 42"

  const pairsSize = v2Block.length;
  const blockSize = pairsSize + 8 + 16; // pairs + second size + magic
  const signingBlock = new Uint8Array(8 + blockSize);
  let sbPos = 0;
  // First size
  new DataView(signingBlock.buffer).setBigUint64(sbPos, BigInt(blockSize), true);
  sbPos += 8;
  // Pairs (v2 block)
  signingBlock.set(v2Block, sbPos);
  sbPos += v2Block.length;
  // Second size
  new DataView(signingBlock.buffer).setBigUint64(sbPos, BigInt(blockSize), true);
  sbPos += 8;
  // Magic
  signingBlock.set(MAGIC, sbPos);

  // Verify size calculation matches actual size
  if (signingBlockTotalSize !== signingBlock.length) {
    throw new Error('V2 signing block size mismatch - digest will be invalid');
  }

  // Update EOCD with new CD offset (after signing block)
  const newEocd = new Uint8Array(eocd);
  new DataView(newEocd.buffer).setUint32(16, cdOffset + signingBlock.length, true);

  // Build final APK
  const result = new Uint8Array(zipEntries.length + signingBlock.length + centralDir.length + newEocd.length);
  let rPos = 0;
  result.set(zipEntries, rPos);
  rPos += zipEntries.length;
  result.set(signingBlock, rPos);
  rPos += signingBlock.length;
  result.set(centralDir, rPos);
  rPos += centralDir.length;
  result.set(newEocd, rPos);

  return result;
}

/**
 * Get certificate as DER bytes
 */
function getCertificateDer(cert: forge.pki.Certificate): Uint8Array {
  const pem = forge.pki.certificateToPem(cert);
  const base64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\r?\n/g, '');
  const der = forge.util.decode64(base64);
  return new Uint8Array(forge.util.binary.raw.decode(der));
}

/**
 * Get public key as DER bytes (SubjectPublicKeyInfo)
 */
function getPublicKeyDer(cert: forge.pki.Certificate): Uint8Array {
  const pem = forge.pki.publicKeyToPem(cert.publicKey);
  const base64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\r?\n/g, '');
  const der = forge.util.decode64(base64);
  return new Uint8Array(forge.util.binary.raw.decode(der));
}

/**
 * Sign an APK using JAR signing (v1 signature scheme)
 * This creates META-INF/MANIFEST.MF, META-INF/CERT.SF, and META-INF/CERT.RSA
 */
export async function signApk(options: SigningOptions): Promise<Blob> {
  const { key, apkData } = options;

  // Load the APK (ZIP file)
  const zip = await JSZip.loadAsync(apkData);

  // Remove any existing signatures
  zip.remove('META-INF/MANIFEST.MF');
  zip.remove('META-INF/CERT.SF');
  zip.remove('META-INF/CERT.RSA');
  zip.remove('META-INF/CERT.DSA');
  zip.remove('META-INF/CERT.EC');

  // Remove any other signature files
  const metaInfFiles = Object.keys(zip.files).filter(f =>
    f.startsWith('META-INF/') && (f.endsWith('.SF') || f.endsWith('.RSA') || f.endsWith('.DSA') || f.endsWith('.EC'))
  );
  for (const file of metaInfFiles) {
    zip.remove(file);
  }

  // Create MANIFEST.MF
  const manifest = await createManifest(zip);
  zip.file('META-INF/MANIFEST.MF', manifest, { compression: 'DEFLATE' });

  // Create CERT.SF (signature file)
  const signatureFile = createSignatureFile(manifest);
  zip.file('META-INF/CERT.SF', signatureFile, { compression: 'DEFLATE' });

  // Create CERT.RSA (PKCS#7 signature block)
  const signatureBlock = createSignatureBlock(signatureFile, key);
  zip.file('META-INF/CERT.RSA', signatureBlock, { compression: 'DEFLATE' });

  // Generate the signed APK
  // Don't use global compression - preserve original compression settings
  // This is critical for resources.arsc which must be STORE (uncompressed) on Android 11+
  const signedApkRaw = await zip.generateAsync({
    type: 'arraybuffer',
    // Use per-file compression to preserve original settings
    // resources.arsc and .so files must stay uncompressed
  });

  // Apply zipalign to ensure 4-byte alignment for uncompressed files
  // This is required for Android 11+ (API 30+)
  const alignedApk = zipalign(new Uint8Array(signedApkRaw), 4);

  // Apply APK Signature Scheme v2
  // This is required for Android 7.0+ and mandatory for Android 11+
  const v2SignedApk = applyV2Signature(alignedApk, key);

  return new Blob([v2SignedApk], { type: 'application/vnd.android.package-archive' });
}

/**
 * Create MANIFEST.MF with SHA-256 digests of all files
 */
async function createManifest(zip: JSZip): Promise<string> {
  const lines: string[] = [
    'Manifest-Version: 1.0',
    'Created-By: Shakespeare APK Signer',
    '',
  ];

  // Get all files (excluding META-INF directory)
  const files = Object.keys(zip.files)
    .filter(name => !zip.files[name].dir && !name.startsWith('META-INF/'))
    .sort();

  for (const fileName of files) {
    const file = zip.files[fileName];
    const content = await file.async('uint8array');
    const digest = sha256Base64(content);

    lines.push(`Name: ${fileName}`);
    lines.push(`SHA-256-Digest: ${digest}`);
    lines.push('');
  }

  return lines.join('\r\n');
}

/**
 * Create CERT.SF (signature file) with digests of manifest sections
 */
function createSignatureFile(manifest: string): string {
  const lines: string[] = [
    'Signature-Version: 1.0',
    'Created-By: Shakespeare APK Signer',
    `SHA-256-Digest-Manifest: ${sha256Base64(new TextEncoder().encode(manifest))}`,
    '',
  ];

  // Parse manifest sections and create digests for each
  const sections = manifest.split('\r\n\r\n');

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    if (!section.trim()) continue;

    // Extract the Name attribute
    const nameMatch = section.match(/^Name: (.+)$/m);
    if (nameMatch) {
      const sectionWithNewline = section + '\r\n\r\n';
      const digest = sha256Base64(new TextEncoder().encode(sectionWithNewline));

      lines.push(`Name: ${nameMatch[1]}`);
      lines.push(`SHA-256-Digest: ${digest}`);
      lines.push('');
    }
  }

  return lines.join('\r\n');
}

/**
 * Create CERT.RSA (PKCS#7 signature block)
 */
function createSignatureBlock(signatureFile: string, key: SigningKey): Uint8Array {
  const { privateKey, certificate } = key;

  // Create SHA-256 digest of the signature file
  const md = forge.md.sha256.create();
  md.update(signatureFile, 'utf8');

  // Sign the digest directly with RSA
  // Type assertion needed due to node-forge type definition issues
  const rsaPrivateKey = privateKey as unknown as forge.pki.rsa.PrivateKey;
  const signature = rsaPrivateKey.sign(md);

  // Build PKCS#7 SignedData structure manually
  // This avoids the recursion issues in forge.pkcs7
  // Use PEM->DER conversion to avoid certificateToAsn1 recursion issues
  const certPem = forge.pki.certificateToPem(certificate);

  const certDerBase64 = certPem
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\r?\n/g, '');

  const certDer = forge.util.decode64(certDerBase64);

  const certAsn1 = forge.asn1.fromDer(certDer);

  // Build issuer DN ASN.1
  let issuerAsn1;
  if (certificate.issuer.attributes.length > 0) {
    issuerAsn1 = forge.pki.distinguishedNameToAsn1(certificate.issuer);
  } else {
    issuerAsn1 = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, []);
  }

  const signerInfo = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    // version
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false,
      forge.asn1.integerToDer(1).getBytes()),
    // issuerAndSerialNumber
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      // issuer
      issuerAsn1,
      // serialNumber
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false,
        forge.util.hexToBytes(certificate.serialNumber)),
    ]),
    // digestAlgorithm (SHA-256)
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
        forge.asn1.oidToDer('2.16.840.1.101.3.4.2.1').getBytes()),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ''),
    ]),
    // digestEncryptionAlgorithm (RSA)
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
        forge.asn1.oidToDer('1.2.840.113549.1.1.1').getBytes()),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ''),
    ]),
    // encryptedDigest (the signature)
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false, signature),
  ]);

  const signedData = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    // version
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false,
      forge.asn1.integerToDer(1).getBytes()),
    // digestAlgorithms
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
          forge.asn1.oidToDer('2.16.840.1.101.3.4.2.1').getBytes()),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ''),
      ]),
    ]),
    // contentInfo (empty for detached signature)
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
        forge.asn1.oidToDer('1.2.840.113549.1.7.1').getBytes()),
    ]),
    // certificates (implicit tag 0)
    forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [certAsn1]),
    // signerInfos
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [signerInfo]),
  ]);

  // Wrap in ContentInfo
  const contentInfo = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    // contentType (signedData)
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
      forge.asn1.oidToDer('1.2.840.113549.1.7.2').getBytes()),
    // content
    forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [signedData]),
  ]);

  const der = forge.asn1.toDer(contentInfo);

  return new Uint8Array(forge.util.binary.raw.decode(der.getBytes()));
}

/**
 * Calculate SHA-256 hash and return as base64
 */
function sha256Base64(data: Uint8Array): string {
  const md = forge.md.sha256.create();
  // forge.util.binary.raw.encode uses String.fromCharCode.apply which causes
  // stack overflow for large arrays. Build string manually.
  const len = data.length;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const end = Math.min(i + chunkSize, len);
    let chunk = '';
    for (let j = i; j < end; j++) {
      chunk += String.fromCharCode(data[j]);
    }
    md.update(chunk);
  }
  const digest = md.digest();
  return forge.util.encode64(digest.getBytes());
}

/**
 * Generate a new signing key pair and self-signed certificate
 */
export function generateSigningKey(options: {
  commonName: string;
  organizationName?: string;
  countryCode?: string;
  validityYears?: number;
  alias?: string;
}): SigningKey {
  const {
    commonName,
    organizationName = 'Shakespeare',
    countryCode = 'US',
    validityYears = 25,
    alias = 'key0',
  } = options;

  // Generate RSA key pair
  const keys = forge.pki.rsa.generateKeyPair(2048);

  // Create certificate
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(8));

  // Set validity
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + validityYears);

  // Set subject/issuer attributes
  const attrs = [
    { name: 'commonName', value: commonName },
    { name: 'organizationName', value: organizationName },
    { name: 'countryName', value: countryCode },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  // Set extensions
  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: false,
    },
    {
      name: 'keyUsage',
      digitalSignature: true,
      keyEncipherment: true,
    },
    {
      name: 'extKeyUsage',
      codeSigning: true,
    },
  ]);

  // Self-sign the certificate
  cert.sign(keys.privateKey, forge.md.sha256.create());

  return {
    privateKey: keys.privateKey,
    certificate: cert,
    alias,
  };
}

/**
 * Export signing key to PKCS#12 format (.p12)
 */
export function exportKeyToPkcs12(key: SigningKey, password: string): Uint8Array {
  // Type assertion needed due to node-forge type definition issues
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    key.privateKey as unknown as Parameters<typeof forge.pkcs12.toPkcs12Asn1>[0],
    [key.certificate],
    password,
    {
      friendlyName: key.alias,
      algorithm: '3des', // Use 3DES for compatibility
    }
  );

  const p12Der = forge.asn1.toDer(p12Asn1);
  return new Uint8Array(forge.util.binary.raw.decode(p12Der.getBytes()));
}

/**
 * Import signing key from PKCS#12 format (.p12 / .pfx)
 */
export function importKeyFromPkcs12(data: ArrayBuffer, password: string): SigningKey {
  const p12Der = forge.util.binary.raw.encode(new Uint8Array(data));
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  // Find the private key and certificate
  let privateKey: forge.pki.PrivateKey | null = null;
  let certificate: forge.pki.Certificate | null = null;
  let alias = 'key0';

  for (const safeContents of p12.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag && safeBag.key) {
        privateKey = safeBag.key;
        if (safeBag.attributes?.friendlyName?.[0]) {
          alias = safeBag.attributes.friendlyName[0];
        }
      } else if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
        certificate = safeBag.cert;
      }
    }
  }

  if (!privateKey || !certificate) {
    throw new Error('Could not find private key and certificate in PKCS#12 file');
  }

  return { privateKey, certificate, alias };
}

/**
 * Check if data is a JKS (Java KeyStore) file and throw helpful error
 * Note: JKS is a proprietary format. For best compatibility, convert to PKCS#12 first:
 * keytool -importkeystore -srckeystore keystore.jks -destkeystore keystore.p12 -deststoretype PKCS12
 */
export function checkJksAndThrow(data: ArrayBuffer): never {
  const view = new DataView(data);

  // JKS magic number: 0xFEEDFEED
  const magic = view.getUint32(0, false);
  if (magic === 0xFEEDFEED) {
    throw new Error(
      'JKS format is not directly supported. Please convert to PKCS#12 format using:\n' +
      'keytool -importkeystore -srckeystore keystore.jks -destkeystore keystore.p12 -deststoretype PKCS12'
    );
  }

  throw new Error('Unknown keystore format. Please use PKCS#12 (.p12 / .pfx) format.');
}
