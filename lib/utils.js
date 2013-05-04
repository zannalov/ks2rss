var fs = require('fs');

exports.VERSION = JSON.parse( fs.readFileSync( __dirname + '/../package.json' ) ).version;

exports.urlCleanup = function( url , sourceUrl ) {
    // Strip out query parameters
    if( -1 !== url.indexOf( '?' ) ) {
        url = url.substr( 0 , url.indexOf( '?' ) );
    }

    // Convert https to http
    if( 'https' === url.substr( 0 , 5 ) ) {
        url = 'http' + url.substr( 5 );
    }

    // If jQuery turned it into a local file URL
    if( 'file://' === url.substr( 0 , 7 ) ) {
        url = sourceUrl.split( '/' ).slice( 0 , 2 ) + url.substr( 7 );
    }

    return url;
};

exports.whitespace = function( str ) {
    str = str.replace( /^\s+/ , '' );
    str = str.replace( /\s+$/ , '' );
    str = str.replace( /\s+/ , ' ' );
    return str;
};
