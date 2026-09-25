const fs = require("fs");
const PDFDocument = require("pdfkit");
const prisma = require("../../prisma/index");
const AppError = require("../../utils/appError");

const COMPANY_NAME = process.env.VOUCHER_COMPANY_NAME || "Expense Claims";
const LOGO_PATH = process.env.VOUCHER_LOGO_PATH || null;
const CURRENCY = process.env.VOUCHER_CURRENCY || "PKR";
const TIME_ZONE = process.env.VOUCHER_TIME_ZONE || "Asia/Karachi";

/** Nothing is payable on these, so no voucher is issued. */
const NOT_ISSUABLE = ["DRAFT", "REJECTED", "CANCELLED", "RETURNED"];

const PROFILE_SOURCES = ["employeeName", "employeeDesignation", "employeeDepartment"];

const MARGIN = 40;
const FOOTER_SPACE = 28;

const COLOR = {
  text: "#111827",
  muted: "#6b7280",
  line: "#e5e7eb",
  head: "#f3f4f6",
  red: "#b91c1c",
  redBg: "#fef2f2",
  green: "#15803d"
};

const STATUS_LABEL = {
  SUBMITTED: "Submitted",
  PENDING_APPROVAL: "Pending approval",
  PARTIALLY_APPROVED: "Partially approved",
  APPROVED: "Approved"
};

/* ── Formatting ── */

const isDateOnly = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  // "2026-09-01" is a calendar date: format it in UTC so it never shifts a day.
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: isDateOnly(value) ? "UTC" : TIME_ZONE
  }).replace("Sept", "Sep");
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: TIME_ZONE
  }).replace("Sept", "Sep");
}

function money(value) {
  return (Number(value) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowThousand(n) {
  const parts = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ""));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

function numberToWords(n) {
  if (n === 0) return "Zero";

  const parts = [];
  for (const [size, name] of [[1e9, "Billion"], [1e6, "Million"], [1e3, "Thousand"]]) {
    if (n >= size) {
      parts.push(`${belowThousand(Math.floor(n / size))} ${name}`);
      n %= size;
    }
  }
  if (n > 0) parts.push(belowThousand(n));
  return parts.join(" ");
}

/** 15250.5 → "Rupees Fifteen Thousand Two Hundred Fifty and Fifty Paisa Only" */
function amountInWords(amount) {
  const total = Math.round((Number(amount) || 0) * 100);
  const rupees = Math.floor(total / 100);
  const paisa = total % 100;

  return `Rupees ${numberToWords(rupees)}` +
    (paisa ? ` and ${numberToWords(paisa)} Paisa` : "") +
    " Only";
}

class ClaimVoucherService {

  async generate(claimId, viewer) {

    const claim = await prisma.claim.findUnique({
      where: { id: Number(claimId) },
      include: {
        claimType: true,
        department: true,
        creator: {
          select: {
            name: true,
            department: { select: { name: true } },
            designation: { select: { name: true } }
          }
        },
        approvals: {
          orderBy: { sequence: "asc" },
          include: {
            role: { select: { name: true } },
            approver: {
              select: { name: true, designation: { select: { name: true } } }
            }
          }
        }
      }
    });

    if (!claim) {
      throw new AppError("Claim not found", 404);
    }

    if (NOT_ISSUABLE.includes(claim.status)) {
      throw new AppError(`A voucher can't be issued for a ${String(claim.status).toLowerCase()} claim`, 400);
    }

    const data = this.collect(claim);
    const buffer = await this.render(claim, data, viewer);

    return {
      buffer,
      fileName: `Voucher-${claim.claimNumber ?? claim.id}.pdf`
    };
  }

  /* ── Data ── */

  voucherNumber(claim) {
    return claim.claimNumber
      ? `PV-${claim.claimNumber.replace(/^CLM-/, "")}`
      : `PV-${claim.id}`;
  }

  displayValue(field, raw) {
    if (raw === undefined || raw === null || raw === "") return "-";

    if (field.type === "select" || field.type === "radiobutton") {
      const options = field.options ?? [];
      const label = v => options.find(o => o.id === v)?.value ?? v;
      return Array.isArray(raw) ? raw.map(label).join(", ") : String(label(raw));
    }

    if (field.type === "date") return formatDate(raw);
    if (typeof raw === "boolean") return raw ? "Yes" : "No";
    if (Array.isArray(raw)) return raw.join(", ");
    if (typeof raw === "object") return "-";

    return String(raw);
  }

  collect(claim) {
    const fields = claim.claimType?.schema?.rows?.flat() ?? [];
    const formData = claim.formData ?? {};

    const autoFilled = source => {
      const field = fields.find(f => f.autoFillSource === source);
      const value = field ? formData[field.controlName] : null;
      return value ? String(value) : null;
    };

    const payee = {
      name: autoFilled("employeeName") ?? claim.creator?.name ?? "-",
      designation: autoFilled("employeeDesignation") ?? claim.creator?.designation?.name ?? null,
      department: autoFilled("employeeDepartment") ?? claim.department?.name ?? claim.creator?.department?.name ?? null
    };

    const details = fields
      .filter(f =>
        f.type !== "array" &&
        f.type !== "group" &&
        f.controlName !== "amount" &&
        !PROFILE_SOURCES.includes(f.autoFillSource)
      )
      .map(f => ({ label: f.label ?? f.controlName, value: this.displayValue(f, formData[f.controlName]) }));

    const arrayField = fields.find(f => f.type === "array") ?? null;
    const rows = arrayField && Array.isArray(formData[arrayField.controlName])
      ? formData[arrayField.controlName]
      : [];

    const lines = rows.map((row, index) => ({
      row: row ?? {},
      index,
      rejected: row?.lineStatus === "REJECTED",
      amount: Number(row?.amount) || 0
    }));

    const approvedLines = lines.filter(l => !l.rejected);
    const gross = lines.reduce((sum, l) => sum + l.amount, 0);
    const payable = arrayField
      ? approvedLines.reduce((sum, l) => sum + l.amount, 0)
      : Number(claim.amount) || 0;

    // Totals per GL No. + Charge Head, for posting.
    const glMap = new Map();
    for (const line of approvedLines) {
      const glNo = String(line.row.glNo ?? "").trim() || "-";
      const chargeHead = String(line.row.chargeHead ?? "").trim() || "-";
      const key = `${glNo}\u0000${chargeHead}`;
      const entry = glMap.get(key) ?? { glNo, chargeHead, lines: 0, amount: 0 };
      entry.lines++;
      entry.amount += line.amount;
      glMap.set(key, entry);
    }

    const glSummary = [...glMap.values()].sort((a, b) => a.glNo.localeCompare(b.glNo));

    return {
      payee,
      details,
      arrayField,
      lines,
      hasRejected: lines.some(l => l.rejected),
      gross,
      payable,
      glSummary
    };
  }

  /* ── Rendering ── */

  render(claim, data, viewer) {
    return new Promise((resolve, reject) => {

      const doc = new PDFDocument({
        size: "A4",
        margin: MARGIN,
        bufferPages: true,
        info: {
          Title: `Payment Voucher ${this.voucherNumber(claim)}`,
          Author: COMPANY_NAME,
          Subject: `Expense claim ${claim.claimNumber ?? claim.id}`
        }
      });

      const chunks = [];
      doc.on("data", chunk => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      try {
        this.drawHeader(doc, claim);
        this.drawPayee(doc, claim, data);

        if (data.details.length) {
          this.sectionTitle(doc, "Claim details");
          this.drawKeyValues(doc, data.details);
        }

        if (data.arrayField) {
          this.sectionTitle(doc, data.arrayField.label ?? "Expense details");
          this.drawLines(doc, data);
        }

        this.drawTotals(doc, data);

        if (data.glSummary.length) {
          this.sectionTitle(doc, "Accounting summary");
          this.drawGlSummary(doc, data);
        }

        this.sectionTitle(doc, "Approval trail");
        this.drawApprovalTrail(doc, claim);

        this.drawSignatures(doc, claim, data);
        this.decoratePages(doc, claim, viewer);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  contentWidth(doc) {
    return doc.page.width - MARGIN * 2;
  }

  bottom(doc) {
    return doc.page.height - doc.page.margins.bottom - FOOTER_SPACE;
  }

  ensureSpace(doc, height) {
    if (doc.y + height > this.bottom(doc)) {
      doc.addPage();
    }
  }

  rule(doc, y = doc.y, color = COLOR.line, width = 0.5) {
    doc.moveTo(MARGIN, y)
      .lineTo(doc.page.width - MARGIN, y)
      .strokeColor(color)
      .lineWidth(width)
      .stroke();
  }

  sectionTitle(doc, title) {
    this.ensureSpace(doc, 60);
    doc.moveDown(0.7);
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLOR.text)
      .text(title.toUpperCase(), MARGIN, doc.y, { characterSpacing: 0.6 });
    doc.moveDown(0.4);
  }

  drawHeader(doc, claim) {
    const top = MARGIN;
    let textX = MARGIN;

    if (LOGO_PATH && fs.existsSync(LOGO_PATH)) {
      try {
        doc.image(LOGO_PATH, MARGIN, top, { fit: [110, 36] });
        textX = MARGIN + 122;
      } catch (err) {
        console.warn(`Voucher logo could not be drawn (${LOGO_PATH}):`, err.message);
      }
    }

    doc.font("Helvetica-Bold").fontSize(15).fillColor(COLOR.text)
      .text(COMPANY_NAME, textX, top, { width: 260 });
    doc.font("Helvetica").fontSize(10).fillColor(COLOR.muted)
      .text("Expense Payment Voucher", textX, doc.y + 2, { width: 260 });
    const leftBottom = doc.y;

    const boxWidth = 210;
    const boxX = doc.page.width - MARGIN - boxWidth;
    const meta = [
      ["Voucher No.", this.voucherNumber(claim)],
      ["Claim No.", claim.claimNumber ?? `#${claim.id}`],
      ["Voucher date", formatDate(new Date())],
      ["Claim type", claim.claimType?.name ?? "-"],
      ["Status", STATUS_LABEL[claim.status] ?? claim.status]
    ];

    let y = top;
    for (const [label, value] of meta) {
      doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.muted)
        .text(label, boxX, y, { width: 80 });
      doc.font("Helvetica-Bold").fontSize(8.5)
        .fillColor(label === "Status" && claim.status !== "APPROVED" ? COLOR.red : COLOR.text)
        .text(value, boxX + 80, y, { width: boxWidth - 80, align: "right" });
      y += 14;
    }

    doc.y = Math.max(y, leftBottom) + 10;
    this.rule(doc, doc.y, COLOR.text, 1);
    doc.y += 4;
  }

  drawPayee(doc, claim, data) {
    this.sectionTitle(doc, "Payee");
    this.drawKeyValues(doc, [
      { label: "Name", value: data.payee.name },
      { label: "Designation", value: data.payee.designation ?? "-" },
      { label: "Department", value: data.payee.department ?? "-" },
      { label: "Submitted on", value: formatDateTime(claim.submittedAt ?? claim.createdAt) }
    ]);
  }

  /** Label / value pairs in two columns. */
  drawKeyValues(doc, pairs) {
    const columns = 2;
    const colWidth = this.contentWidth(doc) / columns;
    const labelWidth = 92;
    const valueWidth = colWidth - labelWidth - 12;

    for (let i = 0; i < pairs.length; i += columns) {
      const row = pairs.slice(i, i + columns);

      const height = Math.max(...row.map(p => {
        doc.font("Helvetica").fontSize(8.5);
        const labelHeight = doc.heightOfString(p.label, { width: labelWidth - 6 });
        doc.font("Helvetica-Bold").fontSize(9);
        const valueHeight = doc.heightOfString(p.value, { width: valueWidth });
        return Math.max(labelHeight, valueHeight);
      })) + 4;

      this.ensureSpace(doc, height);
      const y = doc.y;

      row.forEach((p, j) => {
        const x = MARGIN + j * colWidth;
        doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.muted)
          .text(p.label, x, y, { width: labelWidth - 6 });
        doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.text)
          .text(p.value, x + labelWidth, y, { width: valueWidth });
      });

      doc.x = MARGIN;
      doc.y = y + height;
    }
  }

  /**
   * columns: [{ label, weight, align, value(item) }]
   * opts:    { fill(item), color(item), bold(item) }
   * Repeats the header row on every new page.
   */
  drawTable(doc, columns, items, opts = {}) {
    const width = this.contentWidth(doc);
    const totalWeight = columns.reduce((sum, c) => sum + (c.weight ?? 1), 0);
    const cols = columns.map(c => ({
      ...c,
      align: c.align ?? "left",
      width: ((c.weight ?? 1) / totalWeight) * width
    }));
    const pad = 4;
    let y = doc.y;

    const drawHead = () => {
      doc.font("Helvetica-Bold").fontSize(8);
      const height = Math.max(...cols.map(c => doc.heightOfString(c.label, { width: c.width - pad * 2 }))) + pad * 2;

      doc.rect(MARGIN, y, width, height).fill(COLOR.head);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(COLOR.muted);

      let x = MARGIN;
      for (const c of cols) {
        doc.text(c.label, x + pad, y + pad, { width: c.width - pad * 2, align: c.align });
        x += c.width;
      }
      y += height;
    };

    if (y + 48 > this.bottom(doc)) {
      doc.addPage();
      y = doc.y;
    }
    drawHead();

    for (const item of items) {
      const font = opts.bold?.(item) ? "Helvetica-Bold" : "Helvetica";
      const texts = cols.map(c => {
        const value = c.value(item);
        return value === undefined || value === null || value === "" ? "-" : String(value);
      });

      doc.font(font).fontSize(8.5);
      const height = Math.max(...texts.map((t, i) => doc.heightOfString(t, { width: cols[i].width - pad * 2 }))) + pad * 2;

      if (y + height > this.bottom(doc)) {
        doc.addPage();
        y = doc.y;
        drawHead();
      }

      const fill = opts.fill?.(item);
      if (fill) {
        doc.rect(MARGIN, y, width, height).fill(fill);
      }

      doc.font(font).fontSize(8.5).fillColor(opts.color?.(item) ?? COLOR.text);

      let x = MARGIN;
      texts.forEach((t, i) => {
        doc.text(t, x + pad, y + pad, { width: cols[i].width - pad * 2, align: cols[i].align });
        x += cols[i].width;
      });

      y += height;
      this.rule(doc, y);
    }

    doc.x = MARGIN;
    doc.y = y;
  }

  /** Relative column width: serial numbers narrow, dates never wrap, free text widest. */
  columnWeight(child) {
    if (/^(s.?s*no.?|sr.?s*no.?|serial)/i.test(String(child.label ?? child.controlName).trim())) return 0.6;
    if (child.type === "date") return 1.25;
    if (child.type === "number") return 0.8;
    return 1.5;
  }

  drawLines(doc, data) {
    if (!data.lines.length) {
      doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text("No line items.", MARGIN, doc.y);
      return;
    }

    const children = data.arrayField.children ?? [];
    const columns = children
      .filter(child => child.controlName !== "amount")
      .map(child => ({
        label: child.label ?? child.controlName,
        weight: this.columnWeight(child),
        value: line => this.displayValue(child, line.row[child.controlName])
      }));

    columns.push(
      { label: "GL No.", weight: 1, value: line => line.row.glNo },
      { label: "Charge Head", weight: 1.3, value: line => line.row.chargeHead }
    );

    if (data.hasRejected) {
      columns.push({ label: "Status", weight: 0.9, value: line => (line.rejected ? "Rejected" : "Approved") });
    }

    columns.push({
      label: `Amount (${CURRENCY})`,
      weight: 1.1,
      align: "right",
      value: line => money(line.amount)
    });

    this.drawTable(doc, columns, data.lines, {
      fill: line => (line.rejected ? COLOR.redBg : null),
      color: line => (line.rejected ? COLOR.red : COLOR.text)
    });

    if (data.hasRejected) {
      const reasons = data.lines
        .filter(l => l.rejected && l.row.lineRejectionComment)
        .map(l => `Line ${l.index + 1}: ${l.row.lineRejectionComment}`);

      if (reasons.length) {
        doc.moveDown(0.4);
        doc.font("Helvetica").fontSize(8).fillColor(COLOR.red)
          .text(`Rejected lines are not payable. ${reasons.join(" | ")}`, MARGIN, doc.y, { width: this.contentWidth(doc) });
      }
    }
  }

  drawTotals(doc, data) {
    const rows = [];
    if (data.arrayField) {
      rows.push(["Total claimed", money(data.gross)]);
      if (data.hasRejected) {
        rows.push(["Less: rejected lines", `(${money(data.gross - data.payable)})`]);
      }
    }

    this.ensureSpace(doc, rows.length * 15 + 70);

    const width = 250;
    const x = doc.page.width - MARGIN - width;
    let y = doc.y + 10;

    for (const [label, value] of rows) {
      doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text(label, x, y, { width: 130 });
      doc.fillColor(COLOR.text).text(value, x + 130, y, { width: width - 130, align: "right" });
      y += 15;
    }

    doc.moveTo(x, y).lineTo(x + width, y).strokeColor(COLOR.text).lineWidth(0.8).stroke();
    y += 6;

    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLOR.text).text("Net payable", x, y, { width: 110 });
    doc.text(`${CURRENCY} ${money(data.payable)}`, x + 110, y, { width: width - 110, align: "right" });
    y += 22;

    doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.muted)
      .text("Amount in words: ", MARGIN, y, { width: this.contentWidth(doc), continued: true })
      .font("Helvetica-Bold").fillColor(COLOR.text)
      .text(amountInWords(data.payable));

    doc.x = MARGIN;
  }

  drawGlSummary(doc, data) {
    const items = [
      ...data.glSummary,
      { glNo: "Total", chargeHead: "", lines: data.glSummary.reduce((s, g) => s + g.lines, 0), amount: data.payable, total: true }
    ];

    this.drawTable(doc, [
      { label: "GL No.", weight: 1.2, value: g => g.glNo },
      { label: "Charge Head", weight: 2.4, value: g => g.chargeHead || " " },
      { label: "Lines", weight: 0.6, align: "right", value: g => g.lines },
      { label: `Amount (${CURRENCY})`, weight: 1.3, align: "right", value: g => money(g.amount) }
    ], items, {
      bold: g => g.total,
      fill: g => (g.total ? COLOR.head : null)
    });

    if (data.glSummary.some(g => g.glNo === "-" || g.chargeHead === "-")) {
      doc.moveDown(0.4);
      doc.font("Helvetica").fontSize(8).fillColor(COLOR.red)
        .text("Some approved lines have no GL No. or Charge Head.", MARGIN, doc.y);
    }
  }

  stepDecision(claim, step) {
    switch (step.status) {
      case "APPROVED": return "Approved";
      case "REJECTED": return "Rejected";
      case "SKIPPED": return "Not reached";
      case "PENDING":
        return step.sequence === claim.currentApprovalSequence ? "Awaiting" : "Pending";
      default: return step.status ?? "-";
    }
  }

  drawApprovalTrail(doc, claim) {
    if (!claim.approvals?.length) {
      doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted)
        .text("No approval chain is recorded for this claim.", MARGIN, doc.y);
      return;
    }

    this.drawTable(doc, [
      { label: "Step", weight: 0.5, value: s => s.sequence },
      { label: "Approver", weight: 1.6, value: s => s.approver?.name ?? s.role?.name ?? "Unassigned" },
      { label: "Designation / Role", weight: 1.5, value: s => s.approver?.designation?.name ?? s.role?.name },
      { label: "Decision", weight: 0.9, value: s => this.stepDecision(claim, s) },
      { label: "Date & time", weight: 1.3, value: s => (s.actionedAt ? formatDateTime(s.actionedAt) : "-") },
      { label: "Comments", weight: 2, value: s => s.comments }
    ], claim.approvals, {
      color: s => (s.status === "APPROVED" ? COLOR.text : COLOR.muted)
    });
  }

  drawSignatures(doc, claim, data) {
    this.ensureSpace(doc, 75);
    doc.moveDown(1.2);

    const lastApproved = [...(claim.approvals ?? [])].reverse().find(s => s.status === "APPROVED");

    const boxes = [
      {
        title: "Prepared by (Claimant)",
        name: data.payee.name,
        note: claim.submittedAt ? `Submitted ${formatDateTime(claim.submittedAt)}` : ""
      },
      {
        title: "Approved by",
        name: lastApproved?.approver?.name ?? "",
        note: lastApproved?.actionedAt ? `Approved electronically ${formatDateTime(lastApproved.actionedAt)}` : ""
      },
      { title: "Checked by (Accounts)", name: "", note: "" },
      { title: "Received by", name: "", note: "" }
    ];

    const gap = 14;
    const boxWidth = (this.contentWidth(doc) - gap * (boxes.length - 1)) / boxes.length;
    const lineY = doc.y + 28;

    boxes.forEach((box, i) => {
      const x = MARGIN + i * (boxWidth + gap);

      if (box.name) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.text)
          .text(box.name, x, lineY - 13, { width: boxWidth, lineBreak: false });
      }

      doc.moveTo(x, lineY).lineTo(x + boxWidth, lineY).strokeColor(COLOR.text).lineWidth(0.7).stroke();

      doc.font("Helvetica").fontSize(8).fillColor(COLOR.muted)
        .text(box.title, x, lineY + 4, { width: boxWidth });

      if (box.note) {
        doc.fontSize(7).text(box.note, x, lineY + 15, { width: boxWidth });
      }
    });

    doc.x = MARGIN;
    doc.y = lineY + 40;
  }

  /** Watermark (until fully approved), footer and page numbers on every page. */
  decoratePages(doc, claim, viewer) {
    const range = doc.bufferedPageRange();
    const watermark = claim.status === "APPROVED" ? null : "PROVISIONAL - NOT APPROVED";
    const generated = `System-generated voucher · Generated ${formatDateTime(new Date())}` +
      (viewer?.name ? ` by ${viewer.name}` : "");

    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);

      // Writing inside the bottom margin would otherwise start a new page.
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      if (watermark) {
        doc.save();
        doc.rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] });
        doc.font("Helvetica-Bold").fontSize(46).fillColor(COLOR.red).fillOpacity(0.08)
          .text(watermark, 0, doc.page.height / 2 - 25, { width: doc.page.width, align: "center", lineBreak: false });
        doc.restore();
      }

      const footerY = doc.page.height - MARGIN + 8;
      this.rule(doc, footerY - 6);

      doc.font("Helvetica").fontSize(7.5).fillColor(COLOR.muted).fillOpacity(1)
        .text(generated, MARGIN, footerY, { width: this.contentWidth(doc) - 70, lineBreak: false });
      doc.text(`Page ${i - range.start + 1} of ${range.count}`, doc.page.width - MARGIN - 70, footerY, {
        width: 70,
        align: "right",
        lineBreak: false
      });

      doc.page.margins.bottom = bottomMargin;
    }
  }
}

module.exports = new ClaimVoucherService();
