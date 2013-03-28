#!/bin/bash

DIR=$( dirname "$BASH_SOURCE" )""
LOGFILE="log.txt"

cd "$DIR"
echo -n "Started: " >>"$LOGFILE" ; date >>"$LOGFILE"
node app >>"$LOGFILE" || { echo "Exit code: $?"; exit 1; }
echo -n "Finished: " >>"$LOGFILE" ; date >>"$LOGFILE"
mv -v ks2rss5.xml /var/www/zannalov.com/ >>"$LOGFILE"
