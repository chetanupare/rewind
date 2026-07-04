@echo off
setlocal enabledelayedexpansion

echo ========================================
echo  RewindX - Python Dependencies Setup
echo ========================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo.
    echo Please install Python 3.8+ from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo [1/6] Checking Python version...
python --version
echo.

:: Create virtual environment if it doesn't exist
set VENV_DIR=%APPDATA%\RewindX\python-env
if not exist "%VENV_DIR%" (
    echo [2/6] Creating virtual environment...
    python -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment
        pause
        exit /b 1
    )
) else (
    echo [2/6] Virtual environment exists
)
echo.

:: Activate virtual environment
call "%VENV_DIR%\Scripts\activate.bat"

:: Upgrade pip
echo [3/6] Upgrading pip...
python -m pip install --upgrade pip --quiet
echo.

:: Install core dependencies
echo [4/6] Installing core dependencies (this may take 5-10 minutes)...
echo.

echo   - Installing OCR libraries...
pip install paddlepaddle paddleocr easyocr pytesseract Pillow --quiet 2>nul
if errorlevel 1 (
    echo   [WARN] Some OCR libraries failed, trying alternatives...
    pip install easyocr pytesseract Pillow --quiet 2>nul
)

echo   - Installing document processing...
pip install PyMuPDF python-docx python-pptx openpyxl --quiet 2>nul

echo   - Installing NLP libraries...
pip install spacy --quiet 2>nul
python -m spacy download en_core_web_sm --quiet 2>nul

echo   - Installing utilities...
pip install networkx numpy requests tqdm --quiet 2>nul

echo.
echo [5/6] Verifying installation...

:: Test imports
python -c "import easyocr; print('  [OK] EasyOCR')" 2>nul || echo   [WARN] EasyOCR not available
python -c "import fitz; print('  [OK] PyMuPDF')" 2>nul || echo   [WARN] PyMuPDF not available
python -c "import docx; print('  [OK] python-docx')" 2>nul || echo   [WARN] python-docx not available
python -c "import spacy; print('  [OK] spaCy')" 2>nul || echo   [WARN] spaCy not available
python -c "import networkx; print('  [OK] NetworkX')" 2>nul || echo   [WARN] NetworkX not available

echo.
echo [6/6] Setup complete!
echo.
echo RewindX Python dependencies are installed.
echo You can now close this window and start RewindX.
echo.
pause
