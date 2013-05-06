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

exports.scrubHtml = function( jq , el ) {
    jq( 'applet,canvas,embed,frameset,input,link,object,script,select,style,textarea,title' , el ).remove();

    jq( 'button' , el ).each( function( item ) {
        var span = jq('<span></span>');
        span.append( item.contents() );
        span.replaceAll( item );
    } );

    jq( 'body,form,head,html' , el ).each( function( item ) {
        var div = jq('<div></div>');
        div.append( item.contents() );
        div.replaceAll( item );
    } );

    jq( 'iframe' , el ).each( function( index , item ) {
        var link = jq('<a href="#"></a>');
        link.attr( 'href' , jq( item ).attr( 'src' ) );
        link.append( jq( item ).attr('src') );
        link.replaceAll( item );
    } );
};

exports.escapeXml = function ( str ) {
    // &#....;
    return str.replace( /[^A-Za-z0-9 :;\/\\.?=!$%()*+,@\[\]^_{}"'-]/g, function( m ) {
        return '&#x' + m.charCodeAt(0).toString(16).toUpperCase() + ';';
    } );
}

exports.rfc822date = function( date ) {
    var aMonths = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];
    var aDays = [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ];
    var dtm = '';

    var padWithZero = function(val) {
        if( parseInt( val , 10 ) < 10 ) {
            val = '0' + val;
        }

        return val;
    }

    var getTZstring = function( offset ) {
        var hours = Math.floor( offset / 60 );
        var modMin = Math.abs( offset % 60 );
        var absHours = Math.abs( hours );

        return (
            ( ( hours > 0 ) ? "-" : "+" )
            + ( ( absHours < 10 ) ? "0" + absHours : absHours )
            + ( ( modMin == 0 ) ? "00" : modMin )
        );
    };

    dtm = (
        aDays[ date.getDay() ] + ", "
        + padWithZero( date.getDate() ) + " "
        + aMonths[ date.getMonth() ] + " "
        + date.getFullYear() + " "
        + padWithZero( date.getHours() ) + ":"
        + padWithZero( date.getMinutes() ) + ":"
        + padWithZero( date.getSeconds() ) + " "
        + getTZstring( date.getTimezoneOffset() )
    );
    return dtm;
};
