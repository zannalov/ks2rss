#!/bin/bash

DIR=$( dirname "$BASH_SOURCE" )""
LOGFILE="log.txt"

cd "$DIR"
echo -n "Started: " >>"$LOGFILE" ; date >>"$LOGFILE"
node app >>"$LOGFILE" ; exit_code=$?
echo "Exit code: $exit_code" >>"$LOGFILE"
echo -n "Finished: " >>"$LOGFILE" ; date >>"$LOGFILE"
if [[ "0" != "$exit_code" ]]; then
    echo "Exit code: $?"
    exit 1
fi
mv -v ks2rss5.xml /var/www/zannalov.com/ >>"$LOGFILE"
