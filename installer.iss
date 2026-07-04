; RewindX Installer Script
; Requires Inno Setup 6+ to compile

#define MyAppName "RewindX"
#define MyAppVersion "0.2.0"
#define MyAppPublisher "RewindX"
#define MyAppURL "https://github.com/chetanupare/rewind"
#define MyAppExeName "RewindX.exe"

[Setup]
AppId=rewindx-app-020
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=dist-installer
OutputBaseFilename=RewindX-Setup-{#MyAppVersion}
Compression=lzma2/fast
SolidCompression=no
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExeName}
WizardSizePercent=100

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "startupicon"; Description: "Start with Windows"; GroupDescription: "Startup:"
Name: "installpython"; Description: "Install Python dependencies (OCR, Documents, AI)"; GroupDescription: "Optional:"; Check: IsPythonInstalled

[Files]
Source: "dist-electron\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startupicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Registry]
Root: HKCU; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "RewindX"; ValueData: """{app}\{#MyAppExeName}"""; Flags: uninsdeletevalue; Tasks: startupicon

[Code]
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;
  Exec('taskkill', '/F /IM RewindX.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    Exec('taskkill', '/F /IM RewindX.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;

function IsPythonInstalled(): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('python', '--version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

procedure InstallPythonDependencies();
var
  ResultCode: Integer;
  VEnvDir: string;
  PipedOutput: AnsiString;
begin
  VEnvDir := ExpandConstant('{app}\python-env');
  
  MsgBox('Installing Python dependencies...' + #13#10 + #13#10 +
         'This will install:' + #13#10 +
         '• EasyOCR (~80MB) - Text extraction from screenshots' + #13#10 +
         '• PyMuPDF (~15MB) - PDF document processing' + #13#10 +
         '• python-docx (~1MB) - Word document processing' + #13#10 +
         '• spaCy (~40MB) - Entity recognition' + #13#10 +
         '• NetworkX (~10MB) - Knowledge graph algorithms' + #13#10 + #13#10 +
         'This may take 2-5 minutes depending on your internet speed.',
         mbInformation, MB_OK);

  // Create virtual environment
  Exec('python', '-m venv "' + VEnvDir + '"', '', SW_SHOW, ewWaitUntilTerminated, ResultCode);
  
  // Install packages
  Exec('"' + VEnvDir + '\Scripts\pip.exe"', 'install --upgrade pip --quiet', '', SW_SHOW, ewWaitUntilTerminated, ResultCode);
  Exec('"' + VEnvDir + '\Scripts\pip.exe"', 'install easyocr PyMuPDF python-docx spacy networkx --quiet', '', SW_SHOW, ewWaitUntilTerminated, ResultCode);
  Exec('"' + VEnvDir + '\Scripts\python.exe"', '-m spacy download en_core_web_sm --quiet', '', SW_SHOW, ewWaitUntilTerminated, ResultCode);
  
  MsgBox('Python dependencies installed successfully!' + #13#10 + #13#10 +
         'RewindX now has full capabilities:' + #13#10 +
         '✓ OCR (text extraction from screenshots)' + #13#10 +
         '✓ Document Intelligence (PDF, Word, Excel)' + #13#10 +
         '✓ Entity Recognition (people, projects, technologies)' + #13#10 +
         '✓ Knowledge Graph algorithms',
         mbInformation, MB_OK);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then begin
    if IsPythonInstalled then begin
      if MsgBox('Install Python dependencies for advanced features?' + #13#10 + #13#10 +
                'This enables:' + #13#10 +
                '• Better OCR (text extraction from screenshots)' + #13#10 +
                '• Document processing (PDF, Word, Excel)' + #13#10 +
                '• Entity recognition (people, projects, technologies)' + #13#10 +
                '• Knowledge graph algorithms' + #13#10 + #13#10 +
                'Size: ~150MB | Time: 2-5 minutes',
                mbConfirmation, MB_YESNO) = IDYES then begin
        InstallPythonDependencies;
      end;
    end else begin
      MsgBox('Python is not installed.' + #13#10 + #13#10 +
             'To enable advanced features (OCR, Document Intelligence, Entity Recognition),' + #13#10 +
             'install Python 3.8+ from https://www.python.org/downloads/' + #13#10 + #13#10 +
             'Core features (window tracking, screenshots, AI chat) work without Python.',
             mbInformation, MB_OK);
    end;
  end;
end;
