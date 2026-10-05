; The offline Python runtime contains paths up to 170 characters below INSTDIR.
; Stay below Win32 MAX_PATH, including the app-name suffix added by the wizard.
!include "LogicLib.nsh"
!ifndef BUILD_UNINSTALLER
  Function PaperSpaceCheckInstallPath
    StrLen $0 $INSTDIR
    ${If} $0 > 80
      ${IfNot} ${Silent}
        MessageBox MB_ICONSTOP|MB_OK "安装目录过长，请重新运行安装程序并选择默认目录或较短的路径（不超过 80 个字符）。$\r$\nPlease choose a shorter installation path (maximum 80 characters)."
      ${EndIf}
      SetErrorLevel 87
      Quit
    ${EndIf}
  FunctionEnd

  Function .onVerifyInstDir
    StrLen $0 $INSTDIR
    ${If} $0 > 80
      Abort
    ${EndIf}
  FunctionEnd

  !macro customInit
    Call PaperSpaceCheckInstallPath
  !macroend

  !macro customPageAfterChangeDir
    !undef MUI_PAGE_CUSTOMFUNCTION_PRE
    !define MUI_PAGE_CUSTOMFUNCTION_PRE PaperSpaceBeforeInstall
    Function PaperSpaceBeforeInstall
      Call instFilesPre
      Call PaperSpaceCheckInstallPath
    FunctionEnd
  !macroend
!endif
