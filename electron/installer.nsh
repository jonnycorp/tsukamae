# electron-builder's nsis.include: the installer asks which shortcuts to add, on a page of its own, rather than placing
# them unasked. This file is read before MUI2, nsDialogs and LogicLib load, so everything using them sits inside the
# hook macros, which only expand later in the script

!ifndef BUILD_UNINSTALLER
  Var startMenuShortcut
  Var desktopShortcut
  Var startMenuShortcutBox
  Var desktopShortcutBox

  # by language id, as the LANG_ names aren't defined yet; one per installerLanguages entry in package.json, since a
  # language without its string fails the build
  LangString shortcutsTitle 1033 "Shortcuts"
  LangString shortcutsTitle 1041 "ショートカット"
  LangString shortcutsSubtitle 1033 "Choose where to add shortcuts to ${PRODUCT_NAME}."
  LangString shortcutsSubtitle 1041 "${PRODUCT_NAME}のショートカットを追加する場所を選んでください。"
  LangString shortcutsStartMenu 1033 "Start menu"
  LangString shortcutsStartMenu 1041 "スタートメニュー"
  LangString shortcutsDesktop 1033 "Desktop"
  LangString shortcutsDesktop 1041 "デスクトップ"
!endif

# electron-builder parks a copy of the installer here for electron-updater's differential downloads; with no updater it's
# 100 MB nothing reads, which its uninstaller would leave behind for good
!macro removeUpdaterCache
  Delete "$LOCALAPPDATA\${APP_INSTALLER_STORE_FILE}"
  RMDir "$LOCALAPPDATA\tsukamae-updater"
!macroend

# for the current user only, as the one-click installer was: the assisted one skips its "only for me / anyone using
# this computer" page and never asks to elevate
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

# each box starts ticked only if that shortcut exists now, so a first install adds none unless asked and a reinstall or
# upgrade keeps whichever you have. This is also what a silent install (/S), which shows no pages, goes by
!macro customInit
  StrCpy $startMenuShortcut ${BST_UNCHECKED}
  ${if} ${FileExists} "$SMPROGRAMS\${SHORTCUT_NAME}.lnk"
    StrCpy $startMenuShortcut ${BST_CHECKED}
  ${endIf}
  StrCpy $desktopShortcut ${BST_UNCHECKED}
  ${if} ${FileExists} "$DESKTOP\${SHORTCUT_NAME}.lnk"
    StrCpy $desktopShortcut ${BST_CHECKED}
  ${endIf}
!macroend

!macro customPageAfterChangeDir
  !include nsDialogs.nsh

  Page custom shortcutsPage shortcutsPageLeave

  Function shortcutsPage
    ${if} ${isUpdated}
      Abort
    ${endIf}
    !insertmacro MUI_HEADER_TEXT "$(shortcutsTitle)" "$(shortcutsSubtitle)"
    nsDialogs::Create 1018
    Pop $0
    ${NSD_CreateCheckbox} 0 0 100% 12u "$(shortcutsStartMenu)"
    Pop $startMenuShortcutBox
    ${NSD_SetState} $startMenuShortcutBox $startMenuShortcut
    ${NSD_CreateCheckbox} 0 18u 100% 12u "$(shortcutsDesktop)"
    Pop $desktopShortcutBox
    ${NSD_SetState} $desktopShortcutBox $desktopShortcut
    nsDialogs::Show
  FunctionEnd

  Function shortcutsPageLeave
    ${NSD_GetState} $startMenuShortcutBox $startMenuShortcut
    ${NSD_GetState} $desktopShortcutBox $desktopShortcut
  FunctionEnd
!macroend

# adds or removes each shortcut to match the page. Both are only ever made here (createDesktopShortcut and
# createStartMenuShortcut are off), so an install that doesn't want one never flashes it into place first
!macro customInstall
  ${if} $startMenuShortcut == ${BST_CHECKED}
    ${ifNot} ${FileExists} "$newStartMenuLink"
      CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
    ${endIf}
    StrCpy $launchLink "$newStartMenuLink"
  ${else}
    WinShell::UninstShortcut "$newStartMenuLink"
    Delete "$newStartMenuLink"
    # the finish page's Run opens this, which would otherwise be the deleted shortcut
    StrCpy $launchLink "$appExe"
  ${endIf}

  ${if} $desktopShortcut == ${BST_CHECKED}
    ${ifNot} ${FileExists} "$newDesktopLink"
      CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    ${endIf}
  ${else}
    WinShell::UninstShortcut "$newDesktopLink"
    Delete "$newDesktopLink"
  ${endIf}

  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'

  # after installApplicationFiles, which makes the copy
  !insertmacro removeUpdaterCache
!macroend

# electron-builder makes neither shortcut, so its uninstaller removes neither and this does, except when an upgrade
# runs the old uninstaller, which keeps shortcuts for the new version to reconcile
!macro customUnInstall
  ${ifNot} ${isKeepShortcuts}
    WinShell::UninstShortcut "$oldStartMenuLink"
    Delete "$oldStartMenuLink"
    WinShell::UninstShortcut "$oldDesktopLink"
    Delete "$oldDesktopLink"
  ${endIf}
  !insertmacro removeUpdaterCache
!macroend
