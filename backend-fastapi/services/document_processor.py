import os
import io
import logging
import re
import zipfile
import xml.etree.ElementTree as ET
from typing import Tuple, List, Optional
from pathlib import Path

import pdfplumber
from pptx import Presentation
from PIL import Image
import pytesseract
from autocorrect import Speller

logger = logging.getLogger(__name__)

# Initialize spell checker
spell = Speller(lang='en')

class DocumentProcessor:
    """Process documents (PDF, PPT, Images) and extract text with OCR"""

    @staticmethod
    def _ensure_tesseract_available() -> None:
        """Raise a clear error when Tesseract OCR runtime is missing."""
        try:
            pytesseract.get_tesseract_version()
        except Exception as e:
            raise RuntimeError(
                "Tesseract OCR is not installed or not available in PATH. "
                "Install Tesseract and restart the backend. "
                "Windows: winget install UB-Mannheim.TesseractOCR"
            ) from e

    @staticmethod
    def _is_legacy_ppt(file_path: str) -> bool:
        """Detect legacy binary .ppt files (OLE container), unsupported by python-pptx."""
        if Path(file_path).suffix.lower() == ".ppt":
            return True

        try:
            with open(file_path, "rb") as f:
                header = f.read(8)
            return header == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
        except Exception:
            return False

    @staticmethod
    def _extract_text_from_pptx_xml(file_path: str) -> str:
        """Fallback extraction by reading PPTX XML directly, bypassing fragile relationships."""
        text = ""

        with zipfile.ZipFile(file_path, "r") as zf:
            slide_files = [
                name for name in zf.namelist()
                if name.startswith("ppt/slides/slide") and name.endswith(".xml")
            ]

            def _slide_sort_key(name: str) -> int:
                match = re.search(r"slide(\d+)\.xml$", name)
                return int(match.group(1)) if match else 0

            slide_files.sort(key=_slide_sort_key)

            ns = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}

            for slide_idx, slide_name in enumerate(slide_files, 1):
                text += f"\n--- Slide {slide_idx} ---\n"
                direct_text = ""
                try:
                    xml_data = zf.read(slide_name)
                    root = ET.fromstring(xml_data)
                    run_texts = []
                    for node in root.findall(".//a:t", ns):
                        if node.text and node.text.strip():
                            run_texts.append(node.text.strip())

                    if run_texts:
                        direct_text += "\n".join(run_texts) + "\n"
                        
                    if direct_text.strip():
                        text += "[Direct Text Extraction]:\n"
                        text += direct_text.strip() + "\n"
                except Exception as e:
                    logger.warning(f"Failed to parse slide XML {slide_name}: {e}")

            media_files = [
                name for name in zf.namelist()
                if name.startswith("ppt/media/")
            ]

            ocr_texts = []
            for media_name in media_files:
                try:
                    img_bytes = zf.read(media_name)
                    img_text = DocumentProcessor._extract_text_from_image_bytes(img_bytes)
                    if img_text and img_text.strip():
                        ocr_texts.append(f"[From {Path(media_name).name}]:\n{img_text.strip()}")
                except Exception as e:
                    logger.warning(f"Failed OCR for embedded PPT media {media_name}: {e}")
                    
            if ocr_texts:
                text += "\n[Image Processing (OCR) Extraction]:\n"
                text += "\n".join(ocr_texts) + "\n"

        return text.strip()

    @staticmethod
    def extract_text_from_pdf(file_path: str) -> str:
        """Extract text from PDF file by combining direct text and full-page OCR."""
        try:
            text = ""
            with pdfplumber.open(file_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    text += f"\n--- Page {page_num} ---\n"
                    
                    # 1. Direct text extraction
                    page_text = page.extract_text()
                    if page_text and page_text.strip():
                        text += "[Direct Text Extraction]:\n"
                        text += f"{page_text.strip()}\n"
                    
                    # 2. Image processing extraction (OCR on the rendered page)
                    try:
                        # Render the whole page to an image at 200 DPI for good OCR quality
                        # This captures scanned text, flattened diagrams, and complex layouts
                        page_image = page.to_image(resolution=200).original.convert('RGB')
                        
                        # Use tesseract to extract text from the rendered image
                        DocumentProcessor._ensure_tesseract_available()
                        ocr_text = pytesseract.image_to_string(page_image, timeout=15)
                        
                        # Only add if it adds meaningful new info
                        if ocr_text and ocr_text.strip() and len(ocr_text.strip()) > 5:
                            text += "\n[Image Processing (OCR) Extraction]:\n"
                            text += f"{ocr_text.strip()}\n"
                    except Exception as e:
                        logger.warning(f"Failed page-level OCR for PDF page {page_num}: {e}")
            
            return text.strip()
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            raise

    @staticmethod
    def extract_text_from_ppt(file_path: str) -> str:
        """Extract text and images from PowerPoint file and combine them."""
        if DocumentProcessor._is_legacy_ppt(file_path):
            raise ValueError(
                "Legacy .ppt files are not supported for extraction. "
                "Please open the file in PowerPoint and save as .pptx, then upload again."
            )

        try:
            text = ""
            presentation = Presentation(file_path)
            
            for slide_num, slide in enumerate(presentation.slides, 1):
                text += f"\n--- Slide {slide_num} ---\n"
                
                direct_text = ""
                ocr_texts = []
                
                # Extract text from shapes
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text:
                        direct_text += f"{shape.text}\n"
                    
                    # Extract text from images in the slide by processing OCR
                    if shape.shape_type == 13:  # Picture shape
                        try:
                            image = shape.image
                            img_bytes = image.blob
                            img_text = DocumentProcessor._extract_text_from_image_bytes(img_bytes)
                            if img_text and img_text.strip():
                                ocr_texts.append(img_text.strip())
                        except Exception as e:
                            logger.warning(f"Failed to extract text from PPT image: {e}")
                
                if direct_text.strip():
                    text += "[Direct Text Extraction]:\n"
                    text += f"{direct_text.strip()}\n"
                
                if ocr_texts:
                    text += "\n[Image Processing (OCR) Extraction]:\n"
                    text += "\n".join(ocr_texts) + "\n"
            
            return text.strip()
        except Exception as e:
            logger.warning(f"Primary PPTX parser failed, trying XML fallback: {e}")

            try:
                fallback_text = DocumentProcessor._extract_text_from_pptx_xml(file_path)
                if fallback_text:
                    logger.info("Recovered PPT text using XML fallback parser")
                    return fallback_text
            except Exception as fallback_error:
                logger.warning(f"PPTX XML fallback also failed: {fallback_error}")

            error_text = str(e)
            if "officedocument" in error_text.lower() or "no relationship" in error_text.lower():
                raise ValueError(
                    "PowerPoint file structure is invalid or unsupported. "
                    "Please re-save the file as a new .pptx and upload again."
                ) from e

            logger.error(f"Error extracting text from PPT: {e}")
            raise

    @staticmethod
    def extract_text_from_image(file_path: str) -> str:
        """Extract text from image file using OCR"""
        try:
            DocumentProcessor._ensure_tesseract_available()
            image = Image.open(file_path)
            # Enhance image for better OCR results
            image = image.convert('RGB')
            text = pytesseract.image_to_string(image, timeout=10)
            return text.strip()
        except Exception as e:
            logger.error(f"Error extracting text from image: {e}")
            raise

    @staticmethod
    def _extract_text_from_image_bytes(image_bytes: bytes) -> str:
        """Extract text from image bytes using OCR"""
        try:
            DocumentProcessor._ensure_tesseract_available()
            image = Image.open(io.BytesIO(image_bytes))
            image = image.convert('RGB')
            text = pytesseract.image_to_string(image, timeout=10)
            return text.strip()
        except Exception as e:
            logger.warning(f"Error extracting text from image bytes: {e}")
            return ""

    @staticmethod
    def fix_spelling_errors(text: str) -> str:
        """Fix spelling and typing errors in text"""
        try:
            # Split text into lines and fix each line
            lines = text.split('\n')
            corrected_lines = []
            
            for line in lines:
                # Skip lines that are headers or very short
                if line.startswith('---') or line.startswith('[') or len(line) < 3:
                    corrected_lines.append(line)
                    continue
                    
                # Skip extremely long lines to prevent Viterbi decode hang O(N^2)
                if len(line) > 300:
                    corrected_lines.append(line)
                    continue
                    
                # Also avoid lines with extremely long unbroken words (OCR garbage)
                if any(len(w) > 40 for w in line.split()):
                    corrected_lines.append(line)
                    continue

                try:
                    corrected_line = spell(line)
                    corrected_lines.append(corrected_line)
                except Exception as e:
                    logger.debug(f"Error correcting line: {e}")
                    corrected_lines.append(line)
            
            return '\n'.join(corrected_lines)
        except Exception as e:
            logger.warning(f"Error fixing spelling errors: {e}")
            return text

    @staticmethod
    def clean_and_format_text(text: str) -> str:
        """Clean and format extracted text"""
        try:
            lines = text.split('\n')
            cleaned_lines = []
            
            for line in lines:
                # Remove excessive whitespace
                line = ' '.join(line.split())
                
                # Skip empty lines but preserve logical structure
                if line.strip():
                    cleaned_lines.append(line)
                elif cleaned_lines and not cleaned_lines[-1].startswith('---'):
                    # Add empty line for readability, but avoid multiple consecutive ones
                    cleaned_lines.append('')
            
            # Remove trailing empty lines
            while cleaned_lines and not cleaned_lines[-1].strip():
                cleaned_lines.pop()
            
            return '\n'.join(cleaned_lines)
        except Exception as e:
            logger.warning(f"Error cleaning text: {e}")
            return text

    @staticmethod
    def process_document(file_path: str, file_type: str) -> Tuple[str, str]:
        """
        Main method to process any document
        
        Args:
            file_path: Path to the file
            file_type: Type of file ('pdf', 'ppt', 'image')
            
        Returns:
            Tuple of (extracted_text, cleaned_text)
        """
        file_type = file_type.lower()
        
        logger.info(f"Processing {file_type} file: {file_path}")
        
        # Extract text based on file type
        if file_type == 'pdf':
            extracted_text = DocumentProcessor.extract_text_from_pdf(file_path)
        elif file_type == 'ppt':
            extracted_text = DocumentProcessor.extract_text_from_ppt(file_path)
        elif file_type in ['image', 'jpg', 'jpeg', 'png', 'bmp', 'gif']:
            extracted_text = DocumentProcessor.extract_text_from_image(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")
        
        # Clean and fix errors
        cleaned_text = DocumentProcessor.clean_and_format_text(extracted_text)
        cleaned_text = DocumentProcessor.fix_spelling_errors(cleaned_text)
        
        logger.info(f"Successfully processed document. Extracted {len(cleaned_text)} characters")
        
        return extracted_text, cleaned_text

