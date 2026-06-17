"""
Converte una lista di blocchi JSON in HTML email table-based.
Block types: header, text, button, divider, image
"""
import html
from typing import Any


_BASE_CSS = """
<style>
  body { margin:0; padding:0; background:#f0f4f8; font-family:Arial,Helvetica,sans-serif; -webkit-text-size-adjust:100%; color-scheme:light; }
  table { border-collapse:collapse; }
  img { border:0; outline:0; display:block; }
  a { text-decoration:none; }
  .wrapper { background:#f0f4f8; padding:32px 16px; }
  .container { max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
  .block-text { font-size:15px; line-height:1.6; color:#374151; padding:0 32px; }
  .block-text p { margin:0 0 12px; }
  .block-button { text-align:center; padding:8px 32px; }
  .block-button a { display:inline-block; padding:14px 32px; border-radius:8px; font-size:15px; font-weight:600; color:#ffffff; }
  .block-divider { padding:0 32px; }
  .block-divider hr { border:none; border-top:1px solid #e5e7eb; margin:0; }
  .block-image { text-align:center; padding:0 32px; }
  .block-image img { max-width:100%; border-radius:8px; }
</style>
""".strip()


def _header_block(logo_url: str | None, primary_color: str, site_name: str) -> str:
    logo_html = ""
    if logo_url:
        if logo_url.startswith("/"):
            import os
            base = os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")
            logo_url = base + logo_url
        logo_html = (
            f'<img src="{html.escape(logo_url)}" alt="{html.escape(site_name)}" '
            f'style="max-height:120px;max-width:320px;display:block;margin:0 auto;" />'
        )
    else:
        logo_html = f'<span style="font-size:22px;font-weight:700;color:#ffffff;">{html.escape(site_name)}</span>'

    return (
        f'<table width="100%" cellpadding="0" cellspacing="0"><tr>'
        f'<td style="background:{html.escape(primary_color)};padding:28px 32px;text-align:center;">'
        f'{logo_html}'
        f'</td></tr></table>'
    )


def _text_block(content: str) -> str:
    return (
        f'<table width="100%" cellpadding="0" cellspacing="0"><tr>'
        f'<td class="block-text" style="padding-top:20px;padding-bottom:4px;">'
        f'{content}'
        f'</td></tr></table>'
    )


def _button_block(text: str, url: str, color: str) -> str:
    safe_url = html.escape(url)
    safe_color = html.escape(color)
    safe_text = html.escape(text)
    return (
        f'<table width="100%" cellpadding="0" cellspacing="0"><tr>'
        f'<td class="block-button" style="padding-top:16px;padding-bottom:8px;">'
        f'<a href="{safe_url}" style="background:{safe_color};color:#ffffff;display:inline-block;'
        f'padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">'
        f'{safe_text}</a>'
        f'</td></tr></table>'
    )


def _divider_block() -> str:
    return (
        '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
        '<td class="block-divider" style="padding:16px 32px;">'
        '<hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />'
        '</td></tr></table>'
    )


def _image_block(url: str, alt: str = "", link: str | None = None) -> str:
    img = (
        f'<img src="{html.escape(url)}" alt="{html.escape(alt)}" '
        f'style="max-width:100%;border-radius:8px;display:block;margin:0 auto;" />'
    )
    if link:
        img = f'<a href="{html.escape(link)}">{img}</a>'
    return (
        f'<table width="100%" cellpadding="0" cellspacing="0"><tr>'
        f'<td style="padding:16px 32px;text-align:center;">'
        f'{img}'
        f'</td></tr></table>'
    )


def _footer_block(footer_text: str) -> str:
    return (
        '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
        '<td style="background:#f9fafb;padding:20px 32px;text-align:center;'
        'font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;">'
        f'{html.escape(footer_text)}'
        '</td></tr></table>'
    )


def blocks_to_html(
    blocks: list[dict[str, Any]],
    *,
    logo_url: str | None = None,
    primary_color: str = "#0055ff",
    site_name: str = "",
    footer_text: str = "",
) -> str:
    """Render blocks list to full HTML email string."""
    body_parts: list[str] = []

    # Auto-header sempre in cima
    body_parts.append(_header_block(logo_url, primary_color, site_name))

    # Spacer top
    body_parts.append(
        '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
        '<td style="height:16px;"></td></tr></table>'
    )

    for block in blocks:
        btype = block.get("type", "")
        if btype == "text":
            body_parts.append(_text_block(block.get("content", "")))
        elif btype == "button":
            body_parts.append(_button_block(
                block.get("text", "Clicca qui"),
                block.get("url", "#"),
                block.get("color", primary_color),
            ))
        elif btype == "divider":
            body_parts.append(_divider_block())
        elif btype == "image":
            body_parts.append(_image_block(
                block.get("url", ""),
                block.get("alt", ""),
                block.get("link"),
            ))

    # Spacer bottom
    body_parts.append(
        '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
        '<td style="height:16px;"></td></tr></table>'
    )

    if footer_text:
        body_parts.append(_footer_block(footer_text))

    inner = "\n".join(body_parts)

    return (
        '<!DOCTYPE html><html lang="it"><head>'
        '<meta charset="utf-8" />'
        '<meta name="viewport" content="width=device-width,initial-scale=1" />'
        '<meta name="color-scheme" content="light" />'
        f'{_BASE_CSS}'
        '</head><body>'
        '<div class="wrapper">'
        '<table class="container" width="100%" cellpadding="0" cellspacing="0">'
        '<tr><td>'
        f'{inner}'
        '</td></tr>'
        '</table>'
        '</div>'
        '</body></html>'
    )
