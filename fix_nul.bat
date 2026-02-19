@echo off
cd /d "D:\Dev\daniel-augusto-v2"
echo Attempting to delete nul file...
\\.\nul
echo Error is expected - nul is a reserved name
echo.
echo Trying alternative method...
powershell -Command "cmd /c 'echo. > nul'"
