var events = require('events');
var http = require( 'http' );
var https = require( 'https' );
var ch = require('ch').ch;

exports.MAX_ATTEMPTS = 3;
exports.CATEGORY = undefined;

// url: string
// extCallback: function( err , body )
// maxAttempts: count
// category: string
exports.fetchPage = function( config , attemptNumber ) {
    var method;
    var retry;

    // Determine request method
    if( 'https://' === config.url.substr( 0 , 8 ) ) {
        method = https;
    } else if( 'http://' === config.url.substr( 0 , 7 ) ) {
        method = http;
    } else {
        throw 'Unknown method for URL: ' + config.url;
    }

    // Init
    attemptNumber = attemptNumber || 0;
    config.maxAttempts = config.maxAttempts || exports.MAX_ATTEMPTS;
    config.category = config.category || exports.CATEGORY;

    // Generic error handler
    retry = function( error ) {
        var shouldRetry = ( attemptNumber + 1 < config.maxAttempts );

        console.log(
            'Error fetching: ' + config.url + '\n'
            + '    Details: ' + JSON.stringify(error).replace(/\n/,'\n        ') + '\n'
            + '    Status: ' + ( shouldRetry ? ' retrying' : 'giving up' )
        );

        if( shouldRetry ) {
            exports.fetchPage( config , attemptNumber + 1 );
        } else {
            if( config.extCallback ) {
                config.extCallback( error , null );
                config.extCallback = null;
            }
        }
    };

    // Queue network call (using default category)
    ch.queue({
        category: config.category,
        curryRelease: true,
        callback: function( release ) {
            // Build the request and response handler
            var req = method.request( config.url , function( res ) {
                // If the status code is outside the 200 range
                if( 200 > res.statusCode || 299 < res.statusCode ) {
                    retry( 'Status: ' + res.statusCode );
                    release();
                    return;
                }

                // Gather the entire body first
                var body = '';
                res.setEncoding( 'utf8' );
                res.on( 'data' , function( chunk ) {
                    body += chunk;
                } );

                // Pass the body to the config.extCallback
                res.on( 'end' , function() {
                    if( config.extCallback ) {
                        config.extCallback( null , body );
                        config.extCallback = null;
                        release();
                    }
                } );
            } );

            // If there's an error connecting / performing DNS lookup / etc
            req.on( 'error' , function( error ) {
                retry( error );
                release();
            } );

            // Send no body
            req.end();
        },
    });
};
