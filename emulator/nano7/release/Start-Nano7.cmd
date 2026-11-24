@echo off
setlocal
set "NANO7_NODE=%~dp0runtime\node.exe"
if not exist "%NANO7_NODE%" (
  echo The bundled Node.js executable is missing. Extract the whole archive and try again.
  exit /b 1
)
"%NANO7_NODE%" "%~dp0launcher.mjs" %*
exit /b %errorlevel%
