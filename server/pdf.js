'use strict';
// A very small PDF writer (text, lines, boxes) — enough for invoices, shipping labels and statements without dependencies.
function latin(text) {
  return String(text == null ? '' : text).replace(/₹/g, 'Rs. ').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/•/g, '*').replace(/×/g, 'x')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
}
const esc = (text) => latin(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
// Approximate Helvetica advance widths (per 1000 units) for alignment and wrapping.
function textWidth(text, size, bold) {
  let w = 0;
  for (const ch of latin(text)) {
    if ('il.,:;|!\'j'.includes(ch)) w += 250; else if ('ftr()[]-/ '.includes(ch)) w += 310; else if ('mwMW@%'.includes(ch)) w += 860;
    else if (/[A-Z]/.test(ch)) w += 690; else w += 545;
  }
  return (w * size * (bold ? 1.06 : 1)) / 1000;
}

class Pdf {
  constructor({ width = 595, height = 842 } = {}) { this.width = width; this.height = height; this.pages = []; this.addPage(); }
  addPage() { this.ops = []; this.pages.push(this.ops); return this; }
  // Coordinates are from the top-left corner, in points.
  text(x, y, text, { size = 10, bold = false, align = 'left', color = 0 } = {}) {
    let tx = x;
    if (align === 'right') tx = x - textWidth(text, size, bold); else if (align === 'center') tx = x - textWidth(text, size, bold) / 2;
    this.ops.push(`BT ${color} g /${bold ? 'F2' : 'F1'} ${size} Tf ${tx.toFixed(2)} ${(this.height - y).toFixed(2)} Td (${esc(text)}) Tj ET`);
    return this;
  }
  wrap(x, y, text, maxWidth, { size = 10, bold = false, lineHeight } = {}) {
    const lh = lineHeight || size * 1.35;
    let line = '';
    let cy = y;
    for (const word of latin(text).split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size, bold) > maxWidth && line) { this.text(x, cy, line, { size, bold }); cy += lh; line = word; } else line = candidate;
    }
    if (line) { this.text(x, cy, line, { size, bold }); cy += lh; }
    return cy;
  }
  line(x1, y1, x2, y2, width = 0.6, gray = 0.75) { this.ops.push(`${gray} G ${width} w ${x1} ${this.height - y1} m ${x2} ${this.height - y2} l S`); return this; }
  rect(x, y, w, h, { fill = null, stroke = 0.75, width = 0.6 } = {}) {
    if (fill !== null) this.ops.push(`${fill} g ${x} ${this.height - y - h} ${w} ${h} re f`);
    if (stroke !== null) this.ops.push(`${stroke} G ${width} w ${x} ${this.height - y - h} ${w} ${h} re S`);
    return this;
  }
  /** Code 39 barcode of an internal reference (uppercase letters, digits and hyphen). */
  barcode(x, y, value, { height = 36, module = 1.1 } = {}) {
    let cx = x;
    for (const ch of `*${String(value).toUpperCase().replace(/[^A-Z0-9-]/g, '')}*`) {
      const pattern = CODE39[ch];
      for (const bit of pattern) { if (bit === '1') this.ops.push(`0 g ${cx.toFixed(2)} ${this.height - y - height} ${module} ${height} re f`); cx += module; }
      cx += module;
    }
    return cx;
  }
  build() {
    const objects = [];
    const add = (body) => { objects.push(body); return objects.length; };
    const catalogId = add('');
    const pagesId = add('');
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids = [];
    for (const ops of this.pages) {
      const stream = ops.join('\n');
      const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
      kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> >>`));
    }
    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = [];
    objects.forEach((body, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
    const xref = Buffer.byteLength(out, 'latin1');
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, 'latin1');
  }
}

const CODE39 = {
  0: '101001101101', 1: '110100101011', 2: '101100101011', 3: '110110010101', 4: '101001101011', 5: '110100110101', 6: '101100110101',
  7: '101001011011', 8: '110100101101', 9: '101100101101', A: '110101001011', B: '101101001011', C: '110110100101', D: '101011001011',
  E: '110101100101', F: '101101100101', G: '101010011011', H: '110101001101', I: '101101001101', J: '101011001101', K: '110101010011',
  L: '101101010011', M: '110110101001', N: '101011010011', O: '110101101001', P: '101101101001', Q: '101010110011', R: '110101011001',
  S: '101101011001', T: '101011011001', U: '110010101011', V: '100110101011', W: '110011010101', X: '100101101011', Y: '110010110101',
  Z: '100110110101', '-': '100101011011', '*': '100101101101',
};
module.exports = { Pdf, textWidth, CODE39 };
