# backend/app.py

import os
import io
from flask import Flask, request, send_file
from flask_cors import CORS
from PyPDF2 import PdfMerger
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


# 6. Run the app
if __name__ == '__main__':
    # Use port 5000 for the backend
    app.run(debug=True, port=5000)
