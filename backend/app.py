# backend/app.py

import os
import io
import shutil
import subprocess
import tempfile
from pathlib import Path

from flask import Flask, request, send_file
from flask_cors import CORS
from PyPDF2 import PdfMerger, PdfReader, PdfWriter
from PIL import Image
from pillow_heif import register_heif_opener

register_heif_opener()  # Enable HEIC/HEIF support for Pillow

SUPPORTED_IMAGE_MIME_TYPES = {
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/heic',
    'image/heif',
    'image/webp',
    'image/tiff',
    'image/x-tiff',
}

SUPPORTED_IMAGE_EXTENSIONS = {
    '.png',
    '.jpg',
    '.jpeg',
    '.heic',
    '.heif',
    '.webp',
    '.tif',
    '.tiff',
}

# 1. Initialize the Flask App
app = Flask(__name__)
# Allow requests from our frontend (localhost:5173)
CORS(app)


def is_pdf(file):
    content_type = (file.content_type or '').lower()
    extension = os.path.splitext(file.filename or '')[1].lower()
    return content_type == 'application/pdf' or extension == '.pdf'


def is_supported_image(file):
    content_type = (file.content_type or '').lower()
    extension = os.path.splitext(file.filename or '')[1].lower()
    return content_type in SUPPORTED_IMAGE_MIME_TYPES or extension in SUPPORTED_IMAGE_EXTENSIONS


def image_file_to_pdf_bytes(file):
    """Convert an uploaded image to an in-memory PDF stream."""
    file.stream.seek(0)
    with Image.open(file.stream) as image:
        frames = []
        frame_index = 0
        while True:
            try:
                image.seek(frame_index)
                frames.append(image.convert('RGB'))
                frame_index += 1
            except EOFError:
                break

        if not frames:
            raise ValueError("Unable to read image data.")

        pdf_stream = io.BytesIO()
        frames[0].save(pdf_stream, format='PDF', save_all=True, append_images=frames[1:])
        pdf_stream.seek(0)
        return pdf_stream


def validate_pdf(pdf_bytes):
    """Return the page count after confirming the bytes contain a readable PDF."""
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        if reader.is_encrypted and not reader.decrypt(''):
            raise ValueError("Password-protected PDFs are not supported yet.")
        return len(reader.pages)
    except ValueError:
        raise
    except Exception as error:
        raise ValueError("The selected file is not a valid, readable PDF.") from error


def losslessly_compress_pdf(pdf_bytes):
    """Rewrite a PDF and Flate-compress any uncompressed page content streams."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    if reader.is_encrypted and not reader.decrypt(''):
        raise ValueError("Password-protected PDFs are not supported yet.")

    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    for page in writer.pages:
        page.compress_content_streams()

    output_stream = io.BytesIO()
    writer.write(output_stream)
    return output_stream.getvalue()


def ghostscript_compress_pdf(pdf_bytes):
    """Use Ghostscript's print-quality preset when the executable is available."""
    ghostscript = shutil.which('gs')
    if not ghostscript:
        return None

    with tempfile.TemporaryDirectory(prefix='pdf-combiner-') as temp_dir:
        input_path = Path(temp_dir) / 'input.pdf'
        output_path = Path(temp_dir) / 'compressed.pdf'
        input_path.write_bytes(pdf_bytes)

        command = [
            ghostscript,
            '-sDEVICE=pdfwrite',
            '-dCompatibilityLevel=1.7',
            '-dPDFSETTINGS=/printer',
            '-dNOPAUSE',
            '-dQUIET',
            '-dBATCH',
            '-dSAFER',
            '-dDetectDuplicateImages=true',
            '-dCompressFonts=true',
            '-dSubsetFonts=true',
            '-dAutoRotatePages=/None',
            f'-sOutputFile={output_path}',
            str(input_path),
        ]

        try:
            subprocess.run(
                command,
                check=True,
                capture_output=True,
                timeout=120,
            )
        except (subprocess.SubprocessError, OSError):
            return None

        if not output_path.exists():
            return None
        return output_path.read_bytes()


def compress_pdf(pdf_bytes):
    """Return the smallest valid high-quality candidate without increasing file size."""
    original_page_count = validate_pdf(pdf_bytes)
    candidates = [pdf_bytes]

    ghostscript_result = ghostscript_compress_pdf(pdf_bytes)
    if ghostscript_result:
        candidates.append(ghostscript_result)

    try:
        candidates.append(losslessly_compress_pdf(pdf_bytes))
    except Exception:
        # The original has already been validated; Ghostscript may still have
        # produced a valid optimized copy even if PyPDF2 cannot rewrite it.
        pass

    valid_candidates = []
    for candidate in candidates:
        try:
            if validate_pdf(candidate) == original_page_count:
                valid_candidates.append(candidate)
        except Exception:
            continue

    if not valid_candidates:
        raise ValueError("Unable to create a valid compressed PDF.")
    return min(valid_candidates, key=len)


def compressed_download_name(filename):
    """Build a safe, recognizable filename for the optimized download."""
    stem = Path(os.path.basename(filename or 'document.pdf')).stem
    safe_stem = ''.join(char for char in stem if char.isalnum() or char in (' ', '-', '_')).strip()
    return f'{safe_stem or "document"}-compressed.pdf'


def parse_page_selection(raw_selection, page_count):
    """Parse comma-separated pages and ranges while preserving selection order."""
    if not raw_selection or not raw_selection.strip():
        raise ValueError("Select at least one page.")

    selected_pages = []
    seen_pages = set()

    for part in raw_selection.split(','):
        value = part.strip()
        if not value:
            continue

        if '-' in value:
            range_parts = value.split('-', 1)
            if len(range_parts) != 2 or not all(item.strip().isdigit() for item in range_parts):
                raise ValueError("Page selection must use numbers such as 1, 3-5, 7.")
            start, end = (int(item.strip()) for item in range_parts)
            if start > end:
                raise ValueError("Page ranges must run from a lower page to a higher page.")
            page_numbers = range(start, end + 1)
        elif value.isdigit():
            page_numbers = [int(value)]
        else:
            raise ValueError("Page selection must use numbers such as 1, 3-5, 7.")

        for page_number in page_numbers:
            if page_number < 1 or page_number > page_count:
                raise ValueError(f"Page {page_number} is outside this PDF's 1-{page_count} page range.")
            if page_number not in seen_pages:
                selected_pages.append(page_number)
                seen_pages.add(page_number)

    if not selected_pages:
        raise ValueError("Select at least one page.")
    return selected_pages


def extract_pdf_pages(pdf_bytes, page_numbers):
    """Copy selected pages into a new PDF without rasterizing or recompressing them."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    if reader.is_encrypted and not reader.decrypt(''):
        raise ValueError("Password-protected PDFs are not supported yet.")

    writer = PdfWriter()
    for page_number in page_numbers:
        writer.add_page(reader.pages[page_number - 1])

    output_stream = io.BytesIO()
    writer.write(output_stream)
    output_bytes = output_stream.getvalue()
    if validate_pdf(output_bytes) != len(page_numbers):
        raise ValueError("Unable to create a valid PDF from the selected pages.")
    return output_bytes


def extracted_download_name(filename):
    """Build a safe filename for a PDF containing selected pages."""
    stem = Path(os.path.basename(filename or 'document.pdf')).stem
    safe_stem = ''.join(char for char in stem if char.isalnum() or char in (' ', '-', '_')).strip()
    return f'{safe_stem or "document"}-selected-pages.pdf'


# 2. Define the API route
@app.route('/api/combine', methods=['POST'])
def combine_pdfs():
    # Check if any files were sent in the request
    if 'files' not in request.files:
        return "No files sent", 400

    files = request.files.getlist('files')
    if not files:
        return "No files sent", 400

    pdf_merger = PdfMerger()
    converted_streams = []  # Keep references so buffers aren't GC'ed early

    try:
        # 3. Loop through files and merge them in memory
        for file in files:
            if is_pdf(file):
                file.stream.seek(0)
                pdf_merger.append(file.stream)
            elif is_supported_image(file):
                pdf_stream = image_file_to_pdf_bytes(file)
                converted_streams.append(pdf_stream)
                pdf_merger.append(pdf_stream)
            else:
                return f"Unsupported file type: {file.filename}", 400

        # 4. Create an in-memory stream to hold the output PDF
        output_stream = io.BytesIO()
        pdf_merger.write(output_stream)
        output_stream.seek(0)

    except Exception as error:
        print(f"Error combining files: {error}")
        return "Failed to process files. Please ensure they are valid PDFs or images.", 500

    finally:
        pdf_merger.close()
        for stream in converted_streams:
            stream.close()

    # 5. Send the merged PDF back to the user
    return send_file(
        output_stream,
        mimetype='application/pdf',
        as_attachment=True,
        # The filename the user will see when they download
        download_name='combined.pdf'
    )


@app.route('/api/compress', methods=['POST'])
def compress_pdf_file():
    if 'file' not in request.files:
        return "No PDF sent", 400

    file = request.files['file']
    if not file or not file.filename:
        return "No PDF sent", 400
    if not is_pdf(file):
        return "Only PDF files can be compressed.", 400

    try:
        file.stream.seek(0)
        original_bytes = file.read()
        if not original_bytes:
            return "The selected PDF is empty.", 400

        compressed_bytes = compress_pdf(original_bytes)
    except ValueError as error:
        return str(error), 400
    except Exception as error:
        print(f"Error compressing PDF: {error}")
        return "Failed to compress the PDF. Please ensure it is a valid PDF.", 500

    original_size = len(original_bytes)
    compressed_size = len(compressed_bytes)
    savings_percent = ((original_size - compressed_size) / original_size) * 100

    response = send_file(
        io.BytesIO(compressed_bytes),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=compressed_download_name(file.filename),
    )
    response.headers['X-Original-Size'] = str(original_size)
    response.headers['X-Compressed-Size'] = str(compressed_size)
    response.headers['X-Savings-Percent'] = f'{savings_percent:.1f}'
    response.headers['Access-Control-Expose-Headers'] = (
        'Content-Disposition, X-Original-Size, X-Compressed-Size, X-Savings-Percent'
    )
    return response


@app.route('/api/extract', methods=['POST'])
def extract_pdf_file():
    if 'file' not in request.files:
        return "No PDF sent", 400

    file = request.files['file']
    if not file or not file.filename:
        return "No PDF sent", 400
    if not is_pdf(file):
        return "Only PDF files can have pages extracted.", 400

    try:
        file.stream.seek(0)
        original_bytes = file.read()
        if not original_bytes:
            return "The selected PDF is empty.", 400

        page_count = validate_pdf(original_bytes)
        selected_pages = parse_page_selection(request.form.get('pages', ''), page_count)
        extracted_bytes = extract_pdf_pages(original_bytes, selected_pages)
    except ValueError as error:
        return str(error), 400
    except Exception as error:
        print(f"Error extracting PDF pages: {error}")
        return "Failed to extract pages. Please ensure the PDF is valid.", 500

    response = send_file(
        io.BytesIO(extracted_bytes),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=extracted_download_name(file.filename),
    )
    response.headers['X-Selected-Pages'] = ','.join(str(page) for page in selected_pages)
    response.headers['X-Page-Count'] = str(len(selected_pages))
    response.headers['Access-Control-Expose-Headers'] = (
        'Content-Disposition, X-Selected-Pages, X-Page-Count'
    )
    return response


# 6. Run the app
if __name__ == '__main__':
    # Use port 5000 for the backend
    app.run(debug=True, port=5000)
