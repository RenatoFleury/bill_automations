import functions_framework
import pymupdf
import base64

@functions_framework.http
def unlock_pdf(request):
    """
    Unlocks a password-protected PDF.

    Args:
        request (flask.Request): The request object.
        <http://flask.pocoo.org/docs/1.0/api/#flask.Request>
    Returns:
        The response text, or any set of values that can be turned into a
        Response object using `make_response`
        <http://flask.pocoo.org/docs/1.0/api/#flask.Flask.make_response>.
    """

    try:
        request_json = request.get_json()

        if not request_json or 'pdf_base64' not in request_json or 'password' not in request_json:
            return '{"error": "Missing pdf_base64 or password in request"}', 400

        pdf_base64 = request_json['pdf_base64']
        password = request_json['password']

        # Decode the base64 encoded PDF
        pdf_bytes = base64.b64decode(pdf_base64)

        # Open the PDF with PyMuPDF
        try:
            doc = pymupdf.Document(stream=pdf_bytes, filetype="pdf")  # Important: stream and filetype
        except Exception as e:
            return f'{{"error": "Error opening PDF: {e}"}}', 500


        # Attempt to authenticate and save the unlocked PDF (in memory)
        try:
            if doc.authenticate(password):
                # Save the unlocked PDF to memory (bytes)
                unlocked_pdf_bytes = doc.tobytes()
                doc.close() # Close the document after use

                # Encode the unlocked PDF back to base64
                unlocked_pdf_base64 = base64.b64encode(unlocked_pdf_bytes).decode('utf-8')

                return '{"unlocked_pdf_base64": "' + unlocked_pdf_base64 + '"}', 200
            else:
                doc.close()
                return '{"error": "Incorrect password"}', 401
        except Exception as e:
            doc.close()
            return f'{{"error": "Error during unlocking: {e}"}}', 500

    except Exception as e:
        return f'{{"error": "General error: {e}"}}', 500