var https = require( 'https' );
var url = require( 'url' );
var async = require( 'async' );

exports.publishUpdates = function( hubUrls , feedUrls , publishUpdatesCallback ) {
    var calls = [];

    // Turn arguments into arrays if not already
    if( ! ( hubUrls instanceof Array ) ) {
        hubUrls = [ hubUrls ];
    }
    if( ! ( feedUrls instanceof Array ) ) {
        feedUrls = [ feedUrls ];
    }

    // Encode and join feed urls with web form encoding
    feedUrls.forEach( function( feedUrl , index ) {
        feedUrls[ index ] = encodeURIComponent( feedUrl );
    } );
    feedUrls = feedUrls.join( '&hub.url=' );

    // For each hubUrl, prepare handler method
    hubUrls.forEach( function( hubUrl , index ) {
        hubUrls[ index ] = function( nextStepCallback ) {
            var opts, req;

            // Break URL into options
            opts = url.parse( hubUrl );

            // PubSubHubbub Publish calls are always POST events
            opts.method = 'POST';

            // User-Agent to identify the system making this call
            opts.headers = {
                'User-Agent': 'pubsubhubbub-client-node-js',
                'Content-Type': 'application/x-www-form-urlencoded',
            };

            // Response handler
            function handleRes( res ) {
                if( 204 === res.statusCode ) {
                    publishUpdatesCallback( null , true );
                } else {
                    publishUpdatesCallback( 'HTTP status: ' + res.statusCode , true );
                }
            }

            // Start the call
            req = https.request( opts , handleRes );

            // If there's an error connecting / performing DNS lookup / etc
            req.on( 'error' , function( error ) {
                publishUpdatesCallback( error , null );
            } );

            // Send the body and finish the call
            req.write( 'hub.mode=publish&hub.url=' + feedUrls );
            req.end();
        };
    } );
    
    // Kick off all simultaneously and wait for all to complete
    async.parallel( hubUrls , function() {
        publishUpdatesCallback.apply( this , arguments );
    } );
};
