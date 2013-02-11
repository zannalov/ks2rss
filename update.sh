#!/bin/bash

cd $( dirname "$BASH_SOURCE" )
node app || { echo "Exit code: $?"; exit 1; }
mv ks2rss5.xml /var/www/zannalov.com/
