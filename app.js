const fileInput = document.querySelector('#file-input');
const dropZone = document.querySelector('#drop-zone');
const canvas = document.querySelector('#preview-canvas');
const ctx = canvas.getContext('2d');
const emptyState = document.querySelector('#empty-state');
const fileSummary = document.querySelector('#file-summary');
const fileList = document.querySelector('#file-list');
const exportButton = document.querySelector('#export-button');
const exportStatus = document.querySelector('#export-status');
const validationMessage = document.querySelector('#validation-message');
const cropFields = {
  x: document.querySelector('#crop-x'),
  y: document.querySelector('#crop-y'),
  width: document.querySelector('#crop-width'),
  height: document.querySelector('#crop-height'),
};

let files = [];
let dimensions = [];
let referenceImage = null;
let imageBounds = null;
let crop = null;
let dragStart = null;
let draftCrop = null;
let isExporting = false;

function showMessage(message, isError = false) {
  validationMessage.textContent = message;
  validationMessage.classList.toggle('error', isError);
}

function drawPreview() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f3f5ef';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!referenceImage) return;

  const scale = Math.min(canvas.width / referenceImage.width, canvas.height / referenceImage.height);
  const width = referenceImage.width * scale;
  const height = referenceImage.height * scale;
  const left = (canvas.width - width) / 2;
  const top = (canvas.height - height) / 2;
  imageBounds = { left, top, width, height, scale };
  ctx.drawImage(referenceImage, left, top, width, height);

  const visibleCrop = draftCrop || crop;
  if (!visibleCrop) return;
  const selection = {
    x: left + visibleCrop.x * scale,
    y: top + visibleCrop.y * scale,
    width: visibleCrop.width * scale,
    height: visibleCrop.height * scale,
  };
  ctx.fillStyle = 'rgba(20, 33, 22, .48)';
  ctx.fillRect(left, top, width, height);
  ctx.clearRect(selection.x, selection.y, selection.width, selection.height);
  ctx.drawImage(referenceImage, visibleCrop.x, visibleCrop.y, visibleCrop.width, visibleCrop.height,
    selection.x, selection.y, selection.width, selection.height);
  ctx.strokeStyle = '#d9efc8';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 5]);
  ctx.strokeRect(selection.x, selection.y, selection.width, selection.height);
  ctx.setLineDash([]);
}

function isValidCrop(candidate) {
  if (!referenceImage || !candidate) return false;
  const { x, y, width, height } = candidate;
  return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(width) && Number.isInteger(height)
    && x >= 0 && y >= 0 && width > 0 && height > 0
    && x + width <= referenceImage.width && y + height <= referenceImage.height;
}

function refreshExportState() {
  const sameSize = dimensions.length === files.length && dimensions.length > 0
    && dimensions.every((item) => item.width === dimensions[0].width && item.height === dimensions[0].height);
  const canExport = files.length > 0 && sameSize && isValidCrop(crop) && !isExporting;
  exportButton.disabled = !canExport;
  if (files.length && !sameSize) {
    showMessage('Photos have different pixel dimensions. Use a same-size series for an identical pixel crop.', true);
  }
  document.querySelector('#dimension-note').textContent = referenceImage
    ? `${referenceImage.width} × ${referenceImage.height} px · crop must fit every photo`
    : 'Select photos to begin.';
}

function setCrop(nextCrop) {
  crop = nextCrop;
  draftCrop = null;
  for (const [key, input] of Object.entries(cropFields)) input.value = crop?.[key] ?? 0;
  drawPreview();
  refreshExportState();
}

function renderFileList() {
  fileSummary.hidden = files.length === 0;
  document.querySelector('#file-count').textContent = `${files.length} photo${files.length === 1 ? '' : 's'} selected`;
  fileList.replaceChildren();
  files.slice(0, 5).forEach((file) => {
    const row = document.createElement('div');
    row.className = 'file-row';
    const bullet = document.createElement('span');
    bullet.className = 'file-bullet';
    bullet.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.textContent = file.name;
    row.append(bullet, name);
    fileList.append(row);
  });
  if (files.length > 5) {
    const more = document.createElement('div');
    more.className = 'file-row';
    more.textContent = `and ${files.length - 5} more…`;
    fileList.append(more);
  }
}

async function useFiles(selectedFiles) {
  const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const imageFiles = [...selectedFiles].filter((file) => supportedTypes.has(file.type));
  if (!imageFiles.length) {
    showMessage('Choose JPG, PNG, or WebP images to start.', true);
    return;
  }
  files = imageFiles;
  dimensions = [];
  referenceImage?.close?.();
  referenceImage = null;
  imageBounds = null;
  setCrop(null);
  document.querySelector('#preview-title').textContent = imageFiles[0].name;
  document.querySelector('#preview-dimensions').textContent = 'Reading image dimensions…';
  showMessage('Checking photo dimensions…');
  renderFileList();
  for (const input of Object.values(cropFields)) input.disabled = true;
  refreshExportState();

  try {
    for (const file of files) {
      const bitmap = await createImageBitmap(file);
      dimensions.push({ width: bitmap.width, height: bitmap.height });
      bitmap.close();
    }
    referenceImage = await createImageBitmap(files[0]);
    emptyState.hidden = true;
    for (const input of Object.values(cropFields)) input.disabled = false;
    const sameSize = dimensions.every((item) => item.width === dimensions[0].width && item.height === dimensions[0].height);
    document.querySelector('#preview-dimensions').textContent = `${files.length} photo${files.length === 1 ? '' : 's'} · ${referenceImage.width} × ${referenceImage.height} px`;
    showMessage(sameSize ? 'All photos match in size. Set the crop to continue.' : 'The series contains mixed sizes; identical pixel crops require matching dimensions.', !sameSize);
    drawPreview();
    refreshExportState();
  } catch (error) {
    showMessage(`Could not read an image: ${error.message}`, true);
    document.querySelector('#preview-dimensions').textContent = 'Could not read photos';
  }
}

fileInput.addEventListener('change', (event) => {
  if (event.target.files?.length) useFiles(event.target.files);
  fileInput.value = '';
});

document.querySelector('#clear-files').addEventListener('click', () => {
  files = [];
  dimensions = [];
  referenceImage?.close?.();
  referenceImage = null;
  imageBounds = null;
  setCrop(null);
  emptyState.hidden = false;
  fileSummary.hidden = true;
  document.querySelector('#preview-title').textContent = 'Your reference image';
  document.querySelector('#preview-dimensions').textContent = 'Waiting for photos';
  for (const input of Object.values(cropFields)) input.disabled = true;
  showMessage('Select photos to begin.');
  drawPreview();
  refreshExportState();
});

for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('dragging');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragging');
  });
}
dropZone.addEventListener('drop', (event) => {
  if (event.dataTransfer?.files.length) useFiles(event.dataTransfer.files);
});

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
}

canvas.addEventListener('pointerdown', (event) => {
  if (!imageBounds || !referenceImage) return;
  const point = canvasPoint(event);
  const { left, top, width, height } = imageBounds;
  if (point.x < left || point.x > left + width || point.y < top || point.y > top + height) return;
  const x = Math.round((point.x - left) / imageBounds.scale);
  const y = Math.round((point.y - top) / imageBounds.scale);
  dragStart = { x, y };
  draftCrop = { x, y, width: 1, height: 1 };
  canvas.setPointerCapture(event.pointerId);
  drawPreview();
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragStart || !imageBounds) return;
  const point = canvasPoint(event);
  const x = Math.max(0, Math.min(referenceImage.width, Math.round((point.x - imageBounds.left) / imageBounds.scale)));
  const y = Math.max(0, Math.min(referenceImage.height, Math.round((point.y - imageBounds.top) / imageBounds.scale)));
  const left = Math.min(dragStart.x, x);
  const top = Math.min(dragStart.y, y);
  draftCrop = { x: left, y: top, width: Math.abs(x - dragStart.x), height: Math.abs(y - dragStart.y) };
  drawPreview();
});

canvas.addEventListener('pointerup', () => {
  if (!dragStart) return;
  dragStart = null;
  if (draftCrop?.width > 0 && draftCrop?.height > 0) setCrop(draftCrop);
  else { draftCrop = null; drawPreview(); }
});

for (const input of Object.values(cropFields)) {
  input.addEventListener('change', () => {
    const next = Object.fromEntries(Object.entries(cropFields).map(([key, field]) => [key, Math.trunc(Number(field.value))]));
    if (!isValidCrop(next)) {
      showMessage('Crop values must be positive and stay inside the reference image.', true);
      return;
    }
    showMessage('Crop set. The same pixel area will be used for every photo.');
    setCrop(next);
  });
}

function safeName(name) {
  const stem = name.replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return stem || 'photo';
}
function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
function toBlob(canvasElement, type) {
  return new Promise((resolve, reject) => canvasElement.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not encode a PNG crop.')), type));
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
  }
  return (crc ^ -1) >>> 0;
}
function joinBytes(parts) {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
function zipStore(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const checksum = crc32(entry.bytes);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true); lv.setUint16(10, dosTime, true); lv.setUint16(12, dosDate, true);
    lv.setUint32(14, checksum, true); lv.setUint32(18, entry.bytes.length, true); lv.setUint32(22, entry.bytes.length, true);
    lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true); local.set(name, 30);
    localParts.push(local, entry.bytes);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, dosTime, true); cv.setUint16(14, dosDate, true);
    cv.setUint32(16, checksum, true); cv.setUint32(20, entry.bytes.length, true); cv.setUint32(24, entry.bytes.length, true);
    cv.setUint16(28, name.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true); cv.setUint32(42, offset, true); central.set(name, 46);
    centralParts.push(central);
    offset += local.length + entry.bytes.length;
  }
  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true); ev.setUint16(20, 0, true);
  return joinBytes([...localParts, ...centralParts, end]);
}

async function exportDataset() {
  if (exportButton.disabled || !isValidCrop(crop)) return;
  isExporting = true;
  exportButton.disabled = true;
  exportStatus.textContent = 'Preparing crops…';
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = crop.width;
  outputCanvas.height = crop.height;
  const outputContext = outputCanvas.getContext('2d', { alpha: false });
  const entries = [];
  const manifest = [['output_filename', 'source_filename', 'source_last_modified_utc', 'source_width_px', 'source_height_px', 'crop_x_px', 'crop_y_px', 'crop_width_px', 'crop_height_px']];

  try {
    for (let index = 0; index < files.length; index += 1) {
      const bitmap = await createImageBitmap(files[index]);
      outputContext.clearRect(0, 0, crop.width, crop.height);
      outputContext.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
      bitmap.close();
      const blob = await toBlob(outputCanvas, 'image/png');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const outputName = `crop_${String(index + 1).padStart(4, '0')}_${safeName(files[index].name)}.png`;
      entries.push({ name: `crops/${outputName}`, bytes });
      manifest.push([outputName, files[index].name, files[index].lastModified ? new Date(files[index].lastModified).toISOString() : '', dimensions[index].width, dimensions[index].height, crop.x, crop.y, crop.width, crop.height]);
      exportStatus.textContent = `Cropping ${index + 1} of ${files.length}…`;
    }
    const csv = '\ufeff' + manifest.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
    entries.push({ name: 'manifest.csv', bytes: new TextEncoder().encode(csv) });
    const zipBytes = zipStore(entries);
    const zipBlob = new Blob([zipBytes], { type: 'application/zip' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `image-crop-dataset-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    exportStatus.textContent = `Done — ${files.length} PNG crops and manifest exported.`;
  } catch (error) {
    exportStatus.textContent = `Export failed: ${error.message}`;
  } finally {
    isExporting = false;
    refreshExportState();
  }
}

exportButton.addEventListener('click', exportDataset);
window.addEventListener('resize', drawPreview);
drawPreview();
refreshExportState();
