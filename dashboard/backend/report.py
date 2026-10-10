"""PDF incident report (ReportLab), built in memory."""
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

LEVEL_COLORS = {"LOW": "#2e7d32", "MEDIUM": "#ef6c00", "HIGH": "#c62828", "CRITICAL": "#6a1b9a"}


def _p(text, style):
    return Paragraph(escape(str(text if text is not None else "—")), style)


def _table(rows, widths, styles):
    body = [[_p(c, styles["BodyText"]) for c in r] for r in rows]
    t = Table(body, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eceff1")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#b0bec5")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def build_pdf(doc, chain_valid_now=None):
    buf = BytesIO()
    s = getSampleStyleSheet()
    small = s["BodyText"].clone("small", fontSize=7.5, leading=9)
    s.add(small)
    pdf = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm,
                            topMargin=15 * mm, bottomMargin=15 * mm,
                            title=f"USB Incident Report {doc['_id']}")

    dev, ts = doc.get("device", {}), doc.get("timestamps", {})
    risk, conf = doc.get("risk", {}), doc.get("confidence", {})
    usbstor = doc.get("artifacts", {}).get("usbstor") or {}
    level = risk.get("level") or "PENDING"
    chain = ("INTACT" if chain_valid_now else "BROKEN — possible tampering"
             if chain_valid_now is not None else "not checked")

    story = [
        Paragraph(f"USB Incident Report — {escape(doc['_id'])}", s["Title"]),
        Paragraph(f'<font color="{LEVEL_COLORS.get(level, "#546e7a")}"><b>Risk: {level} '
                  f'({risk.get("score", "—")}/100)</b></font> &nbsp;·&nbsp; '
                  f'Evidence confidence: {conf.get("level") or "—"} ({conf.get("score", "—")}) '
                  f'&nbsp;·&nbsp; Custody chain: <b>{chain}</b>', s["Normal"]),
        Spacer(1, 10),
        Paragraph("Device", s["Heading2"]),
        _table([["Field", "Value"],
                ["Name (USBSTOR)", usbstor.get("friendly_name")],
                ["Serial", dev.get("serial")],
                ["Vendor / Product ID", f"{dev.get('vendor_id') or '—'} / {dev.get('product_id') or '—'}"],
                ["Volume / Drive", f"{dev.get('volume_label') or '—'} ({dev.get('drive_letter') or '—'})"],
                ["Connected", ts.get("connect")],
                ["Disconnected", ts.get("disconnect") or "still connected / unknown"]],
               [45 * mm, 135 * mm], s),
        Paragraph("Risk justification", s["Heading2"]),
    ]
    reasons = risk.get("justification") or ["No risk rules triggered."]
    story += [_p("• " + r, s["BodyText"]) for r in reasons]

    story += [Paragraph("Corroborating artifacts", s["Heading2"]),
              _p(", ".join(conf.get("sources_matched") or []) or "none", s["BodyText"])]

    files = doc.get("files", [])
    story.append(Paragraph(f"Files ({len(files)})", s["Heading2"]))
    if files:
        story.append(_table(
            [["Path", "Size", "SHA-256 (collected)", "Flags"]] +
            [[f["path"], f.get("size"), f.get("sha256_collected"), ", ".join(f.get("flags", [])) or "ok"]
             for f in files],
            [55 * mm, 15 * mm, 75 * mm, 35 * mm], {"BodyText": small}))

    log = doc.get("custody_log", [])
    story += [Paragraph("Chain of custody", s["Heading2"]),
              _table([["Time (UTC)", "Action", "Actor", "Entry hash"]] +
                     [[e.get("timestamp"), e.get("action"), e.get("actor"), e.get("entry_hash")]
                      for e in log],
                     [45 * mm, 28 * mm, 25 * mm, 82 * mm], {"BodyText": small})]

    pdf.build(story)
    return buf.getvalue()
