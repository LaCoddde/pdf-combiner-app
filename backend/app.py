# backend/app.py

import os
import io
from flask import Flask, request, send_file
from flask_cors import CORS
from PyPDF2 import PdfMerger

# 1. Initialize the Flask App
app = Flask(__name__)
# Allow requests from our frontend (localhost:5173)
CORS(app)

# 2. Define the API route
@app.route('/api/combine', methods=['POST'])
def combine_pdfs():
    # Check if any files were sent in the request
    if 'files' not in request.files:
        return "No files sent", 400

    files = request.files.getlist('files')
    pdf_merger = PdfMerger()

    # 3. Loop through files and merge them in memory
    for file in files:
        # We pass the file's stream directly to the merger
        pdf_merger.append(file.stream)

    # 4. Create an in-memory stream to hold the output PDF
    output_stream = io.BytesIO()
    pdf_merger.write(output_stream)
    pdf_merger.close()

    # Move the "cursor" to the beginning of the stream
    output_stream.seek(0)

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