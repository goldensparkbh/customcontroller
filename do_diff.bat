@echo off
git log -p src/pages/Configurator.jsx > git_history.txt
git status >> git_history.txt
echo Done.
