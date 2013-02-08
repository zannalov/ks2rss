////////////////////////////////////////////////////////////////////////////////
// Modules
////////////////////////////////////////////////////////////////////////////////

var fs = require( 'fs' );
var http = require( 'http' );
var jquery = require( 'jquery' );
var jsdom = require('jsdom').jsdom;

////////////////////////////////////////////////////////////////////////////////
// Config
////////////////////////////////////////////////////////////////////////////////

var testMode = true;
var basePath = 'http://www.kickstarter.com';
var stubs = [
    '/discover/recommended',
    '/discover/recently-launched',
    '/discover/ending-soon',
    '/discover/small-projects',
    '/discover/categories/art/popular',
    '/discover/categories/art/recommended',
    '/discover/categories/comics/popular',
    '/discover/categories/comics/recommended',
];

////////////////////////////////////////////////////////////////////////////////
// Debug code to serve sample files
////////////////////////////////////////////////////////////////////////////////

if( testMode ) {
    (function(){
        var sampleServer = http.createServer();
        sampleServer.listen( 8000 );
        sampleServer.on( 'request' , function( req , res ) {
            if( '/samples/' == req.url.substr( 0 , 9 ) ) {
                fs.readFile( '.' + req.url , function( err , data ) {
                    if( err ) {
                        res.writeHead( 500 );
                        res.end( err );
                    } else {
                        res.writeHead( 200 );
                        res.end( data );
                    }
                } );
            } else {
                res.writeHead( 400 );
                res.end( 'Bad request' );
            }
        } );

        basePath = 'http://localhost:8000/samples';
        stubs = [
            '/discover/recommended',
            '/discover/ending-soon',
        ];
    })();
}

////////////////////////////////////////////////////////////////////////////////
// Fetch a single page
////////////////////////////////////////////////////////////////////////////////

// callback( err , data )
function fetchPage( url , callback ) {
    var req = http.request( url , function( res ) {
        // If the status code is outside the 200 range
        if( 200 > res.statusCode || 299 < res.statusCode ) {
            if( callback ) {
                callback( 'Status: ' + res.statusCode , null );
                callback = null;
            }

            return;
        }

        var body = '';
        res.setEncoding( 'utf8' );
        res.on( 'data' , function( chunk ) {
            body += chunk;
        } );
        res.on( 'end' , function() {
            if( callback ) {
                callback( null , body );
                callback = null;
            }
        } );
    } );
    req.on( 'error' , function( e ) {
        if( callback ) {
            callback( e , null );
            callback = null;
        }
    } );
    req.end();
}

fetchPage( basePath + stubs[0] + '?page=1' , function( err , data ) {
    if( err ) {
        console.log( err );
        return;
    }

    var doc = jsdom( data );
    var window = doc.createWindow();
    var jq = jquery.create( window );

    console.log( jq( 'li.project' ).length );
} );
