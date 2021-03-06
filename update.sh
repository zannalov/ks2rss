#!/bin/bash

DIR=$( dirname "$BASH_SOURCE" )""
LOGFILE="log.txt"

cd "$DIR"

echo -n "Started: " >>"$LOGFILE" ; date >>"$LOGFILE"
for c in indianapolis recently-launched ; do
    echo "Config: $c" >>"$LOGFILE"
    node app --config ./config/$c.json >>"$LOGFILE" ; exit_code=$?
    echo "Exit code: $exit_code" >>"$LOGFILE"
    if [[ "0" != "$exit_code" ]]; then
        echo "Config $c exit code $exit_code"
    fi
done
echo -n "Finished: " >>"$LOGFILE" ; date >>"$LOGFILE"
