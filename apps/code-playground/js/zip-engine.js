/**
 * Aksh Code Playground — Pure Client-Side ZIP Engine
 * Generates and parses real .zip archives compliant with PKWARE ZIP Specification.
 * Supports Store (method 0) and Deflate (method 8 via native DecompressionStream / CompressionStream).
 * Zero server dependencies, zero external libraries.
 */

(function (window) {
  'use strict';

  // CRC-32 Lookup Table
  const CRC32_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
    return table;
  })();

  function computeCRC32(uint8Array) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < uint8Array.length; i++) {
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ uint8Array[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function encodeUTF8(str) {
    return new TextEncoder().encode(str);
  }

  function decodeUTF8(uint8Array) {
    return new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
  }

  function getDosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = Math.floor(date.getSeconds() / 2);

    const dosDate = ((year - 1980) << 9) | (month << 5) | day;
    const dosTime = (hours << 11) | (minutes << 5) | seconds;
    return { dosDate, dosTime };
  }

  /**
   * Sanitizes and validates a virtual archive file path.
   * Protects against directory traversal and malicious paths.
   */
  function sanitizePath(path) {
    if (!path || typeof path !== 'string') return '';
    // Normalize slashes
    let clean = path.replace(/\\/g, '/').trim();
    // Remove leading slashes and drive letters (e.g. C:/)
    clean = clean.replace(/^[a-zA-Z]:\/?/, '').replace(/^\/+/, '');
    // Split segments and filter out '.' and '..'
    const segments = clean.split('/').filter(s => s && s !== '.');
    const safeSegments = [];
    for (const segment of segments) {
      if (segment === '..') {
        // Prevent going above root
        if (safeSegments.length > 0) safeSegments.pop();
      } else if (!segment.includes('\0') && !/[\r\n]/.test(segment)) {
        safeSegments.push(segment);
      }
    }
    return safeSegments.join('/');
  }

  /**
   * Generates a real PKWARE ZIP file from an array of files.
   * @param {Array<{path: string, content: string|Uint8Array, isBinary?: boolean}>} files
   * @param {Object} options
   * @returns {Promise<Blob>}
   */
  async function createZip(files, options = {}) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('Cannot export an empty project to ZIP. Add at least one file.');
    }

    const { dosDate, dosTime } = getDosDateTime(options.date || new Date());
    const fileEntries = [];
    let localHeadersSize = 0;
    let centralDirSize = 0;

    for (const file of files) {
      const cleanPath = sanitizePath(file.path || file.name);
      if (!cleanPath) continue;

      let fileBytes;
      if (file.content instanceof Uint8Array) {
        fileBytes = file.content;
      } else if (typeof file.content === 'string') {
        if (file.isBinary && file.content.startsWith('data:')) {
          // Base64 Data URL to binary bytes
          const base64 = file.content.split(',')[1] || '';
          const binStr = atob(base64);
          fileBytes = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) {
            fileBytes[i] = binStr.charCodeAt(i);
          }
        } else {
          fileBytes = encodeUTF8(file.content);
        }
      } else {
        fileBytes = new Uint8Array(0);
      }

      const pathBytes = encodeUTF8(cleanPath);
      const crc = computeCRC32(fileBytes);
      const uncompressedSize = fileBytes.length;
      const compressedSize = uncompressedSize; // Store method 0
      const compressionMethod = 0; // Store (universally compatible)

      fileEntries.push({
        pathBytes,
        fileBytes,
        crc,
        uncompressedSize,
        compressedSize,
        compressionMethod,
        localHeaderOffset: 0
      });

      // 30 bytes local header + pathBytes.length + data
      localHeadersSize += 30 + pathBytes.length + uncompressedSize;
      // 46 bytes central header + pathBytes.length
      centralDirSize += 46 + pathBytes.length;
    }

    if (fileEntries.length === 0) {
      throw new Error('No valid files were found to export.');
    }

    // 22 bytes EOCD
    const totalBufferSize = localHeadersSize + centralDirSize + 22;
    const buffer = new ArrayBuffer(totalBufferSize);
    const view = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);

    let offset = 0;

    // 1. Write Local File Headers and Data
    for (const entry of fileEntries) {
      entry.localHeaderOffset = offset;

      // Local Header Signature: 0x04034b50
      view.setUint32(offset, 0x04034b50, true);
      view.setUint16(offset + 4, 20, true);         // Version needed: 2.0
      view.setUint16(offset + 6, 0x0800, true);     // General purpose flag: bit 11 (UTF-8)
      view.setUint16(offset + 8, entry.compressionMethod, true); // Compression method
      view.setUint16(offset + 10, dosTime, true);   // Last mod time
      view.setUint16(offset + 12, dosDate, true);   // Last mod date
      view.setUint32(offset + 14, entry.crc, true); // CRC-32
      view.setUint32(offset + 18, entry.compressedSize, true);   // Comp size
      view.setUint32(offset + 22, entry.uncompressedSize, true); // Uncomp size
      view.setUint16(offset + 26, entry.pathBytes.length, true); // Filename length
      view.setUint16(offset + 28, 0, true);                      // Extra field length
      offset += 30;

      // Filename bytes
      uint8.set(entry.pathBytes, offset);
      offset += entry.pathBytes.length;

      // File Data bytes
      uint8.set(entry.fileBytes, offset);
      offset += entry.fileBytes.length;
    }

    const centralDirOffset = offset;

    // 2. Write Central Directory Headers
    for (const entry of fileEntries) {
      // Central Directory Header Signature: 0x02014b50
      view.setUint32(offset, 0x02014b50, true);
      view.setUint16(offset + 4, 20, true);         // Version made by: 2.0
      view.setUint16(offset + 6, 20, true);         // Version needed: 2.0
      view.setUint16(offset + 8, 0x0800, true);     // General purpose flag (UTF-8)
      view.setUint16(offset + 10, entry.compressionMethod, true); // Method
      view.setUint16(offset + 12, dosTime, true);   // Time
      view.setUint16(offset + 14, dosDate, true);   // Date
      view.setUint32(offset + 16, entry.crc, true); // CRC-32
      view.setUint32(offset + 20, entry.compressedSize, true);
      view.setUint32(offset + 24, entry.uncompressedSize, true);
      view.setUint16(offset + 28, entry.pathBytes.length, true); // Filename length
      view.setUint16(offset + 30, 0, true);         // Extra field length
      view.setUint16(offset + 32, 0, true);         // File comment length
      view.setUint16(offset + 34, 0, true);         // Disk number start
      view.setUint16(offset + 36, 0, true);         // Internal file attributes
      view.setUint32(offset + 38, 0x81a40000, true); // External file attributes (regular file 0644)
      view.setUint32(offset + 42, entry.localHeaderOffset, true); // Relative offset of local header
      offset += 46;

      // Filename bytes
      uint8.set(entry.pathBytes, offset);
      offset += entry.pathBytes.length;
    }

    const actualCentralDirSize = offset - centralDirOffset;

    // 3. Write End of Central Directory Record (EOCD)
    // Signature: 0x06054b50
    view.setUint32(offset, 0x06054b50, true);
    view.setUint16(offset + 4, 0, true);                  // Disk number
    view.setUint16(offset + 6, 0, true);                  // Start disk
    view.setUint16(offset + 8, fileEntries.length, true); // Entries on disk
    view.setUint16(offset + 10, fileEntries.length, true);// Total entries
    view.setUint32(offset + 12, actualCentralDirSize, true); // Size of central dir
    view.setUint32(offset + 16, centralDirOffset, true);    // Offset of central dir
    view.setUint16(offset + 20, 0, true);                 // Comment length

    return new Blob([buffer], { type: 'application/zip' });
  }

  /**
   * Reads and extracts all entries from a ZIP archive ArrayBuffer.
   * Supports Store (method 0) and Deflate (method 8).
   * Validates safety, prevents path traversal, and enforces limits.
   * @param {ArrayBuffer} arrayBuffer
   * @returns {Promise<Array<{path: string, name: string, content: string, size: number, isBinary: boolean}>>}
   */
  async function readZip(arrayBuffer) {
    if (!arrayBuffer || arrayBuffer.byteLength < 22) {
      throw new Error('Invalid file: too small to be a valid ZIP archive.');
    }

    const view = new DataView(arrayBuffer);
    const uint8 = new Uint8Array(arrayBuffer);
    const totalLen = arrayBuffer.byteLength;

    // Search backwards for End of Central Directory signature: 0x06054b50
    let eocdOffset = -1;
    const maxSearch = Math.min(totalLen, 65557);
    for (let i = totalLen - 22; i >= totalLen - maxSearch; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }

    if (eocdOffset === -1) {
      throw new Error('Invalid archive: End of Central Directory record not found.');
    }

    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const centralDirSize = view.getUint32(eocdOffset + 12, true);
    const centralDirOffset = view.getUint32(eocdOffset + 16, true);

    if (totalEntries > 500) {
      throw new Error(`Archive exceeds maximum allowable file count (500 files, found ${totalEntries}).`);
    }

    if (centralDirOffset + centralDirSize > totalLen) {
      throw new Error('Malformed ZIP archive: central directory extends beyond file bounds.');
    }

    const extractedFiles = [];
    let cdPtr = centralDirOffset;
    let totalUncompressedSize = 0;
    const MAX_TOTAL_UNCOMPRESSED = 60 * 1024 * 1024; // 60MB max safety limit

    for (let e = 0; e < totalEntries; e++) {
      if (cdPtr + 46 > totalLen) break;

      const sig = view.getUint32(cdPtr, true);
      if (sig !== 0x02014b50) {
        throw new Error(`Corrupt central directory record at index ${e}.`);
      }

      const method = view.getUint16(cdPtr + 10, true);
      const crc = view.getUint32(cdPtr + 16, true);
      const compressedSize = view.getUint32(cdPtr + 20, true);
      const uncompressedSize = view.getUint32(cdPtr + 24, true);
      const fnLen = view.getUint16(cdPtr + 28, true);
      const extraLen = view.getUint16(cdPtr + 30, true);
      const commentLen = view.getUint16(cdPtr + 32, true);
      const localHeaderOffset = view.getUint32(cdPtr + 42, true);

      const rawFnBytes = uint8.subarray(cdPtr + 46, cdPtr + 46 + fnLen);
      const rawPath = decodeUTF8(rawFnBytes);
      cdPtr += 46 + fnLen + extraLen + commentLen;

      // Skip directories or empty names
      if (rawPath.endsWith('/') || rawPath.endsWith('\\')) continue;

      // Skip macOS system files
      if (rawPath.startsWith('__MACOSX/') || rawPath.includes('/.DS_Store') || rawPath === '.DS_Store') {
        continue;
      }

      const safePath = sanitizePath(rawPath);
      if (!safePath) continue;

      totalUncompressedSize += uncompressedSize;
      if (totalUncompressedSize > MAX_TOTAL_UNCOMPRESSED) {
        throw new Error('Archive exceeds maximum extraction limit (60MB uncompressed). Possible zip bomb.');
      }

      // Read from local file header
      if (localHeaderOffset + 30 > totalLen) {
        throw new Error(`Malformed local header for "${safePath}".`);
      }

      const localSig = view.getUint32(localHeaderOffset, true);
      if (localSig !== 0x04034b50) {
        throw new Error(`Invalid local header signature for "${safePath}".`);
      }

      const localFnLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localFnLen + localExtraLen;
      const dataEnd = dataStart + compressedSize;

      if (dataEnd > totalLen) {
        throw new Error(`Data for "${safePath}" extends beyond file bounds.`);
      }

      const compressedBytes = uint8.subarray(dataStart, dataEnd);
      let decompressedBytes;

      if (uncompressedSize === 0 || compressedBytes.length === 0) {
        // Zero-byte entry (e.g. empty file or directory marker)
        decompressedBytes = new Uint8Array(0);
      } else if (method === 0) {
        // Store (uncompressed)
        decompressedBytes = compressedBytes;
      } else if (method === 8) {
        // Deflate
        if (typeof DecompressionStream !== 'undefined') {
          decompressedBytes = await decompressDeflateRaw(compressedBytes);
        } else {
          throw new Error(`Deflate compression unsupported in this environment for "${safePath}".`);
        }
      } else {
        throw new Error(`Unsupported compression method (${method}) for "${safePath}".`);
      }

      // Verify CRC if available
      if (crc !== 0 && uncompressedSize > 0 && computeCRC32(decompressedBytes) !== crc) {
        console.warn(`CRC mismatch for ${safePath}, file might be corrupted.`);
      }

      // Determine text vs binary by checking extension or byte content
      const isBinary = isBinaryFile(safePath, decompressedBytes);
      let content;
      if (isBinary) {
        // Convert to Base64 Data URL
        content = toDataURL(safePath, decompressedBytes);
      } else {
        content = decodeUTF8(decompressedBytes);
      }

      const filename = safePath.split('/').pop();
      extractedFiles.push({
        path: safePath,
        name: filename,
        content: content,
        size: decompressedBytes.length,
        isBinary: isBinary
      });
    }

    return extractedFiles;
  }

  async function decompressDeflateRaw(compressedBytes) {
    const ds = new DecompressionStream('deflate-raw');
    const response = new Response(new Blob([compressedBytes]).stream().pipeThrough(ds));
    const arrayBuf = await response.arrayBuffer();
    return new Uint8Array(arrayBuf);
  }

  function isBinaryFile(filename, uint8) {
    const binaryExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'svgz', 'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp3', 'wav', 'ogg', 'mp4', 'webm', 'zip', 'tar', 'gz', 'pdf'];
    const ext = filename.split('.').pop().toLowerCase();
    if (binaryExts.includes(ext)) return true;

    // Check sample of first 512 bytes for null bytes or control chars
    const sampleLen = Math.min(uint8.length, 512);
    for (let i = 0; i < sampleLen; i++) {
      if (uint8[i] === 0) return true;
    }
    return false;
  }

  function toDataURL(filename, uint8) {
    const ext = filename.split('.').pop().toLowerCase();
    let mime = 'application/octet-stream';
    if (ext === 'png') mime = 'image/png';
    else if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
    else if (ext === 'gif') mime = 'image/gif';
    else if (ext === 'webp') mime = 'image/webp';
    else if (ext === 'svg') mime = 'image/svg+xml';
    else if (ext === 'ico') mime = 'image/x-icon';

    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      const chunk = uint8.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return `data:${mime};base64,${btoa(binary)}`;
  }

  function downloadZipBlob(blob, filename = 'project.zip') {
    const cleanFilename = filename.endsWith('.zip') ? filename : `${filename}.zip`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  function isZipArchive(filename) {
    return typeof filename === 'string' && filename.toLowerCase().endsWith('.zip');
  }

  function generateProjectReadme(projectName, files = []) {
    let md = `# ${projectName || 'Aksh Project'}\n\n`;
    md += `Generated by **Aksh Code Playground Pro** — Browser-Native Development Studio.\n\n`;
    md += `## Project Overview\n\n`;
    md += `- **Files Count**: ${files.length}\n`;
    md += `- **Export Date**: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n\n`;
    md += `## File Tree\n\n`;
    files.forEach(f => {
      md += `- \`${f.path || f.name}\`\n`;
    });
    md += `\n## Running the Project Locally\n\n`;
    md += `Open \`index.html\` directly in any modern browser, or launch a local static HTTP server:\n\n`;
    md += `\`\`\`bash\n# Python 3\npython -m http.server 8000\n\`\`\`\n\n`;
    md += `Then navigate to \`http://localhost:8000\`.\n`;
    return md;
  }

  // Export to window
  window.AkshZip = {
    createZip,
    readZip,
    downloadZipBlob,
    isZipArchive,
    sanitizePath,
    generateProjectReadme
  };

})(window);
