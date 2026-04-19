from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def generate_pdf_from_html(html_content: str, filename: str):

    pdf_path = f"uploads/{filename}.pdf"

    c = canvas.Canvas(pdf_path, pagesize=A4)
    width, height = A4

    y = height - 50

    # simple text rendering
    lines = html_content.replace("<", "").replace(">", "").split("\n")

    for line in lines:
        c.drawString(40, y, line[:120])
        y -= 20

        if y < 50:
            c.drawString(250, 20, "notes_by_morom")
            c.showPage()
            y = height - 50

    c.drawString(250, 20, "notes_by_morom")

    c.save()

    return pdf_path