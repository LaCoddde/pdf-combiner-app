import io
import os
import unittest
from pathlib import Path

from PyPDF2 import PdfReader

import app as app_module


FIXTURE_PATH = Path(__file__).with_name('test.pdf')


class CompressionTests(unittest.TestCase):
    def setUp(self):
        app_module.app.config.update(TESTING=True)
        self.client = app_module.app.test_client()

    def test_compress_pdf_preserves_pages_and_never_increases_size(self):
        original = FIXTURE_PATH.read_bytes()

        compressed = app_module.compress_pdf(original)

        self.assertLessEqual(len(compressed), len(original))
        self.assertEqual(
            len(PdfReader(io.BytesIO(compressed)).pages),
            len(PdfReader(io.BytesIO(original)).pages),
        )

    def test_compress_endpoint_returns_pdf_and_size_metadata(self):
        original = FIXTURE_PATH.read_bytes()

        response = self.client.post(
            '/api/compress',
            data={'file': (io.BytesIO(original), 'Sample Document.pdf')},
            content_type='multipart/form-data',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, 'application/pdf')
        self.assertEqual(int(response.headers['X-Original-Size']), len(original))
        self.assertLessEqual(int(response.headers['X-Compressed-Size']), len(original))
        self.assertIn('Sample Document-compressed.pdf', response.headers['Content-Disposition'])
        self.assertEqual(len(PdfReader(io.BytesIO(response.data)).pages), 3)

    def test_compress_endpoint_rejects_non_pdf(self):
        response = self.client.post(
            '/api/compress',
            data={'file': (io.BytesIO(b'not a pdf'), 'notes.txt')},
            content_type='multipart/form-data',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn(b'Only PDF files', response.data)

    def test_compress_endpoint_rejects_invalid_pdf_content(self):
        response = self.client.post(
            '/api/compress',
            data={'file': (io.BytesIO(b'not a pdf'), 'fake.pdf')},
            content_type='multipart/form-data',
        )

        self.assertEqual(response.status_code, 400)

    def test_download_name_removes_path_and_unsafe_characters(self):
        unsafe_name = os.path.join('folder', 'taxes (final)!?.pdf')
        self.assertEqual(
            app_module.compressed_download_name(unsafe_name),
            'taxes final-compressed.pdf',
        )


if __name__ == '__main__':
    unittest.main()
