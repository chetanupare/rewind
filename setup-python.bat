@echo off
setlocal enabledelayedexpansion

title RewindX - Python Dependencies Setup
color 0F

echo.
echo  ╔═══════════════════════════════════════════════════════════╗
echo  ║         RewindX - Python Dependencies Setup              ║
echo  ╚═══════════════════════════════════════════════════════════╝
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python is not installed or not in PATH
    echo.
    echo  Please install Python 3.8+ from:
    echo  https://www.python.org/downloads/
    echo.
    echo  IMPORTANT: Check "Add Python to PATH" during installation
    echo.
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo  [OK] Python %PYTHON_VERSION% detected
echo.

:: Setup virtual environment
set VENV_DIR=%APPDATA%\RewindX\python-env
echo  [1/5] Setting up virtual environment...
echo        Location: %VENV_DIR%

if not exist "%VENV_DIR%" (
    echo        Creating new environment...
    python -m venv "%VENV_DIR%" 2>&1
    if errorlevel 1 (
        echo        [ERROR] Failed to create virtual environment
        pause
        exit /b 1
    )
    echo        [OK] Virtual environment created
) else (
    echo        [OK] Virtual environment exists
)
echo.

:: Activate
call "%VENV_DIR%\Scripts\activate.bat"

:: Upgrade pip
echo  [2/5] Upgrading pip...
python -m pip install --upgrade pip --quiet 2>&1 | findstr /V "already satisfied"
echo        [OK] pip updated
echo.

:: Install dependencies with progress
echo  [3/5] Installing dependencies...
echo.
echo  ┌─────────────────────────────────────────────────────────┐
echo  │ Package              Size        Status                 │
echo  ├─────────────────────────────────────────────────────────┤

:: OCR Libraries
echo  │                                                      │
echo  │  OCR Libraries                                       │
echo  │ ──────────────────────────────────────────────────── │

echo  │ Installing Pillow (image processing)...              │
pip install Pillow>=10.0.0 --quiet 2>&1 | findstr /V "already satisfied"
echo  │ [OK] Pillow installed                                │

echo  │ Installing pytesseract (OCR wrapper)...              │
pip install pytesseract>=0.3.10 --quiet 2>&1 | findstr /V "already satisfied"
echo  │ [OK] pytesseract installed                           │

echo  │ Installing EasyOCR (~80MB, lightweight OCR)...        │
pip install easyocr>=1.7.0 2>&1 | findstr /V "already satisfied" | findstr /I "installing installed downloaded"
echo  │ [OK] EasyOCR installed                               │

echo  │                                                      │
echo  │  Document Processing                                 │
echo  │ ──────────────────────────────────────────────────── │

echo  │ Installing PyMuPDF (PDF extraction)...               │
pip install PyMuPDF>=1.23.0 --quiet 2>&1 | findstr /V "already satisfied"
echo  │ [OK] PyMuPDF installed                               │

echo  │ Installing python-docx (Word documents)...           │
pip install python-docx>=0.8.11 --quiet 2>&1 | findstr /V "already satisfied"
echo  │ [OK] python-docx installed                           │

echo  │ Installing python-pptx (PowerPoint)...               │
pip install python-pptx>=0.6.21 --quiet 2>&1 | findstr /V "already satisfied"
echo  │ [OK] python-pptx installed                           │

echo  │ Installing openpyxl (Excel)...                       │
pip install openpyxl>=3.1.0 --quiet 2>&1 | findstr /V "already satisfied"
echo  │ [OK] openpyxl installed                              │

echo  │                                                      │
echo  │  NLP & Entity Recognition                            │
echo  │ ──────────────────────────────────────────────────── │

echo  │ Installing spaCy (~40MB, NLP library)...             │
pip install spacy>=3.7.0 2>&1 | findstr /V "already satisfied" | findstr /I "installing installed downloaded"
echo  │ [OK] spaCy installed                                 │

echo  │ Downloading English language model...                │
python -m spacy download en_core_web_sm --quiet 2>&1
echo  │ [OK] English model downloaded                        │

echo  │                                                      │
echo  │  Utilities                                           │
echo  │ ──────────────────────────────────────────────────── │

echo  │ Installing NetworkX (graph algorithms)...            │
pip install networkx>=3.1 --quiet 2>&1 | findstr /V "already satisfied"
echo  │ [OK] NetworkX installed                              │

echo  │ Installing NumPy (math)...                           │
pip install numpy>=1.24.0 --quiet 2>&1 | findstr /V "already satisfied"
echo  │ [OK] NumPy installed                                 │

echo  │                                                      │
echo  └─────────────────────────────────────────────────────────┘
echo.

:: Verify installation
echo  [4/5] Verifying installation...
echo.
echo  ┌─────────────────────────────────────────────────────────┐

set ALL_OK=1

python -c "import easyocr; print('  [OK] EasyOCR - Ready')" 2>nul || (
    echo  [WARN] EasyOCR - Not available
    set ALL_OK=0
)

python -c "import fitz; print('  [OK] PyMuPDF - Ready')" 2>nul || (
    echo  [WARN] PyMuPDF - Not available
    set ALL_OK=0
)

python -c "import docx; print('  [OK] python-docx - Ready')" 2>nul || (
    echo  [WARN] python-docx - Not available
    set ALL_OK=0
)

python -c "import spacy; print('  [OK] spaCy - Ready')" 2>nul || (
    echo  [WARN] spaCy - Not available
    set ALL_OK=0
)

python -c "import networkx; print('  [OK] NetworkX - Ready')" 2>nul || (
    echo  [WARN] NetworkX - Not available
    set ALL_OK=0
)

python -c "import numpy; print('  [OK] NumPy - Ready')" 2>nul || (
    echo  [WARN] NumPy - Not available
    set ALL_OK=0
)

echo  └─────────────────────────────────────────────────────────┘
echo.

:: Summary
echo  [5/5] Setup Summary
echo.
echo  ┌─────────────────────────────────────────────────────────┐
echo  │                                                         │

if %ALL_OK%==1 (
    echo  │  All dependencies installed successfully!             │
    echo  │                                                         │
    echo  │  RewindX now has full capabilities:                    │
    echo  │    ✓ OCR (EasyOCR + pytesseract)                      │
    echo  │    ✓ Document Intelligence (PDF, DOCX, PPTX, XLSX)    │
    echo  │    ✓ Entity Recognition (spaCy)                       │
    echo  │    ✓ Knowledge Graph (NetworkX)                       │
    echo  │    ✓ Advanced Search                                  │
) else (
    echo  │  Some dependencies could not be installed.            │
    echo  │                                                         │
    echo  │  Core features will still work:                       │
    echo  │    ✓ Window tracking                                  │
    echo  │    ✓ Screenshots                                      │
    echo  │    ✓ AI Analysis (Ollama)                             │
    echo  │    ✓ Search (SQLite FTS)                              │
    echo  │    ✓ All Brain Modules                                │
    echo  │                                                         │
    echo  │  Run this script again to retry failed installations.  │
)

echo  │                                                         │
echo  └─────────────────────────────────────────────────────────┘
echo.
echo  You can close this window and start RewindX.
echo.
pause
