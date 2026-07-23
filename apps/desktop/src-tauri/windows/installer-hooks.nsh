; Eclipse Chat installer theme and Windows Shell refresh.
; This file is included before MUI pages are declared by Tauri's NSIS template.

!define MUI_BGCOLOR "090B11"
!define MUI_TEXTCOLOR "F2F4FA"
!define MUI_INSTFILESPAGE_COLORS "D9E0ED 090B11"
!define MUI_INSTFILESPAGE_PROGRESSBAR "colored"
InstallColors FF9D44 111722

!macro NSIS_HOOK_POSTINSTALL
  ; Existing shortcuts retain the previous executable icon in the Windows cache.
  ; Recreate only shortcuts the user already has; the finish page still controls
  ; whether a new desktop shortcut is created for first-time installs.
  IfFileExists "$DESKTOP\${PRODUCTNAME}.lnk" 0 +2
    Call CreateOrUpdateDesktopShortcut

  ; Notify Explorer that icon and association metadata changed.
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
