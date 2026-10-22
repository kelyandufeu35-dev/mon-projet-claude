#!/bin/sh
# Recrée squishytime-theme.zip à partir du dossier theme/ (à lancer après chaque modification du thème).
set -e
cd "$(dirname "$0")/theme"
rm -f ../squishytime-theme.zip
zip -qrX ../squishytime-theme.zip assets config layout locales sections snippets templates
echo "squishytime-theme.zip prêt"
