; Eclipse NSIS installer hooks
; Ces macros s'executent avant l'installation et la desinstallation
; pour tuer Eclipse.exe et le node.exe enfant, evitant les erreurs
; "file in use" lors d'une mise a jour.

!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Arret des processus Eclipse avant installation..."
  nsExec::ExecToLog 'taskkill /F /IM Eclipse.exe /T'
  nsExec::ExecToLog 'taskkill /F /IM node.exe /T'
  ; Laisser Windows liberer les handles
  Sleep 2000
!macroend

; POSTINSTALL : relance Eclipse.exe apres une install silencieuse (mise a
; jour via l'auto-updater). En mode /S, la page de fin n'est pas affichee
; donc Tauri ne relance pas l'app automatiquement : on le fait ici. Le
; chemin $INSTDIR pointe vers le dossier d'installation NSIS.
!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Relance d'Eclipse apres installation..."
  ; Lancer en detach pour ne pas bloquer l'installeur.
  nsExec::ExecToLog '"$INSTDIR\Eclipse.exe"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Arret des processus Eclipse avant desinstallation..."
  nsExec::ExecToLog 'taskkill /F /IM Eclipse.exe /T'
  nsExec::ExecToLog 'taskkill /F /IM node.exe /T'
  Sleep 2000
!macroend
