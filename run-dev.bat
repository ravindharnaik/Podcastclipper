@echo off
echo Starting Podcast Clipper (Browser-Only Version)
echo =============================================
set PATH=%PATH%;C:\Program Files\nodejs
cd /d "C:\xampp\htdocs\Podcastclipper\frontend"
echo Installing dependencies...
npm install
echo Starting development server...
npm run dev
pause
