@echo off
title IBKR Stock Alert Telegram Bot
cd /d "%~dp0"
echo ====================================================
echo Starting IBKR Stock Alert Bot...
echo ====================================================
node index.js
pause
