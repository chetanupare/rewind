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
var
  PythonSetupPage: TInputOptionWizardPage;
  ProgressPage: TOutputProgressWizardPage;
  PythonInstalled: Boolean;
  InstallPythonDeps: Boolean;

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

procedure InitializeWizard();
begin
  PythonInstalled := IsPythonInstalled();
  
  PythonSetupPage := CreateInputOptionPage(wpSelectTasks,
    'Python Dependencies', 
    'Install optional Python packages for advanced features',
    'RewindX can use Python packages for enhanced capabilities. Select which to install:',
    False, False);
    
  PythonSetupPage.Add('Install EasyOCR (80MB) - Better text extraction from screenshots');
  PythonSetupPage.Add('Install spaCy + English model (40MB) - Entity recognition (people, projects, technologies)');
  PythonSetupPage.Add('Install PyMuPDF (15MB) - Extract text from PDF documents');
  PythonSetupPage.Add('Install python-docx (1MB) - Extract text from Word documents');
  PythonSetupPage.Add('Install NetworkX (10MB) - Knowledge graph algorithms');
  
  if PythonInstalled then begin
    PythonSetupPage.Values[0] := True;
    PythonSetupPage.Values[1] := True;
    PythonSetupPage.Values[2] := True;
    PythonSetupPage.Values[3] := True;
    PythonSetupPage.Values[4] := True;
  end else begin
    PythonSetupPage.CheckListBox.ItemEnabled[0] := False;
    PythonSetupPage.CheckListBox.ItemEnabled[1] := False;
    PythonSetupPage.CheckListBox.ItemEnabled[2] := False;
    PythonSetupPage.CheckListBox.ItemEnabled[3] := False;
    PythonSetupPage.CheckListBox.ItemEnabled[4] := False;
    PythonSetupPage.DescriptionLabel.Caption := 'Python is not installed. Install Python 3.8+ to enable these features.';
    PythonSetupPage.DescriptionLabel.Font.Color := clRed;
  end;
  
  ProgressPage := CreateOutputProgressPage('Installing Python Dependencies', 
    'Please wait while Python packages are being installed...');
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  if (PageID = PythonSetupPage.ID) and (not PythonInstalled) then
    Result := True
  else
    Result := False;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  
  if CurPageID = PythonSetupPage.ID then begin
    InstallPythonDeps := PythonSetupPage.Values[0] or 
                         PythonSetupPage.Values[1] or 
                         PythonSetupPage.Values[2] or 
                         PythonSetupPage.Values[3] or 
                         PythonSetupPage.Values[4];
  end;
end;

procedure InstallPackage(PackageName: string; Description: string; ProgressBar: TNewProgressBar);
var
  ResultCode: Integer;
begin
  ProgressPage.SetProgress(ProgressPage.ProgressBar.Position + 1, ProgressPage.ProgressBar.Max);
  ProgressPage.SetDescription(Description + '...');
  
  Exec('pip', 'install ' + PackageName + ' --quiet --no-warn-script-location', 
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure InstallSpacyModel();
var
  ResultCode: Integer;
begin
  ProgressPage.SetDescription('Downloading English language model...');
  Exec('python', '-m spacy download en_core_web_sm --quiet', 
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  VEnvDir: string;
  ResultCode: Integer;
  TotalPackages: Integer;
  CurrentPackage: Integer;
begin
  if CurStep = ssPostInstall then begin
    if not InstallPythonDeps then Exit;
    
    ProgressPage.SetProgress(0, 100);
    ProgressPage.Show;
    
    try
      VEnvDir := ExpandConstant('{app}\python-env');
      
      // Create virtual environment
      ProgressPage.SetDescription('Creating Python virtual environment...');
      Exec('python', '-m venv "' + VEnvDir + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      
      // Activate and install
      ProgressPage.SetDescription('Upgrading pip...');
      Exec('"' + VEnvDir + '\Scripts\pip.exe"', 'install --upgrade pip --quiet', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      
      TotalPackages := 0;
      if PythonSetupPage.Values[0] then Inc(TotalPackages, 2); // easyocr + pillow
      if PythonSetupPage.Values[1] then Inc(TotalPackages, 2); // spacy + model
      if PythonSetupPage.Values[2] then Inc(TotalPackages, 1); // pymupdf
      if PythonSetupPage.Values[3] then Inc(TotalPackages, 1); // python-docx
      if PythonSetupPage.Values[4] then Inc(TotalPackages, 1); // networkx
      
      ProgressPage.ProgressBar.Max := TotalPackages;
      CurrentPackage := 0;
      
      // Install selected packages
      if PythonSetupPage.Values[0] then begin
        Inc(CurrentPackage);
        ProgressPage.SetProgress(CurrentPackage, TotalPackages);
        ProgressPage.SetDescription('Installing Pillow (image processing)...');
        Exec('"' + VEnvDir + '\Scripts\pip.exe"', 'install Pillow --quiet --no-warn-script-location', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
        
        Inc(CurrentPackage);
        ProgressPage.SetProgress(CurrentPackage, TotalPackages);
        ProgressPage.SetDescription('Installing EasyOCR (~80MB, this may take a few minutes)...');
        Exec('"' + VEnvDir + '\Scripts\pip.exe"', 'install easyocr --no-warn-script-location', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      end;
      
      if PythonSetupPage.Values[1] then begin
        Inc(CurrentPackage);
        ProgressPage.SetProgress(CurrentPackage, TotalPackages);
        ProgressPage.SetDescription('Installing spaCy NLP library...');
        Exec('"' + VEnvDir + '\Scripts\pip.exe"', 'install spacy --quiet --no-warn-script-location', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
        
        Inc(CurrentPackage);
        ProgressPage.SetProgress(CurrentPackage, TotalPackages);
        ProgressPage.SetDescription('Downloading English language model...');
        Exec('"' + VEnvDir + '\Scripts\python.exe"', '-m spacy download en_core_web_sm --quiet', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      end;
      
      if PythonSetupPage.Values[2] then begin
        Inc(CurrentPackage);
        ProgressPage.SetProgress(CurrentPackage, TotalPackages);
        ProgressPage.SetDescription('Installing PyMuPDF (PDF extraction)...');
        Exec('"' + VEnvDir + '\Scripts\pip.exe"', 'install PyMuPDF --quiet --no-warn-script-location', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      end;
      
      if PythonSetupPage.Values[3] then begin
        Inc(CurrentPackage);
        ProgressPage.SetProgress(CurrentPackage, TotalPackages);
        ProgressPage.SetDescription('Installing python-docx (Word documents)...');
        Exec('"' + VEnvDir + '\Scripts\pip.exe"', 'install python-docx --quiet --no-warn-script-location', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      end;
      
      if PythonSetupPage.Values[4] then begin
        Inc(CurrentPackage);
        ProgressPage.SetProgress(CurrentPackage, TotalPackages);
        ProgressPage.SetDescription('Installing NetworkX (graph algorithms)...');
        Exec('"' + VEnvDir + '\Scripts\pip.exe"', 'install networkx --quiet --no-warn-script-location', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      end;
      
      ProgressPage.SetProgress(TotalPackages, TotalPackages);
      ProgressPage.SetDescription('Installation complete!');
      Sleep(1000);
      
    finally
      ProgressPage.Hide;
    end;
  end;
end;
