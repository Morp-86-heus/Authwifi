"""
Converte blocchi JSON in HTML email con stili 100% inline.
Compatibile con Gmail, Outlook, Apple Mail.
Block types: header (auto), text, button, divider, image
"""
import html
import os
import re
from typing import Any

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")


def _abs(url: str) -> str:
    """Converte URL relativo in assoluto usando BASE_URL."""
    if url and url.startswith("/"):
        return BASE_URL + url
    return url


def _strip_html(h: str) -> str:
    """Plain-text minimale da HTML per la parte alternativa."""
    h = re.sub(r'<br\s*/?>', '\n', h, flags=re.IGNORECASE)
    h = re.sub(r'</?p[^>]*>', '\n', h, flags=re.IGNORECASE)
    h = re.sub(r'</?li[^>]*>', '\n• ', h, flags=re.IGNORECASE)
    h = re.sub(r'<[^>]+>', '', h)
    h = h.replace('&nbsp;', ' ').replace('&lt;', '<').replace('&gt;', '>') \
         .replace('&amp;', '&').replace('&quot;', '"')
    h = re.sub(r'\n{3,}', '\n\n', h)
    return h.strip()


# Stile comune per le celle del body
_TD_WRAP = 'style="padding:0 32px;"'
_TD_BODY = 'font-size:15px;line-height:1.7;color:#374151;font-family:Arial,Helvetica,sans-serif;'


def _header_block(logo_url: str | None, primary_color: str, site_name: str) -> str:
    safe_color = html.escape(primary_color)
    if logo_url:
        abs_url = _abs(logo_url)
        inner = (
            f'<img src="{html.escape(abs_url)}" alt="{html.escape(site_name)}" '
            f'width="240" style="max-height:120px;max-width:320px;display:block;'
            f'margin:0 auto;border:0;outline:0;" />'
        )
    else:
        inner = (
            f'<span style="font-size:22px;font-weight:700;color:#ffffff;'
            f'font-family:Arial,Helvetica,sans-serif;">{html.escape(site_name)}</span>'
        )
    return (
        f'<tr><td style="background:{safe_color};padding:28px 32px;text-align:center;">'
        f'{inner}</td></tr>'
    )


def _spacer(h: int = 16) -> str:
    return f'<tr><td style="height:{h}px;font-size:{h}px;line-height:{h}px;">&nbsp;</td></tr>'


def _text_block(content: str) -> str:
    return (
        f'<tr><td {_TD_WRAP}>'
        f'<div style="{_TD_BODY}padding:12px 0;">{content}</div>'
        f'</td></tr>'
    )


def _button_block(text: str, url: str, color: str) -> str:
    abs_url = _abs(url)
    return (
        f'<tr><td style="padding:16px 32px;text-align:center;">'
        f'<a href="{html.escape(abs_url)}" '
        f'style="background:{html.escape(color)};color:#ffffff;display:inline-block;'
        f'padding:14px 32px;font-size:15px;font-weight:700;text-decoration:none;'
        f'font-family:Arial,Helvetica,sans-serif;">'
        f'{html.escape(text)}</a>'
        f'</td></tr>'
    )


def _divider_block() -> str:
    return (
        '<tr><td style="padding:8px 32px;">'
        '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
        '<td style="border-top:1px solid #e5e7eb;font-size:0;line-height:0;">&nbsp;</td>'
        '</tr></table></td></tr>'
    )


def _image_block(url: str, alt: str = "", link: str | None = None) -> str:
    abs_url = _abs(url)
    img = (
        f'<img src="{html.escape(abs_url)}" alt="{html.escape(alt)}" '
        f'width="496" style="max-width:100%;display:block;margin:0 auto;border:0;outline:0;" />'
    )
    if link:
        img = f'<a href="{html.escape(_abs(link))}" style="text-decoration:none;">{img}</a>'
    return (
        f'<tr><td style="padding:12px 32px;text-align:center;">'
        f'{img}</td></tr>'
    )


def _footer_block(footer_text: str) -> str:
    return (
        '<tr><td style="background:#f9fafb;padding:20px 32px;text-align:center;'
        'font-size:12px;color:#9ca3af;font-family:Arial,Helvetica,sans-serif;'
        'border-top:1px solid #e5e7eb;">'
        f'{html.escape(footer_text)}'
        '</td></tr>'
    )


def blocks_to_html(
    blocks: list[dict[str, Any]],
    *,
    logo_url: str | None = None,
    primary_color: str = "#0055ff",
    site_name: str = "",
    footer_text: str = "",
) -> str:
    """Genera HTML email con stili 100% inline. Compatibile Gmail/Outlook."""
    rows: list[str] = []

    rows.append(_header_block(logo_url, primary_color, site_name))
    rows.append(_spacer(16))

    for block in blocks:
        btype = block.get("type", "")
        if btype == "text":
            rows.append(_text_block(block.get("content", "")))
        elif btype == "button":
            rows.append(_button_block(
                block.get("text", "Clicca qui"),
                block.get("url", "#"),
                block.get("color", primary_color),
            ))
        elif btype == "divider":
            rows.append(_divider_block())
        elif btype == "image" and block.get("url"):
            rows.append(_image_block(
                block.get("url", ""),
                block.get("alt", ""),
                block.get("link"),
            ))

    rows.append(_spacer(16))

    if footer_text:
        rows.append(_footer_block(footer_text))

    inner = "\n".join(rows)

    return (
        '<!DOCTYPE html>\n'
        '<html lang="it">\n'
        '<head>\n'
        '<meta charset="utf-8" />\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1" />\n'
        '<meta name="color-scheme" content="light" />\n'
        '<meta name="supported-color-schemes" content="light" />\n'
        '</head>\n'
        '<body style="margin:0;padding:0;background:#f0f4f8;'
        'font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">\n'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#f0f4f8;padding:32px 16px;">\n'
        '<tr><td align="center">\n'
        '<table role="presentation" width="560" cellpadding="0" cellspacing="0" '
        'style="max-width:560px;width:100%;background:#ffffff;">\n'
        f'{inner}\n'
        '</table>\n'
        '</td></tr>\n'
        '</table>\n'
        '</body>\n'
        '</html>'
    )


def blocks_to_plaintext(blocks: list[dict[str, Any]], site_name: str = "") -> str:
    """Versione plain-text per il MIME alternativo."""
    lines: list[str] = []
    if site_name:
        lines.append(f"{'=' * 40}")
        lines.append(site_name.upper())
        lines.append(f"{'=' * 40}")
        lines.append("")

    for block in blocks:
        btype = block.get("type", "")
        if btype == "text":
            lines.append(_strip_html(block.get("content", "")))
            lines.append("")
        elif btype == "button":
            lines.append(f"[ {block.get('text', 'Clicca qui')} ]")
            lines.append(_abs(block.get("url", "")))
            lines.append("")
        elif btype == "divider":
            lines.append("-" * 40)
            lines.append("")
        elif btype == "image" and block.get("alt"):
            lines.append(f"[Immagine: {block.get('alt')}]")
            lines.append("")

    return "\n".join(lines).strip()
