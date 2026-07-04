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
Name: "setuppython"; Description: "Install Python dependencies (recommended for full features)"; GroupDescription: "Optional:"

[Files]
Source: "dist-electron\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "setup-python.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "python-requirements.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Setup Python Dependencies"; Filename: "{app}\setup-python.bat"; Tasks: setuppython
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startupicon

[Run]
Filename: "{app}\setup-python.bat"; Description: "Setup Python dependencies for OCR, Document Intelligence, etc."; Flags: postinstall skipifsilent; Tasks: setuppython
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
