#!/bin/bash

DIR=$( dirname "$BASH_SOURCE" )""
LOGFILE="log.txt"

cd "$DIR"

echo -n "Started: " >>"$LOGFILE" ; date >>"$LOGFILE"
for c in recently-launched ending-soon indianapolis ; do
    echo "Config: $c" >>"$LOGFILE"
    node app --config ./config/$c.json >>"$LOGFILE" ; exit_code=$?
    echo "Exit code: $exit_code" >>"$LOGFILE"
    if [[ "0" != "$exit_code" ]]; then
        echo "Config $c exit code $exit_code"
    else
        mv -v var/ks2rss6-$c.xml /var/www/zannalov.com/ >>"$LOGFILE"
    fi
done
echo -n "Finished: " >>"$LOGFILE" ; date >>"$LOGFILE"
